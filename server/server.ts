// 服务端入口：Express + Socket.IO（联网 + 单位弹射物理 + 技能系统）
import express from 'express';
import fs from 'fs';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { GameRoom } from './room.js';
import { GAME_CONSTANTS } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json());

// ============== 生产模式：托管 Vite 构建产物 dist/ ==============
// 路径相对 server/server.ts：通常 dist 在仓库根；允许被 env 覆盖
const DIST = process.env.H5SGAME_DIST || path.resolve(__dirname, '..', '..', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST, { maxAge: '1h', index: 'index.html' }));
  // 所有未匹配的路由返回 index.html（SPA fallback）
  app.get('*', (_req, res, next) => {
    if (_req.headers.accept && _req.headers.accept.includes('text/html')) {
      res.sendFile(path.join(DIST, 'index.html'));
      return;
    }
    next();
  });
  console.log(`[server] serving static from: ${DIST}`);
}

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// 全局单房间（多人即加入同一房间）
const room = new GameRoom(() => {
  // tick 回调：每 tick 广播所有单位位置给所有客户端
  io.emit('gameState', {
    players: room.snapshotPlayers(),
    units: room.snapshotUnits(),
  });
}, {
  // 游戏事件（单位死亡、技能施放等）：通过 gameEvent 单独广播给所有客户端
  onGameEvent: (evt) => {
    io.emit('gameEvent', evt);
  },
});

io.on('connection', (socket) => {
  console.log(`[socket] connected ${socket.id}`);

  socket.on('joinRoom', (payload: { name?: string }) => {
    const name = (payload?.name || '玩家').toString().slice(0, 16);
    room.createPlayer(socket.id, name);

    socket.emit('joined', room.getStateFor(socket.id));
    io.emit('gameState', {
      players: room.snapshotPlayers(),
      units: room.snapshotUnits(),
    });
    console.log(`[room] ${socket.id} (${name}) joined; units=${room.snapshotUnits().length}`);
  });

  // 技能施放：客户端按住选中单位拖拽/点地 → 松手后发送
  socket.on('castSkill', (payload: {
    unitId: string;
    skillId: string;
    dirX: number;
    dirY: number;
    charge: number;
    pointX?: number;
    pointY?: number;
  }) => {
    if (!payload?.unitId || !payload?.skillId) return;
    const unit = room.applySkill(
      payload.unitId,
      socket.id,
      payload.skillId,
      typeof payload.dirX === 'number' ? payload.dirX : 0,
      typeof payload.dirY === 'number' ? payload.dirY : 0,
      typeof payload.charge === 'number' ? payload.charge : 0.5,
      typeof payload.pointX === 'number' ? payload.pointX : undefined,
      typeof payload.pointY === 'number' ? payload.pointY : undefined,
    );
    if (unit) {
      // 立即广播一次最新状态（速度/位置变化 + HP 变化）
      io.emit('gameState', {
        players: room.snapshotPlayers(),
        units: room.snapshotUnits(),
      });
    }
  });

  socket.on('disconnect', () => {
    room.removePlayer(socket.id);
    io.emit('gameState', {
      players: room.snapshotPlayers(),
      units: room.snapshotUnits(),
    });
    console.log(`[socket] ${socket.id} disconnected`);
  });
});

// 开发模式：页面从 Vite 的 5173 加载，:3000 只提供跳转页
app.get('/', (_req, res) => {
  res.type('text/html; charset=utf-8');
  res.send(
    '<!doctype html><html><head><title>Redirecting...</title>' +
    '<meta http-equiv="refresh" content="0; url=http://localhost:5173/"></head>' +
    '<body style="background:#0f1624;color:#fff;font-family:sans-serif;padding:40px;text-align:center">' +
    '<h2>请在开发服务器 http://localhost:5173/ 打开游戏</h2>' +
    '<p>（后端 Socket.IO 运行于端口 3000；页面由 Vite 提供）</p>' +
    '</body></html>'
  );
});

const PORT = Number(process.env.PORT) || 3000;

// ============== 热更接口：部署成功后 systemctl 会重启本进程 ==============
// 安全：通过 H5SGAME_DEPLOY_KEY 环境变量设置密钥；未设置则禁用该接口
const DEPLOY_KEY = process.env.H5SGAME_DEPLOY_KEY || '';
app.post('/api/deploy', (req, res) => {
  if (!DEPLOY_KEY) {
    res.statusCode = 403;
    res.json({ ok: false, message: 'deploy disabled (set H5SGAME_DEPLOY_KEY)' });
    return;
  }
  const key = (req.headers['x-deploy-key'] || req.query.key || req.body?.key) as string;
  if (key !== DEPLOY_KEY) {
    res.statusCode = 403;
    res.json({ ok: false, message: 'invalid deploy key' });
    return;
  }
  const logPath = path.join(__dirname, '..', 'deploy.log');
  // 异步执行部署脚本（执行时间长，立即返回开始标识，真正完成由脚本重启本进程）
  import('child_process').then(({ exec }) => {
    const script = path.join(__dirname, '..', 'deploy', 'deploy.sh');
    const cp = exec(`bash "${script}" > "${logPath}" 2>&1`, (err, stdout, stderr) => {
      console.log(`[deploy] exit=${err?.code ?? 0} out=${stdout.length}B err=${stderr.length}B`);
    });
    cp.unref();
  });
  res.json({ ok: true, message: 'deploy started, server will restart shortly' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] h5sgame on http://0.0.0.0:${PORT}/  tick_ms=${GAME_CONSTANTS.TICK_MS}`);
  console.log(`[server] DEPLOY_KEY=${DEPLOY_KEY ? '<set>' : '<off>'}`);
});
