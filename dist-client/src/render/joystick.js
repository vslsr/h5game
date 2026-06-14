export function drawJoystickUI(ctx, state, canvasHeight) {
    let baseX;
    let baseY;
    let knobX;
    let knobY;
    let alpha;
    let hintColor;
    let label;
    if (state.active) {
        baseX = state.baseX;
        baseY = state.baseY;
        knobX = state.knobX;
        knobY = state.knobY;
        alpha = 1;
        hintColor = 'rgba(255,255,255,0.9)';
        label = null;
    }
    else {
        baseX = 140;
        baseY = canvasHeight - 140;
        knobX = baseX;
        knobY = baseY;
        alpha = 0.3;
        hintColor = 'rgba(120,180,255,1)';
        label = '触摸任意位置 / WASD 移动';
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(baseX, baseY, state.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = hintColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(knobX, knobY, state.knobRadius, 0, Math.PI * 2);
    const knobGrad = ctx.createRadialGradient(knobX - 5, knobY - 5, 2, knobX, knobY, state.knobRadius);
    knobGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
    knobGrad.addColorStop(1, 'rgba(120,180,255,0.7)');
    ctx.fillStyle = knobGrad;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (label) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, baseX, baseY - state.radius - 20);
    }
}
