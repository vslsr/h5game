import { type Obstacle } from './types.js';
interface CircleRectResult {
    x: number;
    y: number;
    collided: boolean;
}
export declare function circleVsRect(cx: number, cy: number, r: number, rx: number, ry: number, rw: number): CircleRectResult;
export declare function moveWithCollisions(px: number, py: number, dx: number, dy: number, obstacles: Obstacle[]): {
    x: number;
    y: number;
};
export declare function segmentIntersectsRect(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, size: number): boolean;
export declare function pointDistanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number;
export declare function lineOfSight(fromX: number, fromY: number, toX: number, toY: number, obstacles: Obstacle[], units: Array<{
    x: number;
    y: number;
}>, unitRadius?: number): boolean;
export interface RaycastHit {
    x: number;
    y: number;
    t: number;
}
export declare function raycastToFirstHit(fromX: number, fromY: number, toX: number, toY: number, obstacles: Obstacle[], units: Array<{
    x: number;
    y: number;
}>, unitRadius?: number): RaycastHit | null;
export {};
