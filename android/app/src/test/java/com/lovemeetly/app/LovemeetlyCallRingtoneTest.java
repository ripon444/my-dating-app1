package com.lovemeetly.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.util.HashMap;
import java.util.Map;

/**
 * Ringtone/channel routing guard for the closed-app (background/killed) incoming-call notification.
 *
 * <p>The foreground web ringtone lives in the WebView ({@code IncomingCallModal} ->
 * /sounds/*-call-incoming.mp3) and cannot run when the app is not alive, so the native notification
 * path must map the call type to its own packaged ringtone and its own notification channel. A
 * regression here is exactly what made every closed-app call ring with the one pre-separation
 * ringtone.
 */
public class LovemeetlyCallRingtoneTest {

    private static Map<String, String> data(String... keysAndValues) {
        Map<String, String> map = new HashMap<>();
        for (int i = 0; i + 1 < keysAndValues.length; i += 2) {
            map.put(keysAndValues[i], keysAndValues[i + 1]);
        }
        return map;
    }

    @Test
    public void voiceCallUsesTheVoiceRingtoneResource() {
        assertEquals(R.raw.audio_call_incoming, LovemeetlyCallNotifications.callRingtoneResource(false));
    }

    @Test
    public void videoCallUsesTheVideoRingtoneResource() {
        assertEquals(R.raw.video_call_incoming, LovemeetlyCallNotifications.callRingtoneResource(true));
    }

    @Test
    public void voiceAndVideoRingtonesAreDistinctResources() {
        assertNotEquals(
                LovemeetlyCallNotifications.callRingtoneResource(false),
                LovemeetlyCallNotifications.callRingtoneResource(true));
    }

    @Test
    public void callChannelIsPerTypeAndNeverTheMessageChannel() {
        assertNotEquals(
                LovemeetlyNotifications.callChannelId(false),
                LovemeetlyNotifications.callChannelId(true));
        assertNotEquals(
                LovemeetlyNotifications.CHANNEL_ID, LovemeetlyNotifications.callChannelId(false));
        assertNotEquals(
                LovemeetlyNotifications.CHANNEL_ID, LovemeetlyNotifications.callChannelId(true));
    }

    /**
     * The channel that earlier builds created with the single pre-separation ringtone must no longer
     * be used: Android fixes a channel's sound when it is created, so reusing that id would keep
     * playing the old ringtone on every installed device.
     */
    @Test
    public void callChannelsDoNotReuseTheLegacyChannelIdWithTheOldSound() {
        assertNotEquals(
                LovemeetlyNotifications.LEGACY_CALL_CHANNEL_ID,
                LovemeetlyNotifications.callChannelId(false));
        assertNotEquals(
                LovemeetlyNotifications.LEGACY_CALL_CHANNEL_ID,
                LovemeetlyNotifications.callChannelId(true));
    }

    /** The FCM payload's existing {@code callType} field selects the ringtone, not the title/body. */
    @Test
    public void callTypeFromTheFcmPayloadSelectsTheRingtone() {
        LovemeetlyCallPayload voice =
                LovemeetlyCallPayload.fromData(
                        data(
                                "type", "call_incoming",
                                "callId", "call_voice_1",
                                "callerId", "usr_caller",
                                "receiverId", "usr_receiver",
                                "callType", "voice"));
        assertTrue(voice.isIncoming());
        assertFalse(voice.isVideoCall());
        assertEquals(
                R.raw.audio_call_incoming,
                LovemeetlyCallNotifications.callRingtoneResource(voice.isVideoCall()));

        LovemeetlyCallPayload video =
                LovemeetlyCallPayload.fromData(
                        data(
                                "type", "call_incoming",
                                "callId", "call_video_1",
                                "callerId", "usr_caller",
                                "receiverId", "usr_receiver",
                                "callType", "video"));
        assertTrue(video.isIncoming());
        assertTrue(video.isVideoCall());
        assertEquals(
                R.raw.video_call_incoming,
                LovemeetlyCallNotifications.callRingtoneResource(video.isVideoCall()));
    }

    /**
     * A payload without a call type stays a voice call (the native parser's existing default), so
     * nothing can ever end up on the message channel or on no ringtone at all.
     */
    @Test
    public void missingCallTypeFallsBackToTheVoiceRingtone() {
        LovemeetlyCallPayload payload =
                LovemeetlyCallPayload.fromData(
                        data("type", "call_incoming", "callId", "call_x", "callerId", "usr_caller"));

        assertFalse(payload.isVideoCall());
        assertEquals(
                R.raw.audio_call_incoming,
                LovemeetlyCallNotifications.callRingtoneResource(payload.isVideoCall()));
    }
}
