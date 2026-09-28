// Native Android incoming-call handoff (closed-app FCM call path).
//
// The ringing itself is native: FCM data push -> LovemeetlyCallNotifications
// (dedicated `lovemeetly_calls` channel, ringtone, vibration, full-screen intent)
// -> LovemeetlyCallActivity. That path must not depend on the WebView runtime.
//
// This module is only the return trip. When the user answers or declines there,
// Android hands the call id + caller information back, and this module resolves it
// into the existing Call object so App.tsx can reuse the EXISTING call flow
// (handleAcceptCall / api.acceptCall / api.rejectCall / CallOverlay / IncomingCallModal).
// No WebRTC or call signalling is implemented here.
import { Capacitor, registerPlugin } from '@capacitor/core';
import { api } from '../services/api';
import type { Call } from '../types';

export type NativeCallHandoffAction = 'answer' | 'decline';

export interface NativeCallAction {
  action: NativeCallHandoffAction;
  callId: string;
  callerId?: string;
  callerName?: string;
  callerPhoto?: string;
  callType?: 'voice' | 'video';
  receiverId?: string;
}

interface LovemeetlyCallPluginApi {
  consumePendingCallAction(): Promise<Partial<NativeCallAction>>;
  dismissIncomingCall(): Promise<void>;
  addListener(
    eventName: 'callAction',
    listener: (data: NativeCallAction) => void
  ): Promise<unknown> | unknown;
  removeAllListeners?(): Promise<void>;
}

const LovemeetlyCall = registerPlugin<LovemeetlyCallPluginApi>('LovemeetlyCall');

export interface NativeCallHandoffHandlers {
  onAnswer: (call: Call) => void;
  onDecline: (callId: string, call: Call | null) => void;
  currentUserId?: () => string | undefined;
}

/** True only inside the Android app; the web/desktop build stays untouched. */
export function isNativeCallHandoffSupported(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

let initialized = false;

/**
 * Resolves the call the native side handed over into the Call shape the existing
 * call UI consumes. Primary source is the existing call history API (the call row
 * is created by POST /api/calls before any push is sent); the caller profile is
 * only fetched when the call is missing from history.
 */
async function resolveHandoffCall(
  action: NativeCallAction,
  currentUserId?: string
): Promise<Call | null> {
  if (!action?.callId) return null;

  try {
    const history = await api.getCallHistory();
    const existing = (history?.calls || []).find((candidate) => candidate.id === action.callId);
    if (existing) return existing;
  } catch {
    // Fall through to the minimal reconstruction below.
  }

  if (!action.callerId) return null;
  try {
    const { profile } = await api.getPublicProfile(action.callerId);
    if (!profile) return null;
    // Minimal stand-in: the existing call UI only reads id/participants/type plus
    // the other participant's profile, which is the caller for a received call.
    return {
      id: action.callId,
      caller_id: action.callerId,
      receiver_id: action.receiverId || currentUserId || '',
      caller_profile: profile,
      type: action.callType === 'video' ? 'video' : 'voice',
      status: 'ringing',
      duration: 0,
      created_at: new Date().toISOString(),
    } as unknown as Call;
  } catch {
    return null;
  }
}

/**
 * Registers the native call listener and drains any decision recorded while the
 * app was closed. Safe to call on every platform; no-op outside Android.
 */
export function initializeNativeCallHandoff(handlers: NativeCallHandoffHandlers): () => void {
  if (!isNativeCallHandoffSupported() || initialized) {
    return () => {};
  }
  initialized = true;

  const handle = async (data: Partial<NativeCallAction> | null | undefined) => {
    const action = data?.action;
    if (action !== 'answer' && action !== 'decline') return;
    if (!data?.callId) return;

    const normalized = { ...data, action } as NativeCallAction;
    const call = await resolveHandoffCall(normalized, handlers.currentUserId?.());

    if (normalized.action === 'decline') {
      handlers.onDecline(normalized.callId, call);
      return;
    }
    if (call) {
      handlers.onAnswer(call);
    }
  };

  // Live app: the native side pushes the decision as soon as it happens.
  try {
    Promise.resolve(
      LovemeetlyCall.addListener('callAction', (data) => {
        void handle(data);
      })
    ).catch(() => {});
  } catch {
    // Plugin unavailable (older build) - the drain below is still attempted.
  }

  // Cold start: the decision was stored natively before the WebView existed.
  Promise.resolve(LovemeetlyCall.consumePendingCallAction())
    .then((pending) => {
      if (pending && pending.action) void handle(pending);
    })
    .catch(() => {});

  return () => {
    try {
      void LovemeetlyCall.removeAllListeners?.();
    } catch {}
    initialized = false;
  };
}

/** Clears an ongoing native ringing notification once the web call UI takes over. */
export function dismissNativeIncomingCall(): void {
  if (!isNativeCallHandoffSupported()) return;
  Promise.resolve(LovemeetlyCall.dismissIncomingCall()).catch(() => {});
}