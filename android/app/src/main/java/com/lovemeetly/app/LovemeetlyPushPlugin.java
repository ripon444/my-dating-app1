package com.lovemeetly.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Tasks;
import com.google.firebase.messaging.FirebaseMessaging;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Minimum bridge that exposes the device's FCM registration token to the WebView layer.
 *
 * <p>The token itself is produced by Firebase and persisted by {@link LovemeetlyPushTokens} (from
 * {@link LovemeetlyMessagingService#onNewToken} or the startup fetch in {@link MainActivity}). This
 * plugin only reads it back, so the WebView can register it through the existing authenticated
 * endpoint ({@code src/utils/nativePushToken.ts} → {@code api.registerPushToken} →
 * {@code POST /api/push-tokens} with {@code platform: 'android'}).
 *
 * <p>No Firebase internals are exposed: only {@code token} and {@code deviceId}. No authentication
 * happens here - the session stays inside the existing WebView/API flow.
 */
@CapacitorPlugin(name = "LovemeetlyPush")
public class LovemeetlyPushPlugin extends Plugin {

    /** Emitted when a different, usable token becomes known while the WebView is alive. */
    static final String EVENT_PUSH_TOKEN = "pushToken";

    private static final String TAG = "LovemeetlyPush";

    /** FCM token retrieval is network bound; never do it on the WebView/main thread. */
    private static final long TOKEN_FETCH_TIMEOUT_SECONDS = 10L;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    /** Last token value already surfaced to JS, so one token is never announced twice. */
    private static volatile String lastNotifiedToken = "";

    @Override
    public void load() {
        // Covers a token that changed while the app was closed: JS can register it right away.
        notifyIfTokenChanged(getContext());
    }

    @Override
    protected void handleOnResume() {
        // Covers a token refresh that arrived (via onNewToken) while the app was backgrounded.
        notifyIfTokenChanged(getContext());
    }

    /**
     * Resolves with the cached token + stable Android device id.
     *
     * <p>If nothing usable is cached (for example this install's token was issued before this feature
     * existed), one live FCM fetch is attempted. Any failure still resolves with an empty token, so JS
     * can simply skip registration - it never rejects or crashes.
     */
    @PluginMethod
    public void getPushToken(PluginCall call) {
        String cached = LovemeetlyPushTokens.getToken(getContext());
        if (LovemeetlyPushTokens.isUsableToken(cached)) {
            resolveToken(call, cached);
            return;
        }
        fetchToken(call);
    }

    /** Clears the locally cached token (device id stays stable). Used on logout. */
    @PluginMethod
    public void clearPushToken(PluginCall call) {
        LovemeetlyPushTokens.clearToken(getContext());
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdown();
        super.handleOnDestroy();
    }

    /** Background FCM fetch; persists what it gets and resolves the caller with the stored value. */
    private void fetchToken(@Nullable PluginCall call) {
        final Context context = getContext();
        try {
            executor.execute(
                    () -> {
                        String fetched = "";
                        try {
                            fetched =
                                    Tasks.await(
                                            FirebaseMessaging.getInstance().getToken(),
                                            TOKEN_FETCH_TIMEOUT_SECONDS,
                                            TimeUnit.SECONDS);
                        } catch (Exception error) {
                            Log.w(TAG, "FCM token fetch failed: " + error.getMessage());
                        }

                        LovemeetlyPushTokens.setToken(context, fetched);
                        if (call != null) {
                            String stored = LovemeetlyPushTokens.getToken(context);
                            mainHandler.post(() -> resolveToken(call, stored));
                        }
                    });
        } catch (Exception error) {
            // Executor rejected (plugin destroyed): answer immediately instead of hanging the caller.
            Log.w(TAG, "FCM token fetch skipped: " + error.getMessage());
            if (call != null) {
                resolveToken(call, LovemeetlyPushTokens.getToken(context));
            }
        }
    }

    private void resolveToken(PluginCall call, @Nullable String token) {
        try {
            call.resolve(tokenPayload(getContext(), token));
        } catch (Exception error) {
            Log.w(TAG, "Could not resolve getPushToken: " + error.getMessage());
        }
    }

    private JSObject tokenPayload(Context context, @Nullable String token) {
        JSObject data = new JSObject();
        data.put("token", token == null ? "" : token);
        data.put("deviceId", LovemeetlyPushTokens.getDeviceId(context));
        return data;
    }

    /**
     * Announces a token to JS once per distinct value. JavaScript still owns the (user, token)
     * registration guard, so a repeated announcement can never create a duplicate registration.
     */
    private void notifyIfTokenChanged(Context context) {
        String stored = LovemeetlyPushTokens.getToken(context);
        if (!LovemeetlyPushTokens.isUsableToken(stored) || stored.equals(lastNotifiedToken)) {
            return;
        }
        lastNotifiedToken = stored;
        try {
            notifyListeners(EVENT_PUSH_TOKEN, tokenPayload(context, stored), true);
        } catch (Exception error) {
            Log.w(TAG, "Could not announce push token: " + error.getMessage());
        }
    }
}