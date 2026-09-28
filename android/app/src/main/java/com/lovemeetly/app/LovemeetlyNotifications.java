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
 * <p>Deliberately separate channels:
 *
 * <ul>
 *   <li>{@link #CHANNEL_ID} - messages/account alerts. Shared by both normal notification paths:
 *       the Firebase SDK's automatic display of notification-type payloads and
 *       {@link LovemeetlyMessagingService}'s display of data-only payloads. Its sound is untouched by
 *       the incoming-call ringtones.
 *   <li>{@link #CALL_VOICE_CHANNEL_ID} / {@link #CALL_VIDEO_CHANNEL_ID} - incoming calls, one channel
 *       per call type, each with its own ringtone plus a vibration pattern and importance of its own,
 *       so a user can silence calls without silencing chat messages and voice/video calls ring with
 *       matching ringtones.
 *   <li>{@link #UPDATE_CHANNEL_ID} - "a new app version is available" notices from
 *       {@link LovemeetlyUpdateNotifications}. Separate channel and importance so update
 *       announcements are never mixed into chat history or the call channels.
 * </ul>
 *
 * <p>Why one channel per call type: Android binds a channel's sound when the channel is first
 * created; afterwards only the user can change it in system settings. A ringtone therefore can never
 * be swapped in place under an existing channel id. The call ringtones are addressed through these
 * per-type ids rather than {@link #LEGACY_CALL_CHANNEL_ID}, which earlier builds created together
 * with the single pre-separation ringtone, so an installed app picks the new ringtones up without
 * having to be reinstalled. The legacy channel is left in place (never deleted and no longer posted
 * to) so a channel the user may have configured disappears from nowhere.
 */
public final class LovemeetlyNotifications {

    /** Must stay in sync with {@code lovemeetly_notification_channel_id}. */
    public static final String CHANNEL_ID = "lovemeetly_messages";

    /**
     * Dedicated channel for "a new app version is available" notifications. Must stay in sync with
     * {@code lovemeetly_update_channel_id}.
     *
     * <p>Deliberately its own channel (and its own importance): an app-update notice must never
     * reuse the chat-message channel - users have to be able to mute update announcements without
     * losing chat notifications, and vice versa - and nothing about the message/call channels or
     * their sounds changes because this channel exists.
     */
    public static final String UPDATE_CHANNEL_ID = "lovemeetly_updates";

    /**
     * The single incoming-call channel of earlier builds, whose sound is the one ringtone that
     * existed before voice/video were separated. Kept as a named constant because that channel still
     * exists on installed devices and its sound can no longer be changed programmatically.
     */
    public static final String LEGACY_CALL_CHANNEL_ID = "lovemeetly_calls";

    /** Incoming voice calls. Must stay in sync with {@code lovemeetly_call_voice_channel_id}. */
    public static final String CALL_VOICE_CHANNEL_ID = "lovemeetly_calls_voice";

    /** Incoming video calls. Must stay in sync with {@code lovemeetly_call_video_channel_id}. */
    public static final String CALL_VIDEO_CHANNEL_ID = "lovemeetly_calls_video";

    /** The channel an incoming call of this type rings on. */
    public static String callChannelId(boolean videoCall) {
        return videoCall ? CALL_VIDEO_CHANNEL_ID : CALL_VOICE_CHANNEL_ID;
    }

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
     * Creates the incoming-call channel of one call type if it does not exist yet. One channel per
     * type exists only because a channel's sound is frozen at creation time - that is what makes
     * voice and video calls ring with their own ringtone without the message channel being touched.
     *
     * <p>IMPORTANCE_HIGH is required for both a heads-up call banner and a full-screen intent on
     * Android 14+, where {@code USE_FULL_SCREEN_INTENT} must additionally be granted by the user.
     */
    public static void ensureCallChannel(Context context, boolean videoCall) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        String channelId = callChannelId(videoCall);
        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(channelId) != null) {
            return;
        }

        NotificationChannel channel =
                new NotificationChannel(
                        channelId,
                        context.getString(
                                videoCall
                                        ? R.string.lovemeetly_call_video_channel_name
                                        : R.string.lovemeetly_call_voice_channel_name),
                        NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(
                context.getString(
                        videoCall
                                ? R.string.lovemeetly_call_video_channel_description
                                : R.string.lovemeetly_call_voice_channel_description));
        channel.enableVibration(true);
        channel.setVibrationPattern(CALL_VIBRATION_PATTERN);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.setShowBadge(true);

        Uri ringtone = LovemeetlyCallNotifications.callRingtoneUri(context, videoCall);
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

    /** Both incoming-call channels (voice and video). Safe to call repeatedly. */
    public static void ensureCallChannels(Context context) {
        ensureCallChannel(context, false);
        ensureCallChannel(context, true);
    }

    /**
     * Creates the app-update channel if it does not exist yet. Safe to call repeatedly.
     *
     * <p>IMPORTANCE_DEFAULT (not HIGH) on purpose: an update is never urgent, so it must not pop a
     * heads-up banner over whatever the user is doing - it belongs in the notification shade and
     * lets the in-app prompt own the full-screen presentation. The chat/call channels are untouched.
     */
    public static void ensureUpdateChannel(Context context) {
        if (context == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager manager =
                (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || manager.getNotificationChannel(UPDATE_CHANNEL_ID) != null) {
            return;
        }

        NotificationChannel channel =
                new NotificationChannel(
                        UPDATE_CHANNEL_ID,
                        context.getString(R.string.lovemeetly_update_channel_name),
                        NotificationManager.IMPORTANCE_DEFAULT);
        channel.setDescription(
                context.getString(R.string.lovemeetly_update_channel_description));
        channel.setShowBadge(true);

        manager.createNotificationChannel(channel);
    }

    /** Every Lovemeetly channel, used from MainActivity so they exist before any push arrives. */
    public static void ensureAllChannels(Context context) {
        ensureChannel(context);
        ensureCallChannels(context);
        ensureUpdateChannel(context);
    }
}