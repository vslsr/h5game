// 前端：游戏状态管理（客户端预测 Client-side Prediction + 服务器回滚 Reconciliation）
// 核心思路：
//   - 客户端为每个单位维护一套独立的预测状态（px, py, pvx, pvy）
//   - 每帧按本地 dt 推进预测位置（模拟服务端物理：移动 + 摩擦衰减 + 边界钳制）
//   - 当服务器 gameState 到达时，检测预测位置与服务器位置的偏差
//     * 若偏差很小 (< 1px)：直接对齐，消除抖动残留
//     * 若偏差中等 (< 120px)：以插值系数缓慢"拉回"，让玩家感觉不到跳变
//     * 若偏差过大 (>= 120px)：直接对齐，避免穿越地图的明显错误
//   - 发射瞬间把预测速度设为发射速度，使发射瞬间立即响应（无输入延迟）
//   - 渲染始终使用预测位置
import type { Player, Unit, Obstacle, JoinedPayload } from '../../shared/types';
import { GAME_CONSTANTS } from '../../shared/types';

// 每个单位的客户端预测状态
interface PredictedState {
  px: number;   // 预测 X
  py: number;   // 预测 Y
  pvx: number;  // 预测 vx
  pvy: number;  // 预测 vy
}

export class GameState {
  selfId: string | null = null;
  selfName: string = '';
  players: Player[] = [];
  units: Unit[] = [];         // 服务端最新状态（权威状态）
  obstacles: Obstacle[] = [];
  selectedUnitId: string | null = null;

  // 客户端预测表
  private predicted: Map<string, PredictedState> = new Map();

  // ------- 配置 -------
  // 服务器 tick 相关（与 shared/types.ts 和 server/room.ts 保持一致）
  private readonly TICK_MS = GAME_CONSTANTS.TICK_MS;
  private readonly FRICTION = GAME_CONSTANTS.FRICTION;   // 每 tick 衰减
  private readonly MIN_VELOCITY = GAME_CONSTANTS.MIN_VELOCITY;
  private readonly WORLD_BOUND = GAME_CONSTANTS.WORLD_BOUND;
  private readonly UNIT_RADIUS = GAME_CONSTANTS.UNIT_RADIUS;

  // 拉回（reconciliation）系数：每帧让预测位置向服务器位置靠近的比例
  private readonly RECON_POS = 0.08;     // 位置回归系数（每帧 8%）
  private readonly RECON_POS_FAST = 0.25; // 刚发射后的短暂时间内回归得更快一点（让服务器同步尽快追上）
  private readonly RECON_VEL = 0.15;     // 速度回归系数
  private readonly SNAP_DIST = 120;      // 超过此距离直接跳跃（避免穿墙等明显错误）
  private readonly SNAP_MIN = 1.0;       // 小于此距离直接对齐（消除残留抖动）

  // 记录刚发射的单位（短时间内给更高的预测权重）
  private readonly fireCooldownMs = 350;
  private lastFireAt: Map<string, number> = new Map();

  // 单位受伤状态（用于 HP 条显示 + 红色闪烁
  private readonly DAMAGE_DISPLAY_MS = 1800;  // 受伤后血条持续显示时间
  private lastDamagedAt: Map<string, number> = new Map();
  private prevHp: Map<string, number> = new Map();

  // 客户端选择的技能索引（服务器不维护，所以每次覆盖 state 时需要恢复）
  private clientSkillIndex: Map<string, number> = new Map();

