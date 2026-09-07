import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Crown, 
  Coins, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw,
  Sparkles,
  Layers,
  Eye,
  EyeOff
} from 'lucide-react';
import { SubscriptionPlan } from '../../types';
import { api } from '../../services/api';

interface AdminSubscriptionPlansTabProps {
  onSuccessMessage: (msg: string) => void;
}

export const AdminSubscriptionPlansTab: React.FC<AdminSubscriptionPlansTabProps> = ({
  onSuccessMessage,
}) => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<'FREE' | 'PREMIUM' | 'VIP'>('VIP');
  const [priceUsdt, setPriceUsdt] = useState<number>(15);
  const [duration, setDuration] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<'days' | 'months' | 'years'>('months');
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [featuresText, setFeaturesText] = useState('');

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPlans = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.adminGetPlans();
      const sorted = (res.plans || []).sort((a, b) => a.display_order - b.display_order);
      setPlans(sorted);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load subscription plans');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingPlanId(null);
    setName('');
    setDescription('Exclusive VIP membership with full access to global matchmaking and calls');
    setTier('VIP');
    setPriceUsdt(15);
    setDuration(1);
    setDurationUnit('months');
    setIsActive(true);
    setDisplayOrder(plans.length + 1);
    setFeaturesText(
      'Unlimited Likes & Rewinds\nTop-of-Stack Priority Placement\n5 Free Monthly Profile Boosts\nUnlimited AI Message Translations\nHigh-Definition Audio & Video Calling\nVIP Gold Profile Badge'
    );
    setIsModalOpen(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setIsEditing(true);
    setEditingPlanId(plan.id);
    setName(plan.name);
    setDescription(plan.description || '');
    setTier(plan.tier);
    setPriceUsdt(plan.price_usdt);
    setDuration(plan.duration);
    setDurationUnit(plan.duration_unit);
    setIsActive(plan.is_active);
    setDisplayOrder(plan.display_order);
    setFeaturesText(Array.isArray(plan.features) ? plan.features.join('\n') : '');
    setIsModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setErrorMessage('');

    const parsedFeatures = featuresText
      .split('\n')
      .map((f) => f.trim())
      .filter((f) => f.length > 0);

    const planPayload = {
      name: name.trim(),
      description: description.trim(),
      tier,
      price_usdt: Number(priceUsdt) || 0,
      duration: Number(duration) || 1,
      duration_unit: durationUnit,
      is_active: isActive,
      display_order: Number(displayOrder) || 1,
      features: parsedFeatures,
    };

    try {
      if (isEditing && editingPlanId) {
        await api.adminUpdatePlan(editingPlanId, planPayload);
        onSuccessMessage(`Plan "${name}" updated successfully!`);
      } else {
        await api.adminCreatePlan(planPayload);
        onSuccessMessage(`New plan "${name}" created successfully!`);
      }
      setIsModalOpen(false);
      await loadPlans();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save subscription plan');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      await api.adminUpdatePlan(plan.id, { is_active: !plan.is_active });
      onSuccessMessage(`Plan "${plan.name}" is now ${!plan.is_active ? 'Active' : 'Disabled'}`);
      await loadPlans();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update plan status');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await api.adminDeletePlan(planId);
      onSuccessMessage('Plan deleted successfully');
      setDeletingId(null);
      await loadPlans();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete plan');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-serif">Subscription Plans Management</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
              NOWPayments USDT
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Configure subscription offerings, pricing, durations, and VIP privilege sets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadPlans}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 hover:text-white border border-stone-800 text-xs font-semibold flex items-center gap-1.5 transition"
            title="Reload Plans"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-950/40 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Plan</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 bg-red-950/60 border border-red-800 text-red-300 text-xs rounded-2xl flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Plans List */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <span className="text-xs">Loading subscription plans...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.map((plan) => {
            const isVip = plan.tier === 'VIP';
            const isFree = plan.price_usdt === 0;

            return (
              <div
                key={plan.id}
                className={`rounded-3xl p-5 flex flex-col justify-between border transition-all ${
                  !plan.is_active
                    ? 'bg-stone-900/40 border-stone-800/80 opacity-65'
                    : isVip && !isFree
                    ? 'bg-stone-900 border-amber-500/40 shadow-xl'
                    : 'bg-stone-900 border-stone-800 shadow'
                }`}
              >
                {/* Header */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isVip
                          ? 'bg-amber-500 text-stone-950'
                          : plan.tier === 'PREMIUM'
                          ? 'bg-purple-600 text-white'
                          : 'bg-stone-800 text-stone-300'
                      }`}>
                        {plan.tier}
                      </span>
                      <span className="text-[10px] text-stone-500 font-mono">Order: #{plan.display_order}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleActive(plan)}
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold transition ${
                        plan.is_active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-red-500/20 text-red-300 border border-red-500/40'
                      }`}
                      title="Click to toggle status"
                    >
                      {plan.is_active ? 'ACTIVE' : 'DISABLED'}
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-white font-serif">{plan.name}</h3>
                  <p className="text-xs text-stone-400 mt-1 line-clamp-2">{plan.description}</p>

                  <div className="flex items-baseline gap-1.5 mt-3 pt-3 border-t border-stone-800">
                    <span className="text-2xl font-black text-white">
                      {isFree ? 'FREE' : `${plan.price_usdt} USDT`}
                    </span>
                    <span className="text-xs text-stone-400">
                      / {plan.duration} {plan.duration_unit}
                    </span>
                  </div>

                  {/* Features List */}
                  <div className="mt-4 space-y-1.5 text-xs text-stone-300 max-h-40 overflow-y-auto">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-tight">{feat}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-4 mt-5 border-t border-stone-800">
                  <button
                    type="button"
                    onClick={() => openEditModal(plan)}
                    className="flex-1 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-sky-400" />
                    <span>Edit Plan</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingId(plan.id)}
                    className="p-2 rounded-xl bg-stone-800 hover:bg-red-950/60 text-stone-400 hover:text-red-400 transition"
                    title="Delete Plan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 w-full max-w-sm rounded-2xl border border-red-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <h3 className="text-base font-bold text-white">Delete Subscription Plan?</h3>
            </div>
            <p className="text-xs text-stone-300">
              Are you sure you want to delete this subscription plan? Existing subscribed users will retain their active periods.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 text-stone-300 text-xs font-semibold hover:bg-stone-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePlan(deletingId)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-800 shadow-2xl p-6 sm:p-7 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div className="flex items-center gap-2.5">
                <Crown className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white font-serif">
                  {isEditing ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="space-y-4">
              {/* Plan Name */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-300">Plan Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., VIP 1 Month, VIP 2 Months"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-300">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short tagline or summary"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Tier & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-300">Privilege Tier</label>
                  <select
                    value={tier}
                    onChange={(e) => setTier(e.target.value as any)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="VIP">VIP</option>
                    <option value="PREMIUM">PREMIUM</option>
                    <option value="FREE">FREE</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-300">Price in USDT *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceUsdt}
                    onChange={(e) => setPriceUsdt(parseFloat(e.target.value) || 0)}
                    placeholder="15"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              {/* Duration & Duration Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-300">Duration *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value) || 1)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-300">Duration Unit</label>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as any)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="days">Days</option>
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                </div>
              </div>

              {/* Display Order & Active Checkbox */}
              <div className="grid grid-cols-2 gap-3 items-center">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-stone-300">Display Order</label>
                  <input
                    type="number"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div className="pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-stone-300 select-none">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="w-4 h-4 rounded border-stone-700 text-amber-500 focus:ring-amber-500 bg-stone-950"
                    />
                    <span>Plan is Active / Visible</span>
                  </label>
                </div>
              </div>

              {/* Features (One per line) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-stone-300 flex items-center justify-between">
                  <span>Included Features (one per line)</span>
                  <span className="text-[10px] text-stone-400 font-normal">Press Enter for new bullet</span>
                </label>
                <textarea
                  rows={5}
                  value={featuresText}
                  onChange={(e) => setFeaturesText(e.target.value)}
                  placeholder="Unlimited Likes & Rewinds&#10;Top-of-Stack Placement&#10;Audio & Video Calling"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 font-mono leading-relaxed"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-950/40 transition"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Plan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{isEditing ? 'Update Plan' : 'Save & Publish Plan'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
