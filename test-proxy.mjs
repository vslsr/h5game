import { io } from 'socket.io-client';
const s = io('http://192.168.0.110:5173', { transports: ['polling','websocket'], withCredentials: false });
let gotState = 0;
s.on('connect', () => { console.log('1. connected ' + s.id); s.emit('joinRoom', { name: 'e2e' }); });
s.on('joined', (d) => { console.log('2. joined; selfId=' + d.selfId + ' units=' + d.units.length); });
s.on('gameState', (d) => { gotState++; if (gotState === 1 || gotState === 5) { const mine = d.units.filter((u) => u.ownerId === s.id); console.log('3. gameState #' + gotState + ': myUnits=' + mine.length + ' total=' + d.units.length); } });
s.on('connect_error', (e) => { console.log('X connect_error: ' + e.message); });
s.on('disconnect', (r) => { console.log('4. disconnected ' + r); setTimeout(() => process.exit(0), 800); });
setTimeout(() => { console.log('done'); process.exit(0); }, 4000);
