package com.lovemeetly.app;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;

import java.util.ArrayDeque;
import java.util.Map;
import java.util.Queue;

/**
 * The closed-app incoming-call notification.
 *
 * <p>Deliberately independent of the WebView/Socket.IO runtime: it is built from the raw FCM data
 * map, so a call still rings when the app process was cold-started by FCM (or was swiped away).
 *
 * <p>Differences from the normal message notification (see {@link LovemeetlyMessagingService}):
 * a dedicated {@code lovemeetly_calls} channel, IMPORTANCE_HIGH, the call ringtone, a vibration
 * pattern, an ongoing non-auto-cancel notification, {@code CATEGORY_CALL}, a full-screen intent to
 * {@link LovemeetlyCallActivity} and Answer/Decline actions.
 */
public final class LovemeetlyCallNotifications {

    private static final String TAG = "LovemeetlyCall";

    /** Fixed slot: one ringing call at a time, so re-posts replace instead of stacking. */
    public static final String CALL_NOTIFICATION_TAG = "lovemeetly-call";

    private static final int CALL_NOTIFICATION_ID = 0x1CA11;

    private static final int REQUEST_CODE_CALL_SCREEN = 0x1CA12;
    private static final int REQUEST_CODE_ANSWER = 0x1CA13;
    private static final int REQUEST_CODE_DECLINE = 0x1CA14;

    public static final String ACTION_ANSWER = "com.lovemeetly.app.action.CALL_ANSWER";
    public static final String ACTION_DECLINE = "com.lovemeetly.app.action.CALL_DECLINE";

    public static final String HANDOFF_ANSWER = "answer";
    public static final String HANDOFF_DECLINE = "decline";

    public static final String EXTRA_TYPE = "lovemeetlyCallEventType";
    public static final String EXTRA_CALL_ID = "lovemeetlyCallId";
    public static final String EXTRA_CALLER_ID = "lovemeetlyCallerId";
    public static final String EXTRA_CALLER_NAME = "lovemeetlyCallerName";
    public static final String EXTRA_CALLER_PHOTO = "lovemeetlyCallerPhoto";
    public static final String EXTRA_CALL_TYPE = "lovemeetlyCallType";
    public static final String EXTRA_RECEIVER_ID = "lovemeetlyReceiverId";
    public static final String EXTRA_ACTION = "lovemeetlyCallAction";

    /**
     * Android never loops a channel sound, so the ring clip itself is a few seconds long and the
     * ringing notification removes itself after this window.
     */
    private static final long RING_TIMEOUT_MS = 45_000L;

    private static final int MAX_TRACKED_CALLS = 50;
    private static final Queue<String> RECENT_CALL_KEYS = new ArrayDeque<>(MAX_TRACKED_CALLS);

    /** De-duplication window for one call key, measured from the last ring. */
    private static final long DEDUPE_WINDOW_MS = 60_000L;

    /**
     * Ring state is persisted because FCM can start a brand-new process for a re-delivered push (and
     * because the app process is usually killed right after a receiver finishes). Without this the
     * same call event would ring again - and MainActivity could not dismiss a ring started by a
     * previous process.
     */
    private static final String PREFS = "lovemeetly_call_state";
    private static final String KEY_ACTIVE_CALL = "active_call_key";
    private static final String KEY_HANDLED_CALLS = "handled_calls";
    private static final int MAX_PERSISTED_CALLS = 20;

    private static volatile String ringingCallKey = null;

    private LovemeetlyCallNotifications() {}

    /**
     * Shows the ringing notification for an incoming-call payload.
     *
     * @return true when a new ring was posted, false when the payload was not a call, notifications
     *     are disabled, or the same call is already ringing (duplicate FCM delivery).
     */
    public static boolean showIncomingCall(Context context, @Nullable Map<String, String> data) {
        if (context == null) {
            return false;
        }
        LovemeetlyCallPayload payload = LovemeetlyCallPayload.fromData(data);
        if (payload.isEnded()) {
            if (payload.callId.isEmpty() || payload.callId.equals(ringingCallKey)) {
                cancelCallNotification(context);
            }
            return false;
        }
        if (!payload.isIncoming() || payload.isEmpty()) {
            return false;
        }
        if (payload.callId.isEmpty()) {
            Log.w(TAG, "Incoming call push without callId; de-duplication falls back to caller id.");
        }
        if (isAlreadyRinging(context, payload.dedupeKey())) {
            Log.i(TAG, "Duplicate incoming-call push ignored for " + payload.dedupeKey());
            return false;
        }
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            Log.w(TAG, "Notifications are disabled for the app; incoming call not displayed.");
            return false;
        }

        // Ring state is recorded before the notification is posted: the platform may launch the
        // full-screen call screen the instant it is posted.
        ringingCallKey = payload.dedupeKey();
        rememberCallKey(payload.dedupeKey());
        markRinging(context, payload.dedupeKey());

