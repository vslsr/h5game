// 前端：网格与原点标记渲染
export function drawGrid(ctx, camX, camY, width, height) {
    const gridSize = 60;
    const startX = Math.floor((camX - width / 2) / gridSize) * gridSize;
    const startY = Math.floor((camY - height / 2) / gridSize) * gridSize;
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = startX; x < camX + width / 2 + gridSize; x += gridSize) {
        const sx = x - camX + width / 2;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
    }
    for (let y = startY; y < camY + height / 2 + gridSize; y += gridSize) {
        const sy = y - camY + height / 2;
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
    }
    ctx.stroke();
    // 世界原点
    const ox = -camX + width / 2;
    const oy = -camY + height / 2;
    if (Math.abs(ox) < width && Math.abs(oy) < height) {
        ctx.strokeStyle = 'rgba(79,195,247,0.2)';
        ctx.beginPath();
        ctx.moveTo(ox - 20, oy);
        ctx.lineTo(ox + 20, oy);
        ctx.moveTo(ox, oy - 20);
        ctx.lineTo(ox, oy + 20);
        ctx.stroke();
    }
}
