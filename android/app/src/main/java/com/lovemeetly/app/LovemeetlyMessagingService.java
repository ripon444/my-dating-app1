package com.lovemeetly.app;

import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Process;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.ArrayDeque;
import java.util.List;
import java.util.Map;
import java.util.Queue;

/**
 * Native FCM receiver for Lovemeetly.
 *
 * <p>Three delivery paths exist on Android:
 *
 * <ol>
 *   <li><b>Incoming-call payload</b> (data-only, {@code type: call_incoming}). Rendered natively by
 *       {@link LovemeetlyCallNotifications} on the call type's own {@code lovemeetly_calls_voice} /
 *       {@code lovemeetly_calls_video} channel (each with the matching call ringtone) and with a
 *       full-screen intent, so a call rings while the app is backgrounded or swiped away. While
 *       the app is in the foreground the existing Socket.IO ringing flow stays in charge.
 *   <li><b>Notification-type payload</b> (the payload carries a {@code notification} block). While
 *       the app is in the background or fully closed, the Firebase SDK displays the notification
 *       itself inside {@code FirebaseMessagingService.dispatchMessage()} and does not call
 *       {@link #onMessageReceived}. While the app is in the foreground the SDK does not display
 *       anything and calls {@link #onMessageReceived} instead - that foreground case is
 *       intentionally left to the app's existing Socket.IO path so nothing is shown twice.
 *   <li><b>Data-only payload</b> (no {@code notification} block). The SDK never displays these, so
 *       this service always builds the notification - in the background AND in the foreground: the
 *       Capacitor WebView has no browser {@code Notification} API, so the app's foreground JS
 *       notification helper cannot pop up on Android at all. Payloads without a message/conversation
 *       id are ignored and re-deliveries are dropped by message id, so nothing is shown twice.
 *   <li><b>App-update payload</b> (data-only, {@code type: app_update}). Rendered natively by
 *       {@link LovemeetlyUpdateNotifications} on the dedicated update channel: one fixed slot per
 *       release, never shown when the installed build is already current, and tapping it hands the
 *       fixed APK URL to Android's DownloadManager. Additive - the chat and call paths above are
 *       untouched.
 * </ol>
 *
 * <p>Together those rules give: a data-only chat push shows exactly one notification in every app
 * state (a ringing call notification for calls, a message notification otherwise), while the
 * notification-type foreground case still stays with the app's existing JS path.
 */
public class LovemeetlyMessagingService extends FirebaseMessagingService {

    private static final String TAG = "LovemeetlyFCM";

    /** Matches the web service worker's 120 character preview clamp. */
    private static final int MAX_PREVIEW_LENGTH = 120;

    /** Matches the web service worker's bounded duplicate guard. */
    private static final int MAX_TRACKED_IDS = 200;

    /** Extra keys read when the notification is tapped. */
    public static final String EXTRA_CONVERSATION_ID = "lovemeetlyNotifConversationId";
    public static final String EXTRA_MESSAGE_ID = "lovemeetlyNotifMessageId";

    /**
     * Recently handled message ids, used to drop re-deliveries. Static so it also survives service
     * restarts, the same approach the Firebase SDK uses for its own duplicate guard.
     */
    private static final Queue<String> RECENT_IDS = new ArrayDeque<>(MAX_TRACKED_IDS);

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();

        // Incoming calls take a different path from every other notification: they must ring even
        // when the app process was cold-started by FCM, so they are rendered natively here with the
        // dedicated call channel/ringtone/full-screen intent. Call pushes are data-only (a
        // `notification` block would be auto-displayed by the SDK and could not be intercepted).
        if (LovemeetlyCallPayload.fromData(data).isIncoming()) {
            // A foreground app already rings through the existing Socket.IO flow.
            if (!isAppInForeground()) {
                LovemeetlyCallNotifications.showIncomingCall(this, data);
            }
            return;
        }

        // App-update announcement (data-only, type = app_update). A distinct branch on purpose: an
        // update must never be treated as a chat message, and the chat/call paths below stay exactly
        // as they were. Rendered natively in every app state; the tap hands the fixed APK URL to
        // DownloadManager, so nothing about the running app changes until the user installs it.
        try {
            LovemeetlyUpdatePayload update = LovemeetlyUpdatePayload.fromData(data);
            if (update.isAppUpdate()) {
                LovemeetlyUpdateNotifications.showUpdateAvailable(this, update);
                return;
            }
        } catch (Exception error) {
            // A push must never crash the messaging service.
            Log.w(TAG, "Could not display app update notification: " + error.getMessage());
        }

        // Notification-type payloads: the SDK owns display in the background/closed case.
        // Rendering it here too would duplicate the notification.
        if (remoteMessage.getNotification() != null) {
            return;
        }

