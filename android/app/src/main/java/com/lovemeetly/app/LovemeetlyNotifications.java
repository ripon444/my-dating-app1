package com.lovemeetly.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * Owns the Lovemeetly notification channels.
 *
 * <p>Two channels, deliberately separate:
 *
 * <ul>
 *   <li>{@link #CHANNEL_ID} - messages/account alerts. Shared by both normal notification paths:
 *       the Firebase SDK's automatic display of notification-type payloads and
 *       {@link LovemeetlyMessagingService}'s display of data-only payloads.
 *   <li>{@link #CALL_CHANNEL_ID} - incoming calls. Dedicated ringtone, vibration pattern and
 *       importance, so a user can silence calls without silencing chat messages.
 * </ul>
 */
public final class LovemeetlyNotifications {

    /** Must stay in sync with {@code lovemeetly_notification_channel_id}. */
    public static final String CHANNEL_ID = "lovemeetly_messages";

    /** Must stay in sync with {@code lovemeetly_call_channel_id}. */
    public static final String CALL_CHANNEL_ID = "lovemeetly_calls";

    /** Ringing vibration pattern (wait, vibrate, pause, vibrate, pause). */
    private static final long[] CALL_VIBRATION_PATTERN = { 0, 1000, 1000, 1000, 1000 };

    private LovemeetlyNotifications() {}

    /**
     * Creates the Lovemeetly channel if it does not exist yet. Safe to call repeatedly and from
     * both the Activity and the messaging service. No-op below Android 8.0, where notification
     * channels do not exist.
     */
    public static void ensureChannel(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel =
                new NotificationChannel(
                        CHANNEL_ID,
                        context.getString(R.string.lovemeetly_notification_channel_name),
                        // HIGH importance is what enables the heads-up (pop-up) banner.
                        NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(
                context.getString(R.string.lovemeetly_notification_channel_description));
        channel.enableVibration(true);

        manager.createNotificationChannel(channel);
    }

    /**
     * Creates the dedicated incoming-call channel if it does not exist yet.
     *
     * <p>IMPORTANCE_HIGH is required for both a heads-up call banner and a full-screen intent on
     * Android 14+, where {@code USE_FULL_SCREEN_INTENT} must additionally be granted by the user.
     */
    public static void ensureCallChannel(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(CALL_CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel =
                new NotificationChannel(
                        CALL_CHANNEL_ID,
                        context.getString(R.string.lovemeetly_call_channel_name),
                        NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(context.getString(R.string.lovemeetly_call_channel_description));
        channel.enableVibration(true);
        channel.setVibrationPattern(CALL_VIBRATION_PATTERN);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setShowBadge(true);

        Uri ringtone = LovemeetlyCallNotifications.callRingtoneUri(context);
        if (ringtone != null) {
            AudioAttributes attributes =
                    new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                            .build();
            channel.setSound(ringtone, attributes);
        }

        manager.createNotificationChannel(channel);
    }

    /** Both channels, used from MainActivity so they exist before any push arrives. */
    public static void ensureAllChannels(Context context) {
        ensureChannel(context);
        ensureCallChannel(context);
    }
}