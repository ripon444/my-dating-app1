import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Facebook-style pull-to-refresh wrapper.
 *
 * Android/Capacitor only by contract: the caller passes `enabled` (see `isAndroidApp()` in
 * src/utils/capacitorApp.ts), and when it is false the component attaches no listeners at all, so a
 * browser/desktop page behaves exactly as before.
 *
 * The gesture is attached to the page content container (`<main>`), but the scroll position is read
 * from the REAL scroller: in this layout `<main>` has `overflow-y-auto` yet grows to its content
 * height (`min-h-screen` flex column), so on the Android WebView the DOCUMENT is what actually
 * scrolls. Both are checked, so the gesture still works if a future layout makes `<main>` the
 * scroller. It engages only when the page is at the very top AND the finger is pulled down;
 * `preventDefault()` is called only for that specific case. Normal scrolling, horizontal gesture
 * flows (discovery deck/cards), taps, buttons and navigation therefore keep working untouched.
 *
 * While pulling, the content is translated down and a circular badge is revealed in the gap above it -
 * without touching layout. Releasing past the threshold runs exactly one refresh; anything shorter
 * snaps back and is ignored. The DOM structure never changes, so toggling `enabled` can never remount
 * the wrapped page.
 */

/** Finger travel (px) that must be reached before releasing triggers a refresh. */
const PULL_THRESHOLD = 64;

/** Hard cap on how far the content can be pulled (px). */
const MAX_PULL_DISTANCE = 110;

/** Finger travel is damped so the pull feels weighted instead of 1:1. */
const DRAG_RATIO = 0.5;

/** Movement below this is treated as a tap, never as a pull. */
const START_SLOP = 8;

/** A pull must be clearly more vertical than horizontal, keeping card/deck swipes working. */
const VERTICAL_DOMINANCE = 1.2;

/** Snap-back / settle animation. */
const SETTLE_MS = 220;

/** True only when the page is scrolled to the very top, whichever element is the real scroller. */
function isPageAtTop(scrollElement: HTMLElement): boolean {
  if (scrollElement.scrollTop > 0) return false;

  // This layout grows <main> to its content height, so the document is the element that scrolls.
  const docScroller = document.scrollingElement || document.documentElement;
  if (docScroller && docScroller.scrollTop > 0) return false;
  if (document.body && document.body.scrollTop > 0) return false;
  if (typeof window.scrollY === 'number' && window.scrollY > 0) return false;

  return true;
}

export interface PullToRefreshProps {
  /** True only inside the Android app AND on the Home/Discover view. */
  enabled: boolean;
  /** The existing data-loading function of the page (never a second implementation). */
  onRefresh: () => void | Promise<void>;
  /** The element that actually scrolls the page (the one with overflow-y-auto). */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** Finger travel required to trigger a refresh. */
  threshold?: number;
  children: React.ReactNode;
}

export function PullToRefresh({
  enabled,
  onRefresh,
  scrollRef,
  threshold = PULL_THRESHOLD,
  children,
}: PullToRefreshProps) {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // The refresh callback is kept in a ref so a new function identity never re-attaches the gesture
  // listeners and never restarts the effect.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const refreshingRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!enabled || !scrollElement) {
      return undefined;
    }

    const applyOffset = (value: number) => {
      offsetRef.current = value;
      setOffset(value);
    };

    const endPull = () => {
      draggingRef.current = false;
      setIsDragging(false);
    };

    function resetPull() {
      endPull();
      applyOffset(0);
    }

    /** Runs the page's single existing refresh. Guarded so a refresh can never overlap another. */
    async function startRefresh() {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      setIsRefreshing(true);
      // Hold the badge in the open position while the request is in flight.
      applyOffset(threshold);
      try {
        await onRefreshRef.current();
      } catch (error) {
        // A failed refresh must never leave the indicator stuck or break scrolling.
        console.debug('Pull-to-refresh failed:', error);
      } finally {
        refreshingRef.current = false;
        setIsRefreshing(false);
        applyOffset(0);
      }
    }

    function handleTouchStart(event: TouchEvent) {
      // A second finger or an in-flight refresh means this is not a pull-to-refresh gesture.
      if (refreshingRef.current || event.touches.length !== 1) {
        draggingRef.current = false;
        return;
      }
      const touch = event.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      draggingRef.current = false;
    }

    function handleTouchMove(event: TouchEvent) {
      if (refreshingRef.current || event.touches.length !== 1) return;

      const touch = event.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      // Not this gesture: the page is scrolled away from the very top, or the finger is moving up
      // (a normal scroll down the page). Native scrolling stays in charge, and the pull is measured
      // from wherever the finger is once the page is actually back at the top.
      if (!isPageAtTop(scrollElement) || deltaY <= 0) {
        if (draggingRef.current) resetPull();
        startXRef.current = touch.clientX;
        startYRef.current = touch.clientY;
        return;
      }

      if (!draggingRef.current) {
        if (deltaY < START_SLOP) return;
        // Horizontal-dominant movement belongs to the card/deck swipe flows, not to us.
        if (Math.abs(deltaY) < Math.abs(deltaX) * VERTICAL_DOMINANCE) return;
        draggingRef.current = true;
        setIsDragging(true);
      }

      // Only from here on is the native scroll suppressed - and only while the finger keeps pulling.
      // Moving up again (or reaching a non-top scroll position) is released by the branch above.
      if (event.cancelable) event.preventDefault();
      applyOffset(Math.min(MAX_PULL_DISTANCE, deltaY * DRAG_RATIO));
    }

    function handleTouchEnd() {
      if (!draggingRef.current) return;
      const shouldRefresh = offsetRef.current >= threshold && !refreshingRef.current;
      endPull();
      if (shouldRefresh) {
        void startRefresh();
      } else {
        applyOffset(0);
      }
    }

    scrollElement.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollElement.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollElement.addEventListener('touchend', handleTouchEnd);
    scrollElement.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      scrollElement.removeEventListener('touchstart', handleTouchStart);
      scrollElement.removeEventListener('touchmove', handleTouchMove);
      scrollElement.removeEventListener('touchend', handleTouchEnd);
      scrollElement.removeEventListener('touchcancel', handleTouchEnd);
      draggingRef.current = false;
      setIsDragging(false);
      applyOffset(0);
    };
  }, [enabled, scrollRef, threshold]);

  const progress = Math.min(1, offset / threshold);

  return (
    <div className="relative w-full">
      {/* Refresh badge, revealed by the gap the pulled content leaves behind. Never interactive. */}
      <div
        className="absolute left-0 right-0 top-0 flex items-end justify-center overflow-hidden pointer-events-none"
        style={{ height: `${offset}px` }}
        aria-hidden="true"
      >
        <div
          className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-stone-900 border border-stone-800 shadow-lg text-rose-400"
          style={{ opacity: isRefreshing ? 1 : progress }}
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
            style={isRefreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
          />
        </div>
      </div>

      {/* Page content. The transform only exists mid-pull/mid-refresh and is cleared afterwards. */}
      <div
        style={{
          transform: offset > 0 ? `translateY(${offset}px)` : undefined,
          transition: isDragging
            ? 'none'
            : `transform ${SETTLE_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}