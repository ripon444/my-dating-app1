import React, { useState, useEffect, useRef } from 'react';
import { 
  Crown, 
  Check, 
  X, 
  Sparkles, 
  Zap, 
  Globe, 
  Languages, 
  ShieldCheck, 
  Video, 
  Flame,
  Loader2,
  Lock,
  ExternalLink,
  RefreshCw,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { User, SubscriptionPlan } from '../types';
import { api } from '../services/api';
import { useTranslation } from '../i18n/LanguageContext';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onSubscriptionUpdated: (updatedUser: User) => void;
  initialOrderId?: string | null;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  user,
  onSubscriptionUpdated,
  initialOrderId,
}) => {
  const { t } = useTranslation();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active user subscription status details
  const [subStatus, setSubStatus] = useState<{
    tier: string;
    expiresAt: string | null;
    daysRemaining: number;
  } | null>(null);

  // Active Payment In-Flight / Polling State
  const [activeOrder, setActiveOrder] = useState<{
    orderId: string;
    invoiceUrl?: string;
    planName: string;
    amount: number;
    currency: string;
    status: string; // 'waiting' | 'confirming' | 'finished' | 'failed'
  } | null>(null);

  const pollTimerRef = useRef<any>(null);

  // Load plans & user subscription status whenever modal opens
  useEffect(() => {
    if (!isOpen) {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      setActiveOrder(null);
      setErrorMessage('');
      setSuccessMessage('');
      return;
    }

    let isMounted = true;
    setIsLoadingPlans(true);

    api.getSubscriptionPlans()
      .then((res) => {
        if (isMounted) {
          // Sort active plans by display_order
          const sorted = (res.plans || []).filter(p => p.is_active !== false).sort((a, b) => a.display_order - b.display_order);
          setPlans(sorted);
        }
      })
      .catch((err) => {
        console.warn('Failed to load plans:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlans(false);
      });

    // Load active subscription status
    api.getMySubscriptionStatus()
      .then((res) => {
        if (isMounted && res) {
          setSubStatus({
            tier: res.tier || user?.subscriptionTier || 'FREE',
            expiresAt: res.expiresAt || user?.subscriptionExpiresAt || null,
            daysRemaining: res.daysRemaining || 0,
          });
          if (res.user) {
            onSubscriptionUpdated(res.user);
          }
        }
      })
      .catch(() => {});

    // If initialOrderId was provided (e.g., return from payment redirect)
    if (initialOrderId) {
      setActiveOrder({
        orderId: initialOrderId,
        planName: 'VIP Plan Upgrade',
        amount: 0,
        currency: 'USDT',
        status: 'waiting',
      });
      startPollingPayment(initialOrderId);
    }

    return () => {
      isMounted = false;
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [isOpen, initialOrderId]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Poll Payment Status helper
  const startPollingPayment = (orderId: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    let checkCount = 0;
    const checkOnce = async () => {
      checkCount++;
      try {
        const res = await api.checkPaymentStatus(orderId);
        if (res.isCompleted || res.paymentStatus === 'finished') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setActiveOrder((prev) => prev ? { ...prev, status: 'finished' } : null);
          setSuccessMessage(`Payment confirmed! Your VIP Subscription is now active.`);
          if (res.user) {
            onSubscriptionUpdated(res.user);
          }
          setTimeout(() => {
            setSuccessMessage('');
            setActiveOrder(null);
            onClose();
          }, 3500);
          return;
        }

        if (res.paymentStatus === 'failed' || res.paymentStatus === 'expired') {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
          setActiveOrder((prev) => prev ? { ...prev, status: 'failed' } : null);
          setErrorMessage('Payment expired or cancelled. Please try again.');
          return;
        }

        // Still waiting or confirming
        setActiveOrder((prev) => {
          if (!prev) {
            return {
              orderId: res.orderId,
              planName: res.planName || 'VIP Subscription',
              amount: Number(res.amount || 0),
              currency: res.currency || 'USDT',
              status: res.paymentStatus,
            };
          }
          return {
            ...prev,
            status: res.paymentStatus,
            planName: prev.planName && prev.planName !== 'VIP Plan Upgrade' ? prev.planName : (res.planName || prev.planName),
            amount: prev.amount > 0 ? prev.amount : (Number(res.amount) || 0),
            currency: prev.currency || res.currency || 'USDT',
          };
        });

        // Max poll ~5 minutes (60 checks * 5s)
        if (checkCount > 60) {
          if (pollTimerRef.current) clearInterval(pollTimerRef.current);
        }
      } catch (err) {
        console.warn('Status poll check error:', err);
      }
    };

    // Initial check
    checkOnce();
    // Poll every 4 seconds
    pollTimerRef.current = setInterval(checkOnce, 4000);
  };

  // Handle Free Plan Subscription
  const handleSubscribeFree = async (plan: SubscriptionPlan) => {
    setIsProcessingId(plan.id);
    setErrorMessage('');
    try {
      const res = await api.subscribeFree(plan.id);
      onSubscriptionUpdated(res.user);
      setSuccessMessage(res.message || 'Free VIP tier activated successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not activate free subscription');
    } finally {
      setIsProcessingId(null);
    }
  };

  // Handle NOWPayments Checkout
  const handleCheckoutPaid = async (plan: SubscriptionPlan) => {
    setIsProcessingId(plan.id);
    setErrorMessage('');
    try {
      const res = await api.createPaymentInvoice(plan.id);

      if (res.invoiceUrl) {
        // If inside an iframe (like AI Studio preview), open in a new tab so frame restrictions don't block it
        // On the live website (lovemeetly.com), directly redirect straight to NOWPayments checkout
        const inIframe = typeof window !== 'undefined' && window.self !== window.top;
        if (inIframe) {
          const paymentWin = window.open(res.invoiceUrl, '_blank');
          if (!paymentWin) {
            window.location.href = res.invoiceUrl;
          }
        } else {
          window.location.href = res.invoiceUrl;
        }

        // Set active order and start polling in case browser tab remains
        setActiveOrder({
          orderId: res.orderId,
          invoiceUrl: res.invoiceUrl,
          planName: plan.name,
          amount: Number(plan.price || plan.price_usdt || res.amount || 0),
          currency: 'USDT',
          status: 'waiting',
        });

        startPollingPayment(res.orderId);
      } else {
        throw new Error('Payment gateway did not return an invoice link');
      }
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      setErrorMessage(err.message || 'Failed to initialize payment. Please try again later.');
    } finally {
      setIsProcessingId(null);
    }
  };

  if (!isOpen) return null;

  // Format expiry date cleanly
  const formattedExpiry = subStatus?.expiresAt
    ? new Date(subStatus.expiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-stone-900 w-full max-w-4xl rounded-3xl border border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="px-6 py-5 border-b border-stone-800 flex items-center justify-between bg-stone-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white shadow-lg shadow-rose-950/50">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white font-serif tracking-tight">{t('upgradePlan')}</h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  NOWPayments USDT
                </span>
              </div>
              <p className="text-xs text-stone-400">Unlock borderless global dating, video calling & AI matchmaking</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Plan Status Banner */}
        {subStatus && (
          <div className="px-6 py-3 bg-stone-950/40 border-b border-stone-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-stone-400">Your Current Status:</span>
              <span className={`px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[11px] ${
                subStatus.tier === 'VIP'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : subStatus.tier === 'PREMIUM'
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'bg-stone-800 text-stone-300'
              }`}>
                {subStatus.tier} Member
              </span>
              {formattedExpiry && subStatus.daysRemaining > 0 && (
                <span className="text-stone-400">
                  • Expires on <strong className="text-stone-200">{formattedExpiry}</strong> ({subStatus.daysRemaining} days remaining)
                </span>
              )}
            </div>
            {subStatus.tier === 'VIP' && (
              <div className="text-[11px] text-amber-400/90 font-medium flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Purchasing any plan will extend your active subscription</span>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-3.5 bg-red-950/60 border-b border-red-800/80 text-red-300 text-xs font-semibold flex items-center justify-between gap-2 px-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3.5 bg-emerald-950/60 border-b border-emerald-800/80 text-emerald-300 text-xs font-semibold flex items-center gap-2 px-6">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Payment In-Flight Status Tracker (Overlay or In-line) */}
        {activeOrder && (
          <div className="mx-6 my-4 p-5 rounded-2xl bg-gradient-to-r from-stone-900 to-stone-950 border-2 border-amber-500/40 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Coins className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>Payment Processing for {activeOrder.planName}</span>
                    <span className="px-2 py-0.5 rounded-full bg-stone-800 text-[10px] font-mono text-amber-300">
                      Order: {activeOrder.orderId}
                    </span>
                  </h4>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Amount: <strong className="text-white">{activeOrder.amount > 0 ? activeOrder.amount : ''} {activeOrder.currency || 'USDT'}</strong> • Multi-Crypto Gateway
                  </p>
                </div>
              </div>

              {activeOrder.invoiceUrl && (
                <a
                  href={activeOrder.invoiceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Checkout Page</span>
                </a>
              )}
            </div>

            {/* Status Steps */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-950/80 border border-stone-800 text-xs">
              <div className="flex items-center gap-2">
                {activeOrder.status === 'finished' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                )}
                <span className="text-stone-300">
                  Status: <strong className="uppercase text-amber-400">{activeOrder.status}</strong>
                </span>
                <span className="text-stone-500 text-[11px]">
                  ({activeOrder.status === 'finished' ? 'Payment Completed & Activated!' : 'Listening for blockchain confirmation...'})
                </span>
              </div>

              <button
                type="button"
                onClick={() => startPollingPayment(activeOrder.orderId)}
                className="text-stone-400 hover:text-white flex items-center gap-1 text-[11px] font-semibold transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Check Now</span>
              </button>
            </div>
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          {isLoadingPlans ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
              <span className="text-xs">Loading available subscription plans...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((plan) => {
                const isFree = plan.price_usdt === 0;
                const isVip = plan.tier === 'VIP';
                const isPremium = plan.tier === 'PREMIUM';
                const isCurrentPlan = subStatus?.tier === plan.tier && (isFree || (subStatus?.daysRemaining || 0) > 0);
                const isProcessing = isProcessingId === plan.id;

                const durationText = plan.duration === 1 && plan.duration_unit === 'months'
                  ? '1 month'
                  : `${plan.duration} ${plan.duration_unit}`;

                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-3xl p-6 flex flex-col justify-between transition-all ${
                      isVip && !isFree
                        ? 'bg-gradient-to-b from-amber-950/40 via-stone-900 to-stone-900 border-2 border-amber-500/50 shadow-2xl'
                        : isFree
                        ? 'bg-stone-900/60 border border-stone-800'
                        : 'bg-stone-900 border-2 border-purple-500/40 shadow-xl'
                    }`}
                  >
                    {/* Top Tag & Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isVip && !isFree
                            ? 'bg-amber-500 text-stone-950 font-black'
                            : isFree
                            ? 'bg-stone-800 text-stone-300'
                            : 'bg-purple-600 text-white'
                        }`}
                      >
                        {isFree ? 'Free Trial' : isVip ? 'Best Value' : 'Popular'}
                      </span>

                      {isCurrentPlan && (
                        <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> Active Plan
                        </span>
                      )}
                    </div>

                    {/* Plan Name & Price */}
                    <div className="space-y-1 mb-5">
                      <h3 className="text-xl font-bold text-white font-serif">{plan.name}</h3>
                      <p className="text-xs text-stone-400 line-clamp-2">{plan.description}</p>
                      <div className="flex items-baseline gap-1.5 pt-2">
                        <span className="text-3xl font-extrabold text-white">
                          {isFree ? 'FREE' : `$${plan.price || plan.price_usdt || 0}`}
                        </span>
                        <span className="text-xs text-stone-400">/{durationText}</span>
                      </div>
                    </div>

                    {/* Features List */}
                    <div className="space-y-2.5 mb-7 flex-1 border-t border-stone-800/80 pt-4">
                      {plan.features.map((feat, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs text-stone-300">
                          <Check
                            className={`w-4 h-4 shrink-0 mt-0.5 ${
                              isVip && !isFree ? 'text-amber-400' : isFree ? 'text-stone-500' : 'text-purple-400'
                            }`}
                          />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>

                    {/* Action Button */}
                    <div>
                      {isFree ? (
                        <button
                          type="button"
                          onClick={() => handleSubscribeFree(plan)}
                          disabled={isProcessing}
                          className="w-full py-3.5 rounded-2xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition flex items-center justify-center gap-2"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-400" />
                              <span>Activate Free Trial</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleCheckoutPaid(plan)}
                          disabled={isProcessing}
                          className={`w-full py-3.5 rounded-2xl text-xs font-bold shadow-lg transition flex items-center justify-center gap-2 active:scale-95 ${
                            isVip
                              ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 shadow-amber-900/30'
                              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/30'
                          }`}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Coins className="w-4 h-4" />
                              <span>
                                Pay ${plan.price || plan.price_usdt || 0} USD (Crypto)
                              </span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Security & NOWPayments Guarantee Footer */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-400">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Multi-Crypto Checkout via NOWPayments (Pay with USDT, BTC, ETH, TON, LTC & 150+ coins)</span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-400">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            <span>Automatic Instant VIP Activation on Blockchain Confirmation</span>
          </div>
        </div>

      </div>
    </div>
  );
};
