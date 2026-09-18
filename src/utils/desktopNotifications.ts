// WEB-only desktop notifications via the plain Browser Notification API.
// No service worker, no Firebase/FCM, no extra socket connection.
// Works while the browser process runs (background tab / unfocused / minimized).
// Cannot work when the browser is fully closed — that needs Web Push infra.

import { safeStorage } from './storage';

const NOTIFIED_MESSAGE_IDS_KEY = 'lm_desktop_notified_msg_ids';
const NOTIFIED_EVENT_IDS_KEY = 'lm_desktop_notified_event_ids';
const MAX_TRACKED_IDS = 200;
export const CLICK_CONVERSATION_KEY = 'lm_desktop_notif_click_target';
export const CLICK_NOTIFICATION_KEY = 'lm_desktop_notif_click_notification';
// Back-compat alias for earlier imports.
export const CLICK_TARGET_KEY = CLICK_CONVERSATION_KEY;

// Set once per page load when ?lmNotifDebug=1 (or localStorage lm_notif_debug=1).
// TEMPORARY diagnostic channel: logs the full notification pipeline so a real
// browser run can prove where events stop.
const DEBUG_ENABLED =
  typeof window !== 'undefined' &&
  (window.location.search.includes('lmNotifDebug=1') ||
    (() => {
      try {
        return window.localStorage.getItem('lm_notif_debug') === '1';
      } catch {
        return false;
      }
    })());

export function debugNotifLog(event: string, details?: Record<string, unknown>) {
  if (!DEBUG_ENABLED) return;
  try {
    // eslint-disable-next-line no-console
    console.log(`[LM-Notif] ${event}`, details ?? '');
  } catch {}
}

function readStoredIds(key: string): string[] {
  try {
    const raw = safeStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberStoredId(key: string, id: string) {
  try {
    const ids = readStoredIds(key);
    if (ids.includes(id)) return;
    ids.push(id);
    while (ids.length > MAX_TRACKED_IDS) ids.shift();
    safeStorage.setItem(key, JSON.stringify(ids));
  } catch {}
}

function alreadyNotified(key: string, id: string): boolean {
  try {
    return readStoredIds(key).includes(id);
  } catch {
    return false;
  }
}

export function readMessageNotifPref(): boolean {
  return readNotifPref('messages');
}

function readNotifPref(key: 'messages' | 'matches' | 'followers'): boolean {
  try {
    const raw = safeStorage.getItem('lm_notif_prefs');
    if (!raw) return true; // default ON, matches ProfileSettingsHub default
    const parsed = JSON.parse(raw);
    if (typeof parsed?.[key] !== 'boolean') return true;
    return parsed[key];
  } catch {
    return true;
  }
}

export function isDesktopNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getDesktopNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isDesktopNotificationSupported()) return 'unsupported';
  try {
    return Notification.permission;
  } catch {
    return 'unsupported';
  }
}

/**
 * User-initiated permission request. Resolves to the resulting permission.
 * Never throws — denied/unsupported resolves gracefully.
 */
export async function requestDesktopNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isDesktopNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission ?? 'default';
  }
}

export interface DesktopMessageNotif {
  messageId?: string;
  conversationId?: string;
  senderId?: string;
  senderName?: string;
  preview?: string;
  photo?: string;
}

function buildTitle(senderName?: string): string {
  return senderName && senderName.trim() ? `New message from ${senderName.trim()}` : 'New message';
}

