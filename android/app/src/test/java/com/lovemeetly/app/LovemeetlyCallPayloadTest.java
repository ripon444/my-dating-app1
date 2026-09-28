package com.lovemeetly.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.HashMap;
import java.util.Map;

/**
 * Routing guard for the closed-app push paths: chat/account pushes must keep going to the normal
 * message notification path, and only genuine call payloads may reach the ringing call path.
 */
public class LovemeetlyCallPayloadTest {

    private static Map<String, String> data(String... keysAndValues) {
        Map<String, String> map = new HashMap<>();
        for (int i = 0; i + 1 < keysAndValues.length; i += 2) {
            map.put(keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }

    @Test
    public void chatMessagePushIsNotTreatedAsCall() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(
                        data(
                                "type", "chat_message",
                                "messageId", "msg_1",
                                "conversationId", "conv_1",
                                "senderName", "Alex",
                                "preview", "Hello there"));

        assertFalse(payload.isIncoming());
        assertFalse(payload.isEnded());
        assertTrue(payload.isEmpty());
    }

    @Test
    public void unrelatedNotificationPushIsNotTreatedAsCall() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(data("type", "follow", "title", "New follower"));

        assertFalse(payload.isIncoming());
        assertFalse(payload.isEnded());
    }

    @Test
    public void zeroDataMessageIsNotTreatedAsCall() {
        LovemeetlyCallPayload payload = LovemeetlyCallPayload.fromData(new HashMap<>());

        assertFalse(payload.isIncoming());
        assertFalse(payload.isEnded());
        assertTrue(payload.isEmpty());
    }

    @Test
    public void callPushIsTreatedAsCallAndMapped() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(
                        data(
                                "type", "call_incoming",
                                "callId", "call_1727000000_ab12",
                                "callerId", "user_42",
                                "callerName", "Alex",
                                "callerPhoto", "https://cdn.example/photo.jpg",
                                "callType", "video",
                                "receiverId", "user_7"));

        assertTrue(payload.isIncoming());
        assertEquals("call_1727000000_ab12", payload.callId);
        assertEquals("user_42", payload.callerId);
        assertEquals("Alex", payload.displayName("fallback"));
        assertTrue(payload.isVideoCall());
        assertEquals("call_1727000000_ab12", payload.dedupeKey());
    }

    @Test
    public void snakeCaseAliasesAreSupported() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(
                        data(
                                "type", "call:incoming",
                                "call_id", "call_abc",
                                "caller_id", "user_9",
                                "caller_name", "Sam",
                                "call_type", "voice"));

        assertTrue(payload.isIncoming());
        assertEquals("call_abc", payload.callId);
        assertEquals("user_9", payload.callerId);
        assertEquals("Sam", payload.callerName);
        assertFalse(payload.isVideoCall());
    }

    @Test
    public void callEndedPushOnlySilencesTheRing() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(data("type", "call_ended", "callId", "call_abc"));

        assertTrue(payload.isEnded());
        assertFalse(payload.isIncoming());
    }

    @Test
    public void payloadWithoutDiscriminatorButWithCallIdentityIsIncoming() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(data("callId", "call_x", "callerId", "user_1"));

        assertTrue(payload.isIncoming());
    }

    @Test
    public void dedupeKeyFallsBackToCallerWhenCallIdIsMissing() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(data("type", "call_incoming", "callerId", "user_5"));

        assertEquals("caller:user_5", payload.dedupeKey());
    }

    /**
     * Contract with the server-side Android FCM call sender (src/lib/push.ts ->
     * buildCallIncomingPushData): these are the exact keys it emits, and the optional display fields
     * are omitted when the caller profile has no name/photo. The push must still ring and fall back to
     * the default caller label instead of rendering a blank name.
     */
    @Test
    public void serverCallPushPayloadContractRingsWithFallbackName() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(
                        data(
                                "type", "call_incoming",
                                "callId", "call_1727000000_ab12",
                                "callerId", "usr_caller",
                                "receiverId", "usr_receiver",
                                "callType", "voice"));

        assertTrue(payload.isIncoming());
        assertFalse(payload.isEnded());
        assertFalse(payload.isEmpty());
        assertFalse(payload.isVideoCall());
        assertEquals("call_1727000000_ab12", payload.callId);
        assertEquals("usr_caller", payload.callerId);
        assertEquals("usr_receiver", payload.receiverId);
        assertEquals("Lovemeetly member", payload.displayName("Lovemeetly member"));
    }
}