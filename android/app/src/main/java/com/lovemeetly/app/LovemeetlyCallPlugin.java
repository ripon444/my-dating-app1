package com.lovemeetly.app;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Minimum native bridge for the closed-app incoming-call path.
 *
 * <p>Registered by {@link MainActivity}. The web layer only uses it to receive an Answer/Decline
 * decision taken natively (notification action or {@link LovemeetlyCallActivity}) and to clear a
 * ringing notification. No call/WebRTC logic lives here - the existing web flow stays in charge.
 */
@CapacitorPlugin(name = "LovemeetlyCall")
public class LovemeetlyCallPlugin extends Plugin {

    @Override
    public void load() {
        LovemeetlyCallBridge.attachPlugin(this);
    }

    /** Returns a decision recorded while the WebView was not running, then clears it. */
    @PluginMethod
    public void consumePendingCallAction(PluginCall call) {
        JSObject pending = LovemeetlyCallBridge.consumePending(getContext());
        call.resolve(pending == null ? new JSObject() : pending);
    }

    /** Clears a ringing incoming-call notification (used once the web call UI takes over). */
    @PluginMethod
    public void dismissIncomingCall(PluginCall call) {
        LovemeetlyCallNotifications.cancelCallNotification(getContext());
        call.resolve();
    }

    /** Delivers a decision to a live WebView; retained until the JS listener registers. */
    void deliver(JSObject data) {
        notifyListeners(LovemeetlyCallBridge.EVENT_CALL_ACTION, data, true);
    }

    @Override
    protected void handleOnDestroy() {
        LovemeetlyCallBridge.detachPlugin(this);
        super.handleOnDestroy();
    }
}