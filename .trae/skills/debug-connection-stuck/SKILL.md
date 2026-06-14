---
name: "debug-connection-stuck"
description: "诊断 Vite+Socket.IO 项目前端一直处于“连接中…”的根因（端口混淆/CORS/TS 未转译）。Invoke when user reports '一直连接中' or page shows loading spinner indefinitely."
---

# 前端一直“连接中…” 排查指引（Vite + Express + Socket.IO）

## 问题现象

打开页面后，长时间停留在 “连接中…” / “Loading…” 状态，游戏画面不出现。
控制台**没有** Socket.IO 错误日志（或仅有 connect_error 重复）。

## 根因汇总（按概率降序）

### 1. 走了错误的端口（最常见）

**症状**：地址栏里是 `http://<host>:3000/` 而不是 `http://<host>:5173/`。

**原因**：
- `3000` 是 **Express + Socket.IO 纯后端**，只处理 `socket.io` 握手，**不做 TypeScript 转译**。
- `index.html` 里的 `<script src="/src/main.ts">` 浏览器拿到的是**原始 `.ts` 文本**，根本不执行 → JS 侧的 `GameSocket.connect()` 从未被调用 → 页面永远在 loading。
- `5173` 是 **Vite 开发服务器**，负责 TS/JSX 转译 + HMR，同时通过 `vite.config.ts` 里的代理把 `/socket.io` 转发到 `localhost:3000`。

**修复**：始终从 `:5173` 打开页面（本机 `localhost:5173`，局域网 `192.168.x.x:5173`）。

### 2. Socket.IO 客户端连到跨域端口

**症状**：地址栏是 `:5173`，但代码里写了 `io('http://<host>:3000')` 或 `io(serverUrl)` 其中 serverUrl 被改成了 `:3000`。

**原因**：浏览器对跨域 WebSocket/长轮询做 CORS 预检，服务端 `cors.origin: '*'` 与 `withCredentials: true` 互斥，预检失败。Node 脚本测试之所以过，是因为 Node **不遵守 CORS**。

**修复**：前端连接字符串写 `location.origin`（即页面当前的 `:5173`），由 Vite 代理转发 `/socket.io` 到 `:3000`，完全同源，零 CORS 问题。

```ts
// src/net/socket.ts — 正确写法
this.socket = io(location.origin, {
  transports: ['polling', 'websocket'],
  reconnection: true,
  withCredentials: false
});
```

**Vite 代理配置**（确保存在）：

```ts
// vite.config.ts
export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  }
});
```

### 3. 服务端未启动 / 端口被占用

**症状**：DevTools Console 显示 `connect_error` 重复出现。

**排查**：

```powershell
# Windows — 查看 3000/5173 是否监听
Get-NetTCPConnection -LocalPort 3000
Get-NetTCPConnection -LocalPort 5173
```

**解决**：
- 先 `Stop-Process -Id <PID> -Force` 杀掉旧进程，或
- 改端口：`$env:PORT=3001 ; npx tsx server/server.ts`（Vite 代理 target 也要同步改）

### 4. `index.html` 里没有执行入口脚本

**症状**：DevTools Console 无任何 `[GameSocket]` 输出。

**检查**：`index.html` 的 `<script src="/src/main.ts">` 是否存在；路径是否正确；main.ts 中是否调用了 `gameSocket.connect()`。

## 验证流程（1 分钟内可确认）

1. 打开浏览器 DevTools → **Console** 面板
2. 刷新页面，查看是否出现：
   - `[GameSocket] connecting to ...` — 入口执行成功
   - `[GameSocket] connected, sid=...` — 连接成功
   - `[Main] joined as ...` — 房间加入成功
3. 如果 `connecting to` 都没出现 → 回到“根因 1”（端口错或 main.ts 未执行）
4. 如果只有 `connect_error` 重复 → 回到“根因 2 或 3”（跨域或服务端未起）

## 开发期与生产期的入口差异

| 阶段 | 页面入口 | Socket.IO 入口 |
|------|---------|---------------|
| **开发** | `http://<host>:5173/` | Vite 代理 `/socket.io` → `localhost:3000` |
| **生产** (`npm run build`) | `http://<host>:3000/` | Express 直接 serve `dist/` 目录 + Socket.IO 同源 |

> 生产构建后 Vite 退出历史舞台，所有静态资源从 `dist/` 由 Express 直接托管，这时 `:3000` 才是真正的唯一入口。

## 可执行的最小测试脚本（Node）

当需要快速验证 Vite 代理是否工作时：

```js
// 保存为 test-join.mjs 然后 node test-join.mjs
import { io } from 'socket.io-client';
const socket = io('http://localhost:5173', { // 走 Vite 代理
  transports: ['polling', 'websocket'],
  withCredentials: false,
  timeout: 8000
});
socket.on('connect', () => {
  console.log('connected sid=', socket.id);
  socket.emit('joinRoom', { roomId: 'default', playerName: 'test' });
});
socket.on('joined', (d) => {
  console.log('joined players=', d.players.length, 'units=', d.units.length);
  setTimeout(() => { socket.disconnect(); process.exit(0); }, 1500);
});
socket.on('connect_error', (e) => console.log('ERR:', e.message));
setTimeout(() => process.exit(1), 10000);
```

预期输出：`connected` → `joined` → `gameState` 广播，全程 ≤ 200ms。

## 记住一句话

> **`5173` 开页面，`3000` 跑后端；页面永远从 `5173` 开，Socket.IO 永远让 Vite 代理转发。**
