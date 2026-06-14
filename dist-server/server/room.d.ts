import type { Player, Unit, Obstacle, JoinedPayload, GameEvent } from '../shared/types.js';
export declare class GameRoom {
    private readonly onStateChanged;
    players: Map<string, Player>;
    units: Map<string, Unit>;
    obstacles: Obstacle[];
    private playerHues;
    private playerNames;
    private hueCounter;
    private tickTimer;
    private onGameEvent;
    private pendingShockwaves;
    constructor(onStateChanged: () => void, options?: {
        onGameEvent?: (evt: GameEvent) => void;
    });
    destroy(): void;
    createPlayer(id: string, name: string): Player;
    removePlayer(id: string): void;
    getUnitsByOwner(ownerId: string): Unit[];
    getStateFor(playerId: string): JoinedPayload;
    snapshotUnits(): Unit[];
    snapshotPlayers(): Player[];
    applySkill(unitId: string, ownerId: string, skillId: string, dirX: number, dirY: number, charge: number, pointX?: number, pointY?: number): Unit | null;
    private tick;
}
