// 前端：发射摇杆（拉弹弓）
// 拖拽方向 D → 子弹朝 -D 方向发射（反向 = 拉弹弓的松手方向）
// 拖拽距离越大 → charge 值越大（0.2 ~ 1.0）→ 子弹射速越高、伤害越大
export class FireJoystick {
    canvas;
    active = false;
    baseX = 0;
    baseY = 0;
    knobX = 0;
    knobY = 0;
    dragX = 0;
    dragY = 0;
    dragMagnitude = 0;
    radius = 70;
    events;
    constructor(canvas, events) {
        this.canvas = canvas;
        this.events = events;
        this.bindEvents();
    }
    isFireZone(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        return clientX - rect.left > rect.width * 0.5;
    }
    // 多触点支持：追踪自己负责的 touch id
    trackedTouchId = null;
    bindEvents() {
        // === Touch（移动端，支持多触点）===
        this.canvas.addEventListener('touchstart', (e) => {
            // 多触点：只处理右半屏、且尚未追踪任何 touch 的情况
            for (const t of Array.from(e.changedTouches)) {
                if (this.trackedTouchId !== null)
                    continue; // 已有追踪的 touch
                if (!this.isFireZone(t.clientX))
                    continue;
                if (this.active)
                    continue;
                // 若命中 UI 元素（背包图标/面板），不拦截，让 click 事件正常触发
                if (this.events.isUIHit && this.events.isUIHit(t.clientX, t.clientY))
                    continue;
                e.preventDefault();
                this.trackedTouchId = t.identifier;
                this.activate(t.clientX, t.clientY);
                break; // 只处理第一个符合条件的 touch
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.active || this.trackedTouchId === null)
                return;
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                // 只处理自己追踪的 touch，避免其他触点干扰
                if (t.identifier === this.trackedTouchId) {
                    this.updateFromPointer(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: false });
        const endTouch = (e) => {
            if (!this.active || this.trackedTouchId === null)
                return;
            for (const t of Array.from(e.changedTouches)) {
                // 只有自己追踪的 touch 结束时才发射
                if (t.identifier === this.trackedTouchId) {
                    e.preventDefault();
                    this.trackedTouchId = null;
                    this.fire();
                    break;
                }
            }
        };
        this.canvas.addEventListener('touchend', endTouch);
        this.canvas.addEventListener('touchcancel', endTouch);
        // === Mouse（桌面）===
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.active)
                return;
            if (!this.isFireZone(e.clientX))
                return;
            if (this.events.isUIHit && this.events.isUIHit(e.clientX, e.clientY))
                return;
            e.preventDefault();
            this.activate(e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.active)
                return;
            this.updateFromPointer(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', () => {
            if (!this.active)
                return;
            this.fire();
        });
        // === Keyboard 辅助按键（桌面）：空格发射向前 ===
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space' && !e.repeat) {
                // 空格键：朝正右方中等蓄力发射（简单调试用）
                this.events.onFire(1, 0, 0.6);
            }
        });
    }
    activate(clientX, clientY) {
        this.active = true;
        this.baseX = clientX;
        this.baseY = clientY;
        this.knobX = clientX;
        this.knobY = clientY;
        this.dragX = 0;
        this.dragY = 0;
        this.dragMagnitude = 0;
    }
    updateFromPointer(clientX, clientY) {
        const dx = clientX - this.baseX;
        const dy = clientY - this.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 4) {
            this.knobX = this.baseX;
            this.knobY = this.baseY;
            this.dragX = 0;
            this.dragY = 0;
            this.dragMagnitude = 0;
        }
        else if (dist <= this.radius) {
            this.knobX = clientX;
            this.knobY = clientY;
            this.dragX = dx / this.radius;
            this.dragY = dy / this.radius;
            this.dragMagnitude = dist / this.radius;
        }
        else {
            const k = this.radius / dist;
            this.knobX = this.baseX + dx * k;
            this.knobY = this.baseY + dy * k;
            this.dragX = dx / dist;
            this.dragY = dy / dist;
            this.dragMagnitude = 1;
        }
    }
    fire() {
        if (!this.active)
            return;
        const dirX = -this.dragX;
        const dirY = -this.dragY;
        const charge = this.dragMagnitude;
        this.active = false;
        this.trackedTouchId = null;
        this.dragX = 0;
        this.dragY = 0;
        this.dragMagnitude = 0;
        if (charge < 0.2) {
            return;
        }
        const len = Math.sqrt(dirX * dirX + dirY * dirY);
        if (len === 0)
            return;
        this.events.onFire(dirX / len, dirY / len, charge);
    }
}
