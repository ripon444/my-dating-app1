// WEB-only desktop notifications via the plain Browser Notification API.
// No service worker, no Firebase/FCM, no extra socket connection.
// Works while the browser process runs (background tab / unfocused / minimized).
// Cannot work when the browser is fully closed — that needs Web Push infra.

const NOTIFIED_MESSAGE_IDS_KEY = 'lm_desktop_notified_msg_ids';
const MAX_TRACKED_IDS = 200;
const CLICK_TARGET_KEY = 'lm_desktop_notif_click_target';

function readNotifiedIds(): string[] {
  try {
    const raw = localStorage.getItem(NOTIFIED_MESSAGE_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function rememberNotifiedId(id: string) {
  try {
    const ids = readNotifiedIds();
    if (ids.includes(id)) return;
    ids.push(id);
    while (ids.length > MAX_TRACKED_IDS) ids.shift();
    localStorage.setItem(NOTIFIED_MESSAGE_IDS_KEY, JSON.stringify(ids));
  } catch {}
}

function readMessageNotifPref(): boolean {
  try {
    const raw = localStorage.getItem('lm_notif_prefs');
    if (!raw) return true; // default ON, matches ProfileSettingsHub default
    const parsed = JSON.parse(raw);
    if (typeof parsed?.messages !== 'boolean') return true;
    return parsed.messages;
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

/**
 * Show at most one native Windows/browser notification per message id.
 * Returns true if a notification was shown.
 */
export function showDesktopMessageNotification(notif: DesktopMessageNotif): boolean {
  try {
    if (!isDesktopNotificationSupported()) return false;
    if (Notification.permission !== 'granted') return false;
    if (!readMessageNotifPref()) return false;

    const dedupeKey = notif.messageId || (notif.conversationId && notif.preview
      ? `${notif.conversationId}:${notif.senderId || ''}:${notif.preview}`
      : '');
    if (dedupeKey) {
      if (readNotifiedIds().includes(dedupeKey)) return false;
      rememberNotifiedId(dedupeKey);
    }

    const title = buildTitle(notif.senderName);
    const options: NotificationOptions & { vibrate?: number[] } = {
      body: buildBody(notif.preview),
      icon: notif.photo || '/logo.png',
      badge: '/favicon.png',
      tag: notif.messageId ? `lovemeetly-msg-${notif.messageId}` : `lovemeetly-conv-${notif.conversationId || 'new'}`,
      renotify: false,
      silent: false,
    };

    const native = new Notification(title, options);
    const targetConv = notif.conversationId || '';
    // Focus the Lovemeetly tab and stash the target so App can open it.
    // Stash in localStorage (not only closure) so the click works even if
    // the page re-rendered since the notification was created.
    native.onclick = (event: Event) => {
      event.preventDefault();
      try {
        if (targetConv) localStorage.setItem(CLICK_TARGET_KEY, targetConv);
      } catch {}
      try {
        if (window.focus) window.focus();
      } catch {}
      try {
        native.close();
      } catch {}
      try {
        window.dispatchEvent(new CustomEvent('lovemeetly:open-conversation', { detail: { conversationId: targetConv } }));
      } catch {}
    };
    // Auto-close after a while so stale notifications don't pile up.
    window.setTimeout(() => {
      try { native.close(); } catch {}
    }, 20000);
    return true;
  } catch {
    return false;
  }
}

/** Read + clear the conversation id stored by a notification click. */
export function consumeDesktopNotifClickTarget(): string | null {
  try {
    const raw = localStorage.getItem(CLICK_TARGET_KEY);
    if (!raw) return null;
    localStorage.removeItem(CLICK_TARGET_KEY);
    return raw;
  } catch {
    return null;
  }
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
