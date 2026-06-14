import type { PlayerInput } from '../../shared/types';
export interface JoystickState {
    dirX: number;
    dirY: number;
    active: boolean;
}
export interface JoystickEvents {
    onInputChange: (input: PlayerInput) => void;
    onActivate?: (type: 'touch' | 'mouse' | 'key') => void;
    onDeactivate?: () => void;
    isUIHit?: (clientX: number, clientY: number) => boolean;
}
type InputType = 'touch' | 'mouse' | 'key';
export declare class JoystickInput {
    private canvas;
    private events;
    dirX: number;
    dirY: number;
    active: boolean;
    activeType: InputType | null;
    baseX: number;
    baseY: number;
    knobX: number;
    knobY: number;
    readonly radius = 70;
    readonly knobRadius = 26;
    private trackedTouchId;
    private keys;
    constructor(canvas: HTMLCanvasElement, events: JoystickEvents);
    private isMoveZone;
    private bindEvents;
    private activate;
    private updateFromPointer;
    private deactivate;
    private refreshKeyboard;
}
export {};
