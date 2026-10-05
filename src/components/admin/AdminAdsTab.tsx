import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Edit3, 
  Eye, 
  Power, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Layers, 
  Smartphone, 
  Monitor, 
  Sparkles, 
  X, 
  Loader2,
  RefreshCw,
  ShoppingBag,
  Code,
  ShieldCheck,
  Info
} from 'lucide-react';
import { 
  Advertisement, 
  AdNetwork, 
  AdType, 
  AdPlacement, 
  AdDeviceTarget, 
  AdStatus 
} from '../../types';
import { api } from '../../services/api';

const NETWORK_OPTIONS: AdNetwork[] = [
  'AliExpress',
  'Google',
  'Other Affiliate Network',
  'Custom'
];

const AD_TYPE_OPTIONS: { value: AdType; label: string; desc: string }[] = [
  { value: 'affiliate_url', label: 'Affiliate URL', desc: 'Direct safe referral or product link' },
  { value: 'html', label: 'HTML', desc: 'Standard banner HTML snippet or image embed' },
  { value: 'javascript', label: 'JavaScript', desc: 'Official ad network tags & dynamic script widgets' },
  { value: 'banner', label: 'Banner/Embed', desc: 'Rich media, iframe or responsive banner embed' },
  { value: 'custom', label: 'Custom/Other', desc: 'Custom partner embed code' }
];

const PLACEMENT_OPTIONS: { value: AdPlacement; label: string; desc: string }[] = [
  { value: 'top_banner', label: 'Top Banner', desc: 'Prominent header banner below navigation' },
  { value: 'home', label: 'Home / Discover', desc: 'Primary discover and browsing feed' },
  { value: 'before_profiles', label: 'Before Profile List', desc: 'Above the discover profiles grid' },
  { value: 'in_feed', label: 'In Feed', desc: 'Embedded between cards in discover grid' },
  { value: 'after_profiles', label: 'After Profile List', desc: 'Below the discover profiles grid' },
  { value: 'profile', label: 'Profile', desc: 'User profile pages and settings hub' },
  { value: 'messages', label: 'Messages', desc: 'Messenger and conversation list' },
  { value: 'footer', label: 'Footer', desc: 'Bottom of pages above footer links' },
  { value: 'mobile_only', label: 'Mobile Only', desc: 'Displayed only on smartphones & Capacitor app' },
  { value: 'desktop_only', label: 'Desktop Only', desc: 'Displayed only on tablet and desktop screens' }
];

const DEVICE_TARGET_OPTIONS: { value: AdDeviceTarget; label: string }[] = [
  { value: 'all', label: 'All Devices (Mobile + Desktop)' },
  { value: 'mobile', label: 'Mobile Only' },
  { value: 'desktop', label: 'Desktop Only' }
];

