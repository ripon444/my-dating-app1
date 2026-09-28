package com.lovemeetly.app;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

/**
 * Native incoming-call screen shown by the call notification's full-screen intent.
 *
 * <p>Exists so a ringing call has a usable Answer/Decline surface on the lock screen, where the
 * Capacitor WebView cannot be shown. It does NOT implement any calling: Answer starts
 * {@link MainActivity} with the call id/caller extras and the existing web call flow
 * ({@code IncomingCallModal} / {@code CallOverlay}) takes over; Decline dismisses the ring and hands
 * the decision to the existing reject mechanism (see {@link LovemeetlyCallActionReceiver}).
 */
public class LovemeetlyCallActivity extends AppCompatActivity {

    /** Same window as the ringing notification's timeout, so screen and notification end together. */
    private static final long RING_TIMEOUT_MS = 45_000L;

    private LovemeetlyCallPayload payload;
    private Handler autoFinishHandler;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        payload = LovemeetlyCallPayload.fromIntent(getIntent());
        if (payload == null || payload.isEmpty()) {
            // Nothing callable (stale or hand-crafted intent): never show an empty call screen.
            finish();
            return;
        }

        showOverLockScreen();
        setContentView(R.layout.activity_incoming_call);
        bindViews();
        scheduleAutoFinish();
    }

    private void bindViews() {
        String callerName =
                payload.displayName(getString(R.string.lovemeetly_call_default_caller));

        TextView nameView = findViewById(R.id.lovemeetly_call_caller_name);
        nameView.setText(callerName);

        TextView typeView = findViewById(R.id.lovemeetly_call_caller_type);
        typeView.setText(
                getString(
                        payload.isVideoCall()
                                ? R.string.lovemeetly_call_video_label
                                : R.string.lovemeetly_call_voice_label));

        TextView subtitleView = findViewById(R.id.lovemeetly_call_subtitle);
        subtitleView.setText(
                getString(R.string.lovemeetly_call_incoming_subtitle, callerName));

        Button answer = findViewById(R.id.lovemeetly_call_answer_button);
        answer.setOnClickListener(view -> answerCall());

        Button decline = findViewById(R.id.lovemeetly_call_decline_button);
        decline.setOnClickListener(view -> declineCall());
    }

    /** Answer: dismiss the ring and open the existing call flow. */
    private void answerCall() {
        LovemeetlyCallNotifications.cancelCallNotification(this);
        LovemeetlyCallBridge.publish(this, payload, LovemeetlyCallNotifications.HANDOFF_ANSWER);

        Intent target = new Intent(this, MainActivity.class);
        target.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        payload.putInto(target);
        target.putExtra(LovemeetlyCallNotifications.EXTRA_ACTION, LovemeetlyCallNotifications.HANDOFF_ANSWER);
        startActivity(target);
        finish();
    }

    /** Decline: dismiss the ring and hand the rejection to the existing mechanism. */
    private void declineCall() {
        LovemeetlyCallNotifications.cancelCallNotification(this);
        LovemeetlyCallBridge.publish(this, payload, LovemeetlyCallNotifications.HANDOFF_DECLINE);
        finish();
    }

    /**
     * A newer call while this screen is already showing re-binds the screen to the new payload
     * (singleTask + full-screen intent deliver it through onNewIntent, not onCreate).
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        LovemeetlyCallPayload next = LovemeetlyCallPayload.fromIntent(intent);
        if (next != null && !next.isEmpty()) {
            payload = next;
            bindViews();
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Self-heal: the call may have been answered, declined, ended or timed out while this screen
        // was in the background, in which case there is nothing left to ring for.
        if (payload != null && !LovemeetlyCallNotifications.isRinging(this)) {
            finish();
        }
    }

    @Override
    protected void onDestroy() {
        if (autoFinishHandler != null) {
            autoFinishHandler.removeCallbacksAndMessages(null);
            autoFinishHandler = null;
        }
        super.onDestroy();
    }

    /**
     * Bounded lifetime: the ringing notification removes itself after this window, so the screen must
     * not linger either. Deliberately NOT driven by onStop(), because on a sleeping/locked device the
     * system stops this Activity while it still is the ringing surface.
     */
    private void scheduleAutoFinish() {
        autoFinishHandler = new Handler(Looper.getMainLooper());
        autoFinishHandler.postDelayed(this::finish, RING_TIMEOUT_MS);
    }

    /** Allow the ringing UI over the lock screen and light up the display. */
    private void showOverLockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow()
                    .addFlags(
                            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            KeyguardManager keyguardManager =
                    (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null && keyguardManager.isKeyguardLocked()) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        }
    }
}