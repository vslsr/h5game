// 后端：Express + Socket.IO 服务器入口
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { GAME_CONSTANTS } from '../shared/types';
import { RoomManager } from './room';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;
const { TICK_MS } = GAME_CONSTANTS;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const app = express();
if (IS_PRODUCTION) {
    const distPath = path.join(__dirname, '..', 'dist');
    if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
    }
    app.get('/', (_req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        }
        else {
            res.status(404).send('Build not found. Run: npm run build');
        }
    });
}
else {
    app.use(express.static(path.join(__dirname, '..')));
    app.get('/', (_req, res) => {
        res.sendFile(path.join(__dirname, '..', 'index.html'));
    });
}
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
});
const roomManager = new RoomManager();
roomManager.attachIo(io);
io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.id}`);
    const state = { roomId: null, playerId: socket.id };
    socket.on('joinRoom', ({ roomId, playerName }) => {
        const room = roomManager.getOrCreate(roomId || 'default');
        state.roomId = room.id;
        const player = room.createPlayer(socket.id, playerName);
        room.addPlayer(player);
        socket.join(room.id);
        const selection = room.getSelection(state.playerId);
        socket.emit('joined', {
            selfId: player.id,
            self: player,
            players: room.getPlayersSnapshot(),
            obstacles: room.obstacles,
            units: room.getUnits(state.playerId),
            selectedUnitId: selection?.selectedUnitId ?? '',
            selectedSkillIndex: selection?.selectedSkillIndex ?? 0
        });
        socket.to(room.id).emit('playerJoined', player);
        console.log(`[Join] ${player.name} -> ${room.id} (total: ${room.players.size})`);
    });
    socket.on('playerInput', (input) => {
        if (!state.roomId)
            return;
        const room = roomManager.get(state.roomId);
        if (!room)
            return;
        room.applyInput(state.playerId, input);
    });
    // 选择单位
    socket.on('unitSelect', (payload) => {
        if (!state.roomId)
            return;
        const room = roomManager.get(state.roomId);
        if (!room)
            return;
        if (room.selectUnit(state.playerId, payload.unitId)) {
            const sel = room.getSelection(state.playerId);
            socket.emit('selectionUpdated', {
                selectedUnitId: sel?.selectedUnitId ?? '',
                selectedSkillIndex: sel?.selectedSkillIndex ?? 0
            });
        }
    });
    // 选择技能（索引）
    socket.on('skillSelect', (payload) => {
        if (!state.roomId)
            return;
        const room = roomManager.get(state.roomId);
        if (!room)
            return;
        if (room.selectSkill(state.playerId, payload.index)) {
            const sel = room.getSelection(state.playerId);
            socket.emit('selectionUpdated', {
                selectedUnitId: sel?.selectedUnitId ?? '',
                selectedSkillIndex: sel?.selectedSkillIndex ?? 0
            });
        }
    });
    // 子弹发射：基于当前选中的技能属性
    socket.on('bulletFire', (payload) => {
        if (!state.roomId)
            return;
        const room = roomManager.get(state.roomId);
        if (!room)
            return;
        const owner = room.players.get(state.playerId);
        if (!owner)
            return;
        const currentSkill = room.getSelectedSkill(state.playerId);
        const skill = currentSkill?.skill;
        if (!skill)
            return;
        // 归一化方向
        let { vx, vy } = payload;
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len === 0)
            return;
        const dirX = vx / len;
        const dirY = vy / len;
        // 蓄力大小限制在 0.2 ~ 1.0
        const charge = Math.min(1.0, Math.max(0.2, payload.charge));
        // 速度 & 伤害插值
        const speed = skill.speedMin + (skill.speedMax - skill.speedMin) * charge;
        const damage = Math.round(skill.damageMin + (skill.damageMax - skill.damageMin) * charge);
        const bullet = {
            id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            ownerId: owner.id,
            ownerName: owner.name,
            ownerHue: currentSkill.unit.hue,
            ownerSkillId: skill.skillId,
            x: payload.x,
            y: payload.y,
            vx: dirX * speed,
            vy: dirY * speed,
            createdAt: Date.now(),
            damage,
            lifetimeMs: skill.lifetimeMs,
            explosive: skill.explosive,
            explosionRadius: skill.explosionRadius,
            explosionDamage: skill.explosionDamage
        };
        room.addBullet(bullet);
        io.to(state.roomId).emit('bulletFired', bullet);
    });
    socket.on('disconnect', () => {
        if (!state.roomId)
            return;
        const room = roomManager.get(state.roomId);
        if (room) {
            const player = room.players.get(state.playerId);
            room.removePlayer(state.playerId);
            socket.to(state.roomId).emit('playerLeft', state.playerId);
            console.log(`[Disconnect] ${player?.name ?? state.playerId} from ${state.roomId}`);
        }
    });
});
setInterval(() => {
    for (const room of roomManager.getAll()) {
        room.tick();
        io.to(room.id).emit('gameState', room.getPlayersSnapshot());
    }
}, TICK_MS);
httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`端口 ${PORT} 已被占用。使用: npm run kill-port 或 set PORT=${PORT + 1} && npm start`);
        process.exit(1);
    }
    else {
        console.error('[Server Error]', err);
    }
});
httpServer.listen(PORT, () => {
    const ips = [];
    const ifaces = os.networkInterfaces();
    for (const name in ifaces) {
        const ifaceList = ifaces[name];
        if (!ifaceList)
            continue;
        for (const iface of ifaceList) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    console.log('\n=== H5 Game Server ===');
    if (IS_PRODUCTION) {
        console.log(`[Production] 访问: http://localhost:${PORT}`);
    }
    else {
        console.log(`[Dev] Socket.IO: ws://localhost:${PORT}`);
        console.log(`[Dev] 前端页面: http://localhost:5173 (Vite dev server)`);
        console.log(`[Dev] 也可直接访问 http://localhost:${PORT}`);
    }
    for (const ip of ips)
        console.log(`       http://${ip}:${PORT}`);
    console.log('');
});
