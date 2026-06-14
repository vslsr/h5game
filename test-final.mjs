import { io } from 'socket.io-client';
import http from 'http';

// 1) 验证 http://192.168.0.110:3000/ 的 GET 返回跳转提示
new Promise((resolve) => {
  http.get('http://192.168.0.110:3000/', (res) => {
    let data = '';
    res.on('data', (c) => (data += c));
    res.on('end', () => {
      const ok = /Vite|5173|redirect|跳转/.test(data) || res.statusCode === 200;
      console.log('[GET /] status=' + res.statusCode + '  hasViteHint=' + /5173/.test(data) + ' ' + (ok ? 'OK' : 'FAIL'));
      resolve(ok);
    });
  }).on('error', (e) => {
    console.log('[GET /] error:', e.message);
    resolve(false);
  });
})
  .then(() => {
    // 2) 通过 Vite 代理 join
    return new Promise((resolve) => {
      const socket = io('http://192.168.0.110:5173', {
        transports: ['polling', 'websocket'],
        withCredentials: false,
        timeout: 8000
      });
      const t0 = Date.now();
      let done = false;
      socket.on('connect', () => {
        console.log('[via 5173] connected', Date.now() - t0 + 'ms sid=' + socket.id);
        socket.emit('joinRoom', { roomId: 'default', playerName: 'lan-test' });
      });
      socket.on('connect_error', (e) => {
        console.log('[via 5173] connect_error:', e.message);
        if (!done) { done = true; resolve(false); }
      });
      socket.on('joined', (data) => {
        console.log('[via 5173] joined selfId=' + data.selfId + ' players=' + data.players.length + ' units=' + data.units.length);
        done = true;
        setTimeout(() => { socket.disconnect(); resolve(true); }, 500);
      });
      setTimeout(() => { if (!done) { done = true; resolve(false); console.log('[via 5173] TIMEOUT'); } }, 10000);
    });
  })
  .then((ok) => {
    console.log('\n' + (ok ? '[DONE] ALL OK' : '[DONE] FAILED'));
    process.exit(ok ? 0 : 1);
  });
