import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Flame, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  Clock, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  RefreshCw, 
  Sparkles, 
  Eye, 
  EyeOff, 
  TrendingUp,
  Tag
} from 'lucide-react';
import { BoostPackage } from '../../types';
import { api } from '../../services/api';

interface AdminBoostPackagesTabProps {
  onSuccessMessage: (msg: string) => void;
}

export const AdminBoostPackagesTab: React.FC<AdminBoostPackagesTabProps> = ({
  onSuccessMessage,
}) => {
  const [packages, setPackages] = useState<BoostPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [multiplier, setMultiplier] = useState('10x');
  const [price, setPrice] = useState<number>(4.99);
  const [currency, setCurrency] = useState('USDT');
  const [description, setDescription] = useState('');
  const [isPopular, setIsPopular] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(1);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPackages = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.getAdminBoostPackages();
      const sorted = (res.packages || []).sort((a, b) => a.display_order - b.display_order);
      setPackages(sorted);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load boost packages');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
  }, []);

  const openCreateModal = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setDurationMinutes(30);
    setMultiplier('10x');
    setPrice(4.99);
    setCurrency('USDT');
    setDescription('Puts your profile right in the spotlight for instant matches');
    setIsPopular(false);
    setIsActive(true);
    setDisplayOrder(packages.length + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: BoostPackage) => {
    setIsEditing(true);
    setEditingId(pkg.id);
    setName(pkg.name);
    setDurationMinutes(pkg.duration_minutes);
    setMultiplier(pkg.multiplier || '10x');
    setPrice(pkg.price);
    setCurrency(pkg.currency || 'USDT');
    setDescription(pkg.description || '');
    setIsPopular(pkg.is_popular);
    setIsActive(pkg.is_active);
    setDisplayOrder(pkg.display_order);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Package name is required.');
      return;
    }
    if (durationMinutes <= 0) {
      setErrorMessage('Duration must be greater than 0 minutes.');
      return;
    }
    if (price < 0) {
      setErrorMessage('Price cannot be negative.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (isEditing && editingId) {
        await api.adminUpdateBoostPackage(editingId, {
          name: name.trim(),
          duration_minutes: durationMinutes,
          multiplier: multiplier.trim() || '10x',
          price,
          currency: currency.trim() || 'USDT',
          description: description.trim(),
          is_popular: isPopular,
          is_active: isActive,
          display_order: displayOrder,
        });
        onSuccessMessage(`Boost package "${name}" updated successfully!`);
      } else {
        await api.adminCreateBoostPackage({
          name: name.trim(),
          duration_minutes: durationMinutes,
          multiplier: multiplier.trim() || '10x',
          price,
          currency: currency.trim() || 'USDT',
          description: description.trim(),
          is_popular: isPopular,
          is_active: isActive,
          display_order: displayOrder,
        });
        onSuccessMessage(`New boost package "${name}" created successfully!`);
      }
      setIsModalOpen(false);
      loadPackages();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save boost package');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (pkg: BoostPackage) => {
    try {
      await api.adminUpdateBoostPackage(pkg.id, { is_active: !pkg.is_active });
      onSuccessMessage(`Package "${pkg.name}" is now ${!pkg.is_active ? 'Active' : 'Inactive'}.`);
      loadPackages();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update package status');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.adminDeleteBoostPackage(id);
      setDeletingId(null);
      onSuccessMessage('Boost package deleted successfully.');
      loadPackages();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete boost package');
    }
  };

  const formatDurationText = (mins: number) => {
    if (mins < 60) return `${mins} Minutes`;
    if (mins === 60) return '1 Hour';
    if (mins < 1440) return `${Math.round(mins / 60)} Hours`;
    if (mins === 1440) return '24 Hours (1 Day)';
    const days = Math.round(mins / 1440);
    return `${days} Days`;
  };

  return (
    <div className="space-y-6">
      {/* Header & Metric Bar */}
      <div className="p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4 fill-amber-400" />
            <span>Monetization & Spotlight Management</span>
          </div>
          <h2 className="text-xl font-bold text-white font-serif">Profile Boost Packages & Pricing</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Configure boost durations, multiplier badges, and crypto pricing. Users pay to unlock immediate top-of-deck spotlight placement.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadPackages}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white border border-stone-700 transition"
            title="Refresh packages"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:opacity-95 text-stone-950 font-bold text-xs shadow-lg shadow-amber-950/30 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Boost Package</span>
          </button>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-amber-400" /> Total Packages
          </div>
          <div className="text-xl font-extrabold text-white mt-1">{packages.length}</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Active Packages
          </div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">
            {packages.filter((p) => p.is_active).length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-sky-400" /> Average Price
          </div>
          <div className="text-xl font-extrabold text-white mt-1">
            ${packages.length > 0 ? (packages.reduce((acc, p) => acc + Number(p.price), 0) / packages.length).toFixed(2) : '0.00'}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" /> Max Multiplier
          </div>
          <div className="text-xl font-extrabold text-amber-400 mt-1">
            {packages.length > 0 ? packages.map(p => p.multiplier).filter(Boolean).pop() || '25x' : '10x'}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Packages Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-stone-400 flex flex-col items-center justify-center gap-2 bg-stone-900 rounded-3xl border border-stone-800">
          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
          <span className="text-xs">Loading boost packages...</span>
        </div>
      ) : packages.length === 0 ? (
        <div className="p-12 text-center text-stone-400 bg-stone-900 rounded-3xl border border-stone-800 space-y-3">
          <Zap className="w-8 h-8 text-stone-600 mx-auto" />
          <p className="text-sm font-semibold text-stone-300">No Boost Packages Created Yet</p>
          <p className="text-xs text-stone-500">Create your first boost package to monetize profile views.</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400 transition"
          >
            Create First Package
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className={`rounded-3xl border transition p-5 flex flex-col justify-between relative overflow-hidden ${
                pkg.is_active
                  ? 'bg-stone-900 border-stone-800 hover:border-amber-500/50'
                  : 'bg-stone-950 border-stone-900 opacity-60'
              }`}
            >
              {/* Popular ribbon */}
              {pkg.is_popular && (
                <div className="absolute top-0 right-0 bg-gradient-to-l from-rose-600 to-amber-500 text-white text-[10px] font-extrabold uppercase px-3 py-1 rounded-bl-xl shadow-md">
                  Most Popular
                </div>
              )}

              {/* Card Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Zap className="w-4 h-4 fill-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm leading-tight">{pkg.name}</h3>
                    <div className="text-[11px] text-stone-400 font-mono flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-stone-500" />
                      <span>{formatDurationText(pkg.duration_minutes)}</span>
                    </div>
                  </div>
                </div>

                {/* Price Display */}
                <div className="mt-3 mb-3 p-3 rounded-2xl bg-stone-950 border border-stone-800 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-amber-400 font-mono">${Number(pkg.price).toFixed(2)}</span>
                    <span className="text-[10px] text-stone-500 ml-1.5 font-bold uppercase">{pkg.currency || 'USDT'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
                    {pkg.multiplier || '10x'} Views
                  </span>
                </div>

                <p className="text-xs text-stone-400 leading-relaxed min-h-[36px]">
                  {pkg.description || 'Elevates user ranking to the top of discovery feeds.'}
                </p>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-4 pt-3 border-t border-stone-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleToggleActive(pkg)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
                    pkg.is_active
                      ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800 hover:bg-emerald-900/60'
                      : 'bg-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                  title={pkg.is_active ? 'Click to deactivate' : 'Click to activate'}
                >
                  {pkg.is_active ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>{pkg.is_active ? 'Active' : 'Inactive'}</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(pkg)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
                    title="Edit package"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingId(pkg.id)}
                    className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-rose-950/40 transition"
                    title="Delete package"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Inline Delete Confirmation */}
              {deletingId === pkg.id && (
                <div className="absolute inset-0 bg-stone-950/95 backdrop-blur-sm p-4 flex flex-col items-center justify-center text-center z-10 animate-in fade-in">
                  <Trash2 className="w-6 h-6 text-rose-500 mb-2" />
                  <p className="text-xs font-bold text-white mb-1">Delete "{pkg.name}"?</p>
                  <p className="text-[10px] text-stone-400 mb-3">This action cannot be undone.</p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeletingId(null)}
                      className="px-3 py-1.5 rounded-xl bg-stone-800 text-stone-300 text-xs font-bold hover:bg-stone-700 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(pkg.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition"
                    >
                      Confirm Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-serif">
                  {isEditing ? 'Edit Boost Package' : 'Create Boost Package'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300">Package Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 1 Hour Super Boost"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Duration and Multiplier */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-400 font-mono">
                    = {formatDurationText(durationMinutes)}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-rose-400" /> Multiplier Badge
                  </label>
                  <input
                    type="text"
                    required
                    value={multiplier}
                    onChange={(e) => setMultiplier(e.target.value)}
                    placeholder="e.g. 15x"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-400">Displayed to users</span>
                </div>
              </div>

              {/* Price and Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-sky-400" /> Price (USD/Crypto)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="USDT">USDT (Tether)</option>
                    <option value="USD">USD ($)</option>
                    <option value="BTC">BTC (Bitcoin)</option>
                    <option value="ETH">ETH (Ethereum)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-stone-300">Description / Recommendation</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Ideal for prime evening browsing peak"
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Display Order & Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(Number(e.target.value))}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isPopular"
                    checked={isPopular}
                    onChange={(e) => setIsPopular(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-700 text-amber-500 focus:ring-amber-500 bg-stone-950"
                  />
                  <label htmlFor="isPopular" className="text-xs text-stone-300 cursor-pointer select-none">
                    Most Popular
                  </label>
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded border-stone-700 text-emerald-500 focus:ring-emerald-500 bg-stone-950"
                  />
                  <label htmlFor="isActive" className="text-xs text-stone-300 cursor-pointer select-none">
                    Active in Store
                  </label>
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-4 border-t border-stone-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-95 text-stone-950 font-bold text-xs shadow flex items-center gap-1.5 transition cursor-pointer"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{isEditing ? 'Save Changes' : 'Create Package'}</span>
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
