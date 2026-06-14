export declare const GAME_CONSTANTS: {
    readonly WORLD_BOUND: 1600;
    readonly UNIT_RADIUS: 16;
    readonly OBSTACLE_SIZE: 64;
    readonly TICK_MS: 50;
    readonly FRICTION: 0.92;
    readonly MIN_VELOCITY: 2;
};
export type SkillType = 'direction' | 'point';
export interface SkillDef {
    id: string;
    name: string;
    icon: string;
    type: SkillType;
    cooldownMs: number;
    chargeMultiplier: number;
    hpCostPct?: number;
    damage?: number;
    radius?: number;
    description: string;
}
export interface UnitSkill {
    defId: string;
    readyAtTs: number;
}
export declare const SKILL_DEFS: Record<string, SkillDef>;
export declare function defaultSkillsForUnit(unitName: string): string[];
export interface Player {
    id: string;
    name: string;
}
export interface Unit {
    id: string;
    ownerId: string;
    name: string;
    icon: string;
    hue: number;
    hp: number;
    hpMax: number;
    attack: number;
    mass: number;
    baseSpeed: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    skills: UnitSkill[];
    activeSkillIndex: number;
}
export interface Obstacle {
    id: string;
    x: number;
    y: number;
    size: number;
}
export interface JoinedPayload {
    selfId: string;
    selfName: string;
    players: Player[];
    units: Unit[];
    obstacles: Obstacle[];
}
export type GameEventType = 'unitDeath' | 'unitImpulse' | 'skillCast' | 'collision';
export interface GameEventBase {
    type: GameEventType;
    ts: number;
}
export interface UnitDeathEvent extends GameEventBase {
    type: 'unitDeath';
    unitId: string;
    ownerId: string;
    name: string;
    reason: 'outOfBounds' | 'hpZero';
    x: number;
    y: number;
}
export interface UnitImpulseEvent extends GameEventBase {
    type: 'unitImpulse';
    unitId: string;
    skillId: string;
    ownerId: string;
    dirX: number;
    dirY: number;
    speed: number;
}
export interface SkillCastEvent extends GameEventBase {
    type: 'skillCast';
    unitId: string;
    skillId: string;
    ownerId: string;
    readyAtTs: number;
}
export type GameEvent = UnitDeathEvent | UnitImpulseEvent | SkillCastEvent;
export declare function makeDefaultUnits(ownerId: string, hue: number, spawnX: number, spawnY: number): Unit[];
