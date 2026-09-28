package com.lovemeetly.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * Handles the notification's Decline action.
 *
 * <p>Decline always dismisses the ringing notification natively. The existing Lovemeetly reject
 * mechanism is server-side ({@code POST /api/calls/:id/reject}) and needs the authenticated WebView
 * session, so this receiver only hands the decision over:
 *
 * <ul>
 *   <li>WebView alive: {@link LovemeetlyCallPlugin} publishes {@code callAction} immediately and the
 *       web layer calls the existing {@code api.rejectCall(callId)}.
 *   <li>Process killed: the decision is queued ({@link LovemeetlyCallBridge}) and delivered on the
 *       next app start, within the handoff TTL. Nothing can be rejected without the session token -
 *       documented limitation, no parallel protocol is invented.
 * </ul>
 *
 * <p>No Activity is started here, so tapping Decline never opens the app by surprise.
 */
public class LovemeetlyCallActionReceiver extends BroadcastReceiver {

    private static final String TAG = "LovemeetlyCall";

    @Override
    public void onReceive(Context context, Intent intent) {
        handleDeclineIntent(context, intent);
    }

    /**
     * Production handler for the notification's Decline action. Also called by the debug-only
     * receiver (this component is deliberately {@code exported=false}, so ADB/other apps cannot
     * invoke it directly).
     */
    public static void handleDeclineIntent(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        String action = intent.getAction();
        if (!LovemeetlyCallNotifications.ACTION_DECLINE.equals(action)) {
            return;
        }

        LovemeetlyCallPayload payload = LovemeetlyCallPayload.fromIntent(intent);
        Log.i(TAG, "Decline tapped for " + (payload == null ? "unknown call" : payload.dedupeKey()));
        LovemeetlyCallNotifications.cancelCallNotification(context);

        if (payload != null && !payload.isEmpty()) {
            LovemeetlyCallBridge.publish(
                    context, payload, LovemeetlyCallNotifications.HANDOFF_DECLINE);
        }
    }
}