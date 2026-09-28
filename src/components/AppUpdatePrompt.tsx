import React, { useCallback, useState } from 'react';
import { Download, Info, Sparkles } from 'lucide-react';

import { openAndroidUpdateDownload, useAndroidAppUpdatePrompt } from '../utils/appUpdate';

interface AppUpdatePromptProps {
  /**
   * True while a call UI owns the screen (a ringing incoming call or an active call).
   * The prompt is then simply not rendered and reappears afterwards, so it can never
   * cover the Answer/Decline buttons or a running call.
   */
  paused?: boolean;
}

/**
 * ANDROID-ONLY in-app update prompt.
 *
 * Rendered once from App.tsx. It renders nothing at all outside the Android app
 * (the hook is inert on the web), nothing while no newer release is published, and
 * nothing while it is paused by a call. There is exactly one instance, so duplicate
 * dialogs cannot stack, and "Later" is remembered for the rest of the session by the
 * hook - so it never reappears every few seconds.
 */
export const AppUpdatePrompt: React.FC<AppUpdatePromptProps> = ({ paused = false }) => {
  const { update, dismiss } = useAndroidAppUpdatePrompt();
  const [downloadStarted, setDownloadStarted] = useState(false);

  const handleUpdateNow = useCallback(() => {
    if (!update) return;
    openAndroidUpdateDownload(update.updateUrl);
    setDownloadStarted(true);
  }, [update]);

  const handleLater = useCallback(() => {
    setDownloadStarted(false);
    dismiss();
  }, [dismiss]);

  if (!update || paused) return null;

  const forced = update.forceUpdate;
  const title = forced ? 'Update Required' : 'New Update Available';
  const message = forced
    ? `Lovemeetly ${update.latestVersionName} is required to keep using the app.`
    : `Lovemeetly ${update.latestVersionName} is now available.`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-update-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-950/90 backdrop-blur-xl animate-in fade-in"
    >
      {/* Backdrop. A forced update is not dismissible, so it gets no backdrop button. */}
      {!forced && (
        <button
          type="button"
          aria-label="Later"
          onClick={handleLater}
          className="absolute inset-0 bg-transparent cursor-default"
        />
      )}

      <div className="relative z-10 bg-stone-900 w-full max-w-md rounded-3xl border border-rose-500/30 shadow-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-5 border-b border-stone-800 bg-stone-950 flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <Download className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <h2 id="app-update-title" className="text-lg font-bold text-white font-serif">
              {title}
            </h2>
            <p className="text-xs text-stone-400 truncate">{message}</p>
          </div>
        </div>

        <div className="p-6 space-y-4 text-xs sm:text-sm text-stone-300 leading-relaxed">
          <p className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{message}</span>
          </p>

          {update.releaseNotes ? (
            <div className="p-4 rounded-2xl bg-stone-950/60 border border-stone-800 space-y-1.5">
              <div className="font-bold text-stone-200 text-xs uppercase tracking-wider">
                What&apos;s new
              </div>
              <p className="text-[11px] sm:text-xs text-stone-400 whitespace-pre-line">
                {update.releaseNotes}
              </p>
            </div>
          ) : null}

          <p className="flex items-start gap-2 text-[11px] text-stone-400">
            <Info className="w-3.5 h-3.5 mt-0.5 text-stone-500 shrink-0" />
            <span>
              {downloadStarted
                ? 'Download started. Check your notifications, then open lovemeetly.apk to install the update.'
                : 'The download runs in the background. Open the downloaded lovemeetly.apk to install the update.'}
            </span>
          </p>
        </div>

        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5">
          {!forced && (
            <button
              type="button"
              onClick={handleLater}
              className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs border border-stone-700 transition-colors"
            >
              Later
            </button>
          )}
          <button
            type="button"
            onClick={handleUpdateNow}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Update Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppUpdatePrompt;
