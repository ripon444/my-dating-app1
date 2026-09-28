package com.lovemeetly.app;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.Nullable;

/**
 * Android 13+ {@code POST_NOTIFICATIONS} handling for the FCM popup path.
 *
 * <p>Without this runtime grant Android drops every notification the app posts - including FCM
 * pushes delivered while the app is backgrounded or swiped away - and the only trace is the
 * "Notifications are disabled for the app" line {@link LovemeetlyMessagingService} writes when it
 * tries to display one.
 *
 * <p>Rules:
 *
 * <ul>
 *   <li>The permission is requested from {@link MainActivity} at app start, exactly as before.
 *   <li>If the user dismisses or denies that first dialog, one further attempt is made later (on a
 *       following resume, never sooner than {@link #MIN_ASK_INTERVAL_MS} apart, so one session can
 *       never show two dialogs in a row).
 *   <li>When the OS would no longer show a dialog (denied twice / "don't ask again") or after
 *       {@link #MAX_AUTO_ATTEMPTS} attempts, the app stops asking instead of nagging.
 *   <li>The grant/deny result is always logged, so nothing is assumed.
 * </ul>
 *
 * <p>Nothing else is stored: an attempt counter and the timestamp of the last ask.
 */
public final class LovemeetlyNotificationPermission {

    private static final String TAG = "LovemeetlyPush";

    /** Shared with {@link MainActivity} so the result can be matched to our own request. */
    static final int REQUEST_CODE = 4711;

    private static final String PREFS = "lovemeetly_notification_permission";
    private static final String KEY_ATTEMPTS = "post_notifications_attempts";
    private static final String KEY_LAST_ASK_MS = "post_notifications_last_ask_ms";

    /** Startup request plus one later retry - enough to recover from a dismissed dialog. */
    private static final int MAX_AUTO_ATTEMPTS = 2;

    /** Keeps the retry off the resume that immediately follows the first dialog. */
    private static final long MIN_ASK_INTERVAL_MS = 5L * 60L * 1000L;

    /** True while a dialog opened by this class is still unanswered. */
    private static boolean requestInFlight = false;

    private LovemeetlyNotificationPermission() {}

    /** True on API 33+, the only versions where this runtime grant exists. */
    public static boolean isRequired() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
    }

    /** True when notifications may be posted. Always true below Android 13 (no runtime grant). */
    public static boolean isGranted(@Nullable Context context) {
        if (!isRequired()) {
            return true;
        }
        if (context == null) {
            return false;
        }
        try {
            return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED;
        } catch (Exception error) {
            Log.w(TAG, "Could not read notification permission: " + error.getMessage());
            return false;
        }
    }

    /**
     * Requests POST_NOTIFICATIONS when it is still missing and asking can still help.
     *
     * @param reason short label for the log line ("app-start" / "resume")
     * @return true when a dialog was actually requested
     */
    public static boolean requestIfNeeded(@Nullable Activity activity, String reason) {
        if (activity == null || !isRequired() || requestInFlight) {
            return false;
        }
        if (isGranted(activity)) {
            return false;
        }

        try {
            SharedPreferences prefs = prefs(activity);
            int attempts = prefs.getInt(KEY_ATTEMPTS, 0);
            if (attempts >= MAX_AUTO_ATTEMPTS) {
                return false;
            }

            long lastAsk = prefs.getLong(KEY_LAST_ASK_MS, 0L);
            long now = System.currentTimeMillis();
            if (lastAsk > 0L && now - lastAsk < MIN_ASK_INTERVAL_MS) {
                return false;
            }

            // After a denial the OS stops showing the dialog (denied twice / "don't ask again");
            // requesting then would only return an immediate deny, so stop instead.
            if (attempts > 0
                    && !activity.shouldShowRequestPermissionRationale(
                            Manifest.permission.POST_NOTIFICATIONS)) {
                Log.i(
                        TAG,
                        "Notification permission denied permanently; no further request will be made.");
                return false;
            }

            prefs.edit().putInt(KEY_ATTEMPTS, attempts + 1).putLong(KEY_LAST_ASK_MS, now).apply();
            requestInFlight = true;
            Log.i(TAG, "Requesting notification permission (" + reason + ").");
            activity.requestPermissions(
                    new String[] { Manifest.permission.POST_NOTIFICATIONS }, REQUEST_CODE);
            return true;
        } catch (Exception error) {
            requestInFlight = false;
            Log.w(TAG, "Notification permission request failed: " + error.getMessage());
            return false;
        }
    }

    /**
     * Records the outcome of the dialog. Must be called from
     * {@code MainActivity.onRequestPermissionsResult} <b>after</b> {@code super} has run, so
     * Capacitor's own plugin-permission handling stays intact.
     */
    public static void onRequestResult(
            int requestCode, @Nullable String[] permissions, @Nullable int[] grantResults) {
        if (requestCode != REQUEST_CODE) {
            return;
        }
        requestInFlight = false;

        boolean granted = false;
        if (permissions != null && grantResults != null) {
            for (int i = 0; i < permissions.length && i < grantResults.length; i++) {
                if (Manifest.permission.POST_NOTIFICATIONS.equals(permissions[i])) {
                    granted = grantResults[i] == PackageManager.PERMISSION_GRANTED;
                    break;
                }
            }
        }

        if (granted) {
            Log.i(TAG, "Notification permission granted; FCM notifications can be posted.");
        } else {
            Log.w(
                    TAG,
                    "Notification permission NOT granted; FCM notifications cannot be displayed until"
                            + " it is enabled for Lovemeetly in Android settings.");
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
