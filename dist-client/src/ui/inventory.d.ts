interface Item {
    itemId: string;
    name: string;
    icon?: string;
    description?: string;
    damage?: number;
    speed?: number;
}
interface Inventory {
    items: Item[];
    selectedIndex: number;
}
export interface InventoryUIState {
    open: boolean;
    hoveredIndex: number;
}
export declare function drawBackpackIcon(ctx: CanvasRenderingContext2D, width: number, height: number, inventory: Inventory): {
    iconX: number;
    iconY: number;
    iconW: number;
    iconH: number;
};
export declare function drawCurrentWeapon(ctx: CanvasRenderingContext2D, width: number, height: number, weapon: Item | null): void;
export declare function drawInventoryPanel(ctx: CanvasRenderingContext2D, width: number, height: number, inventory: Inventory, uiState: InventoryUIState, onSelectItem: (index: number) => void): {
    panelX: number;
    panelY: number;
    panelW: number;
    panelH: number;
};
export declare function hitBackpackIcon(mx: number, my: number, width: number, _height: number): boolean;
export declare function hitInventoryUI(mx: number, my: number, width: number, height: number, itemCount: number, isOpen: boolean): boolean;
export declare function hitInventorySlot(mx: number, my: number, width: number, _height: number, itemCount: number): number;
export {};
