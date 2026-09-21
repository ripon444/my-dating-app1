import type { Message } from '../types';

/**
 * Session-only cache of the last successfully loaded message histories.
 *
 * Purpose: reopening a conversation that was already loaded in this session can
 * paint its history immediately from memory while the normal request refreshes
 * it in the background. It is never persisted, never authoritative and never
 * replaces the fetch, so an entry can only ever be shown for the moment between
 * paint and the fresh history merging in.
 *
 * Entries are scoped by `sessionKey` (the signed-in user id) so a cache entry
 * can never be served to a different account in the same browser session.
 */
const MAX_CACHED_CONVERSATIONS = 3;

type HistoryCacheEntry = {
  sessionKey: string;
  messages: Message[];
};

const historyCache = new Map<string, HistoryCacheEntry>();

/**
 * Returns the cached history for a conversation, or null when there is nothing
 * usable to paint. Never throws.
 */
export function getCachedMessageHistory(conversationId: string, sessionKey = ''): Message[] | null {
  try {
    if (!conversationId) return null;
    const entry = historyCache.get(conversationId);
    if (!entry || entry.sessionKey !== sessionKey) return null;
    // Refresh recency so the least recently opened thread is evicted first.
    historyCache.delete(conversationId);
    historyCache.set(conversationId, entry);
    return entry.messages;
  } catch {
    return null;
  }
}

/**
 * Stores the current on-screen history for a conversation. Empty histories are
 * ignored so a not-yet-loaded thread never shadows a real one.
 */
export function setCachedMessageHistory(
  conversationId: string,
  messages: Message[],
  sessionKey = ''
): void {
  try {
    if (!conversationId || !Array.isArray(messages) || messages.length === 0) return;
    // Store a copy so later in-place edits elsewhere cannot corrupt the cache.
    historyCache.set(conversationId, { sessionKey, messages: messages.slice() });
    while (historyCache.size > MAX_CACHED_CONVERSATIONS) {
      const oldestKey = historyCache.keys().next().value as string | undefined;
      if (!oldestKey) break;
      historyCache.delete(oldestKey);
    }
  } catch {
    // A cache write must never break the chat.
  }
}

/** Clears one conversation (or the whole cache) — used for explicit resets. */
export function clearCachedMessageHistory(conversationId?: string): void {
  try {
    if (conversationId) {
      historyCache.delete(conversationId);
      return;
    }
    historyCache.clear();
  } catch {
    // ignore
  }
}
