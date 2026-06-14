export interface JoystickRenderState {
    active: boolean;
    baseX: number;
    baseY: number;
    knobX: number;
    knobY: number;
    radius: number;
    knobRadius: number;
}
export declare function drawJoystickUI(ctx: CanvasRenderingContext2D, state: JoystickRenderState, canvasHeight: number): void;
