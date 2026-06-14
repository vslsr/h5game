// 前端：Socket.IO 连接与事件处理
import { io } from 'socket.io-client';
export class GameSocket {
    socket = null;
    events;
    constructor(events) {
        this.events = events;
    }
    connect() {
        this.socket = io(location.origin, {
            transports: ['polling', 'websocket'],
            reconnection: true,
            reconnectionDelay: 800,
            timeout: 15000
        });
        this.socket.on('connect', () => {
            this.events.onConnected();
        });
        this.socket.on('joined', (data) => {
            this.events.onJoined(data);
        });
        this.socket.on('playerJoined', (player) => {
            this.events.onPlayerJoined(player);
        });
        this.socket.on('playerLeft', (id) => {
            this.events.onPlayerLeft(id);
        });
        this.socket.on('gameState', (players) => {
            this.events.onGameState(players);
        });
        this.socket.on('bulletFired', (bullet) => {
            this.events.onBulletFired(bullet);
        });
        this.socket.on('obstacleHit', (payload) => {
            this.events.onObstacleHit(payload);
        });
        this.socket.on('obstacleDestroyed', (payload) => {
            this.events.onObstacleDestroyed(payload);
        });
        this.socket.on('selectionUpdated', (payload) => {
            this.events.onSelectionUpdated(payload);
        });
        this.socket.on('disconnect', () => {
            this.events.onDisconnect();
        });
    }
    joinRoom(roomId, playerName) {
        this.socket?.emit('joinRoom', { roomId, playerName });
    }
    sendInput(input) {
        this.socket?.emit('playerInput', input);
    }
    sendBulletFire(payload) {
        this.socket?.emit('bulletFire', payload);
    }
    sendUnitSelect(unitId) {
        this.socket?.emit('unitSelect', { unitId });
    }
    sendSkillSelect(index) {
        this.socket?.emit('skillSelect', { index });
    }
    isConnected() {
        return this.socket?.connected ?? false;
    }
    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}
