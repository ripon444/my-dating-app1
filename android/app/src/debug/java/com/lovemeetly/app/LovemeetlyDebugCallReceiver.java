package com.lovemeetly.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.Nullable;

import java.util.HashMap;
import java.util.Map;

/**
 * DEBUG-ONLY trigger for the closed-app incoming-call path (see {@code src/debug/AndroidManifest.xml}).
 *
 * <p>It builds the same data map an FCM call push carries and calls the same production entry point
 * the messaging service uses, so everything except the Firebase transport can be verified from ADB:
 *
 * <pre>
 * adb shell am broadcast -a com.lovemeetly.app.debug.CALL_INCOMING -n com.lovemeetly.app/.LovemeetlyDebugCallReceiver --es callId call_test_1 --es callerId user_42 --es callerName TestCaller --es callType video
 * adb shell am broadcast -a com.lovemeetly.app.debug.CALL_ENDED -n com.lovemeetly.app/.LovemeetlyDebugCallReceiver --es callId call_test_1
 * </pre>
 *
 * <p>This class is compiled into the debug variant only and is absent from release builds.
 */
public class LovemeetlyDebugCallReceiver extends BroadcastReceiver {

    private static final String TAG = "LovemeetlyDebug";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();

        // The notification's Decline action, exercised through the same production handler the
        // (non-exported) LovemeetlyCallActionReceiver uses. The intent is rebuilt with the exact
        // extras the notification's PendingIntent carries.
        if ("com.lovemeetly.app.debug.CALL_DECLINE".equals(action)) {
            Intent decline = new Intent(intent);
            decline.setAction(LovemeetlyCallNotifications.ACTION_DECLINE);
            LovemeetlyCallPayload.fromData(buildPayload(intent, "call_incoming")).putInto(decline);
            LovemeetlyCallActionReceiver.handleDeclineIntent(context, decline);
            Log.i(TAG, "Debug decline broadcast sent to the production handler");
            return;
        }

        Map<String, String> data = buildPayload(intent, null);

        if ("com.lovemeetly.app.debug.CALL_ENDED".equals(action)) {
            data.put("type", "call_ended");
            boolean handled = LovemeetlyCallNotifications.showIncomingCall(context, data);
            Log.i(TAG, "Debug call-ended broadcast for " + data.get("callId") + " (handled=" + handled + ")");
            return;
        }

        boolean shown = LovemeetlyCallNotifications.showIncomingCall(context, data);
        Log.i(
                TAG,
                "Debug incoming-call broadcast for "
                        + data.get("callId")
                        + " (new ring="
                        + shown
                        + ")");
    }

    /** Builds the same flat string map an FCM call push carries. */
    private static Map<String, String> buildPayload(Intent intent, @Nullable String forcedType) {
        Map<String, String> data = new HashMap<>();
        data.put("type", forcedType != null ? forcedType : "call_incoming");
        data.put("callId", stringExtra(intent, "callId", "call_debug_" + System.currentTimeMillis()));
        data.put("callerId", stringExtra(intent, "callerId", "user_debug_caller"));
        data.put("callerName", stringExtra(intent, "callerName", "Test Caller"));
        data.put("callType", stringExtra(intent, "callType", "voice"));
        data.put("receiverId", stringExtra(intent, "receiverId", ""));
        return data;
    }

    private static String stringExtra(Intent intent, String key, String fallback) {
        String value = intent.getStringExtra(key);
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }
}