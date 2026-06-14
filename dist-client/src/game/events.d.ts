import type { GameEvent, GameEventType } from '../../shared/types.js';
type Handler<T extends GameEvent = GameEvent> = (evt: T) => void;
declare class EventBusImpl {
    private listeners;
    on<T extends GameEvent>(type: GameEventType | '*', handler: Handler<T>): () => void;
    off<T extends GameEvent>(type: GameEventType | '*', handler: Handler<T>): void;
    emit<T extends GameEvent>(evt: T): void;
    clear(): void;
}
export declare const EventBus: EventBusImpl;
export {};
