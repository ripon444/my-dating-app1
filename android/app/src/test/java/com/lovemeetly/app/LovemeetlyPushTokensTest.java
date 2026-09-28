package com.lovemeetly.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

/**
 * Pure-logic guards for the native FCM push-token store: token sanitation, device-id stability and
 * log masking. The SharedPreferences round-trip itself is exercised on device (unit tests run on the
 * JVM without an Android context).
 */
public class LovemeetlyPushTokensTest {

    /** Real FCM registration tokens are far longer than this; keeps the fixture readable. */
    private static final String TOKEN = "dGhpc19pc19hX3Rlc3RfZmNtX3Rva2VuXzAxMjM0NTY3ODkw";

    @Test
    public void blankTokensAreNormalizedToEmpty() {
        assertEquals("", LovemeetlyPushTokens.normalizeToken(null));
        assertEquals("", LovemeetlyPushTokens.normalizeToken("   "));
    }

    @Test
    public void tokenIsTrimmedBeforeUse() {
        assertEquals(TOKEN, LovemeetlyPushTokens.normalizeToken("  " + TOKEN + "  "));
    }

    @Test
    public void emptyOrShortTokenIsNotUsable() {
        assertFalse(LovemeetlyPushTokens.isUsableToken(null));
        assertFalse(LovemeetlyPushTokens.isUsableToken(""));
        assertFalse(LovemeetlyPushTokens.isUsableToken("   "));
        assertFalse(LovemeetlyPushTokens.isUsableToken("short-token"));
    }

    @Test
    public void serverMinimumLengthTokenIsUsable() {
        // The backend accepts 20..4096 characters (server.ts).
        assertEquals(20, "12345678901234567890".length());
        assertTrue(LovemeetlyPushTokens.isUsableToken("12345678901234567890"));
        assertTrue(LovemeetlyPushTokens.isUsableToken(TOKEN));
    }

    @Test
    public void deviceIdKeepsTheAndroidNamespace() {
        String deviceId = LovemeetlyPushTokens.buildDeviceId("0d6f7c3a-1111-2222-3333-444455556666");

        assertTrue(deviceId.startsWith("android_"));
        assertEquals("android_0d6f7c3a-1111-2222-3333-444455556666", deviceId);
    }

    @Test
    public void deviceIdIsStableForTheSameUniquePartAndDiffersOtherwise() {
        String uuid = "0d6f7c3a-1111-2222-3333-444455556666";

        assertEquals(
                LovemeetlyPushTokens.buildDeviceId(uuid), LovemeetlyPushTokens.buildDeviceId(uuid));
        assertNotEquals(
                LovemeetlyPushTokens.buildDeviceId(uuid),
                LovemeetlyPushTokens.buildDeviceId("99999999-0000-0000-0000-000000000000"));
    }

    @Test
    public void generatedDeviceIdIsUsableAndWithinTheServerLimit() {
        String deviceId = LovemeetlyPushTokens.newDeviceId();

        assertTrue(deviceId.startsWith("android_"));
        assertTrue(deviceId.length() > "android_".length());
        assertTrue(deviceId.length() <= 255);
        assertEquals("", LovemeetlyPushTokens.buildDeviceId(null));
        assertEquals("", LovemeetlyPushTokens.buildDeviceId("  "));
    }

    @Test
    public void maskTokenNeverExposesTheWholeToken() {
        String masked = LovemeetlyPushTokens.maskToken(TOKEN);

        assertEquals("dGhpc19p...", masked);
        assertFalse(masked.contains(TOKEN));
        assertEquals("(none)", LovemeetlyPushTokens.maskToken(null));
        assertEquals("(none)", LovemeetlyPushTokens.maskToken(""));
        // A token at/below the prefix length must not be printed in full either.
        assertEquals("a***", LovemeetlyPushTokens.maskToken("abcdefgh"));
    }
}