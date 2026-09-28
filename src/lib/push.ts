// Server-side push delivery helpers for Lovemeetly.
//
// Scope: this module BUILDS and SENDS the Android data-only payloads (chat messages, incoming-call
// rings and app-update announcements) consumed by LovemeetlyMessagingService. The existing web-push
// sender in server.ts keeps its own logic and payload untouched: the Android chat payload mirrors
// those fields 1:1 so both platforms show the same copy, the Android call payload maps the fields
// LovemeetlyCallPayload already parses (no new call protocol, no web call behaviour change), and the
// app_update payload is a new, additive notification type that never touches the chat/call paths.
//
// Nothing here authenticates or holds credentials: the Firebase Admin credential is configured once
// in src/lib/firebase-admin.ts (reused, never duplicated) and FCM tokens are opaque device values.

/** The subset of a `push_tokens` row used by the senders. */
export interface PushTokenRow {
  token?: string | null;
  platform?: string | null;
}

/** The subset of a firebase-admin per-token send response this module relies on. */
export interface MulticastSendResponse {
  success: boolean;
  error?: { code?: string | null } | null;
}

/** Exact request shape handed to `Messaging.sendEachForMulticast` for Android. */
export interface AndroidMulticastMessage {
  tokens: string[];
  data: Record<string, string>;
  android: { priority: 'high' };
}

/**
 * The subset of firebase-admin's `Messaging` this module uses. Keeping it structural means the
 * payload/classification logic can be unit tested without network access or credentials.
 */
export interface MulticastMessaging {
  sendEachForMulticast(message: AndroidMulticastMessage): Promise<{
    responses: MulticastSendResponse[];
  }>;
}

/** A chat message as stored and emitted by the existing message flow. */
export interface ChatMessagePushSource {
  id: string;
  conversation_id: string;
  sender_id: string;
  content?: string | null;
  message_type?: string | null;
  sender_name?: string | null;
}

/** Result of one multicast send, split into "remove the row" vs "retry later". */
export interface MulticastClassification {
  /** Tokens FCM reports as permanently unregistered/invalid: safe to delete. */
  staleTokens: string[];
  delivered: number;
  failed: number;
  /** Distinct FCM error codes seen (for classification logging only, never the tokens). */
  errorCodes: string[];
}

export const WEB_PLATFORM = 'web';
export const ANDROID_PLATFORM = 'android';

/** Same minimum length the /api/push-tokens endpoint enforces. */
export const MIN_FCM_TOKEN_LENGTH = 20;

/** Mirrors the existing web push preview clamp. */
const MAX_PREVIEW_LENGTH = 140;

/** Only this many characters of a token may ever reach the logs. */
const TOKEN_LOG_PREFIX_LENGTH = 8;

/**
 * FCM error codes that mean the registration token can never be used again. Transient failures
 * (quota, server unavailable, internal error, auth problems) are deliberately NOT listed: a single
 * failed attempt must never delete a valid token.
 */
const STALE_TOKEN_ERROR_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

/** Log-safe token form: a short prefix plus an ellipsis, never the full token. */
export function maskToken(token?: string | null): string {
  const value = typeof token === 'string' ? token.trim() : '';
  if (!value) return '(none)';
  if (value.length <= TOKEN_LOG_PREFIX_LENGTH) {
    return `${value.charAt(0)}***`;
  }
  return `${value.slice(0, TOKEN_LOG_PREFIX_LENGTH)}...`;
}

/** True when a token is syntactically usable (same rule as the registration endpoint). */
export function isUsableToken(token?: string | null): boolean {
  return typeof token === 'string' && token.trim().length >= MIN_FCM_TOKEN_LENGTH;
}

/**
 * Tokens of one platform only, de-duplicated and trimmed.
 *
 * Deliberately strict about the platform: an Android send must never include a web token and vice
 * versa, which is what keeps the two delivery paths independent.
 */
export function selectPlatformTokens(
  rows: PushTokenRow[] | null | undefined,
  platform: string
): string[] {
  if (!Array.isArray(rows) || !platform) return [];
  const wanted = platform.trim().toLowerCase();
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const row of rows) {
    const rowPlatform = typeof row?.platform === 'string' ? row.platform.trim().toLowerCase() : '';
    if (rowPlatform !== wanted) continue;
    const token = typeof row?.token === 'string' ? row.token.trim() : '';
    if (!isUsableToken(token) || seen.has(token)) continue;
    seen.add(token);
    tokens.push(token);
  }
  return tokens;
}

/** True only for FCM codes that mean "this registration token is gone for good". */
export function isStaleRegistrationTokenError(code?: string | null): boolean {
  if (typeof code !== 'string') return false;
  return STALE_TOKEN_ERROR_CODES.includes(code.trim());
}

