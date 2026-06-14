// 后端：默认障碍物配置
import { GAME_CONSTANTS } from '../shared/types';
const { CELL, OBSTACLE_MAX_HP } = GAME_CONSTANTS;
const DEFAULT_OBSTACLE_CELLS = [
    { cx: 5, cy: -3 },
    { cx: 6, cy: 2 },
    { cx: -4, cy: 3 },
    { cx: -3, cy: -2 },
    { cx: 0, cy: 5 },
    { cx: 2, cy: 6 }
];
export const DEFAULT_OBSTACLES = DEFAULT_OBSTACLE_CELLS.map(({ cx, cy }, i) => ({
    id: `obs-${cx}-${cy}-${i}`,
    x: cx * CELL,
    y: cy * CELL,
    size: CELL,
    hp: OBSTACLE_MAX_HP,
    maxHp: OBSTACLE_MAX_HP
}));
