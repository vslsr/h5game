export interface FireJoystickState {
    active: boolean;
    baseX: number;
    baseY: number;
    knobX: number;
    knobY: number;
    dragX: number;
    dragY: number;
    dragMagnitude: number;
    radius: number;
}
export interface FireJoystickEvents {
    onFire: (dirX: number, dirY: number, charge: number) => void;
    isUIHit?: (clientX: number, clientY: number) => boolean;
}
export declare class FireJoystick {
    private canvas;
    active: boolean;
    baseX: number;
    baseY: number;
    knobX: number;
    knobY: number;
    dragX: number;
    dragY: number;
    dragMagnitude: number;
    readonly radius: number;
    private events;
    constructor(canvas: HTMLCanvasElement, events: FireJoystickEvents);
    private isFireZone;
    private trackedTouchId;
    private bindEvents;
    private activate;
    private updateFromPointer;
    private fire;
}
