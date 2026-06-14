import type { Player, Obstacle, JoinedPayload, Bullet, Unit, Skill } from '../../shared/types';
export interface GameStateData {
    selfId: string | null;
    players: Map<string, Player & {
        targetX: number;
        targetY: number;
    }>;
    obstacles: Obstacle[];
}
export interface BulletParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    life: number;
    maxLife: number;
    size: number;
}
export declare class GameState {
    selfId: string | null;
    players: Map<string, Player & {
        targetX: number;
        targetY: number;
    }>;
    obstacles: Obstacle[];
    bullets: Bullet[];
    particles: BulletParticle[];
    units: Unit[];
    selectedUnitId: string;
    selectedSkillIndex: number;
    unitPanelOpen: boolean;
    private lastFrameTime;
    private lastBulletTime;
    init(data: JoinedPayload): void;
    addPlayer(p: Player): void;
    removePlayer(id: string): void;
    updateTargets(players: Player[]): void;
    interpolate(): void;
    addBullet(bullet: Bullet): void;
    updateBullets(): void;
    private spawnBulletParticles;
    updateParticles(): void;
    getSelf(): (Player & {
        targetX: number;
        targetY: number;
    }) | null;
    getSelectedUnit(): Unit | null;
    getSelectedSkill(): Skill | null;
    selectUnit(unitId: string): void;
    selectSkill(index: number): void;
    applySelection(selectedUnitId: string, selectedSkillIndex: number): void;
    updateObstacleHp(payload: {
        obstacleId: string;
        hp: number;
        maxHp: number;
    }): void;
    removeObstacle(payload: {
        obstacleId: string;
    }): void;
}
