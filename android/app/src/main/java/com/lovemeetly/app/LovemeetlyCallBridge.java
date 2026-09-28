package com.lovemeetly.app;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;

/**
 * Hands a native Answer/Decline decision back to the app's existing call flow.
 *
 * <p>The closed-app ringing path is native ({@link LovemeetlyCallNotifications} +
 * {@link LovemeetlyCallActivity}), but the call itself still belongs to the existing web/Socket.IO
 * implementation. This bridge is the minimum glue: it publishes the payload the web layer needs
 * (call id + caller information) so {@code src/utils/nativeCallHandoff.ts} can call the existing
 * accept/reject APIs and open the existing {@code CallOverlay}.
 *
 * <p>Two delivery paths, never both for the same decision:
 *
 * <ul>
 *   <li>Web runtime alive ({@link LovemeetlyCallPlugin} attached): delivered immediately as a
 *       {@code callAction} event.
 *   <li>Process cold-started by the notification: stored in SharedPreferences and returned by
 *       {@code consumePendingCallAction()}, expiring after {@link #PENDING_TTL_MS}.
 * </ul>
 */
public final class LovemeetlyCallBridge {

    static final String EVENT_CALL_ACTION = "callAction";

    private static final String TAG = "LovemeetlyCall";
    private static final String PREFS = "lovemeetly_call_handoff";
    private static final String KEY_ACTION = "pending_action";
    private static final String KEY_CALL_ID = "pending_call_id";
    private static final String KEY_CALLER_ID = "pending_caller_id";
    private static final String KEY_CALLER_NAME = "pending_caller_name";
    private static final String KEY_CALL_TYPE = "pending_call_type";
    private static final String KEY_RECEIVER_ID = "pending_receiver_id";
    private static final String KEY_PENDING_AT = "pending_at";

    /** A decision older than this is stale (the call is long over) and is dropped. */
    private static final long PENDING_TTL_MS = 120_000L;

    private static volatile LovemeetlyCallPlugin plugin;

    private LovemeetlyCallBridge() {}

    static void attachPlugin(LovemeetlyCallPlugin instance) {
        plugin = instance;
    }

    static void detachPlugin(LovemeetlyCallPlugin instance) {
        if (plugin == instance) {
            plugin = null;
        }
    }

    /** Publishes the handoff carried by an Intent MainActivity was launched/resumed with. */
    static void publishFromIntent(Context context, @Nullable Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getStringExtra(LovemeetlyCallNotifications.EXTRA_ACTION);
        LovemeetlyCallPayload payload = LovemeetlyCallPayload.fromIntent(intent);
        if (action == null || action.isEmpty() || payload == null || payload.isEmpty()) {
            return;
        }
        publish(context, payload, action);
        intent.removeExtra(LovemeetlyCallNotifications.EXTRA_ACTION);
    }

    static void publish(Context context, LovemeetlyCallPayload payload, String action) {
        if (context == null || payload == null || action == null || action.isEmpty()) {
            return;
        }
        LovemeetlyCallPlugin target = plugin;
        if (target != null) {
            try {
                target.deliver(toJsObject(payload, action));
                clearPending(context);
                return;
            } catch (Exception error) {
                Log.w(TAG, "Live call handoff failed: " + error.getMessage());
            }
        }
        storePending(context, payload, action);
    }
/** Reads and clears a decision recorded while no web runtime was alive. */
    @Nullable
    static JSObject consumePending(Context context) {
        if (context == null) {
            return null;
        }
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String action = prefs.getString(KEY_ACTION, null);
            long storedAt = prefs.getLong(KEY_PENDING_AT, 0L);
            if (action == null || action.isEmpty()) {
                return null;
            }
            JSObject result = new JSObject();
            result.put("action", action);
            result.put("callId", value(prefs.getString(KEY_CALL_ID, "")));
            result.put("callerId", value(prefs.getString(KEY_CALLER_ID, "")));
            result.put("callerName", value(prefs.getString(KEY_CALLER_NAME, "")));
            result.put("callType", value(prefs.getString(KEY_CALL_TYPE, "")));
            result.put("receiverId", value(prefs.getString(KEY_RECEIVER_ID, "")));
            clearPending(context);
            if (System.currentTimeMillis() - storedAt > PENDING_TTL_MS) {
                return null;
            }
            return result;
        } catch (Exception error) {
            Log.w(TAG, "Could not read pending call handoff: " + error.getMessage());
            return null;
        }
    }

    static JSObject toJsObject(LovemeetlyCallPayload payload, String action) {
        JSObject data = new JSObject();
        data.put("action", action);
        data.put("callId", payload.callId);
        data.put("callerId", payload.callerId);
        data.put("callerName", payload.callerName);
        data.put("callerPhoto", payload.callerPhoto);
        data.put("callType", payload.callType);
        data.put("receiverId", payload.receiverId);
        return data;
    }

    private static void storePending(
            Context context, LovemeetlyCallPayload payload, String action) {
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(KEY_ACTION, action)
                    .putString(KEY_CALL_ID, payload.callId)
                    .putString(KEY_CALLER_ID, payload.callerId)
                    .putString(KEY_CALLER_NAME, payload.callerName)
                    .putString(KEY_CALL_TYPE, payload.callType)
                    .putString(KEY_RECEIVER_ID, payload.receiverId)
                    .putLong(KEY_PENDING_AT, System.currentTimeMillis())
                    .apply();
        } catch (Exception error) {
            Log.w(TAG, "Could not store pending call handoff: " + error.getMessage());
        }
    }

    private static void clearPending(Context context) {
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        } catch (Exception error) {
            Log.w(TAG, "Could not clear pending call handoff: " + error.getMessage());
        }
    }

    private static String value(@Nullable String raw) {
        return raw == null ? "" : raw;
    }
}