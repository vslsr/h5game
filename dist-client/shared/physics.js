// 前后端共享的碰撞检测与物理逻辑
import { GAME_CONSTANTS } from './types';
const { PLAYER_RADIUS } = GAME_CONSTANTS;
// 圆 vs 矩形 AABB 碰撞：将圆心推回最近的非重叠点
export function circleVsRect(cx, cy, r, rx, ry, rw) {
    const half = rw / 2;
    const left = rx - half;
    const right = rx + half;
    const top = ry - half;
    const bottom = ry + half;
    const closestX = Math.max(left, Math.min(cx, right));
    const closestY = Math.max(top, Math.min(cy, bottom));
    const dx = cx - closestX;
    const dy = cy - closestY;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r)
        return { x: cx, y: cy, collided: false };
    const d = Math.sqrt(d2) || 0.0001;
    const push = r - d;
    return {
        x: cx + (dx / d) * push,
        y: cy + (dy / d) * push,
        collided: true
    };
}
// 分轴移动与碰撞：先 X 轴，再 Y 轴
export function moveWithCollisions(px, py, dx, dy, obstacles) {
    // X 轴
    let nx = px + dx;
    let ny = py;
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const res = circleVsRect(nx, ny, PLAYER_RADIUS, o.x, o.y, o.size);
        nx = res.x;
        ny = res.y;
    }
    // Y 轴
    ny = ny + dy;
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const res = circleVsRect(nx, ny, PLAYER_RADIUS, o.x, o.y, o.size);
        nx = res.x;
        ny = res.y;
    }
    return { x: nx, y: ny };
}
