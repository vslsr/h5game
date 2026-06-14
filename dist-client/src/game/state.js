import { GAME_CONSTANTS } from '../../shared/types';
export class GameState {
    selfId = null;
    players = new Map();
    obstacles = [];
    bullets = [];
    particles = [];
    // --- 单位与技能 ---
    units = [];
    selectedUnitId = '';
    selectedSkillIndex = 0;
    unitPanelOpen = true;
    lastFrameTime = performance.now();
    lastBulletTime = performance.now();
    init(data) {
        this.selfId = data.selfId;
        this.obstacles = (data.obstacles || []).map((o) => ({ ...o }));
        this.players.clear();
        this.bullets = [];
        this.particles = [];
        // 单位与选择
        this.units = (data.units || []).map((u) => ({
            ...u,
            skills: (u.skills || []).map((s) => ({ ...s }))
        }));
        this.selectedUnitId = data.selectedUnitId || this.units[0]?.unitId || '';
        this.selectedSkillIndex = data.selectedSkillIndex ?? 0;
        for (const p of data.players) {
            const ex = this.players.get(p.id);
            if (ex) {
                ex.targetX = p.x;
                ex.targetY = p.y;
            }
            else {
                this.players.set(p.id, { ...p, targetX: p.x, targetY: p.y });
            }
        }
    }
    addPlayer(p) {
        const ex = this.players.get(p.id);
        if (ex) {
            ex.targetX = p.x;
            ex.targetY = p.y;
            ex.x = p.x;
            ex.y = p.y;
        }
        else {
            this.players.set(p.id, { ...p, targetX: p.x, targetY: p.y });
        }
    }
    removePlayer(id) {
        this.players.delete(id);
    }
    updateTargets(players) {
        for (const p of players) {
            const ex = this.players.get(p.id);
            if (ex) {
                ex.targetX = p.x;
                ex.targetY = p.y;
            }
            else {
                this.players.set(p.id, { ...p, targetX: p.x, targetY: p.y });
            }
        }
    }
    interpolate() {
        for (const p of this.players.values()) {
            p.x += (p.targetX - p.x) * 0.25;
            p.y += (p.targetY - p.y) * 0.25;
        }
    }
    addBullet(bullet) {
        this.bullets.push(bullet);
    }
    updateBullets() {
        const now = performance.now();
        const dt = (now - this.lastFrameTime) / 1000;
        this.lastFrameTime = now;
        if (dt <= 0 || dt > 0.5)
            return;
        const { BULLET_RADIUS, WORLD_BOUND } = GAME_CONSTANTS;
        const nextBullets = [];
        const expireEvents = [];
        for (const b of this.bullets) {
            if (now - b.createdAt > b.lifetimeMs) {
                expireEvents.push(b);
                continue;
            }
            let nx = b.x + b.vx * dt;
            let ny = b.y + b.vy * dt;
            if (Math.abs(nx) > WORLD_BOUND || Math.abs(ny) > WORLD_BOUND) {
                expireEvents.push(b);
                continue;
            }
            let collided = false;
            for (const ob of this.obstacles) {
                const halfSize = ob.size / 2;
                const closestX = Math.max(ob.x - halfSize, Math.min(nx, ob.x + halfSize));
                const closestY = Math.max(ob.y - halfSize, Math.min(ny, ob.y + halfSize));
                const ddx = nx - closestX;
                const ddy = ny - closestY;
                if (ddx * ddx + ddy * ddy < BULLET_RADIUS * BULLET_RADIUS) {
                    collided = true;
                    break;
                }
            }
            if (collided) {
                expireEvents.push({ ...b, x: nx, y: ny });
                continue;
            }
            b.x = nx;
            b.y = ny;
            nextBullets.push(b);
        }
        this.bullets = nextBullets;
        // 生成粒子
        for (const b of expireEvents) {
            this.spawnBulletParticles(b, b.explosive ? 24 : 12);
        }
    }
    spawnBulletParticles(b, count) {
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const dirX = speed > 0 ? b.vx / speed : 0;
        const dirY = speed > 0 ? b.vy / speed : 0;
        for (let i = 0; i < count; i++) {
            const angle = Math.atan2(dirY, dirX) + (Math.random() - 0.5) * (b.explosive ? Math.PI * 2 : Math.PI);
            const vel = (b.explosive ? 160 : 80) + Math.random() * (b.explosive ? 200 : 100);
            this.particles.push({
                x: b.x,
                y: b.y,
                vx: Math.cos(angle) * vel,
                vy: Math.sin(angle) * vel,
                hue: b.ownerHue,
                life: (b.explosive ? 500 : 320) + Math.random() * 200,
                maxLife: b.explosive ? 700 : 500,
                size: 2 + Math.random() * (b.explosive ? 4 : 2.5)
            });
        }
    }
    updateParticles() {
        const now = performance.now();
        const dt = (now - this.lastBulletTime) / 1000;
        this.lastBulletTime = now;
        if (dt <= 0 || dt > 0.5)
            return;
        const remaining = [];
        for (const p of this.particles) {
            p.life -= dt * 1000;
            if (p.life <= 0)
                continue;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vx *= 0.94;
            p.vy *= 0.94;
            remaining.push(p);
        }
        this.particles = remaining;
    }
    getSelf() {
        if (!this.selfId)
            return null;
        return this.players.get(this.selfId) ?? null;
    }
    // 获取当前选中的单位
    getSelectedUnit() {
        if (!this.selectedUnitId)
            return null;
        return this.units.find((u) => u.unitId === this.selectedUnitId) ?? this.units[0] ?? null;
    }
    // 获取当前选中的技能
    getSelectedSkill() {
        const unit = this.getSelectedUnit();
        if (!unit)
            return null;
        return unit.skills[this.selectedSkillIndex] ?? null;
    }
    // 选择单位（客户端触发，发送到服务端）
    selectUnit(unitId) {
        const unit = this.units.find((u) => u.unitId === unitId);
        if (!unit)
            return;
        this.selectedUnitId = unit.unitId;
        this.selectedSkillIndex = 0;
    }
    // 选择技能（客户端触发，发送到服务端）
    selectSkill(index) {
        const unit = this.getSelectedUnit();
        if (!unit)
            return;
        if (index < 0 || index >= unit.skills.length)
            return;
        this.selectedSkillIndex = index;
    }
    // 同步服务端返回的选择
    applySelection(selectedUnitId, selectedSkillIndex) {
        if (selectedUnitId)
            this.selectedUnitId = selectedUnitId;
        this.selectedSkillIndex = selectedSkillIndex;
    }
    updateObstacleHp(payload) {
        const ob = this.obstacles.find((o) => o.id === payload.obstacleId);
        if (!ob)
            return;
        ob.hp = payload.hp;
        ob.maxHp = payload.maxHp;
    }
    removeObstacle(payload) {
        const idx = this.obstacles.findIndex((o) => o.id === payload.obstacleId);
        if (idx !== -1)
            this.obstacles.splice(idx, 1);
    }
}
