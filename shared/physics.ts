// 前后端共享的碰撞检测与物理逻辑
import { GAME_CONSTANTS, type Obstacle } from './types.js';

const UNIT_RADIUS = GAME_CONSTANTS.UNIT_RADIUS;
const EPS = 1e-6;

interface CircleRectResult {
  x: number;
  y: number;
  collided: boolean;
}

// 圆 vs 矩形 AABB 碰撞：将圆心推回最近的非重叠点
export function circleVsRect(
  cx: number,
  cy: number,
  r: number,
  rx: number,
  ry: number,
  rw: number
): CircleRectResult {
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
  if (d2 >= r * r) return { x: cx, y: cy, collided: false };

  const d = Math.sqrt(d2) || 0.0001;
  const push = r - d;
  return {
    x: cx + (dx / d) * push,
    y: cy + (dy / d) * push,
    collided: true
  };
}

// 分轴移动与碰撞：先 X 轴，再 Y 轴
export function moveWithCollisions(
  px: number,
  py: number,
  dx: number,
  dy: number,
  obstacles: Obstacle[]
): { x: number; y: number } {
  // X 轴
  let nx = px + dx;
  let ny = py;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const res = circleVsRect(nx, ny, UNIT_RADIUS, o.x, o.y, o.size);
    nx = res.x;
    ny = res.y;
  }
  // Y 轴
  ny = ny + dy;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const res = circleVsRect(nx, ny, UNIT_RADIUS, o.x, o.y, o.size);
    nx = res.x;
    ny = res.y;
  }
  return { x: nx, y: ny };
}

// 线段 vs 轴对齐矩形（AABB）相交判断（Liang-Barsky clipping 简化版）
// 返回 true 当线段 (x1,y1)->(x2,y2) 与以 (cx,cy) 为中心、边长为 size 的矩形相交
export function segmentIntersectsRect(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number, size: number,
): boolean {
  const half = size / 2;
  const minX = cx - half;
  const maxX = cx + half;
  const minY = cy - half;
  const maxY = cy + half;

  // 如果两端点都在某一侧的外部 → 快速排除
  if ((x1 < minX && x2 < minX) || (x1 > maxX && x2 > maxX) ||
      (y1 < minY && y2 < minY) || (y1 > maxY && y2 > maxY)) {
    return false;
  }
  // 如果有任一端点在矩形内 → 相交
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return true;
  if (x2 >= minX && x2 <= maxX && y2 >= minY && y2 <= maxY) return true;

  // Liang-Barsky：参数 t 在 [0,1] 内则相交
  const dx = x2 - x1;
  const dy = y2 - y1;
  const p = [-dx, dx, -dy, dy];
  const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
  let u1 = 0;
  let u2 = 1;
  for (let i = 0; i < 4; i++) {
    if (Math.abs(p[i]) < EPS) {
      if (q[i] < 0) return false; // 线段平行且在外侧
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > u2) return false;
        if (t > u1) u1 = t;
      } else {
        if (t < u1) return false;
        if (t < u2) u2 = t;
      }
    }
  }
  return true;
}

// 点 (px,py) 到线段 (x1,y1)->(x2,y2) 的最短距离
export function pointDistanceToSegment(
  px: number, py: number,
  x1: number, y1: number,
  x2: number, y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 < EPS) {
    const ddx = px - x1;
    const ddy = py - y1;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / len2;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  const fdx = px - cx;
  const fdy = py - cy;
  return Math.sqrt(fdx * fdx + fdy * fdy);
}