  // ==================== 初始化 / 服务器推送 ====================
  init(data: JoinedPayload): void {
    this.selfId = data.selfId;
    this.selfName = data.selfName;
    this.players = data.players || [];
    this.units = data.units || [];
    this.obstacles = data.obstacles || [];

    this.predicted.clear();
    for (const u of this.units) {
      this.predicted.set(u.id, { px: u.x, py: u.y, pvx: u.vx, pvy: u.vy });
    }

    // 初始化客户端技能索引缓存
    this.clientSkillIndex.clear();
    for (const u of this.units) {
      if (typeof u.activeSkillIndex === 'number' && u.skills && u.skills.length > 0) {
        this.clientSkillIndex.set(u.id, u.activeSkillIndex);
      } else if (u.skills && u.skills.length > 0) {
        u.activeSkillIndex = 0;
        this.clientSkillIndex.set(u.id, 0);
      }
    }

    if (!this.selectedUnitId || !this.units.some(u => u.id === this.selectedUnitId)) {
      const myUnit = this.units.find(u => u.ownerId === this.selfId);
      this.selectedUnitId = myUnit ? myUnit.id : null;
    }
  }

  updateState(payload: { players: Player[]; units: Unit[] }): void {
    // 先把当前每个单位的 activeSkillIndex 保存到客户端 Map（避免被服务器默认值 0 覆盖）
    for (const u of this.units) {
      if (typeof u.activeSkillIndex === 'number') {
        this.clientSkillIndex.set(u.id, u.activeSkillIndex);
      }
    }

    this.players = payload.players || [];
    this.units = payload.units || [];

    // 恢复客户端已选技能索引
    for (const u of this.units) {
      const cached = this.clientSkillIndex.get(u.id);
      if (typeof cached === 'number' && u.skills && u.skills.length > 0) {
        u.activeSkillIndex = Math.max(0, Math.min(u.skills.length - 1, cached));
      } else if (u.skills && u.skills.length > 0 && (u.activeSkillIndex === undefined || u.activeSkillIndex < 0)) {
        u.activeSkillIndex = 0;
      }
    }

    const now = performance.now();
    const newSet = new Set(this.units.map(u => u.id));
    // 清理已不存在的单位
    for (const key of Array.from(this.clientSkillIndex.keys())) {
      if (!newSet.has(key)) this.clientSkillIndex.delete(key);
    }
    for (const key of Array.from(this.predicted.keys())) {
      if (!newSet.has(key)) this.predicted.delete(key);
    }
    for (const key of Array.from(this.lastDamagedAt.keys())) {
      if (!newSet.has(key)) this.lastDamagedAt.delete(key);
    }
    for (const key of Array.from(this.prevHp.keys())) {
      if (!newSet.has(key)) this.prevHp.delete(key);
    }

    // 初始化新加入单位 + 检测 hp 变化
    for (const u of this.units) {
      const p = this.predicted.get(u.id);
      if (!p) {
        this.predicted.set(u.id, { px: u.x, py: u.y, pvx: u.vx, pvy: u.vy });
      }

      const prev = this.prevHp.get(u.id);
      if (prev === undefined) {
        this.prevHp.set(u.id, u.hp);
      } else if (u.hp < prev - 0.001) {
        // 检测到 hp 下降（受伤），记录时间戳
        this.lastDamagedAt.set(u.id, now);
        this.prevHp.set(u.id, u.hp);
      } else if (Math.abs(u.hp - prev) > 0.001) {
        // hp 上升（治疗 / 重置）也更新，避免误判
        this.prevHp.set(u.id, u.hp);
      }
    }

    if (this.selectedUnitId && !this.units.some(u => u.id === this.selectedUnitId)) {
      this.selectedUnitId = null;
    }
  }

  // ==================== 发射预测入口（客户端调用） ====================
  // 客户端松手发射时调用：dirX/dirY 是发射方向（单位向量），speed 是发射速度
  // 把预测位置对齐到当前服务器位置 + 预测速度设为发射速度
  predictFire(unitId: string, dirX: number, dirY: number, speed: number): void {
    const unit = this.units.find(u => u.id === unitId);
    if (!unit) return;
    const p = this.predicted.get(unitId);
    if (!p) return;

    // 对齐预测位置到服务端位置，避免与服务器物理脱节
    p.px = unit.x;
    p.py = unit.y;
    p.pvx = dirX * speed;
    p.pvy = dirY * speed;
    this.lastFireAt.set(unitId, performance.now());
  }

