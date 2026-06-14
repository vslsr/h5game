// 服务端：房间管理（基础联网 + 单位弹射物理 + 死亡检测 + 事件总线 + 技能系统）
import type { Player, Unit, Obstacle, JoinedPayload, GameEvent, UnitDeathEvent, SkillCastEvent, UnitImpulseEvent } from '../shared/types.js';
import { GAME_CONSTANTS, SKILL_DEFS, makeDefaultUnits } from '../shared/types.js';
import { lineOfSight } from '../shared/physics.js';

// 冲击波：一次立即结算的范围事件（本 tick 内直接执行）
interface ShockwaveEffect {
  originX: number;
  originY: number;
  radius: number;
  pushSpeed: number;   // 对敌方单位的推动速度
  damage: number;      // 对敌方单位伤害
  ownerId: string;     // 施放者，不推自己
}

export class GameRoom {
  players: Map<string, Player> = new Map();
  units: Map<string, Unit> = new Map();
  obstacles: Obstacle[] = [];
  private playerHues: Map<string, number> = new Map();
  private playerNames: Map<string, string> = new Map();
  private hueCounter = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  private onGameEvent: ((evt: GameEvent) => void) | null = null;

  // 本 tick 内需要立即结算的范围/瞬移等一次性事件
  private pendingShockwaves: ShockwaveEffect[] = [];

  constructor(
    private readonly onStateChanged: () => void,
    options?: { onGameEvent?: (evt: GameEvent) => void },
  ) {
    if (options?.onGameEvent) this.onGameEvent = options.onGameEvent;
    const positions = [
      { x: -128, y: 64 },
      { x:  128, y: 64 },
      { x:    0, y: -160 },
    ];
    for (let i = 0; i < positions.length; i++) {
      this.obstacles.push({
        id: `ob-${i}`,
        x: positions[i].x,
        y: positions[i].y,
        size: GAME_CONSTANTS.OBSTACLE_SIZE,
      });
    }
    this.tickTimer = setInterval(() => this.tick(), GAME_CONSTANTS.TICK_MS);
  }