        // Data-only chat pushes are displayed natively in EVERY app state, including the foreground.
        // The Android build cannot fall back to the web path: the Capacitor WebView has no browser
        // `Notification` API, so the app's foreground JS notification helper is a no-op there - the
        // socket still updates the in-app UI (badge, sound, conversation list), but only this native
        // notification can pop up. displayDataMessage() ignores payloads without a message/
        // conversation id and drops re-deliveries by message id, so nothing is ever shown twice.
        try {
            displayDataMessage(data);
        } catch (Exception error) {
            // A push must never crash the messaging service.
            Log.w(TAG, "Could not display data message: " + error.getMessage());
        }
    }

    /**
     * Renders a data-only chat push using the same field names and copy as the web service worker,
     * so Android and web notifications read identically.
     */
    private void displayDataMessage(Map<String, String> data) {
        if (data == null || data.isEmpty()) {
            return;
        }

        String messageId = firstNonEmpty(data.get("messageId"), data.get("message_id"));
        String conversationId =
                firstNonEmpty(data.get("conversationId"), data.get("conversation_id"));

        // Same guard as the service worker: nothing actionable to show.
        if (messageId.isEmpty() && conversationId.isEmpty()) {
            return;
        }
        if (!messageId.isEmpty() && isAlreadyNotified(messageId)) {
            return;
        }

        String senderName = firstNonEmpty(data.get("senderName"), data.get("sender_name"));
        String title = firstNonEmpty(data.get("title"));
        String preview = firstNonEmpty(data.get("preview"), data.get("body"));

        String displayTitle =
                !senderName.isEmpty()
                        ? "New message from " + senderName
                        : (!title.isEmpty() ? title : "New message");

        String displayBody = preview.trim();
        if (displayBody.isEmpty()) {
            displayBody = "You have a new message on Lovemeetly.";
        }
        if (displayBody.length() > MAX_PREVIEW_LENGTH) {
            displayBody = displayBody.substring(0, MAX_PREVIEW_LENGTH - 3) + "...";
        }

        // Stable tag so a re-delivered message replaces the existing notification
        // instead of stacking a second one.
        String tag =
                !messageId.isEmpty()
                        ? "lovemeetly-msg-" + messageId
                        : "lovemeetly-conv-" + conversationId;

        show(tag, displayTitle, displayBody, conversationId, messageId);

        if (!messageId.isEmpty()) {
            rememberId(messageId);
        }
    }

    private void show(
            String tag, String title, String body, String conversationId, String messageId) {
        Context context = getApplicationContext();
        LovemeetlyNotifications.ensureChannel(context);

        // Covers both the Android 13+ runtime permission and the user's app-level
        // notification toggle. Without this the post would fail silently.
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) {
            Log.w(TAG, "Notifications are disabled for the app; push not displayed.");
            return;
        }

        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(EXTRA_CONVERSATION_ID, conversationId);
        intent.putExtra(EXTRA_MESSAGE_ID, messageId);

        int notificationId = tag.hashCode();
        PendingIntent contentIntent =
                PendingIntent.getActivity(
                        context,
                        notificationId,
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, LovemeetlyNotifications.CHANNEL_ID)
                        .setSmallIcon(R.drawable.ic_stat_lovemeetly)
                        .setColor(ContextCompat.getColor(context, R.color.lovemeetly_notification_color))
                        .setContentTitle(title)
                        .setContentText(body)
                        .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                        .setContentIntent(contentIntent);

        NotificationManagerCompat.from(context).notify(tag, notificationId, builder.build());
    }

    /**
     * Mirrors the Firebase SDK's own foreground test (screen unlocked and this process at
     * foreground importance) so the two display paths agree on what "foreground" means.
     */
    private boolean isAppInForeground() {
        try {
            KeyguardManager keyguardManager =
                    (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null && keyguardManager.isKeyguardLocked()) {
                return false; // Screen off or lock screen showing.
            }

            ActivityManager activityManager =
                    (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            if (activityManager == null) {
                return false;
            }

            List<ActivityManager.RunningAppProcessInfo> appProcesses =
                    activityManager.getRunningAppProcesses();
            if (appProcesses != null) {
                int pid = Process.myPid();
                for (ActivityManager.RunningAppProcessInfo process : appProcesses) {
                    if (process.pid == pid) {
                        return process.importance
                                == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND;
                    }
                }
            }
        } catch (Exception error) {
            Log.w(TAG, "Foreground check failed: " + error.getMessage());
        }
        return false;
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        // Persisted only. This callback can run while the app process was cold-started by FCM, where
        // no WebView (and therefore no authenticated session) exists, so no HTTP happens here. The
        // authenticated POST /api/push-tokens call is made later by the WebView layer through the
        // LovemeetlyPush plugin (src/utils/nativePushToken.ts).
        if (LovemeetlyPushTokens.setToken(getApplicationContext(), token)) {
            // Only a short prefix is logged: the full token must never reach logcat.
            Log.i(TAG, "FCM registration token stored: " + LovemeetlyPushTokens.maskToken(token));
        }
    }

    private static synchronized boolean isAlreadyNotified(String id) {
        return RECENT_IDS.contains(id);
    }

    private static synchronized void rememberId(String id) {
        if (RECENT_IDS.contains(id)) {
            return;
        }
        while (RECENT_IDS.size() >= MAX_TRACKED_IDS) {
            RECENT_IDS.poll();
        }
        RECENT_IDS.add(id);
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