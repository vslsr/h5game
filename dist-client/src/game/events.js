class EventBusImpl {
    listeners = new Map();
    // 订阅某个类型的事件（或 '*' 监听所有事件）
    on(type, handler) {
        let set = this.listeners.get(type);
        if (!set) {
            set = new Set();
            this.listeners.set(type, set);
        }
        set.add(handler);
        return () => set.delete(handler);
    }
    // 便捷订阅
    off(type, handler) {
        const set = this.listeners.get(type);
        if (set)
            set.delete(handler);
    }
    // 广播事件
    emit(evt) {
        const typed = this.listeners.get(evt.type);
        if (typed) {
            for (const h of typed)
                h(evt);
        }
        const wildcard = this.listeners.get('*');
        if (wildcard) {
            for (const h of wildcard)
                h(evt);
        }
    }
    clear() {
        this.listeners.clear();
    }
}
export const EventBus = new EventBusImpl();
