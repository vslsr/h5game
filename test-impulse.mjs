import { io } from 'socket.io-client';

const s = io('http://localhost:3000', { transports: ['polling', 'websocket'], withCredentials: false });
let unitsBefore = null;
let selfId = null;
let tickCount = 0;

s.on('connect', () => {
  console.log('1. connected', s.id);
  s.emit('joinRoom', { name: 'test-cli' });
});

s.on('joined', (d) => {
  console.log('2. joined; players=', d.players.length, 'units=', d.units.length, 'selfId=', d.selfId);
  selfId = d.selfId;
  unitsBefore = d.units;
  const myUnit = d.units.find((u) => u.ownerId === d.selfId);
  console.log('3. apply impulse to', myUnit.id, '(name=' + myUnit.name + ' baseSpeed=' + myUnit.baseSpeed + ' mass=' + myUnit.mass + ')');
  s.emit('unitImpulse', { unitId: myUnit.id, dirX: 1, dirY: 0, charge: 1.0 });
  setTimeout(() => { console.log('5. test complete'); process.exit(0); }, 2200);
});

s.on('gameState', (d) => {
  tickCount++;
  if (!unitsBefore || !selfId) return;
  const mine = d.units.filter((u) => u.ownerId === selfId);
  if (tickCount === 1 || tickCount === 10 || tickCount === 20) {
    console.log('4. gameState tick #' + tickCount + ':');
    for (const u of mine) {
      console.log('   ', u.name, ' pos=(' + (+u.x).toFixed(1) + ',' + (+u.y).toFixed(1) + ') v=(' + (+(u.vx || 0)).toFixed(1) + ',' + (+(u.vy || 0)).toFixed(1) + ')');
    }
  }
});

setTimeout(() => { console.log('TIMEOUT'); process.exit(1); }, 8000);
