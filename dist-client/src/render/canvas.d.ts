export interface CanvasContext {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    width: number;
    height: number;
}
export declare function setupCanvas(canvasId: string): CanvasContext;
