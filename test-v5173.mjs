import { io } from 'socket.io-client';
const s = io('http://192.168.0.110:5173', { transports: ['polling','websocket'], withCredentials: false });
s.on('connect', () => { console.log('OK connected id=' + s.id); s.emit('joinRoom', { name: 'verify' }); });
s.on('joined', (d) => { console.log('OK joined units=' + d.units.length); setTimeout(() => process.exit(0), 500); });
s.on('connect_error', (e) => { console.log('ERR ' + e.message); setTimeout(() => process.exit(1), 1500); });
setTimeout(() => { console.log('timeout'); process.exit(1); }, 8000);
