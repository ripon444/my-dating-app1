import React, { useState, useEffect } from 'react';
import { 
  Crown, 
  X, 
  Check, 
  Calendar, 
  Clock, 
  ShieldAlert, 
  Loader2, 
  History, 
  Coins, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { User, PaymentTransaction } from '../../types';
import { api } from '../../services/api';

interface AdminUserSubscriptionModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedUser: User) => void;
}

export const AdminUserSubscriptionModal: React.FC<AdminUserSubscriptionModalProps> = ({
  user,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'manage' | 'history'>('manage');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyData, setHistoryData] = useState<{
    subscriptions: any[];
    payments: PaymentTransaction[];
  }>({ subscriptions: [], payments: [] });

  // Action state
  const [actionType, setActionType] = useState<'activate' | 'extend' | 'cancel'>('activate');
  const [tier, setTier] = useState<'VIP' | 'PREMIUM' | 'FREE'>('VIP');
  const [durationPreset, setDurationPreset] = useState<string>('1_month');
  const [customDays, setCustomDays] = useState<number>(30);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isOpen || !user) return;
    setErrorMessage('');
    setIsLoadingHistory(true);
    api.adminGetUserSubscriptionHistory(user.id)
      .then((res) => {
        setHistoryData({
          subscriptions: res.subscriptions || [],
          payments: res.payments || [],
        });
      })
      .catch((err) => {
        console.warn('Failed to load user sub history:', err);
      })
      .finally(() => {
        setIsLoadingHistory(false);
      });
  }, [isOpen, user]);

  if (!isOpen || !user) return null;

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    let calcDuration = 30;
    let calcUnit = 'days';

    if (durationPreset === '7_days') {
      calcDuration = 7;
      calcUnit = 'days';
    } else if (durationPreset === '1_month') {
      calcDuration = 1;
      calcUnit = 'months';
    } else if (durationPreset === '2_months') {
      calcDuration = 2;
      calcUnit = 'months';
    } else if (durationPreset === '6_months') {
      calcDuration = 6;
      calcUnit = 'months';
    } else if (durationPreset === '1_year') {
      calcDuration = 1;
      calcUnit = 'years';
    } else if (durationPreset === 'custom') {
      calcDuration = customDays;
      calcUnit = 'days';
    }

    try {
      const res = await api.adminManageUserSubscription(user.id, {
        action: actionType,
        tier: actionType === 'cancel' ? 'FREE' : tier,
        duration: calcDuration,
        durationUnit: calcUnit,
      });

      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update user subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isExpired = user.subscriptionExpiresAt ? new Date(user.subscriptionExpiresAt).getTime() < Date.now() : false;
  const formattedExpiry = user.subscriptionExpiresAt
    ? new Date(user.subscriptionExpiresAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Never / Lifetime Free';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-800 shadow-2xl p-6 sm:p-7 space-y-5 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2.5">
            <Crown className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-base font-bold text-white font-serif">Manage User Subscription</h3>
              <p className="text-xs text-stone-400">Account: {user.email || user.id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current User Status Box */}
        <div className="p-3.5 rounded-2xl bg-stone-950 border border-stone-800 space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-stone-400">Current Tier:</span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              user.subscriptionTier === 'VIP'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : user.subscriptionTier === 'PREMIUM'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-stone-800 text-stone-400'
            }`}>
              {user.subscriptionTier || 'FREE'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-stone-400">Expiration Date:</span>
            <span className={`font-mono ${isExpired ? 'text-red-400' : 'text-stone-200'}`}>
              {formattedExpiry} {isExpired ? '(Expired)' : ''}
            </span>
          </div>
        </div>

        {/* Tabs: Manage vs History */}
        <div className="flex items-center gap-2 border-b border-stone-800 pb-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('manage')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              activeSubTab === 'manage' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
            }`}
          >
            Subscription Controls
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('history')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubTab === 'history' ? 'bg-amber-500 text-stone-950' : 'text-stone-400 hover:text-white'
            }`}
          >
            <History className="w-3 h-3" />
            <span>Audit History ({historyData.payments.length})</span>
          </button>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Tab 1: Form controls */}
        {activeSubTab === 'manage' && (
          <form onSubmit={handleActionSubmit} className="space-y-4 text-xs">
            {/* Action Type */}
            <div className="space-y-1.5">
              <label className="font-semibold text-stone-300">Action Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActionType('activate')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    actionType === 'activate'
                      ? 'bg-amber-500 text-stone-950 border-amber-500'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  Activate Tier
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('extend')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    actionType === 'extend'
                      ? 'bg-amber-500 text-stone-950 border-amber-500'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  Extend Period
                </button>
                <button
                  type="button"
                  onClick={() => setActionType('cancel')}
                  className={`py-2 rounded-xl text-xs font-bold border transition ${
                    actionType === 'cancel'
                      ? 'bg-red-600 text-white border-red-500'
                      : 'bg-stone-950 border-stone-800 text-stone-400'
                  }`}
                >
                  Revoke / Cancel
                </button>
              </div>
            </div>

            {actionType !== 'cancel' && (
              <>
                {/* Tier selection */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-300">Privilege Tier</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="VIP">VIP Elite Membership</option>
                    <option value="PREMIUM">PREMIUM Pass</option>
                    <option value="FREE">FREE Member</option>
                  </select>
                </div>

                {/* Duration Presets */}
                <div className="space-y-1.5">
                  <label className="font-semibold text-stone-300">Grant Duration</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '7_days', label: '7 Days' },
                      { id: '1_month', label: '1 Month' },
                      { id: '2_months', label: '2 Months' },
                      { id: '6_months', label: '6 Months' },
                      { id: '1_year', label: '1 Year' },
                      { id: 'custom', label: 'Custom' },
                    ].map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setDurationPreset(d.id)}
                        className={`py-2 rounded-xl text-[11px] font-semibold border transition ${
                          durationPreset === d.id
                            ? 'bg-stone-800 text-amber-400 border-amber-500/50'
                            : 'bg-stone-950 border-stone-800 text-stone-400'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>

                  {durationPreset === 'custom' && (
                    <div className="pt-2">
                      <input
                        type="number"
                        min="1"
                        value={customDays}
                        onChange={(e) => setCustomDays(parseInt(e.target.value) || 1)}
                        placeholder="Number of days"
                        className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  )}
                </div>
              </>
            )}

            {actionType === 'cancel' && (
              <div className="p-3 bg-red-950/40 border border-red-900/60 rounded-xl text-red-300 text-xs">
                Revoking will immediately reset this user to the FREE tier and set their subscription expiration to now.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 hover:bg-stone-700 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold flex items-center gap-1.5 shadow"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Apply Subscription Update</span>
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: History audit */}
        {activeSubTab === 'history' && (
          <div className="space-y-3 text-xs max-h-64 overflow-y-auto">
            {isLoadingHistory ? (
              <div className="py-8 flex justify-center text-stone-400">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              </div>
            ) : historyData.payments.length === 0 ? (
              <div className="py-6 text-center text-stone-500">
                No recorded crypto transactions for this member.
              </div>
            ) : (
              <div className="space-y-2">
                {historyData.payments.map((p) => (
                  <div key={p.id} className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-1">
                    <div className="flex justify-between items-center font-bold text-white">
                      <span>{p.plan_name}</span>
                      <span className="text-emerald-400">{p.amount} {p.currency}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-stone-400">
                      <span>Order: {p.order_id}</span>
                      <span className="uppercase text-amber-400">{p.payment_status}</span>
                    </div>
                    <div className="text-[10px] text-stone-500">
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
