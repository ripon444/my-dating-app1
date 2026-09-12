import React, { useEffect, useMemo, useState } from 'react';
import { 
  Home,
  Flame, 
  Heart, 
  MessageCircle, 
  PhoneCall, 
  User as UserIcon, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  BookOpen,
  Search,
  Bell,
  Compass,
  X,
  Settings,
  Globe,
  Lock,
  Crown,
  Ban,
  Smartphone,
  LogOut,
  SlidersHorizontal
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { User, Profile } from '../types';
import { Logo } from './Logo';

export type ProfileMenuAction =
  | 'search-settings'
  | 'settings'
  | 'language'
  | 'notifications'
  | 'privacy'
  | 'security'
  | 'vip'
  | 'boost'
  | 'blocked'
  | 'sessions'
  | 'logout';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  matchesCount: number;
  unreadMessagesCount: number;
  unreadNotificationsCount?: number;
  user: User | null;
  profile?: Profile | null;
  onOpenLegal: (tab: string) => void;
  setViewMode?: (mode: 'swipe' | 'grid') => void;
  onGoHome?: () => void;
  isProfileMenuOpen?: boolean;
  onOpenProfileMenu?: () => void;
  onCloseProfileMenu?: () => void;
  onProfileMenuAction?: (action: ProfileMenuAction) => void;
  onSelectDiscover?: () => void;
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  isSearchOpen?: boolean;
  isNotificationsOpen?: boolean;
}

