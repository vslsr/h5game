import { type Obstacle } from './types';
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
export {};
