package com.lovemeetly.app;

import android.content.Intent;

import androidx.annotation.Nullable;

import java.util.Map;

/**
 * App-update push payload (type = {@value #TYPE_APP_UPDATE}) for the Android update notification.
 *
 * <p>The backend sends a data-only FCM message built by {@code src/lib/push.ts}
 * ({@code buildAppUpdatePushData}) with the fields FCM data messages allow - all strings:
 *
 * <pre>
 * type        app_update                                   (required discriminator)
 * versionCode 2                                            (required: numeric comparison only)
 * versionName 2.0                                          (optional, display copy)
 * apkUrl      https://lovemeetly.com/downloads/lovemeetly.apk (optional, must be a real APK URL)
 * title/body  notification copy from the server            (optional, display only)
 * </pre>
 *
 * <p>Two deliberate safeguards live here, both pure and unit tested (see
 * LovemeetlyUpdatePayloadTest):
 *
 * <ul>
 *   <li>the announced build is only ever offered when its {@code versionCode} is NUMERICALLY greater
 *       than the installed one - never a string comparison, so 10 &gt; 9 as Android defines it, and a
 *       user who already installed the update is never told about it again.
 *   <li>the download URL is only accepted when the existing APK validator
 *       ({@link LovemeetlyApkDownloads#isApkDownload}) accepts it; anything else falls back to the
 *       one fixed public APK URL, so a tampered/odd payload can never point the downloader at an
 *       arbitrary host.
 * </ul>
 */
public final class LovemeetlyUpdatePayload {

    /** Discriminator set by the backend (src/lib/push.ts APP_UPDATE_TYPE). */
    public static final String TYPE_APP_UPDATE = "app_update";

    /** Tolerated aliases of the discriminator (defensive: the canonical value is app_update). */
    private static final String[] APP_UPDATE_TYPES = {
        TYPE_APP_UPDATE, "app-update", "app:update", "appUpdate"
    };

    /** Intent extras the tap receiver reads. Never user-visible. */
    public static final String EXTRA_VERSION_CODE = "lovemeetlyUpdateVersionCode";
    public static final String EXTRA_VERSION_NAME = "lovemeetlyUpdateVersionName";
    public static final String EXTRA_APK_URL = "lovemeetlyUpdateApkUrl";

    public final String type;

    /** Parsed versionCode, or 0 when the payload carries none/unparsable. */
    public final long versionCode;

    public final String versionName;

    /** Validated APK URL - always a usable APK http(s) URL, never empty. */
    public final String apkUrl;

    private LovemeetlyUpdatePayload(String type, long versionCode, String versionName, String apkUrl) {
        this.type = type;
        this.versionCode = versionCode;
        this.versionName = versionName;
        this.apkUrl = apkUrl;
    }

    /** Reads the payload from an FCM data message. Never returns null. */
    public static LovemeetlyUpdatePayload fromData(@Nullable Map<String, String> data) {
        if (data == null) {
            return new LovemeetlyUpdatePayload("", 0L, "", LovemeetlyApkDownloads.APK_URL);
        }
        return new LovemeetlyUpdatePayload(
                firstNonEmpty(data.get("type")),
                parseVersionCode(firstNonEmpty(data.get("versionCode"), data.get("version_code"))),
                firstNonEmpty(data.get("versionName"), data.get("version_name")),
                resolveApkUrl(
                        firstNonEmpty(
                                data.get("apkUrl"),
                                data.get("apk_url"),
                                data.get("updateUrl"),
                                data.get("update_url"))));
    }

    /** Reads the payload back from the notification's tap intent. Never returns null. */
    public static LovemeetlyUpdatePayload fromIntent(@Nullable Intent intent) {
        if (intent == null) {
            return new LovemeetlyUpdatePayload("", 0L, "", LovemeetlyApkDownloads.APK_URL);
        }
        return new LovemeetlyUpdatePayload(
                TYPE_APP_UPDATE,
                intent.getLongExtra(EXTRA_VERSION_CODE, 0L),
                firstNonEmpty(intent.getStringExtra(EXTRA_VERSION_NAME)),
                resolveApkUrl(intent.getStringExtra(EXTRA_APK_URL)));
    }

    /** Copies every field into an Intent used by the tap action. */
    public void putInto(Intent intent) {
        if (intent == null) {
            return;
        }
        intent.putExtra(EXTRA_VERSION_CODE, versionCode);
        intent.putExtra(EXTRA_VERSION_NAME, versionName);
        intent.putExtra(EXTRA_APK_URL, apkUrl);
    }

    /** True when this push announces a new app version. */
    public boolean isAppUpdate() {
        if (type == null || type.isEmpty()) {
            return false;
        }
        for (String candidate : APP_UPDATE_TYPES) {
            if (candidate.equalsIgnoreCase(type)) {
                return true;
            }
        }
        return false;
    }

    /**
     * True when the announced build is genuinely newer than the installed one.
     *
     * <p>Numeric on purpose (Android versionCode, never versionName). An unreadable installed
     * versionCode (0 or less) does not suppress the notification, because the update itself is
     * harmless to offer; a readable one that is already current does.
     */
    public boolean shouldOffer(long installedVersionCode) {
        if (!isAppUpdate() || versionCode <= 0L) {
            return false;
        }
        if (installedVersionCode <= 0L) {
            return true;
        }
        return versionCode > installedVersionCode;
    }

    /** Version label for the notification copy, never empty. */
    public String displayVersion() {
        if (versionName != null && !versionName.isEmpty()) {
            return versionName;
        }
        return versionCode > 0L ? String.valueOf(versionCode) : "update";
    }

    /** Key used to guarantee the same release is announced only once. */
    public String dedupeKey() {
        return versionCode > 0L ? "v" + versionCode : "unknown";
    }

    /** Positive versionCode from a numeric string, or 0 when absent/unparsable/non-positive. */
    static long parseVersionCode(@Nullable String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) {
            return 0L;
        }
        try {
            long parsed = Long.parseLong(value);
            return parsed > 0L ? parsed : 0L;
        } catch (NumberFormatException error) {
            return 0L;
        }
    }

    /**
     * Only a URL the existing APK validator accepts is used; everything else (missing, blank,
     * non-http, non-APK path) falls back to the one fixed public APK URL.
     *
     * <p>Deliberately validated with a {@code null} MIME type: the payload carries no MIME, and
     * passing {@link LovemeetlyApkDownloads#APK_MIME_TYPE} here would make that argument's check
     * always true and therefore accept any http(s) host. With {@code null} only the URL rule
     * applies, so a download can never be pointed outside the app's own APK URL.
     */
    static String resolveApkUrl(@Nullable String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.isEmpty()) {
            return LovemeetlyApkDownloads.APK_URL;
        }
        boolean usable = LovemeetlyApkDownloads.isApkDownload(trimmed, null);
        return usable ? trimmed : LovemeetlyApkDownloads.APK_URL;
    }

    /** First non-blank value, trimmed; empty string when none is usable. */
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