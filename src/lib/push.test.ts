// Focused tests for the server-side push helpers (src/lib/push.ts).
//
// Run with:  npm run test:server
//            (node --import tsx --test src/lib/push.test.ts)
//
// No network, no credentials and no real FCM send are involved: the Admin SDK client is replaced by
// a fake that records the exact request, so the generated FCM request/payload is verified safely.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANDROID_PLATFORM,
  WEB_PLATFORM,
  buildAndroidMulticastRequest,
  buildChatMessagePushData,
  classifyMulticastResults,
  isStaleRegistrationTokenError,
  isUsableToken,
  maskToken,
  selectPlatformTokens,
  sendAndroidChatMessagePush,
  type AndroidMulticastMessage,
  type ChatMessagePushSource,
  type MulticastMessaging,
  type PushTokenRow,
} from './push.ts';

/** Long enough to pass the registration endpoint's 20-character minimum. */
const ANDROID_TOKEN_A = 'android_token_aaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const ANDROID_TOKEN_B = 'android_token_bbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const WEB_TOKEN = 'web_token_cccccccccccccccccccccccccccccc';

const MESSAGE: ChatMessagePushSource = {
  id: 'msg_1727000000_ab12',
  conversation_id: 'conv_987654321',
  sender_id: 'user_sender_1',
  content: 'Hey! How are you?',
  message_type: 'text',
  sender_name: 'Alex',
};

function rows(...entries: Array<[string, string]>): PushTokenRow[] {
  return entries.map(([token, platform]) => ({ token, platform }));
}

/** Minimal stand-in for firebase-admin's Messaging that captures what it was asked to send. */
function fakeMessaging(
  respond: (request: AndroidMulticastMessage) => Array<{ success: boolean; code?: string }>
) {
  const calls: AndroidMulticastMessage[] = [];
  const messaging: MulticastMessaging = {
    async sendEachForMulticast(request) {
      calls.push(request);
      return {
        responses: respond(request).map((entry) =>
          entry.success
            ? { success: true }
            : { success: false, error: { code: entry.code ?? 'messaging/internal-error' } }
        ),
      };
    },
  };
  return { messaging, calls };
}

test('platform filtering selects android tokens only', () => {
  const selection = selectPlatformTokens(
    rows([ANDROID_TOKEN_A, ANDROID_PLATFORM], [WEB_TOKEN, WEB_PLATFORM], [ANDROID_TOKEN_B, 'android']),
    ANDROID_PLATFORM
  );

  assert.deepEqual(selection, [ANDROID_TOKEN_A, ANDROID_TOKEN_B]);
  assert.ok(!selection.includes(WEB_TOKEN), 'a web token must never reach the Android sender');
});

test('platform filtering is strict about labels, blanks and duplicates', () => {
  assert.deepEqual(selectPlatformTokens(rows([ANDROID_TOKEN_A, 'ANDROID']), ANDROID_PLATFORM), [
    ANDROID_TOKEN_A,
  ]);
  assert.deepEqual(selectPlatformTokens(rows([ANDROID_TOKEN_A, 'ios']), ANDROID_PLATFORM), []);
  assert.deepEqual(selectPlatformTokens(rows([ANDROID_TOKEN_A, '']), ANDROID_PLATFORM), []);
  assert.deepEqual(selectPlatformTokens(rows(['too-short', ANDROID_PLATFORM]), ANDROID_PLATFORM), []);
  assert.deepEqual(
    selectPlatformTokens(
      rows([ANDROID_TOKEN_A, ANDROID_PLATFORM], [` ${ANDROID_TOKEN_A} `, ANDROID_PLATFORM]),
      ANDROID_PLATFORM
    ),
    [ANDROID_TOKEN_A],
    'duplicates collapse and values are trimmed'
  );
  assert.deepEqual(selectPlatformTokens(null, ANDROID_PLATFORM), []);
  assert.deepEqual(selectPlatformTokens(rows([ANDROID_TOKEN_A, ANDROID_PLATFORM]), ''), []);
});

test('android payload mirrors the existing web payload fields exactly', () => {
  const data = buildChatMessagePushData(MESSAGE);

  assert.deepEqual(Object.keys(data).sort(), [
    'conversationId',
    'messageId',
    'messageType',
    'preview',
    'senderId',
    'senderName',
    'type',
  ]);
  assert.deepEqual(data, {
    messageId: MESSAGE.id,
    conversationId: MESSAGE.conversation_id,
    senderId: MESSAGE.sender_id,
    senderName: MESSAGE.sender_name,
    preview: MESSAGE.content,
    messageType: MESSAGE.message_type,
    type: 'chat_message',
  });
});

test('android payload defaults keep LovemeetlyMessagingService able to render it', () => {
  const data = buildChatMessagePushData({
    id: 'msg_1',
    conversation_id: 'conv_1',
    sender_id: 'user_1',
  });

  // The native service requires one of these two identifiers, otherwise it shows nothing.
  assert.ok(data.messageId || data.conversationId);
  assert.equal(data.messageType, 'text');
  assert.equal(data.preview, '');
  assert.equal(data.senderName, '');
  assert.equal(data.type, 'chat_message');
});

test('preview is clamped exactly like the web path', () => {
  const long = 'x'.repeat(500);
  const data = buildChatMessagePushData({ ...MESSAGE, content: long });

  assert.equal(data.preview.length, 140);
  assert.equal(data.preview, long.slice(0, 140));
});

