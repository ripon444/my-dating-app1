import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Crown,
  Flame,
  Settings,
  Globe,
  Bell,
  ShieldCheck,
  LogOut,
  ChevronRight,
  Sparkles,
  ExternalLink,
  Edit3,
  Eye,
  EyeOff,
  Clock,
  CreditCard,
  Ban,
  Lock,
  KeyRound,
  Smartphone,
  Check,
  AlertCircle,
  CheckCircle2,
  X,
  MessageSquare,
  Heart,
  PhoneCall,
  Mail,
  Calendar,
  MapPin,
  RefreshCw,
  Loader2,
  Shield,
  HelpCircle
} from 'lucide-react';
import { User, Profile, PaymentTransaction } from '../types';
import { useTranslation } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n/translations';
import { api } from '../services/api';
import { safeStorage } from '../utils/storage';

interface ProfileSettingsHubProps {
  currentUser: User | null;
  currentProfile: Profile | null;
  onViewProfile: () => void;
  onEditProfile: () => void;
  onOpenSubscription: () => void;
  onOpenBoost: () => void;
  onLogout: () => void;
  onUpdateProfile?: (data: Partial<Profile>) => Promise<any> | void;
  initialSection?: string | null;
}

export const ProfileSettingsHub: React.FC<ProfileSettingsHubProps> = ({
  currentUser,
  currentProfile,
  onViewProfile,
  onEditProfile,
  onOpenSubscription,
  onOpenBoost,
  onLogout,
  onUpdateProfile,
  initialSection = null,
}) => {
  const { t, currentLanguage, setLanguage } = useTranslation();

  // Dialog & Expandable states
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);

  // Subscription & Payment states
  const [subStatus, setSubStatus] = useState<{
    hasActiveSubscription: boolean;
    currentPlan: string;
    planExpiresAt?: string | null;
    paymentHistory: PaymentTransaction[];
  }>({
    hasActiveSubscription: currentUser?.subscriptionTier === 'VIP',
    currentPlan: currentUser?.subscriptionTier || 'FREE',
    paymentHistory: [],
  });
  const [isLoadingSub, setIsLoadingSub] = useState(false);

  // Boost states
  const [isBoostActive, setIsBoostActive] = useState(Boolean(currentProfile?.is_boosted));
  const [boostExpiresAt, setBoostExpiresAt] = useState<string | null>(currentProfile?.boost_expires_at || null);
  const [boostMinutesRemaining, setBoostMinutesRemaining] = useState<number>(0);

  // Blocked Users State
  const [blockedUsers, setBlockedUsers] = useState<Array<{
    id: string;
    blockedId: string;
    reason: string;
    createdAt: string;
    name: string;
    photo: string;
    city: string;
  }>>([]);
  const [isLoadingBlocked, setIsLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  // Sessions State
  const [sessions, setSessions] = useState<Array<{ id: string; device: string; lastActive: string; isCurrent: boolean }>>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  // Password Reset Trigger State
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Notification Toggles (saved locally and to state)
  const [notifPreferences, setNotifPreferences] = useState(() => {
    try {
      const saved = safeStorage.getItem('lm_notif_prefs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      messages: true,
      matches: true,
      followers: true,
      calls: true,
      promotions: false,
    };
  });

  // Privacy Toggles
  const [privacySettings, setPrivacySettings] = useState(() => ({
    isVisible: currentProfile?.is_visible !== false,
    showAge: currentProfile?.show_age !== false,
    showApproxLocation: currentProfile?.show_approx_location !== false,
    allowCalls: currentProfile?.allow_calls !== false,
    allowMessages: currentProfile?.allow_messages !== false,
  }));

  // Calculate Boost Countdown
  useEffect(() => {
    const checkBoostTimer = () => {
      if (!boostExpiresAt) {
        setIsBoostActive(false);
        setBoostMinutesRemaining(0);
        return;
      }
      const diff = new Date(boostExpiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setIsBoostActive(false);
        setBoostMinutesRemaining(0);
      } else {
        setIsBoostActive(true);
        setBoostMinutesRemaining(Math.ceil(diff / 60000));
      }
    };

    checkBoostTimer();
    const interval = setInterval(checkBoostTimer, 30000);
    return () => clearInterval(interval);
  }, [boostExpiresAt]);

  // Scroll/open requested Settings Hub section (wired to existing slide-out menu).
  // Accepts optional "#nonce" suffix so repeated menu selections re-trigger.
  useEffect(() => {
    const raw = initialSection || '';
    const section = raw.includes('#') ? raw.split('#')[0] : raw;
    if (!section) return;

    if (section === 'blocked_users' || section === 'blocked') {
      setActiveSection('blocked_users');
      loadBlockedUsers();
    } else if (section === 'sessions' || section === 'security') {
      loadSessions();
    }

    const sectionId =
      section === 'blocked_users' || section === 'blocked' || section === 'privacy'
        ? 'section-settings'
        : section === 'sessions'
        ? 'section-security'
        : section === 'search-settings'
        ? 'section-settings'
        : `section-${section}`;

    const timer = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [initialSection]);

  // Load Subscription & Payment info
  const loadSubscriptionData = async () => {
    setIsLoadingSub(true);
    try {
      const res = await api.getMySubscriptionStatus();
      if (res) {
        setSubStatus({
          hasActiveSubscription: Boolean(res.activeSubscription || res.tier === 'VIP' || res.tier === 'PREMIUM'),
          currentPlan: res.tier || currentUser?.subscriptionTier || 'FREE',
          planExpiresAt: res.expiresAt,
          paymentHistory: res.paymentHistory || [],
        });
      }
    } catch (err) {
      console.warn('Could not load subscription details:', err);
    } finally {
      setIsLoadingSub(false);
    }
  };

  // Load Blocked Users
  const loadBlockedUsers = async () => {
    setIsLoadingBlocked(true);
    try {
      const res = await api.getBlockedUsers();
      if (res && res.blockedUsers) {
        setBlockedUsers(res.blockedUsers);
      }
    } catch (err) {
      console.warn('Could not load blocked users:', err);
    } finally {
      setIsLoadingBlocked(false);
    }
  };

  // Load Sessions
  const loadSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const res = await api.getSessions();
      if (res && res.sessions) {
        setSessions(res.sessions);
      }
    } catch (err) {
      console.warn('Could not load sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  // Unblock user handler
  const handleUnblock = async (blockedId: string) => {
    setUnblockingId(blockedId);
    try {
      await api.unblockUser(blockedId);
      setBlockedUsers((prev) => prev.filter((b) => b.blockedId !== blockedId && b.id !== blockedId));
    } catch (err: any) {
      alert(err.message || 'Failed to unblock user');
    } finally {
      setUnblockingId(null);
    }
  };

  // Change Password Handler
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await api.changePassword(currentPassword, newPassword);
      setPasswordSuccess(res.message || 'Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Request Password Reset
  const handleRequestPasswordReset = async () => {
    if (!currentUser?.email) return;
    setIsSendingReset(true);
    setResetMessage('');
    try {
      await api.forgotPassword(currentUser.email);
      setResetMessage(`Reset verification code sent to ${currentUser.email}.`);
    } catch (err: any) {
      setResetMessage(err.message || 'Could not send reset code. Please try again.');
    } finally {
      setIsSendingReset(false);
    }
  };

  // Toggle Notification Prefs
  const toggleNotifPref = (key: keyof typeof notifPreferences) => {
    const updated = { ...notifPreferences, [key]: !notifPreferences[key] };
    setNotifPreferences(updated);
    safeStorage.setItem('lm_notif_prefs', JSON.stringify(updated));
  };

  // Toggle Privacy setting
  const togglePrivacySetting = async (key: keyof typeof privacySettings) => {
    const nextVal = !privacySettings[key];
    const updated = { ...privacySettings, [key]: nextVal };
    setPrivacySettings(updated);

    if (onUpdateProfile) {
      const payload: Partial<Profile> = {};
      if (key === 'isVisible') payload.is_visible = nextVal;
      if (key === 'showAge') payload.show_age = nextVal;
      if (key === 'showApproxLocation') payload.show_approx_location = nextVal;
      if (key === 'allowCalls') payload.allow_calls = nextVal;
      if (key === 'allowMessages') payload.allow_messages = nextVal;
      onUpdateProfile(payload);
    }
  };

  const primaryPhoto = currentProfile?.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
  const userName = currentProfile?.name || currentUser?.email?.split('@')[0] || 'My Profile';
  const userAge = currentProfile?.age;
  const userCity = currentProfile?.city || currentProfile?.country;
  const isVip = currentUser?.subscriptionTier === 'VIP' || subStatus.hasActiveSubscription;

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-28 space-y-4 sm:space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. PROFILE SECTION: Facebook-Style Profile Banner & Quick Actions */}
      {/* ========================================================================= */}
      <section 
        id="profile-hub-header"
        className="w-full bg-gradient-to-b from-stone-900 via-stone-900/95 to-stone-900/90 border border-stone-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl relative overflow-hidden"
      >
        {/* Subtle Ambient Glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-600/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />

        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 relative z-10">
          {/* Avatar with Status Ring */}
          <div className="relative shrink-0 group">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-3 border-rose-500/80 shadow-lg shadow-rose-950/40 p-0.5 bg-stone-950">
              <img
                src={primaryPhoto}
                alt={userName}
                className="w-full h-full object-cover rounded-full group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
              />
            </div>
            {isVip && (
              <div 
                title="VIP Member" 
                className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-gradient-to-tr from-amber-500 to-rose-500 text-stone-950 flex items-center justify-center shadow-md border-2 border-stone-900"
              >
                <Crown className="w-4 h-4 fill-current text-white" />
              </div>
            )}
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-stone-900 shadow" />
          </div>

          {/* User Name & Details */}
          <div className="flex-1 text-center sm:text-left space-y-1 sm:space-y-1.5">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                {userName}
                {userAge ? <span className="text-stone-400 font-normal">, {userAge}</span> : null}
              </h1>
              {isVip && (
                <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500/20 to-rose-500/20 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-1">
                  <Crown className="w-3 h-3" /> VIP
                </span>
              )}
            </div>

            <p className="text-xs sm:text-sm text-stone-400 flex items-center justify-center sm:justify-start gap-1.5">
              <Mail className="w-3.5 h-3.5 text-stone-500" />
              <span>{currentUser?.email || 'Logged In'}</span>
              {userCity && (
                <>
                  <span className="text-stone-600">•</span>
                  <MapPin className="w-3.5 h-3.5 text-rose-500/80" />
                  <span>{userCity}</span>
                </>
              )}
            </p>

            {/* Facebook-style Action Buttons */}
            <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <button
                id="btn-hub-view-profile"
                onClick={onViewProfile}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-750 active:bg-stone-700 text-stone-100 border border-stone-700 font-medium text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <UserIcon className="w-4 h-4 text-rose-400" />
                <span>{t('viewProfile') || 'View Profile'}</span>
              </button>

              <button
                id="btn-hub-edit-profile"
                onClick={onEditProfile}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-medium text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-rose-900/30"
              >
                <Edit3 className="w-4 h-4" />
                <span>{t('editProfile') || 'Edit Profile'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. PROMINENT VIP SUBSCRIPTION CARD */}
      {/* ========================================================================= */}
      <section 
        id="section-subscription"
        className="w-full bg-gradient-to-r from-stone-900 via-amber-950/20 to-stone-900 border border-amber-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
                <Crown className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                VIP Subscription
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  isVip ? 'bg-amber-500 text-stone-950' : 'bg-stone-800 text-stone-300 border border-stone-700'
                }`}>
                  {isVip ? 'ACTIVE VIP' : 'FREE TIER'}
                </span>
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-stone-300">
              {isVip
                ? `Your VIP pass unlocks unlimited swipes, direct video calls, rewinds, and 5x profile visibility.`
                : `Upgrade to Lovemeetly VIP to unlock unlimited swipes, private calls, and see who liked you.`}
            </p>

            {subStatus.planExpiresAt && (
              <p className="text-xs text-amber-400/90 flex items-center gap-1.5 pt-0.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Expires: {new Date(subStatus.planExpiresAt).toLocaleDateString()}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              id="btn-hub-upgrade-subscription"
              onClick={onOpenSubscription}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:brightness-110 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-amber-950/50 cursor-pointer transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isVip ? 'Manage VIP Plan' : 'Upgrade to VIP'}</span>
            </button>

            <button
              onClick={() => {
                const next = activeSection === 'payment_history' ? null : 'payment_history';
                setActiveSection(next);
                if (next === 'payment_history') loadSubscriptionData();
              }}
              className="px-3 py-2.5 rounded-xl bg-stone-800/90 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5 text-stone-400" />
              <span>Payment History</span>
            </button>
          </div>
        </div>

        {/* Expandable Payment History */}
        {activeSection === 'payment_history' && (
          <div className="mt-4 pt-4 border-t border-stone-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
                Recent Invoices & Transactions
              </h3>
              <button 
                onClick={loadSubscriptionData} 
                disabled={isLoadingSub}
                className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingSub ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {isLoadingSub ? (
              <div className="py-4 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                <span>Loading transaction logs...</span>
              </div>
            ) : subStatus.paymentHistory.length === 0 ? (
              <div className="py-4 px-3 rounded-xl bg-stone-950/60 border border-stone-800 text-center text-xs text-stone-400">
                No previous payment records found for this account.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {subStatus.paymentHistory.map((tx) => {
                  const statusText = (tx.paymentStatus || tx.payment_status || 'completed').toString().toUpperCase();
                  const isSuccess = statusText === 'COMPLETED' || statusText === 'FINISHED' || statusText === 'CONFIRMED';
                  return (
                    <div 
                      key={tx.id} 
                      className="p-3 rounded-xl bg-stone-950/70 border border-stone-800/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-white">{tx.plan_name || tx.planName || 'VIP Subscription'}</p>
                        <p className="text-stone-400 text-[11px]">
                          {tx.created_at || tx.createdAt ? new Date(tx.created_at || tx.createdAt!).toLocaleString() : 'Recent'} • {tx.cryptoCurrency || tx.currency || 'USD'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-400">${(tx.amount || 0).toFixed(2)}</p>
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          isSuccess ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                        }`}>
                          {statusText}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 3. PROMINENT PROFILE BOOST CARD */}
      {/* ========================================================================= */}
      <section 
        id="section-boost"
        className="w-full bg-gradient-to-r from-stone-900 via-rose-950/20 to-stone-900 border border-rose-500/30 rounded-2xl p-4 sm:p-5 shadow-lg relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center">
                <Flame className="w-4 h-4 fill-current" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Profile Boost
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  isBoostActive ? 'bg-rose-500 text-white animate-pulse' : 'bg-stone-800 text-stone-400 border border-stone-700'
                }`}>
                  {isBoostActive ? '🚀 10X BOOST ACTIVE' : 'IDLE'}
                </span>
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-stone-300">
              {isBoostActive
                ? `Your profile is boosted to the top of matches! Duration remaining: ~${boostMinutesRemaining} minutes.`
                : `Skyrocket your profile to top positions. Get up to 10x more likes, chats, and calls instantly.`}
            </p>

            {isBoostActive && boostExpiresAt && (
              <p className="text-xs text-rose-400 flex items-center gap-1.5 pt-0.5 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Ends at: {new Date(boostExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button
              id="btn-hub-buy-boost"
              onClick={onOpenBoost}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 active:scale-95 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-md shadow-rose-950/50 cursor-pointer transition-all"
            >
              <Flame className="w-4 h-4 fill-current" />
              <span>{isBoostActive ? 'Extend Boost' : 'Boost My Profile'}</span>
            </button>

            <button
              onClick={() => setActiveSection(activeSection === 'boost_packages' ? null : 'boost_packages')}
              className="px-3 py-2.5 rounded-xl bg-stone-800/90 hover:bg-stone-800 text-stone-200 border border-stone-700 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <span>Available Boosts</span>
            </button>
          </div>
        </div>

        {/* Available Boosts Preview Accordion */}
        {activeSection === 'boost_packages' && (
          <div className="mt-4 pt-4 border-t border-stone-800/80 space-y-3">
            <h3 className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
              Available Boost Tiers
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { name: 'Mini Boost', time: '30 min', mult: '5x', price: '$1.99' },
                { name: 'Super Boost', time: '1 hour', mult: '10x', price: '$3.49', popular: true },
                { name: 'Mega Boost', time: '3 hours', mult: '25x', price: '$7.99' },
                { name: 'Day Spotlight', time: '24 hours', mult: '50x', price: '$14.99' },
              ].map((b) => (
                <div 
                  key={b.name}
                  onClick={onOpenBoost}
                  className={`p-3 rounded-xl bg-stone-950/80 border text-center cursor-pointer transition-transform hover:scale-[1.02] ${
                    b.popular ? 'border-rose-500/60 ring-1 ring-rose-500/30' : 'border-stone-800'
                  }`}
                >
                  <p className="text-xs font-bold text-white">{b.name}</p>
                  <p className="text-[11px] text-rose-400 font-semibold">{b.mult} Views ({b.time})</p>
                  <p className="text-xs font-bold text-stone-200 mt-1">{b.price}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* 4. SETTINGS & PRIVACY (Facebook-Style Grouped Menu List) */}
      {/* ========================================================================= */}
      <section 
        id="section-settings"
        className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Settings & Privacy</h2>
            <p className="text-xs text-stone-400">Manage your discovery filters, account visibility, and privacy.</p>
          </div>
        </div>

        {/* Privacy Options Group */}
        <div className="divide-y divide-stone-800/80 rounded-xl bg-stone-950/60 border border-stone-800/90 overflow-hidden">
          {/* Incognito / Visibility */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-stone-200 flex items-center gap-1.5">
                {privacySettings.isVisible ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-stone-500" />}
                Profile Discovery Visibility
              </p>
              <p className="text-[11px] sm:text-xs text-stone-400">
                {privacySettings.isVisible ? 'Your profile is visible to other singles nearby.' : 'Hidden from feed. You will not appear in new match discovery.'}
              </p>
            </div>
            <button
              onClick={() => togglePrivacySetting('isVisible')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacySettings.isVisible ? 'bg-rose-600' : 'bg-stone-800'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                privacySettings.isVisible ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Show Age */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-stone-200">Show Age on Profile</p>
              <p className="text-[11px] sm:text-xs text-stone-400">Display your age badge publicly on cards and profile timeline.</p>
            </div>
            <button
              onClick={() => togglePrivacySetting('showAge')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacySettings.showAge ? 'bg-rose-600' : 'bg-stone-800'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                privacySettings.showAge ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Show Distance / Location */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-stone-200">Show Approximate Location</p>
              <p className="text-[11px] sm:text-xs text-stone-400">Show approximate city or distance to nearby potential matches.</p>
            </div>
            <button
              onClick={() => togglePrivacySetting('showApproxLocation')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacySettings.showApproxLocation ? 'bg-rose-600' : 'bg-stone-800'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                privacySettings.showApproxLocation ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>

          {/* Direct Voice & Video Calls */}
          <div className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs sm:text-sm font-semibold text-stone-200">Allow Incoming Calls</p>
              <p className="text-[11px] sm:text-xs text-stone-400">Allow matched partners to start 1-on-1 audio and video calls.</p>
            </div>
            <button
              onClick={() => togglePrivacySetting('allowCalls')}
              className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                privacySettings.allowCalls ? 'bg-rose-600' : 'bg-stone-800'
              }`}
            >
              <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                privacySettings.allowCalls ? 'translate-x-7' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>

        {/* Blocked Users Section */}
        <div className="pt-2">
          <button
            onClick={() => {
              const next = activeSection === 'blocked_users' ? null : 'blocked_users';
              setActiveSection(next);
              if (next === 'blocked_users') loadBlockedUsers();
            }}
            className="w-full p-3.5 sm:p-4 rounded-xl bg-stone-950/60 hover:bg-stone-950/90 border border-stone-800 flex items-center justify-between cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Ban className="w-4 h-4 text-rose-400" />
              <div className="text-left">
                <p className="text-xs sm:text-sm font-semibold text-stone-200">Blocked Users</p>
                <p className="text-[11px] text-stone-400">Manage people you have blocked from contacting you.</p>
              </div>
            </div>
            <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${activeSection === 'blocked_users' ? 'rotate-90' : ''}`} />
          </button>

          {activeSection === 'blocked_users' && (
            <div className="mt-3 p-4 rounded-xl bg-stone-950/90 border border-stone-800 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-stone-300 uppercase tracking-wider">Blocked Accounts</h4>
                <button 
                  onClick={loadBlockedUsers}
                  disabled={isLoadingBlocked}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingBlocked ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {isLoadingBlocked ? (
                <div className="py-4 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                  <span>Loading blocked accounts...</span>
                </div>
              ) : blockedUsers.length === 0 ? (
                <p className="text-xs text-stone-500 py-3 text-center">
                  You have not blocked any users yet.
                </p>
              ) : (
                <div className="divide-y divide-stone-800">
                  {blockedUsers.map((b) => (
                    <div key={b.id || b.blockedId} className="py-2.5 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-stone-800 border border-stone-700">
                          {b.photo ? (
                            <img src={b.photo} alt={b.name} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon className="w-5 h-5 text-stone-500 m-2" />
                          )}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-white">{b.name}</p>
                          <p className="text-[10px] text-stone-400">Reason: {b.reason || 'User block'}</p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleUnblock(b.blockedId)}
                        disabled={unblockingId === b.blockedId}
                        className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-rose-400 border border-stone-700 text-xs font-medium cursor-pointer transition-colors"
                      >
                        {unblockingId === b.blockedId ? 'Unblocking...' : 'Unblock'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 5. LANGUAGE SECTION (English, Bengali & Global Languages) */}
      {/* ========================================================================= */}
      <section 
        id="section-language"
        className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">App Language</h2>
              <p className="text-xs text-stone-400">
                Active language: <span className="text-rose-400 font-semibold">{SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage)?.nativeName || 'English'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
          {SUPPORTED_LANGUAGES.slice(0, 16).map((lang) => {
            const isSelected = currentLanguage === lang.code;
            return (
              <button
                key={lang.code}
                onClick={() => setLanguage(lang.code)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-rose-500/15 border-rose-500 text-white shadow-sm ring-1 ring-rose-500/40'
                    : 'bg-stone-950/60 border-stone-800/90 text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">{lang.flag}</span>
                    <span className="text-xs font-semibold truncate">{lang.nativeName}</span>
                  </div>
                  <span className="text-[10px] text-stone-400 truncate block">{lang.name}</span>
                </div>
                {isSelected && <Check className="w-4 h-4 text-rose-500 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. NOTIFICATIONS PREFERENCES */}
      {/* ========================================================================= */}
      <section 
        id="section-notifications"
        className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Notification Preferences</h2>
            <p className="text-xs text-stone-400">Choose what alerts you receive in real-time.</p>
          </div>
        </div>

        <div className="divide-y divide-stone-800/80 rounded-xl bg-stone-950/60 border border-stone-800/90 overflow-hidden">
          {[
            { key: 'messages' as const, label: 'Messages & Chat Alerts', desc: 'Notify when you receive private text, voice, or image messages', icon: MessageSquare },
            { key: 'matches' as const, label: 'New Matches & Mutual Likes', desc: 'Instant celebration alert when someone likes you back', icon: Heart },
            { key: 'followers' as const, label: 'Followers & Visits', desc: 'Alerts when other members follow your public profile timeline', icon: UserIcon },
            { key: 'calls' as const, label: 'Audio & Video Call Rings', desc: 'Ringtone alerts when a match initiates an encrypted call', icon: PhoneCall },
            { key: 'promotions' as const, label: 'Promotions & Special VIP Deals', desc: 'Special discounts on Boosts, SuperLikes, and VIP passes', icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon;
            const isEnabled = notifPreferences[item.key];
            return (
              <div key={item.key} className="p-3.5 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <Icon className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-stone-200">{item.label}</p>
                    <p className="text-[11px] text-stone-400">{item.desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleNotifPref(item.key)}
                  className={`w-12 h-6 rounded-full transition-colors relative shrink-0 cursor-pointer ${
                    isEnabled ? 'bg-rose-600' : 'bg-stone-800'
                  }`}
                >
                  <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                    isEnabled ? 'translate-x-7' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. SECURITY & ACCOUNT */}
      {/* ========================================================================= */}
      <section 
        id="section-security"
        className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-stone-800 text-stone-300 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Security & Account</h2>
            <p className="text-xs text-stone-400">Password management and active device sessions.</p>
          </div>
        </div>

        {/* Change Password Form */}
        <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-3">
          <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            Change Account Password
          </h3>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Current Password (optional if none set)</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white focus:outline-none focus:border-rose-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-2 text-stone-500 hover:text-stone-300"
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-400 block mb-1">New Password (min 6 chars)</label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password"
                    className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white focus:outline-none focus:border-rose-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2 text-stone-500 hover:text-stone-300"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full px-3 py-2 rounded-xl bg-stone-900 border border-stone-700 text-xs text-white focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-xs text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {passwordError}
              </p>
            )}

            {passwordSuccess && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {passwordSuccess}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="submit"
                disabled={isChangingPassword || !newPassword}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-750 text-stone-100 border border-stone-700 text-xs font-semibold disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
              >
                {isChangingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5 text-rose-400" />}
                <span>Update Password</span>
              </button>

              <button
                type="button"
                onClick={handleRequestPasswordReset}
                disabled={isSendingReset}
                className="text-xs text-rose-400 hover:text-rose-300 underline cursor-pointer"
              >
                {isSendingReset ? 'Sending reset code...' : 'Forgot password? Send reset code'}
              </button>
            </div>

            {resetMessage && (
              <p className="text-xs text-amber-300 bg-amber-950/40 p-2 rounded-lg border border-amber-800/40">
                {resetMessage}
              </p>
            )}
          </form>
        </div>

        {/* Active Sessions & Login Management */}
        <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              Active Login & Device Sessions
            </h3>
            <button
              onClick={loadSessions}
              disabled={isLoadingSessions}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingSessions ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingSessions ? (
            <div className="py-2 text-center text-xs text-stone-400 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
              <span>Fetching sessions...</span>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-between py-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-stone-200 font-medium">This Android / Web Device</span>
              </div>
              <span className="text-emerald-400 font-semibold text-[11px]">Active Now</span>
            </div>
          ) : (
            <div className="divide-y divide-stone-800/80">
              {sessions.map((s) => (
                <div key={s.id} className="py-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.isCurrent ? 'bg-emerald-500' : 'bg-stone-500'}`} />
                    <div>
                      <p className="text-stone-200 font-medium">{s.device}</p>
                      <p className="text-[10px] text-stone-500">
                        {s.isCurrent ? 'Active Now' : `Last active: ${new Date(s.lastActive).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  {s.isCurrent && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-semibold">
                      Current
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. LOGOUT SECTION (Prominent, Facebook-Style with Confirmation) */}
      {/* ========================================================================= */}
      <section id="section-logout" className="pt-2">
        <button
          id="btn-hub-logout"
          onClick={() => setShowLogoutConfirm(true)}
          className="w-full p-4 rounded-2xl bg-stone-900/90 hover:bg-red-950/30 active:bg-red-950/50 border border-stone-800 hover:border-red-500/40 text-rose-400 hover:text-rose-300 font-semibold text-sm flex items-center justify-center gap-2.5 shadow-lg cursor-pointer transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('logOut') || 'Log Out of Lovemeetly'}</span>
        </button>

        <p className="text-center text-[11px] text-stone-500 mt-3">
          Lovemeetly v2.4 • Unified Dating & Community Network
        </p>
      </section>

      {/* ========================================================================= */}
      {/* LOGOUT CONFIRMATION MODAL */}
      {/* ========================================================================= */}
      {showLogoutConfirm && (
        <div 
          id="logout-confirmation-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in"
        >
          <div className="w-full max-w-sm rounded-3xl bg-stone-900 border border-stone-800 p-6 shadow-2xl space-y-4 text-center relative">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto">
              <LogOut className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Log out of Lovemeetly?</h3>
              <p className="text-xs sm:text-sm text-stone-300 mt-1.5">
                You will be returned to the login screen. You can log back into your account anytime with your credentials.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                id="btn-cancel-logout"
                onClick={() => setShowLogoutConfirm(false)}
                className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 font-medium text-xs sm:text-sm cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button
                id="btn-confirm-logout"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-rose-950 cursor-pointer transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