  // ==================== 每帧预测推进 ====================
  // dtMs：距上一帧经过的毫秒数（大约 16ms）
  stepPrediction(dtMs: number): void {
    if (dtMs <= 0) dtMs = 16;
    const now = performance.now();

    for (const u of this.units) {
      const p = this.predicted.get(u.id);
      if (!p) continue;

      // ---------- 1. 本地物理模拟（与服务器保持相同的简化模型） ----------
      // 使用"等效每帧摩擦"：将 50ms/tick 的摩擦系数按 dt 缩放
      // 公式：friction_per_frame = FRICTION^(dtMs / TICK_MS)
      const tickRatio = dtMs / this.TICK_MS;
      const fr = Math.pow(this.FRICTION, tickRatio);

      p.px += p.pvx * (dtMs / 1000);
      p.py += p.pvy * (dtMs / 1000);
      p.pvx *= fr;
      p.pvy *= fr;

      // 速度过小归零
      const vSq = p.pvx * p.pvx + p.pvy * p.pvy;
      if (vSq < this.MIN_VELOCITY * this.MIN_VELOCITY) {
        p.pvx = 0;
        p.pvy = 0;
      }

      // 世界边界钳制（与服务器一致，避免预测偏离到世界外）
      if (p.px < -this.WORLD_BOUND) { p.px = -this.WORLD_BOUND; p.pvx = -p.pvx * 0.4; }
      if (p.px >  this.WORLD_BOUND) { p.px =  this.WORLD_BOUND; p.pvx = -p.pvx * 0.4; }
      if (p.py < -this.WORLD_BOUND) { p.py = -this.WORLD_BOUND; p.pvy = -p.pvy * 0.4; }
      if (p.py >  this.WORLD_BOUND) { p.py =  this.WORLD_BOUND; p.pvy = -p.pvy * 0.4; }

      // 障碍物（简单近似：若服务器位置已被弹开，预测位置也会因为摩擦减速而趋向一致）
      // 客户端不做精确碰撞反弹（避免与服务器产生分歧累积），让 reconciliation 自动拉回

      // ---------- 2. 与服务器状态对齐（Reconciliation） ----------
      const ddx = u.x - p.px;
      const ddy = u.y - p.py;
      const distSq = ddx * ddx + ddy * ddy;

      // 情况 A：极小偏差 — 直接对齐（消除最后 1px 的抖动感）
      if (distSq < this.SNAP_MIN * this.SNAP_MIN) {
        p.px = u.x;
        p.py = u.y;
        if (Math.abs(p.pvx - u.vx) < 1 && Math.abs(p.pvy - u.vy) < 1) {
          p.pvx = u.vx;
          p.pvy = u.vy;
        }
        continue;
      }

      // 情况 B：过大偏差 — 直接对齐（可能是网络抖动或碰撞，避免与服务器长期错配）
      if (distSq >= this.SNAP_DIST * this.SNAP_DIST) {
        p.px = u.x;
        p.py = u.y;
        p.pvx = u.vx;
        p.pvy = u.vy;
        continue;
      }

      // 情况 C：中等偏差 — 以插值系数缓慢拉回（主观感）
      // 判断是否处于刚发射后的短时间（"预测信任期"），刚发射时位置回归得稍慢
      const fireT = this.lastFireAt.get(u.id);
      const justFired = fireT && (now - fireT < this.fireCooldownMs);
      const reconPos = justFired ? this.RECON_POS * 0.6 : this.RECON_POS;

      // 距离越大，回归越急（避免长时间拖尾）
      const dist = Math.sqrt(distSq);
      const urgency = Math.min(1.0, dist / 60);
      const alpha = reconPos + (1 - reconPos) * urgency * 0.5;
      const alphaClamped = Math.min(0.55, alpha);

      p.px += ddx * alphaClamped;
      p.py += ddy * alphaClamped;

      // 速度同步：用较轻的回归（因为速度变化在发射瞬间由客户端决定）
      // 刚发射后不立刻同步速度，等待服务器的物理结果逐步拉回
      if (!justFired) {
        const dvx = u.vx - p.pvx;
        const dvy = u.vy - p.pvy;
        p.pvx += dvx * this.RECON_VEL;
        p.pvy += dvy * this.RECON_VEL;
      } else {
        // 发射期内：只在预测速度 < 服务器速度的 40% 时轻微拉一下（避免发射后立刻停住）
        const predSpeed2 = p.pvx * p.pvx + p.pvy * p.pvy;
        const servSpeed2 = u.vx * u.vx + u.vy * u.vy;
        if (predSpeed2 < servSpeed2 * 0.16) {
          p.pvx += (u.vx - p.pvx) * 0.12;
          p.pvy += (u.vy - p.pvy) * 0.12;
        }
      }
    }
  }

