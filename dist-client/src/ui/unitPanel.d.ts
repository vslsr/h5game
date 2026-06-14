import type { Unit } from '../../shared/types';
export interface UnitPanelState {
    open: boolean;
    hoveredUnitIndex: number;
    hoveredSkillIndex: number;
}
export declare function getPanelHeight(units: Unit[], selectedUnitIndex: number): number;
export declare function drawUnitPanel(ctx: CanvasRenderingContext2D, width: number, height: number, units: Unit[], selectedUnitId: string, selectedSkillIndex: number, uiState: UnitPanelState): void;
export declare function drawPanelToggle(ctx: CanvasRenderingContext2D, width: number, _height: number, units: Unit[], selectedUnitId: string, open: boolean): {
    x: number;
    y: number;
    w: number;
    h: number;
};
export declare function hitPanelToggle(mx: number, my: number, width: number, _height: number): boolean;
export declare function hitUnitTab(mx: number, my: number, width: number, units: Unit[], selectedUnitId: string): number;
export declare function hitSkillSlot(mx: number, my: number, width: number, units: Unit[], selectedUnitId: string): number;
export declare function isUIHit(mx: number, my: number, width: number, height: number, units: Unit[], selectedUnitId: string, open: boolean): boolean;
export interface UnitPanelClickResult {
    togglePanel: boolean;
    unitIndex: number;
    skillIndex: number;
}
export declare function handleUnitPanelClick(mx: number, my: number, width: number, height: number, units: Unit[], selectedUnitId: string, open: boolean): UnitPanelClickResult;