function buildBody(preview?: string): string {
  const text = (preview || '').trim();
  if (!text) return 'You have a new message on Lovemeetly.';
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export interface DesktopGenericNotif {
  eventId?: string;
  title: string;
  body?: string;
  photo?: string;
  clickConversationId?: string;
  clickNotificationId?: string;
  clickProfileId?: string;
}

export interface DesktopNotifResult {
  shown: boolean;
  reason: string;
}

function createNativeNotification(
  title: string,
  body: string,
  opts: { photo?: string; tag: string; onClick: () => void }
): DesktopNotifResult {
  if (!isDesktopNotificationSupported()) return { shown: false, reason: 'unsupported' };
  let permission: string = 'unknown';
  try {
    permission = Notification.permission;
  } catch (err) {
    debugNotifLog('permission-read-failed', { error: String(err) });
    return { shown: false, reason: 'permission-read-failed' };
  }
  if (permission !== 'granted') return { shown: false, reason: `permission-${permission}` };
  let native: Notification;
  try {
    native = new Notification(title, {
      body,
      icon: opts.photo || '/logo.png',
      badge: '/favicon.png',
      tag: opts.tag,
      renotify: false,
      silent: false,
    } as NotificationOptions);
  } catch (err: any) {
    debugNotifLog('new-Notification-threw', { error: String(err?.message || err), name: err?.name });
    return { shown: false, reason: `construct-threw:${err?.name || 'Error'}` };
  }
  try {
    native.onclick = (event: Event) => {
      event.preventDefault();
      try { opts.onClick(); } catch {}
      try { if (window.focus) window.focus(); } catch {}
      try { native.close(); } catch {}
    };
  } catch {}
  window.setTimeout(() => { try { native.close(); } catch {} }, 20000);
  debugNotifLog('native-shown', { title });
  return { shown: true, reason: 'shown' };
}

/**
 * Show at most one native Windows/browser notification per message id.
 */
export function showDesktopMessageNotification(notif: DesktopMessageNotif): DesktopNotifResult {
  if (!readNotifPref('messages')) {
    debugNotifLog('message-skipped-pref-off', { messageId: notif.messageId });
    return { shown: false, reason: 'pref-messages-off' };
  }
  const dedupeKey = notif.messageId || (notif.conversationId && notif.preview
    ? `${notif.conversationId}:${notif.senderId || ''}:${notif.preview}`
    : '');
  if (dedupeKey) {
    if (alreadyNotified(NOTIFIED_MESSAGE_IDS_KEY, dedupeKey)) {
      debugNotifLog('message-skipped-duplicate', { dedupeKey });
      return { shown: false, reason: 'duplicate' };
    }
    rememberStoredId(NOTIFIED_MESSAGE_IDS_KEY, dedupeKey);
  }
  const title = buildTitle(notif.senderName);
  const targetConv = notif.conversationId || '';
  return createNativeNotification(title, buildBody(notif.preview), {
    photo: notif.photo,
    tag: notif.messageId ? `lovemeetly-msg-${notif.messageId}` : `lovemeetly-conv-${notif.conversationId || 'new'}`,
    onClick: () => {
      try { if (targetConv) safeStorage.setItem(CLICK_CONVERSATION_KEY, targetConv); } catch {}
      try { window.dispatchEvent(new CustomEvent('lovemeetly:open-conversation', { detail: { conversationId: targetConv } })); } catch {}
    },
  });
}

export function showDesktopEventNotification(notif: DesktopGenericNotif): DesktopNotifResult {
  const dedupeKey = notif.eventId || `${notif.title}:${notif.body || ''}`;
  if (dedupeKey) {
    if (alreadyNotified(NOTIFIED_EVENT_IDS_KEY, dedupeKey)) {
      debugNotifLog('event-skipped-duplicate', { dedupeKey });
      return { shown: false, reason: 'duplicate' };
    }
    rememberStoredId(NOTIFIED_EVENT_IDS_KEY, dedupeKey);
  }
  const body = (notif.body || '').trim() || 'You have a new notification on Lovemeetly.';
  return createNativeNotification(notif.title || 'Lovemeetly', body, {
    photo: notif.photo,
    tag: notif.eventId ? `lovemeetly-event-${notif.eventId}` : `lovemeetly-${Date.now()}`,
    onClick: () => {
      try {
        if (notif.clickConversationId) safeStorage.setItem(CLICK_CONVERSATION_KEY, notif.clickConversationId);
        if (notif.clickNotificationId || notif.clickProfileId) {
          safeStorage.setItem(CLICK_NOTIFICATION_KEY, JSON.stringify({ notificationId: notif.clickNotificationId || '', profileId: notif.clickProfileId || '' }));
        }
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('lovemeetly:open-notification', {
          detail: { conversationId: notif.clickConversationId || '', notificationId: notif.clickNotificationId || '', profileId: notif.clickProfileId || '' },
        }));
      } catch {}
    },
  });
}

/** Read + clear the conversation id stored by a notification click. */
export function consumeDesktopNotifClickTarget(): string | null {
  try {
    const raw = safeStorage.getItem(CLICK_CONVERSATION_KEY);
    if (!raw) return null;
    safeStorage.removeItem(CLICK_CONVERSATION_KEY);
    return raw;
  } catch {
    return null;
  }
}

export function consumeDesktopEventClickTarget(): { notificationId: string; profileId: string } | null {
  try {
    const raw = safeStorage.getItem(CLICK_NOTIFICATION_KEY);
    if (!raw) return null;
    safeStorage.removeItem(CLICK_NOTIFICATION_KEY);
    const parsed = JSON.parse(raw);
    return {
      notificationId: typeof parsed?.notificationId === 'string' ? parsed.notificationId : '',
      profileId: typeof parsed?.profileId === 'string' ? parsed.profileId : '',
    };
  } catch {
    return null;
  }
}

export function describeServerNotification(notif: any): { title: string; body: string; prefKey: 'messages' | 'matches' | 'followers' | null; photo?: string } | null {
  const type = typeof notif?.type === 'string' ? notif.type.toLowerCase() : '';
  const title = typeof notif?.title === 'string' && notif.title.trim() ? notif.title.trim() : '';
  const body = typeof notif?.message === 'string' ? notif.message : '';
  const photo =
    (typeof notif?.data?.photo === 'string' && notif.data.photo) ||
    (typeof notif?.data?.followerPhoto === 'string' && notif.data.followerPhoto) ||
    undefined;
  if (type.includes('like') || type.includes('super_like') || type.includes('match')) {
    return { title: title || 'New Like!', body, prefKey: 'matches', photo };
  }
  if (type.includes('follow')) {
    return { title: title || 'New Follower!', body, prefKey: 'followers', photo };
  }
  if (type.includes('message') || type.includes('chat')) {
    return { title: title || 'New message', body, prefKey: 'messages', photo };
  }
  if (title) return { title, body, prefKey: null, photo };
  return null;
}

export function isEventPrefEnabled(prefKey: 'messages' | 'matches' | 'followers' | null): boolean {
  if (!prefKey) return true;
  return readNotifPref(prefKey);
}

/** True when the tab is hidden (background tab / minimized / unfocused window). */
export function isTabHidden(): boolean {
  try {
    if (typeof document !== 'undefined' && typeof document.hidden === 'boolean') {
      return document.hidden;
    }
  } catch {}
  return false;
}