  destroy(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  createPlayer(id: string, name: string): Player {
    const player: Player = { id, name };
    this.players.set(id, player);
    this.playerNames.set(id, name);

    const hue = (this.hueCounter++ * 60) % 360;
    this.playerHues.set(id, hue);

    const units = makeDefaultUnits(id, hue, 0, 128);
    for (const u of units) this.units.set(u.id, u);

    return player;
  }

  removePlayer(id: string): void {
    this.players.delete(id);
    this.playerHues.delete(id);
    this.playerNames.delete(id);
    for (const [uid, u] of this.units) {
      if (u.ownerId === id) this.units.delete(uid);
    }
  }

  getUnitsByOwner(ownerId: string): Unit[] {
    const result: Unit[] = [];
    for (const u of this.units.values()) {
      if (u.ownerId === ownerId) result.push(u);
    }
    return result;
  }

  getStateFor(playerId: string): JoinedPayload {
    return {
      selfId: playerId,
      selfName: this.playerNames.get(playerId) ?? '',
      players: [...this.players.values()],
      units: [...this.units.values()],
      obstacles: [...this.obstacles],
    };
  }

  snapshotUnits(): Unit[] {
    return [...this.units.values()];
  }

  snapshotPlayers(): Player[] {
    return [...this.players.values()];
  }

  // --- 技能系统：施放一个技能 ---
  applySkill(unitId: string, ownerId: string, skillId: string,
             dirX: number, dirY: number, charge: number,
             pointX?: number, pointY?: number): Unit | null {
    const unit = this.units.get(unitId);
    if (!unit || unit.ownerId !== ownerId) return null;

    // 查技能定义 + 检查该单位是否拥有它
    const def = SKILL_DEFS[skillId];
    if (!def) return null;
    const slot = unit.skills.find((s) => s.defId === skillId);
    if (!slot) return null;

    // 必须完全停下
    if (unit.vx !== 0 || unit.vy !== 0) return null;

    // 冷却检查
    const now = Date.now();
    if (slot.readyAtTs > now) return null;

    // 设置冷却
    slot.readyAtTs = now + def.cooldownMs;

    // ========== 方向型技能：设置单位速度 ==========
    if (def.type === 'direction') {
      const len = Math.sqrt(dirX * dirX + dirY * dirY);
      if (len <= 1e-6) return null;
      const c = Math.min(1.0, Math.max(0.2, charge));
      const speed = (unit.baseSpeed * c * def.chargeMultiplier) / unit.mass;
      unit.vx = (dirX / len) * speed;
      unit.vy = (dirY / len) * speed;

      if (this.onGameEvent) {
        const evt: UnitImpulseEvent = {
          type: 'unitImpulse', ts: now, unitId: unit.id, skillId, ownerId,
          dirX: dirX / len, dirY: dirY / len, speed,
        };
        this.onGameEvent(evt);
      }
    } else if (def.type === 'point') {
      // ========== 点型技能：根据 skillId 分发 ==========
      if (pointX === undefined || pointY === undefined) return null;

      // 视线检测：单位 → 目标点之间不能被墙体或其他单位遮挡
      const otherUnits = [...this.units.values()].filter(u => u.id !== unitId);
      const hasLineOfSight = lineOfSight(
        unit.x, unit.y,
        pointX, pointY,
        this.obstacles,
        otherUnits,
      );
      if (!hasLineOfSight) return null;

      if (skillId === 'shockwave') {
        // 冲击波：对范围内单位做推力 + 伤害
        this.pendingShockwaves.push({
          originX: pointX, originY: pointY,
          radius: def.radius ?? 180,
          pushSpeed: 360,
          damage: def.damage ?? 18,
          ownerId: unit.ownerId,
        });
      } else if (skillId === 'blink') {
        // 瞬移：把单位直接挪到目标点；若目标点刚好在障碍内，推出障碍外
        unit.x = pointX;
        unit.y = pointY;
        unit.vx = 0;
        unit.vy = 0;
      } else {
        return null;
      }
    }

    // 广播 skillCast 事件（客户端用来更新 CD 动画）
    if (this.onGameEvent) {
      const evt: SkillCastEvent = {
        type: 'skillCast', ts: now, unitId: unit.id, skillId, ownerId,
        readyAtTs: slot.readyAtTs,
      };
      this.onGameEvent(evt);
    }

    // 立即触发一次状态同步（让客户端看到速度变化/位置变化）
    this.onStateChanged();

    return unit;
  }

  // --- 物理 tick（子步长 + 连续碰撞检测 + 撞击扣血 + 范围技能结算） ---
  private tick(): void {
    const dt = GAME_CONSTANTS.TICK_MS / 1000;
    const friction = GAME_CONSTANTS.FRICTION;
    const minV = GAME_CONSTANTS.MIN_VELOCITY;
    const R = GAME_CONSTANTS.UNIT_RADIUS;
    const D = 2 * R;
    const D2 = D * D;
    const EPS = 0.01;
    const RESTITUTION = 0.9;
    const OBSTACLE_IMPACT_MIN = 200;
    const OBSTACLE_IMPACT_SCALE = 15 / 350;
    const OBSTACLE_IMPACT_MAX = 35;
    const UNIT_IMPACT_MIN = 150;
    const UNIT_IMPACT_SCALE = 10 / 400;
    const UNIT_IMPACT_MAX = 25;
    let changed = false;
    let tickCount = 0;

    const unitArr = [...this.units.values()];
    if (unitArr.length === 0) return;

    const obstacleHit: Set<string> = new Set();
    const unitHit: Set<string> = new Set();

    // --- 0) 结算本 tick 内的冲击波/点型技能（先于物理推进） ---
    if (this.pendingShockwaves.length > 0) {
      for (const sw of this.pendingShockwaves) {
        for (const u of unitArr) {
          if (u.ownerId === sw.ownerId) continue; // 不推自己
          const dx = u.x - sw.originX;
          const dy = u.y - sw.originY;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > sw.radius || d <= 1e-3) continue;
          const falloff = 1 - d / sw.radius;
          const nx = dx / d;
          const ny = dy / d;
          // 速度 = 基础推力 * 距离衰减；大质量衰减更快
          const sp = sw.pushSpeed * falloff;
          u.vx += nx * sp / u.mass;
          u.vy += ny * sp / u.mass;
          const dmg = Math.round(sw.damage * falloff);
          if (dmg > 0) u.hp = Math.max(0, u.hp - dmg);
        }
      }
      this.pendingShockwaves = [];
      changed = true;
    }

    // --- 1) 计算子步长 ---
    let maxSpeed = 0;
    for (const u of unitArr) {
      const sp2 = u.vx * u.vx + u.vy * u.vy;
      if (sp2 > maxSpeed) maxSpeed = sp2;
    }
    const safeStep = 0.6 * R;
    let subSteps = 1;
    if (maxSpeed > 0) {
      const movePerTick = Math.sqrt(maxSpeed) * dt;
      if (movePerTick > safeStep) {
        subSteps = Math.max(1, Math.ceil(movePerTick / safeStep));
      }
    }
    if (subSteps > 8) subSteps = 8;
    const subDt = dt / subSteps;
    const subFriction = Math.pow(friction, 1 / subSteps);

    // --- 2) 逐子步推进 ---
    for (let step = 0; step < subSteps; step++) {
      tickCount++;

      for (const u of unitArr) {
        if (u.vx === 0 && u.vy === 0) continue;
        u.x += u.vx * subDt;
        u.y += u.vy * subDt;
        changed = true;
      }

      for (const u of unitArr) {
        if (u.vx === 0 && u.vy === 0) continue;
        for (let oi = 0; oi < this.obstacles.length; oi++) {
          const ob = this.obstacles[oi];
          const half = ob.size / 2;
          const cx = Math.max(ob.x - half, Math.min(u.x, ob.x + half));
          const cy = Math.max(ob.y - half, Math.min(u.y, ob.y + half));
          const dx = u.x - cx;
          const dy = u.y - cy;
          const d2 = dx * dx + dy * dy;
          if (d2 >= R * R) continue;

          const d = Math.max(Math.sqrt(d2), 0.0001);
          const nx = dx / d;
          const ny = dy / d;

          const penetration = R - d + EPS;
          u.x += nx * penetration;
          u.y += ny * penetration;

          const vDotN = u.vx * nx + u.vy * ny;
          if (vDotN < 0) {
            const bounce = 0.35;
            const impactSpeed = Math.abs(vDotN);
            u.vx -= (1 + bounce) * vDotN * nx;
            u.vy -= (1 + bounce) * vDotN * ny;
            u.vx *= 0.6;
            u.vy *= 0.6;

            const keyObstacle = `${u.id}-o-${oi}`;
            if (!obstacleHit.has(keyObstacle) && impactSpeed > OBSTACLE_IMPACT_MIN) {
              obstacleHit.add(keyObstacle);
              const raw = (impactSpeed - OBSTACLE_IMPACT_MIN) * OBSTACLE_IMPACT_SCALE;
              const dmg = Math.max(0, Math.min(OBSTACLE_IMPACT_MAX, Math.round(raw)));
              if (dmg > 0) {
                u.hp = Math.max(0, u.hp - dmg);
                changed = true;
              }
            }
          }
        }
      }

      for (let i = 0; i < unitArr.length; i++) {
        const a = unitArr[i];
        for (let j = i + 1; j < unitArr.length; j++) {
          const b = unitArr[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist2 = dx * dx + dy * dy;
          if (dist2 >= D2) continue;

          let dist = Math.sqrt(dist2);
          if (dist < 0.0001) { dist = 0.0001; }
          const nx = dx / dist;
          const ny = dy / dist;
          const overlap = D - dist + EPS;
          const m1 = a.mass;
          const m2 = b.mass;
          const mTotal = m1 + m2;
          const pushA = overlap * (m2 / mTotal);
          const pushB = overlap * (m1 / mTotal);
          a.x -= nx * pushA;
          a.y -= ny * pushA;
          b.x += nx * pushB;
          b.y += ny * pushB;

          const v1n = a.vx * nx + a.vy * ny;
          const v2n = b.vx * nx + b.vy * ny;
          const rv = v2n - v1n;
          if (rv > 0) continue;

          const impactSpeed = Math.abs(rv);
          const e = RESTITUTION;
          const newV1n = ((m1 - e * m2) * v1n + (1 + e) * m2 * v2n) / mTotal;
          const newV2n = ((m2 - e * m1) * v2n + (1 + e) * m1 * v1n) / mTotal;
          a.vx += (newV1n - v1n) * nx;
          a.vy += (newV1n - v1n) * ny;
          b.vx += (newV2n - v2n) * nx;
          b.vy += (newV2n - v2n) * ny;

          const keyUnit = a.id < b.id ? `${a.id}-${b.id}` : `${b.id}-${a.id}`;
          if (!unitHit.has(keyUnit) && impactSpeed > UNIT_IMPACT_MIN) {
            unitHit.add(keyUnit);
            const baseRaw = (impactSpeed - UNIT_IMPACT_MIN) * UNIT_IMPACT_SCALE;
            const dmg1 = Math.max(0, Math.min(UNIT_IMPACT_MAX, Math.round(baseRaw * (m2 / mTotal) * 1.2)));
            const dmg2 = Math.max(0, Math.min(UNIT_IMPACT_MAX, Math.round(baseRaw * (m1 / mTotal) * 1.2)));
            if (dmg1 > 0) { a.hp = Math.max(0, a.hp - dmg1); changed = true; }
            if (dmg2 > 0) { b.hp = Math.max(0, b.hp - dmg2); changed = true; }
          }

          changed = true;
        }
      }

      for (const u of unitArr) {
        if (u.vx === 0 && u.vy === 0) continue;
        u.vx *= subFriction;
        u.vy *= subFriction;
        if (Math.abs(u.vx) < minV && Math.abs(u.vy) < minV) {
          u.vx = 0;
          u.vy = 0;
        }
      }
    }

    // --- 3) tick 末尾：死亡检测 ---
    const W = GAME_CONSTANTS.WORLD_BOUND;
    const deadEvents: UnitDeathEvent[] = [];
    for (const u of [...this.units.values()]) {
      let reason: 'outOfBounds' | 'hpZero' | null = null;
      if (u.hp <= 0) reason = 'hpZero';
      else if (u.x < -W || u.x > W || u.y < -W || u.y > W) reason = 'outOfBounds';
      if (reason) {
        deadEvents.push({
          type: 'unitDeath',
          ts: Date.now(),
          unitId: u.id,
          ownerId: u.ownerId,
          name: u.name,
          reason,
          x: u.x,
          y: u.y,
        });
        this.units.delete(u.id);
        changed = true;
      }
    }
    if (deadEvents.length > 0 && this.onGameEvent) {
      for (const evt of deadEvents) this.onGameEvent(evt);
    }

    if (changed || this.units.size > 0) {
      this.onStateChanged();
    }
  }
}
