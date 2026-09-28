package com.lovemeetly.app;

import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "LovemeetlyPush";

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

        // The site's "Download APK" / "Download Android App" anchor cannot download anything inside
        // the Capacitor WebView (the framework installs no DownloadListener, so the tap is a no-op).
        // This hands APK downloads to Android's DownloadManager instead; every other download keeps
        // its previous behaviour.
        LovemeetlyApkDownloads.attach(getBridge() == null ? null : getBridge().getWebView(), this);

        // An Answer tap (notification action or the native ringing screen) arrives as
        // Intent extras; publish it so the web layer can continue the existing call flow.
        LovemeetlyCallBridge.publishFromIntent(this, getIntent());

        // Android 13+ requires an explicit runtime grant before a notification can be
        // shown at all - including FCM notifications delivered while the app is fully
        // closed. Same request as before; its result is now observed (onRequestPermissionsResult)
        // and one further attempt is allowed later if the user dismissed this first dialog.
        LovemeetlyNotificationPermission.requestIfNeeded(this, "app-start");

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

    @Override
    public void onResume() {
        super.onResume();
        // One later chance when a logged-in user is actually back in the app: a dialog dismissed
        // during start-up must not silence push forever. Bounded by attempts and a minimum interval,
        // so at most two dialogs are ever shown and never back-to-back.
        LovemeetlyNotificationPermission.requestIfNeeded(this, "resume");
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode, String[] permissions, int[] grantResults) {
        // Capacitor first: BridgeActivity routes plugin permission results through the bridge, so
        // super must run before the outcome is recorded here.
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        LovemeetlyNotificationPermission.onRequestResult(requestCode, permissions, grantResults);
    }
}
