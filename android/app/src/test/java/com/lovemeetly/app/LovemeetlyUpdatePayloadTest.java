package com.lovemeetly.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.HashMap;
import java.util.Map;

/**
 * Guard for the Android app-update push payload and its tap action.
 *
 * <p>Three rules matter in production and are pinned here:
 *
 * <ol>
 *   <li>only {@code type = app_update} is treated as an update - a chat or call payload must never
 *       be mistaken for one,
 *   <li>the version comparison is NUMERIC versionCode (10 &gt; 9) and a device that is already on the
 *       announced build is never offered it again,
 *   <li>the download URL always ends up as a real APK http(s) URL, falling back to the one fixed
 *       public URL for anything odd.
 * </ol>
 */
public class LovemeetlyUpdatePayloadTest {

    private static Map<String, String> payload(
            String type, String versionCode, String versionName, String apkUrl) {
        Map<String, String> data = new HashMap<>();
        data.put("type", type);
        data.put("versionCode", versionCode);
        data.put("versionName", versionName);
        data.put("apkUrl", apkUrl);
        return data;
    }

    /** The exact payload the server's buildAppUpdatePushData produces. */
    @Test
    public void canonicalUpdatePayloadIsParsed() {
        LovemeetlyUpdatePayload update =
                LovemeetlyUpdatePayload.fromData(
                        payload(
                                "app_update",
                                "2",
                                "2.0",
                                "https://lovemeetly.com/downloads/lovemeetly.apk"));

        assertTrue(update.isAppUpdate());
        assertEquals(2L, update.versionCode);
        assertEquals("2.0", update.versionName);
        assertEquals("https://lovemeetly.com/downloads/lovemeetly.apk", update.apkUrl);
        assertEquals("v2", update.dedupeKey());
        assertEquals("2.0", update.displayVersion());
        assertEquals("app_update", LovemeetlyUpdatePayload.TYPE_APP_UPDATE);
    }

    /** The fixed APK URL must stay identical to the web anchor and the downloader constant. */
    @Test
    public void defaultApkUrlIsTheFixedPublicUrl() {
        LovemeetlyUpdatePayload update =
                LovemeetlyUpdatePayload.fromData(payload("app_update", "2", "2.0", ""));

        assertEquals("https://lovemeetly.com/downloads/lovemeetly.apk", update.apkUrl);
        assertEquals(LovemeetlyApkDownloads.APK_URL, update.apkUrl);
    }

    /** The payload contract is also read with snake_case aliases. */
    @Test
    public void snakeCaseAliasesAreAccepted() {
        Map<String, String> data = new HashMap<>();
        data.put("type", "app_update");
        data.put("version_code", "3");
        data.put("version_name", "3.1");
        data.put("apk_url", "https://lovemeetly.com/downloads/lovemeetly.apk");

        LovemeetlyUpdatePayload update = LovemeetlyUpdatePayload.fromData(data);

        assertTrue(update.isAppUpdate());
        assertEquals(3L, update.versionCode);
        assertEquals("3.1", update.versionName);
        assertEquals("https://lovemeetly.com/downloads/lovemeetly.apk", update.apkUrl);
    }

    /** updateUrl is tolerated too (the field name the update-check endpoint uses). */
    @Test
    public void updateUrlAliasIsAccepted() {
        Map<String, String> data = new HashMap<>();
        data.put("type", "app_update");
        data.put("versionCode", "4");
        data.put("updateUrl", "https://lovemeetly.com/downloads/lovemeetly.apk");

        LovemeetlyUpdatePayload update = LovemeetlyUpdatePayload.fromData(data);

        assertEquals("https://lovemeetly.com/downloads/lovemeetly.apk", update.apkUrl);
        assertEquals(4L, update.versionCode);
    }

    /** A chat or call push must never be read as an update (no behaviour change for them). */
    @Test
    public void chatAndCallPayloadsAreNotUpdates() {
        Map<String, String> chat = new HashMap<>();
        chat.put("type", "chat_message");
        chat.put("messageId", "msg_1");
        chat.put("conversationId", "conv_1");

        Map<String, String> call = new HashMap<>();
        call.put("type", "call_incoming");
        call.put("callId", "call_1");

        assertFalse(LovemeetlyUpdatePayload.fromData(chat).isAppUpdate());
        assertFalse(LovemeetlyUpdatePayload.fromData(call).isAppUpdate());
        assertFalse(LovemeetlyUpdatePayload.fromData(new HashMap<>()).isAppUpdate());
        assertFalse(LovemeetlyUpdatePayload.fromData(null).isAppUpdate());
        assertFalse(LovemeetlyUpdatePayload.fromData(chat).shouldOffer(1L));
        assertFalse(LovemeetlyUpdatePayload.fromData(null).shouldOffer(1L));
    }

