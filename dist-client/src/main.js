// 前端主入口（技能系统 + 弹射控制器）
// 流程：
//   1. 点击己方单位 → 选中（仅在静止或可操作时）
//   2. 底部技能栏选技能（按 1/2/3 或点击按钮）
//   3. direction 型：按住该单位 → 拖拽 → 松手发射
//      point 型：激活后在地图上点一个目标点 → 立即施放
import { io } from 'socket.io-client';
import { GameState } from './game/state';
import { EventBus } from './game/events';
import { GAME_CONSTANTS, SKILL_DEFS } from '../shared/types';
import { lineOfSight, raycastToFirstHit } from '../shared/physics';
// ---------- Canvas 初始化 ----------
const canvasEl = document.getElementById('gameCanvas');
if (!canvasEl)
    throw new Error('gameCanvas not found');
const canvas = canvasEl;
const ctx = canvas.getContext('2d');
function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);
// ---------- 状态 ----------
const state = new GameState();
// ---------- 相机 ----------
let camX = 0;
let camY = 0;
let camZoom = 1.0;
const CAM_ZOOM_MIN = 0.35;
const CAM_ZOOM_MAX = 3.0;
// userPanning = 用户正在拖拽地图（而非单位），此时停止跟随
let userPanning = false;
function worldToScreen(wx, wy) {
    return {
        x: (wx - camX) * camZoom + window.innerWidth / 2,
        y: (wy - camY) * camZoom + window.innerHeight / 2,
    };
}
function screenToWorld(sx, sy) {
    return {
        x: (sx - window.innerWidth / 2) / camZoom + camX,
        y: (sy - window.innerHeight / 2) / camZoom + camY,
    };
}
// ---------- Socket.IO ----------
// 统一入口：页面资源与 /socket.io 都从同一域名提供。
//   - 本地/局域网：浏览器直接访问 http://127.0.0.1:5173（Vite 自带代理 /socket.io → :3000）
//   - 外网 natapp：先由本地 Nginx 在 8080 监听，/ 转发到 Vite(5173)，/socket.io 转发到 Node(3000)
//     natapp HTTP 隧道指向本地 8080，浏览器访问 http://g2cff3ac.natappfree.cc/ 即可。
const socket = io(location.origin, {
    transports: ['polling', 'websocket'],
    withCredentials: false,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    reconnectionAttempts: Infinity,
    timeout: 10000,
    upgrade: true,
});
showLoading('连接中…');
function showLoading(text) {
    const ld = document.getElementById('loading');
    if (!ld)
        return;
    ld.style.display = 'flex';
    const msg = document.getElementById('loadingMsg');
    if (msg)
        msg.textContent = text;
}
function hideLoading() {
    const ld = document.getElementById('loading');
    if (ld)
        ld.style.display = 'none';
}
socket.on('connect', () => {
    console.log('[socket] connected', socket.id);
    socket.emit('joinRoom', { name: '指挥官' });
    // 保持"连接中…"显示，等 joined 再 hideLoading
});
socket.on('connect_error', (err) => {
    console.error('[socket] connect_error:', err.message);
    showLoading(`连接失败: ${err.message || err.name}（将自动重连）`);
});
socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnect:', reason);
    showLoading(`连接断开: ${reason}（自动重连中…）`);
});
socket.on('reconnect', (attempt) => {
    console.log('[socket] reconnect on attempt', attempt);
    showLoading('连接中…');
});
socket.on('joined', (d) => {
    // 补齐 obstacles（服务器已发送，此处仅为类型兼容）
    const payload = d;
    if (!payload.obstacles)
        payload.obstacles = [];
    state.init(payload);
    hideLoading();
});
socket.on('gameState', (d) => {
    state.updateState(d);
});
// 游戏事件（单位死亡、技能施放等）→ EventBus 广播
socket.on('gameEvent', (evt) => {
    EventBus.emit(evt);
});
// 默认订阅：单位死亡 → 提示
EventBus.on('unitDeath', (evt) => {
    const isMine = state.selfId && evt.ownerId === state.selfId;
    const reasonText = evt.reason === 'outOfBounds' ? '掉出地图' : '被击毁';
    const who = isMine ? `你的 ${evt.name}` : `${evt.name}`;
    showBottomHint(`${who} ${reasonText}！`);
});
// 技能施放事件：本地不做额外处理（CD 通过单位 skills 状态管理）
EventBus.on('skillCast', (_evt) => {
    // 预留后续播放特效
});
const joy = {
    active: false, unitId: null, baseScreenX: 0, baseScreenY: 0, dragX: 0, dragY: 0,
};
const JOY_RADIUS_MAX = 140;
const JOY_RADIUS_MIN_FIRE = 30;
const activePointers = new Map();
// 当前鼠标/触控点的屏幕坐标（用于瞄准圆绘制里的视线提示线）
let lastPointerScreen = null;
// POINT_AIM 模式的附加状态（选中单位 + 技能定义）
let pointAimUnitId = null;
let pointAimSkillId = null;
let mode = 'IDLE';
// pointerdown 时是否点到了己方单位
let primaryStartOnUnit = null;
let primaryStartSelectedSame = false;
// ---------- 小地图 ----------
const minimap = { x: 0, y: 0, w: 0, h: 0 };
function hitMinimapAtScreen(sx, sy) {
    return minimap.w > 0 && sx >= minimap.x && sx <= minimap.x + minimap.w
        && sy >= minimap.y && sy <= minimap.y + minimap.h;
}
// ---------- 命中检测 ----------
function hitMyUnitAtScreen(sx, sy) {
    const { x: wx, y: wy } = screenToWorld(sx, sy);
    let best = null;
    let bestDist = Infinity;
    const hitR = GAME_CONSTANTS.UNIT_RADIUS + 18;
    for (const u of state.units) {
        if (u.ownerId !== state.selfId)
            continue;
        const rp = state.getRenderPos(u.id);
        const ux = rp ? rp.rx : u.x;
        const uy = rp ? rp.ry : u.y;
        const dx = ux - wx;
        const dy = uy - wy;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d <= hitR && d < bestDist) {
            best = u;
            bestDist = d;
        }
    }
    return best;
}
// 检查 pointerdown 事件是否发生在某个非 game/gameui/gamemenu 层 DOM 上
function eventHitsLayer(el, layer) {
    if (!el)
        return false;
    let cur = el;
    while (cur) {
        if (cur.dataset && cur.dataset.layer === layer)
            return true;
        cur = cur.parentElement;
    }
    return false;
}
// 判断一次 pointer 事件是否被 UI 层处理（GameMenu 或 GameUI）
// 在 canvas 的 pointer 中若命中上层 → canvas 不处理
function eventHitsNonGameLayer(targetElem) {
    const el = targetElem;
    return eventHitsLayer(el, 'gamemenu') || eventHitsLayer(el, 'gameui');
}
// ---------- 底部提示 ----------
let hintTimeout = null;
function showBottomHint(text, durationMs = 1800) {
    const root = document.getElementById('bottomHint');
    const textEl = document.getElementById('bottomHintText');
    if (!root || !textEl)
        return;
    textEl.textContent = text;
    root.classList.add('visible');
    if (hintTimeout !== null) {
        window.clearTimeout(hintTimeout);
        hintTimeout = null;
    }
    hintTimeout = window.setTimeout(() => {
        root.classList.remove('visible');
        hintTimeout = null;
    }, durationMs);
}
// ---------- 技能栏（屏幕底部中央） ----------
// 点击/按键切换技能；对选中的单位设置 activeSkillIndex
const SKILL_KEYS = ['1', '2', '3', '4'];
window.addEventListener('keydown', (e) => {
    const idx = SKILL_KEYS.indexOf(e.key);
    if (idx >= 0) {
        const sel = state.getSelectedUnit();
        if (!sel) {
            showBottomHint('请先选中一个单位');
            return;
        }
        if (!sel.skills || idx >= sel.skills.length) {
            showBottomHint('该单位没有这个技能');
            return;
        }
        state.setActiveSkillIndex(sel.id, idx);
        return;
    }
    if (e.key === 'Escape') {
        if (state.getSelectedUnit()) {
            state.selectUnit(null);
            showBottomHint('已取消选中');
        }
    }
});
// ---------- 指针事件（Game 层）----------
canvas.setAttribute('data-layer', 'game');
canvas.addEventListener('pointerdown', (e) => {
    // 事件层检查：若点击在 UI 层（GameUI / GameMenu）上，Game 层不处理
    if (eventHitsNonGameLayer(e.target))
        return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    lastPointerScreen = { sx, sy };
    const rec = {
        id: e.pointerId, sx, sy, startSx: sx, startSy: sy,
        lastSx: sx, lastSy: sy, movedScreenDist: 0,
    };
    activePointers.set(e.pointerId, rec);
    // 小地图命中优先
    if (hitMinimapAtScreen(sx, sy)) {
        if (joy.active) {
            joy.active = false;
            joy.unitId = null;
        }
        // 拖动小地图开始就取消选择，避免镜头持续拉回选中单位
        state.selectUnit(null);
        mode = 'MINIMAP';
        minimapMoveTo(sx, sy);
        return;
    }
    // 双指按下 → PINCH
    if (activePointers.size === 2) {
        if (joy.active) {
            joy.active = false;
            joy.unitId = null;
        }
        mode = 'PINCH';
        userPanning = true;
        pinchStart();
        return;
    }
    // 单指：先判断是否点到单位
    const hit = hitMyUnitAtScreen(sx, sy);
    const selected = state.getSelectedUnit();
    // --- Circle-based point-skill aiming ---
    // When a unit with a point-type active skill is selected and stopped,
    // clicking within the skill's radius circle directly casts the skill at that position.
    // Clicking outside the circle falls through to normal deselect/pan (cancels aim).
    if (selected && !hit) {
        const activeDef = getActiveSkillDef(selected);
        if (activeDef && activeDef.type === 'point' && activeDef.radius && state.isUnitStopped(selected.id)) {
            const rp = state.getRenderPos(selected.id);
            const ux = rp ? rp.rx : selected.x;
            const uy = rp ? rp.ry : selected.y;
            const target = screenToWorld(sx, sy);
            const d = Math.hypot(target.x - ux, target.y - uy);
            // 进入技能范围内按下 → 进入 POINT_AIM 模式（松开时才真正释放）
            if (d <= activeDef.radius && d > GAME_CONSTANTS.UNIT_RADIUS + 4) {
                mode = 'POINT_AIM';
                pointAimUnitId = selected.id;
                pointAimSkillId = activeDef.id;
                userPanning = false;
                return;
            }
            // 圆圈外 → fall through to normal deselect/pan
        }
    }
    if (hit) {
        const isSameSelected = selected !== null && selected.id === hit.id;
        primaryStartOnUnit = hit;
        primaryStartSelectedSame = isSameSelected;
        // 若还没选中这个单位 → 先选中
        if (!isSameSelected) {
            state.selectUnit(hit.id);
            if (!state.isUnitStopped(hit.id)) {
                showBottomHint(`${hit.name} 还在运动中，已选中查看信息`);
            }
        }
        // 进入交互模式：根据当前 active skill 类型决定
        const unit = state.getSelectedUnit();
        if (unit) {
            const activeDef = getActiveSkillDef(unit);
            if (activeDef && activeDef.type === 'direction' && state.isUnitStopped(unit.id)) {
                // direction 型：激活摇杆（拖拽后发射）
                const rp = state.getRenderPos(unit.id);
                const scr = rp ? worldToScreen(rp.rx, rp.ry) : worldToScreen(unit.x, unit.y);
                joy.active = false;
                joy.unitId = unit.id;
                joy.baseScreenX = scr.x;
                joy.baseScreenY = scr.y;
                joy.dragX = scr.x;
                joy.dragY = scr.y;
                mode = 'JOYSTICK';
            }
            else if (activeDef && activeDef.type === 'point') {
                // point 型：不激活摇杆/拖拽，圆圈在渲染层自动显示（由 drawPointSkillAimCircle 处理）
                // 点击圆圈范围内在 pointerdown 上方已处理（见 Circle-based point-skill aiming）
                mode = 'IDLE';
                userPanning = false;
            }
            else {
                // 技能不可用（单位在动）→ 切换为平移（拖拽地图）
                mode = 'PAN';
                userPanning = true;
            }
        }
        else {
            mode = 'PAN';
            userPanning = true;
        }
    }
    else {
        // 空白处：取消选择 → 平移
        primaryStartOnUnit = null;
        primaryStartSelectedSame = false;
        state.selectUnit(null);
        mode = 'PAN';
        userPanning = true;
    }
});
canvas.addEventListener('pointermove', (e) => {
    const rec = activePointers.get(e.pointerId);
    if (!rec)
        return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    lastPointerScreen = { sx, sy };
    const dx = sx - rec.lastSx;
    const dy = sy - rec.lastSy;
    rec.lastSx = sx;
    rec.lastSy = sy;
    rec.sx = sx;
    rec.sy = sy;
    rec.movedScreenDist += Math.sqrt(dx * dx + dy * dy);
    if (mode === 'PINCH' && activePointers.size >= 2) {
        handlePinch(ptsFromPointers(Array.from(activePointers.values()).slice(0, 2)));
        return;
    }
    if (mode === 'JOYSTICK') {
        const movedFromStart = Math.sqrt((sx - rec.startSx) * (sx - rec.startSx) + (sy - rec.startSy) * (sy - rec.startSy));
        // 移动超过一点 → 激活摇杆（让用户看到在拖）
        if (!joy.active && movedFromStart > 5) {
            joy.active = true;
        }
        if (joy.active && joy.unitId) {
            const unit = state.units.find((u) => u.id === joy.unitId);
            if (unit) {
                const rp = state.getRenderPos(unit.id);
                const wx = rp ? rp.rx : unit.x;
                const wy = rp ? rp.ry : unit.y;
                const scr = worldToScreen(wx, wy);
                joy.baseScreenX = scr.x;
                joy.baseScreenY = scr.y;
            }
            let ddx = sx - joy.baseScreenX;
            let ddy = sy - joy.baseScreenY;
            const d = Math.sqrt(ddx * ddx + ddy * ddy);
            if (d > JOY_RADIUS_MAX) {
                ddx = (ddx / d) * JOY_RADIUS_MAX;
                ddy = (ddy / d) * JOY_RADIUS_MAX;
            }
            joy.dragX = joy.baseScreenX + ddx;
            joy.dragY = joy.baseScreenY + ddy;
        }
        return;
    }
    if (mode === 'PAN') {
        camX -= dx / camZoom;
        camY -= dy / camZoom;
        return;
    }
    if (mode === 'MINIMAP') {
        minimapMoveTo(sx, sy);
        return;
    }
});
function ptsFromPointers(recs) {
    return recs.map((r) => ({ sx: r.sx, sy: r.sy }));
}
canvas.addEventListener('pointerup', (e) => onPointerEnd(e, false));
canvas.addEventListener('pointercancel', (e) => onPointerEnd(e, true));
function onPointerEnd(e, cancel) {
    e.preventDefault();
    const rec = activePointers.get(e.pointerId);
    if (rec)
        activePointers.delete(e.pointerId);
    if (mode === 'JOYSTICK') {
        if (joy.active && joy.unitId && !cancel) {
            releaseDirectionSkill();
        }
        else {
            joy.active = false;
            joy.unitId = null;
        }
        mode = 'IDLE';
        userPanning = false;
        return;
    }
    if (mode === 'POINT_AIM') {
        // 释放点型技能：松手才判定（不会被自己阻挡）
        const unit = state.units.find(u => u.id === pointAimUnitId);
        if (unit && pointAimSkillId && lastPointerScreen) {
            const rp = state.getRenderPos(unit.id);
            const ux = rp ? rp.rx : unit.x;
            const uy = rp ? rp.ry : unit.y;
            const target = screenToWorld(lastPointerScreen.sx, lastPointerScreen.sy);
            const dist = Math.hypot(target.x - ux, target.y - uy);
            const activeDef = SKILL_DEFS[pointAimSkillId];
            if (activeDef && activeDef.radius && dist > GAME_CONSTANTS.UNIT_RADIUS + 2 && dist <= activeDef.radius) {
                // 排除施放者自己 → 不被自己阻挡
                const otherUnits = state.units.filter(u => u.id !== unit.id);
                const hasLoS = lineOfSight(ux, uy, target.x, target.y, state.obstacles, otherUnits);
                if (hasLoS) {
                    socket.emit('castSkill', {
                        unitId: unit.id,
                        skillId: activeDef.id,
                        dirX: 0, dirY: 0, charge: 1.0,
                        pointX: target.x, pointY: target.y,
                    });
                }
                else {
                    showBottomHint('视线被阻挡，无法施放');
                }
            }
            else if (activeDef && activeDef.radius && dist > activeDef.radius) {
                showBottomHint('目标不在技能范围内');
            }
        }
        pointAimUnitId = null;
        pointAimSkillId = null;
        mode = 'IDLE';
        userPanning = false;
        return;
    }
    if (mode === 'PAN') {
        userPanning = false;
        mode = 'IDLE';
        return;
    }
    if (mode === 'PINCH') {
        pinchEnd();
        if (activePointers.size === 1) {
            // 回到单指状态，若还按着 → 切换为 PAN（简单处理）
            mode = 'PAN';
            userPanning = true;
        }
        else {
            mode = 'IDLE';
            userPanning = false;
        }
        return;
    }
    if (mode === 'MINIMAP') {
        // 拖动小地图结束后，取消单位选择
        state.selectUnit(null);
        mode = 'IDLE';
        userPanning = false;
        return;
    }
}
function getActiveSkillDef(unit) {
    const slot = unit.skills?.[unit.activeSkillIndex ?? 0];
    if (!slot)
        return null;
    return SKILL_DEFS[slot.defId] || null;
}
function releaseDirectionSkill() {
    if (!joy.active || !joy.unitId)
        return;
    const dx = joy.dragX - joy.baseScreenX;
    const dy = joy.dragY - joy.baseScreenY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const unit = state.units.find((u) => u.id === joy.unitId);
    if (dist >= JOY_RADIUS_MIN_FIRE && unit) {
        const activeDef = getActiveSkillDef(unit);
        const charge = Math.min(1.0, dist / JOY_RADIUS_MAX);
        const dirX = -dx / dist; // 弹弓式：与拖拽方向相反
        const dirY = -dy / dist;
        const defId = activeDef?.id || 'basic_shot';
        const mult = activeDef?.chargeMultiplier || 1.0;
        // 生命成本
        const hpCost = activeDef?.hpCostPct ? unit.hpMax * activeDef.hpCostPct : 0;
        if (unit.hp - hpCost <= 0) {
            showBottomHint('生命值不足，无法施放');
            joy.active = false;
            joy.unitId = null;
            return;
        }
        socket.emit('castSkill', {
            unitId: unit.id,
            skillId: defId,
            dirX, dirY, charge,
        });
        // 客户端预测（direction 型）：立即为该单位设置预测速度
        const speed = (unit.baseSpeed * Math.max(0.2, Math.min(1.0, charge)) * mult) / unit.mass;
        state.predictFire(unit.id, dirX, dirY, speed);
    }
    joy.active = false;
    joy.unitId = null;
}
let pinchState = null;
function pinchStart() {
    pinchState = null;
}
function handlePinch(pts) {
    if (pts.length < 2)
        return;
    const [a, b] = pts;
    const midSx = (a.sx + b.sx) / 2;
    const midSy = (a.sy + b.sy) / 2;
    const dist = Math.sqrt((a.sx - b.sx) * (a.sx - b.sx) + (a.sy - b.sy) * (a.sy - b.sy));
    if (!pinchState) {
        pinchState = {
            startDist: dist, startMidSx: midSx, startMidSy: midSy,
            startCamX: camX, startCamY: camY, startZoom: camZoom,
            lastMidSx: midSx, lastMidSy: midSy,
        };
        return;
    }
    // 以初始双指中点为锚点缩放
    const ratio = pinchState.startDist > 1 ? dist / pinchState.startDist : 1;
    let newZoom = pinchState.startZoom * ratio;
    newZoom = Math.max(CAM_ZOOM_MIN, Math.min(CAM_ZOOM_MAX, newZoom));
    const width = window.innerWidth;
    const height = window.innerHeight;
    const anchor = screenToWorldRaw(pinchState.startMidSx, pinchState.startMidSy, pinchState.startCamX, pinchState.startCamY, pinchState.startZoom, width, height);
    camZoom = newZoom;
    camX = anchor.x - (pinchState.startMidSx - width / 2) / camZoom;
    camY = anchor.y - (pinchState.startMidSy - height / 2) / camZoom;
    // 平移：中点移动量反向
    const ddx = midSx - pinchState.lastMidSx;
    const ddy = midSy - pinchState.lastMidSy;
    if (Math.abs(ddx) > 0.5 || Math.abs(ddy) > 0.5) {
        camX -= ddx / camZoom;
        camY -= ddy / camZoom;
    }
    pinchState.lastMidSx = midSx;
    pinchState.lastMidSy = midSy;
}
function pinchEnd() {
    pinchState = null;
}
function screenToWorldRaw(sx, sy, cX, cY, cZ, w, h) {
    return {
        x: (sx - w / 2) / cZ + cX,
        y: (sy - h / 2) / cZ + cY,
    };
}
// ---------- 小地图移动 ----------
function minimapMoveTo(sx, sy) {
    if (minimap.w === 0)
        return;
    const W = GAME_CONSTANTS.WORLD_BOUND;
    const tX = (sx - minimap.x) / minimap.w;
    const tY = (sy - minimap.y) / minimap.h;
    camX = -W + tX * (2 * W);
    camY = -W + tY * (2 * W);
}
// ---------- 渲染 ----------
function drawWorldBounds() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const W = GAME_CONSTANTS.WORLD_BOUND;
    // 1) 地图外：云朵（世界坐标散布）
    drawClouds();
    ctx.save();
    const topLeft = worldToScreen(-W, -W);
    const botRight = worldToScreen(W, W);
    // 2) 地图内部暗色
    ctx.fillStyle = 'rgb(12, 22, 40)';
    ctx.fillRect(topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);
    // 3) 边界线
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);
    ctx.strokeStyle = 'rgba(120, 160, 220, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    ctx.strokeRect(topLeft.x + 10, topLeft.y + 10, botRight.x - topLeft.x - 20, botRight.y - topLeft.y - 20);
    ctx.setLineDash([]);
    ctx.restore();
}
function drawClouds() {
    // 地图外部使用纯奶白色（替换云朵效果），内部由 drawWorldBounds 重新覆盖成暗色
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.save();
    ctx.fillStyle = '#FFF8E7';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
}
function drawGrid() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const step = 64 * camZoom;
    if (step < 12)
        return;
    ctx.save();
    ctx.strokeStyle = 'rgba(80, 120, 180, 0.18)';
    ctx.lineWidth = 1;
    const center = worldToScreen(0, 0);
    const startX = center.x - Math.floor(center.x / step) * step;
    const startY = center.y - Math.floor(center.y / step) * step;
    for (let x = startX; x <= width + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = startY; y <= height + step; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    ctx.restore();
}
function drawObstacles() {
    ctx.save();
    for (const ob of state.obstacles) {
        const { x, y } = worldToScreen(ob.x, ob.y);
        const size = ob.size * camZoom;
        if (size < 2)
            continue;
        ctx.fillStyle = 'rgba(120, 90, 70, 0.85)';
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
        ctx.strokeStyle = 'rgba(200, 170, 130, 0.7)';
        ctx.lineWidth = 2;
        ctx.strokeRect(x - size / 2, y - size / 2, size, size);
    }
    ctx.restore();
}
function drawUnits() {
    const selectedId = state.selectedUnitId;
    const myId = state.selfId;
    for (const u of state.units) {
        const rp = state.getRenderPos(u.id);
        const wx = rp ? rp.rx : u.x;
        const wy = rp ? rp.ry : u.y;
        const { x, y } = worldToScreen(wx, wy);
        const r = GAME_CONSTANTS.UNIT_RADIUS * camZoom;
        const isMine = u.ownerId === myId;
        const isSelected = u.id === selectedId;
        const canControl = isMine && state.isUnitStopped(u.id);
        // 外圈
        if (isSelected) {
            ctx.save();
            if (canControl) {
                ctx.strokeStyle = `hsla(${u.hue}, 95%, 78%, 1)`;
                ctx.lineWidth = 3;
                ctx.setLineDash([6, 4]);
            }
            else {
                ctx.strokeStyle = `hsla(${u.hue}, 20%, 55%, 0.55)`;
                ctx.lineWidth = 2;
                ctx.setLineDash([5, 4]);
            }
            ctx.beginPath();
            ctx.arc(x, y, r + 10 * camZoom, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        else if (isMine) {
            ctx.save();
            ctx.strokeStyle = canControl ? 'rgba(220, 240, 255, 0.55)' : 'rgba(140, 170, 200, 0.25)';
            ctx.lineWidth = canControl ? 1.5 : 1;
            ctx.beginPath();
            ctx.arc(x, y, r + 6 * camZoom, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        // 主圆
        ctx.save();
        ctx.fillStyle = isMine
            ? `hsla(${u.hue}, 75%, 60%, 0.95)`
            : `hsla(${u.hue}, 60%, 45%, 0.85)`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = `hsla(${u.hue}, 85%, 75%, 0.95)`;
        ctx.lineWidth = 2;
        ctx.stroke();
        // 图标
        const iconSize = Math.max(10, 18 * camZoom);
        ctx.font = `${iconSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(u.icon, x, y);
        if (camZoom > 0.55) {
            ctx.fillStyle = 'rgba(230, 240, 255, 0.85)';
            ctx.font = `${Math.max(9, 11 * camZoom)}px sans-serif`;
            ctx.fillText(u.name, x, y + r + 14 * camZoom);
        }
        // 血条（选中或受伤时显示）
        if (isSelected || state.wasRecentlyDamaged(u.id)) {
            const barW = r * 2.2;
            const barH = Math.max(3, 5 * camZoom);
            const barX = x - barW / 2;
            const barY = y - r - Math.max(6, 12 * camZoom);
            const hpRatio = Math.max(0, Math.min(1, u.hp / Math.max(1, u.hpMax)));
            ctx.fillStyle = 'rgba(20, 25, 40, 0.85)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            const barColor = hpRatio > 0.6 ? 'rgba(90, 220, 110, 0.95)'
                : hpRatio > 0.3 ? 'rgba(255, 200, 70, 0.95)'
                    : 'rgba(235, 70, 70, 0.95)';
            ctx.fillStyle = barColor;
            ctx.fillRect(barX, barY, barW * hpRatio, barH);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
        }
        const flash = state.getDamageFlashAlpha(u.id);
        if (flash > 0.02) {
            ctx.fillStyle = `rgba(255, 70, 70, ${flash})`;
            ctx.beginPath();
            ctx.arc(x, y, r + 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}
function drawJoystick() {
    if (!joy.active || !joy.unitId)
        return;
    const unit = state.units.find((u) => u.id === joy.unitId);
    if (!unit)
        return;
    const rp = state.getRenderPos(unit.id);
    const wx = rp ? rp.rx : unit.x;
    const wy = rp ? rp.ry : unit.y;
    const scr = worldToScreen(wx, wy);
    joy.baseScreenX = scr.x;
    joy.baseScreenY = scr.y;
    const cx = joy.baseScreenX;
    const cy = joy.baseScreenY;
    const dx = joy.dragX - cx;
    const dy = joy.dragY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsla(${unit.hue}, 80%, 70%, 0.55)`;
    ctx.beginPath();
    ctx.arc(cx, cy, JOY_RADIUS_MAX, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `hsla(${unit.hue}, 70%, 65%, 0.25)`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, JOY_RADIUS_MAX * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `hsla(${unit.hue}, 70%, 65%, 0.25)`;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = `hsla(${unit.hue}, 90%, 80%, 0.95)`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(joy.dragX, joy.dragY, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `hsla(${unit.hue}, 80%, 70%, 0.55)`;
    ctx.beginPath();
    ctx.arc(joy.dragX, joy.dragY, 16, 0, Math.PI * 2);
    ctx.fill();
    // 方向箭头：指向拖拽的反方向（单位飞出方向）
    const adist = Math.sqrt(dx * dx + dy * dy);
    if (adist > 1) {
        const nx = -dx / adist;
        const ny = -dy / adist;
        const arrowLen = Math.min(adist * 1.1, 120);
        const ex = cx + nx * arrowLen;
        const ey = cy + ny * arrowLen;
        ctx.strokeStyle = `hsla(${unit.hue}, 95%, 75%, 0.95)`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        const ah = 12;
        const apx = -ny;
        const apy = nx;
        ctx.fillStyle = `hsla(${unit.hue}, 95%, 75%, 0.95)`;
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex - nx * ah + apx * ah * 0.6, ey - ny * ah + apy * ah * 0.6);
        ctx.lineTo(ex - nx * ah - apx * ah * 0.6, ey - ny * ah - apy * ah * 0.6);
        ctx.closePath();
        ctx.fill();
    }
    if (dist < JOY_RADIUS_MIN_FIRE) {
        ctx.fillStyle = 'rgba(255, 230, 150, 0.9)';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('向外拖拽以发射', cx, cy - JOY_RADIUS_MAX - 8);
    }
    ctx.restore();
}
// ---------- HUD（属性面板 + 技能栏） ----------
function drawHUD() {
    const width = window.innerWidth;
    const sel = state.getSelectedUnit();
    ctx.save();
    // 左上角：选中单位属性
    if (sel) {
        const boxW = 240;
        const boxH = 150;
        ctx.fillStyle = 'rgba(10, 18, 32, 0.85)';
        ctx.strokeStyle = `hsla(${sel.hue}, 70%, 65%, 0.7)`;
        ctx.lineWidth = 2;
        ctx.fillRect(16, 16, boxW, boxH);
        ctx.strokeRect(16, 16, boxW, boxH);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(`${sel.icon} ${sel.name}`, 28, 26);
        const activeDef = getActiveSkillDef(sel);
        const activeName = activeDef ? activeDef.name : '弹射';
        ctx.fillStyle = 'rgba(220, 230, 255, 0.85)';
        ctx.font = '12px sans-serif';
        ctx.fillText(`当前技能：${activeName}`, 28, 50);
        const lines = [
            ['生命值', `${Math.round(sel.hp)} / ${sel.hpMax}`],
            ['攻击力', `${sel.attack}`],
            ['质量', `${sel.mass.toFixed(1)}`],
            ['基础速度', `${sel.baseSpeed}`],
            ['状态', state.isUnitStopped(sel.id) ? '可发射' : '运动中…'],
        ];
        for (let i = 0; i < lines.length; i++) {
            ctx.fillStyle = 'rgba(200, 220, 255, 0.8)';
            ctx.fillText(lines[i][0], 28, 70 + i * 14);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.textAlign = 'right';
            ctx.fillText(lines[i][1], 16 + boxW - 20, 70 + i * 14);
            ctx.textAlign = 'left';
        }
        const barX = 28, barY = 16 + boxH - 20;
        const barW = boxW - 40, barH = 8;
        ctx.fillStyle = 'rgba(20, 25, 40, 0.9)';
        ctx.fillRect(barX, barY, barW, barH);
        const hpRatio = Math.max(0, Math.min(1, sel.hp / Math.max(1, sel.hpMax)));
        ctx.fillStyle = hpRatio > 0.6 ? 'rgba(90, 220, 110, 0.95)'
            : hpRatio > 0.3 ? 'rgba(255, 200, 70, 0.95)'
                : 'rgba(235, 70, 70, 0.95)';
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);
    }
    ctx.fillStyle = 'rgba(120, 200, 150, 0.95)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(`在线 ${state.players.length} 人  单位 ${state.units.length}  缩放 ${camZoom.toFixed(2)}×`, width - 16, 16);
    ctx.restore();
}
// ---------- Point-skill range circle (with obstacle occlusion) ----------
// Shows a circle around the selected unit when using a point-type skill.
// Obstacles occlude parts of the circle (drawing only visible arcs).
function drawPointSkillAimCircle() {
    const sel = state.getSelectedUnit();
    if (!sel)
        return;
    const activeDef = getActiveSkillDef(sel);
    if (!activeDef || activeDef.type !== 'point')
        return;
    if (!activeDef.radius)
        return;
    if (!state.isUnitStopped(sel.id))
        return;
    const rp = state.getRenderPos(sel.id);
    const ux = rp ? rp.rx : sel.x;
    const uy = rp ? rp.ry : sel.y;
    const { x: screenX, y: screenY } = worldToScreen(ux, uy);
    const rScreen = activeDef.radius * camZoom;
    // --- compute occluded angular intervals (angles in [-PI, PI]) ---
    // Each obstacle produces one angular interval; split on wrap-around.
    const occluded = [];
    for (const ob of state.obstacles) {
        const half = ob.size / 2;
        const d = Math.hypot(ob.x - ux, ob.y - uy);
        // ignore obstacles far outside the circle
        if (d > activeDef.radius + half * 1.5)
            continue;
        if (d < 1)
            continue;
        // compute angles from unit to each corner
        const corners = [
            { x: ob.x - half, y: ob.y - half },
            { x: ob.x + half, y: ob.y - half },
            { x: ob.x - half, y: ob.y + half },
            { x: ob.x + half, y: ob.y + half },
        ];
        const ang = corners.map(c => Math.atan2(c.y - uy, c.x - ux));
        let minA = Math.min(...ang);
        let maxA = Math.max(...ang);
        if (maxA - minA > Math.PI) {
            // occlusion wraps around -PI/+PI; split into two intervals
            occluded.push([maxA, Math.PI]);
            occluded.push([-Math.PI, minA]);
        }
        else {
            occluded.push([minA, maxA]);
        }
    }
    // --- subtract occluded from full circle [-PI, PI] to get visible arcs ---
    let visible = [[-Math.PI, Math.PI]];
    for (const occ of occluded) {
        const nextVisible = [];
        for (const vis of visible) {
            // no overlap
            if (occ[1] <= vis[0] || occ[0] >= vis[1]) {
                nextVisible.push(vis);
                continue;
            }
            // full occlusion
            if (occ[0] <= vis[0] && occ[1] >= vis[1])
                continue;
            // left occlusion of vis
            if (occ[0] <= vis[0] && occ[1] < vis[1]) {
                nextVisible.push([occ[1], vis[1]]);
                continue;
            }
            // right occlusion of vis
            if (occ[0] > vis[0] && occ[1] >= vis[1]) {
                nextVisible.push([vis[0], occ[0]]);
                continue;
            }
            // occlusion in the middle of vis
            nextVisible.push([vis[0], occ[0]]);
            nextVisible.push([occ[1], vis[1]]);
        }
        visible = nextVisible;
    }
    ctx.save();
    // draw occluded arcs (dashed, faint) to indicate blocked areas
    if (occluded.length > 0) {
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(150, 170, 200, 0.35)';
        ctx.beginPath();
        const merged = occluded;
        for (const arc of merged) {
            ctx.arc(screenX, screenY, rScreen, arc[0], arc[1]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
    }
    // draw visible arcs (bright, using unit's hue)
    ctx.lineWidth = 3;
    ctx.strokeStyle = `hsla(${sel.hue}, 80%, 68%, 0.9)`;
    ctx.beginPath();
    for (const arc of visible) {
        ctx.arc(screenX, screenY, rScreen, arc[0], arc[1]);
    }
    ctx.stroke();
    // subtle fill inside the visible portion of the circle
    ctx.fillStyle = `hsla(${sel.hue}, 60%, 50%, 0.06)`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, rScreen, 0, Math.PI * 2);
    ctx.fill();
    // center ring (small ring around unit)
    ctx.lineWidth = 2;
    ctx.strokeStyle = `hsla(${sel.hue}, 75%, 65%, 0.65)`;
    ctx.beginPath();
    ctx.arc(screenX, screenY, Math.max(6, (GAME_CONSTANTS.UNIT_RADIUS + 5) * camZoom), 0, Math.PI * 2);
    ctx.stroke();
    // 视线提示线：从单位到当前鼠标位置
    // - 畅通：单位→鼠标整条画明亮色（实线 + 末端小圆）
    // - 被阻挡：单位→第一个碰撞点画红色实线（末端红色方块标记）；后面的线不绘制
    if (lastPointerScreen) {
        const pw = (lastPointerScreen.sx - window.innerWidth / 2) / camZoom + camX;
        const ph = (lastPointerScreen.sy - window.innerHeight / 2) / camZoom + camY;
        const dx = pw - ux;
        const dy = ph - uy;
        const dist = Math.hypot(dx, dy);
        if (dist > GAME_CONSTANTS.UNIT_RADIUS + 2 && dist <= activeDef.radius) {
            const otherUnits = state.units.filter(u => u.id !== sel.id);
            const hit = raycastToFirstHit(ux, uy, pw, ph, state.obstacles, otherUnits);
            const startP = { x: screenX, y: screenY };
            if (hit) {
                // 被阻挡：只画到第一个碰撞点（红色）
                const hp = worldToScreen(hit.x, hit.y);
                ctx.save();
                ctx.lineWidth = 3;
                ctx.strokeStyle = 'rgba(240, 60, 70, 0.95)';
                ctx.beginPath();
                ctx.moveTo(startP.x, startP.y);
                ctx.lineTo(hp.x, hp.y);
                ctx.stroke();
                // 末端红色方块标记（表示被墙挡住）
                ctx.fillStyle = 'rgba(240, 60, 70, 0.95)';
                const mark = Math.max(6, 8 * camZoom);
                ctx.fillRect(hp.x - mark / 2, hp.y - mark / 2, mark, mark);
                // 从碰撞点到鼠标位置再画一条极浅的虚线段，帮助定位
                const mouseP = worldToScreen(pw, ph);
                ctx.strokeStyle = 'rgba(255, 120, 120, 0.35)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 6]);
                ctx.beginPath();
                ctx.moveTo(hp.x, hp.y);
                ctx.lineTo(mouseP.x, mouseP.y);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
            else {
                // 畅通：画整条明亮线
                const endP = worldToScreen(pw, ph);
                ctx.save();
                ctx.lineWidth = 3;
                ctx.strokeStyle = `hsla(${sel.hue}, 85%, 70%, 0.9)`;
                ctx.beginPath();
                ctx.moveTo(startP.x, startP.y);
                ctx.lineTo(endP.x, endP.y);
                ctx.stroke();
                // 末端小圆
                ctx.fillStyle = `hsla(${sel.hue}, 85%, 65%, 0.35)`;
                ctx.beginPath();
                ctx.arc(endP.x, endP.y, Math.max(4, 6 * camZoom), 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = `hsla(${sel.hue}, 85%, 70%, 0.95)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(endP.x, endP.y, Math.max(4, 6 * camZoom), 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
        }
    }
    ctx.restore();
}
// ---------- 技能栏（屏幕底部中央 DOM 渲染） ----------
// 渲染逻辑：主循环每一帧根据当前选中单位更新 DOM 按钮状态
function ensureSkillBar() {
    let el = document.getElementById('skillBar');
    if (el)
        return el;
    el = document.createElement('div');
    el.id = 'skillBar';
    el.setAttribute('data-layer', 'gameui');
    el.style.position = 'absolute';
    el.style.bottom = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.display = 'flex';
    el.style.gap = '12px';
    el.style.zIndex = '5';
    document.body.appendChild(el);
    return el;
}
// ---------- 技能说明气泡 ----------
let skillTooltipEl = null;
let activeTooltipIndex = null;
function ensureSkillTooltip() {
    if (skillTooltipEl)
        return skillTooltipEl;
    skillTooltipEl = document.createElement('div');
    skillTooltipEl.id = 'skillTooltip';
    skillTooltipEl.setAttribute('data-layer', 'gamemenu');
    skillTooltipEl.style.position = 'absolute';
    skillTooltipEl.style.display = 'none';
    skillTooltipEl.style.maxWidth = '280px';
    skillTooltipEl.style.minWidth = '180px';
    skillTooltipEl.style.padding = '12px 14px';
    skillTooltipEl.style.borderRadius = '10px';
    skillTooltipEl.style.background = 'rgba(10, 18, 32, 0.95)';
    skillTooltipEl.style.color = '#fff';
    skillTooltipEl.style.fontFamily = 'sans-serif';
    skillTooltipEl.style.fontSize = '13px';
    skillTooltipEl.style.lineHeight = '1.5';
    skillTooltipEl.style.border = '1px solid rgba(120, 160, 220, 0.5)';
    skillTooltipEl.style.boxShadow = '0 6px 20px rgba(0, 0, 0, 0.5)';
    skillTooltipEl.style.zIndex = '15';
    skillTooltipEl.style.pointerEvents = 'auto';
    document.body.appendChild(skillTooltipEl);
    // 点击外部关闭（挂在 document 上；stopPropagation 会阻止点击 i 时触发关闭）
    window.addEventListener('pointerdown', (e) => {
        if (!skillTooltipEl)
            return;
        if (skillTooltipEl.style.display === 'none')
            return;
        // 如果点击在气泡或任意 .skill-info 上 → 不关闭
        const target = e.target;
        if (!target)
            return;
        if (skillTooltipEl.contains(target))
            return;
        if (target.classList?.contains?.('skill-info'))
            return;
        hideSkillTooltip();
    });
    return skillTooltipEl;
}
function buildSkillTooltipHTML(def, cdMs) {
    const typeText = def.type === 'direction' ? '方向型（拖拽发射）' : '点型（点击目标位置施放）';
    const cdText = def.cooldownMs > 0 ? `${(def.cooldownMs / 1000).toFixed(1)}s` : '无';
    const lines = [];
    lines.push(`<div style="font-weight:700;font-size:15px;margin-bottom:4px">${def.icon} ${def.name}</div>`);
    lines.push(`<div style="font-size:11px;color:rgba(200,220,255,0.55);margin-bottom:8px">类型：${typeText} · 冷却：${cdText}</div>`);
    lines.push(`<div style="color:rgba(230,240,255,0.9)">${def.description || '（无说明）'}</div>`);
    const extras = [];
    if (typeof def.chargeMultiplier === 'number' && def.chargeMultiplier !== 1) {
        extras.push(`发射速度 ×${def.chargeMultiplier.toFixed(1)}`);
    }
    if (def.hpCostPct && def.hpCostPct > 0) {
        extras.push(`消耗 ${Math.round(def.hpCostPct * 100)}% 生命`);
    }
    if (typeof def.damage === 'number')
        extras.push(`基础伤害 ${def.damage}`);
    if (typeof def.radius === 'number')
        extras.push(`作用半径 ${def.radius}`);
    if (extras.length > 0) {
        lines.push(`<div style="margin-top:8px;font-size:12px;color:rgba(180,210,255,0.8)">${extras.join(' · ')}</div>`);
    }
    if (cdMs > 100) {
        lines.push(`<div style="margin-top:8px;font-size:11px;color:rgba(255,200,120,0.85)">冷却中：${(cdMs / 1000).toFixed(1)}s</div>`);
    }
    return lines.join('');
}
function toggleSkillTooltip(index, anchor) {
    const sel = state.getSelectedUnit();
    if (!sel || !sel.skills || sel.skills[index] === undefined)
        return;
    const slot = sel.skills[index];
    const def = SKILL_DEFS[slot.defId];
    if (!def)
        return;
    const bubble = ensureSkillTooltip();
    // 如果当前已显示同一个 → 关闭
    if (activeTooltipIndex === index && bubble.style.display !== 'none') {
        hideSkillTooltip();
        return;
    }
    const cdMs = Math.max(0, slot.readyAtTs - Date.now());
    bubble.innerHTML = buildSkillTooltipHTML(def, cdMs);
    bubble.style.display = 'block';
    // 定位：以按钮 i 标记为锚点，气泡出现在按钮上方中央
    const anchorRect = anchor.getBoundingClientRect();
    const bubbleRect = bubble.getBoundingClientRect();
    const bubbleWidth = bubbleRect.width || 240;
    const bubbleHeight = bubbleRect.height || 100;
    let left = anchorRect.left + anchorRect.width / 2 - bubbleWidth / 2;
    let top = anchorRect.top - bubbleHeight - 10;
    // 防止出屏
    const margin = 10;
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    if (left < margin)
        left = margin;
    if (left + bubbleWidth > screenW - margin)
        left = screenW - margin - bubbleWidth;
    if (top < margin) {
        // 上方空间不足，显示在下方
        top = anchorRect.bottom + 10;
        if (top + bubbleHeight > screenH - margin)
            top = Math.max(margin, screenH - margin - bubbleHeight);
    }
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    activeTooltipIndex = index;
}
function hideSkillTooltip() {
    if (!skillTooltipEl)
        return;
    skillTooltipEl.style.display = 'none';
    activeTooltipIndex = null;
}
function renderSkillBarDOM() {
    const bar = ensureSkillBar();
    const sel = state.getSelectedUnit();
    if (!sel || !sel.skills || sel.skills.length === 0) {
        bar.style.display = 'none';
        hideSkillTooltip();
        return;
    }
    bar.style.display = 'flex';
    const now = Date.now();
    const needed = sel.skills.length;
    // 确保 DOM 按钮数量一致。
    // 注意：按钮 event handler 不通过闭包捕获 sel，而是动态从 state 读取，
    // 这样切换选中单位时不会指向旧单位。
    while (bar.childElementCount < needed) {
        const btn = document.createElement('button');
        btn.className = 'skill-btn';
        btn.setAttribute('data-layer', 'gameui');
        btn.style.position = 'relative';
        btn.style.padding = '10px 16px';
        btn.style.borderRadius = '10px';
        btn.style.border = '2px solid rgba(100, 140, 200, 0.6)';
        btn.style.background = 'rgba(14, 24, 40, 0.88)';
        btn.style.color = '#fff';
        btn.style.fontSize = '13px';
        btn.style.cursor = 'pointer';
        btn.style.minWidth = '120px';
        btn.style.fontFamily = 'sans-serif';
        btn.style.transition = 'border-color 0.15s, background 0.15s, transform 0.1s';
        btn.onpointerdown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const idx = Number(btn.dataset.skillIndex);
            if (Number.isNaN(idx))
                return;
            const current = state.getSelectedUnit();
            if (!current || !current.skills || idx >= current.skills.length)
                return;
            state.setActiveSkillIndex(current.id, idx);
        };
        // 右上角小 i 信息标记
        const infoDot = document.createElement('span');
        infoDot.className = 'skill-info';
        infoDot.textContent = 'i';
        infoDot.setAttribute('data-layer', 'gamemenu');
        infoDot.style.position = 'absolute';
        infoDot.style.top = '-5px';
        infoDot.style.right = '-5px';
        infoDot.style.width = '18px';
        infoDot.style.height = '18px';
        infoDot.style.borderRadius = '50%';
        infoDot.style.background = 'rgba(100, 140, 200, 0.9)';
        infoDot.style.color = '#fff';
        infoDot.style.fontSize = '11px';
        infoDot.style.fontWeight = 'bold';
        infoDot.style.fontStyle = 'italic';
        infoDot.style.fontFamily = 'Georgia, serif';
        infoDot.style.display = 'flex';
        infoDot.style.alignItems = 'center';
        infoDot.style.justifyContent = 'center';
        infoDot.style.cursor = 'pointer';
        infoDot.style.border = '1px solid rgba(255, 255, 255, 0.5)';
        infoDot.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.4)';
        infoDot.style.zIndex = '2';
        infoDot.onpointerdown = (e) => {
            e.stopPropagation();
            e.preventDefault();
            const idx = Number(btn.dataset.skillIndex);
            if (Number.isNaN(idx))
                return;
            toggleSkillTooltip(idx, infoDot);
        };
        btn.appendChild(infoDot);
        bar.appendChild(btn);
    }
    while (bar.childElementCount > needed) {
        bar.removeChild(bar.lastChild);
    }
    for (let i = 0; i < needed; i++) {
        const btn = bar.children[i];
        const slot = sel.skills[i];
        const def = SKILL_DEFS[slot.defId];
        const name = def?.name || slot.defId;
        const icon = def?.icon || '●';
        const active = (sel.activeSkillIndex ?? 0) === i;
        const cdMs = Math.max(0, slot.readyAtTs - now);
        const cdRatio = def?.cooldownMs ? Math.min(1, cdMs / def.cooldownMs) : 0;
        btn.dataset.skillIndex = String(i);
        // 标题 + 图标
        const infoDot = btn.querySelector('.skill-info');
        btn.innerHTML = `
      <div style="font-size:18px;line-height:1.1">${icon}</div>
      <div style="font-size:12px;margin-top:2px">${name}</div>
      <div style="font-size:10px;color:rgba(200,220,255,0.5);margin-top:2px">[${i + 1}]</div>
    `;
        // re-append infoDot（innerHTML 会替换子节点，但 handler 已绑在元素本身上，所以保留 DOM 节点）
        if (infoDot)
            btn.appendChild(infoDot);
        btn.title = `${name} — ${def?.description || ''}`;
        if (active) {
            btn.style.borderColor = `hsl(${sel.hue}, 85%, 70%)`;
            btn.style.background = `hsla(${sel.hue}, 60%, 40%, 0.88)`;
            btn.style.transform = 'translateY(-3px)';
        }
        else {
            btn.style.borderColor = 'rgba(100, 140, 200, 0.6)';
            btn.style.background = 'rgba(14, 24, 40, 0.88)';
            btn.style.transform = 'none';
        }
        // 冷却覆盖
        let overlay = btn.querySelector('.cd-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'cd-overlay';
            overlay.setAttribute('data-layer', 'gameui');
            overlay.style.position = 'absolute';
            overlay.style.left = '0';
            overlay.style.right = '0';
            overlay.style.bottom = '0';
            overlay.style.background = 'rgba(0, 0, 0, 0.55)';
            overlay.style.color = '#fff';
            overlay.style.fontSize = '11px';
            overlay.style.pointerEvents = 'none';
            overlay.style.textAlign = 'center';
            overlay.style.borderRadius = '0 0 10px 10px';
            btn.appendChild(overlay);
        }
        if (cdMs > 50) {
            overlay.style.height = `${Math.max(8, cdRatio * 100)}%`;
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';
            overlay.textContent = `${(cdMs / 1000).toFixed(1)}s`;
        }
        else {
            overlay.style.height = '0';
            overlay.textContent = '';
        }
    }
}
// ---------- 小地图 ----------
function drawMinimap() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const mmW = Math.min(220, width * 0.32);
    const mmH = mmW * 0.65;
    const pad = 16;
    minimap.x = width - mmW - pad;
    minimap.y = height - mmH - pad;
    minimap.w = mmW;
    minimap.h = mmH;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 18, 32, 0.88)';
    ctx.fillRect(minimap.x, minimap.y, mmW, mmH);
    ctx.strokeStyle = 'rgba(150, 180, 220, 0.45)';
    ctx.lineWidth = 1;
    ctx.strokeRect(minimap.x, minimap.y, mmW, mmH);
    const W = GAME_CONSTANTS.WORLD_BOUND;
    const toMMx = (wx) => minimap.x + ((wx - (-W)) / (2 * W)) * mmW;
    const toMMy = (wy) => minimap.y + ((wy - (-W)) / (2 * W)) * mmH;
    for (const ob of state.obstacles) {
        const mx = toMMx(ob.x);
        const my = toMMy(ob.y);
        const mSize = Math.max(2, (ob.size / (2 * W)) * mmW);
        ctx.fillStyle = 'rgba(120, 90, 70, 0.9)';
        ctx.fillRect(mx - mSize / 2, my - mSize / 2, mSize, mSize);
    }
    for (const u of state.units) {
        const mx = toMMx(u.x);
        const my = toMMy(u.y);
        const isMine = u.ownerId === state.selfId;
        const isSel = u.id === state.selectedUnitId;
        const rr = isSel ? 5 : isMine ? 3.5 : 2.5;
        ctx.fillStyle = isMine
            ? `hsla(${u.hue}, 80%, 65%, 1)`
            : `hsla(${u.hue}, 55%, 45%, 0.9)`;
        ctx.beginPath();
        ctx.arc(mx, my, rr, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }
    }
    // 视口框
    const viewW = window.innerWidth / camZoom;
    const viewH = window.innerHeight / camZoom;
    const vL = camX - viewW / 2;
    const vT = camY - viewH / 2;
    const vR = camX + viewW / 2;
    const vB = camY + viewH / 2;
    const mmLeft = Math.max(minimap.x, toMMx(vL));
    const mmTop = Math.max(minimap.y, toMMy(vT));
    const mmRight = Math.min(minimap.x + mmW, toMMx(vR));
    const mmBottom = Math.min(minimap.y + mmH, toMMy(vB));
    if (mmRight > mmLeft && mmBottom > mmTop) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(mmLeft, mmTop, mmRight - mmLeft, mmBottom - mmTop);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fillRect(mmLeft, mmTop, mmRight - mmLeft, mmBottom - mmTop);
    }
    ctx.fillStyle = 'rgba(200, 220, 255, 0.55)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('小地图 · 点击/拖拽移动镜头', minimap.x + 8, minimap.y + 6);
    ctx.restore();
}
// ---------- 相机更新 ----------
function updateCamera() {
    if (userPanning)
        return;
    const sel = state.getSelectedUnit();
    if (!sel)
        return;
    const rp = state.getRenderPos(sel.id);
    const targetX = rp ? rp.rx : sel.x;
    const targetY = rp ? rp.ry : sel.y;
    camX += (targetX - camX) * 0.1;
    camY += (targetY - camY) * 0.1;
}
// ---------- 主循环 ----------
let lastFrameTs = performance.now();
function frame() {
    const now = performance.now();
    const dtMs = Math.min(50, now - lastFrameTs);
    lastFrameTs = now;
    state.stepPrediction(dtMs);
    // 清屏（先画世界边界：外部云 + 内部暗）
    drawWorldBounds();
    drawGrid();
    drawObstacles();
    drawUnits();
    drawJoystick();
    drawPointSkillAimCircle();
    drawHUD();
    drawMinimap();
    renderSkillBarDOM();
    updateCamera();
    requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
