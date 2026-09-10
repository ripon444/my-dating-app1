import React, { useState, useRef, useEffect } from 'react';
import { 
  Home,
  Globe, 
  Flame, 
  Sparkles, 
  Shield, 
  Crown, 
  User as UserIcon, 
  SlidersHorizontal, 
  Grid, 
  Layers,
  ChevronDown,
  Check,
  Zap,
  Lock,
  Heart,
  MessageCircle,
  Search,
  Users,
  Bell,
  X,
  UserPlus
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n/translations';
import { User, Profile } from '../types';
import { Logo } from './Logo';
import { soundManager } from '../utils/sound';

interface NavbarProps {
  user: User | null;
  profile: Profile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode: 'swipe' | 'grid';
  setViewMode: (mode: 'swipe' | 'grid') => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  onOpenFilters: () => void;
  onOpenSubscription: () => void;
  onOpenBoost: () => void;
  onOpenProfile: () => void;
  onOpenAuth: () => void;
  onLogout?: () => void;
  onOpenLegal: (tab: string) => void;
  onOpenUserSearch?: () => void;
  notifications?: any[];
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  onSelectNotificationProfile?: (profileIdOrUserId: string) => void;
  onMarkAllNotificationsRead?: () => void;
  onResetHome?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  profile,
  activeTab,
  setActiveTab,
  viewMode,
  setViewMode,
  searchQuery = '',
  setSearchQuery,
  onOpenFilters,
  onOpenSubscription,
  onOpenBoost,
  onOpenProfile,
  onOpenAuth,
  onLogout,
  onOpenLegal,
  onOpenUserSearch,
  notifications = [],
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  onSelectNotificationProfile,
  onMarkAllNotificationsRead,
  onResetHome,
}) => {
  const { currentLanguage, setLanguage, t } = useTranslation();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [langSearch, setLangSearch] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<'all' | 'asia' | 'europe' | 'americas' | 'mideast_africa'>('all');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(event.target as Node)) {
        setLangMenuOpen(false);
      }
      if (userRef.current && !userRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLangObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage);

  const filteredLanguages = SUPPORTED_LANGUAGES.filter((lang) => {
    const matchesRegion = selectedRegion === 'all' || lang.region === selectedRegion;
    const q = langSearch.toLowerCase().trim();
    const matchesSearch =
      !q ||
      lang.name.toLowerCase().includes(q) ||
      lang.nativeName.toLowerCase().includes(q) ||
      lang.code.toLowerCase().includes(q);
    return matchesRegion && matchesSearch;
  });

  return (
    <header className="sticky top-0 z-40 bg-stone-900/90 backdrop-blur-md border-b border-stone-800">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Tagline (Click returns to Home Grid) */}
        <div 
          id="brand-logo-button"
          className="cursor-pointer transition-transform active:scale-95 group select-none shrink-0" 
          onClick={() => {
            setActiveTab('discover');
            setViewMode('grid');
            if (setSearchQuery) setSearchQuery('');
            if (onResetHome) onResetHome();
          }}
          title="Return to Home Feed"
        >
          <Logo size="md" subtitle="Unified Global & Partner Dating" />
        </div>

        {/* Center Quick Navigation (Desktop) with Facebook-style Home button */}
        <nav className="hidden md:flex items-center gap-1 bg-stone-800/60 p-1 rounded-xl border border-stone-700/50">
          <button
            onClick={() => {
              setActiveTab('discover');
              setViewMode('grid');
              if (onResetHome) onResetHome();
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'discover'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow'
                : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
            }`}
            title="Facebook-style Home Feed"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'matches'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow'
                : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
            }`}
          >
            {t('matches')}
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'messages'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow'
                : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
            }`}
          >
            {t('messages')}
          </button>
          <button
            onClick={() => setActiveTab('calls')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'calls'
                ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow'
                : 'text-stone-300 hover:text-white hover:bg-stone-700/50'
            }`}
          >
            {t('calls')}
          </button>
          {user?.role === 'ADMIN' && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-indigo-300 hover:text-white hover:bg-indigo-950/50'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              {t('admin')}
            </button>
          )}
        </nav>

        {/* Right Tools: View Toggle, Search, Filters, Boost, Subscription, Language, Profile */}
        <div className="flex items-center gap-2">
          
          {/* Search Button / Input */}
          {setSearchQuery && (
            <div className="relative flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center bg-stone-800 border border-rose-500/50 rounded-xl px-2.5 py-1 animate-in fade-in slide-in-from-right-3">
                  <Search className="w-3.5 h-3.5 text-rose-400 mr-2 shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Search name, city, country..."
                    autoFocus
                    className="bg-transparent text-stone-100 placeholder-stone-400 text-xs focus:outline-none w-32 sm:w-48"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-stone-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsSearchOpen(false);
                      if (activeTab !== 'discover') setActiveTab('discover');
                    }}
                    className="ml-1 text-stone-400 hover:text-white p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsSearchOpen(true);
                    if (activeTab !== 'discover') setActiveTab('discover');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium transition cursor-pointer"
                  title="Search Profiles"
                >
                  <Search className="w-3.5 h-3.5 text-rose-400" />
                  <span className="hidden sm:inline">Search</span>
                </button>
              )}
            </div>
          )}

          {/* Find Registered Users (Social Search) */}
          {onOpenUserSearch && (
            <button
              id="btn-nav-find-members"
              type="button"
              onClick={onOpenUserSearch}
              className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-stone-200 border border-neutral-700 text-xs font-semibold transition shrink-0"
              title="Find Registered Members"
            >
              <Users className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden md:inline">Find Members</span>
            </button>
          )}

          {/* Mobile Messenger Quick Button (Facebook-style header) */}
          <button
            id="btn-nav-messages-mobile"
            type="button"
            onClick={() => {
              setActiveTab('messages');
              soundManager.unlock();
            }}
            className="md:hidden relative p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition shrink-0 cursor-pointer"
            title="Messages & Chats"
          >
            <MessageCircle className="w-4 h-4 text-stone-300" />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-md shadow-rose-900/50">
                {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
              </span>
            )}
          </button>

          {/* Real-time Notifications Bell */}
          <div className="relative shrink-0" ref={notifRef}>
            <button
              id="btn-nav-notifications"
              onClick={() => {
                setNotifMenuOpen(!notifMenuOpen);
                soundManager.unlock();
              }}
              className="relative p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 transition shrink-0 cursor-pointer"
              title="Notifications & Activity"
            >
              <Bell className="w-4 h-4 text-stone-300" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse shadow-md shadow-rose-900/50">
                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                </span>
              )}
            </button>

            {notifMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-800 py-2.5 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center justify-between">
                  <div className="font-bold text-white text-xs flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-rose-500" />
                    <span>Notifications & Activity</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {unreadNotificationsCount > 0 && onMarkAllNotificationsRead && (
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-neutral-800/60">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-xs text-neutral-400 space-y-2">
                      <Bell className="w-7 h-7 text-neutral-600 mx-auto" />
                      <p className="font-semibold text-neutral-300">All caught up!</p>
                      <p className="text-[11px] text-neutral-400 max-w-xs mx-auto">
                        New followers, likes, matches, and messages will arrive here with live notification sound.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => {
                      const avatarPhoto = notif.data?.followerPhoto || notif.data?.photo;
                      const displayName = notif.data?.followerName || notif.data?.name || notif.title;
                      const timeString = (() => {
                        const rawTime = notif.created_at || (notif as any).createdAt;
                        if (!rawTime) return 'Just now';
                        const d = new Date(rawTime);
                        if (isNaN(d.getTime())) return 'Just now';
                        const diffSec = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
                        if (diffSec < 45) return 'Just now';
                        const diffMin = Math.floor(diffSec / 60);
                        if (diffMin < 60) return `${diffMin}m ago`;
                        const diffHour = Math.floor(diffMin / 60);
                        if (diffHour < 24) return `${diffHour}h ago`;
                        const diffDay = Math.floor(diffHour / 24);
                        if (diffDay === 1) return 'Yesterday';
                        if (diffDay < 7) return `${diffDay}d ago`;
                        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
                      })();

                      return (
                        <div
                          key={notif.id}
                          onClick={() => {
                            setNotifMenuOpen(false);
                            const targetId = notif.data?.followerId || notif.data?.profileId || notif.data?.userId || notif.user_id;
                            if (targetId) {
                              onSelectNotificationProfile?.(targetId);
                            }
                          }}
                          className={`p-3 text-xs hover:bg-neutral-800/80 cursor-pointer transition flex items-start gap-2.5 ${
                            !notif.is_read ? 'bg-rose-950/20' : ''
                          }`}
                        >
                          {/* Avatar or Icon */}
                          <div className="relative shrink-0 mt-0.5">
                            {avatarPhoto ? (
                              <img
                                src={avatarPhoto}
                                alt={displayName}
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-neutral-700"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-rose-400">
                                {notif.type === 'follow' ? (
                                  <UserPlus className="w-4 h-4 text-rose-400" />
                                ) : notif.type === 'like' || notif.type === 'super_like' ? (
                                  <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
                                ) : notif.type === 'match' ? (
                                  <Sparkles className="w-4 h-4 text-amber-400" />
                                ) : (
                                  <Bell className="w-4 h-4 text-rose-400" />
                                )}
                              </div>
                            )}
                            {!notif.is_read && (
                              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-neutral-900 animate-pulse" />
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-bold text-white truncate text-xs">{notif.title}</span>
                              <span className="text-[10px] text-rose-400/90 font-medium shrink-0">
                                {timeString}
                              </span>
                            </div>
                            <p className="text-neutral-300 text-[11px] leading-relaxed line-clamp-2">{notif.message}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Discovery View Switcher (Swipe vs Grid) */}
          {activeTab === 'discover' && (
            <div className="hidden xl:flex items-center bg-stone-800 rounded-lg p-0.5 border border-stone-700 shrink-0">
              <button
                onClick={() => setViewMode('swipe')}
                className={`p-1.5 rounded-md text-xs transition ${
                  viewMode === 'swipe' ? 'bg-stone-700 text-white shadow' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Swipe Card View"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md text-xs transition ${
                  viewMode === 'grid' ? 'bg-stone-700 text-white shadow' : 'text-stone-400 hover:text-stone-200'
                }`}
                title="Browse Grid View"
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Filters Button */}
          {activeTab === 'discover' && (
            <button
              onClick={onOpenFilters}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-medium transition shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">{t('filters')}</span>
            </button>
          )}

          {/* Boost Button */}
          <button
            onClick={onOpenBoost}
            className={`hidden sm:flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-sm shrink-0 ${
              profile?.is_boosted
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
            }`}
            title="Boost Profile for 10x visibility"
          >
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">{profile?.is_boosted ? t('boostActive') : t('boostProfile')}</span>
          </button>

          {/* Subscription Tier Badge / Upgrade */}
          <button
            onClick={onOpenSubscription}
            className={`hidden md:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold transition shrink-0 ${
              user?.subscriptionTier === 'VIP'
                ? 'bg-gradient-to-r from-amber-500 to-amber-700 text-stone-900 font-bold shadow'
                : user?.subscriptionTier === 'PREMIUM'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700'
            }`}
          >
            <Crown className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">
              {user?.subscriptionTier === 'FREE' ? t('upgradePlan') : user?.subscriptionTier}
            </span>
          </button>

          {/* Language Switcher (World Languages) */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => {
                setLangMenuOpen(!langMenuOpen);
                setLangSearch('');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs transition shadow-sm"
              title="Change Language"
            >
              <Globe className="w-3.5 h-3.5 text-rose-400" />
              <span className="text-sm">{currentLangObj?.flag}</span>
              <span className="font-semibold uppercase text-[11px] hidden sm:inline">{currentLangObj?.code}</span>
              <ChevronDown className="w-3 h-3 text-stone-400" />
            </button>

            {langMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-stone-900 rounded-2xl shadow-2xl border border-stone-700 p-2.5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800 px-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-stone-200">
                    <Globe className="w-3.5 h-3.5 text-rose-500" />
                    <span>Global Languages</span>
                  </div>
                  <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                    {SUPPORTED_LANGUAGES.length} Languages
                  </span>
                </div>

                {/* Search Bar */}
                <div className="relative mb-2">
                  <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={langSearch}
                    onChange={(e) => setLangSearch(e.target.value)}
                    placeholder={t('searchLanguage') || 'Search language...'}
                    className="w-full pl-8 pr-7 py-1.5 text-xs bg-stone-800/80 border border-stone-700 rounded-lg text-stone-100 placeholder-stone-400 focus:outline-none focus:border-rose-500 transition"
                    autoFocus
                  />
                  {langSearch && (
                    <button
                      onClick={() => setLangSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Region Filter Chips */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1.5 mb-1.5 scrollbar-none text-[10px]">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'asia', label: 'Asia' },
                    { id: 'europe', label: 'Europe' },
                    { id: 'americas', label: 'Americas' },
                    { id: 'mideast_africa', label: 'ME & Africa' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedRegion(tab.id as any)}
                      className={`px-2 py-0.5 rounded-md font-medium whitespace-nowrap transition ${
                        selectedRegion === tab.id
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Scrollable Language List */}
                <div className="max-h-64 overflow-y-auto space-y-0.5 pr-1 divide-y divide-stone-800/40">
                  {filteredLanguages.length === 0 ? (
                    <div className="text-center py-6 text-xs text-stone-400">
                      No language found for "{langSearch}"
                    </div>
                  ) : (
                    filteredLanguages.map((lang) => {
                      const isSelected = currentLanguage === lang.code;
                      return (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code as SupportedLanguage);
                            setLangMenuOpen(false);
                            setLangSearch('');
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition ${
                            isSelected
                              ? 'bg-rose-600/20 text-rose-200 border border-rose-500/30'
                              : 'text-stone-200 hover:bg-stone-800/80 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-base flex-shrink-0">{lang.flag}</span>
                            <div className="text-left truncate">
                              <div className="font-medium text-stone-100 truncate flex items-center gap-1.5">
                                <span>{lang.name}</span>
                                {lang.dir === 'rtl' && (
                                  <span className="text-[9px] bg-stone-800 text-amber-400/90 px-1 rounded uppercase">RTL</span>
                                )}
                              </div>
                              <div className="text-[10px] text-stone-400 truncate">{lang.nativeName}</div>
                            </div>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-rose-400 flex-shrink-0 ml-2" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar / Menu */}
          <div className="relative shrink-0" ref={userRef}>
            {user ? (
              <button
                id="btn-nav-user-profile"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1 pr-1.5 sm:pr-2.5 rounded-full bg-stone-800/90 hover:bg-stone-700 border border-stone-700 hover:border-rose-500/60 transition shadow-sm shrink-0 cursor-pointer group"
                title={`${profile?.name || user?.email?.split('@')[0] || 'My Profile'} (${user?.subscriptionTier || 'Free'})`}
              >
                <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0 ring-2 ring-rose-500/50">
                  {profile?.photos?.[0] ? (
                    <img
                      src={profile.photos[0]}
                      alt={profile.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-pink-600 flex items-center justify-center text-white font-bold text-xs">
                      {(profile?.name || user?.email || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-stone-900" />
                </div>
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-bold text-stone-100 truncate max-w-[84px] leading-tight">
                    {profile?.name || user?.email?.split('@')[0] || 'My Profile'}
                  </span>
                  <span className="text-[10px] text-rose-400 font-semibold leading-none">
                    {user?.subscriptionTier || 'Member'}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-stone-400 group-hover:text-stone-200 transition shrink-0" />
              </button>
            ) : (
              <button
                id="btn-nav-signin"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-md shadow-rose-900/30 flex items-center gap-1.5 shrink-0 transition cursor-pointer"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}

            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-stone-900 rounded-2xl shadow-2xl border border-stone-700 py-2.5 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-4 py-3 border-b border-stone-800 bg-stone-800/40 rounded-t-xl mb-1">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2 ring-rose-500/50">
                      {profile?.photos?.[0] ? (
                        <img
                          src={profile.photos[0]}
                          alt={profile.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-rose-600 to-pink-600 flex items-center justify-center text-white font-bold text-base">
                          {(profile?.name || user?.email || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-stone-900" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-100 text-sm truncate">
                          {profile?.name || user?.email?.split('@')[0] || 'Member'}
                        </span>
                        <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 text-[9px] font-bold rounded uppercase tracking-wider">
                          {user?.subscriptionTier || 'Free'}
                        </span>
                      </div>
                      <div className="text-xs text-stone-400 truncate">
                        {user?.email || (profile?.username ? `@${profile.username}` : '')}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setUserMenuOpen(false);
                    }}
                    className="mt-3 w-full py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-rose-400" />
                    <span>View Public Profile</span>
                  </button>
                </div>

                <div className="py-1 px-1 space-y-0.5">
                  <button
                    onClick={() => {
                      onOpenProfile();
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-stone-200 hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{t('profile')} & Preferences</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenSubscription();
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-stone-200 hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Subscriptions ({user?.subscriptionTier || 'Free'})</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenBoost();
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-stone-200 hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Boost Profile (10x Views)</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenLegal('disclosure');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-stone-200 hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{t('disclosure')}</span>
                  </button>
                  <button
                    onClick={() => {
                      onOpenLegal('safety');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-stone-200 hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{t('safety')}</span>
                  </button>
                </div>

                <div className="border-t border-stone-800 pt-1.5 mt-1 px-1">
                  <button
                    onClick={() => {
                      if (onLogout) {
                        onLogout();
                      } else {
                        onOpenAuth();
                      }
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs rounded-lg text-rose-400 hover:bg-rose-500/10 font-semibold flex items-center gap-2.5 transition cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{user ? 'Log Out' : 'Sign In / Register'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