/**
 * The push `data` map for a chat message.
 *
 * Field-for-field identical to the existing web push payload (messageId, conversationId, senderId,
 * senderName, preview, messageType, type) so `LovemeetlyMessagingService.displayDataMessage()` -
 * which mirrors the web service worker - renders the same title/body on Android.
 */
export function buildChatMessagePushData(
  message: ChatMessagePushSource
): Record<string, string> {
  const preview =
    typeof message?.content === 'string' ? message.content.slice(0, MAX_PREVIEW_LENGTH) : '';
  const messageType = message?.message_type || 'text';
  return {
    messageId: message?.id || '',
    conversationId: message?.conversation_id || '',
    senderId: message?.sender_id || '',
    senderName: message?.sender_name || '',
    preview,
    messageType,
    type: 'chat_message',
  };
}

/**
 * The exact multicast request for Android: data-only (so the native service - not the SDK - renders
 * the notification), high priority so it is delivered to a backgrounded or killed app, and
 * explicitly NO `notification` block and NO `webpush` block.
 */
export function buildAndroidMulticastRequest(
  tokens: string[],
  message: ChatMessagePushSource
): AndroidMulticastMessage {
  return {
    tokens: tokens.slice(),
    data: buildChatMessagePushData(message),
    android: { priority: 'high' },
  };
}

/** Splits per-token send responses into cleanup candidates vs plain failures. */
export function classifyMulticastResults(
  responses: MulticastSendResponse[] | null | undefined,
  tokens: string[]
): MulticastClassification {
  const staleTokens: string[] = [];
  const errorCodes: string[] = [];
  let delivered = 0;
  let failed = 0;

  const list = Array.isArray(responses) ? responses : [];
  for (let index = 0; index < list.length; index += 1) {
    const response = list[index];
    if (response?.success) {
      delivered += 1;
      continue;
    }
    failed += 1;
    const code = typeof response?.error?.code === 'string' ? response.error.code.trim() : '';
    if (code && !errorCodes.includes(code)) {
      errorCodes.push(code);
    }
    const token = tokens[index];
    if (token && isStaleRegistrationTokenError(code) && !staleTokens.includes(token)) {
      staleTokens.push(token);
    }
  }

  return { staleTokens, delivered, failed, errorCodes };
}

/**
 * Sends one chat-message push to Android devices through the existing Admin SDK instance.
 *
 * @param messaging the shared `adminMessaging` instance (never a second configuration)
 * @returns the per-token classification; never deletes anything itself
 */
export async function sendAndroidChatMessagePush(
  messaging: MulticastMessaging,
  tokens: string[],
  message: ChatMessagePushSource
): Promise<MulticastClassification> {
  const request = buildAndroidMulticastRequest(tokens, message);
  const response = await messaging.sendEachForMulticast(request);
  return classifyMulticastResults(response?.responses, request.tokens);
}

/** An incoming call exactly as the existing POST /api/calls route stores/emits it. */
export interface CallIncomingPushSource {
  /** calls.id */
  id: string;
  /** calls.caller_id */
  caller_id: string;
  /** calls.receiver_id */
  receiver_id: string;
  /** 'voice' | 'video' (defaults to voice, same rule as the native parser). */
  type?: string | null;
  /** Caller display name (profiles.name). Display only. */
  caller_name?: string | null;
  /** Caller photo URL. Display only. */
  caller_photo?: string | null;
}

/**
 * Discriminator understood by LovemeetlyCallPayload.INCOMING_TYPES
 * (call_incoming | call:incoming | incoming_call | call:initiate).
 */
export const CALL_INCOMING_TYPE = 'call_incoming';

/**
 * The push `data` map for an incoming call.
 *
 * Field names are the ones `LovemeetlyCallPayload.fromData` already reads - callId, callerId,
 * callerName, callerPhoto, callType, receiverId - and the values come straight from the existing call
 * record, so the native ringing screen (channel, ringtone, full-screen intent, Answer/Decline) is
 * reused unchanged. Optional fields are omitted while empty so the native copy falls back to its own
 * default caller label instead of rendering a blank name.
 */
export function buildCallIncomingPushData(call: CallIncomingPushSource): Record<string, string> {
  const data: Record<string, string> = {
    type: CALL_INCOMING_TYPE,
    callId: typeof call?.id === 'string' ? call.id : '',
    callerId: typeof call?.caller_id === 'string' ? call.caller_id : '',
    receiverId: typeof call?.receiver_id === 'string' ? call.receiver_id : '',
    callType:
      typeof call?.type === 'string' && call.type.trim().toLowerCase() === 'video'
        ? 'video'
        : 'voice',
  };

  const callerName = typeof call?.caller_name === 'string' ? call.caller_name.trim() : '';
  if (callerName) data.callerName = callerName;

  const callerPhoto = typeof call?.caller_photo === 'string' ? call.caller_photo.trim() : '';
  if (callerPhoto) data.callerPhoto = callerPhoto;

  return data;
}

