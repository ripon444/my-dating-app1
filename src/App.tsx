import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { 
  Flame, 
  Heart, 
  MessageCircle, 
  PhoneCall, 
  User as UserIcon, 
  Sparkles, 
  SlidersHorizontal, 
  ShieldCheck, 
  ExternalLink, 
  RefreshCw, 
  Crown, 
  Zap, 
  Lock, 
  Globe, 
  Phone, 
  Video, 
  CheckCircle2, 
  Search,
  ArrowRight,
  Shield,
  Layers,
  Grid,
  X,
  Users
} from 'lucide-react';
import { useTranslation, LanguageProvider } from './i18n/LanguageContext';
import { Navbar, NotificationsPanel } from './components/Navbar';
import { Sidebar, ProfileMenuAction } from './components/Sidebar';
import { DiscoveryCard } from './components/DiscoveryCard';
import { DiscoveryGrid } from './components/DiscoveryGrid';
import { FiltersModal } from './components/FiltersModal';
import { MatchModal } from './components/MatchModal';
import { ChatWindow } from './components/ChatWindow';
import { CallOverlay } from './components/CallOverlay';
import { IncomingCallModal } from './components/IncomingCallModal';
import { ProfileViewModal } from './components/ProfileViewModal';
import { ProfileEditModal } from './components/ProfileEditModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { BoostModal } from './components/BoostModal';
import { ReportModal } from './components/ReportModal';
import { PartnerDisclosureModal } from './components/PartnerDisclosureModal';
import { LegalModal } from './components/LegalModal';
import { AuthModal } from './components/AuthModal';
import { AdminView } from './components/AdminView';
import { AdminPortal } from './components/AdminPortal';
import { PublicProfileView } from './components/PublicProfileView';
import { ProfileSettingsHub } from './components/ProfileSettingsHub';
import { UserSearchModal } from './components/UserSearchModal';
import { Profile, User, Match, Conversation, Call, DiscoveryFilters } from './types';
import { soundManager } from './utils/sound';
import {
  consumeDesktopEventClickTarget,
  consumeDesktopNotifClickTarget,
  debugNotifLog,
  describeServerNotification,
  getDesktopNotificationPermission,
  isEventPrefEnabled,
  isTabHidden,
  readMessageNotifPref,
  showDesktopEventNotification,
  showDesktopMessageNotification,
} from './utils/desktopNotifications';
import { initializeCapacitorApp } from './utils/capacitorApp';
import { api, getStoredAuthSnapshot } from './services/api';
import { connectSocket, getSocket } from './services/socket';
import { clearPresence, setPresenceSnapshot, updatePresence, usePresence } from './services/presence';
import { FALLBACK_PROFILES } from './data/fallbackProfiles';

