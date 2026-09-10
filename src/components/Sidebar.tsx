import React from 'react';
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
  BookOpen
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { User, Profile } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  matchesCount: number;
  unreadMessagesCount: number;
  user: User | null;
  profile?: Profile | null;
  onOpenLegal: (tab: string) => void;
  setViewMode?: (mode: 'swipe' | 'grid') => void;
  onGoHome?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  matchesCount,
  unreadMessagesCount,
  user,
  profile,
  onOpenLegal,
  setViewMode,
  onGoHome,
}) => {
  const { t } = useTranslation();

  const handleNavClick = (id: string) => {
    if (id === 'discover') {
      setActiveTab('discover');
      if (setViewMode) setViewMode('grid');
      if (onGoHome) onGoHome();
    } else {
      setActiveTab(id);
    }
  };

  const navItems = [
    { id: 'discover', label: 'Home', icon: Home, badge: undefined },
    { id: 'matches', label: t('matches'), icon: Heart, badge: matchesCount > 0 ? matchesCount : undefined },
    { id: 'messages', label: t('messages'), icon: MessageCircle, badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined },
    { id: 'calls', label: t('calls'), icon: PhoneCall, badge: undefined },
    { id: 'profile', label: t('profile'), icon: UserIcon, badge: undefined },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-stone-900 border-r border-stone-800 p-4 min-h-[calc(100vh-4rem)]">
        <div className="space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-stone-500 uppercase">
            Navigation
          </div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const isProfile = item.id === 'profile';
            const userAvatar = profile?.photos?.[0];

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
          })}
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

      {/* Facebook-style Mobile App Bottom Navigation Bar */}
      <nav 
        id="mobile-bottom-navigation"
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-xl border-t border-stone-800/80 px-1 py-1 flex items-center justify-around shadow-2xl safe-area-pb"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isProfile = item.id === 'profile';
          const userAvatar = profile?.photos?.[0];

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 transition-all cursor-pointer select-none ${
                isActive 
                  ? 'text-rose-500 font-semibold' 
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {/* Facebook-style Active Top Indicator Bar */}
              {isActive && (
                <span className="absolute -top-1 left-3 right-3 h-0.5 bg-rose-500 rounded-full shadow-[0_1px_6px_rgba(244,63,94,0.7)]" />
              )}

              {isProfile && userAvatar ? (
                <div className={`relative w-7 h-7 rounded-full overflow-hidden border-2 transition-transform ${
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
                <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition-transform ${
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
              <span className={`text-[10px] mt-0.5 tracking-tight truncate max-w-[60px] ${isActive ? 'text-rose-400 font-semibold' : 'text-stone-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
