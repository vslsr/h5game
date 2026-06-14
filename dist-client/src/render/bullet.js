import { GAME_CONSTANTS } from '../../shared/types';
export function drawBullets(ctx, bullets, camX, camY, width, height, now) {
    for (const b of bullets) {
        const sx = b.x - camX + width / 2;
        const sy = b.y - camY + height / 2;
        const hue = b.ownerHue;
        const r = GAME_CONSTANTS.BULLET_RADIUS;
        // 剩余寿命比例：最后 1/4 开始淡出
        const age = now - b.createdAt;
        const fadeStart = b.lifetimeMs * 0.75;
        let alpha = 1;
        if (age > fadeStart) {
            alpha = Math.max(0, 1 - (age - fadeStart) / (b.lifetimeMs - fadeStart));
        }
        // 光晕
        const glowR = r * 4;
        const glow = ctx.createRadialGradient(sx, sy, r * 0.3, sx, sy, glowR);
        glow.addColorStop(0, `hsla(${hue}, 90%, 70%, ${0.5 * alpha})`);
        glow.addColorStop(1, `hsla(${hue}, 90%, 70%, 0)`);
        ctx.beginPath();
        ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();
        // 拖尾（沿速度反向的短渐变）
        const vLen = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (vLen > 0) {
            const tailLen = 18;
            const tx = sx - (b.vx / vLen) * tailLen;
            const ty = sy - (b.vy / vLen) * tailLen;
            const tailGrad = ctx.createLinearGradient(tx, ty, sx, sy);
            tailGrad.addColorStop(0, `hsla(${hue}, 90%, 70%, 0)`);
            tailGrad.addColorStop(1, `hsla(${hue}, 95%, 80%, ${0.9 * alpha})`);
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(sx, sy);
            ctx.strokeStyle = tailGrad;
            ctx.lineWidth = r * 1.8;
            ctx.lineCap = 'round';
            ctx.stroke();
        }
        // 子弹本体
        const bodyGrad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 1, sx, sy, r);
        bodyGrad.addColorStop(0, `hsla(${hue}, 100%, 95%, ${alpha})`);
        bodyGrad.addColorStop(1, `hsla(${hue}, 85%, 55%, ${alpha})`);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = bodyGrad;
        ctx.fill();
    }
}
export function drawBulletParticles(ctx, particles, camX, camY, width, height) {
    for (const p of particles) {
        const sx = p.x - camX + width / 2;
        const sy = p.y - camY + height / 2;
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 95%, 75%, ${alpha * 0.85})`;
        ctx.fill();
    }
}
