// 共享类型定义（弹射物理 + 技能系统）
// 单位 = 场景实体（RTS风格），玩家 = 控制器

export const GAME_CONSTANTS = {
  WORLD_BOUND: 1600,
  UNIT_RADIUS: 16,
  OBSTACLE_SIZE: 64,
  TICK_MS: 50,
  FRICTION: 0.92,
  MIN_VELOCITY: 2,
} as const;

// ===== 技能系统 =====
export type SkillType = 'direction' | 'point';

export interface SkillDef {
  id: string;
  name: string;
  icon: string;
  type: SkillType;
  cooldownMs: number;              // 冷却时间 (ms)
  chargeMultiplier: number;        // 发射速度倍数 (direction 型)
  hpCostPct?: number;              // 可选：施放时自损 HP 比例 0~1
  damage?: number;                 // point 型：对命中单位的基础伤害
  radius?: number;                 // point 型：影响半径
  description: string;
}

export interface UnitSkill {
  defId: string;                   // 对应 SkillDef.id
  readyAtTs: number;               // 下次可施放的时间戳 (ms)
}

// 游戏内所有技能定义表（id -> SkillDef）
export const SKILL_DEFS: Record<string, SkillDef> = {
  // 默认弹射：所有单位通用，无消耗、无冷却、速度 = 原行为
  basic_shot: {
    id: 'basic_shot',
    name: '弹射',
    icon: '➤',
    type: 'direction',
    cooldownMs: 0,
    chargeMultiplier: 1.0,
    description: '基础弹射：拖拽方向发射',
  },
  // 冲锋：速度 x1.8，CD 5 秒
  charge: {
    id: 'charge',
    name: '冲锋',
    icon: '⚡',
    type: 'direction',
    cooldownMs: 5000,
    chargeMultiplier: 1.8,
    description: '发射速度 x1.8，CD 5 秒',
  },
  // 冲击波（炮手专属）：在目标点产生范围推动 + 伤害
  shockwave: {
    id: 'shockwave',
    name: '冲击波',
    icon: '💥',
    type: 'point',
    cooldownMs: 8000,
    chargeMultiplier: 1.0,
    damage: 18,
    radius: 180,
    description: '在目标点产生范围冲击波，伤害并推开附近单位',
  },
  // 瞬移（游侠专属）：直接传送到点
  blink: {
    id: 'blink',
    name: '瞬移',
    icon: '✨',
    type: 'point',
    cooldownMs: 10000,
    chargeMultiplier: 1.0,
    radius: 220,
    description: '传送到点，CD 10 秒',
  },
};

// 根据单位名决定可学习的技能（保留 basic_shot 为第一个）
export function defaultSkillsForUnit(unitName: string): string[] {
  const base = ['basic_shot', 'charge'];
  if (unitName === '炮手') return [...base, 'shockwave'];
  if (unitName === '游侠') return [...base, 'blink'];
  return base;
}

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

  // 属性
  hp: number;
  hpMax: number;
  attack: number;
  mass: number;
  baseSpeed: number;

  // 物理状态
  x: number;
  y: number;
  vx: number;
  vy: number;

  // 技能
  skills: UnitSkill[];
  activeSkillIndex: number; // 当前选中的技能，>= 0，默认为 0（basic_shot）
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

// 游戏事件类型
export type GameEventType =
  | 'unitDeath'
  | 'unitImpulse'
  | 'skillCast'          // 技能施放：客户端 HUD 更新冷却
  | 'collision';

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

// 单位模板
function unitTemplates(): Array<{
  name: string; icon: string; dx: number; dy: number;
  hpMax: number; attack: number; mass: number; baseSpeed: number;
}> {
  return [
    { name: '突击兵', icon: '🎖️', dx: -32, dy: -32, hpMax: 100, attack: 15, mass: 1.0, baseSpeed: 420 },
    { name: '炮手',   icon: '💣', dx:   0, dy: -48, hpMax: 140, attack: 30, mass: 2.2, baseSpeed: 260 },
    { name: '游侠',   icon: '🏹', dx:  32, dy: -32, hpMax:  85, attack: 20, mass: 0.8, baseSpeed: 520 },
  ];
}

export function makeDefaultUnits(ownerId: string, hue: number, spawnX: number, spawnY: number): Unit[] {
  return unitTemplates().map((t, i) => {
    const skillIds = defaultSkillsForUnit(t.name);
    return {
      id: `${ownerId}-u${i}`,
      ownerId,
      name: t.name,
      icon: t.icon,
      hue,
      hp: t.hpMax,
      hpMax: t.hpMax,
      attack: t.attack,
      mass: t.mass,
      baseSpeed: t.baseSpeed,
      x: spawnX + t.dx,
      y: spawnY + t.dy,
      vx: 0,
      vy: 0,
      skills: skillIds.map((id) => ({ defId: id, readyAtTs: 0 })),
      activeSkillIndex: 0,
    };
  });
}
