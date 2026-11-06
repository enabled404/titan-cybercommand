"use client";

import { useSyncExternalStore } from "react";

const TICK = 30_000;
const listeners = new Set<() => void>();
let timer: number | undefined;

function getLiveNow() {
  return Math.floor(Date.now() / TICK) * TICK;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    timer = window.setInterval(() => {
      listeners.forEach((notify) => notify());
    }, TICK);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };
}

const emptySubscribe = () => () => {};

export function useIsMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * The current time for "5m ago" labels, guaranteed safe to render on the server and during hydration.
 * The server and client initial hydration pass both return `serverNow`, ensuring 100% identical HTML
 * and zero hydration errors (#418). Once mounted, it switches to the live clock updating every 30s.
 */
export function useNow(serverNow: number): number {
  const isMounted = useIsMounted();
  const live = useSyncExternalStore(subscribe, getLiveNow, () => serverNow);
  return isMounted ? live : serverNow;
}
