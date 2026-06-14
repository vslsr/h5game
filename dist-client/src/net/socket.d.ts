import type { Player, JoinedPayload, PlayerInput, Bullet } from '../../shared/types';
export interface GameSocketEvents {
    onConnected: () => void;
    onJoined: (data: JoinedPayload) => void;
    onPlayerJoined: (player: Player) => void;
    onPlayerLeft: (id: string) => void;
    onGameState: (players: Player[]) => void;
    onBulletFired: (bullet: Bullet) => void;
    onObstacleHit: (payload: {
        obstacleId: string;
        hp: number;
        maxHp: number;
    }) => void;
    onObstacleDestroyed: (payload: {
        obstacleId: string;
    }) => void;
    onSelectionUpdated: (payload: {
        selectedUnitId: string;
        selectedSkillIndex: number;
    }) => void;
    onDisconnect: () => void;
}
export declare class GameSocket {
    private socket;
    private events;
    constructor(events: GameSocketEvents);
    connect(): void;
    joinRoom(roomId: string, playerName: string): void;
    sendInput(input: PlayerInput): void;
    sendBulletFire(payload: {
        vx: number;
        vy: number;
        x: number;
        y: number;
        charge: number;
    }): void;
    sendUnitSelect(unitId: string): void;
    sendSkillSelect(index: number): void;
    isConnected(): boolean;
    disconnect(): void;
}
