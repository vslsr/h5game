const TAB_HEIGHT = 34;
const SKILL_HEIGHT = 60;
const PANEL_WIDTH = 280;
const PANEL_PADDING = 12;
const PANEL_X = 16;
const PANEL_Y = 16;
// --- 工具函数 ---
function roundRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
// 计算面板高度（根据技能数量）
export function getPanelHeight(units, selectedUnitIndex) {
    const unit = units[selectedUnitIndex];
    const skillCount = unit ? unit.skills.length : 0;
    const skillsHeight = skillCount * SKILL_HEIGHT + PANEL_PADDING;
    return TAB_HEIGHT + PANEL_PADDING + skillsHeight + 24;
}
function getPanelRect(width, units, selectedUnitIndex) {
    const panelH = getPanelHeight(units, selectedUnitIndex);
    return { panelX: PANEL_X, panelY: PANEL_Y, panelW: PANEL_WIDTH, panelH };
}
// 绘制单位面板
export function drawUnitPanel(ctx, width, height, units, selectedUnitId, selectedSkillIndex, uiState) {
    if (!uiState.open || units.length === 0)
        return;
    const selectedUnitIndex = Math.max(0, units.findIndex((u) => u.unitId === selectedUnitId));
    const { panelX, panelY, panelW, panelH } = getPanelRect(width, units, selectedUnitIndex);
    // 面板背景
    ctx.fillStyle = 'rgba(12, 18, 32, 0.92)';
    ctx.beginPath();
    roundRect(ctx, panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.5)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // 单位标签（横向）
    const tabWidth = (panelW - PANEL_PADDING * 2) / Math.max(1, units.length);
    for (let i = 0; i < units.length; i++) {
        const unit = units[i];
        const tabX = panelX + PANEL_PADDING + i * tabWidth;
        const tabY = panelY + 4;
        const isSelected = i === selectedUnitIndex;
        const isHovered = i === uiState.hoveredUnitIndex;
        // 标签背景
        ctx.fillStyle = isSelected
            ? 'rgba(80, 160, 255, 0.25)'
            : isHovered
                ? 'rgba(80, 120, 180, 0.18)'
                : 'rgba(40, 60, 100, 0.15)';
        ctx.beginPath();
        roundRect(ctx, tabX, tabY, tabWidth - 2, TAB_HEIGHT - 4, 8);
        ctx.fill();
        if (isSelected) {
            ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        // 单位图标
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(unit.icon || '⚔️', tabX + tabWidth / 2 - 1, tabY + (TAB_HEIGHT - 4) / 2 - 4);
        // 单位名称
        ctx.fillStyle = isSelected ? 'rgba(230, 240, 255, 1)' : 'rgba(180, 200, 230, 0.9)';
        ctx.font = '11px sans-serif';
        ctx.fillText(unit.name.length > 6 ? unit.name.slice(0, 5) + '…' : unit.name, tabX + tabWidth / 2 - 1, tabY + (TAB_HEIGHT - 4) / 2 + 10);
    }
    // 当前单位信息
    const unit = units[selectedUnitIndex];
    if (unit) {
        // 单位名称 + 色带
        const infoY = panelY + TAB_HEIGHT + 6;
        ctx.fillStyle = `hsla(${unit.hue}, 70%, 55%, 0.15)`;
        ctx.beginPath();
        roundRect(ctx, panelX + PANEL_PADDING, infoY, panelW - PANEL_PADDING * 2, 26, 6);
        ctx.fill();
        ctx.fillStyle = `hsla(${unit.hue}, 80%, 75%, 1)`;
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${unit.icon ?? ''} ${unit.name}`, panelX + PANEL_PADDING + 8, infoY + 13);
        // 技能列表
        const skillsStartY = infoY + 26 + PANEL_PADDING;
        for (let i = 0; i < unit.skills.length; i++) {
            const skill = unit.skills[i];
            const skillX = panelX + PANEL_PADDING;
            const skillY = skillsStartY + i * SKILL_HEIGHT;
            const skillW = panelW - PANEL_PADDING * 2;
            const skillH = SKILL_HEIGHT - 6;
            const isSelected = i === selectedSkillIndex;
            const isHovered = i === uiState.hoveredSkillIndex;
            // 格子背景
            ctx.fillStyle = isSelected
                ? 'rgba(80, 160, 255, 0.22)'
                : isHovered
                    ? 'rgba(120, 160, 200, 0.14)'
                    : 'rgba(40, 60, 100, 0.18)';
            ctx.beginPath();
            roundRect(ctx, skillX, skillY, skillW, skillH, 8);
            ctx.fill();
            if (isSelected) {
                ctx.strokeStyle = `hsla(${skill.hue}, 90%, 70%, 0.9)`;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
            // 技能图标
            ctx.font = '20px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(skill.icon || '✦', skillX + 22, skillY + skillH / 2);
            // 技能名称
            ctx.fillStyle = 'rgba(220, 230, 250, 1)';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(skill.name, skillX + 48, skillY + 8);
            // 技能属性
            const attrs = [];
            const dmg = Math.round((skill.damageMin + skill.damageMax) / 2);
            attrs.push(`伤害 ${dmg}`);
            const speed = Math.round((skill.speedMin + skill.speedMax) / 2);
            attrs.push(`速度 ${speed}`);
            if (skill.explosive)
                attrs.push(`爆炸`);
            ctx.fillStyle = 'rgba(150, 170, 200, 0.85)';
            ctx.font = '10px sans-serif';
            ctx.fillText(attrs.join('  '), skillX + 48, skillY + 26);
            // 描述
            if (skill.description) {
                ctx.fillStyle = 'rgba(120, 140, 170, 0.8)';
                ctx.font = '9px sans-serif';
                const shortDesc = skill.description.length > 18 ? skill.description.slice(0, 17) + '…' : skill.description;
                ctx.fillText(shortDesc, skillX + 48, skillY + 40);
            }
            // 选中打勾
            if (isSelected) {
                ctx.fillStyle = `hsla(${skill.hue}, 90%, 70%, 1)`;
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText('✓ 使用中', skillX + skillW - 8, skillY + skillH / 2);
            }
        }
    }
}
// 绘制关闭/打开按钮（位于面板右上角）
export function drawPanelToggle(ctx, width, _height, units, selectedUnitId, open) {
    const toggleW = 88;
    const toggleH = 26;
    const x = width - toggleW - 16;
    const y = 16;
    ctx.fillStyle = 'rgba(20, 30, 50, 0.85)';
    ctx.beginPath();
    roundRect(ctx, x, y, toggleW, toggleH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    const selectedUnit = units.find((u) => u.unitId === selectedUnitId);
    const label = open ? '关闭面板' : `${selectedUnit?.icon ?? '🎖'} ${selectedUnit?.name ?? '单位'}`;
    ctx.fillStyle = 'rgba(220, 230, 250, 1)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + toggleW / 2, y + toggleH / 2);
    return { x, y, w: toggleW, h: toggleH };
}
// --- 命中检测 ---
// 命中切换按钮
export function hitPanelToggle(mx, my, width, _height) {
    const toggleW = 88;
    const toggleH = 26;
    const x = width - toggleW - 16;
    const y = 16;
    return mx >= x && mx <= x + toggleW && my >= y && my <= y + toggleH;
}
// 命中单位标签（切换单位）
export function hitUnitTab(mx, my, width, units, selectedUnitId) {
    const selectedUnitIndex = Math.max(0, units.findIndex((u) => u.unitId === selectedUnitId));
    const { panelX, panelY } = getPanelRect(width, units, selectedUnitIndex);
    const tabWidth = (PANEL_WIDTH - PANEL_PADDING * 2) / Math.max(1, units.length);
    for (let i = 0; i < units.length; i++) {
        const tabX = panelX + PANEL_PADDING + i * tabWidth;
        const tabY = panelY + 4;
        if (mx >= tabX && mx <= tabX + tabWidth - 2 && my >= tabY && my <= tabY + TAB_HEIGHT - 4) {
            return i;
        }
    }
    return -1;
}
// 命中技能（切换技能）
export function hitSkillSlot(mx, my, width, units, selectedUnitId) {
    const selectedUnitIndex = Math.max(0, units.findIndex((u) => u.unitId === selectedUnitId));
    const unit = units[selectedUnitIndex];
    if (!unit)
        return -1;
    const { panelX } = getPanelRect(width, units, selectedUnitIndex);
    const panelY = PANEL_Y;
    const infoY = panelY + TAB_HEIGHT + 6;
    const skillsStartY = infoY + 26 + PANEL_PADDING;
    for (let i = 0; i < unit.skills.length; i++) {
        const skillY = skillsStartY + i * SKILL_HEIGHT;
        const skillH = SKILL_HEIGHT - 6;
        const skillX = panelX + PANEL_PADDING;
        const skillW = PANEL_WIDTH - PANEL_PADDING * 2;
        if (mx >= skillX && mx <= skillX + skillW && my >= skillY && my <= skillY + skillH) {
            return i;
        }
    }
    return -1;
}
// 命中任意单位面板 UI（包括切换按钮）
export function isUIHit(mx, my, width, height, units, selectedUnitId, open) {
    if (hitPanelToggle(mx, my, width, height))
        return true;
    if (open && units.length > 0) {
        const selectedUnitIndex = Math.max(0, units.findIndex((u) => u.unitId === selectedUnitId));
        const { panelX, panelY, panelW, panelH } = getPanelRect(width, units, selectedUnitIndex);
        if (mx >= panelX && mx <= panelX + panelW && my >= panelY && my <= panelY + panelH) {
            return true;
        }
    }
    return false;
}
export function handleUnitPanelClick(mx, my, width, height, units, selectedUnitId, open) {
    if (hitPanelToggle(mx, my, width, height)) {
        return { togglePanel: true, unitIndex: -1, skillIndex: -1 };
    }
    if (!open)
        return { togglePanel: false, unitIndex: -1, skillIndex: -1 };
    const unitIdx = hitUnitTab(mx, my, width, units, selectedUnitId);
    if (unitIdx !== -1)
        return { togglePanel: false, unitIndex: unitIdx, skillIndex: -1 };
    const skillIdx = hitSkillSlot(mx, my, width, units, selectedUnitId);
    if (skillIdx !== -1)
        return { togglePanel: false, unitIndex: -1, skillIndex: skillIdx };
    return { togglePanel: false, unitIndex: -1, skillIndex: -1 };
}
