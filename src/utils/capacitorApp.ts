import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';

export interface BackButtonHandlers {
  hasOpenModal: () => boolean;
  closeActiveModal: () => void;
  canGoBack: () => boolean;
  goBack: () => void;
}

let isInitialized = false;
let currentHandlers: BackButtonHandlers | null = null;
let lastBackPressTime = 0;

/**
 * Initialize Capacitor Native Android features safely
 */
export function initializeCapacitorApp(handlers: BackButtonHandlers) {
  currentHandlers = handlers;

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  if (isInitialized) {
    return;
  }
  isInitialized = true;

  // 1. Status Bar Setup
  try {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#0c0a09' }).catch(() => {});
  } catch (err) {
    console.debug('StatusBar styling not supported:', err);
  }

  // 2. Android Hardware Back Button Handling (Singleton)
  try {
    App.addListener('backButton', () => {
      if (!currentHandlers) return;

      // Priority 1: Close open modal / popup
      if (currentHandlers.hasOpenModal()) {
        currentHandlers.closeActiveModal();
        return;
      }

      // Priority 2: Navigate back to Home from secondary tabs
      if (currentHandlers.canGoBack()) {
        currentHandlers.goBack();
        return;
      }

      // Priority 3: On Home screen, prevent accidental instant exit on launch
      const now = Date.now();
      if (now - lastBackPressTime < 2000) {
        App.exitApp();
      } else {
        lastBackPressTime = now;
        // Optional user feedback or toast
      }
    });
  } catch (err) {
    console.debug('Back button listener error:', err);
  }
}

// Alias to ensure backwards compatibility across builds
export const setupCapacitorApp = initializeCapacitorApp;
