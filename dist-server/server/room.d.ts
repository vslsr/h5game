import type { Player, Obstacle, PlayerInput, Bullet, Unit } from '../shared/types';
export interface GameRoomEvents {
    onObstacleHit: (payload: {
        obstacleId: string;
        hp: number;
        maxHp: number;
    }) => void;
    onObstacleDestroyed: (payload: {
        obstacleId: string;
    }) => void;
}
interface PlayerSelectionState {
    selectedUnitId: string;
    selectedSkillIndex: number;
}
export declare class GameRoom {
    readonly id: string;
    readonly players: Map<string, Player>;
    readonly obstacles: Obstacle[];
    private playerUnits;
    private playerSelection;
    bullets: Bullet[];
    private lastTickMs;
    private events;
    constructor(id: string, events: GameRoomEvents);
    createPlayer(id: string, name?: string): Player;
    addPlayer(player: Player): void;
    removePlayer(id: string): void;
    getUnits(playerId: string): Unit[];
    getSelection(playerId: string): PlayerSelectionState | null;
    getSelectedUnit(playerId: string): Unit | null;
    getSelectedSkill(playerId: string): {
        skill: import('../shared/types').Skill;
        unit: Unit;
    } | null;
    selectUnit(playerId: string, unitId: string): boolean;
    selectSkill(playerId: string, index: number): boolean;
    applyInput(id: string, input: PlayerInput): void;
    addBullet(bullet: Bullet): void;
    tick(): void;
    getPlayersSnapshot(): Player[];
}
export declare class RoomManager {
    private rooms;
    private io;
    attachIo(io: import('socket.io').Server): void;
    getOrCreate(roomId: string): GameRoom;
    get(roomId: string): GameRoom | undefined;
    getAll(): GameRoom[];
}
export {};