  // ==================== 渲染入口：返回预测位置 ====================
  getRenderPos(unitId: string): { rx: number; ry: number } | null {
    const p = this.predicted.get(unitId);
    if (!p) {
      const u = this.units.find(uu => uu.id === unitId);
      return u ? { rx: u.x, ry: u.y } : null;
    }
    return { rx: p.px, ry: p.py };
  }

  // 判断单位是否完全停下（速度足够小 + 预测状态也已同步到服务器位置）
  isUnitStopped(unitId: string): boolean {
    const u = this.units.find((x) => x.id === unitId);
    if (!u) return false;
    const p = this.predicted.get(unitId);

    // 服务端速度必须接近 0
    const v2 = u.vx * u.vx + u.vy * u.vy;
    if (v2 >= 0.5 * 0.5) return false;

    // 预测速度也必须接近 0（客户端还在滑则不能发射）
    if (p) {
      const pv2 = p.pvx * p.pvx + p.pvy * p.pvy;
      if (pv2 >= 0.5 * 0.5) return false;
      const dx = p.px - u.x;
      const dy = p.py - u.y;
      if (dx * dx + dy * dy >= 2.0 * 2.0) return false;
    }
    return true;
  }

  // 单位是否在最近被伤过（用于短暂显示血条
  wasRecentlyDamaged(unitId: string): boolean {
    const t = this.lastDamagedAt.get(unitId);
    if (t === undefined) return false;
    return performance.now() - t < this.DAMAGE_DISPLAY_MS;
  }

  // 红色闪烁强度：刚受伤时最亮，随后衰减
  getDamageFlashAlpha(unitId: string): number {
    const t = this.lastDamagedAt.get(unitId);
    if (t === undefined) return 0;
    const elapsed = performance.now() - t;
    if (elapsed > 400) return 0;
    // 前 400ms 内快速衰减：从 0.9 → 0
    return Math.max(0, 0.9 * (1 - elapsed / 400));
  }

  // 取得当前玩家的单位
  getMyUnits(): Unit[] {
    if (!this.selfId) return [];
    return this.units.filter(u => u.ownerId === this.selfId);
  }

  getSelectedUnit(): Unit | null {
    if (!this.selectedUnitId) return null;
    return this.units.find(u => u.id === this.selectedUnitId) ?? null;
  }

  selectUnit(unitId: string | null): void {
    this.selectedUnitId = unitId;
  }

  // 切换某个单位的 active 技能（通过底部技能栏或键盘 1/2/3）
  setActiveSkillIndex(unitId: string, index: number): void {
    const u = this.units.find((x) => x.id === unitId);
    if (!u || !u.skills || u.skills.length === 0) return;
    const idx = Math.max(0, Math.min(u.skills.length - 1, index));
    u.activeSkillIndex = idx;
    // 写入客户端缓存，避免下一次 gameState 覆盖
    this.clientSkillIndex.set(unitId, idx);
  }
}
