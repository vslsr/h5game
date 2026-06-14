export class JoystickInput {
    canvas;
    events;
    dirX = 0;
    dirY = 0;
    active = false;
    activeType = null;
    baseX = 0;
    baseY = 0;
    knobX = 0;
    knobY = 0;
    radius = 70;
    knobRadius = 26;
    // 多触点支持：追踪自己负责的 touch id
    trackedTouchId = null;
    keys = {};
    constructor(canvas, events) {
        this.canvas = canvas;
        this.events = events;
        this.bindEvents();
    }
    // 是否属于移动摇杆响应区域（屏幕左半侧）
    isMoveZone(clientX) {
        const rect = this.canvas.getBoundingClientRect();
        return clientX - rect.left <= rect.width * 0.5;
    }
    bindEvents() {
        // 移动摇杆只响应屏幕左半侧（右半侧留给发射摇杆）
        // === Touch ===
        this.canvas.addEventListener('touchstart', (e) => {
            // 多触点：只处理左半屏、且尚未追踪任何 touch 的情况
            for (const t of Array.from(e.changedTouches)) {
                if (this.trackedTouchId !== null)
                    continue; // 已有追踪的 touch，跳过
                if (!this.isMoveZone(t.clientX))
                    continue;
                // 命中 UI 元素则不激活摇杆
                if (this.events.isUIHit && this.events.isUIHit(t.clientX, t.clientY))
                    continue;
                e.preventDefault();
                this.trackedTouchId = t.identifier;
                this.activate('touch', t.clientX, t.clientY);
                break; // 只处理第一个符合条件的 touch
            }
        }, { passive: false });
        this.canvas.addEventListener('touchmove', (e) => {
            if (this.activeType !== 'touch' || this.trackedTouchId === null)
                return;
            e.preventDefault();
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier === this.trackedTouchId) {
                    this.updateFromPointer(t.clientX, t.clientY);
                    break;
                }
            }
        }, { passive: false });
        const endTouch = (e) => {
            if (this.activeType !== 'touch' || this.trackedTouchId === null)
                return;
            for (const t of Array.from(e.changedTouches)) {
                if (t.identifier === this.trackedTouchId) {
                    e.preventDefault();
                    this.trackedTouchId = null;
                    this.deactivate();
                    break;
                }
            }
        };
        this.canvas.addEventListener('touchend', endTouch);
        this.canvas.addEventListener('touchcancel', endTouch);
        // === Mouse ===
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.active || !this.isMoveZone(e.clientX))
                return;
            if (this.events.isUIHit && this.events.isUIHit(e.clientX, e.clientY))
                return;
            e.preventDefault();
            this.activate('mouse', e.clientX, e.clientY);
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.active || this.activeType !== 'mouse')
                return;
            this.updateFromPointer(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', () => {
            if (this.active && this.activeType === 'mouse') {
                this.deactivate();
            }
        });
        // === Keyboard WASD / Arrows ===
        window.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            this.refreshKeyboard();
        });
        window.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
            this.refreshKeyboard();
        });
    }
    activate(type, baseX, baseY) {
        if (this.active)
            return;
        this.active = true;
        this.activeType = type;
        this.baseX = baseX;
        this.baseY = baseY;
        this.knobX = baseX;
        this.knobY = baseY;
        this.dirX = 0;
        this.dirY = 0;
        this.events.onInputChange({ vx: 0, vy: 0 });
        this.events.onActivate?.(type);
    }
    updateFromPointer(clientX, clientY) {
        const dx = clientX - this.baseX;
        const dy = clientY - this.baseY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 6) {
            this.knobX = this.baseX;
            this.knobY = this.baseY;
            this.dirX = 0;
            this.dirY = 0;
        }
        else if (dist <= this.radius) {
            this.knobX = clientX;
            this.knobY = clientY;
            this.dirX = dx / this.radius;
            this.dirY = dy / this.radius;
        }
        else {
            const k = this.radius / dist;
            this.knobX = this.baseX + dx * k;
            this.knobY = this.baseY + dy * k;
            this.dirX = dx / dist;
            this.dirY = dy / dist;
        }
        this.events.onInputChange({ vx: this.dirX, vy: this.dirY });
    }
    deactivate() {
        if (!this.active)
            return;
        this.active = false;
        this.activeType = null;
        this.trackedTouchId = null;
        this.knobX = this.baseX;
        this.knobY = this.baseY;
        this.dirX = 0;
        this.dirY = 0;
        this.events.onInputChange({ vx: 0, vy: 0 });
        this.events.onDeactivate?.();
    }
    refreshKeyboard() {
        let vx = 0;
        let vy = 0;
        if (this.keys['w'] || this.keys['arrowup'])
            vy -= 1;
        if (this.keys['s'] || this.keys['arrowdown'])
            vy += 1;
        if (this.keys['a'] || this.keys['arrowleft'])
            vx -= 1;
        if (this.keys['d'] || this.keys['arrowright'])
            vx += 1;
        if (vx !== 0 || vy !== 0) {
            const len = Math.sqrt(vx * vx + vy * vy);
            vx /= len;
            vy /= len;
            if (!this.active) {
                this.active = true;
                this.activeType = 'key';
                this.baseX = 140;
                this.baseY = this.canvas.height - 140;
                this.events.onActivate?.('key');
            }
            if (this.activeType === 'key') {
                this.dirX = vx;
                this.dirY = vy;
                this.knobX = this.baseX + vx * this.radius;
                this.knobY = this.baseY + vy * this.radius;
                this.events.onInputChange({ vx, vy });
            }
        }
        else if (this.activeType === 'key') {
            this.deactivate();
        }
    }
}
