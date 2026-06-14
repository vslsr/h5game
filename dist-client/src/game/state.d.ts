import type { Player, Unit, Obstacle, JoinedPayload } from '../../shared/types.js';
export declare class GameState {
    selfId: string | null;
    selfName: string;
    players: Player[];
    units: Unit[];
    obstacles: Obstacle[];
    selectedUnitId: string | null;
    private predicted;
    private readonly TICK_MS;
    private readonly FRICTION;
    private readonly MIN_VELOCITY;
    private readonly WORLD_BOUND;
    private readonly UNIT_RADIUS;
    private readonly RECON_POS;
    private readonly RECON_POS_FAST;
    private readonly RECON_VEL;
    private readonly SNAP_DIST;
    private readonly SNAP_MIN;
    private readonly fireCooldownMs;
    private lastFireAt;
    private readonly DAMAGE_DISPLAY_MS;
    private lastDamagedAt;
    private prevHp;
    private clientSkillIndex;
    init(data: JoinedPayload): void;
    updateState(payload: {
        players: Player[];
        units: Unit[];
    }): void;
    predictFire(unitId: string, dirX: number, dirY: number, speed: number): void;
    stepPrediction(dtMs: number): void;
    getRenderPos(unitId: string): {
        rx: number;
        ry: number;
    } | null;
    isUnitStopped(unitId: string): boolean;
    wasRecentlyDamaged(unitId: string): boolean;
    getDamageFlashAlpha(unitId: string): number;
    getMyUnits(): Unit[];
    getSelectedUnit(): Unit | null;
    selectUnit(unitId: string | null): void;
    setActiveSkillIndex(unitId: string, index: number): void;
}
