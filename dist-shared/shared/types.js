// 前后端共享的游戏类型定义
// --- 技能模板注册表 ---
// 不同技能复用相同参数
export const SKILL_REGISTRY = {
    bullet_shot: {
        skillId: 'bullet_shot',
        name: '弹射炮',
        icon: '🔫',
        description: '蓄力发射高速弹丸',
        speedMin: 320,
        speedMax: 720,
        damageMin: 1,
        damageMax: 5,
        lifetimeMs: 3000,
        explosive: false,
        explosionRadius: 0,
        explosionDamage: 0,
        hue: 200,
        cooldownMs: 0
    },
    rocket_shot: {
        skillId: 'rocket_shot',
        name: '火箭弹',
        icon: '🚀',
        description: '碰撞后范围爆炸',
        speedMin: 180,
        speedMax: 280,
        damageMin: 3,
        damageMax: 10,
        lifetimeMs: 5000,
        explosive: true,
        explosionRadius: 100,
        explosionDamage: 8,
        hue: 20,
        cooldownMs: 0
    },
    dagger_shot: {
        skillId: 'dagger_shot',
        name: '飞刀',
        icon: '🗡️',
        description: '超高射速短距离',
        speedMin: 600,
        speedMax: 900,
        damageMin: 1,
        damageMax: 3,
        lifetimeMs: 1500,
        explosive: false,
        explosionRadius: 0,
        explosionDamage: 0,
        hue: 120,
        cooldownMs: 0
    }
};
// --- 单位模板注册表 ---
export const UNIT_REGISTRY = {
    soldier: {
        unitId: 'soldier',
        name: '突击兵',
        icon: '🎖️',
        description: '平衡型单位',
        hue: 200,
        skills: [
            { ...SKILL_REGISTRY.bullet_shot },
            { ...SKILL_REGISTRY.rocket_shot }
        ]
    },
    ranger: {
        unitId: 'ranger',
        name: '游侠',
        icon: '🏹',
        description: '快速高射速',
        hue: 120,
        skills: [
            { ...SKILL_REGISTRY.dagger_shot },
            { ...SKILL_REGISTRY.bullet_shot }
        ]
    },
    gunner: {
        unitId: 'gunner',
        name: '炮手',
        icon: '💣',
        description: '范围伤害专家',
        hue: 20,
        skills: [
            { ...SKILL_REGISTRY.rocket_shot },
            { ...SKILL_REGISTRY.bullet_shot }
        ]
    }
};
// 默认玩家可用的单位列表（服务端会复制一份下发）
export const DEFAULT_PLAYER_UNITS = [
    { ...UNIT_REGISTRY.soldier, skills: UNIT_REGISTRY.soldier.skills.map((s) => ({ ...s })) },
    { ...UNIT_REGISTRY.ranger, skills: UNIT_REGISTRY.ranger.skills.map((s) => ({ ...s })) },
    { ...UNIT_REGISTRY.gunner, skills: UNIT_REGISTRY.gunner.skills.map((s) => ({ ...s })) }
];
// --- 游戏常量（前后端保持一致）---
export const GAME_CONSTANTS = {
    TICK_MS: 50,
    MAX_SPEED: 6,
    SPEED_PX_PER_SEC: 120,
    WORLD_BOUND: 10000,
    CELL: 48,
    PLAYER_RADIUS: 16,
    BULLET_SPEED_MIN: 320,
    BULLET_SPEED_MAX: 720,
    BULLET_LIFETIME_MS: 3000,
    BULLET_RADIUS: 5,
    BULLET_DAMAGE_MIN: 1,
    BULLET_DAMAGE_MAX: 5,
    OBSTACLE_MAX_HP: 10
};
