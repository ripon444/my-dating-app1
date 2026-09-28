package com.lovemeetly.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.annotation.Nullable;

import java.util.UUID;

/**
 * Native store for the device's FCM registration token and a stable Android-only device id.
 *
 * <p>Why this exists: {@code FirebaseMessagingService.onNewToken()} can run while the app process was
 * cold-started by FCM and no WebView (and therefore no authenticated session) exists. So the native
 * side only <b>persists</b> the token here; the authenticated
 * {@code POST /api/push-tokens} call is made later by the WebView layer
 * ({@code src/utils/nativePushToken.ts}) through the {@link LovemeetlyPushPlugin}.
 *
 * <p>Nothing user-specific is stored: no session token, no account data. Only the FCM token and the
 * device id, both device-scoped values.
 *
 * <p>Writes use {@link SharedPreferences.Editor#apply()} so no path ever blocks the UI thread; if a
 * write were ever lost the token is simply re-fetched
 * ({@code FirebaseMessaging.getToken()} in MainActivity / the plugin) - it is never unrecoverable.
 */
public final class LovemeetlyPushTokens {

    private static final String TAG = "LovemeetlyPush";

    /** Dedicated prefs file: keeps push state separate from call handoff/state files. */
    private static final String PREFS = "lovemeetly_push_tokens";
    private static final String KEY_TOKEN = "fcm_token";
    private static final String KEY_DEVICE_ID = "android_device_id";

    /**
     * Device ids are namespaced so an Android id can never collide with (or delete) the web push
     * row: the server's unique index is {@code (user_id, device_id)} and web uses its own UUIDs.
     */
    static final String DEVICE_ID_PREFIX = "android_";

    /** Mirrors the server's accepted token range (server.ts validates 20..4096 characters). */
    static final int MIN_TOKEN_LENGTH = 20;

    /** The server slices deviceId at 255 characters. */
    static final int MAX_DEVICE_ID_LENGTH = 255;

    /** Only this many characters of a token may ever reach the logs. */
    static final int TOKEN_LOG_PREFIX_LENGTH = 8;

    private LovemeetlyPushTokens() {}

    /** Latest persisted FCM token, or {@code ""} when nothing usable is stored yet. */
    public static String getToken(Context context) {
        return normalizeToken(readPref(context, KEY_TOKEN));
    }

    /** True when a server-valid token is available locally (nothing is sent from here). */
    public static boolean hasStoredToken(Context context) {
        return isUsableToken(getToken(context));
    }

    /**
     * Persists the latest FCM token.
     *
     * @return true only when a different, usable token was stored (so callers can avoid re-notifying
     *     JavaScript for an unchanged token).
     */
    public static boolean setToken(Context context, @Nullable String rawToken) {
        String token = normalizeToken(rawToken);
        if (!isUsableToken(token)) {
            return false;
        }
        if (token.equals(readPref(context, KEY_TOKEN))) {
            return false;
        }
        writePref(context, KEY_TOKEN, token);
        return true;
    }

    /** Drops the cached token (used on logout). The device id is kept stable on purpose. */
    public static void clearToken(Context context) {
        writePref(context, KEY_TOKEN, "");
    }

    /**
     * Stable per-install device id, generated on first use and then reused.
     *
     * <p>A random UUID is used deliberately: no IMEI, serial, MAC address or any other restricted
     * identifier is read, so no extra permission is required.
     */
    public static String getDeviceId(Context context) {
        String existing = readPref(context, KEY_DEVICE_ID);
        if (existing != null && !existing.trim().isEmpty()) {
            return existing.trim();
        }
        String created = newDeviceId();
        writePref(context, KEY_DEVICE_ID, created);
        return created;
    }

    /** Trims a raw token, mapping null/blank to {@code ""}. */
    static String normalizeToken(@Nullable String raw) {
        return raw == null ? "" : raw.trim();
    }

    /** Same minimum length the backend enforces, so obviously unusable tokens are never sent. */
    static boolean isUsableToken(@Nullable String raw) {
        return normalizeToken(raw).length() >= MIN_TOKEN_LENGTH;
    }

    /** {@code android_<uniquePart>}, truncated to the server's column limit. Pure + testable. */
    static String buildDeviceId(String uniquePart) {
        String part = uniquePart == null ? "" : uniquePart.trim();
        if (part.isEmpty()) {
            return "";
        }
        String id = DEVICE_ID_PREFIX + part;
        return id.length() > MAX_DEVICE_ID_LENGTH ? id.substring(0, MAX_DEVICE_ID_LENGTH) : id;
    }

    /** New stable device id based on a random UUID (no restricted identifier is read). */
    static String newDeviceId() {
        return buildDeviceId(UUID.randomUUID().toString());
    }

    /**
     * Log-safe form of a token: at most the first {@value #TOKEN_LOG_PREFIX_LENGTH} characters, so the
     * full token never reaches logcat / crash reports.
     */
    static String maskToken(@Nullable String raw) {
        String token = normalizeToken(raw);
        if (token.isEmpty()) {
            return "(none)";
        }
        if (token.length() <= TOKEN_LOG_PREFIX_LENGTH) {
            return token.charAt(0) + "***";
        }
        return token.substring(0, TOKEN_LOG_PREFIX_LENGTH) + "...";
    }

    @Nullable
    private static String readPref(Context context, String key) {
        if (context == null) {
            return null;
        }
        try {
            return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(key, "");
        } catch (Exception error) {
            Log.w(TAG, "Could not read push token state: " + error.getMessage());
            return null;
        }
    }

    private static void writePref(Context context, String key, @Nullable String value) {
        if (context == null) {
            return;
        }
        try {
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putString(key, value == null ? "" : value)
                    .apply();
        } catch (Exception error) {
            Log.w(TAG, "Could not persist push token state: " + error.getMessage());
        }
    }
}