export function drawObstacles(ctx, obstacles, camX, camY, width, height) {
    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        const half = o.size / 2;
        const sx = o.x - camX - half + width / 2;
        const sy = o.y - camY - half + height / 2;
        if (sx + o.size < 0 || sx > width || sy + o.size < 0 || sy > height)
            continue;
        // 柔和填充（根据 hp 变化透明度和颜色）
        const hpRatio = o.maxHp > 0 ? o.hp / o.maxHp : 1;
        const damaged = 1 - hpRatio; // 0 未受损，1 完全损坏
        // 柔和填充：随受损增加暖色
        const r = Math.floor(120 + 100 * damaged);
        const g = Math.floor(160 - 40 * damaged);
        const b = Math.floor(220 - 120 * damaged);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.18)`;
        ctx.fillRect(sx, sy, o.size, o.size);
        // 细描边
        ctx.strokeStyle = `rgba(${r + 30}, ${g}, ${b}, 0.85)`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(sx + 0.75, sy + 0.75, o.size - 1.5, o.size - 1.5);
        // 四角标记
        const tick = 3;
        ctx.beginPath();
        ctx.moveTo(sx, sy + tick);
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx + tick, sy);
        ctx.moveTo(sx + o.size - tick, sy);
        ctx.lineTo(sx + o.size, sy);
        ctx.lineTo(sx + o.size, sy + tick);
        ctx.moveTo(sx + o.size, sy + o.size - tick);
        ctx.lineTo(sx + o.size, sy + o.size);
        ctx.lineTo(sx + o.size - tick, sy + o.size);
        ctx.moveTo(sx + tick, sy + o.size);
        ctx.lineTo(sx, sy + o.size);
        ctx.lineTo(sx, sy + o.size - tick);
        ctx.strokeStyle = `rgba(${r + 60}, ${g + 30}, ${b}, 0.95)`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
        // 血条（在障碍物上方）
        if (o.maxHp > 1) {
            const barW = o.size - 8;
            const barH = 5;
            const barX = sx + 4;
            const barY = sy - 11;
            // 背景
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(barX, barY, barW, barH);
            // 前景
            const hpColor = hpRatio > 0.5
                ? `rgba(120, 220, 120, 0.9)`
                : hpRatio > 0.25
                    ? `rgba(230, 200, 80, 0.9)`
                    : `rgba(220, 90, 80, 0.95)`;
            ctx.fillStyle = hpColor;
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
            // 边框
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
        }
    }
}
