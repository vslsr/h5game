// 事件总线：客户端统一的游戏事件订阅/广播
// 用途：监听单位死亡、碰撞、弹射等事件，驱动 UI 提示、动画等
import type { GameEvent, GameEventType } from '../../shared/types';

type Handler<T extends GameEvent = GameEvent> = (evt: T) => void;

class EventBusImpl {
  private listeners: Map<string, Set<Handler>> = new Map();

  // 订阅某个类型的事件（或 '*' 监听所有事件）
  on<T extends GameEvent>(type: GameEventType | '*', handler: Handler<T>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(handler as Handler);
    return () => set!.delete(handler as Handler);
  }

  // 便捷订阅
  off<T extends GameEvent>(type: GameEventType | '*', handler: Handler<T>): void {
    const set = this.listeners.get(type);
    if (set) set.delete(handler as Handler);
  }

  // 广播事件
  emit<T extends GameEvent>(evt: T): void {
    const typed = this.listeners.get(evt.type);
    if (typed) {
      for (const h of typed) h(evt);
    }
    const wildcard = this.listeners.get('*');
    if (wildcard) {
      for (const h of wildcard) h(evt);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const EventBus: EventBusImpl = new EventBusImpl();