export const AdminAdsTab: React.FC = () => {
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [networkFilter, setNetworkFilter] = useState<string>('all');
  const [placementFilter, setPlacementFilter] = useState<string>('all');

  // Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAd, setEditingAd] = useState<Advertisement | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formNetwork, setFormNetwork] = useState<AdNetwork>('AliExpress');
  const [formAdType, setFormAdType] = useState<AdType>('affiliate_url');
  const [formCodeOrUrl, setFormCodeOrUrl] = useState('');
  const [formPlacement, setFormPlacement] = useState<AdPlacement>('home');
  const [formDeviceTarget, setFormDeviceTarget] = useState<AdDeviceTarget>('all');
  const [formStatus, setFormStatus] = useState<AdStatus>('active');
  const [formPriority, setFormPriority] = useState<number>(1);
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formError, setFormError] = useState('');

  // Delete Confirmation Modal
  const [adToDelete, setAdToDelete] = useState<Advertisement | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Preview Modal
  const [adToPreview, setAdToPreview] = useState<Advertisement | null>(null);

  // Load Ads
  const fetchAds = async () => {
    try {
      setIsLoading(true);
      setErrorMsg('');
      const res = await api.getAdminAds({
        search: searchQuery,
        status: statusFilter,
        network: networkFilter,
        placement: placementFilter
      });
      if (res.success && Array.isArray(res.ads)) {
        setAds(res.ads);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load advertisements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAds();
  }, [statusFilter, networkFilter, placementFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchAds();
  };

  // Open Create Form
  const handleOpenCreate = () => {
    setEditingAd(null);
    setFormName('');
    setFormNetwork('AliExpress');
    setFormAdType('affiliate_url');
    setFormCodeOrUrl('');
    setFormPlacement('home');
    setFormDeviceTarget('all');
    setFormStatus('active');
    setFormPriority(1);
    setFormStartDate('');
    setFormEndDate('');
    setFormError('');
    setIsFormOpen(true);
  };

  // Open Edit Form
  const handleOpenEdit = (ad: Advertisement) => {
    setEditingAd(ad);
    setFormName(ad.name);
    setFormNetwork(ad.network);
    setFormAdType(ad.adType);
    setFormCodeOrUrl(ad.codeOrUrl);
    setFormPlacement(ad.placement);
    setFormDeviceTarget(ad.deviceTarget);
    setFormStatus(ad.status);
    setFormPriority(ad.priority);
    setFormStartDate(ad.startDate ? ad.startDate.split('T')[0] : '');
    setFormEndDate(ad.endDate ? ad.endDate.split('T')[0] : '');
    setFormError('');
    setIsFormOpen(true);
  };

  // Save Create or Edit
  const handleSaveAd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Ad Name is required');
      return;
    }
    if (!formCodeOrUrl.trim()) {
      setFormError('Ad Code or URL is required');
      return;
    }

    if (formStartDate && formEndDate) {
      if (new Date(formStartDate) > new Date(formEndDate)) {
        setFormError('End Date cannot be earlier than Start Date');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const payload: Partial<Advertisement> = {
        name: formName.trim(),
        network: formNetwork,
        adType: formAdType,
        codeOrUrl: formCodeOrUrl.trim(),
        placement: formPlacement,
        deviceTarget: formDeviceTarget,
        status: formStatus,
        priority: Number(formPriority) || 1,
        startDate: formStartDate ? new Date(formStartDate).toISOString() : null,
        endDate: formEndDate ? new Date(formEndDate).toISOString() : null
      };

      if (editingAd) {
        await api.adminUpdateAd(editingAd.id, payload);
        setSuccessMsg(`Advertisement "${formName}" updated successfully`);
      } else {
        await api.adminCreateAd(payload);
        setSuccessMsg(`Advertisement "${formName}" created and published`);
      }

      setIsFormOpen(false);
      fetchAds();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save advertisement');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Status
  const handleToggleStatus = async (ad: Advertisement) => {
    try {
      const nextStatus = ad.status === 'active' ? 'inactive' : 'active';
      await api.adminToggleAdStatus(ad.id, nextStatus);
      setSuccessMsg(`Advertisement "${ad.name}" marked as ${nextStatus}`);
      setAds(prev => prev.map(a => a.id === ad.id ? { ...a, status: nextStatus } : a));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update ad status');
    }
  };

  // Confirm Delete
  const handleDeleteAd = async () => {
    if (!adToDelete) return;
    try {
      setIsDeleting(true);
      await api.adminDeleteAd(adToDelete.id);
      setSuccessMsg(`Advertisement "${adToDelete.name}" deleted successfully`);
      setAds(prev => prev.filter(a => a.id !== adToDelete.id));
      setAdToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete advertisement');
    } finally {
      setIsDeleting(false);
    }
  };

  const activeAdsCount = ads.filter(a => a.status === 'active').length;
  const inactiveAdsCount = ads.filter(a => a.status === 'inactive').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Banner / KPIs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-stone-900/70 p-4 sm:p-6 rounded-3xl border border-stone-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white font-serif tracking-wide">
              Ads & Affiliate Manager
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
              Monetization
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-1">
            Publish and manage verified affiliate ads from AliExpress, Google, and partner networks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchAds}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white border border-stone-700 text-xs font-semibold transition flex items-center gap-1.5"
            title="Refresh ads list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-pink-600 to-indigo-600 hover:opacity-95 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-rose-950/40 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Ad</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-stone-900/60 p-4 rounded-2xl border border-stone-800 space-y-1">
          <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Total Campaigns</p>
          <p className="text-2xl font-bold text-white font-serif">{ads.length}</p>
        </div>
        <div className="bg-stone-900/60 p-4 rounded-2xl border border-stone-800 space-y-1">
          <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">Active Placements</p>
          <p className="text-2xl font-bold text-emerald-300 font-serif">{activeAdsCount}</p>
        </div>
        <div className="bg-stone-900/60 p-4 rounded-2xl border border-stone-800 space-y-1">
          <p className="text-[11px] font-medium text-stone-400 uppercase tracking-wider">Inactive Ads</p>
          <p className="text-2xl font-bold text-stone-400 font-serif">{inactiveAdsCount}</p>
        </div>
        <div className="bg-stone-900/60 p-4 rounded-2xl border border-stone-800 space-y-1">
          <p className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider">Security Sandbox</p>
          <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-semibold pt-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Isolated Iframe</span>
          </div>
        </div>
      </div>

      {/* Feedback Notifications */}
      {successMsg && (
        <div className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-800 text-emerald-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-2xl bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-red-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="bg-stone-900/80 p-4 rounded-2xl border border-stone-800 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ad campaign name, network, or URL..."
              className="w-full bg-stone-950 border border-stone-700/80 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-rose-500 transition"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {/* Network Filter */}
            <select
              value={networkFilter}
              onChange={(e) => setNetworkFilter(e.target.value)}
              className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Networks</option>
              {NETWORK_OPTIONS.map((net) => (
                <option key={net} value={net}>{net}</option>
              ))}
            </select>

            {/* Placement Filter */}
            <select
              value={placementFilter}
              onChange={(e) => setPlacementFilter(e.target.value)}
              className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-rose-500"
            >
              <option value="all">All Placements</option>
              {PLACEMENT_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>

            <button
              type="submit"
              className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition"
            >
              Filter
            </button>
          </div>
        </form>
      </div>

      {/* Ads Table / List */}
      <div className="bg-stone-900 rounded-2xl border border-stone-800 overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
            <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
            <p className="text-xs">Loading advertising campaigns...</p>
          </div>
        ) : ads.length === 0 ? (
          <div className="py-16 text-center space-y-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-stone-800/80 text-stone-400 flex items-center justify-center mx-auto">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-white font-serif">No Advertisements Found</h3>
            <p className="text-xs text-stone-400 max-w-sm mx-auto">
              {searchQuery || statusFilter !== 'all' || networkFilter !== 'all' || placementFilter !== 'all'
                ? 'No campaigns matched your search filters. Try clearing or expanding your criteria.'
                : 'Click "Add New Ad" to configure your first AliExpress or affiliate network ad code.'}
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create First Ad</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-800 bg-stone-950/60 text-stone-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">Ad Campaign</th>
                  <th className="py-3 px-4">Network & Type</th>
                  <th className="py-3 px-4">Placement & Target</th>
                  <th className="py-3 px-4 text-center">Priority</th>
                  <th className="py-3 px-4">Schedule Dates</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/70">
                {ads.map((ad) => {
                  const isActive = ad.status === 'active';
                  const placementLabel = PLACEMENT_OPTIONS.find(p => p.value === ad.placement)?.label || ad.placement;
                  return (
                    <tr key={ad.id} className="hover:bg-stone-850/50 transition">
                      {/* Name & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white text-xs max-w-[200px] truncate" title={ad.name}>
                          {ad.name}
                        </div>
                        <div className="text-[10px] text-stone-500 font-mono">
                          ID: {ad.id}
                        </div>
                      </td>

                      {/* Network & Ad Type */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {ad.network}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-stone-800 text-stone-300 font-mono">
                            {ad.adType.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      {/* Placement & Target */}
                      <td className="py-3.5 px-4">
                        <div className="font-medium text-stone-200">
                          {placementLabel}
                        </div>
                        <div className="text-[10px] text-stone-400 flex items-center gap-1">
                          {ad.deviceTarget === 'mobile' ? (
                            <><Smartphone className="w-3 h-3 text-sky-400" /> Mobile Only</>
                          ) : ad.deviceTarget === 'desktop' ? (
                            <><Monitor className="w-3 h-3 text-amber-400" /> Desktop Only</>
                          ) : (
                            <><Layers className="w-3 h-3 text-stone-400" /> All Devices</>
                          )}
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="px-2 py-1 rounded-lg bg-stone-800 font-mono font-bold text-stone-300 text-xs">
                          #{ad.priority}
                        </span>
                      </td>

                      {/* Schedule */}
                      <td className="py-3.5 px-4 text-stone-400 text-[11px]">
                        {ad.startDate || ad.endDate ? (
                          <div className="space-y-0.5">
                            {ad.startDate && <div>From: {new Date(ad.startDate).toLocaleDateString()}</div>}
                            {ad.endDate && <div>To: {new Date(ad.endDate).toLocaleDateString()}</div>}
                          </div>
                        ) : (
                          <span className="text-stone-500 italic">Always Active</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400 border-stone-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Preview Button */}
                          <button
                            type="button"
                            onClick={() => setAdToPreview(ad)}
                            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition"
                            title="Preview ad in isolated sandbox"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Toggle Active Status */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(ad)}
                            className={`p-1.5 rounded-lg transition ${
                              isActive
                                ? 'bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-white'
                                : 'bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-white'
                            }`}
                            title={isActive ? 'Deactivate ad' : 'Activate ad'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(ad)}
                            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition"
                            title="Edit campaign"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setAdToDelete(ad)}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white transition"
                            title="Delete campaign"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: ADD / EDIT AD CAMPAIGN FORM                      */}
      {/* ========================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-2xl p-5 sm:p-6 space-y-5 my-8 shadow-2xl animate-in zoom-in-95 duration-200">
            
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div>
                <h3 className="text-base font-bold text-white font-serif">
                  {editingAd ? 'Edit Advertisement' : 'Add New Advertisement'}
                </h3>
                <p className="text-[11px] text-stone-400">
                  Configure network details, target placement, and paste official affiliate code or URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 rounded-xl bg-stone-800 text-stone-400 hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-red-950/70 border border-red-800 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAd} className="space-y-4">
              
              {/* Row 1: Name & Network */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Ad Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. AliExpress Fashion Campaign"
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Ad Network
                  </label>
                  <select
                    value={formNetwork}
                    onChange={(e) => setFormNetwork(e.target.value as AdNetwork)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {NETWORK_OPTIONS.map((net) => (
                      <option key={net} value={net}>{net}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Ad Type & Placement */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Ad Type
                  </label>
                  <select
                    value={formAdType}
                    onChange={(e) => setFormAdType(e.target.value as AdType)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {AD_TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label} ({t.desc})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Placement
                  </label>
                  <select
                    value={formPlacement}
                    onChange={(e) => setFormPlacement(e.target.value as AdPlacement)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {PLACEMENT_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Device Target, Priority & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Device Targeting
                  </label>
                  <select
                    value={formDeviceTarget}
                    onChange={(e) => setFormDeviceTarget(e.target.value as AdDeviceTarget)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    {DEVICE_TARGET_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Priority (1 = Highest)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={formPriority}
                    onChange={(e) => setFormPriority(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as AdStatus)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Draft)</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Start Date & End Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" /> Start Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-stone-400" /> End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              {/* Row 5: Ad Code / URL Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-rose-400" />
                    Ad Code / URL <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-stone-400 font-mono">
                    {formAdType === 'affiliate_url' ? 'Paste https://... affiliate link' : 'Paste official HTML/Script snippet'}
                  </span>
                </div>
                <textarea
                  rows={5}
                  required
                  value={formCodeOrUrl}
                  onChange={(e) => setFormCodeOrUrl(e.target.value)}
                  placeholder={
                    formAdType === 'affiliate_url'
                      ? 'https://s.click.aliexpress.com/e/_DkExample'
                      : formAdType === 'javascript'
                      ? '<script async src="https://example-ad-network.com/tag.js"></script>\n<ins class="adsbynetwork" data-ad-client="..."></ins>'
                      : '<a href="https://example.com/affiliate" target="_blank"><img src="https://example.com/banner.jpg" alt="Deal" /></a>'
                  }
                  className="w-full bg-stone-950 border border-stone-700 rounded-xl p-3 text-xs text-white font-mono placeholder-stone-600 focus:outline-none focus:border-rose-500"
                />
                <p className="text-[10px] text-stone-500 flex items-center gap-1">
                  <Info className="w-3 h-3 text-stone-400 shrink-0" />
                  Code is executed inside a sterile sandboxed iframe to keep authentication tokens and user state secure.
                </p>
              </div>

              {/* Live Preview Box */}
              {formCodeOrUrl.trim() && (
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" /> Live Sandbox Preview
                  </label>
                  <div className="p-3 rounded-2xl bg-stone-950 border border-stone-800 overflow-hidden">
                    {formAdType === 'affiliate_url' ? (
                      <div className="flex items-center justify-between gap-3 p-2 bg-stone-900 rounded-xl border border-stone-800">
                        <div className="flex items-center gap-2">
                          <ShoppingBag className="w-4 h-4 text-rose-400" />
                          <span className="text-xs font-semibold text-white truncate">{formName || 'Campaign Name'}</span>
                        </div>
                        <span className="px-3 py-1 rounded-lg bg-rose-600 text-white text-[11px] font-bold">
                          Visit Offer
                        </span>
                      </div>
                    ) : (
                      <iframe
                        srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:4px;color:#e7e5e4;font-family:sans-serif;font-size:12px;text-align:center;}img{max-width:100%;height:auto;}</style></head><body>${formCodeOrUrl}</body></html>`}
                        title="Sandbox Preview"
                        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
                        className="w-full min-h-[90px] border-0 bg-transparent"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{editingAd ? 'Save Changes' : 'Create Campaign'}</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: STANDALONE PREVIEW MODAL                         */}
      {/* ========================================================= */}
      {adToPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white font-serif">
                  Ad Preview: {adToPreview.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAdToPreview(null)}
                className="p-1 rounded-lg bg-stone-800 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-stone-400 pb-1">
                <span>Placement: <strong className="text-stone-200">{adToPreview.placement}</strong></span>
                <span>Network: <strong className="text-indigo-300">{adToPreview.network}</strong></span>
              </div>

              <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-center justify-center min-h-[140px]">
                {adToPreview.adType === 'affiliate_url' ? (
                  <div className="w-full flex items-center justify-between gap-3 p-3 bg-stone-900/90 rounded-xl border border-stone-800">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">{adToPreview.name}</div>
                        <div className="text-[10px] text-stone-400">{adToPreview.network} Partner Deal</div>
                      </div>
                    </div>
                    <a
                      href={adToPreview.codeOrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold flex items-center gap-1"
                    >
                      <span>Visit</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ) : (
                  <iframe
                    srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:8px;color:#e7e5e4;font-family:sans-serif;font-size:12px;text-align:center;}img{max-width:100%;height:auto;}</style></head><body>${adToPreview.codeOrUrl}</body></html>`}
                    title="Ad Preview"
                    sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
                    className="w-full min-h-[100px] border-0 bg-transparent"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setAdToPreview(null)}
                className="px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: DELETE CONFIRMATION MODAL                        */}
      {/* ========================================================= */}
      {adToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl w-full max-w-md p-5 sm:p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0 border border-rose-500/20">
                <Trash2 className="w-5 h-5 text-rose-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-serif">Delete Advertisement</h3>
                <p className="text-[11px] text-stone-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-300">
              Are you sure you want to permanently delete <strong className="text-white font-semibold">"{adToDelete.name}"</strong>?
              It will immediately stop appearing on all selected placements.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setAdToDelete(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteAd}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete Ad'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
