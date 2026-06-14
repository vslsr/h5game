import { GAME_CONSTANTS, DEFAULT_PLAYER_UNITS } from '../shared/types';
import { moveWithCollisions } from '../shared/physics';
import { DEFAULT_OBSTACLES } from './obstacles';
const { MAX_SPEED, WORLD_BOUND } = GAME_CONSTANTS;
export class GameRoom {
    id;
    players = new Map();
    obstacles;
    // 每个玩家的可用单位（服务端存放）
    playerUnits = new Map();
    // 每个玩家的选择状态
    playerSelection = new Map();
    // 服务端子弹
    bullets = [];
    lastTickMs = Date.now();
    events;
    constructor(id, events) {
        this.id = id;
        this.events = events;
        this.obstacles = DEFAULT_OBSTACLES.map((o) => ({ ...o }));
        console.log(`[Room] Created: ${id}`);
    }
    createPlayer(id, name) {
        const player = {
            id,
            name: name || `玩家${id.slice(0, 4)}`,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            hue: Math.floor(Math.random() * 360)
        };
        const pos = moveWithCollisions(player.x, player.y, 0, 0, this.obstacles);
        player.x = pos.x;
        player.y = pos.y;
        // 初始化单位列表与选择
        const units = DEFAULT_PLAYER_UNITS.map((u) => ({
            ...u,
            skills: u.skills.map((s) => ({ ...s }))
        }));
        this.playerUnits.set(id, units);
        this.playerSelection.set(id, {
            selectedUnitId: units[0]?.unitId ?? '',
            selectedSkillIndex: 0
        });
        return player;
    }
    addPlayer(player) {
        this.players.set(player.id, player);
    }
    removePlayer(id) {
        this.players.delete(id);
        this.playerUnits.delete(id);
        this.playerSelection.delete(id);
    }
    // 取得玩家的可用单位列表
    getUnits(playerId) {
        return this.playerUnits.get(playerId) ?? [];
    }
    // 获取玩家的当前选择
    getSelection(playerId) {
        return this.playerSelection.get(playerId) ?? null;
    }
    // 获取当前选中的单位
    getSelectedUnit(playerId) {
        const sel = this.playerSelection.get(playerId);
        if (!sel)
            return null;
        const units = this.playerUnits.get(playerId);
        if (!units)
            return null;
        return units.find((u) => u.unitId === sel.selectedUnitId) ?? null;
    }
    // 获取当前选中的技能（基于当前单位）
    getSelectedSkill(playerId) {
        const unit = this.getSelectedUnit(playerId);
        if (!unit)
            return null;
        const sel = this.playerSelection.get(playerId);
        if (!sel)
            return null;
        const skill = unit.skills[sel.selectedSkillIndex];
        return skill ? { skill, unit } : null;
    }
    // 切换单位
    selectUnit(playerId, unitId) {
        const units = this.playerUnits.get(playerId);
        if (!units)
            return false;
        const unit = units.find((u) => u.unitId === unitId);
        if (!unit)
            return false;
        const sel = this.playerSelection.get(playerId);
        if (sel) {
            sel.selectedUnitId = unitId;
            sel.selectedSkillIndex = 0; // 切换单位后重置技能选择
        }
        return true;
    }
    // 切换技能（索引）
    selectSkill(playerId, index) {
        const sel = this.playerSelection.get(playerId);
        if (!sel)
            return false;
        const unit = this.getSelectedUnit(playerId);
        if (!unit)
            return false;
        if (index < 0 || index >= unit.skills.length)
            return false;
        sel.selectedSkillIndex = index;
        return true;
    }
    applyInput(id, input) {
        const player = this.players.get(id);
        if (!player)
            return;
        let { vx, vy } = input;
        const len = Math.sqrt(vx * vx + vy * vy);
        if (len > MAX_SPEED) {
            vx = (vx / len) * MAX_SPEED;
            vy = (vy / len) * MAX_SPEED;
        }
        player.vx = vx;
        player.vy = vy;
    }
    addBullet(bullet) {
        this.bullets.push(bullet);
    }
    tick() {
        const now = Date.now();
        const dt = Math.min(0.1, (now - this.lastTickMs) / 1000);
        this.lastTickMs = now;
        for (const p of this.players.values()) {
            const next = moveWithCollisions(p.x, p.y, p.vx, p.vy, this.obstacles);
            p.x = next.x;
            p.y = next.y;
            if (p.x > WORLD_BOUND)
                p.x = WORLD_BOUND;
            if (p.x < -WORLD_BOUND)
                p.x = -WORLD_BOUND;
            if (p.y > WORLD_BOUND)
                p.y = WORLD_BOUND;
            if (p.y < -WORLD_BOUND)
                p.y = -WORLD_BOUND;
            p.vx = 0;
            p.vy = 0;
        }
        if (this.bullets.length > 0 && dt > 0) {
            const { BULLET_RADIUS, WORLD_BOUND: BULLET_BOUND } = GAME_CONSTANTS;
            const remainingBullets = [];
            for (const b of this.bullets) {
                if (now - b.createdAt > b.lifetimeMs)
                    continue;
                let nx = b.x + b.vx * dt;
                let ny = b.y + b.vy * dt;
                if (Math.abs(nx) > BULLET_BOUND || Math.abs(ny) > BULLET_BOUND)
                    continue;
                let hitObstacle = null;
                for (const ob of this.obstacles) {
                    const halfSize = ob.size / 2;
                    const closestX = Math.max(ob.x - halfSize, Math.min(nx, ob.x + halfSize));
                    const closestY = Math.max(ob.y - halfSize, Math.min(ny, ob.y + halfSize));
                    const ddx = nx - closestX;
                    const ddy = ny - closestY;
                    if (ddx * ddx + ddy * ddy < BULLET_RADIUS * BULLET_RADIUS) {
                        hitObstacle = ob;
                        break;
                    }
                }
                if (hitObstacle) {
                    hitObstacle.hp -= b.damage;
                    // 爆炸：对半径内的其他障碍造成额外伤害
                    if (b.explosive && b.explosionRadius > 0) {
                        const explosionX = nx;
                        const explosionY = ny;
                        const r = b.explosionRadius;
                        for (const ob of this.obstacles) {
                            if (ob.id === hitObstacle.id)
                                continue;
                            const dx = ob.x - explosionX;
                            const dy = ob.y - explosionY;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist <= r) {
                                const falloff = 1 - dist / r;
                                ob.hp -= Math.max(1, Math.round(b.explosionDamage * falloff));
                            }
                        }
                    }
                    // 清理被摧毁的障碍并广播
                    const destroyedIds = [];
                    const updatedHps = [];
                    for (let i = this.obstacles.length - 1; i >= 0; i--) {
                        if (this.obstacles[i].hp <= 0) {
                            destroyedIds.push(this.obstacles[i].id);
                            this.obstacles.splice(i, 1);
                        }
                    }
                    // 处理命中的障碍是否被摧毁并上报
                    if (hitObstacle.hp <= 0) {
                        // 已被上面逻辑移除，直接广播 destroy
                    }
                    else {
                        updatedHps.push({ obstacleId: hitObstacle.id, hp: hitObstacle.hp, maxHp: hitObstacle.maxHp });
                    }
                    // 爆炸造成的其他障碍更新
                    for (const ob of this.obstacles) {
                        if (ob.id !== hitObstacle.id) {
                            // 如果是爆炸范围内（上面已扣血），需要上报其新 hp
                            if (b.explosive && b.explosionRadius > 0) {
                                const dx = ob.x - nx;
                                const dy = ob.y - ny;
                                if (Math.sqrt(dx * dx + dy * dy) <= b.explosionRadius) {
                                    if (ob.hp > 0) {
                                        updatedHps.push({ obstacleId: ob.id, hp: ob.hp, maxHp: ob.maxHp });
                                    }
                                }
                            }
                        }
                    }
                    for (const e of updatedHps)
                        this.events.onObstacleHit(e);
                    for (const id of destroyedIds)
                        this.events.onObstacleDestroyed({ obstacleId: id });
                    continue;
                }
                b.x = nx;
                b.y = ny;
                remainingBullets.push(b);
            }
            this.bullets = remainingBullets;
        }
    }
    getPlayersSnapshot() {
        return Array.from(this.players.values());
    }
}
export class RoomManager {
    rooms = new Map();
    io = null;
    attachIo(io) {
        this.io = io;
    }
    getOrCreate(roomId) {
        if (!this.rooms.has(roomId)) {
            const events = {
                onObstacleHit: (payload) => {
                    if (this.io)
                        this.io.to(roomId).emit('obstacleHit', payload);
                },
                onObstacleDestroyed: (payload) => {
                    if (this.io)
                        this.io.to(roomId).emit('obstacleDestroyed', payload);
                }
            };
            this.rooms.set(roomId, new GameRoom(roomId, events));
        }
        return this.rooms.get(roomId);
    }
    get(roomId) {
        return this.rooms.get(roomId);
    }
    getAll() {
        return Array.from(this.rooms.values());
    }
}