    /** versionCode parsing is integer-only and never invents a version. */
    @Test
    public void versionCodeParsingIsNumericOnly() {
        assertEquals(2L, LovemeetlyUpdatePayload.parseVersionCode("2"));
        assertEquals(2L, LovemeetlyUpdatePayload.parseVersionCode("  2  "));
        assertEquals(10L, LovemeetlyUpdatePayload.parseVersionCode("10"));
        assertEquals(0L, LovemeetlyUpdatePayload.parseVersionCode("2.0"));
        assertEquals(0L, LovemeetlyUpdatePayload.parseVersionCode("v2"));
        assertEquals(0L, LovemeetlyUpdatePayload.parseVersionCode("-3"));
        assertEquals(0L, LovemeetlyUpdatePayload.parseVersionCode("0"));
        assertEquals(0L, LovemeetlyUpdatePayload.parseVersionCode(""));
        assertEquals(0L, LovemeetlyUpdatePayload.parseVersionCode(null));
    }

    /** Only a genuinely newer build is offered - numeric comparison, so 10 beats 9. */
    @Test
    public void onlyANewerVersionCodeIsOffered() {
        LovemeetlyUpdatePayload ten =
                LovemeetlyUpdatePayload.fromData(payload("app_update", "10", "1.0.10", ""));

        assertTrue(ten.shouldOffer(9L));
        assertFalse(ten.shouldOffer(10L));
        assertFalse(ten.shouldOffer(11L));
        // An unreadable installed version (0) does not suppress the notice...
        assertTrue(ten.shouldOffer(0L));
        // ...but a payload without a versionCode can never be offered.
        assertFalse(
                LovemeetlyUpdatePayload.fromData(payload("app_update", "abc", "1.0", ""))
                        .shouldOffer(1L));
    }

    /** An odd or hostile apkUrl can never point the downloader at an arbitrary host. */
    @Test
    public void unusableApkUrlsFallBackToTheFixedUrl() {
        String fixed = "https://lovemeetly.com/downloads/lovemeetly.apk";
        String[] rejected = {
            null,
            "",
            "   ",
            "notaurl",
            "/downloads/lovemeetly.apk",
            "javascript:alert(1)",
            "data:application/vnd.android.package-archive;base64,AAA",
            "file:///sdcard/lovemeetly.apk",
            "https://evil.example.com/payload.bin"
        };

        for (String candidate : rejected) {
            assertEquals(
                    "should fall back for: " + candidate,
                    fixed,
                    LovemeetlyUpdatePayload.resolveApkUrl(candidate));
        }
        assertEquals(fixed, LovemeetlyUpdatePayload.resolveApkUrl(fixed));
    }

    /** A valid APK URL with a query string is still accepted (it really is an APK). */
    @Test
    public void otherRealApkUrlsAreAccepted() {
        assertEquals(
                "https://lovemeetly.com/downloads/lovemeetly.apk?v=2",
                LovemeetlyUpdatePayload.resolveApkUrl(
                        "https://lovemeetly.com/downloads/lovemeetly.apk?v=2"));
    }

    /** Version label and de-duplication key never come back empty. */
    @Test
    public void displayVersionAndDedupeKeyAlwaysHaveAValue() {
        LovemeetlyUpdatePayload noName =
                LovemeetlyUpdatePayload.fromData(payload("app_update", "7", "", ""));

        assertEquals("7", noName.displayVersion());
        assertEquals("v7", noName.dedupeKey());

        LovemeetlyUpdatePayload unknown =
                LovemeetlyUpdatePayload.fromData(payload("app_update", "", "", ""));

        assertEquals("update", unknown.displayVersion());
        assertEquals("unknown", unknown.dedupeKey());
    }

    /** The tap action is stable: the notification PendingIntent and the receiver must agree. */
    @Test
    public void tapActionIsStable() {
        assertEquals(
                "com.lovemeetly.app.action.APP_UPDATE_DOWNLOAD",
                LovemeetlyUpdateDownloadReceiver.ACTION_UPDATE_DOWNLOAD);
    }
}