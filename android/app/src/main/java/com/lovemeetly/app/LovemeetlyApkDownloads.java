package com.lovemeetly.app;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.util.Log;
import android.webkit.DownloadListener;
import android.webkit.WebView;

import androidx.annotation.Nullable;

import java.util.Locale;

/**
 * Makes the site's "Download APK" option work inside the Android app.
 *
 * <p>Why this exists: Capacitor's WebView installs no {@code DownloadListener} (verified in
 * {@code com.getcapacitor.Bridge}), so tapping
 * {@code <a href="https://lovemeetly.com/downloads/lovemeetly.apk" download="lovemeetly.apk">}
 * only asks Chromium to load a binary it cannot render: nothing is downloaded and the user sees no
 * reaction at all. Both site entries (Profile &gt; Settings and the mobile Discover tab) use that
 * same anchor inside the same WebView, so both are fixed here - the URL itself is untouched.
 *
 * <p>Only APK downloads are intercepted. Every other download keeps the previous (unhandled)
 * behaviour, so no unrelated app function changes.
 */
public final class LovemeetlyApkDownloads {

    private static final String TAG = "LovemeetlyDownload";

    /** The one APK the site links to. Kept identical to the web anchor's href. */
    public static final String APK_URL = "https://lovemeetly.com/downloads/lovemeetly.apk";

    /** Matches the web anchor's {@code download="lovemeetly.apk"}. */
    static final String APK_FILE_NAME = "lovemeetly.apk";

    /** The MIME the live URL answers with (verified by HEAD: 200,
     *  {@code application/vnd.android.package-archive}). */
    static final String APK_MIME_TYPE = "application/vnd.android.package-archive";

    private LovemeetlyApkDownloads() {}

    /**
     * Attaches the APK download handler to the Capacitor WebView.
     *
     * <p>Never throws: a failure here must not affect app start-up, and the rest of the app keeps
     * working exactly as before.
     */
    public static void attach(@Nullable WebView webView, @Nullable final Context context) {
        if (webView == null || context == null) {
            return;
        }
        try {
            webView.setDownloadListener(
                    new DownloadListener() {
                        @Override
                        public void onDownloadStart(
                                String url,
                                String userAgent,
                                String contentDisposition,
                                String mimeType,
                                long contentLength) {
                            if (!isApkDownload(url, mimeType)) {
                                // Unchanged behaviour for everything that is not an APK.
                                Log.w(TAG, "Download not handled (not an APK): " + url);
                                return;
                            }
                            enqueue(context, url);
                        }
                    });
        } catch (Exception error) {
            Log.w(TAG, "Could not attach APK download handler: " + error.getMessage());
        }
    }

    /**
     * True when a WebView download is an APK, by URL path or by MIME type.
     *
     * <p>The MIME check is not redundant: a {@code download} attribute can reach
     * {@code onDownloadStart} with an empty MIME type, while an APK served from another path still
     * reports the package MIME. Only http/https URLs are handled. Pure and unit tested.
     */
    public static boolean isApkDownload(@Nullable String url, @Nullable String mimeType) {
        if (url == null) {
            return false;
        }
        String trimmed = url.trim();
        if (trimmed.isEmpty()) {
            return false;
        }
        String lower = trimmed.toLowerCase(Locale.US);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            return false;
        }
        if (isApkPath(lower)) {
            return true;
        }
        return mimeType != null && APK_MIME_TYPE.equalsIgnoreCase(mimeType.trim());
    }

    /**
     * Hands the download to Android's DownloadManager, which performs it outside the WebView and
     * shows its own progress/completion notification.
     *
     * @return the enqueued download id, or -1 when the download could not be started
     */
    static long enqueue(Context context, String url) {
        try {
            DownloadManager manager =
                    (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                Log.w(TAG, "DownloadManager is unavailable; APK download skipped.");
                return -1;
            }

            DownloadManager.Request request =
                    new DownloadManager.Request(Uri.parse(url))
                            .setMimeType(APK_MIME_TYPE)
                            .setTitle(context.getString(R.string.lovemeetly_apk_download_title))
                            .setDescription(
                                    context.getString(R.string.lovemeetly_apk_download_description))
                            .setNotificationVisibility(
                                    DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                            .setAllowedOverMetered(true)
                            .setAllowedOverRoaming(true);

            // Files land in the public Downloads folder, the same place a browser download goes.
            // The explicit name is only set on API 29+, where DownloadManager owns that folder and
            // needs no storage permission; below that the request keeps DownloadManager's own
            // default destination instead of asking for WRITE_EXTERNAL_STORAGE.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                request.setDestinationInExternalPublicDir(
                        Environment.DIRECTORY_DOWNLOADS, APK_FILE_NAME);
            }

            long downloadId = manager.enqueue(request);
            Log.i(TAG, "APK download enqueued: id=" + downloadId);
            return downloadId;
        } catch (Exception error) {
            Log.w(TAG, "APK download could not be started: " + error.getMessage());
            return -1;
        }
    }

    /** True when the (already lower-cased) URL path ends in {@code .apk}, ignoring query/fragment. */
    private static boolean isApkPath(String lowerCaseUrl) {
        int end = lowerCaseUrl.length();
        int query = lowerCaseUrl.indexOf('?');
        if (query >= 0 && query < end) {
            end = query;
        }
        int fragment = lowerCaseUrl.indexOf('#');
        if (fragment >= 0 && fragment < end) {
            end = fragment;
        }
        return lowerCaseUrl.substring(0, end).endsWith(".apk");
    }
}
