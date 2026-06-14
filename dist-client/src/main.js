// 前端主入口：服务端权威模型
// 摇杆 -> 发送输入到服务端 -> 服务端 tick 移动 -> 广播 gameState -> 客户端插值渲染
import { GameSocket } from './net/socket';
import { JoystickInput } from './game/joystick';
import { FireJoystick } from './game/fireJoystick';
import { GameState } from './game/state';
import { setupCanvas } from './render/canvas';
import { drawGrid } from './render/grid';
import { drawObstacles } from './render/obstacles';
import { drawPlayer } from './render/player';
import { drawJoystickUI } from './render/joystick';
import { drawBullets, drawBulletParticles } from './render/bullet';
import { drawUnitPanel, drawPanelToggle, handleUnitPanelClick, isUIHit as isUnitPanelHit } from './ui/unitPanel';
import { GAME_CONSTANTS } from '../shared/types';
// --- 初始化画布 ---
const { canvas, ctx, width, height } = setupCanvas('gameCanvas');
// --- 游戏状态 ---
const state = new GameState();
// --- 单位面板 UI 状态 ---
let unitPanelUIState = { open: true, hoveredUnitIndex: -1, hoveredSkillIndex: -1 };
// --- UI 点击白名单：命中单位面板时不激活游戏摇杆 ---
function isUIHit(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const mx = (clientX - rect.left) * scaleX;
    const my = (clientY - rect.top) * scaleY;
    return isUnitPanelHit(mx, my, width, height, state.units, state.selectedUnitId, state.unitPanelOpen);
}
// --- 移动摇杆：发送输入到服务端 ---
let sendTimer = null;
function startContinuousSend() {
    if (sendTimer !== null)
        return;
    sendTimer = window.setInterval(() => {
        gameSocket.sendInput({
            vx: joystick.dirX * GAME_CONSTANTS.MAX_SPEED,
            vy: joystick.dirY * GAME_CONSTANTS.MAX_SPEED
        });
    }, 50);
}
function stopContinuousSend() {
    if (sendTimer !== null) {
        clearInterval(sendTimer);
        sendTimer = null;
    }
    gameSocket.sendInput({ vx: 0, vy: 0 });
}
const joystick = new JoystickInput(canvas, {
    onInputChange: (input) => {
        gameSocket.sendInput({
            vx: input.vx * GAME_CONSTANTS.MAX_SPEED,
            vy: input.vy * GAME_CONSTANTS.MAX_SPEED
        });
    },
    onActivate: () => {
        startContinuousSend();
    },
    onDeactivate: () => {
        stopContinuousSend();
    },
    isUIHit
});
// --- 发射摇杆：按下拖拽 -> 松手发子弹 ---
const fireJoystick = new FireJoystick(canvas, {
    onFire: (dirX, dirY, charge) => {
        const self = state.getSelf();
        const x = self ? self.x : 0;
        const y = self ? self.y : 0;
        gameSocket.sendBulletFire({
            vx: dirX,
            vy: dirY,
            x,
            y,
            charge
        });
    },
    isUIHit
});
// --- 网络连接 ---
let playersJoined = false;
const gameSocket = new GameSocket({
    onConnected: () => {
        gameSocket.joinRoom('default', '玩家' + Math.floor(Math.random() * 900 + 100));
    },
    onJoined: (data) => {
        state.init(data);
        playersJoined = true;
        hideLoading();
    },
    onPlayerJoined: (player) => {
        state.addPlayer(player);
    },
    onPlayerLeft: (id) => {
        state.removePlayer(id);
    },
    onGameState: (players) => {
        state.updateTargets(players);
    },
    onBulletFired: (bullet) => {
        state.addBullet(bullet);
    },
    onObstacleHit: (payload) => {
        state.updateObstacleHp(payload);
    },
    onObstacleDestroyed: (payload) => {
        state.removeObstacle(payload);
    },
    onSelectionUpdated: (payload) => {
        state.applySelection(payload.selectedUnitId, payload.selectedSkillIndex);
    },
    onDisconnect: () => {
        // 自动重连由 socket.io-client 处理
    }
});
// --- Loading 层 ---
function hideLoading() {
    const el = document.getElementById('loading');
    if (el)
        el.style.display = 'none';
}
gameSocket.connect();
// --- 点击处理（单位面板）---
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const result = handleUnitPanelClick(mx, my, width, height, state.units, state.selectedUnitId, state.unitPanelOpen);
    if (result.togglePanel) {
        state.unitPanelOpen = !state.unitPanelOpen;
        return;
    }
    if (result.unitIndex !== -1) {
        const unit = state.units[result.unitIndex];
        if (unit) {
            state.selectUnit(unit.unitId);
            gameSocket.sendUnitSelect(unit.unitId);
        }
        return;
    }
    if (result.skillIndex !== -1) {
        state.selectSkill(result.skillIndex);
        gameSocket.sendSkillSelect(result.skillIndex);
    }
});
// 鼠标悬停（hover 效果）
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = width / rect.width;
    const scaleY = height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    if (!state.unitPanelOpen) {
        unitPanelUIState.hoveredUnitIndex = -1;
        unitPanelUIState.hoveredSkillIndex = -1;
        return;
    }
    const selectedUnitIndex = Math.max(0, state.units.findIndex((u) => u.unitId === state.selectedUnitId));
    const tabWidth = (280 - 12 * 2) / Math.max(1, state.units.length);
    let hoveredUnit = -1;
    for (let i = 0; i < state.units.length; i++) {
        const tabX = 16 + 12 + i * tabWidth;
        const tabY = 16 + 4;
        if (mx >= tabX && mx <= tabX + tabWidth - 2 && my >= tabY && my <= tabY + 34 - 4) {
            hoveredUnit = i;
            break;
        }
    }
    unitPanelUIState.hoveredUnitIndex = hoveredUnit;
    // 技能项 hover
    const unit = state.units[selectedUnitIndex];
    let hoveredSkill = -1;
    if (unit) {
        const infoY = 16 + 34 + 6;
        const skillsStartY = infoY + 26 + 12;
        const skillHeight = 60;
        for (let i = 0; i < unit.skills.length; i++) {
            const skillY = skillsStartY + i * skillHeight;
            const skillH = skillHeight - 6;
            const skillX = 16 + 12;
            const skillW = 280 - 12 * 2;
            if (mx >= skillX && mx <= skillX + skillW && my >= skillY && my <= skillY + skillH) {
                hoveredSkill = i;
                break;
            }
        }
    }
    unitPanelUIState.hoveredSkillIndex = hoveredSkill;
});
canvas.addEventListener('mouseleave', () => {
    unitPanelUIState.hoveredUnitIndex = -1;
    unitPanelUIState.hoveredSkillIndex = -1;
});
// --- 发射摇杆 UI 渲染 ---
function drawFireJoystickUI(ctx, canvasWidth, canvasHeight) {
    let baseX;
    let baseY;
    let alpha;
    let charge;
    let dirX;
    let dirY;
    let label;
    if (fireJoystick.active) {
        baseX = fireJoystick.baseX;
        baseY = fireJoystick.baseY;
        alpha = 1;
        charge = fireJoystick.dragMagnitude;
        dirX = -fireJoystick.dragX;
        dirY = -fireJoystick.dragY;
        label = null;
    }
    else {
        baseX = canvasWidth - 140;
        baseY = canvasHeight - 140;
        alpha = 0.3;
        charge = 0;
        dirX = 0;
        dirY = 0;
        label = '右半屏触摸发射';
    }
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(baseX, baseY, fireJoystick.radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    const ringR = 255;
    const ringG = Math.floor(180 + 50 * (1 - charge));
    const ringB = Math.floor(120 - 60 * charge);
    ctx.strokeStyle = `rgba(${ringR}, ${ringG}, ${ringB}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.stroke();
    if (charge > 0.1) {
        const arrowLen = 60 * charge;
        const ax = baseX + dirX * arrowLen;
        const ay = baseY + dirY * arrowLen;
        ctx.beginPath();
        ctx.moveTo(baseX, baseY);
        ctx.lineTo(ax, ay);
        ctx.strokeStyle = `rgba(255, 200, 120, ${0.4 + charge * 0.5})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        const ang = Math.atan2(dirY, dirX);
        const tipLen = 10;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - tipLen * Math.cos(ang - Math.PI / 6), ay - tipLen * Math.sin(ang - Math.PI / 6));
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - tipLen * Math.cos(ang + Math.PI / 6), ay - tipLen * Math.sin(ang + Math.PI / 6));
        ctx.strokeStyle = `rgba(255, 200, 120, ${0.6 + charge * 0.4})`;
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    const knobRadius = 24;
    ctx.beginPath();
    const knobX = fireJoystick.active ? fireJoystick.knobX : baseX;
    const knobY = fireJoystick.active ? fireJoystick.knobY : baseY;
    ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
    const knobGrad = ctx.createRadialGradient(knobX - 5, knobY - 5, 2, knobX, knobY, knobRadius);
    knobGrad.addColorStop(0, 'rgba(255, 240, 220, 0.95)');
    knobGrad.addColorStop(1, `rgba(${ringR}, ${ringG + 10}, ${ringB}, 0.7)`);
    ctx.fillStyle = knobGrad;
    ctx.fill();
    ctx.globalAlpha = 1;
    if (label) {
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.font = '13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, baseX, baseY - fireJoystick.radius - 20);
    }
}
// --- 主循环 ---
let fpsCount = 0;
let fpsTime = performance.now();
let fps = 0;
function loop() {
    fpsCount++;
    const now = performance.now();
    if (now - fpsTime > 500) {
        fps = Math.round((fpsCount * 1000) / (now - fpsTime));
        fpsCount = 0;
        fpsTime = now;
    }
    ctx.fillStyle = '#0f1624';
    ctx.fillRect(0, 0, width, height);
    if (playersJoined) {
        state.interpolate();
    }
    if (playersJoined) {
        state.updateBullets();
        state.updateParticles();
    }
    let camX = 0;
    let camY = 0;
    const self = state.getSelf();
    if (self) {
        camX = self.x;
        camY = self.y;
    }
    drawGrid(ctx, camX, camY, width, height);
    drawObstacles(ctx, state.obstacles, camX, camY, width, height);
    for (const p of state.players.values()) {
        if (p.id !== state.selfId) {
            drawPlayer(ctx, p, false, camX, camY, width, height);
        }
    }
    if (self) {
        drawPlayer(ctx, self, true, camX, camY, width, height);
    }
    drawBulletParticles(ctx, state.particles, camX, camY, width, height);
    drawBullets(ctx, state.bullets, camX, camY, width, height, now);
    drawJoystickUI(ctx, {
        active: joystick.active,
        baseX: joystick.baseX,
        baseY: joystick.baseY,
        knobX: joystick.knobX,
        knobY: joystick.knobY,
        radius: joystick.radius,
        knobRadius: joystick.knobRadius
    }, height);
    drawFireJoystickUI(ctx, width, height);
    // --- 单位面板 UI ---
    drawPanelToggle(ctx, width, height, state.units, state.selectedUnitId, state.unitPanelOpen);
    if (state.unitPanelOpen) {
        drawUnitPanel(ctx, width, height, state.units, state.selectedUnitId, state.selectedSkillIndex, unitPanelUIState);
    }
    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`FPS ${fps}  Players ${state.players.size}  Bullets ${state.bullets.length}`, 12, 22);
    if (self) {
        ctx.fillText(`Pos (${self.x.toFixed(0)}, ${self.y.toFixed(0)})`, 12, 40);
    }
    const unit = state.getSelectedUnit();
    const skill = state.getSelectedSkill();
    if (unit && skill) {
        ctx.fillText(`单位: ${unit.icon ?? ''} ${unit.name}  技能: ${skill.icon ?? '✦'} ${skill.name}`, 12, 58);
    }
    ctx.fillStyle = gameSocket.isConnected() ? '#7fffa8' : '#ff7f7f';
    ctx.fillText(gameSocket.isConnected() ? 'ONLINE' : 'OFFLINE', width - 80, 22);
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
