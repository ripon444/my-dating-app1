// Centralized background/visibility recovery for the whole app.
//
// The browser throttles timers and silently drops idle sockets while a tab is
// hidden, minimized, or suspended (laptop sleep, network switch). This service
// owns ONE set of visibility/network listeners and lets the app re-synchronize
// its server-backed state when the user returns, instead of scattering
// `visibilitychange` listeners across components.
//
// It deliberately does NOT reload the page. Reconnection and data refresh go
// through the existing Socket.IO client and API layer.

export interface BackgroundRecoveryOptions {
  /** Re-establish realtime connectivity. Must be safe to call often. */
  reconnect: () => void;
  /** Re-synchronize server-backed state (reuse existing API calls). */
  resync: () => void;
  /** True while the realtime connection is healthy (used to stop retries). */
  isConnectionHealthy: () => boolean;
  /**
   * Called only after the connection is confirmed healthy following a recovery
   * pass, so the app can refresh state that depends on live socket data.
   */
  onRecovered?: () => void;
  /**
   * A hidden period longer than this counts as a deep background (sleep,
   * throttling) and also schedules a recovery check once the tab is visible.
   * Default 30s.
   */
  staleAfterMs?: number;
  /** Delay before the visible-time settle check (lets the socket's own reconnect finish). */
  visibleSettleMs?: number;
}

const DEFAULT_STALE_AFTER_MS = 30_000;
const DEFAULT_VISIBLE_SETTLE_MS = 800;
// While the tab is visible but the socket is still down, retry on a fixed
// interval. Every tick is skipped unless the app is actually disconnected, so a
// healthy app issues no requests. Bounded so a truly broken session can't spin.
const RETRY_TICK_MS = 5_000;
const MAX_RETRY_TICKS = 12;

export interface BackgroundRecoveryHandle {
  /** Detach every listener/timer. Safe to call more than once. */
  stop: () => void;
  /** Run one recovery pass now (exposed for tests/manual recovery). */
  trigger: () => void;
}

export function startBackgroundRecovery(options: BackgroundRecoveryOptions): BackgroundRecoveryHandle {
  const {
    reconnect,
    resync,
    isConnectionHealthy,
    onRecovered,
    staleAfterMs = DEFAULT_STALE_AFTER_MS,
    visibleSettleMs = DEFAULT_VISIBLE_SETTLE_MS,
  } = options;

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { stop: () => {}, trigger: () => {} };
  }

  let stopped = false;
  let hiddenAt = 0;
  let settleTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  let retryTicks = 0;

  const clearSettleTimer = () => {
    if (settleTimer !== null) {
      clearTimeout(settleTimer);
      settleTimer = null;
    }
  };

  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
    retryTicks = 0;
  };

  const recoverOnce = () => {
    if (stopped) return;
    try {
      reconnect();
    } catch {}
    try {
      resync();
    } catch {}
  };

  // Retry only while disconnected and visible. Stops the moment the socket is
  // healthy (and fires onRecovered once), or after MAX_RETRY_TICKS.
  const startRetryLoop = () => {
    clearRetryTimer();
    if (isConnectionHealthy()) {
      onRecovered?.();
      return;
    }
    retryTimer = setInterval(() => {
      if (stopped) {
        clearRetryTimer();
        return;
      }
      if (document.visibilityState !== 'visible') {
        clearRetryTimer();
        return;
      }
      retryTicks += 1;
      if (isConnectionHealthy()) {
        clearRetryTimer();
        onRecovered?.();
        return;
      }
      if (retryTicks > MAX_RETRY_TICKS) {
        clearRetryTimer();
        return;
      }
      recoverOnce();
    }, RETRY_TICK_MS);
  };

  const scheduleSettle = () => {
    clearSettleTimer();
    settleTimer = setTimeout(() => {
      settleTimer = null;
      if (stopped) return;
      const online = typeof navigator === 'undefined' || navigator.onLine !== false;
      if (online) recoverOnce();
      startRetryLoop();
    }, visibleSettleMs);
  };

  const handleVisibility = () => {
    if (stopped) return;
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      clearSettleTimer();
      clearRetryTimer();
      return;
    }

    // Visible again. Collapse rapid focus/minimize flaps into one pass.
    const hiddenFor = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    recoverOnce();
    // A long background (sleep/throttle) may need a settle check before the
    // connection reports healthy again.
    if (hiddenFor >= staleAfterMs || !isConnectionHealthy()) {
      scheduleSettle();
    } else {
      onRecovered?.();
    }
  };

  const handleOnline = () => {
    if (stopped) return;
    recoverOnce();
    scheduleSettle();
  };

  document.addEventListener('visibilitychange', handleVisibility);
  window.addEventListener('online', handleOnline);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearSettleTimer();
      clearRetryTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
    },
    trigger: () => {
      recoverOnce();
      scheduleSettle();
    },
  };
}