// Helper function to extract profile target from Facebook-style URL
function getProfileTargetFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  // Match /profile/:identifier
  const profileMatch = path.match(/^\/profile\/([a-zA-Z0-9_.-]+)/i);
  if (profileMatch && profileMatch[1]) {
    return decodeURIComponent(profileMatch[1]);
  }
  // Match /@:username
  const atMatch = path.match(/^\/@([a-zA-Z0-9_.-]+)/i);
  if (atMatch && atMatch[1]) {
    return decodeURIComponent(atMatch[1]);
  }
  // Check hash e.g. #/profile/:id or #@username
  const hash = window.location.hash;
  const hashMatch = hash.match(/^#\/?profile\/([a-zA-Z0-9_.-]+)/i);
  if (hashMatch && hashMatch[1]) {
    return decodeURIComponent(hashMatch[1]);
  }
  const hashAtMatch = hash.match(/^#\/?@([a-zA-Z0-9_.-]+)/i);
  if (hashAtMatch && hashAtMatch[1]) {
    return decodeURIComponent(hashAtMatch[1]);
  }
  // Check query parameter
  const urlParams = new URLSearchParams(window.location.search);
  const qProfile = urlParams.get('profile') || urlParams.get('username') || urlParams.get('u');
  if (qProfile) {
    return qProfile.trim();
  }
  return null;
}

function MainApp() {
  const { t } = useTranslation();

  // Admin Route State (/tanvir or /admin)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const path = window.location.pathname.toLowerCase();
    const hash = window.location.hash.toLowerCase();
    const search = window.location.search.toLowerCase();
    return (
      path === '/tanvir' ||
      path.endsWith('/tanvir') ||
      path === '/admin' ||
      path.endsWith('/admin') ||
      hash === '#tanvir' ||
      hash === '#/tanvir' ||
      hash === '#admin' ||
      search.includes('admin=tanvir') ||
      search.includes('route=tanvir')
    );
  });

  // App States
  const [currentUser, setCurrentUser] = useState<User | null>(() => getStoredAuthSnapshot()?.user || null);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(() => getStoredAuthSnapshot()?.profile || null);
  const [activeTab, setActiveTab] = useState<string>('discover');
  const [viewMode, setViewMode] = useState<'swipe' | 'grid'>('grid');

  // Discovery State
  const [discoverProfiles, setDiscoverProfiles] = useState<Profile[]>(() => FALLBACK_PROFILES);
  const [currentDeckIndex, setCurrentDeckIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<DiscoveryFilters>({
    minAge: 18,
    maxAge: 55,
    gender: 'ALL',
    country: '',
    city: '',
    maxDistance: 100,
    languages: [],
    interests: [],
    relationshipGoal: '',
    onlineOnly: false,
    profileSource: 'ALL',
  });

  // Matches, Conversations, Calls
  const [matches, setMatches] = useState<Match[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  // Refs mirror state for the singleton socket handlers (no stale closures,
  // no duplicate listeners across effect re-runs).
  const activeConversationIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);
  const [openingChat, setOpeningChat] = useState<{ targetId: string; profile?: Profile } | null>(null);
  const [chatOpenError, setChatOpenError] = useState<string | null>(null);
  const openingChatRef = useRef<string | null>(null);
  const [messengerTab, setMessengerTab] = useState<'chats' | 'calls'>('chats');
  const [callHistory, setCallHistory] = useState<Call[]>([]);
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);

  const unreadMessagesCount = useMemo(
    // Single source of truth for the Messages badge: backend `unread_count`
    // per conversation (GET /api/conversations), kept in lock-step on
    // realtime message/read events.
    () => conversations.reduce((acc, c) => acc + (Number(c.unread_count) || 0), 0),
    [conversations]
  );

  // Modals
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);
  const [matchedProfileData, setMatchedProfileData] = useState<Profile | null>(null);
  const [isProfileViewOpen, setIsProfileViewOpen] = useState(false);
  const [inspectProfile, setInspectProfile] = useState<Profile | null>(null);
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isBoostOpen, setIsBoostOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportTargetProfile, setReportTargetProfile] = useState<Profile | null>(null);
  const [isPartnerDisclosureOpen, setIsPartnerDisclosureOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState('terms');
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isViewingFullProfile, setIsViewingFullProfile] = useState(false);

  // Social & Registered Users Search / Profile
  const [isUserSearchOpen, setIsUserSearchOpen] = useState(false);
  // Mobile Notifications overlay reuses the existing desktop NotificationsPanel.
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  // Existing Facebook-style Profile Settings slide-out + deep section target.
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [profileSection, setProfileSection] = useState<string | null>(null);
  const [profileSectionNonce, setProfileSectionNonce] = useState(0);
  const [selectedPublicUserId, setSelectedPublicUserId] = useState<string | null>(() => getProfileTargetFromUrl());
  const [selectedPublicProfile, setSelectedPublicProfile] = useState<Profile | null>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const presence = usePresence();

  const handleOpenPublicProfile = (target: Profile | string) => {
    let identifier = '';
    if (typeof target === 'string') {
      identifier = target;
      setSelectedPublicUserId(target);
      setSelectedPublicProfile(null);
    } else {
      identifier = target.username || target.user_id || target.id;
      setSelectedPublicProfile(target);
      setSelectedPublicUserId(target.user_id || target.id);
    }

    if (typeof window !== 'undefined' && identifier) {
      const targetPath = `/profile/${identifier}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ profileTarget: identifier }, '', targetPath);
      }
    }
  };

  const handleClosePublicProfile = () => {
    setSelectedPublicUserId(null);
    setSelectedPublicProfile(null);
    if (typeof window !== 'undefined') {
      if (window.location.pathname.startsWith('/profile/') || window.location.pathname.startsWith('/@')) {
        window.history.pushState({}, '', '/');
      }
    }
  };

  // Map existing Sidebar PROFILE_MENU_ITEMS to existing ProfileSettingsHub sections.
  // No new screens: 'vip'/'boost' reuse existing modals for immediate action.
  const handleProfileMenuAction = (action: ProfileMenuAction) => {
    if (action === 'logout') {
      setIsProfileMenuOpen(false);
      handleLogout();
      return;
    }
    if (action === 'vip') {
      setIsProfileMenuOpen(false);
      setIsSubscriptionOpen(true);
      return;
    }
    if (action === 'boost') {
      setIsProfileMenuOpen(false);
      setIsBoostOpen(true);
      return;
    }
    const sectionMap: Record<Exclude<ProfileMenuAction, 'logout' | 'vip' | 'boost'>, string> = {
      'search-settings': 'search-settings',
      settings: 'settings',
      language: 'language',
      notifications: 'notifications',
      privacy: 'privacy',
      security: 'security',
      blocked: 'blocked',
      sessions: 'sessions',
    };
    setActiveTab('profile');
    setIsViewingFullProfile(false);
    setProfileSection(sectionMap[action]);
    // Bump nonce so selecting the same menu item re-triggers Hub scroll/load.
    setProfileSectionNonce((n) => n + 1);
    setIsProfileMenuOpen(false);
  };

  // Initial Data Fetch
  const loadInitialData = async () => {
    try {
      const [meRes, discoverRes, matchesRes, convsRes, callsRes, notifsRes] = await Promise.allSettled([
        api.getMe(),
        api.getDiscoverProfiles(filters),
        api.getMatches(),
        api.getConversations(),
        api.getCallHistory(),
        api.getNotifications(),
      ]);

      if (meRes.status === 'fulfilled' && meRes.value) {
        if (!meRes.value.unavailable) {
          setCurrentUser(meRes.value.user);
          setCurrentProfile(meRes.value.profile ? { ...meRes.value.profile, is_online: false } : null);
        }
      }

      if (discoverRes.status === 'fulfilled' && discoverRes.value?.profiles && discoverRes.value.profiles.length > 0) {
        setDiscoverProfiles(discoverRes.value.profiles.map((profile) => ({ ...profile, is_online: false })));
      } else {
        setDiscoverProfiles(FALLBACK_PROFILES.map((profile) => ({ ...profile, is_online: false })));
      }

      if (matchesRes.status === 'fulfilled' && matchesRes.value) {
        setMatches(matchesRes.value.matches || []);
      }

      if (convsRes.status === 'fulfilled' && convsRes.value) {
        setConversations(convsRes.value.conversations || []);
      }

      if (callsRes.status === 'fulfilled' && callsRes.value) {
        setCallHistory(callsRes.value.calls || []);
      }

      if (notifsRes.status === 'fulfilled' && notifsRes.value) {
        setNotifications(notifsRes.value.notifications || []);
      }
    } catch (err) {
      console.error('Failed to load initial app data:', err);
      setDiscoverProfiles((prev) => (prev && prev.length > 0 ? prev : FALLBACK_PROFILES));
    } finally {
      setIsLoading(false);
    }
  };

  // Capacitor Android Native Integrations (Back Button, Status Bar)
  useEffect(() => {
    initializeCapacitorApp({
      hasOpenModal: () => {
        return Boolean(
          isNotificationsOpen ||
          isFiltersOpen ||
          isMatchModalOpen ||
          isProfileViewOpen ||
          isProfileEditOpen ||
          isSubscriptionOpen ||
          isBoostOpen ||
          isReportOpen ||
          isPartnerDisclosureOpen ||
          isLegalOpen ||
          isAuthOpen ||
          isUserSearchOpen ||
          selectedPublicUserId ||
          incomingCall
        );
      },
      closeActiveModal: () => {
        if (incomingCall) setIncomingCall(null);
        else if (selectedPublicUserId) setSelectedPublicUserId(null);
        else if (isProfileViewOpen) setIsProfileViewOpen(false);
        else if (isProfileEditOpen) setIsProfileEditOpen(false);
        else if (isUserSearchOpen) setIsUserSearchOpen(false);
        else if (isNotificationsOpen) setIsNotificationsOpen(false);
        else if (isFiltersOpen) setIsFiltersOpen(false);
        else if (isMatchModalOpen) setIsMatchModalOpen(false);
        else if (isSubscriptionOpen) setIsSubscriptionOpen(false);
        else if (isBoostOpen) setIsBoostOpen(false);
        else if (isReportOpen) setIsReportOpen(false);
        else if (isPartnerDisclosureOpen) setIsPartnerDisclosureOpen(false);
        else if (isLegalOpen) setIsLegalOpen(false);
        else if (isAuthOpen) setIsAuthOpen(false);
      },
      canGoBack: () => {
        // Slide-out, hub sub-view, and secondary tabs all go back first.
        return Boolean(
          isProfileMenuOpen ||
          isNotificationsOpen ||
          (activeTab === 'profile' && (isViewingFullProfile || profileSection)) ||
          (activeTab !== 'discover' && activeTab !== 'home')
        );
      },
      goBack: () => {
        if (isProfileMenuOpen) {
          setIsProfileMenuOpen(false);
          return;
        }
        if (isNotificationsOpen) {
          setIsNotificationsOpen(false);
          return;
        }
        if (activeTab === 'profile' && (isViewingFullProfile || profileSection)) {
          setIsViewingFullProfile(false);
          setProfileSection(null);
          return;
        }
        setActiveTab('discover');
        setViewMode('grid');
      },
    });
  }, [
    isFiltersOpen,
    isMatchModalOpen,
    isProfileViewOpen,
    isProfileEditOpen,
    isSubscriptionOpen,
    isBoostOpen,
    isReportOpen,
    isPartnerDisclosureOpen,
    isLegalOpen,
    isAuthOpen,
    isUserSearchOpen,
    isNotificationsOpen,
    isProfileMenuOpen,
    isViewingFullProfile,
    profileSection,
    selectedPublicUserId,
    incomingCall,
    activeTab,
  ]);

  // Lightweight URL state sync for existing state navigation (no router).
  // Best-effort replaceState only: preserves refresh + back behavior, never adds history spam.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.history?.replaceState !== 'function') return;
    // Never rewrite shareable public-profile or admin routes.
    if (getProfileTargetFromUrl()) return;
    const path = window.location.pathname.toLowerCase();
    if (path === '/tanvir' || path === '/admin' || path.endsWith('/tanvir') || path.endsWith('/admin')) return;
    try {
      const params = new URLSearchParams(window.location.search);
      params.set('tab', activeTab);
      if (activeTab === 'profile' && profileSection) {
        params.set('section', profileSection);
      } else {
        params.delete('section');
      }
      const next = `${window.location.pathname}?${params.toString()}${window.location.hash || ''}`;
      window.history.replaceState({}, '', next);
    } catch {
      // URL sync is best-effort only; state navigation remains source of truth.
    }
  }, [activeTab, profileSection]);

  useEffect(() => {
    loadInitialData();

    // Socket.io connection and real-time listeners
    const socket = getSocket();

    const emitUserJoin = () => {
      const myId = currentUser?.id || currentProfile?.user_id || currentProfile?.id;
      if (myId) {
        socket.emit('user:join', { userId: myId });
        socket.emit('user:online', { userId: myId });
      }
      if (currentUser?.id && currentUser.id !== myId) {
        socket.emit('user:join', { userId: currentUser.id });
      }
      if (currentProfile?.user_id && currentProfile.user_id !== myId) {
        socket.emit('user:join', { userId: currentProfile.user_id });
      }
      if (currentProfile?.id && currentProfile.id !== myId) {
        socket.emit('user:join', { userId: currentProfile.id });
      }
    };

    emitUserJoin();
    socket.on('connect', emitUserJoin);

    const handlePresenceSnapshot = (users: Array<{ userId: string; isOnline: boolean }>) => {
      setPresenceSnapshot(users.filter((user) => user.isOnline).map((user) => user.userId));
    };
    const handlePresenceUpdate = (data: { userId?: string; isOnline?: boolean }) => {
      if (!data?.userId) return;
      updatePresence(data.userId, Boolean(data.isOnline));
    };
    socket.on('presence:snapshot', handlePresenceSnapshot);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('connect_error', () => clearPresence());
    connectSocket();

    socket.on('match:created', (data) => {
      setMatchedProfileData(data.matched_profile);
      setIsMatchModalOpen(true);
      api.getMatches().then((m) => setMatches(m.matches));
      api.getConversations().then((c) => setConversations(c.conversations));
      api.getNotifications().then((n) => setNotifications(n.notifications)).catch(() => {});
    });

    socket.on('follow:update', (data: any) => {
      const myId = currentUser?.id || currentProfile?.user_id || currentProfile?.id;
      const isMe = 
        data?.targetUserId === myId || 
        data?.targetUserId === currentProfile?.id || 
        data?.targetUserId === currentProfile?.user_id ||
        data?.followerId === myId;

      if (isMe) {
        api.getNotifications().then((res) => {
          if (res?.notifications) {
            setNotifications(res.notifications);
          }
        }).catch(() => {});
        if (data?.targetUserId === myId || data?.targetUserId === currentProfile?.id || data?.targetUserId === currentProfile?.user_id) {
          if (typeof data.followersCount === 'number') {
            setCurrentProfile((prev) => prev ? { ...prev, followers_count: data.followersCount } : prev);
          }
        }
      }
    });

    socket.on('call:incoming', (callData: Call) => {
      const myId = currentUser?.id || currentProfile?.user_id || currentProfile?.id;
      if (!myId) return;
      // If we are the receiver of the call, trigger the incoming call modal
      const isTarget = 
        callData.receiver_id === myId || 
        (currentProfile && (callData.receiver_id === currentProfile.id || callData.receiver_id === currentProfile.user_id));

      if (isTarget && callData.caller_id !== myId) {
        setIncomingCall(callData);
      }
    });

    socket.on('call:rejected', (callData: Call) => {
      if (activeCall && activeCall.id === callData.id) {
        setActiveCall(null);
      }
      if (incomingCall && incomingCall.id === callData.id) {
        setIncomingCall(null);
      }
    });

    socket.on('call:ended', (data: any) => {
      const endedCallId = data?.callId || data?.id;
      if (endedCallId) {
        setActiveCall((prev) => (prev && prev.id === endedCallId ? null : prev));
        setIncomingCall((prev) => (prev && prev.id === endedCallId ? null : prev));
        api.getCallHistory().then((c) => setCallHistory(c.calls)).catch(() => {});
      }
    });

    socket.on('notification:new', (notif: any) => {
      try {
        debugNotifLog('notification:new received', {
          id: notif?.id,
          type: notif?.type,
          title: notif?.title,
          hidden: isTabHidden(),
          permission: getDesktopNotificationPermission(),
        });
      } catch {}
      setNotifications((prev) => {
        if (prev.some((n) => n.id === notif.id)) return prev;
        return [notif, ...prev];
      });
      soundManager.playNotificationPop();
      // LIKE/match/follow desktop notification (server `notification:new`).
      // Likes arrive ONLY on this event — there is no separate like socket event.
      try {
        const described = describeServerNotification(notif);
        if (!described) {
          debugNotifLog('notification:new ignored (no title/type)', { id: notif?.id });
          return;
        }
        if (!isEventPrefEnabled(described.prefKey)) {
          debugNotifLog('event-skipped-pref-off', { id: notif?.id, type: notif?.type });
          return;
        }
        const hidden = isTabHidden();
        debugNotifLog('event-desktop-decision', { id: notif?.id, type: notif?.type, hidden });
        // Likes/matches/follows have no other in-app toast beyond the panel
        // badge, so notify even on a visible tab (matches existing "real-time
        // alerts" preference copy). Actively-viewed-conversation suppression
        // does not apply here — these are not chat messages.
        const result = showDesktopEventNotification({
          eventId: typeof notif?.id === 'string' ? notif.id : undefined,
          title: described.title,
          body: described.body,
          photo: described.photo,
          clickConversationId: typeof notif?.data?.conversationId === 'string' ? notif.data.conversationId : undefined,
          clickNotificationId: typeof notif?.id === 'string' ? notif.id : undefined,
          clickProfileId:
            (typeof notif?.data?.profileId === 'string' && notif.data.profileId) ||
            (typeof notif?.data?.followerId === 'string' && notif.data.followerId) ||
            (typeof notif?.data?.userId === 'string' && notif.data.userId) ||
            undefined,
        });
        debugNotifLog('event-desktop-result', { id: notif?.id, shown: result.shown, reason: result.reason });
      } catch (err) {
        debugNotifLog('event-desktop-error', { error: String(err) });
      }
    });

    // WEB-only: one global incoming-message listener so background/minimized
    // tabs still surface a native Windows/browser notification.
    // ChatWindow only listens while a conversation is open; this singleton
    // covers the background case without a second socket connection.
    // Dedupes by message id (StrictMode / reconnect safe) and never notifies
    // for the conversation the user is actively viewing.
    const seenDesktopMessageIdsRef = { current: new Set<string>() };
    const handleGlobalMessageNew = (msg: any) => {
      try {
        const myId = currentUser?.id || currentProfile?.user_id || currentProfile?.id;
        const socketConnected = socket.connected;
        debugNotifLog('message:new received', {
          id: msg?.id,
          conversationId: msg?.conversation_id,
          senderId: msg?.sender_id,
          myId,
          socketConnected,
          hidden: isTabHidden(),
          permission: getDesktopNotificationPermission(),
          prefMessages: readMessageNotifPref(),
          viewing: activeConversationIdRef.current,
        });
        if (!msg || msg.sender_id === myId) {
          if (msg) debugNotifLog('message-skipped-own', { id: msg?.id });
          return; // never notify for own sends
        }
        const messageId = typeof msg.id === 'string' ? msg.id : '';
        if (messageId) {
          if (seenDesktopMessageIdsRef.current.has(messageId)) return;
          seenDesktopMessageIdsRef.current.add(messageId);
          if (seenDesktopMessageIdsRef.current.size > 200) {
            const oldest = seenDesktopMessageIdsRef.current.values().next().value as string | undefined;
            if (oldest) seenDesktopMessageIdsRef.current.delete(oldest);
          }
        }

        const convId = typeof msg.conversation_id === 'string' ? msg.conversation_id : '';
        // Case A: user is actively viewing this conversation → in-app only.
        const viewingConv = (activeConversationIdRef.current || '').replace(/^pending:/, '');
        if (convId && viewingConv && (convId === viewingConv || `pending:${convId}` === activeConversationIdRef.current)) {
          debugNotifLog('message-skipped-viewing', { id: messageId, convId });
          return;
        }
        // Notify whenever the message is for a conversation the user is NOT
        // actively viewing — whether the tab is hidden (background/minimized/
        // unfocused) or visible on another page/conversation. There is no
        // in-app toast for messages, so this does not duplicate anything.
        const hidden = isTabHidden();
        debugNotifLog('message-desktop-decision', { id: messageId, convId, hidden });

        const known = conversationsRef.current.find((c) => c.id === convId);
        const senderName =
          known?.other_user?.name ||
          (typeof msg.sender_name === 'string' ? msg.sender_name : '') ||
          undefined;
        const preview =
          typeof msg.content === 'string' && msg.content.trim()
            ? msg.content
            : (msg.message_type && msg.message_type !== 'text' ? `[${msg.message_type}]` : '');
        const result = showDesktopMessageNotification({
          messageId: messageId || undefined,
          conversationId: convId || undefined,
          senderId: typeof msg.sender_id === 'string' ? msg.sender_id : undefined,
          senderName,
          preview,
          photo: known?.other_user?.photos?.[0],
        });
        debugNotifLog('message-desktop-result', { id: messageId, shown: result.shown, reason: result.reason });

        // Update unread count for non-viewed conversations (realtime badge).
        // Uses functional update so rapid socket events batch correctly.
        if (convId) {
          const knownConv = conversationsRef.current.find((c) => c.id === convId);
          if (knownConv) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === convId
                  ? { ...c, unread_count: (Number(c.unread_count) || 0) + 1 }
                  : c
              )
            );
          } else {
            // Conversation not in list yet — refresh so the badge/source of truth stays in sync.
            api.getConversations().then((res) => {
              if (Array.isArray(res?.conversations)) {
                setConversations(res.conversations);
              }
            }).catch(() => {});
          }
        }
      } catch (err) {
        debugNotifLog('message-desktop-error', { error: String(err) });
      }
    };
    socket.on('message:new', handleGlobalMessageNew);

    // Messages badge decrement: emitted by ChatWindow after the server
    // marks a conversation as read (also fires on the room for other clients).
    const handleConversationRead = (data: { conversation_id?: string }) => {
      const convId = typeof data?.conversation_id === 'string' ? data.conversation_id : '';
      if (!convId) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId ? { ...c, unread_count: 0 } : c
        )
      );
    };
    socket.on('message:read', handleConversationRead);

    // Notification click → open the right conversation via existing state.
    // Uses refs so the handler never goes stale between effect re-runs.
    const handleOpenConversationEvent = (event: Event) => {
      const detail = (event as CustomEvent)?.detail as { conversationId?: string } | undefined;
      const fromEvent = typeof detail?.conversationId === 'string' ? detail.conversationId : '';
      const target = fromEvent || consumeDesktopNotifClickTarget();
      if (!target) return;
      setActiveTab('messages');
      setMessengerTab('chats');
      const known = conversationsRef.current.find((c) => c.id === target);
      if (known) {
        setOpeningChat(null);
        setChatOpenError(null);
        setActiveConversationId(known.id);
      } else {
        // Refresh conversations in the background, then open if it resolves.
        api.getConversations().then((res) => {
          if (Array.isArray(res?.conversations)) {
            setConversations(res.conversations);
            const found = res.conversations.find((c: Conversation) => c.id === target);
            if (found) {
              setOpeningChat(null);
              setChatOpenError(null);
              setActiveConversationId(found.id);
            }
          }
        }).catch(() => {});
      }
    };
    window.addEventListener('lovemeetly:open-conversation', handleOpenConversationEvent as EventListener);

    // Generic notification click → notifications area / profile / conversation.
    const handleOpenNotificationEvent = (event: Event) => {
      const detail = (event as CustomEvent)?.detail as { conversationId?: string; notificationId?: string; profileId?: string } | undefined;
      const convId = typeof detail?.conversationId === 'string' ? detail.conversationId : '';
      let notifTarget = { notificationId: typeof detail?.notificationId === 'string' ? detail.notificationId : '', profileId: typeof detail?.profileId === 'string' ? detail.profileId : '' };
      if (!notifTarget.notificationId && !notifTarget.profileId) {
        const stored = consumeDesktopEventClickTarget();
        if (stored) notifTarget = stored;
      } else {
        consumeDesktopEventClickTarget();
      }
      if (convId) {
        setActiveTab('messages');
        setMessengerTab('chats');
        const known = conversationsRef.current.find((c) => c.id === convId);
        if (known) {
          setOpeningChat(null);
          setChatOpenError(null);
          setActiveConversationId(known.id);
        }
        return;
      }
      // Likes/matches/follows land on the in-app notifications overlay.
      setIsNotificationsOpen(true);
      if (notifTarget.profileId) {
        handleOpenPublicProfile(notifTarget.profileId);
      }
    };
    window.addEventListener('lovemeetly:open-notification', handleOpenNotificationEvent as EventListener);

    // Periodic notifications sync to ensure all-time live updates
    const notifSyncInterval = setInterval(async () => {
      if (currentUser?.id) {
        try {
          const res = await api.getNotifications();
          if (res?.notifications) {
            setNotifications((prev) => {
              const prevIds = new Set(prev.map((n) => n.id));
              const newlyReceived = res.notifications.filter((n: any) => !prevIds.has(n.id));
              if (newlyReceived.length > 0 && newlyReceived.some((n: any) => !n.is_read)) {
                soundManager.playNotificationPop();
              }
              return res.notifications;
            });
          }
        } catch (err) {}
      }
    }, 8000);

    const handleUrlChange = () => {
      if (typeof window === 'undefined') return;
      const path = window.location.pathname.toLowerCase();
      const hash = window.location.hash.toLowerCase();
      const search = window.location.search.toLowerCase();
      const isTanvir = 
        path === '/tanvir' ||
        path.endsWith('/tanvir') ||
        path === '/admin' ||
        path.endsWith('/admin') ||
        hash === '#tanvir' ||
        hash === '#/tanvir' ||
        hash === '#admin' ||
        search.includes('admin=tanvir') ||
        search.includes('route=tanvir');
      setIsAdminRoute(isTanvir);

      // Check if URL points to a public profile
      const urlProfileTarget = getProfileTargetFromUrl();
      if (urlProfileTarget) {
        setSelectedPublicUserId(urlProfileTarget);
      } else if (path === '/' || path === '') {
        setSelectedPublicUserId(null);
        setSelectedPublicProfile(null);
      }
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    return () => {
      clearInterval(notifSyncInterval);
      socket.off('connect', emitUserJoin);
      socket.off('presence:snapshot', handlePresenceSnapshot);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('connect_error');
      socket.off('match:created');
      socket.off('call:incoming');
      socket.off('call:rejected');
      socket.off('call:ended');
      socket.off('notification:new');
      socket.off('message:new', handleGlobalMessageNew);
      socket.off('message:read', handleConversationRead);
      window.removeEventListener('lovemeetly:open-conversation', handleOpenConversationEvent as EventListener);
      window.removeEventListener('lovemeetly:open-notification', handleOpenNotificationEvent as EventListener);
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, [currentUser?.id, currentProfile?.user_id, activeCall?.id, incomingCall?.id]);

  // Reset all filters and search query to show all global profiles
  const handleResetAllFilters = async () => {
    const defaultFilters: DiscoveryFilters = {
      minAge: 18,
      maxAge: 70,
      gender: 'ALL',
      country: '',
      city: '',
      maxDistance: 500,
      languages: [],
      interests: [],
      relationshipGoal: '',
      onlineOnly: false,
      profileSource: 'ALL',
    };
    setSearchQuery('');
    setFilters(defaultFilters);
    setCurrentDeckIndex(0);
    setIsLoading(true);
    try {
      const res = await api.getDiscoverProfiles(defaultFilters);
      setDiscoverProfiles(res.profiles);
    } catch (err) {
      console.error('Reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch profiles when filters change
  const handleApplyFilters = async (newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
    setIsLoading(true);
    try {
      const res = await api.getDiscoverProfiles(newFilters);
      setDiscoverProfiles(res.profiles);
      setCurrentDeckIndex(0);
    } catch (err) {
      console.error('Filters error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Like / Super Like Handler
  const handleLike = async (profile: Profile, isSuperLike = false): Promise<boolean> => {
    try {
      const res = await api.sendLike(profile.user_id || profile.id, isSuperLike);
      if (res.is_match && res.match_data) {
        setMatchedProfileData(profile);
        setIsMatchModalOpen(true);
        // Refresh matches
        api.getMatches().then((m) => setMatches(m.matches));
        api.getConversations().then((c) => setConversations(c.conversations));
      }
      // Advance card
      setCurrentDeckIndex((prev) => prev + 1);
      return true;
    } catch (err) {
      console.error('Like error:', err);
      return false;
    }
  };

  // Pass Handler
  const handlePass = (profile: Profile) => {
    setCurrentDeckIndex((prev) => prev + 1);
  };

  // Call Initiation Handler
  const handleStartCall = async (receiverId: string, type: 'voice' | 'video') => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    soundManager.unlock();
    try {
      const res = await api.initiateCall(receiverId, type);
      setActiveCall(res.call);
    } catch (err: any) {
      if (err.message === 'Authentication required' || err.message?.includes('auth')) {
        setIsAuthOpen(true);
      } else {
        alert(err.message || 'Call failed to start');
      }
    }
  };

  // Incoming Call Acceptance (Instant 1-Click Connection)
  const handleAcceptCall = async (call: Call) => {
    soundManager.unlock();
    // 1. Immediately transition UI state so the modal closes and call view opens instantly
    setIncomingCall(null);
    setActiveCall({ ...call, status: 'accepted' });

    // 2. Emit real-time WebRTC/Socket acceptance
    try {
      const socket = getSocket();
      socket.emit('call:accept', {
        callId: call.id,
        caller_id: call.caller_id,
        receiver_id: call.receiver_id,
        call,
      });
    } catch (e) {}

    // 3. Persist call state to database
    try {
      const res = await api.acceptCall(call.id);
      if (res.call) {
        setActiveCall((prev) => prev ? { ...prev, ...res.call, status: 'accepted' } : res.call);
      }
    } catch (err) {
      console.warn('Accept call background sync note:', err);
    }
  };

  // Incoming Call Rejection
  const handleRejectCall = async (call: Call) => {
    try {
      await api.rejectCall(call.id);
    } catch (err) {}
    setIncomingCall(null);
  };

  const handleEndActiveCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  // Direct Message Handler from Profile Modal
  // Opens the chat destination synchronously (no await before navigation) so the
  // profile never unmounts into a blank state and the chat feels immediate.
  // Conversation creation + history load happen asynchronously afterwards.
  const handleStartChat = useCallback(async (profileOrId: Profile | string) => {
    const targetProfile = typeof profileOrId === 'string' ? undefined : profileOrId;
    const rawTargetId = typeof profileOrId === 'string' ? profileOrId : (profileOrId.user_id || profileOrId.id);
    const targetId = (rawTargetId || '').trim();
    if (!targetId) {
      setChatOpenError('Could not determine which profile to message.');
      return;
    }
    // Ignore duplicate taps for the same target while a request is in flight.
    if (openingChatRef.current === targetId) return;

    const knownConversation = conversations.find((conversation) =>
      conversation.other_user?.user_id === targetId ||
      conversation.other_user?.id === targetId ||
      (conversation.user_a_id === currentUser?.id && conversation.user_b_id === targetId) ||
      (conversation.user_b_id === currentUser?.id && conversation.user_a_id === targetId)
    );

    // Navigate FIRST — synchronously — before any network request.
    setSelectedPublicUserId(null);
    setSelectedPublicProfile(null);
    setIsProfileViewOpen(false);
    setActiveTab('messages');
    setMessengerTab('chats');
    setChatOpenError(null);

    if (knownConversation) {
      setOpeningChat(null);
      openingChatRef.current = null;
      setActiveConversationId(knownConversation.id);
      return;
    }

    // Render the chat destination immediately while conversation creation runs
    // in the background. The placeholder id uses the `pending:` prefix so
    // ChatWindow/API layers know not to fetch history for it.
    const pendingId = `pending:${targetId}`;
    setOpeningChat({ targetId, profile: targetProfile });
    setActiveConversationId(pendingId);
    openingChatRef.current = targetId;

    try {
      const res = await api.createOrGetConversation(targetId);
      if (!res.conversation) throw new Error('The server did not return a conversation.');
      // Always cache the conversation even if the user moved on (stale),
      // so a later tap opens instantly from the known list.
      setConversations((prev) => [
        res.conversation,
        ...prev.filter((conversation) => conversation.id !== res.conversation.id),
      ]);
      // Ignore stale navigation if the user already opened a different chat.
      if (openingChatRef.current !== targetId) return;
      setOpeningChat(null);
      setChatOpenError(null);
      setActiveConversationId(res.conversation.id);
    } catch (err: any) {
      // Ignore stale failures for a superseded target.
      if (openingChatRef.current !== targetId) return;
      console.error('Start chat error:', err);
      // Keep the user on the messages tab with a retry state instead of
      // bouncing them back to the (now closed) profile.
      setChatOpenError(err?.message || 'Could not open this conversation.');
    } finally {
      if (openingChatRef.current === targetId) openingChatRef.current = null;
    }
  }, [conversations, currentUser?.id]);

  const handleOpenLegalModal = (tabName: string) => {
    if (tabName === 'disclosure') {
      setIsPartnerDisclosureOpen(true);
    } else {
      setLegalInitialTab(tabName);
      setIsLegalOpen(true);
    }
  };

  // Filter discover profiles by search query
  const filteredDiscoverProfiles = discoverProfiles.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = (p.name || '').toLowerCase().includes(q);
    const cityMatch = (p.city || '').toLowerCase().includes(q);
    const countryMatch = (p.country || '').toLowerCase().includes(q);
    const professionMatch = (p.profession || '').toLowerCase().includes(q);
    const bioMatch = (p.bio || '').toLowerCase().includes(q);
    const interestMatch = (p.interests || []).some((i) => i.toLowerCase().includes(q));
    const langMatch = (p.languages || []).some((l) => l.toLowerCase().includes(q));
    return nameMatch || cityMatch || countryMatch || professionMatch || bioMatch || interestMatch || langMatch;
  });

  const activeProfileInDeck = filteredDiscoverProfiles[currentDeckIndex];
  const rawActiveConversation = activeConversationId
    ? conversations.find((c) => c.id === activeConversationId)
    : undefined;
  // While a new conversation is being created, render an instant provisional
  // ChatWindow from the known profile so the destination is visible without
  // waiting for the network. History/socket attach once the real id arrives.
  // Falls back to a minimal profile shell when only the id is known (e.g. retry).
  const activeConversation: Conversation | undefined = rawActiveConversation ?? (
    openingChat && activeConversationId === `pending:${openingChat.targetId}`
      ? {
          id: `pending:${openingChat.targetId}`,
          match_id: '',
          user_a_id: currentUser?.id || '',
          user_b_id: openingChat.targetId,
          other_user: openingChat.profile ?? {
            id: openingChat.targetId,
            user_id: openingChat.targetId,
            name: 'Member',
            age: 0,
            gender: 'OTHER' as const,
            country: '',
            city: '',
            bio: '',
            photos: [],
            interests: [],
            languages: [],
            relationship_goal: '',
            compatibility_score: 0,
            is_online: false,
            source_type: 'native' as const,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          unread_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      : undefined
  );

  // If visiting Admin Route (/tanvir or /admin)
  if (isAdminRoute) {
    return (
      <AdminPortal
        onBackToSite={() => {
          setIsAdminRoute(false);
          try {
            window.history.pushState({}, '', '/');
          } catch (e) {}
        }}
      />
    );
  }

  const handleLogout = async () => {
    getSocket().disconnect();
    clearPresence();
    try {
      await api.logout();
    } catch (e) {}
    setCurrentUser(null);
    setCurrentProfile(null);
    setIsViewingFullProfile(false);
    setActiveTab('discover');
    setIsAuthOpen(true);
  };

  const handleUpdateProfileData = async (data: Partial<Profile>) => {
    try {
      const res = await api.updateProfile(data);
      if (res?.profile) {
        setCurrentProfile(res.profile);
      }
    } catch (e) {
      console.warn('Failed to update profile data:', e);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    } catch (e) {}
  };

  return (
    <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col font-sans selection:bg-rose-500 selection:text-white overflow-x-hidden">
      
      {/* Header */}
      <Navbar
        user={currentUser}
        profile={currentProfile}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onOpenFilters={() => setIsFiltersOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onOpenBoost={() => setIsBoostOpen(true)}
        onOpenProfile={() => setIsProfileEditOpen(true)}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenLegal={handleOpenLegalModal}
        notifications={notifications}
        unreadNotificationsCount={notifications.filter((n) => !n.is_read).length}
        unreadMessagesCount={conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
        onSelectNotificationProfile={(profileOrUserId) => {
          setSelectedPublicUserId(profileOrUserId);
        }}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onResetHome={() => {
          setSelectedPublicUserId(null);
          setActiveTab('discover');
          setViewMode('grid');
          setSearchQuery('');
        }}
      />

      {/* Main App Layout */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto px-0 md:px-3 lg:px-6">
        
        {/* Sidebar */}
        <Sidebar
          activeTab={activeTab === 'messages' && messengerTab === 'calls' ? 'messages' : activeTab}
          setActiveTab={(tab) => {
            if (tab === 'calls') {
              setMessengerTab('calls');
              setActiveTab('messages');
              return;
            }
            if (tab === 'messages') {
              setMessengerTab('chats');
            }
            setActiveTab(tab);
            if (tab === 'profile') {
              setIsViewingFullProfile(false);
              setProfileSection(null);
            }
          }}
          matchesCount={matches.length}
          unreadMessagesCount={conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0)}
          unreadNotificationsCount={notifications.filter((n) => !n.is_read).length}
          user={currentUser}
          profile={currentProfile}
          onOpenLegal={handleOpenLegalModal}
          setViewMode={setViewMode}
          onGoHome={() => {
            setSelectedPublicUserId(null);
            setActiveTab('discover');
            setViewMode('grid');
            setSearchQuery('');
          }}
          isProfileMenuOpen={isProfileMenuOpen}
          onOpenProfileMenu={() => {
            setActiveTab('profile');
            setIsViewingFullProfile(false);
            setProfileSection(null);
            setIsProfileMenuOpen(true);
          }}
          onCloseProfileMenu={() => setIsProfileMenuOpen(false)}
          onProfileMenuAction={handleProfileMenuAction}
          onSelectDiscover={() => {
            setSelectedPublicUserId(null);
            setSelectedPublicProfile(null);
            setIsUserSearchOpen(false);
            setIsNotificationsOpen(false);
            setIsProfileMenuOpen(false);
            setCurrentDeckIndex(0);
            setActiveTab('discover');
            setViewMode('grid');
            setSearchQuery('');
          }}
          onOpenSearch={() => setIsUserSearchOpen(true)}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          isSearchOpen={isUserSearchOpen}
          isNotificationsOpen={isNotificationsOpen}
        />

        {/* Content View Container */}
        <main className="flex-1 w-full px-2.5 sm:px-4 md:px-6 lg:px-8 py-2.5 sm:py-6 overflow-y-auto pb-20 md:pb-8">
          
          {/* ========================================================================= */}
          {/* 1. DISCOVER TAB */}
          {/* ========================================================================= */}
          {(activeTab === 'discover' || activeTab === 'home') && (
            <div className="space-y-3.5 sm:space-y-6 w-full">
              {/* Discover | Matches tabs: Matches reuses existing Matches view */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('discover')}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow"
                >
                  Discover
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('matches')}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 bg-stone-900 text-stone-300 border border-stone-800 hover:text-white"
                >
                  <Heart className="w-3.5 h-3.5 text-rose-400" />
                  Matches
                  {matches.length > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {matches.length > 99 ? '99+' : matches.length}
                    </span>
                  )}
                </button>
              </div>
              {/* Profile Search & Filter Bar */}
              <div className="w-full bg-stone-900/80 p-2.5 sm:p-4 rounded-2xl border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 shadow-md">
                
                {/* Search Input */}
                <div className="relative w-full sm:w-80 flex items-center">
                  <Search className="w-4 h-4 text-rose-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentDeckIndex(0);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                      }
                    }}
                    placeholder="Search by name, city, country, interest..."
                    className="w-full bg-stone-950 border border-stone-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-100 placeholder-stone-400 focus:outline-none focus:border-rose-500 transition"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setCurrentDeckIndex(0);
                      }}
                      className="absolute right-2.5 text-stone-400 hover:text-white p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills & Refresh */}
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-between sm:justify-end text-xs">
                  {searchQuery && (
                    <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1">
                      {filteredDiscoverProfiles.length} Results
                    </span>
                  )}

                  <span className={`px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 border text-[11px] ${
                    filters.profileSource === 'ALL'
                      ? 'bg-stone-800 text-stone-300 border-stone-700'
                      : filters.profileSource === 'NATIVE'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}>
                    {filters.profileSource === 'ALL' ? 'Global' : filters.profileSource === 'NATIVE' ? 'Members' : 'Partners'}
                  </span>

                  <button
                    type="button"
                    onClick={() => setIsFiltersOpen(true)}
                    className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 text-[11px] font-medium flex items-center gap-1 transition cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-rose-400" />
                    <span>Filters</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDeckIndex(0);
                      setSearchQuery('');
                      api.getDiscoverProfiles(filters).then((r) => setDiscoverProfiles(r.profiles));
                    }}
                    className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition cursor-pointer"
                    title="Reset & Refresh"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* View Content: Swipe Deck or Grid */}
              {viewMode === 'swipe' ? (
                <div className="flex items-center justify-center w-full min-h-[520px] sm:min-h-[660px]">
                  {activeProfileInDeck ? (
                    <DiscoveryCard
                      key={activeProfileInDeck.id}
                      profile={activeProfileInDeck}
                      onLike={handleLike}
                      onPass={handlePass}
                      onViewDetails={(p) => handleOpenPublicProfile(p)}
                      onReport={(p) => {
                        setReportTargetProfile(p);
                        setIsReportOpen(true);
                      }}
                    />
                  ) : (
                    <div className="text-center py-20 px-6 max-w-md bg-stone-900/60 rounded-3xl border border-stone-800 shadow-2xl space-y-4">
                      <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto">
                        <Globe className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-bold text-white font-serif">
                        {searchQuery ? 'No Matching Profiles Found' : 'Deck Completed!'}
                      </h3>
                      <p className="text-xs text-stone-300 leading-relaxed">
                        {searchQuery 
                          ? `No profiles matched "${searchQuery}". Try a different keyword or clear search.`
                          : 'You have browsed all matching profiles with your current filters. Adjust your age range, distance, or reset filters to discover more people worldwide.'}
                      </p>
                      <div className="flex gap-2 justify-center pt-2 flex-wrap">
                        {searchQuery ? (
                          <>
                            <button
                              onClick={() => {
                                setSearchQuery('');
                                setCurrentDeckIndex(0);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-rose-900/30 cursor-pointer"
                            >
                              Clear Search
                            </button>
                            <button
                              onClick={handleResetAllFilters}
                              className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs cursor-pointer"
                            >
                              Show All Worldwide
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={handleResetAllFilters}
                              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-900/30 cursor-pointer"
                            >
                              Restart & Show All
                            </button>
                            <button
                              onClick={() => setIsFiltersOpen(true)}
                              className="px-5 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs cursor-pointer"
                            >
                              Adjust Filters
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <DiscoveryGrid
                  profiles={filteredDiscoverProfiles}
                  onLike={handleLike}
                  onPass={handlePass}
                  onViewDetails={(p) => handleOpenPublicProfile(p)}
                  onResetFilters={handleResetAllFilters}
                />
              )}

            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. MATCHES TAB */}
          {/* ========================================================================= */}
          {activeTab === 'matches' && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-white font-serif">{t('matches')}</h1>
                <p className="text-xs text-stone-400">Your mutual sparks and connections worldwide</p>
              </div>

              {matches.length === 0 ? (
                <div className="p-16 text-center bg-stone-900/50 rounded-3xl border border-stone-800 space-y-3">
                  <Heart className="w-10 h-10 text-stone-600 mx-auto" />
                  <h3 className="font-bold text-white text-base">No matches yet</h3>
                  <p className="text-xs text-stone-400 max-w-sm mx-auto">
                    Keep swiping and liking profiles on Discover. When someone likes you back, they will appear here!
                  </p>
                  <button
                    onClick={() => setActiveTab('discover')}
                    className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white font-bold text-xs shadow-lg shadow-rose-900/30"
                  >
                    Start Discovering
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full">
                  {matches.map((match) => {
                    const prof = match.matched_profile;
                    if (!prof) return null;

                    return (
                      <div
                        key={match.id}
                        className="p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-stone-900 border border-stone-800 shadow-lg flex items-center justify-between gap-2.5 sm:gap-3 hover:border-rose-500/50 transition group"
                      >
                        <div
                          className="flex items-center gap-3 cursor-pointer flex-1"
                          onClick={() => handleOpenPublicProfile(prof)}
                        >
                          <div className="relative">
                            <img
                              src={prof.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80'}
                              alt={prof.name}
                              className="w-14 h-14 rounded-2xl object-cover border-2 border-rose-500/40 group-hover:border-rose-500 transition"
                              referrerPolicy="no-referrer"
                            />
                            {presence[prof.user_id || prof.id] && (
                              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-stone-900" />
                            )}
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5">
                              <h3 className="font-bold text-white text-sm font-serif truncate group-hover:text-rose-400 transition-colors">{prof.name}</h3>
                              <span className="text-xs text-stone-400">{prof.age}</span>
                            </div>
                            <p className="text-[11px] text-stone-400 truncate">{prof.city}, {prof.country}</p>
                            <p className="text-[10px] text-rose-400 font-semibold mt-0.5">
                              {prof.compatibility_score}% Compatible
                            </p>
                          </div>
                        </div>

                        {/* Quick Chat / Call Triggers */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              if (match.conversation_id) {
                                setActiveConversationId(match.conversation_id);
                                setActiveTab('messages');
                              } else {
                                handleStartChat(prof);
                              }
                            }}
                            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 text-white text-xs font-semibold shadow hover:opacity-90 transition flex items-center gap-1.5"
                            title="Chat & Call"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>Chat</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. MESSAGES TAB */}
          {/* ========================================================================= */}
          {activeTab === 'messages' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6 h-[calc(100vh-8.5rem)] md:h-[calc(100vh-10rem)] w-full">
              
              {/* Conversations & Calls List (FB Messenger Style) */}
              <div className={`bg-stone-900 rounded-2xl sm:rounded-3xl border border-stone-800 overflow-hidden flex flex-col shadow-xl ${
                activeConversationId ? 'hidden md:flex' : 'flex'
              }`}>
                <div className="p-3 sm:p-4 border-b border-stone-800">
                  <div className="flex items-center justify-between mb-2.5">
                    <h2 className="font-bold text-white text-base font-serif">{t('messages')}</h2>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      Live Chat & Calls
                    </span>
                  </div>

                  {/* Facebook Messenger Sub-Tabs: Chats / Calls */}
                  <div className="grid grid-cols-2 p-1 bg-stone-950 rounded-xl border border-stone-800 text-xs">
                    <button
                      type="button"
                      onClick={() => setMessengerTab('chats')}
                      className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                        messengerTab === 'chats'
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Chats</span>
                      {unreadMessagesCount > 0 && (
                        <span className="px-1.5 py-0.2 bg-white/20 text-white rounded-full text-[10px]">
                          {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessengerTab('calls')}
                      className={`py-1.5 px-3 rounded-lg font-medium transition flex items-center justify-center gap-1.5 ${
                        messengerTab === 'calls'
                          ? 'bg-gradient-to-r from-rose-600 to-pink-600 text-white shadow'
                          : 'text-stone-400 hover:text-stone-200'
                      }`}
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Calls</span>
                      {callHistory.length > 0 && (
                        <span className="px-1.5 py-0.2 bg-stone-800 text-stone-300 rounded-full text-[10px]">
                          {callHistory.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                <div className="p-1.5 sm:p-2 overflow-y-auto flex-1 space-y-1">
                  {messengerTab === 'chats' ? (
                    conversations.length === 0 ? (
                      <div className="p-8 text-center text-stone-500 text-xs">
                        No active conversations. Match with someone to start chatting!
                      </div>
                    ) : (
                      conversations.map((conv) => {
                        const other = conv.other_user;
                        const isSelected = activeConversationId === conv.id;

                        return (
                          <button
                            key={conv.id}
                            onClick={() => setActiveConversationId(conv.id)}
                            className={`w-full p-3 rounded-2xl text-left flex items-center gap-3 transition ${
                              isSelected
                                ? 'bg-rose-500/15 border border-rose-500/40 text-white'
                                : 'hover:bg-stone-800/80 text-stone-300'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <img
                                src={other.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80'}
                                alt={other.name}
                                className="w-12 h-12 rounded-full object-cover border border-rose-500/30"
                                referrerPolicy="no-referrer"
                              />
                              {presence[other.user_id || other.id] && (
                                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-stone-900" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1.5">
                                <span className="font-bold text-white text-xs truncate font-serif">{other.name}</span>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-[10px] text-stone-500">
                                    {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  {(Number(conv.unread_count) || 0) > 0 && (
                                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                                      {(Number(conv.unread_count) || 0) > 99 ? '99+' : conv.unread_count}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <p className="text-[11px] text-stone-400 truncate mt-0.5">
                                {conv.last_message?.content || 'Matched! Say hello...'}
                              </p>
                            </div>
                          </button>
                        );
                      })
                    )
                  ) : (
                    callHistory.length === 0 ? (
                      <div className="p-8 text-center text-stone-500 text-xs space-y-2">
                        <PhoneCall className="w-8 h-8 text-stone-700 mx-auto" />
                        <p className="font-semibold text-stone-400">No Call History</p>
                        <p className="text-[11px] text-stone-500">Start a voice or video call directly from any chat!</p>
                      </div>
                    ) : (
                      callHistory.map((c) => {
                        const isCaller = c.caller_id === currentUser?.id;
                        const otherProf = isCaller ? c.receiver_profile : c.caller_profile;
                        const isVideo = c.type === 'video';

                        return (
                          <div
                            key={c.id}
                            className="p-3 rounded-2xl bg-stone-900 hover:bg-stone-800/70 border border-stone-800/80 flex items-center justify-between gap-3 transition"
                          >
                            <div
                              onClick={() => {
                                if (otherProf) {
                                  handleStartChat(otherProf);
                                }
                              }}
                              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                            >
                              <div className="relative shrink-0">
                                <img
                                  src={otherProf?.photos?.[0] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1000&q=80'}
                                  alt={otherProf?.name || 'Member'}
                                  className="w-10 h-10 rounded-full object-cover border border-stone-700"
                                  referrerPolicy="no-referrer"
                                />
                                <span className={`absolute bottom-0 right-0 p-0.5 rounded-full ${isVideo ? 'bg-rose-500' : 'bg-emerald-500'} text-white`}>
                                  {isVideo ? <Video className="w-2.5 h-2.5" /> : <Phone className="w-2.5 h-2.5" />}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-bold text-white text-xs truncate">{otherProf?.name || 'Member'}</div>
                                <div className="text-[10px] text-stone-400 truncate">
                                  {new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} • {c.duration ? `${Math.floor(c.duration / 60)}m ${c.duration % 60}s` : (isVideo ? 'Video' : 'Voice')}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleStartCall(otherProf?.user_id || otherProf?.id || '', isVideo ? 'video' : 'voice')}
                                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-emerald-400 transition active:scale-95"
                                title="Redial"
                              >
                                {isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )
                  )}
                </div>
              </div>

              {/* Active Conversation Thread */}
              <div className={`md:col-span-2 h-full ${!activeConversationId ? 'hidden md:flex' : 'flex'}`}>
                {activeConversation ? (
                  <ChatWindow
                    key={activeConversation.id}
                    conversation={activeConversation}
                    currentUser={currentUser}
                    onBack={() => {
                      setActiveConversationId(null);
                      setOpeningChat(null);
                      openingChatRef.current = null;
                      setChatOpenError(null);
                    }}
                    onInitiateCall={(id, type) => handleStartCall(id, type)}
                    onViewProfile={(p) => {
                      setInspectProfile(p);
                      setIsProfileViewOpen(true);
                    }}
                    onReportUser={(p) => {
                      setReportTargetProfile(p);
                      setIsReportOpen(true);
                    }}
                    onUnmatch={(matchId) => {
                      api.unmatch(matchId).then(() => {
                        api.getConversations().then((c) => setConversations(c.conversations));
                        api.getMatches().then((m) => setMatches(m.matches));
                        setActiveConversationId(null);
                      });
                    }}
                  />
                ) : openingChat ? (
                  <div className="flex-1 bg-stone-900/40 rounded-3xl border border-stone-800 flex flex-col items-center justify-center text-center p-8 text-stone-300 space-y-3">
                    {chatOpenError ? (
                      <>
                        <MessageCircle className="w-10 h-10 text-rose-400" />
                        <h3 className="font-bold text-white text-sm">Could not open this chat</h3>
                        <p className="text-xs text-stone-400 max-w-sm">{chatOpenError}</p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleStartChat(openingChat.profile || openingChat.targetId)}
                            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold"
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpeningChat(null);
                              setChatOpenError(null);
                              setActiveConversationId(null);
                            }}
                            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
                          >
                            Back to chats
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-8 h-8 text-rose-400 animate-spin" />
                        <h3 className="font-bold text-white text-sm">Opening conversation...</h3>
                        <p className="text-xs text-stone-500">Your profile and messages are still available while the chat connects.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex-1 bg-stone-900/40 rounded-3xl border border-stone-800 flex flex-col items-center justify-center text-center p-8 text-stone-500 space-y-2">
                    <MessageCircle className="w-12 h-12 text-stone-700" />
                    <h3 className="font-bold text-stone-300 text-sm">Select a Conversation</h3>
                    <p className="text-xs text-stone-500 max-w-xs">
                      Choose a match from the left to start sending messages and initiating voice/video calls.
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. PROFILE TAB (Facebook-Style Profile & Settings Hub) */}
          {/* ========================================================================= */}
          {activeTab === 'profile' && (
            currentUser ? (
              isViewingFullProfile ? (
                <PublicProfileView
                  profileIdOrUserId={currentUser.id || currentProfile?.user_id || currentProfile?.id || ''}
                  profileId={currentUser.id || currentProfile?.user_id || currentProfile?.id || ''}
                  currentUserId={currentUser.id || currentProfile?.user_id || currentProfile?.id || ''}
                  currentUser={currentUser}
                  currentUserProfile={currentProfile}
                  isOwnProfile={true}
                  onBack={() => setIsViewingFullProfile(false)}
                  onEditProfile={() => setIsProfileEditOpen(true)}
                  onManagePlan={() => setIsSubscriptionOpen(true)}
                  onBoostProfile={() => setIsBoostOpen(true)}
                  onStartChat={handleStartChat}
                  onStartCall={handleStartCall}
                />
              ) : (
                <ProfileSettingsHub
                  key={`profile-hub-${profileSection || 'main'}-${profileSectionNonce}`}
                  currentUser={currentUser}
                  currentProfile={currentProfile}
                  onViewProfile={() => setIsViewingFullProfile(true)}
                  onEditProfile={() => setIsProfileEditOpen(true)}
                  onOpenSubscription={() => setIsSubscriptionOpen(true)}
                  onOpenBoost={() => setIsBoostOpen(true)}
                  onLogout={handleLogout}
                  onUpdateProfile={handleUpdateProfileData}
                  initialSection={profileSection ? `${profileSection}#${profileSectionNonce}` : null}
                />
              )
            ) : (
              <div className="max-w-md mx-auto my-16 p-8 rounded-3xl bg-stone-900/90 border border-stone-800 text-center space-y-5 shadow-2xl">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-inner">
                  <UserIcon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white font-serif mb-1">Sign in to view your profile</h3>
                  <p className="text-xs text-stone-400 leading-relaxed">
                    Create or log into your account to customize your profile, view followers, update photos, and manage preferences.
                  </p>
                </div>
                <button
                  id="btn-login-profile-tab"
                  onClick={() => setIsAuthOpen(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-900/40 transition cursor-pointer"
                >
                  Sign In / Register
                </button>
              </div>
            )
          )}

          {/* ========================================================================= */}
          {/* 6. ADMIN VIEW TAB */}
          {/* ========================================================================= */}
          {activeTab === 'admin' && currentUser?.role === 'ADMIN' && (
            <AdminView />
          )}

        </main>
      </div>

      {/* ========================================================================= */}
      {/* GLOBAL MODALS */}
      {/* ========================================================================= */}
      
      {/* 1. Filters Modal */}
      <FiltersModal
        isOpen={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
      />

      {/* 2. Match Celebration Modal */}
      <MatchModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        currentUserProfile={currentProfile}
        matchedProfile={matchedProfileData}
        onStartChat={(convId) => {
          if (convId) {
            setActiveConversationId(convId);
          }
          setActiveTab('messages');
        }}
      />

      {/* 3. Detailed Profile Inspection Modal */}
      <ProfileViewModal
        profile={inspectProfile}
        isOpen={isProfileViewOpen}
        onClose={() => setIsProfileViewOpen(false)}
        onLike={handleLike}
        onReport={(p) => {
          setReportTargetProfile(p);
          setIsReportOpen(true);
        }}
        onStartChat={handleStartChat}
        onStartCall={handleStartCall}
        onViewFacebookProfile={(p) => handleOpenPublicProfile(p)}
      />

      {/* 4. Profile Editor Modal */}
      <ProfileEditModal
        profile={currentProfile}
        isOpen={isProfileEditOpen}
        onClose={() => setIsProfileEditOpen(false)}
        onProfileUpdated={(updated) => {
          setCurrentProfile(updated);
          api.getDiscoverProfiles(filters).then((r) => setDiscoverProfiles(r.profiles));
        }}
      />

      {/* 5. Subscription Plan Upgrade Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        user={currentUser}
        onSubscriptionUpdated={(upd) => setCurrentUser(upd)}
      />

      {/* 6. Profile Boost Modal */}
      <BoostModal
        isOpen={isBoostOpen}
        onClose={() => setIsBoostOpen(false)}
        profile={currentProfile}
        onBoostApplied={(upd) => setCurrentProfile(upd)}
      />

      {/* 7. Trust & Safety Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        targetProfile={reportTargetProfile}
      />

      {/* 8. Partner Syndication Disclosure Modal */}
      <PartnerDisclosureModal
        isOpen={isPartnerDisclosureOpen}
        onClose={() => setIsPartnerDisclosureOpen(false)}
      />

      {/* 9. Legal & Safety Guidelines Modal */}
      <LegalModal
        isOpen={isLegalOpen}
        initialTab={legalInitialTab}
        onClose={() => setIsLegalOpen(false)}
      />

      {/* 10. Age Gate Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={(usr, prf) => {
          setCurrentUser(usr);
          setCurrentProfile(prf);
          loadInitialData();
        }}
      />

      {/* 11. Incoming Call Ringing Alert Modal */}
      {incomingCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
        />
      )}

      {/* 12. Fullscreen WebRTC Voice / Video Call Overlay */}
      {activeCall && (
        <CallOverlay
          call={activeCall}
          currentUser={currentUser}
          currentUserProfile={currentProfile}
          onEndCall={handleEndActiveCall}
        />
      )}

      {/* 13. Registered Members Search Modal */}
      <UserSearchModal
        isOpen={isUserSearchOpen}
        onClose={() => setIsUserSearchOpen(false)}
        currentUserId={currentUser?.id || currentProfile?.user_id}
        onSelectUser={(user) => {
          handleOpenPublicProfile(user);
        }}
      />

      {isNotificationsOpen && (
        <div id="mobile-notifications-overlay" className="fixed inset-0 z-50 overflow-hidden">
          <button
            type="button"
            aria-label="Close notifications"
            onClick={() => setIsNotificationsOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="fixed top-0 right-0 bottom-0 h-[100dvh] w-[min(22rem,calc(100vw-3rem))] max-w-[calc(100vw-3rem)] overflow-y-auto overscroll-contain bg-stone-950 border-l border-stone-800 shadow-2xl flex flex-col safe-area-pt"
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-stone-800">
              <span className="text-sm font-bold text-white">Notifications</span>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(false)}
                className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NotificationsPanel
                notifications={notifications}
                unreadNotificationsCount={notifications.filter((n) => !n.is_read).length}
                onSelectNotificationProfile={(pid) => {
                  setSelectedPublicUserId(pid);
                  setIsNotificationsOpen(false);
                }}
                onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
                onItemClick={() => setIsNotificationsOpen(false)}
                compact
              />
            </div>
          </aside>
        </div>
      )}

      {/* 14. Facebook-Style Public Profile Modal (When viewing another member) */}
      {selectedPublicUserId && (
        <div id="public-profile-viewer-modal" className="fixed inset-0 z-50 overflow-y-auto bg-black/90 backdrop-blur-md p-0 sm:p-4 md:p-6 flex justify-center items-start safe-area-pt safe-area-pb">
          <div className="w-full max-w-5xl relative my-0 sm:my-4">
            <button
              onClick={handleClosePublicProfile}
              className="fixed top-3 right-3 sm:top-4 sm:right-4 z-50 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full bg-black/80 hover:bg-black text-white text-xs font-bold border border-white/20 shadow-2xl flex items-center gap-1.5 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Close Profile</span>
            </button>
            <PublicProfileView
              profileIdOrUserId={selectedPublicUserId}
              profileId={selectedPublicUserId}
              initialProfile={selectedPublicProfile}
              currentUser={currentUser}
              currentUserProfile={currentProfile}
              currentUserId={currentUser?.id || currentProfile?.user_id}
              isOwnProfile={selectedPublicUserId === currentUser?.id || selectedPublicUserId === currentProfile?.user_id}
              onBack={handleClosePublicProfile}
              onNavigateProfile={(target) => {
                handleOpenPublicProfile(target);
              }}
              onStartChat={(otherId) => {
                handleClosePublicProfile();
                handleStartChat(otherId);
              }}
              onStartCall={(otherId, type) => {
                handleClosePublicProfile();
                handleStartCall(otherId, type);
              }}
              onEditProfile={() => {
                handleClosePublicProfile();
                setIsProfileEditOpen(true);
              }}
              onManagePlan={() => {
                handleClosePublicProfile();
                setIsSubscriptionOpen(true);
              }}
              onBoostProfile={() => {
                handleClosePublicProfile();
                setIsBoostOpen(true);
              }}
            />
          </div>
        </div>
      )}

    </div>
  );
}

export function App() {
  return (
    <LanguageProvider>
      <MainApp />
    </LanguageProvider>
  );
}

export default App;
