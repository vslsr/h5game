export interface Player {
    id: string;
    name: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
}
export interface PlayerInput {
    vx: number;
    vy: number;
}
export interface Obstacle {
    id: string;
    x: number;
    y: number;
    size: number;
    hp: number;
    maxHp: number;
}
export interface JoinRoomPayload {
    roomId?: string;
    playerName?: string;
}
export interface JoinedPayload {
    selfId: string;
    self: Player;
    players: Player[];
    obstacles: Obstacle[];
    units: Unit[];
    selectedUnitId: string;
    selectedSkillIndex: number;
}
export interface Skill {
    skillId: string;
    name: string;
    icon?: string;
    description?: string;
    speedMin: number;
    speedMax: number;
    damageMin: number;
    damageMax: number;
    lifetimeMs: number;
    explosive: boolean;
    explosionRadius: number;
    explosionDamage: number;
    hue: number;
    cooldownMs: number;
}
export interface Unit {
    unitId: string;
    name: string;
    icon?: string;
    description?: string;
    hue: number;
    skills: Skill[];
}
export declare const SKILL_REGISTRY: Record<string, Skill>;
export declare const UNIT_REGISTRY: Record<string, Unit>;
export declare const DEFAULT_PLAYER_UNITS: Unit[];
export interface Bullet {
    id: string;
    ownerId: string;
    ownerName: string;
    ownerHue: number;
    ownerSkillId: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    createdAt: number;
    damage: number;
    lifetimeMs: number;
    explosive: boolean;
    explosionRadius: number;
    explosionDamage: number;
}
export declare const GAME_CONSTANTS: {
    readonly TICK_MS: 50;
    readonly MAX_SPEED: 6;
    readonly SPEED_PX_PER_SEC: 120;
    readonly WORLD_BOUND: 10000;
    readonly CELL: 48;
    readonly PLAYER_RADIUS: 16;
    readonly BULLET_SPEED_MIN: 320;
    readonly BULLET_SPEED_MAX: 720;
    readonly BULLET_LIFETIME_MS: 3000;
    readonly BULLET_RADIUS: 5;
    readonly BULLET_DAMAGE_MIN: 1;
    readonly BULLET_DAMAGE_MAX: 5;
    readonly OBSTACLE_MAX_HP: 10;
};
