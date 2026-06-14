const ITEM_SLOT_SIZE = 64;
const ITEM_ICON_SIZE = 36;
const PANEL_PADDING = 16;
// 绘制右上角背包图标
export function drawBackpackIcon(ctx, width, height, inventory) {
    const iconW = 44;
    const iconH = 44;
    const iconX = width - iconW - 16;
    const iconY = 16;
    // 背景圆角矩形
    ctx.fillStyle = 'rgba(20, 30, 50, 0.85)';
    ctx.beginPath();
    roundRect(ctx, iconX, iconY, iconW, iconH, 10);
    ctx.fill();
    // 边框
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 背包图标（🎒）
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎒', iconX + iconW / 2, iconY + iconH / 2);
    // 物品数量角标
    if (inventory.items.length > 0) {
        const dotR = 8;
        const dotX = iconX + iconW - 4;
        const dotY = iconY + 4;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(80, 200, 120, 0.95)';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(inventory.items.length), dotX, dotY);
    }
    return { iconX, iconY, iconW, iconH };
}
// 绘制当前武器指示器（背包图标旁边）
export function drawCurrentWeapon(ctx, width, height, weapon) {
    if (!weapon)
        return;
    const iconX = width - 44 - 16;
    const iconY = 16 + 44 + 8;
    const barW = 44;
    const barH = 30;
    ctx.fillStyle = 'rgba(20, 30, 50, 0.8)';
    ctx.beginPath();
    roundRect(ctx, iconX, iconY, barW, barH, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 武器 emoji
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(weapon.icon || '?', iconX + barW / 2, iconY + barH / 2 - 4);
    // 武器名称（缩略）
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '9px sans-serif';
    const shortName = weapon.name.length > 5 ? weapon.name.slice(0, 4) + '…' : weapon.name;
    ctx.fillText(shortName, iconX + barW / 2, iconY + barH - 6);
}
// 绘制展开的背包面板
export function drawInventoryPanel(ctx, width, height, inventory, uiState, onSelectItem) {
    const { items, selectedIndex } = inventory;
    const cols = Math.min(items.length, 4);
    const rows = Math.ceil(items.length / cols);
    const panelW = cols * ITEM_SLOT_SIZE + PANEL_PADDING * 2;
    const panelH = rows * ITEM_SLOT_SIZE + PANEL_PADDING * 2 + 36; // +36 标题栏
    const panelX = Math.max(8, Math.min(width - panelW - 8, width - 44 - 16 - panelW - 8));
    const panelY = 8;
    // 面板背景
    ctx.fillStyle = 'rgba(12, 18, 32, 0.95)';
    ctx.beginPath();
    roundRect(ctx, panelX, panelY, panelW, panelH, 14);
    ctx.fill();
    // 面板边框
    ctx.strokeStyle = 'rgba(120, 180, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 标题栏
    ctx.fillStyle = 'rgba(80, 120, 180, 0.3)';
    ctx.beginPath();
    roundRectTop(ctx, panelX, panelY, panelW, 36, 14);
    ctx.fill();
    ctx.fillStyle = 'rgba(200, 220, 255, 0.9)';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('背包', panelX + panelW / 2, panelY + 18);
    // 物品格子
    for (let i = 0; i < items.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const slotX = panelX + PANEL_PADDING + col * ITEM_SLOT_SIZE;
        const slotY = panelY + 36 + PANEL_PADDING + row * ITEM_SLOT_SIZE;
        const item = items[i];
        const isSelected = i === selectedIndex;
        const isHovered = i === uiState.hoveredIndex;
        // 格子背景
        if (isSelected) {
            ctx.fillStyle = 'rgba(80, 160, 255, 0.3)';
            ctx.beginPath();
            roundRect(ctx, slotX, slotY, ITEM_SLOT_SIZE - 6, ITEM_SLOT_SIZE - 6, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(120, 200, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        else if (isHovered) {
            ctx.fillStyle = 'rgba(120, 160, 200, 0.2)';
            ctx.beginPath();
            roundRect(ctx, slotX, slotY, ITEM_SLOT_SIZE - 6, ITEM_SLOT_SIZE - 6, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(120, 180, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        else {
            ctx.fillStyle = 'rgba(40, 60, 100, 0.3)';
            ctx.beginPath();
            roundRect(ctx, slotX, slotY, ITEM_SLOT_SIZE - 6, ITEM_SLOT_SIZE - 6, 8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(80, 120, 180, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        // 物品图标
        ctx.font = '26px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.icon || '?', slotX + (ITEM_SLOT_SIZE - 6) / 2, slotY + (ITEM_SLOT_SIZE - 6) / 2 - 4);
        // 物品名称
        ctx.fillStyle = 'rgba(200, 220, 255, 0.85)';
        ctx.font = '10px sans-serif';
        const name2 = item.name.length > 6 ? item.name.slice(0, 5) + '…' : item.name;
        ctx.fillText(name2, slotX + (ITEM_SLOT_SIZE - 6) / 2, slotY + ITEM_SLOT_SIZE - 14);
        // 选中标记
        if (isSelected) {
            ctx.fillStyle = 'rgba(80, 200, 120, 0.9)';
            ctx.font = '10px sans-serif';
            ctx.fillText('✓', slotX + (ITEM_SLOT_SIZE - 6) / 2, slotY + 12);
        }
    }
    // 提示文字
    ctx.fillStyle = 'rgba(150, 170, 200, 0.6)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('点击选择武器', panelX + panelW / 2, panelY + panelH - 6);
    return { panelX, panelY, panelW, panelH };
}
// 检测点击是否命中背包图标
export function hitBackpackIcon(mx, my, width, _height) {
    const iconW = 44;
    const iconH = 44;
    const iconX = width - iconW - 16;
    const iconY = 16;
    return mx >= iconX && mx <= iconX + iconW && my >= iconY && my <= iconY + iconH;
}
// 检测点击是否命中任意背包 UI（背包图标 或 展开的面板）
// 返回 true 时，该点击被视为 UI 操作，不应激活游戏摇杆
export function hitInventoryUI(mx, my, width, height, itemCount, isOpen) {
    // 命中背包图标
    if (hitBackpackIcon(mx, my, width, height))
        return true;
    // 面板展开时，命中整个面板区域
    if (isOpen) {
        const cols = Math.min(Math.max(1, itemCount), 4);
        const rows = Math.ceil(Math.max(1, itemCount) / cols);
        const panelW = cols * ITEM_SLOT_SIZE + PANEL_PADDING * 2;
        const panelH = rows * ITEM_SLOT_SIZE + PANEL_PADDING * 2 + 36;
        const panelX = Math.max(8, Math.min(width - panelW - 8, width - 44 - 16 - panelW - 8));
        const panelY = 8;
        if (mx >= panelX && mx <= panelX + panelW && my >= panelY && my <= panelY + panelH) {
            return true;
        }
    }
    return false;
}
// 检测点击是否命中物品格子
export function hitInventorySlot(mx, my, width, _height, itemCount) {
    if (itemCount === 0)
        return -1;
    const cols = Math.min(itemCount, 4);
    const rows = Math.ceil(itemCount / cols);
    const panelW = cols * ITEM_SLOT_SIZE + PANEL_PADDING * 2;
    const panelH = rows * ITEM_SLOT_SIZE + PANEL_PADDING * 2 + 36;
    const panelX = Math.max(8, Math.min(width - panelW - 8, width - 44 - 16 - panelW - 8));
    const panelY = 8;
    if (mx < panelX || mx > panelX + panelW || my < panelY || my > panelY + panelH) {
        return -1;
    }
    const slotX = mx - (panelX + PANEL_PADDING);
    const slotY = my - (panelY + 36 + PANEL_PADDING);
    if (slotX < 0 || slotY < 0)
        return -1;
    const col = Math.floor(slotX / ITEM_SLOT_SIZE);
    const row = Math.floor(slotY / ITEM_SLOT_SIZE);
    const index = row * cols + col;
    return index >= 0 && index < itemCount ? index : -1;
}
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
function roundRectTop(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
