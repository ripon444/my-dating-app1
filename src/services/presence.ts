import { useSyncExternalStore } from 'react';

type PresenceSnapshot = Readonly<Record<string, true>>;

let snapshot: PresenceSnapshot = {};
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function setPresenceSnapshot(userIds: string[]): void {
  const next: Record<string, true> = {};
  userIds.forEach((userId) => {
    if (userId) next[userId] = true;
  });
  snapshot = next;
  notify();
}

export function updatePresence(userId: string, isOnline: boolean): void {
  if (!userId) return;
  if (isOnline) {
    if (snapshot[userId]) return;
    snapshot = { ...snapshot, [userId]: true };
  } else {
    if (!snapshot[userId]) return;
    const next = { ...snapshot };
    delete next[userId];
    snapshot = next;
  }
  notify();
}

export function clearPresence(): void {
  if (Object.keys(snapshot).length === 0) return;
  snapshot = {};
  notify();
}

export function isPresenceOnline(userId?: string): boolean {
  return Boolean(userId && snapshot[userId]);
}

export function usePresence(): PresenceSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function usePresenceFor(userId?: string): boolean {
  const currentPresence = usePresence();
  return Boolean(userId && currentPresence[userId]);
}
