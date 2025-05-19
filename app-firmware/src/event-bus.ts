import type { CustomRecipe } from './API';

type Events = { 'recipe-created': CustomRecipe };
type Handler<T = any> = (payload: T) => void;
const listeners: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

export function on<K extends keyof Events>(ev: K, fn: Handler<Events[K]>) {
  (listeners[ev] ??= [] as Handler<Events[K]>[]).push(fn);
  return () => off(ev, fn);
}
export function emit<K extends keyof Events>(ev: K, payload: Events[K]) {
  listeners[ev]?.forEach(fn => fn(payload));
}
export function off<K extends keyof Events>(ev: K, fn: Handler<Events[K]>) {
  listeners[ev] = listeners[ev]?.filter(f => f !== fn);
}
