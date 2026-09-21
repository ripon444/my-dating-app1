import { soundManager } from './sound';
import { debugNotifLog, readMessageNotifPref } from './desktopNotifications';

// WEB-only incoming text-chat alert routing (no new deps, no backend).
// - One bounded module-level dedupe set: keyed by stable message id,
//   survives React StrictMode remounts and socket effect re-runs.
// - Never plays for the sender's own messages.
// - `playIncomingMessageSound` reuses the existing WebAudio pop sound,
//   respects the existing `lm_notif_prefs.messages` setting, and never throws.
const MAX_TRACKED_SOUND_IDS = 300;
const soundedMessageIds = new Set<string>();
// Separate bounded dedupe set for unread counting. Kept independent of the
// sound set so the read/unread DB state stays authoritative while the badge
// increment is applied at most once per message (duplicate socket deliveries,
// reconnects, or StrictMode re-runs must not double-count).
const MAX_TRACKED_UNREAD_IDS = 300;
const countedUnreadMessageIds = new Set<string>();

function readMessagesPrefEnabled(): boolean {
  try {
    return readMessageNotifPref();
  } catch {
    return true;
  }
}

function rememberSounded(id: string): void {
  soundedMessageIds.add(id);
  if (soundedMessageIds.size > MAX_TRACKED_SOUND_IDS) {
    const oldest = soundedMessageIds.values().next().value as string | undefined;
    if (oldest) soundedMessageIds.delete(oldest);
  }
}

/** Stable per-message sound key (prefers server id, falls back to content hash). */
export function getIncomingMessageSoundKey(msg: any): string {
  if (typeof msg?.id === 'string' && msg.id) return `id:${msg.id}`;
  const conv = typeof msg?.conversation_id === 'string' ? msg.conversation_id : '';
  const sender = typeof msg?.sender_id === 'string' ? msg.sender_id : '';
  const content = typeof msg?.content === 'string' ? msg.content : '';
  const created = typeof msg?.created_at === 'string' ? msg.created_at : '';
  return `fallback:${conv}:${sender}:${content}:${created}`;
}

/**
 * Decide whether an inbound message should increment the global unread badge.
 * Returns true at most once per message (stable id, content-hash fallback) and
 * never for the sender's own messages. Callers must also skip the conversation
 * the user is actively viewing. This only gates the optimistic badge increment;
 * the server's `is_read`/`unread_count` remains the authoritative source.
 */
export function shouldCountUnreadForMessage(msg: any, myId?: string | null): boolean {
  try {
    if (!msg) return false;
    if (myId && msg.sender_id === myId) return false;
    const key = getIncomingMessageSoundKey(msg);
    if (countedUnreadMessageIds.has(key)) return false;
    countedUnreadMessageIds.add(key);
    if (countedUnreadMessageIds.size > MAX_TRACKED_UNREAD_IDS) {
      const oldest = countedUnreadMessageIds.values().next().value as string | undefined;
      if (oldest) countedUnreadMessageIds.delete(oldest);
    }
    return true;
  } catch {
    // Never block the badge on a dedupe failure; fall back to counting.
    return true;
  }
}

/**
 * Play the short incoming-message sound exactly once per message id.
 * Returns true when a sound was attempted. Never throws.
 */
export function playIncomingMessageSound(msg: any, myId?: string | null): boolean {
  try {
    if (!msg) return false;
    if (myId && msg.sender_id === myId) {
      debugNotifLog('sound-skipped-own', { id: msg?.id });
      return false;
    }
    if (!readMessagesPrefEnabled()) {
      debugNotifLog('sound-skipped-pref-off', { id: msg?.id });
      return false;
    }
    const key = getIncomingMessageSoundKey(msg);
    if (soundedMessageIds.has(key)) {
      debugNotifLog('sound-skipped-duplicate', { key });
      return false;
    }
    rememberSounded(key);
    soundManager.unlock();
    soundManager.playNotificationPop();
    debugNotifLog('sound-played', { id: msg?.id });
    return true;
  } catch (err) {
    debugNotifLog('sound-error', { error: String(err) });
    return false;
  }
}
