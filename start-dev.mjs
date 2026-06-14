// 同时启动 Vite dev server 和 Socket.IO server
// 工作目录 = 脚本所在目录
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { spawn } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const nodeExe = process.execPath;

const serverProc = spawn(
  nodeExe,
  [resolve(__dirname, 'node_modules/tsx/dist/cli.mjs'), 'server/server.ts'],
  { cwd: __dirname, stdio: ['ignore', 'inherit', 'inherit'] }
);

const clientProc = spawn(
  nodeExe,
  [resolve(__dirname, 'node_modules/vite/bin/vite.js')],
  { cwd: __dirname, stdio: ['ignore', 'inherit', 'inherit'] }
);

function stop() {
  try { serverProc.kill('SIGTERM'); } catch {}
  try { clientProc.kill('SIGTERM'); } catch {}
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
