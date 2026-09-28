package com.lovemeetly.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;

/**
 * Handles the tap on an app-update notification.
 *
 * <p>Runs without any Activity and without the WebView, so it works while the app is backgrounded or
 * fully closed: it hands the already validated APK URL to Android's DownloadManager through
 * {@link LovemeetlyApkDownloads} - the exact same flow the site's "Download APK" links use - which
 * downloads outside the app and posts its own progress/completion notification. If the download
 * cannot be started at all, the same fixed URL is opened in the browser as a last resort so the
 * update stays reachable. Nothing is ever installed silently.
 *
 * <p>Declared {@code exported=false}: only the app's own notification PendingIntent can invoke it.
 */
public class LovemeetlyUpdateDownloadReceiver extends BroadcastReceiver {

    private static final String TAG = "LovemeetlyUpdate";

    /** The one action that starts a download. */
    public static final String ACTION_UPDATE_DOWNLOAD =
            "com.lovemeetly.app.action.APP_UPDATE_DOWNLOAD";

    @Override
    public void onReceive(Context context, Intent intent) {
        handleUpdateTap(context, intent);
    }

    /**
     * Production handler for the notification tap. Never throws: a failed download must not crash
     * the app, and the site's own "Download APK" link keeps working as an alternative.
     */
    public static void handleUpdateTap(Context context, Intent intent) {
        if (context == null || intent == null) {
            return;
        }
        if (!ACTION_UPDATE_DOWNLOAD.equals(intent.getAction())) {
            return;
        }

        // apkUrl is already validated (LovemeetlyUpdatePayload only ever exposes a real APK URL and
        // falls back to the fixed public one), so no arbitrary host can be reached from here.
        LovemeetlyUpdatePayload payload = LovemeetlyUpdatePayload.fromIntent(intent);
        Log.i(TAG, "Update tapped: " + payload.dedupeKey());

        long downloadId = LovemeetlyApkDownloads.enqueue(context, payload.apkUrl);
        if (downloadId >= 0L) {
            return;
        }

        // Last resort: open the same fixed URL in the browser.
        try {
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(payload.apkUrl));
            browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(browser);
        } catch (Exception error) {
            Log.w(TAG, "Could not open the APK URL either: " + error.getMessage());
        }
    }
}