test('android payload can never be mistaken for an incoming call', () => {
  const data = buildChatMessagePushData(MESSAGE);
  const callDiscriminators = ['call_incoming', 'call:incoming', 'incoming_call', 'call:ended'];

  assert.ok(!callDiscriminators.includes(data.type));
  assert.ok(!('callId' in data) && !('callerId' in data));
});

test('multicast request is data-only, high priority, and never targets web tokens', () => {
  const request = buildAndroidMulticastRequest([ANDROID_TOKEN_A, ANDROID_TOKEN_B], MESSAGE);

  assert.deepEqual(request.tokens, [ANDROID_TOKEN_A, ANDROID_TOKEN_B]);
  assert.deepEqual(request.android, { priority: 'high' });
  assert.deepEqual(request.data, buildChatMessagePushData(MESSAGE));
  // No `notification` block: the SDK must not auto-display; LovemeetlyMessagingService does.
  assert.equal('notification' in request, false);
  // No `webpush` block: the web delivery options stay in the untouched web sender.
  assert.equal('webpush' in request, false);
  assert.equal('apns' in request, false);
});

test('only permanently invalid tokens are classified as stale', () => {
  assert.equal(isStaleRegistrationTokenError('messaging/registration-token-not-registered'), true);
  assert.equal(isStaleRegistrationTokenError('messaging/invalid-registration-token'), true);

  const transient: Array<string | null | undefined> = [
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/quota-exceeded',
    'messaging/third-party-auth-error',
    'messaging/invalid-argument',
    'messaging/unknown-error',
    '',
    null,
    undefined,
  ];
  for (const code of transient) {
    assert.equal(isStaleRegistrationTokenError(code), false, String(code));
  }
});

test('classification splits delivered, failed and stale tokens', () => {
  const tokens = [ANDROID_TOKEN_A, ANDROID_TOKEN_B, WEB_TOKEN];
  const result = classifyMulticastResults(
    [
      { success: true },
      { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      { success: false, error: { code: 'messaging/quota-exceeded' } },
    ],
    tokens
  );

  assert.deepEqual(result.staleTokens, [ANDROID_TOKEN_B]);
  assert.equal(result.delivered, 1);
  assert.equal(result.failed, 2);
  assert.deepEqual(result.errorCodes, [
    'messaging/registration-token-not-registered',
    'messaging/quota-exceeded',
  ]);
});

test('classification is defensive about malformed or missing responses', () => {
  assert.deepEqual(classifyMulticastResults(null, [ANDROID_TOKEN_A]), {
    staleTokens: [],
    delivered: 0,
    failed: 0,
    errorCodes: [],
  });
  assert.deepEqual(classifyMulticastResults([], [ANDROID_TOKEN_A]), {
    staleTokens: [],
    delivered: 0,
    failed: 0,
    errorCodes: [],
  });
  assert.deepEqual(classifyMulticastResults([{ success: false }], []), {
    staleTokens: [],
    delivered: 0,
    failed: 1,
    errorCodes: [],
  });
});

test('sendAndroidChatMessagePush issues exactly one multicast with the android request', async () => {
  const { messaging, calls } = fakeMessaging(() => [{ success: true }, { success: true }]);

  const result = await sendAndroidChatMessagePush(
    messaging,
    [ANDROID_TOKEN_A, ANDROID_TOKEN_B],
    MESSAGE
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].tokens, [ANDROID_TOKEN_A, ANDROID_TOKEN_B]);
  assert.deepEqual(calls[0].android, { priority: 'high' });
  assert.equal(calls[0].data.type, 'chat_message');
  assert.equal(result.delivered, 2);
  assert.deepEqual(result.staleTokens, []);
});

test('a transient failure never marks a token stale (no deletion on a single failure)', async () => {
  const { messaging } = fakeMessaging(() => [
    { success: false, code: 'messaging/server-unavailable' },
  ]);

  const result = await sendAndroidChatMessagePush(messaging, [ANDROID_TOKEN_A], MESSAGE);

  assert.deepEqual(result.staleTokens, []);
  assert.equal(result.failed, 1);
});

test('an unregistered token is reported back for cleanup', async () => {
  const { messaging } = fakeMessaging(() => [
    { success: true },
    { success: false, code: 'messaging/registration-token-not-registered' },
  ]);

  const result = await sendAndroidChatMessagePush(
    messaging,
    [ANDROID_TOKEN_A, ANDROID_TOKEN_B],
    MESSAGE
  );

  assert.deepEqual(result.staleTokens, [ANDROID_TOKEN_B]);
  assert.equal(result.delivered, 1);
});

test('maskToken never emits a full token', () => {
  const masked = maskToken(ANDROID_TOKEN_A);

  assert.equal(masked, 'android_...');
  assert.ok(!masked.includes(ANDROID_TOKEN_A));
  assert.equal(maskToken(''), '(none)');
  assert.equal(maskToken(null), '(none)');
  assert.equal(maskToken('short'), 's***');
});

test('token usability matches the registration endpoint minimum', () => {
  assert.equal(isUsableToken('12345678901234567890'), true);
  assert.equal(isUsableToken('1234567890123456789'), false);
  assert.equal(isUsableToken('   '), false);
  assert.equal(isUsableToken(null), false);
});