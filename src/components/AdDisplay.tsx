import React, { useState, useEffect, useRef } from 'react';
import { ExternalLink, ShoppingBag, Sparkles, AlertCircle } from 'lucide-react';
import { Advertisement, AdPlacement } from '../types';
import { api } from '../services/api';

interface AdDisplayProps {
  placement: AdPlacement;
  className?: string;
  fallback?: React.ReactNode;
  maxHeight?: number | string;
}

// Global lightweight in-memory cache to deduplicate simultaneous placement fetches
let adsCache: { [placementKey: string]: { data: Advertisement[]; timestamp: number } } = {};
const CACHE_TTL_MS = 60000; // 1 minute

export const AdDisplay: React.FC<AdDisplayProps> = ({
  placement,
  className = '',
  fallback = null,
  maxHeight = 280,
}) => {
  const [ad, setAd] = useState<Advertisement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadAd() {
      if (isDismissed) return;
      try {
        setIsLoading(true);
        const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
        const deviceType = isMobile ? 'mobile' : 'desktop';
        const cacheKey = `${placement}_${deviceType}`;

        const cached = adsCache[cacheKey];
        let adsList: Advertisement[] = [];

        if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          adsList = cached.data;
        } else {
          const res = await api.getActiveAds(placement, deviceType);
          if (res?.success && Array.isArray(res.ads)) {
            adsList = res.ads;
            adsCache[cacheKey] = { data: adsList, timestamp: Date.now() };
          }
        }

        if (!isMounted) return;

        // Filter by placement, device target, and dates
        const now = new Date();
        const validAds = adsList.filter((item) => {
          if (item.status !== 'active') return false;

          // Date check
          if (item.startDate) {
            const start = new Date(item.startDate);
            if (!isNaN(start.getTime()) && now < start) return false;
          }
          if (item.endDate) {
            const end = new Date(item.endDate);
            if (!isNaN(end.getTime()) && now > end) return false;
          }

          // Device targeting check
          if (item.deviceTarget === 'mobile' && !isMobile) return false;
          if (item.deviceTarget === 'desktop' && isMobile) return false;

          // Placement check
          if (item.placement === 'mobile_only' && !isMobile) return false;
          if (item.placement === 'desktop_only' && isMobile) return false;

          return true;
        });

        // Sort by priority (1 is highest) then newest
        validAds.sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        if (validAds.length > 0) {
          setAd(validAds[0]);
        } else {
          setAd(null);
        }
      } catch (err) {
        if (isMounted) setHasError(true);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadAd();

    // Re-check when window is resized across breakpoint
    const handleResize = () => {
      loadAd();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      isMounted = false;
      window.removeEventListener('resize', handleResize);
    };
  }, [placement, isDismissed]);

  if (isDismissed || hasError || (!isLoading && !ad)) {
    return <>{fallback}</>;
  }

  if (isLoading && !ad) {
    return null; // Silent load to prevent jarring layout shift
  }

  if (!ad) return <>{fallback}</>;

  // Prepare safe isolated HTML document for iframe rendering
  const isAffiliateLink = ad.adType === 'affiliate_url';
  const cleanCode = (ad.codeOrUrl || '').trim();

  // Sterile sandbox HTML for code/script/banner embeds
  const sandboxDoc = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base target="_blank">
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: transparent;
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        min-height: 100%;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        color: #e7e5e4;
        text-align: center;
      }
      img {
        max-width: 100%;
        height: auto;
        display: block;
        margin: 0 auto;
        border-radius: 8px;
      }
      a {
        text-decoration: none;
        color: #f43f5e;
      }
      a:hover {
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    ${cleanCode}
  </body>
</html>`;

  return (
    <div
      className={`relative w-full rounded-2xl bg-stone-900/70 border border-stone-800/80 p-3 sm:p-4 overflow-hidden transition-all shadow-md group ${className}`}
      data-ad-placement={placement}
      data-ad-id={ad.id}
    >
      {/* Header bar / Ad Badge */}
      <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-stone-800/50 text-[10px] text-stone-400">
        <div className="flex items-center gap-1.5">
          <span className="px-1.5 py-0.5 rounded bg-stone-800 text-stone-300 font-semibold tracking-wider uppercase border border-stone-700/50">
            Sponsored
          </span>
          <span className="font-medium text-stone-400 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-rose-400" />
            {ad.network}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="text-stone-500 hover:text-stone-300 transition text-[10px] px-1 hover:bg-stone-800 rounded"
          title="Dismiss ad for this session"
        >
          ✕
        </button>
      </div>

      {/* Ad Content */}
      {isAffiliateLink ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-1">
          <div className="flex items-center gap-3 text-left w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-500/20 to-indigo-500/20 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="text-xs sm:text-sm font-semibold text-white truncate">
                {ad.name}
              </h4>
              <p className="text-[11px] text-stone-400 truncate">
                Official partner offer via {ad.network}
              </p>
            </div>
          </div>

          <a
            href={cleanCode}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/40 shrink-0"
          >
            <span>Visit Offer</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ) : (
        <div className="w-full overflow-hidden flex justify-center items-center" style={{ minHeight: '80px', maxHeight }}>
          <iframe
            ref={iframeRef}
            srcDoc={sandboxDoc}
            title={ad.name || 'Advertisement'}
            sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
            className="w-full border-0 rounded-lg bg-transparent"
            style={{ minHeight: '90px', maxHeight }}
            loading="lazy"
            onError={() => setHasError(true)}
          />
        </div>
      )}
    </div>
  );
};
