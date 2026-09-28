package com.lovemeetly.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "LovemeetlyPush";

    private static final int NOTIFICATION_PERMISSION_REQUEST_CODE = 4711;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Native bridge for the closed-app incoming-call path (Answer/Decline handoff).
        // Must be registered before super.onCreate(), which builds the Capacitor bridge.
        registerPlugin(LovemeetlyCallPlugin.class);

        // Lets the authenticated WebView layer read the device's FCM token so it can register it
        // through the existing POST /api/push-tokens endpoint.
        registerPlugin(LovemeetlyPushPlugin.class);

        super.onCreate(savedInstanceState);

        // Both channels must exist before any push arrives, otherwise Android 8+
        // would fall back to the Firebase SDK's generic channel.
        LovemeetlyNotifications.ensureAllChannels(this);

        // An Answer tap (notification action or the native ringing screen) arrives as
        // Intent extras; publish it so the web layer can continue the existing call flow.
        LovemeetlyCallBridge.publishFromIntent(this, getIntent());

        // Android 13+ requires an explicit runtime grant before a notification can be
        // shown at all - including FCM notifications delivered while the app is fully
        // closed. Requested once at startup; a denial is not re-prompted.
        requestNotificationPermissionIfNeeded();

        // Cover installations whose token was issued before this feature existed (onNewToken fires
        // only when the token is created/refreshed). Fire-and-forget and never blocking: Task
        // callbacks run asynchronously and only a small SharedPreferences write happens on success.
        storeFcmTokenInBackground();
    }

    /**
     * Retrieves the current FCM registration token and persists it for the WebView layer.
     *
     * <p>Failures (offline, no Play services) are logged only - the next launch retries, and the
     * LovemeetlyPush plugin can also fetch on demand.
     */
    private void storeFcmTokenInBackground() {
        try {
            FirebaseMessaging.getInstance()
                    .getToken()
                    .addOnCompleteListener(
                            task -> {
                                if (!task.isSuccessful()) {
                                    Log.w(
                                            TAG,
                                            "FCM token retrieval failed: "
                                                    + (task.getException() == null
                                                            ? "unknown"
                                                            : task.getException().getMessage()));
                                    return;
                                }
                                if (LovemeetlyPushTokens.setToken(this, task.getResult())) {
                                    Log.i(
                                            TAG,
                                            "FCM token stored: "
                                                    + LovemeetlyPushTokens.maskToken(task.getResult()));
                                }
                            });
        } catch (Exception error) {
            Log.w(TAG, "FCM token retrieval skipped: " + error.getMessage());
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // launchMode=singleTask: an already running app receives the Answer tap here.
        setIntent(intent);
        LovemeetlyCallBridge.publishFromIntent(this, intent);
    }

    // NOTE: the native ringing notification is deliberately NOT cancelled here. The display can
    // wake up (full-screen intent) while this Activity is still the app's task, which made an
    // unconditional cancel kill the ring before the user ever saw it. The native ring is instead
    // dismissed when the web call UI actually takes the call over, through the existing
    // dismissIncomingCall() plugin method (src/utils/nativeCallHandoff.ts), or natively on
    // answer/decline/ended/timeout.

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return;
        }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        requestPermissions(
                new String[] { Manifest.permission.POST_NOTIFICATIONS },
                NOTIFICATION_PERMISSION_REQUEST_CODE);
    }
}
