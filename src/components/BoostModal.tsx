import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Flame, 
  Clock, 
  Sparkles, 
  X, 
  Check, 
  Loader2, 
  ExternalLink, 
  CreditCard, 
  Coins, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  ShieldCheck
} from 'lucide-react';
import { Profile, BoostPackage } from '../types';
import { api } from '../services/api';
import { useTranslation } from '../i18n/LanguageContext';

interface BoostModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: Profile | null;
  onBoostApplied: (updatedProfile: Profile) => void;
}

export const BoostModal: React.FC<BoostModalProps> = ({
  isOpen,
  onClose,
  profile,
  onBoostApplied,
}) => {
  const { t } = useTranslation();

  const [packages, setPackages] = useState<BoostPackage[]>([]);
  const [selectedPkgId, setSelectedPkgId] = useState<string>('');
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'crypto' | 'instant'>('crypto');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Invoice / polling state
  const [activeInvoice, setActiveInvoice] = useState<{
    invoiceUrl: string;
    orderId: string;
    amount: number;
    currency: string;
    packageName: string;
  } | null>(null);

  // Time remaining on current boost if active
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!profile?.boost_expires_at) {
      setTimeRemaining('');
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(profile.boost_expires_at!).getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeRemaining('');
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeRemaining(`${mins}m ${secs}s`);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [profile?.boost_expires_at]);

  // Load packages
  useEffect(() => {
    if (isOpen) {
      setIsLoadingPackages(true);
      setErrorMsg('');
      api.getBoostPackages()
        .then((res) => {
          if (res.packages && res.packages.length > 0) {
            setPackages(res.packages);
            // Default to popular or first
            const popular = res.packages.find((p) => p.is_popular);
            setSelectedPkgId(popular?.id || res.packages[0].id);
          } else {
            // Fallback default packages if database empty
            const defaults: BoostPackage[] = [
              { id: 'boost_30m', name: '30 Minutes Turbo Boost', duration_minutes: 30, multiplier: '10x', price: 4.99, currency: 'USDT', description: 'Ideal for prime evening browsing peak', is_popular: false, is_active: true, display_order: 1 },
              { id: 'boost_1h', name: '1 Hour Super Boost', duration_minutes: 60, multiplier: '15x', price: 7.99, currency: 'USDT', description: 'Maximum engagement for active weekend dates', is_popular: true, is_active: true, display_order: 2 },
              { id: 'boost_24h', name: '24 Hours Mega Spotlight', duration_minutes: 1440, multiplier: '25x', price: 14.99, currency: 'USDT', description: 'All-day top spotlight across all global feeds', is_popular: false, is_active: true, display_order: 3 },
            ];
            setPackages(defaults);
            setSelectedPkgId(defaults[1].id);
          }
        })
        .catch((err) => {
          console.warn('Failed to load boost packages:', err);
        })
        .finally(() => {
          setIsLoadingPackages(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const selectedPkg = packages.find((p) => p.id === selectedPkgId) || packages[0];

  const handleStartPayment = async () => {
    if (!selectedPkg) return;
    setIsProcessing(true);
    setErrorMsg('');

    try {
      if (paymentMethod === 'instant') {
        // Instant Test Pay
        const res = await api.completeBoostPayment(selectedPkg.id);
        if (res.success && res.profile) {
          onBoostApplied(res.profile);
          setSuccessMsg(`Boost activated! You now have top-priority placement with ${selectedPkg.multiplier || '10x'} more views.`);
          setTimeout(() => {
            setSuccessMsg('');
            onClose();
          }, 2400);
        } else {
          setErrorMsg(res.error || 'Failed to activate boost.');
        }
      } else {
        // Online NOWPayments invoice checkout
        const invoiceRes = await api.createBoostInvoice(selectedPkg.id);
        if (invoiceRes.success && invoiceRes.invoiceUrl) {
          setActiveInvoice({
            invoiceUrl: invoiceRes.invoiceUrl,
            orderId: invoiceRes.orderId,
            amount: invoiceRes.amount,
            currency: invoiceRes.currency,
            packageName: invoiceRes.packageName,
          });

          // Open invoice checkout
          try {
            window.open(invoiceRes.invoiceUrl, '_blank', 'noopener,noreferrer');
          } catch (e) {
            console.warn('Window open blocked, user can click link below.');
          }

          // Start status polling
          startStatusPolling(invoiceRes.orderId, selectedPkg.id);
        } else {
          // If live NOWPayments API key isn't set up yet, fallback seamlessly to instant pay with helpful note
          if (invoiceRes.error?.includes('API key') || invoiceRes.error?.includes('paused')) {
            setErrorMsg(invoiceRes.error + ' Switching to Instant VIP Pay.');
            setPaymentMethod('instant');
          } else {
            setErrorMsg(invoiceRes.error || 'Failed to initiate payment invoice.');
          }
        }
      }
    } catch (err: any) {
      console.error('Boost purchase error:', err);
      setErrorMsg(err.message || 'Payment processing failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const startStatusPolling = (orderId: string, pkgId: string) => {
    let attempts = 0;
    const maxAttempts = 30; // 2.5 minutes
    const interval = setInterval(async () => {
      attempts++;
      try {
        const res = await api.checkPaymentStatus(orderId);
        if (res && (res.paymentStatus === 'finished' || res.paymentStatus === 'confirmed')) {
          clearInterval(interval);
          // Complete activation on client side
          const activateRes = await api.completeBoostPayment(pkgId, orderId);
          if (activateRes.profile) {
            onBoostApplied(activateRes.profile);
          }
          setSuccessMsg('Crypto payment verified! Profile Boost is now active!');
          setActiveInvoice(null);
          setTimeout(() => {
            setSuccessMsg('');
            onClose();
          }, 2400);
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
        }
      } catch (e) {
        // Silent poll error
      }
    }, 5000);
  };

  const formatDurationBadge = (mins: number) => {
    if (mins < 60) return `${mins} Minutes`;
    if (mins === 60) return '1 Hour';
    if (mins < 1440) return `${Math.round(mins / 60)} Hours`;
    if (mins === 1440) return '24 Hours';
    return `${Math.round(mins / 1440)} Days`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-amber-500/30 shadow-2xl p-6 relative overflow-hidden flex flex-col text-center max-h-[95vh] overflow-y-auto">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Glow & Zap Icon */}
        <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-xl shadow-amber-500/30 mb-3">
          <Zap className="w-8 h-8 text-stone-950 fill-stone-950 animate-pulse" />
        </div>

        <h2 className="text-2xl font-bold text-white font-serif tracking-tight">
          {t('boostProfile')}
        </h2>
        <p className="text-xs text-stone-300 max-w-sm mx-auto mt-1 mb-4">
          Skip the line and get up to 25x more profile views in your area right now!
        </p>

        {/* Current Active Boost Status */}
        {timeRemaining && (
          <div className="mb-4 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2 text-left">
              <Flame className="w-4 h-4 text-amber-400 fill-amber-400 animate-bounce" />
              <div>
                <span className="font-bold">Currently Boosted!</span>
                <p className="text-[10px] text-amber-200/80">Purchasing adds extra time to your spotlight.</p>
              </div>
            </div>
            <div className="font-mono font-black text-sm text-white px-2 py-1 rounded-xl bg-amber-950/70 border border-amber-500/40">
              {timeRemaining}
            </div>
          </div>
        )}

        {/* Success Banner */}
        {successMsg && (
          <div className="p-6 bg-emerald-500/20 rounded-2xl border border-emerald-500/30 text-emerald-300 space-y-2 mb-4 animate-in fade-in">
            <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-400" />
            <h3 className="font-bold text-base">Boost Activated!</h3>
            <p className="text-xs">{successMsg}</p>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="p-3 mb-4 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Active Invoice Pending State */}
        {activeInvoice && !successMsg && (
          <div className="mb-5 p-4 rounded-2xl bg-stone-950 border border-amber-500/40 text-left space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Awaiting Crypto Payment Confirmation</span>
              </div>
              <span className="text-xs font-mono text-stone-400">
                ${activeInvoice.amount} {activeInvoice.currency}
              </span>
            </div>

            <p className="text-[11px] text-stone-400 leading-relaxed">
              We opened your NOWPayments checkout in a new window. Once confirmed on the blockchain, your boost will activate automatically.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <a
                href={activeInvoice.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 py-2 px-3 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-400 transition"
              >
                <span>Re-open Checkout Window</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                type="button"
                onClick={() => handleStartPayment()}
                className="py-2 px-3 rounded-xl bg-stone-800 text-stone-300 font-bold text-xs hover:bg-stone-700 transition"
              >
                Instant Confirm
              </button>
            </div>
          </div>
        )}

        {/* Packages Selector */}
        {!successMsg && !activeInvoice && (
          <>
            {isLoadingPackages ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                <span className="text-xs">Loading available boost packages...</span>
              </div>
            ) : (
              <div className="space-y-2.5 mb-5 text-left">
                {packages.map((opt) => {
                  const isSelected = selectedPkgId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedPkgId(opt.id)}
                      className={`w-full p-3.5 rounded-2xl border transition flex items-center justify-between text-left ${
                        isSelected
                          ? 'bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-950/20'
                          : 'bg-stone-800/60 border-stone-700/60 text-stone-300 hover:bg-stone-800'
                      }`}
                    >
                      <div className="space-y-0.5 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm text-stone-100">{opt.name}</span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                            {opt.multiplier || '10x'} Views
                          </span>
                          {opt.is_popular && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[9px] font-extrabold uppercase tracking-wide">
                              Best Value
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-400">{opt.description || 'Puts you at top of search'}</p>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-base font-extrabold text-amber-400 font-mono">
                          ${Number(opt.price).toFixed(2)}
                        </div>
                        <span className="text-[10px] text-stone-500 font-bold uppercase">{opt.currency || 'USDT'}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Payment Method Selector */}
            <div className="p-3 mb-5 rounded-2xl bg-stone-950 border border-stone-800 text-left space-y-2">
              <label className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block">
                Select Payment Option
              </label>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('crypto')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                    paymentMethod === 'crypto'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Coins className="w-4 h-4 text-amber-400" />
                  <div className="text-left">
                    <div>Crypto / USDT</div>
                    <div className="text-[10px] font-normal text-stone-400">NOWPayments Checkout</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('instant')}
                  className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition ${
                    paymentMethod === 'instant'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <div className="text-left">
                    <div>Instant Test Pay</div>
                    <div className="text-[10px] font-normal text-stone-400">Direct VIP Activation</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              onClick={handleStartPayment}
              disabled={isProcessing || !selectedPkg}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:opacity-95 text-stone-950 font-bold text-sm shadow-xl shadow-amber-900/30 flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Flame className="w-5 h-5 fill-stone-950" />
                  <span>
                    Pay ${selectedPkg ? Number(selectedPkg.price).toFixed(2) : '4.99'} & Boost Profile
                  </span>
                </>
              )}
            </button>
          </>
        )}

      </div>
    </div>
  );
};
