import { io } from 'socket.io-client';
const s = io('http://localhost:3000', { transports: ['polling','websocket'], withCredentials: false, timeout: 8000 });
let joined = false;
s.on('connect', () => { console.log('connected', s.id); s.emit('joinRoom', { name: 'test' }); });
s.on('joined', (d) => { console.log('joined; units=', d.units.length, 'players=', d.players.length, 'obstacles=', d.obstacles.length); joined = true; setTimeout(() => process.exit(0), 800); });
setTimeout(() => { if (!joined) { console.log('TIMEOUT'); process.exit(1); } }, 5000);
