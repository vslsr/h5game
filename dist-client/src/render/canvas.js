export function setupCanvas(canvasId) {
    const canvas = document.getElementById(canvasId);
    const ctx = canvas.getContext('2d');
    let cssWidth = window.innerWidth;
    let cssHeight = window.innerHeight;
    const resize = () => {
        const dpr = window.devicePixelRatio || 1;
        cssWidth = window.innerWidth;
        cssHeight = window.innerHeight;
        // 实际像素尺寸（物理像素）
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        // CSS 显示尺寸
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
        // 重置 transform，然后把内部坐标系缩放为逻辑像素
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);
    };
    window.addEventListener('resize', resize);
    resize();
    return {
        canvas,
        ctx,
        get width() {
            return cssWidth;
        },
        get height() {
            return cssHeight;
        }
    };
}
