// API Service Layer with Token-Based Session Storage
import { Capacitor } from '@capacitor/core';
import {
  Profile,
  User,
  Match,
  Conversation,
  Message,
  Call,
  ExternalProvider,
  ExternalSyncLog,
  Report,
  AdminAnalytics,
  DiscoveryFilters,
  SubscriptionPlan,
  PaymentTransaction,
  PaymentSummaryStats,
  NowPaymentsSettings,
  AdminMember,
  AdminPermission,
  BoostPackage,
  LegalDocument,
} from '../types';
import { safeStorage } from '../utils/storage';
import { FALLBACK_PROFILES } from '../data/fallbackProfiles';

const TOKEN_KEY = 'globalmatch_auth_token';

export function getStoredToken(): string | null {
  return safeStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string) {
  safeStorage.setItem(TOKEN_KEY, token);
}

export function removeStoredToken() {
  safeStorage.removeItem(TOKEN_KEY);
}

export function getApiBaseUrl(): string {
  // If explicitly configured via environment variable, prefer it
  const metaEnv = (import.meta as any)?.env;
  if (metaEnv?.VITE_API_BASE_URL) {
    return (metaEnv.VITE_API_BASE_URL as string).replace(/\/$/, '');
  }

  // Detect if running inside Capacitor Android app or mobile native container
  if (typeof window !== 'undefined') {
    const isNative = Capacitor.isNativePlatform();
    const isLocalhostOrCapacitor = 
      window.location.protocol === 'capacitor:' || 
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1';
    
    // In Capacitor Android webview, the origin is capacitor://localhost or https://localhost
    // If not running in local Vite container dev server (port 3000), target the live cPanel backend
    if (isNative || (isLocalhostOrCapacitor && window.location.port !== '3000')) {
      return 'https://lovemeetly.com';
    }
  }

  return '';
}

export async function safeJson<T = any>(res: Response, fallbackErrMsg = 'Request failed'): Promise<T> {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (res.status === 404) {
      throw new Error('Backend API not found (404). Please ensure the Node.js app is started in cPanel.');
    }
    if (res.status === 502 || res.status === 503) {
      throw new Error('Backend server is temporarily unreachable (502/503). Please check your Node.js application.');
    }
    const text = await res.text().catch(() => '');
    throw new Error(text ? `Server error (${res.status}): ${text.slice(0, 80)}` : fallbackErrMsg);
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid JSON received from server.');
  }

  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackErrMsg);
  }

  return data;
}

