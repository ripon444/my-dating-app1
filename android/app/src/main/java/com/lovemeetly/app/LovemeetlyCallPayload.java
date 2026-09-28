package com.lovemeetly.app;

import android.content.Intent;

import androidx.annotation.Nullable;

import java.util.Map;

/**
 * Incoming-call push payload for the closed-app Android path.
 *
 * <p>The Lovemeetly backend already describes a call with the socket {@code call:incoming}
 * {@code Call} object ({@code id}, {@code caller_id}, {@code receiver_id}, {@code type}). This class
 * maps those field names (plus the snake_case aliases the web service worker already tolerates) into
 * the flat string map FCM data messages use, so no new payload format is invented:
 *
 * <pre>
 * type        call_incoming | call:incoming | incoming_call   (required discriminator)
 * callId      calls.id                                        (required: stable id, de-duplication)
 * callerId    calls.caller_id                                 (required for Answer)
 * callType    voice | video                                   (optional, default voice)
 * callerName  caller profile name                             (optional, display only)
 * callerPhoto caller profile photo URL                        (optional, display only)
 * receiverId  calls.receiver_id                               (optional)
 * </pre>
 *
 * <p>A payload whose {@code type} is one of the "ended" values only silences an existing ring.
 */
public final class LovemeetlyCallPayload {

    /** Discriminator values that mean "this is an incoming call". */
    private static final String[] INCOMING_TYPES = {
        "call_incoming", "call:incoming", "incoming_call", "call:initiate"
    };

    /** Discriminator values that mean "the ringing call is over". */
    private static final String[] ENDED_TYPES = {
        "call_ended", "call:ended", "call_cancelled", "call:cancelled", "call_rejected", "call:rejected"
    };

    public static final String DEFAULT_CALL_TYPE = "voice";

    public final String type;
    public final String callId;
    public final String callerId;
    public final String callerName;
    public final String callerPhoto;
    public final String callType;
    public final String receiverId;

    private LovemeetlyCallPayload(
            String type,
            String callId,
            String callerId,
            String callerName,
            String callerPhoto,
            String callType,
            String receiverId) {
        this.type = type;
        this.callId = callId;
        this.callerId = callerId;
        this.callerName = callerName;
        this.callerPhoto = callerPhoto;
        this.callType = callType;
        this.receiverId = receiverId;
    }

    /** Reads the payload from an FCM data message. Never returns null. */
    public static LovemeetlyCallPayload fromData(@Nullable Map<String, String> data) {
        if (data == null) {
            return new LovemeetlyCallPayload("", "", "", "", "", DEFAULT_CALL_TYPE, "");
        }
        return new LovemeetlyCallPayload(
                firstNonEmpty(data.get("type"), data.get("event"), data.get("eventName")),
                firstNonEmpty(data.get("callId"), data.get("call_id")),
                firstNonEmpty(data.get("callerId"), data.get("caller_id")),
                firstNonEmpty(data.get("callerName"), data.get("caller_name")),
                firstNonEmpty(
                        data.get("callerPhoto"), data.get("caller_photo"), data.get("callerAvatar")),
                callTypeValue(firstNonEmpty(data.get("callType"), data.get("call_type"))),
                firstNonEmpty(data.get("receiverId"), data.get("receiver_id")));
    }

    /** Reads the payload from an Intent this app created for a ringing call. */
    @Nullable
    public static LovemeetlyCallPayload fromIntent(@Nullable Intent intent) {
        if (intent == null) {
            return null;
        }
        String callId = firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_CALL_ID));
        String callerId =
                firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_CALLER_ID));
        if (callId.isEmpty() && callerId.isEmpty()) {
            return null;
        }
        return new LovemeetlyCallPayload(
                firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_TYPE)),
                callId,
                callerId,
                firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_CALLER_NAME)),
                firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_CALLER_PHOTO)),
                callTypeValue(
                        firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_CALL_TYPE))),
                firstNonEmpty(intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_RECEIVER_ID)));
    }

    /** Copies every call field into an Intent used by the ringing UI and the notification actions. */
    public void putInto(Intent intent) {
        if (intent == null) {
            return;
        }
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_TYPE, type);
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_CALL_ID, callId);
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_CALLER_ID, callerId);
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_CALLER_NAME, callerName);
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_CALLER_PHOTO, callerPhoto);
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_CALL_TYPE, callType);
        intent.putExtra(LovemeetlyCallNotifications.EXTRA_RECEIVER_ID, receiverId);
    }

    /** True when this push starts a ring. */
    public boolean isIncoming() {
        if (matches(type, ENDED_TYPES)) {
            return false;
        }
        if (matches(type, INCOMING_TYPES)) {
            return true;
        }
        // Tolerate a payload that carries only the call identity (no discriminator).
        return type.isEmpty() && (!callId.isEmpty() || !callerId.isEmpty());
    }

    /** True when this push only tells us an already-ringing call is over. */
    public boolean isEnded() {
        return matches(type, ENDED_TYPES);
    }

    /** True when there is nothing callable in the payload. */
    public boolean isEmpty() {
        return callId.isEmpty() && callerId.isEmpty();
    }

    public boolean isVideoCall() {
        return "video".equals(callType);
    }

    /**
     * Key used to guarantee the same call event never rings twice. The server generated
     * {@code calls.id} is stable for a call, so re-deliveries collapse onto one notification.
     */
    public String dedupeKey() {
        return !callId.isEmpty() ? callId : "caller:" + callerId;
    }

    /** Caller name for display, never empty. */
    public String displayName(String fallback) {
        return !callerName.isEmpty() ? callerName : fallback;
    }

    private static String callTypeValue(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase();
        return "video".equals(value) ? "video" : DEFAULT_CALL_TYPE;
    }

    private static boolean matches(String value, String[] candidates) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        for (String candidate : candidates) {
            if (candidate.equalsIgnoreCase(value)) {
                return true;
            }
        }
        return false;
    }

    private static String firstNonEmpty(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }
}