const PROFILE_MENU_ITEMS: Array<{
  id: ProfileMenuAction;
  emoji: string;
  label: string;
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
}> = [
  { id: 'search-settings', emoji: '🔍', label: 'Search Settings', keywords: 'search filter discover age distance', icon: SlidersHorizontal },
  { id: 'settings', emoji: '⚙️', label: 'Settings', keywords: 'settings preferences account profile', icon: Settings },
  { id: 'language', emoji: '🌐', label: 'Language', keywords: 'language locale translation english bengali', icon: Globe },
  { id: 'notifications', emoji: '🔔', label: 'Notifications', keywords: 'notifications alerts messages matches', icon: Bell },
  { id: 'privacy', emoji: '🔒', label: 'Privacy', keywords: 'privacy visibility hidden incognito', icon: Lock },
  { id: 'security', emoji: '🛡', label: 'Security', keywords: 'security password account', icon: ShieldCheck },
  { id: 'vip', emoji: '💳', label: 'VIP / Subscription', keywords: 'vip subscription premium plan payment', icon: Crown },
  { id: 'boost', emoji: '🚀', label: 'Boost', keywords: 'boost visibility spotlight', icon: Flame },
  { id: 'blocked', emoji: '🚫', label: 'Blocked Users', keywords: 'blocked users ban unblock', icon: Ban },
  { id: 'sessions', emoji: '📱', label: 'Active Sessions', keywords: 'sessions devices login android', icon: Smartphone },
  { id: 'logout', emoji: '🚪', label: 'Log Out', keywords: 'logout sign out exit', icon: LogOut, danger: true },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  matchesCount,
  unreadMessagesCount,
  unreadNotificationsCount = 0,
  user,
  profile,
  onOpenLegal,
  setViewMode,
  onGoHome,
  isProfileMenuOpen = false,
  onOpenProfileMenu,
  onCloseProfileMenu,
  onProfileMenuAction,
  onSelectDiscover,
  onOpenSearch,
  onOpenNotifications,
  isSearchOpen = false,
  isNotificationsOpen = false,
}) => {
  const { t } = useTranslation();
  const [menuQuery, setMenuQuery] = useState('');

  useEffect(() => {
    setMenuQuery('');
    if (!isProfileMenuOpen) {
      // Guarantee the page is never left locked if the drawer unmounts/closes.
      document.body.style.overflow = '';
      document.documentElement.style.overflowX = '';
      return;
    }

    // Lock underlying page scroll while the fixed overlay drawer is open.
    // Drawer itself keeps its own overflow-y-auto; page never shifts sideways.
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflowX = 'clip';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseProfileMenu?.();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflowX = prevHtmlOverflowX;
    };
    // onCloseProfileMenu is an inline (unstable) callback from App;
    // depending on it would re-lock/unlock the body on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileMenuOpen]);

  const handleNavClick = (id: string) => {
    // Search & Notifications are overlays reusing existing functionality,
    // not separate tabs — keep the underlying activeTab unchanged.
    if (id === 'search') {
      onOpenSearch?.();
      return;
    }
    if (id === 'notifications') {
      onOpenNotifications?.();
      return;
    }
    if (id === 'home' || id === 'discover') {
      // Home and Discover share the existing main discovery page (no blank tabs).
      // Clear transient overlays so the existing feed is visible again.
      onCloseProfileMenu?.();
      if (onSelectDiscover) {
        onSelectDiscover();
      } else {
        setActiveTab('discover');
        if (setViewMode) setViewMode('grid');
        if (onGoHome) onGoHome();
      }
      return;
    }
    if (id === 'matches' || id === 'calls' || id === 'profile' || id === 'messages') {
      onCloseProfileMenu?.();
      setActiveTab(id);
    } else {
      setActiveTab(id);
    }
  };

  const navItems = [
    { id: 'home', label: 'Home', icon: Home, badge: undefined },
    { id: 'matches', label: t('matches'), icon: Heart, badge: matchesCount > 0 ? matchesCount : undefined },
    { id: 'messages', label: t('messages'), icon: MessageCircle, badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined },
    { id: 'calls', label: t('calls'), icon: PhoneCall, badge: undefined },
    { id: 'profile', label: t('profile'), icon: UserIcon, badge: undefined },
  ];

  const mobileNavItems = [
    { id: 'home', label: 'Home', icon: Home, badge: undefined },
    { id: 'search', label: 'Search', icon: Search, badge: undefined },
    { id: 'discover', label: 'Discover', icon: Compass, badge: matchesCount > 0 ? matchesCount : undefined },
    { id: 'messages', label: 'Messages', icon: MessageCircle, badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined },
    { id: 'profile', label: 'Profile', icon: UserIcon, badge: undefined },
  ];

  const filteredMenuItems = useMemo(() => {
    const q = menuQuery.toLowerCase().trim();
    if (!q) return PROFILE_MENU_ITEMS;
    return PROFILE_MENU_ITEMS.filter((item) =>
      item.label.toLowerCase().includes(q) || item.keywords.includes(q)
    );
  }, [menuQuery]);

  const handleMobileNavClick = (id: string) => {
    if (id === 'profile') {
      if (isProfileMenuOpen) {
        onCloseProfileMenu?.();
      } else {
        onOpenProfileMenu?.();
      }
      return;
    }
    // Keep exactly 6 bottom items; open existing overlays instead of blank tabs.
    if (id === 'search') {
      onOpenSearch?.();
      return;
    }
    if (id === 'notifications') {
      onOpenNotifications?.();
      return;
    }
    onCloseProfileMenu?.();
    handleNavClick(id);
  };

  const isMobileItemActive = (id: string) => {
    if (id === 'profile') return isProfileMenuOpen || activeTab === 'profile';
    if (id === 'home' || id === 'discover') return (activeTab === 'home' || activeTab === 'discover') && !isSearchOpen && !isNotificationsOpen;
    if (id === 'search') return isSearchOpen;
    if (id === 'notifications') return isNotificationsOpen;
    if (id === 'messages') return activeTab === 'messages' && !isSearchOpen && !isNotificationsOpen;
    return activeTab === id;
  };

  const renderNavButton = (
    item: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number },
    variant: 'desktop' | 'mobile'
  ) => {
    const Icon = item.icon;
    const isActive = variant === 'mobile' ? isMobileItemActive(item.id) : activeTab === item.id || (item.id === 'home' && activeTab === 'discover');
    const isProfile = item.id === 'profile';
    const userAvatar = profile?.photos?.[0];

    if (variant === 'desktop') {
      return (
        <button
          key={item.id}
          onClick={() => handleNavClick(item.id)}
          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
            isActive
              ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow-md shadow-rose-900/20'
              : 'text-stone-300 hover:bg-stone-800/80 hover:text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            {isProfile && userAvatar ? (
              <div className={`w-6 h-6 rounded-full overflow-hidden shrink-0 border transition ${
                isActive ? 'border-white shadow-sm' : 'border-stone-500'
              }`}>
                <img
                  src={userAvatar}
                  alt={profile?.name || 'Profile'}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            ) : (
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-stone-400'}`} />
            )}
            <span>{item.label}</span>
          </div>
          {item.badge !== undefined && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-rose-500 text-white font-bold animate-pulse">
              {item.badge}
            </span>
          )}
        </button>
      );
    }

    return (
      <button
        key={item.id}
        onClick={() => handleMobileNavClick(item.id)}
        className={`relative flex-1 min-w-0 flex flex-col items-center justify-center py-1 px-0.5 transition-all cursor-pointer select-none ${
          isActive 
            ? 'text-rose-500 font-semibold' 
            : 'text-stone-400 hover:text-stone-200'
        }`}
      >
        {isActive && (
          <span className="absolute -top-1 left-2 right-2 h-0.5 bg-rose-500 rounded-full shadow-[0_1px_6px_rgba(244,63,94,0.7)]" />
        )}

        {isProfile && userAvatar ? (
          <div className={`relative w-6 h-6 rounded-full overflow-hidden border-2 transition-transform ${
            isActive
              ? 'border-rose-500 ring-2 ring-rose-500/40 scale-105 shadow-md shadow-rose-900/40'
              : 'border-stone-600'
          }`}>
            <img
              src={userAvatar}
              alt={profile?.name || 'Profile'}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-stone-900" />
          </div>
        ) : isProfile && user ? (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] transition-transform ${
            isActive
              ? 'bg-rose-500 text-white ring-2 ring-rose-500/40 scale-105'
              : 'bg-stone-800 text-stone-300 border border-stone-700'
          }`}>
            {(profile?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        ) : (
          <div className="relative">
            <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 text-rose-500' : 'text-stone-300'}`} />
            {item.badge !== undefined && (
              <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center shadow-md shadow-rose-950/60 border border-stone-950 animate-pulse">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            )}
          </div>
        )}
        <span className={`text-[9px] mt-0.5 tracking-tight truncate max-w-full px-0.5 ${isActive ? 'text-rose-400 font-semibold' : 'text-stone-400'}`}>
          {item.label}
        </span>
      </button>
    );
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-stone-900 border-r border-stone-800 p-4 min-h-[calc(100vh-4rem)]">
        <div className="space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
            Navigation
          </div>
          {navItems.map((item) => renderNavButton(item, 'desktop'))}
        </div>

        {/* Legal & Compliance Footer in Sidebar */}
        <div className="border-t border-stone-800/80 pt-4 space-y-2 text-xs text-stone-400">
          <div className="px-3 text-[11px] font-semibold uppercase text-stone-500">
            Trust & Safety
          </div>
          <button
            onClick={() => onOpenLegal('disclosure')}
            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition flex items-center gap-2 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('disclosure')}</span>
          </button>
          <button
            onClick={() => onOpenLegal('guidelines')}
            className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('guidelines')}</span>
          </button>
          <div className="px-3 pt-2 text-[10px] text-stone-600">
            © 2026 Lovemeetly Platform. Licensed integrations strictly adhere to partner syndication agreements.
          </div>
        </div>
      </aside>

      {/* Mobile App Bottom Navigation Bar */}
      <nav 
        id="mobile-bottom-navigation"
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 inset-x-0 w-full z-40 bg-stone-950/95 backdrop-blur-xl border-t border-stone-800/80 px-0.5 pt-1 pb-[max(env(safe-area-inset-bottom,0px),8px)] flex items-center justify-around shadow-2xl safe-area-pb"
      >
        {mobileNavItems.map((item) => renderNavButton(item, 'mobile'))}
      </nav>

      {/* Facebook-style Profile Settings & Privacy slide-out (fixed overlay; page never shifts) */}
      <div
        id="profile-settings-slideout"
        className={`fixed inset-0 z-[60] ${isProfileMenuOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!isProfileMenuOpen}
      >
        <button
          type="button"
          aria-label="Close settings menu"
          onClick={onCloseProfileMenu}
          tabIndex={isProfileMenuOpen ? 0 : -1}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            isProfileMenuOpen ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Settings and Privacy"
          aria-hidden={!isProfileMenuOpen}
          className={`fixed top-0 right-0 bottom-0 h-[100dvh] w-[min(22rem,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain bg-stone-950 border-l border-stone-800 shadow-2xl flex flex-col safe-area-pt transition-transform duration-300 ease-out will-change-transform ${
            isProfileMenuOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
          }`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-800">
            <Logo size="sm" subtitle="Settings & Privacy" />
            <button
              type="button"
              onClick={onCloseProfileMenu}
              className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-stone-800">
            <div className="relative">
              <Search className="w-4 h-4 text-rose-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="Search settings..."
                className="w-full bg-stone-900 border border-stone-700 rounded-xl pl-9 pr-8 py-2.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-rose-500"
              />
              {menuQuery && (
                <button
                  type="button"
                  onClick={() => setMenuQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2 pb-[max(env(safe-area-inset-bottom,0px),16px)]">
            {filteredMenuItems.length === 0 ? (
              <p className="text-center text-xs text-stone-500 py-8">No settings match “{menuQuery}”</p>
            ) : (
              filteredMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onProfileMenuAction?.(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition cursor-pointer ${
                      item.danger
                        ? 'text-rose-400 hover:bg-rose-500/10'
                        : 'text-stone-200 hover:bg-stone-900'
                    }`}
                  >
                    <span className="text-lg leading-none w-6 text-center shrink-0">{item.emoji}</span>
                    <span className="flex-1 text-sm font-semibold">{item.label}</span>
                    <Icon className={`w-4 h-4 shrink-0 ${item.danger ? 'text-rose-400' : 'text-stone-500'}`} />
                  </button>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </>
  );
};