export function resolveApiUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  let endpoint = path;
  if (endpoint.startsWith('/api/')) {
    endpoint = '/server-api/' + endpoint.substring(5);
  } else if (endpoint === '/api') {
    endpoint = '/server-api';
  }

  const baseUrl = getApiBaseUrl();
  if (baseUrl) {
    return `${baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }
  return endpoint;
}

async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  let token = getStoredToken();
  const headers = new Headers(init?.headers || {});

  // Check if there is an active admin session saved
  const adminSession = safeStorage.getItem('dating_admin_session');
  if (adminSession) {
    try {
      const parsed = JSON.parse(adminSession);
      if (parsed?.token && !token) {
        token = parsed.token;
        setStoredToken(parsed.token);
      }
    } catch (e) {}
    // Provide backup admin identification header for robust access
    headers.set('x-admin-key', 'tanvir2026');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('x-session-token', token);
  }

  // Primary URL is /server-api to bypass LiteSpeed /api interception
  const primaryUrl = resolveApiUrl(input);
  try {
    const res = await fetch(primaryUrl, {
      ...init,
      headers,
    });

    // If LiteSpeed gave a 502/503 HTML or 404 on /server-api, fallback to original url if different
    if ((res.status === 502 || res.status === 503 || res.status === 404) && primaryUrl !== input) {
      const fallbackRes = await fetch(input, { ...init, headers }).catch(() => null);
      if (fallbackRes && (fallbackRes.ok || fallbackRes.status === 400 || fallbackRes.status === 401)) {
        return fallbackRes;
      }
    }
    return res;
  } catch (err) {
    if (primaryUrl !== input) {
      const fallbackRes = await fetch(input, { ...init, headers }).catch(() => null);
      if (fallbackRes) return fallbackRes;
    }
    throw err;
  }
}

export const api = {
  // Auth & Profile
  async getMe(): Promise<{ user: User | null; profile: Profile | null }> {
    const token = getStoredToken();
    if (!token) {
      return { user: null, profile: null };
    }
    try {
      const res = await authFetch('/api/auth/me');
      if (!res.ok) return { user: null, profile: null };
      return res.json();
    } catch {
      return { user: null, profile: null };
    }
  },

  // Facebook-Style Public Profile & Follow System
  async getPublicProfile(id?: string): Promise<{ profile: Profile }> {
    const targetId = (!id || id === 'undefined' || id === 'null') ? 'me' : id;
    const res = await authFetch(`/api/public-profiles/${targetId}`);
    const contentType = res.headers.get('content-type') || '';

    if (!res.ok) {
      let errMsg = 'Profile not found';
      if (contentType.includes('application/json')) {
        const err = await res.json().catch(() => ({}));
        errMsg = err.error || errMsg;
      }
      throw new Error(errMsg);
    }

    if (!contentType.includes('application/json')) {
      throw new Error('Profile is temporarily unavailable');
    }

    const data = await res.json();
    if (!data || !data.profile) {
      throw new Error('Profile data not found');
    }
    return data;
  },

  async followUser(userId: string): Promise<{ success: boolean; isFollowing: boolean; followersCount: number; followingCount: number }> {
    const res = await authFetch(`/api/users/${userId}/follow`, { method: 'POST' });
    return safeJson(res, 'Failed to follow user');
  },

  async unfollowUser(userId: string): Promise<{ success: boolean; isFollowing: boolean; followersCount: number; followingCount: number }> {
    const res = await authFetch(`/api/users/${userId}/unfollow`, { method: 'POST' });
    return safeJson(res, 'Failed to unfollow user');
  },

  async getFollowers(userId: string): Promise<{ followers: Array<{ followId: string; followedAt: string; userId: string; email: string; profile: Profile; isFollowing: boolean }> }> {
    const res = await authFetch(`/api/users/${userId}/followers`);
    return safeJson(res, 'Failed to fetch followers list');
  },

  async getFollowing(userId: string): Promise<{ following: Array<{ followId: string; followedAt: string; userId: string; email: string; profile: Profile; isFollowing: boolean }> }> {
    const res = await authFetch(`/api/users/${userId}/following`);
    return safeJson(res, 'Failed to fetch following list');
  },

  async blockUser(userId: string, reason?: string): Promise<{ success: boolean; isBlocked: boolean }> {
    const res = await authFetch(`/api/users/${userId}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return safeJson(res, 'Failed to block user');
  },

  async unblockUser(userId: string): Promise<{ success: boolean; isBlocked: boolean }> {
    const res = await authFetch(`/api/users/${userId}/unblock`, { method: 'POST' });
    return safeJson(res, 'Failed to unblock user');
  },

  async getBlockedUsers(): Promise<{ blockedUsers: Array<{ id: string; blockedId: string; reason: string; createdAt: string; name: string; photo: string; city: string; country: string }> }> {
    const res = await authFetch('/api/users/blocked');
    if (!res.ok) return { blockedUsers: [] };
    return res.json();
  },

  async searchRealUsers(query: string): Promise<{ users: Profile[] }> {
    const res = await authFetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return { users: [] };
    return res.json();
  },

  async getNotifications(): Promise<{ notifications: Array<{ id: string; user_id: string; type: string; title: string; message: string; data?: any; is_read: boolean; created_at: string }> }> {
    const res = await authFetch('/api/notifications');
    if (!res.ok) return { notifications: [] };
    return res.json();
  },

  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/notifications/${id}/read`, { method: 'POST' });
    return res.json();
  },

  async markAllNotificationsRead(): Promise<{ success: boolean }> {
    const res = await authFetch('/api/notifications/read-all', { method: 'POST' });
    return res.json();
  },

  async login(email: string, password?: string, role?: string): Promise<{ success: boolean; user: User; profile: Profile; token?: string }> {
    const res = await authFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    const data = await safeJson<{ success: boolean; user: User; profile: Profile; token?: string }>(res, 'Login failed. Please check your email and password.');
    if (data.token) {
      setStoredToken(data.token);
    }
    return data;
  },

  async register(params: { email: string; password?: string; name: string; dob: string; gender: string }): Promise<{ success: boolean; message: string; registeredEmail?: string; userId?: string; profileId?: string }> {
    const res = await authFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return safeJson<{ success: boolean; message: string; registeredEmail?: string; userId?: string; profileId?: string }>(res, 'Registration failed. Please check your details.');
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const res = await authFetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return safeJson<{ success: boolean; message: string }>(res, 'Failed to send password reset code.');
  },

  async verifyResetCode(email: string, code: string): Promise<{ success: boolean; resetToken: string }> {
    const res = await authFetch('/api/auth/verify-reset-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    });
    return safeJson<{ success: boolean; resetToken: string }>(res, 'Invalid verification code.');
  },

  async resetPassword(params: { email: string; code?: string; resetToken?: string; newPassword: string }): Promise<{ success: boolean; message: string }> {
    const res = await authFetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return safeJson<{ success: boolean; message: string }>(res, 'Failed to update password.');
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const res = await authFetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return safeJson<{ success: boolean; message: string }>(res, 'Failed to change password.');
  },

  async getSessions(): Promise<{ sessions: Array<{ id: string; device: string; lastActive: string; isCurrent: boolean }> }> {
    const res = await authFetch('/api/auth/sessions');
    if (!res.ok) return { sessions: [] };
    return res.json();
  },

  async logout(): Promise<{ success: boolean }> {
    try {
      await authFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      removeStoredToken();
    }
    return { success: true };
  },

  async updateProfile(data: Partial<Profile>): Promise<{ profile: Profile }> {
    const res = await authFetch('/api/profiles/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // Discovery
  async getDiscoverProfiles(filters?: Partial<DiscoveryFilters>): Promise<{ profiles: Profile[] }> {
    try {
      const params = new URLSearchParams();
      if (filters?.minAge) params.append('minAge', String(filters.minAge));
      if (filters?.maxAge) params.append('maxAge', String(filters.maxAge));
      if (filters?.gender) params.append('gender', filters.gender);
      if (filters?.country) params.append('country', filters.country);
      if (filters?.profileSource) params.append('source', filters.profileSource);
      if (filters?.onlineOnly) params.append('onlineOnly', String(filters.onlineOnly));

      const res = await authFetch(`/api/discover?${params.toString()}`);
      if (!res.ok) {
        console.warn('[API Discover] Received non-OK status, falling back to local profiles');
        return { profiles: FALLBACK_PROFILES };
      }
      const data = await res.json();
      if (!data || !Array.isArray(data.profiles) || data.profiles.length === 0) {
        return { profiles: FALLBACK_PROFILES };
      }
      return data;
    } catch (err) {
      console.warn('[API Discover] Request failed, using fallback profiles:', err);
      return { profiles: FALLBACK_PROFILES };
    }
  },

  // Likes & Matches
  async sendLike(receiverId: string, isSuperLike = false): Promise<{ success: boolean; is_match: boolean; match_data?: any }> {
    const res = await authFetch('/api/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId, is_super_like: isSuperLike }),
    });
    return res.json();
  },

  async getMatches(): Promise<{ matches: Match[] }> {
    try {
      const res = await authFetch('/api/matches');
      if (!res.ok) return { matches: [] };
      return res.json();
    } catch {
      return { matches: [] };
    }
  },

  async unmatch(matchId: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/matches/${matchId}`, { method: 'DELETE' });
    return res.json();
  },

  // Chat
  async getConversations(): Promise<{ conversations: Conversation[] }> {
    try {
      const res = await authFetch('/api/conversations');
      if (!res.ok) return { conversations: [] };
      return res.json();
    } catch {
      return { conversations: [] };
    }
  },

  async createOrGetConversation(targetUserId: string): Promise<{ conversation: Conversation }> {
    const res = await authFetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: targetUserId }),
    });
    return res.json();
  },

  async markConversationAsRead(conversationId: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/conversations/${conversationId}/read`, {
      method: 'POST',
    });
    return res.json();
  },

  async getMessages(conversationId: string): Promise<{ messages: Message[] }> {
    const res = await authFetch(`/api/conversations/${conversationId}/messages`);
    return res.json();
  },

  async uploadAttachment(data: { data: string; filename: string; mimeType: string; size: number }): Promise<{ success: boolean; file: { id?: string; url: string; filename: string; size: number; mimeType: string; messageType: string } }> {
    const res = await authFetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async sendMessage(data: {
    conversation_id: string;
    receiver_id?: string;
    content: string;
    attachment_url?: string;
    attachment?: any;
    file_name?: string;
    file_size?: number;
    message_type?: string;
  }): Promise<{ message: Message }> {
    const res = await authFetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // AI Service
  async generateBio(data: { interests: string[]; profession?: string; style?: string; relationshipGoal?: string }): Promise<{ bio: string }> {
    const res = await authFetch('/api/ai/bio-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async translateText(text: string, targetLang: string): Promise<{ translatedText: string; targetLang: string }> {
    const res = await authFetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang }),
    });
    return res.json();
  },

  // Calls
  async initiateCall(receiverId: string, type: 'voice' | 'video'): Promise<{ call: Call }> {
    const res = await authFetch('/api/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId, type }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to start call');
    }
    return res.json();
  },

  async acceptCall(callId: string): Promise<{ call: Call }> {
    const res = await authFetch(`/api/calls/${callId}/accept`, { method: 'POST' });
    return res.json();
  },

  async rejectCall(callId: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/calls/${callId}/reject`, { method: 'POST' });
    return res.json();
  },

  async endCall(callId: string): Promise<{ success: boolean; duration?: number }> {
    const res = await authFetch(`/api/calls/${callId}/end`, { method: 'POST' });
    return res.json();
  },

  async getCallHistory(): Promise<{ calls: Call[] }> {
    try {
      const res = await authFetch('/api/calls/history');
      if (!res.ok) return { calls: [] };
      return res.json();
    } catch {
      return { calls: [] };
    }
  },

  // Subscriptions & Boosts
  async getSubscriptionPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    try {
      const res = await fetch('/api/subscriptions/plans');
      if (!res.ok) return { plans: [] };
      return res.json();
    } catch {
      return { plans: [] };
    }
  },

  async getMySubscriptionStatus(): Promise<{
    user: User;
    tier: string;
    expiresAt: string | null;
    daysRemaining: number;
    activeSubscription: any;
    paymentHistory: PaymentTransaction[];
  }> {
    const res = await authFetch('/api/subscriptions/my-status');
    return res.json();
  },

  async subscribeFree(planId: string): Promise<{ success: boolean; message: string; user: User; expiresAt: string }> {
    const res = await authFetch('/api/subscriptions/subscribe-free', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to activate free subscription');
    return data;
  },

  async createPaymentInvoice(planId: string): Promise<{
    success: boolean;
    orderId: string;
    invoiceUrl: string;
    invoiceId?: string;
    amount: number;
    currency: string;
    planName: string;
  }> {
    const res = await authFetch('/api/payments/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Payment initialization failed');
    return data;
  },

  async checkPaymentStatus(orderId: string): Promise<{
    orderId: string;
    paymentStatus: string;
    isCompleted: boolean;
    amount: number;
    currency: string;
    planName: string;
    user?: User;
  }> {
    const res = await authFetch(`/api/payments/check-status/${orderId}`);
    return res.json();
  },

  async checkoutSubscription(tier: 'PREMIUM' | 'VIP'): Promise<{ success: boolean; user: User; message: string }> {
    const res = await authFetch('/api/subscriptions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    return res.json();
  },

  async getBoostPackages(): Promise<{ success: boolean; packages: BoostPackage[] }> {
    const res = await authFetch('/api/boosts/packages');
    return res.json();
  },

  async createBoostInvoice(packageId: string): Promise<{
    success: boolean;
    orderId: string;
    invoiceUrl: string;
    invoiceId: string;
    amount: number;
    currency: string;
    packageName: string;
    error?: string;
  }> {
    const res = await authFetch('/api/boosts/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId }),
    });
    return res.json();
  },

  async completeBoostPayment(packageId: string, orderId?: string): Promise<{
    success: boolean;
    profile: Profile;
    boostExpiresAt: string;
    orderId?: string;
    packageName?: string;
    error?: string;
  }> {
    const res = await authFetch('/api/boosts/complete-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packageId, orderId }),
    });
    return res.json();
  },

  async purchaseBoost(durationMinutes: number): Promise<{ success: boolean; profile: Profile; boostExpiresAt: string }> {
    const res = await authFetch('/api/boosts/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationMinutes }),
    });
    return res.json();
  },

  // Safety & Reports
  async submitReport(data: { reported_user_id: string; reported_user_name: string; category: string; reason: string }): Promise<{ success: boolean }> {
    const res = await authFetch('/api/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  // External Providers
  async getProviders(): Promise<{ providers: ExternalProvider[] }> {
    const res = await authFetch('/api/external/providers');
    return res.json();
  },

  async addProvider(data: Partial<ExternalProvider>): Promise<{ provider: ExternalProvider }> {
    const res = await authFetch('/api/external/providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async syncProvider(providerId: string): Promise<{ success: boolean; log: ExternalSyncLog }> {
    const res = await authFetch(`/api/external/providers/${providerId}/sync`, { method: 'POST' });
    return res.json();
  },

  async getSyncLogs(): Promise<{ logs: ExternalSyncLog[] }> {
    const res = await authFetch('/api/external/sync-logs');
    return res.json();
  },

  async trackPartnerClick(): Promise<void> {
    authFetch('/api/external/track-click', { method: 'POST' }).catch(() => {});
  },

  // Admin
  async getAdminAnalytics(): Promise<AdminAnalytics> {
    const res = await authFetch('/api/admin/analytics');
    return res.json();
  },

  async getModerationQueue(): Promise<{ reports: Report[] }> {
    const res = await authFetch('/api/admin/moderation');
    return res.json();
  },

  async takeModerationAction(reportId: string, action: string, notes?: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/admin/moderation/${reportId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, notes }),
    });
    return res.json();
  },

  // Admin: Subscription Plans CRUD
  async adminGetPlans(): Promise<{ plans: SubscriptionPlan[] }> {
    const res = await authFetch('/api/admin/subscriptions/plans');
    return res.json();
  },

  async adminCreatePlan(data: Partial<SubscriptionPlan>): Promise<{ success: boolean; plan: SubscriptionPlan }> {
    const res = await authFetch('/api/admin/subscriptions/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create plan');
    return result;
  },

  async adminUpdatePlan(id: string, data: Partial<SubscriptionPlan>): Promise<{ success: boolean; plan: SubscriptionPlan }> {
    const res = await authFetch(`/api/admin/subscriptions/plans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update plan');
    return result;
  },

  async adminDeletePlan(id: string): Promise<{ success: boolean }> {
    const res = await authFetch(`/api/admin/subscriptions/plans/${id}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete plan');
    return result;
  },

  // Admin: Payments List & Stats
  async adminGetPayments(params?: { search?: string; status?: string; limit?: number }): Promise<{
    transactions: PaymentTransaction[];
    stats: PaymentSummaryStats;
  }> {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.limit) q.set('limit', String(params.limit));
    const res = await authFetch(`/api/admin/payments?${q.toString()}`);
    return res.json();
  },

  // Admin: NOWPayments Settings
  async adminGetPaymentSettings(): Promise<NowPaymentsSettings> {
    const res = await authFetch('/api/admin/payments/settings');
    return res.json();
  },

  async adminSavePaymentSettings(data: {
    apiKey?: string;
    ipnSecret?: string;
    isSandbox?: boolean;
    isEnabled?: boolean;
    payoutCurrency?: string;
  }): Promise<{ success: boolean; message: string }> {
    const res = await authFetch('/api/admin/payments/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to save payment settings');
    return result;
  },

  // Admin: User Subscription Controls
  async adminManageUserSubscription(
    userId: string,
    data: {
      action: 'activate' | 'extend' | 'cancel';
      tier?: string;
      duration?: number;
      durationUnit?: string;
      customExpiresAt?: string;
    }
  ): Promise<{ success: boolean; message: string; user: User }> {
    const res = await authFetch(`/api/admin/users/${userId}/subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Subscription action failed');
    return result;
  },

  async adminGetUserSubscriptionHistory(userId: string): Promise<{
    user: User;
    subscriptions: any[];
    payments: PaymentTransaction[];
  }> {
    const res = await authFetch(`/api/admin/users/${userId}/subscription-history`);
    return res.json();
  },

  // Admin Privilege Verification & Claim
  async verifyAdminAccess(): Promise<{ success: boolean; user?: User; message?: string }> {
    const res = await authFetch('/api/admin/verify-access');
    return res.json();
  },

  async claimSuperAdmin(key: string = 'tanvir2026', email?: string): Promise<{ success: boolean; user?: User; message?: string }> {
    const res = await authFetch('/api/admin/claim-superadmin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, email }),
    });
    return res.json();
  },

  // Admin & Sub-Admin Role Management
  async getMyPermissions(): Promise<{ success: boolean; role: string; permissions: AdminPermission[]; isSuperAdmin: boolean }> {
    const res = await authFetch('/api/admin/my-permissions');
    return res.json();
  },

  async adminGetMembers(): Promise<{ success: boolean; members: AdminMember[] }> {
    const res = await authFetch('/api/admin/members');
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to fetch admin members');
    return result;
  },

  async adminCreateMember(data: {
    name: string;
    email: string;
    role: string;
    permissions: AdminPermission[];
    password?: string;
    notes?: string;
  }): Promise<{ success: boolean; member: AdminMember; message?: string }> {
    const res = await authFetch('/api/admin/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to add administrator');
    return result;
  },

  async adminUpdateMember(
    id: string,
    data: {
      name?: string;
      role?: string;
      permissions?: AdminPermission[];
      isActive?: boolean;
      notes?: string;
      password?: string;
    }
  ): Promise<{ success: boolean; member: AdminMember; message?: string }> {
    const res = await authFetch(`/api/admin/members/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update administrator');
    return result;
  },

  async adminDeleteMember(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await authFetch(`/api/admin/members/${id}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to remove administrator');
    return result;
  },

  // Legal Documents (Public & Admin)
  async getLegalDocuments(): Promise<{ success: boolean; documents: LegalDocument[]; map?: Record<string, LegalDocument> }> {
    const res = await authFetch('/api/legal/documents');
    return res.json();
  },

  async getAdminLegalDocuments(): Promise<{ success: boolean; documents: LegalDocument[] }> {
    const res = await authFetch('/api/admin/legal/documents');
    return res.json();
  },

  async adminUpdateLegalDocument(
    id: string,
    data: { title?: string; content: string; version?: string }
  ): Promise<{ success: boolean; document: LegalDocument }> {
    const res = await authFetch(`/api/admin/legal/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update legal document');
    return result;
  },

  // Admin: Boost Packages
  async getAdminBoostPackages(): Promise<{ success: boolean; packages: BoostPackage[] }> {
    const res = await authFetch('/api/admin/boost-packages');
    return res.json();
  },

  async adminCreateBoostPackage(data: Partial<BoostPackage>): Promise<{ success: boolean; package: BoostPackage }> {
    const res = await authFetch('/api/admin/boost-packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create boost package');
    return result;
  },

  async adminUpdateBoostPackage(id: string, data: Partial<BoostPackage>): Promise<{ success: boolean; package: BoostPackage }> {
    const res = await authFetch(`/api/admin/boost-packages/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update boost package');
    return result;
  },

  async adminDeleteBoostPackage(id: string): Promise<{ success: boolean; deletedId: string }> {
    const res = await authFetch(`/api/admin/boost-packages/${id}`, {
      method: 'DELETE',
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to delete boost package');
    return result;
  },
};
