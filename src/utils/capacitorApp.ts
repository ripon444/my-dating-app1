import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { PushNotifications } from '@capacitor/push-notifications';

export interface BackButtonHandlers {
  hasOpenModal: () => boolean;
  closeActiveModal: () => void;
  canGoBack: () => boolean;
  goBack: () => void;
}

/**
 * Initialize Capacitor Native Android features (Back button, status bar, push notifications)
 */
export async function initializeCapacitorApp(handlers: BackButtonHandlers) {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // 1. Status Bar Setup (Dark theme matching Lovemeetly)
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#0c0a09' });
  } catch (err) {
    console.debug('StatusBar styling not supported or failed:', err);
  }

  // 2. Android Hardware Back Button Handling
  try {
    App.addListener('backButton', ({ canGoBack: navCanGoBack }) => {
      // Priority 1: If any modal or popup is open, close it
      if (handlers.hasOpenModal()) {
        handlers.closeActiveModal();
        return;
      }

      // Priority 2: If we are on a secondary tab/view (e.g. Chat, Profile, Calls, Matches), navigate back to Home
      if (handlers.canGoBack()) {
        handlers.goBack();
        return;
      }

      // Priority 3: If on home and can't go back further, exit app
      App.exitApp();
    });
  } catch (err) {
    console.debug('Back button listener error:', err);
  }

  // 3. Push Notifications Setup
  try {
    const permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      await PushNotifications.requestPermissions();
    }

    if (permStatus.receive === 'granted' || permStatus.receive === 'prompt') {
      await PushNotifications.register();
    }

    PushNotifications.addListener('registration', (token) => {
      console.log('Push notification token registered:', token.value);
      // Optional: sync push token to cPanel backend if needed
      try {
        localStorage.setItem('lovemeetly_push_token', token.value);
      } catch (e) {}
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.debug('Push registration error:', err.error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received:', notification);
    });
  } catch (err) {
    console.debug('Push notification setup failed or unsupported:', err);
  }
}
