const PLAYER_RADIUS = 16;
export function drawPlayer(ctx, player, isSelf, camX, camY, width, height) {
    const sx = player.x - camX + width / 2;
    const sy = player.y - camY + height / 2;
    const hue = player.hue;
    const r = PLAYER_RADIUS;
    // 光晕
    const glowR = r * 3.2;
    const glow = ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, glowR);
    glow.addColorStop(0, `hsla(${hue}, 85%, 65%, 0.45)`);
    glow.addColorStop(1, `hsla(${hue}, 85%, 65%, 0)`);
    ctx.beginPath();
    ctx.arc(sx, sy, glowR, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();
    // 光圈
    ctx.beginPath();
    ctx.arc(sx, sy, r + 5, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${hue}, 85%, 70%, 0.55)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    // 主体
    const bodyGrad = ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.3, 2, sx, sy, r);
    bodyGrad.addColorStop(0, `hsla(${hue}, 95%, 88%, 1)`);
    bodyGrad.addColorStop(1, `hsla(${hue}, 80%, 50%, 1)`);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();
    // 名字
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isSelf ? '#7fffa8' : 'rgba(255,255,255,0.75)';
    ctx.fillText(player.name || '玩家', sx, sy - r - 10);
}