        try {
            postRingingNotification(context, payload);
        } catch (Exception error) {
            Log.w(TAG, "Could not display incoming call: " + error.getMessage());
            cancelCallNotification(context);
            return false;
        }

        return true;
    }

    /** Builds and posts the ringing notification. */
    private static void postRingingNotification(Context context, LovemeetlyCallPayload payload) {
        LovemeetlyNotifications.ensureCallChannel(context);

        String callerName =
                payload.displayName(context.getString(R.string.lovemeetly_call_default_caller));
        String callTypeLabel =
                context.getString(
                        payload.isVideoCall()
                                ? R.string.lovemeetly_call_video_label
                                : R.string.lovemeetly_call_voice_label);
        String contentText =
                context.getString(R.string.lovemeetly_call_content_text, callerName, callTypeLabel);

        // Full-screen incoming-call UI. Android shows it while the device is locked or the screen is
        // off, and falls back to a heads-up notification while the device is in use.
        Intent callScreenIntent = new Intent(context, LovemeetlyCallActivity.class);
        callScreenIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        payload.putInto(callScreenIntent);
        PendingIntent callScreenPendingIntent =
                PendingIntent.getActivity(
                        context,
                        REQUEST_CODE_CALL_SCREEN,
                        callScreenIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Answer opens the existing Lovemeetly call flow (MainActivity + web CallOverlay).
        Intent answerIntent = new Intent(context, MainActivity.class);
        answerIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        payload.putInto(answerIntent);
        answerIntent.putExtra(EXTRA_ACTION, HANDOFF_ANSWER);
        PendingIntent answerPendingIntent =
                PendingIntent.getActivity(
                        context,
                        REQUEST_CODE_ANSWER,
                        answerIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        // Decline is dismissed natively first, then handed to the existing server-side reject
        // mechanism through the WebView when it is alive.
        Intent declineIntent = new Intent(context, LovemeetlyCallActionReceiver.class);
        declineIntent.setAction(ACTION_DECLINE);
        payload.putInto(declineIntent);
        PendingIntent declinePendingIntent =
                PendingIntent.getBroadcast(
                        context,
                        REQUEST_CODE_DECLINE,
                        declineIntent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, LovemeetlyNotifications.CALL_CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_stat_lovemeetly)
                        .setColor(
                                ContextCompat.getColor(
                                        context, R.color.lovemeetly_notification_color))
                        .setContentTitle(callerName)
                        .setContentText(contentText)
                        .setCategory(NotificationCompat.CATEGORY_CALL)
                        .setPriority(NotificationCompat.PRIORITY_MAX)
                        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                        .setOngoing(true)
                        .setAutoCancel(false)
                        .setContentIntent(callScreenPendingIntent)
                        .setFullScreenIntent(callScreenPendingIntent, true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            // Android 12+ requires the platform call style for CATEGORY_CALL notifications; it also
            // renders the system Answer/Decline pills.
            Person caller = new Person.Builder().setName(callerName).setImportant(true).build();
            builder.setStyle(
                    NotificationCompat.CallStyle.forIncomingCall(
                            caller, declinePendingIntent, answerPendingIntent));
        } else {
            builder.addAction(
                    R.drawable.ic_stat_lovemeetly,
                    context.getString(R.string.lovemeetly_call_decline),
                    declinePendingIntent);
            builder.addAction(
                    R.drawable.ic_stat_lovemeetly,
                    context.getString(R.string.lovemeetly_call_answer),
                    answerPendingIntent);
        }
// Below Android 8.0 there is no channel, so the alert itself carries sound/vibration.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            Uri sound = callRingtoneUri(context);
            if (sound != null) {
                builder.setSound(sound);
            }
            builder.setVibrate(new long[] { 0, 1000, 1000, 1000, 1000 });
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            // Android 14+: a full-screen intent needs USE_FULL_SCREEN_INTENT and a user grant.
            NotificationManager platformManager =
                    (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (platformManager != null && !platformManager.canUseFullScreenIntent()) {
                Log.i(
                        TAG,
                        "Full-screen intent not permitted; using the heads-up call banner instead.");
            }
        }

        builder.setTimeoutAfter(RING_TIMEOUT_MS);

        NotificationManagerCompat.from(context)
                .notify(CALL_NOTIFICATION_TAG, CALL_NOTIFICATION_ID, builder.build());
    }
/**
     * Cancels a ringing call notification (answer, decline, ended push, or app foregrounded).
     */
    public static void cancelCallNotification(Context context) {
        String key = ringingCallKey;
        ringingCallKey = null;
        if (context == null) {
            return;
        }
        if (key == null || key.isEmpty()) {
            // A previous process may have posted the ring that is still on screen.
            key = activeCallKey(context);
        }
        clearActiveCall(context);
        if (key != null && !key.isEmpty()) {
            rememberCallKey(key);
            rememberHandled(context, key);
        }
        try {
            NotificationManagerCompat.from(context)
                    .cancel(CALL_NOTIFICATION_TAG, CALL_NOTIFICATION_ID);
        } catch (Exception error) {
            Log.w(TAG, "Could not cancel incoming-call notification: " + error.getMessage());
        }
    }

    /** Call key currently ringing, or null. Reads the in-memory state first. */
    @Nullable
    private static String ringingKey(Context context) {
        if (ringingCallKey != null) {
            return ringingCallKey;
        }
        String active = activeCallKey(context);
        return active == null || active.isEmpty() ? null : active;
    }

    /** True while a call notification is ringing, including one started by an earlier process. */
    public static boolean isRinging(Context context) {
        return ringingKey(context) != null;
    }

    /**
     * URI of the dedicated incoming-call ringtone in {@code res/raw}. Falls back to the device's
     * default ringtone URI when the packaged asset cannot be opened. The existing foreground/web
     * ringtone in {@code IncomingCallModal} is untouched by this.
     */
    @Nullable
    public static Uri callRingtoneUri(Context context) {
        if (context == null) {
            return null;
        }
        Uri packaged =
                Uri.parse(
                        "android.resource://"
                                + context.getPackageName()
                                + "/"
                                + R.raw.lovemeetly_call_ringtone);
        try {
            AssetFileDescriptor descriptor =
                    context.getResources().openRawResourceFd(R.raw.lovemeetly_call_ringtone);
            try {
                if (descriptor != null && descriptor.getLength() > 0) {
                    return packaged;
                }
            } finally {
                if (descriptor != null) {
                    descriptor.close();
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "Packaged call ringtone unavailable: " + error.getMessage());
        }
        try {
            return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
        } catch (Exception error) {
            return null;
        }
    }

    /** True when this exact call key rang recently (duplicate delivery) or is still ringing. */
    private static synchronized boolean isAlreadyRinging(Context context, String key) {
        if (key == null || key.isEmpty()) {
            return false;
        }
        if (key.equals(ringingCallKey)) {
            return true;
        }
        if (key.equals(activeCallKey(context))) {
            return true;
        }
        long now = System.currentTimeMillis();
        for (String entry : handledEntries(context)) {
            int separator = entry.indexOf('|');
            if (separator <= 0) {
                continue;
            }
            if (key.equals(entry.substring(0, separator))) {
                long stamp = parseTimestamp(entry.substring(separator + 1));
                return now - stamp <= DEDUPE_WINDOW_MS;
            }
        }
        return false;
    }

    private static synchronized void rememberCallKey(String key) {
        if (key == null || key.isEmpty() || RECENT_CALL_KEYS.contains(key)) {
            return;
        }
        while (RECENT_CALL_KEYS.size() >= MAX_TRACKED_CALLS) {
            RECENT_CALL_KEYS.poll();
        }
        RECENT_CALL_KEYS.add(key);
    }

    /** Persists "this call key was handled", so a re-delivery in a new process stays silent. */
    private static synchronized void rememberHandled(Context context, String key) {
        if (context == null || key == null || key.isEmpty()) {
            return;
        }
        long now = System.currentTimeMillis();
        StringBuilder next = new StringBuilder();
        int kept = 0;
        for (String entry : handledEntries(context)) {
            int separator = entry.indexOf('|');
            if (separator <= 0 || kept >= MAX_PERSISTED_CALLS) {
                continue;
            }
            String entryKey = entry.substring(0, separator);
            if (entryKey.equals(key)) {
                continue;
            }
            if (now - parseTimestamp(entry.substring(separator + 1)) > DEDUPE_WINDOW_MS * 4) {
                continue;
            }
            next.append(entryKey).append('|').append(entry.substring(separator + 1)).append(';');
            kept++;
        }
        next.append(key).append('|').append(now);
        writeStringPref(context, KEY_HANDLED_CALLS, next.toString());
    }

    private static synchronized void markRinging(Context context, String key) {
        writeStringPref(context, KEY_ACTIVE_CALL, key);
    }

    private static void clearActiveCall(Context context) {
        writeStringPref(context, KEY_ACTIVE_CALL, "");
    }

    @Nullable
    private static String activeCallKey(Context context) {
        return context == null ? null : readStringPref(context, KEY_ACTIVE_CALL);
    }

    private static String[] handledEntries(Context context) {
        String raw = readStringPref(context, KEY_HANDLED_CALLS);
        return raw == null || raw.isEmpty() ? new String[0] : raw.split(";");
    }

    private static long parseTimestamp(String raw) {
        try {
            return Long.parseLong(raw.trim());
        } catch (Exception error) {
            return 0L;
        }
    }

    @Nullable
    private static String readStringPref(Context context, String key) {
        if (context == null) {
            return null;
        }
        try {
            return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key, "");
        } catch (Exception error) {
            Log.w(TAG, "Could not read call state: " + error.getMessage());
            return null;
        }
    }

    private static void writeStringPref(Context context, String key, String value) {
        if (context == null) {
            return;
        }
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(key, value)
                    .apply();
        } catch (Exception error) {
            Log.w(TAG, "Could not write call state: " + error.getMessage());
        }
    }
}