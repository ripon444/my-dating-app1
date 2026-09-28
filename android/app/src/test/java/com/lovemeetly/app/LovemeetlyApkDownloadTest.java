package com.lovemeetly.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Guard for the Android APK download path.
 *
 * <p>Only real APK downloads may be handed to DownloadManager: every other WebView download must
 * keep its previous (unhandled) behaviour, so no unrelated app function changes. The MIME check is
 * covered because a WebView {@code download} attribute can report an empty MIME type.
 */
public class LovemeetlyApkDownloadTest {

    /** The native constant must stay byte-identical to the web anchor's href. */
    @Test
    public void apkUrlMatchesTheFixedSiteUrl() {
        assertEquals("https://lovemeetly.com/downloads/lovemeetly.apk", LovemeetlyApkDownloads.APK_URL);
    }

    /** The filename must stay identical to the web anchor's download="lovemeetly.apk". */
    @Test
    public void apkFileNameMatchesTheWebDownloadAttribute() {
        assertEquals("lovemeetly.apk", LovemeetlyApkDownloads.APK_FILE_NAME);
    }

    /** Contract with the live URL's Content-Type, which DownloadManager is told to expect. */
    @Test
    public void apkMimeTypeMatchesTheServedContentType() {
        assertEquals(
                "application/vnd.android.package-archive", LovemeetlyApkDownloads.APK_MIME_TYPE);
    }

    /** A download attribute can arrive with an empty MIME type, so the path must be enough. */
    @Test
    public void fixedUrlWithEmptyMimeTypeIsAnApkDownload() {
        assertTrue(LovemeetlyApkDownloads.isApkDownload(LovemeetlyApkDownloads.APK_URL, ""));
        assertTrue(LovemeetlyApkDownloads.isApkDownload(LovemeetlyApkDownloads.APK_URL, null));
    }

    @Test
    public void queryAndFragmentAndUppercaseExtensionAreStillApkDownloads() {
        assertTrue(
                LovemeetlyApkDownloads.isApkDownload(
                        "https://lovemeetly.com/downloads/lovemeetly.apk?v=2#latest", ""));
        assertTrue(
                LovemeetlyApkDownloads.isApkDownload(
                        "https://lovemeetly.com/downloads/lovemeetly.APK", ""));
    }

    /** An APK served from a path without the extension is recognised by its MIME type. */
    @Test
    public void apkMimeTypeWithoutExtensionIsAnApkDownload() {
        assertTrue(
                LovemeetlyApkDownloads.isApkDownload(
                        "https://lovemeetly.com/downloads/latest",
                        LovemeetlyApkDownloads.APK_MIME_TYPE));
    }

    /** Normal site navigation and asset downloads must not be intercepted. */
    @Test
    public void normalPagesAndAssetsAreNotIntercepted() {
        assertFalse(LovemeetlyApkDownloads.isApkDownload("https://lovemeetly.com/", "text/html"));
        assertFalse(
                LovemeetlyApkDownloads.isApkDownload(
                        "https://lovemeetly.com/downloads/", "text/html"));
        assertFalse(
                LovemeetlyApkDownloads.isApkDownload(
                        "https://lovemeetly.com/assets/index-DAmDD120.js", "text/javascript"));
        assertFalse(
                LovemeetlyApkDownloads.isApkDownload(
                        "https://lovemeetly.com/uploads/photo.jpg", "image/jpeg"));
    }

    /** Only http/https downloads are handled; other schemes keep their old behaviour. */
    @Test
    public void nonHttpSchemesAndBlankValuesAreNotIntercepted() {
        assertFalse(
                LovemeetlyApkDownloads.isApkDownload("blob:https://lovemeetly.com/abc123", ""));
        assertFalse(
                LovemeetlyApkDownloads.isApkDownload(
                        "data:application/vnd.android.package-archive;base64,AAA", ""));
        assertFalse(
                LovemeetlyApkDownloads.isApkDownload("file:///storage/lovemeetly.apk", ""));
        assertFalse(LovemeetlyApkDownloads.isApkDownload("javascript:void(0)", ""));
        assertFalse(LovemeetlyApkDownloads.isApkDownload(null, LovemeetlyApkDownloads.APK_MIME_TYPE));
        assertFalse(LovemeetlyApkDownloads.isApkDownload("   ", ""));
    }
}
