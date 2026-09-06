// API Service Layer with Token-Based Session Storage
import { Profile, User, Match, Conversation, Message, Call, ExternalProvider, ExternalSyncLog, Report, AdminAnalytics, DiscoveryFilters } from '../types';
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
  if (path.startsWith('/api/')) {
    return '/server-api/' + path.substring(5);
  }
  if (path === '/api') {
    return '/server-api';
  }
  return path;
}

async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(init?.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
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

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; mailSent?: boolean; devCode?: string; resetToken?: string }> {
    const res = await authFetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return safeJson<{ success: boolean; message: string; mailSent?: boolean; devCode?: string; resetToken?: string }>(res, 'Failed to send password reset code.');
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
  async checkoutSubscription(tier: 'PREMIUM' | 'VIP'): Promise<{ success: boolean; user: User; message: string }> {
    const res = await authFetch('/api/subscriptions/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
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
};
