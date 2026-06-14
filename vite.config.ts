import { defineConfig, type Plugin } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

// 确保 root 指向当前 vite.config.ts 所在目录
const ROOT = fileURLToPath(new URL('.', import.meta.url));

// 根路径中间件：显式将 / 转换为 index.html（规避 Windows 上 Vite 4.5.14 的 fallback 问题）
function rootIndexPlugin(): Plugin {
  return {
    name: 'h5sgame-root-index',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        try {
          if (!req.url) return next();
          // 只处理根路径 / 和空路径
          const url = req.url.split('?')[0];
          if (url === '/' || url === '') {
            const indexPath = path.join(ROOT, 'index.html');
            const content = fs.readFileSync(indexPath, 'utf-8');
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache');
            // 注入 Vite 的 HMR client（让页面能被 Vite 识别）
            const withClient = content.replace(
              /<head>/i,
              '<head>\n<script type="module" src="/@vite/client"></script>',
            );
            res.statusCode = 200;
            res.end(withClient);
            return;
          }
          next();
        } catch (err) {
          next(err as Error);
        }
      });
    },
  };
}

// Vite 开发服务器 + Socket.IO 代理配置
// 页面访问: http://localhost:5173 (Vite 自动 HMR)
// Socket.IO 自动代理到: http://localhost:3000
export default defineConfig({
  root: ROOT,
  plugins: [rootIndexPlugin()],
  server: {
    port: 5173,
    host: true,
    open: false,
    // 放行所有来源域名（包括 natapp 穿透域名 g2cff3ac.natappfree.cc）
    // 否则 Vite 会对非 localhost 的模块请求返回 403
    allowedHosts: true,
    // HMR WebSocket 由前端自动使用 location.hostname/port
    // 经过 nginx+natapp 时由 nginx 的 Upgrade 头透传到 127.0.0.1:5173
    hmr: true,
    proxy: {
      // 将 /socket.io 的 HTTP 握手与 WebSocket 连接都代理到后端
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
  },
});
