package com.lovemeetly.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * The "a new Lovemeetly version is available" notification.
 *
 * <p>Deliberately independent of the WebView/Socket.IO runtime: it is built from the raw FCM data
 * map, so the update is announced in every app state - foreground, background and fully closed -
 * exactly like the existing chat and call pushes.
 *
 * <p>Differences from the chat notification (see {@link LovemeetlyMessagingService}): its own
 * channel ({@link LovemeetlyNotifications#UPDATE_CHANNEL_ID}), IMPORTANCE_DEFAULT (never a heads-up
 * banner over whatever the user is doing), one fixed notification slot that is replaced instead of
 * stacked, an explicit "Update now" action, and a tap that hands the fixed APK URL to Android's
 * DownloadManager through {@link LovemeetlyUpdateDownloadReceiver}.
 *
 * <p>Nothing here touches the chat or call notification paths, and nothing is shown when the
 * installed build is already current (numeric versionCode comparison) or when this exact release has
 * already been announced once.
 */
public final class LovemeetlyUpdateNotifications {

    private static final String TAG = "LovemeetlyUpdate";

    /** Fixed slot: one update notice at a time, so re-posts replace instead of stacking. */
    public static final String UPDATE_NOTIFICATION_TAG = "lovemeetly-update";

    private static final int UPDATE_NOTIFICATION_ID = 0x1A9DA7E;
    private static final int REQUEST_CODE_DOWNLOAD = 0x1A9DA7F;

    /** Dedicated prefs file: keeps update state separate from push tokens and call state. */
    private static final String PREFS = "lovemeetly_update_state";
    private static final String KEY_NOTIFIED_VERSION = "notified_version_code";

    private LovemeetlyUpdateNotifications() {}

    /**
     * Displays the update notification when it is genuinely news.
     *
     * @return true only when a notification was posted
     */
    public static boolean showUpdateAvailable(
            Context context, @Nullable LovemeetlyUpdatePayload payload) {
        if (context == null || payload == null || !payload.isAppUpdate()) {
            return false;
        }

        long installedVersionCode = installedVersionCode(context);
        if (!payload.shouldOffer(installedVersionCode)) {
            Log.i(
                    TAG,
                    "Update "
                            + payload.dedupeKey()
                            + " not shown: installed versionCode is "
                            + installedVersionCode
                            + ".");
            return false;
        }

        // An FCM re-delivery (or a retried release request) must not nag twice for the same build.
        long alreadyAnnounced = notifiedVersionCode(context);
        if (payload.versionCode > 0L && payload.versionCode <= alreadyAnnounced) {
            Log.i(TAG, "Update " + payload.dedupeKey() + " was already announced; not shown again.");
            return false;
        }

        try {
            return postUpdateNotification(context, payload);
        } catch (Exception error) {
            Log.w(TAG, "Could not display the update notification: " + error.getMessage());
            return false;
        }
    }

    /** Builds and posts the notification. */
    private static boolean postUpdateNotification(
            Context context, LovemeetlyUpdatePayload payload) {
        LovemeetlyNotifications.ensureUpdateChannel(context);

        // Covers the Android 13+ runtime permission and the user's app-level notification toggle.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            Log.w(TAG, "Notifications are disabled for the app; update notification not displayed.");
            return false;
        }

        String body =
                payload.versionCode > 0L || !payload.versionName.isEmpty()
                        ? context.getString(
                                R.string.lovemeetly_update_notification_body,
                                payload.displayVersion())
                        : context.getString(R.string.lovemeetly_update_notification_body_generic);

        // Tapping (or the "Update now" action) starts the APK download natively - no Activity, no
        // WebView: the app does not have to be opened and keeps working until the user installs the
        // downloaded file.
        Intent tapIntent = new Intent(context, LovemeetlyUpdateDownloadReceiver.class);
        tapIntent.setAction(LovemeetlyUpdateDownloadReceiver.ACTION_UPDATE_DOWNLOAD);
        payload.putInto(tapIntent);
        PendingIntent contentIntent =
                PendingIntent.getBroadcast(
                        context,
                        REQUEST_CODE_DOWNLOAD,
                        tapIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, LovemeetlyNotifications.UPDATE_CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_stat_lovemeetly)
                        .setColor(
                                ContextCompat.getColor(
                                        context, R.color.lovemeetly_notification_color))
                        .setContentTitle(
                                context.getString(R.string.lovemeetly_update_notification_title))
                        .setContentText(body)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setAutoCancel(true)
                        // Re-posting the same release must never alert again.
                        .setOnlyAlertOnce(true)
                        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                        .setCategory(NotificationCompat.CATEGORY_RECOMMENDATION)
                        .setContentIntent(contentIntent)
                        .addAction(
                                R.drawable.ic_stat_lovemeetly,
                                context.getString(R.string.lovemeetly_update_action_download),
                                contentIntent);

        NotificationManagerCompat.from(context)
                .notify(UPDATE_NOTIFICATION_TAG, UPDATE_NOTIFICATION_ID, builder.build());
        rememberNotifiedVersion(context, payload.versionCode);
        Log.i(TAG, "Update notification shown for " + payload.dedupeKey() + ".");
        return true;
    }

    /**
     * versionCode of the installed APK, or 0 when it cannot be read (then the notice is still
     * allowed, because offering the update is harmless). Values are compared as numbers only.
     */
    static long installedVersionCode(Context context) {
        if (context == null) {
            return 0L;
        }
        try {
            PackageManager manager = context.getPackageManager();
            if (manager == null) {
                return 0L;
            }
            PackageInfo info = manager.getPackageInfo(context.getPackageName(), 0);
            if (info == null) {
                return 0L;
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                return info.getLongVersionCode();
            }
            return info.versionCode;
        } catch (Exception error) {
            Log.w(TAG, "Installed versionCode unavailable: " + error.getMessage());
            return 0L;
        }
    }

    /** Last versionCode announced on this device (0 when nothing has been announced yet). */
    static long notifiedVersionCode(Context context) {
        if (context == null) {
            return 0L;
        }
        try {
            return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getLong(KEY_NOTIFIED_VERSION, 0L);
        } catch (Exception error) {
            Log.w(TAG, "Could not read update state: " + error.getMessage());
            return 0L;
        }
    }

    private static void rememberNotifiedVersion(Context context, long versionCode) {
        if (context == null || versionCode <= 0L) {
            return;
        }
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putLong(KEY_NOTIFIED_VERSION, versionCode)
                    .apply();
        } catch (Exception error) {
            Log.w(TAG, "Could not persist update state: " + error.getMessage());
        }
    }
}