import type { Bullet } from '../../shared/types';
export declare function drawBullets(ctx: CanvasRenderingContext2D, bullets: Bullet[], camX: number, camY: number, width: number, height: number, now: number): void;
export interface BulletParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    life: number;
    maxLife: number;
    size: number;
}
export declare function drawBulletParticles(ctx: CanvasRenderingContext2D, particles: BulletParticle[], camX: number, camY: number, width: number, height: number): void;