/**
 * The exact multicast request for an incoming call: identical shape to the chat one - data-only (the
 * SDK must never auto-display, or the ring could not be intercepted), high priority so a backgrounded
 * or killed app still rings, and explicitly NO `notification` and NO `webpush` block so web delivery
 * stays with the untouched web sender in server.ts.
 */
export function buildAndroidCallMulticastRequest(
  tokens: string[],
  call: CallIncomingPushSource
): AndroidMulticastMessage {
  return {
    tokens: tokens.slice(),
    data: buildCallIncomingPushData(call),
    android: { priority: 'high' },
  };
}

/**
 * Sends one incoming-call ring to Android devices through the existing Admin SDK instance.
 *
 * @param messaging the shared `adminMessaging` instance (never a second configuration)
 * @returns the per-token classification; never deletes anything itself
 */
export async function sendAndroidCallPush(
  messaging: MulticastMessaging,
  tokens: string[],
  call: CallIncomingPushSource
): Promise<MulticastClassification> {
  const request = buildAndroidCallMulticastRequest(tokens, call);
  const response = await messaging.sendEachForMulticast(request);
  return classifyMulticastResults(response?.responses, request.tokens);
}

// -------------------------------------------------------------
// Android app-update notification (type = app_update)
// -------------------------------------------------------------
// Sent when (and only when) an administrator publishes a new APK release through the protected
// POST /api/admin/android-release action. Nothing here runs on a normal app start-up, so ordinary
// usage never sends a push.
//
// Conventions are identical to the chat/call senders above, so the existing native delivery path is
// reused unchanged: data-only (the Firebase SDK must never auto-display it - the app's own
// LovemeetlyMessagingService renders it, deduplicated per versionCode), Android high priority so a
// backgrounded or killed app is reached, and no `webpush` block, so web tokens are never targeted.

/** Discriminator the native LovemeetlyUpdatePayload reads. */
export const APP_UPDATE_TYPE = 'app_update';

/** Notification title - exact copy required by the release notification contract. */
export const APP_UPDATE_TITLE = 'Lovemeetly update available';

/** Turned into the body, e.g. "Lovemeetly 2.0 is now available. Tap to update." */
export function buildAppUpdateNotificationBody(versionName: string): string {
  const name = typeof versionName === 'string' && versionName.trim() ? versionName.trim() : 'update';
  return `Lovemeetly ${name} is now available. Tap to update.`;
}

/** The release fields the update push is built from (a subset of AndroidReleaseMetadata). */
export interface AppUpdatePushSource {
  versionCode: number;
  versionName?: string | null;
  apkUrl: string;
}

/**
 * The push `data` map for an update notification.
 *
 * `type`, `versionCode`, `versionName` and `apkUrl` are the contract LovemeetlyUpdatePayload parses
 * (the tap then hands `apkUrl` to Android's DownloadManager); `title`/`body` are carried too so the
 * native copy is identical to what the server intended, exactly like the chat payload.
 */
export function buildAppUpdatePushData(release: AppUpdatePushSource): Record<string, string> {
  const versionName =
    typeof release?.versionName === 'string' && release.versionName.trim()
      ? release.versionName.trim()
      : String(release?.versionCode ?? '');
  return {
    type: APP_UPDATE_TYPE,
    versionCode: String(release?.versionCode ?? ''),
    versionName,
    apkUrl: typeof release?.apkUrl === 'string' ? release.apkUrl.trim() : '',
    title: APP_UPDATE_TITLE,
    body: buildAppUpdateNotificationBody(versionName),
  };
}

/** Data-only, high-priority request - same shape as the chat/call senders, no `notification` block. */
export function buildAndroidAppUpdateMulticastRequest(
  tokens: string[],
  release: AppUpdatePushSource
): AndroidMulticastMessage {
  return {
    tokens: tokens.slice(),
    data: buildAppUpdatePushData(release),
    android: { priority: 'high' },
  };
}

/**
 * Sends one app-update notification to Android devices through the existing Admin SDK instance.
 *
 * @param messaging the shared `adminMessaging` instance (never a second configuration)
 * @returns the per-token classification; never deletes anything itself
 */
export async function sendAndroidAppUpdatePush(
  messaging: MulticastMessaging,
  tokens: string[],
  release: AppUpdatePushSource
): Promise<MulticastClassification> {
  const request = buildAndroidAppUpdateMulticastRequest(tokens, release);
  const response = await messaging.sendEachForMulticast(request);
  return classifyMulticastResults(response?.responses, request.tokens);
}