// 视线检测：从 (fromX,fromY) 到 (toX,toY) 是否存在遮挡
// - obstacles：矩形障碍物，任何与线段相交的矩形都会挡住视线
// - units：其他单位列表（不含施放者自己），任何圆心到线段距离 < radius 的单位视为遮挡
// 返回 true = 视线通畅，false = 被阻挡
export function lineOfSight(
  fromX: number, fromY: number,
  toX: number, toY: number,
  obstacles: Obstacle[],
  units: Array<{ x: number; y: number }>,
  unitRadius: number = GAME_CONSTANTS.UNIT_RADIUS,
): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    const ob = obstacles[i];
    if (segmentIntersectsRect(fromX, fromY, toX, toY, ob.x, ob.y, ob.size)) {
      return false;
    }
  }
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const d = pointDistanceToSegment(u.x, u.y, fromX, fromY, toX, toY);
    if (d < unitRadius) return false;
  }
  return true;
}

// 射线检测：返回从 (fromX,fromY) 到 (toX,toY) 遇到的第一个障碍物的距离和碰撞点
// 沿射线方向走 t*direction。返回 null 表示畅通
export interface RaycastHit {
  x: number; y: number; // 碰撞点
  t: number;         // 沿射线的参数（0~1 相对 to-from 距离）
}
function raycastSegment(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number, size: number,
): number | null {
  // 对一个 AABB 求进入参数 t（0~1），无交点返回 null
  const half = size / 2;
  const minX = cx - half;
  const maxX = cx + half;
  const minY = cy - half;
  const maxY = cy + half;
  // 如果起点就在矩形内 → 立即命中
  if (x1 >= minX && x1 <= maxX && y1 >= minY && y1 <= maxY) return 0;
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tmin = 0;
  let tmax = 1;
  // X 轴
  if (Math.abs(dx) < EPS) {
    if (x1 < minX || x1 > maxX) return null;
  } else {
    const t1 = (minX - x1) / dx;
    const t2 = (maxX - x1) / dx;
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
    if (tmin > tmax) return null;
  }
  // Y 轴
  if (Math.abs(dy) < EPS) {
    if (y1 < minY || y1 > maxY) return null;
  } else {
    const t1 = (minY - y1) / dy;
    const t2 = (maxY - y1) / dy;
    const lo = Math.min(t1, t2);
    const hi = Math.max(t1, t2);
    if (lo > tmin) tmin = lo;
    if (hi < tmax) tmax = hi;
    if (tmin > tmax) return null;
  }
  if (tmin < 0 || tmin > 1) return null;
  return tmin;
}
function raycastCircle(
  x1: number, y1: number,
  x2: number, y2: number,
  cx: number, cy: number, r: number,
): number | null {
  // 射线：从起点到圆的最近进入参数 t（0~1）
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (a < EPS) {
    // 点射线 → 检查起点是否在圆内
    if (c <= 0) return 0;
    return null;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const sq = Math.sqrt(disc);
  const t1 = (-b - sq) / (2 * a);
  const t2 = (-b + sq) / (2 * a);
  const lo = Math.min(t1, t2);
  const hi = Math.max(t1, t2);
  // 如果起点在圆内 (c <= 0) → 立即命中 t=0
  if (c <= 0) return 0;
  if (lo < 0 || lo > 1) return null;
  return lo;
}

// 从起点到目标点的最近碰撞；返回 {x,y,t}，若畅通返回 null
export function raycastToFirstHit(
  fromX: number, fromY: number,
  toX: number, toY: number,
  obstacles: Obstacle[],
  units: Array<{ x: number; y: number }>,
  unitRadius: number = GAME_CONSTANTS.UNIT_RADIUS,
): RaycastHit | null {
  let bestT = Infinity;
  let hit = false;
  for (let i = 0; i < obstacles.length; i++) {
    const ob = obstacles[i];
    const t = raycastSegment(fromX, fromY, toX, toY, ob.x, ob.y, ob.size);
    if (t !== null && t < bestT) { bestT = t; hit = true; }
  }
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const t = raycastCircle(fromX, fromY, toX, toY, u.x, u.y, unitRadius);
    if (t !== null && t < bestT) { bestT = t; hit = true; }
  }
  if (!hit) return null;
  const dx = toX - fromX;
  const dy = toY - fromY;
  return { x: fromX + dx * bestT, y: fromY + dy * bestT, t: bestT };
}
