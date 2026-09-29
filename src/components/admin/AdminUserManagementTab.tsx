import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  UserCheck,
  Ban,
  Trash2,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Clock,
  History,
  AlertTriangle,
  Mail,
  Filter,
} from 'lucide-react';
import {
  AdminManagedUser,
  AdminUserListStats,
  AdminUserStatusHistoryEntry,
  AccountStatus,
} from '../../types';
import { api } from '../../services/api';
import { describeSuspensionRemaining } from '../../lib/accountStatus';

interface AdminUserManagementTabProps {
  onSuccessMessage: (msg: string) => void;
  /** Email of the signed-in administrator (used only for display/self-protection). */
  currentAdminEmail?: string;
}

const STATUS_FILTERS: { id: 'all' | AccountStatus; label: string }[] = [
  { id: 'all', label: 'All Members' },
  { id: 'active', label: 'Active' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'blocked', label: 'Blocked' },
];

const SUSPEND_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: '24 hours' },
  { days: 3, label: '3 days' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

const EMPTY_STATS: AdminUserListStats = { total: 0, active: 0, suspended: 0, blocked: 0 };

const STATUS_BADGE: Record<AccountStatus, string> = {
  active: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  suspended: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  blocked: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const STATUS_LABEL: Record<AccountStatus, string> = {
  active: 'Active',
  suspended: 'Suspended',
  blocked: 'Blocked',
};

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Date(parsed).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return '—';
  return new Date(parsed).toLocaleString();
}

/** Remaining time of a temporary suspension, e.g. "expires in 6 days". */
const formatRemaining = describeSuspensionRemaining;
export const AdminUserManagementTab: React.FC<AdminUserManagementTabProps> = ({
  onSuccessMessage,
  currentAdminEmail = '',
}) => {
  const [users, setUsers] = useState<AdminManagedUser[]>([]);
  const [stats, setStats] = useState<AdminUserListStats>(EMPTY_STATS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | AccountStatus>('all');

  // Per-row busy flag so only the acted-on account shows a spinner.
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Suspend modal
  const [suspendTarget, setSuspendTarget] = useState<AdminManagedUser | null>(null);
  const [suspendDays, setSuspendDays] = useState<number>(7);
  const [suspendReason, setSuspendReason] = useState('');

  // Block modal
  const [blockTarget, setBlockTarget] = useState<AdminManagedUser | null>(null);
  const [blockReason, setBlockReason] = useState('');

  // Delete confirmation modal (requires typing the account email)
  const [deleteTarget, setDeleteTarget] = useState<AdminManagedUser | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Action history modal
  const [historyTarget, setHistoryTarget] = useState<AdminManagedUser | null>(null);
  const [historyEntries, setHistoryEntries] = useState<AdminUserStatusHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.adminGetUsers({
        search: searchQuery.trim() || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 500,
      });
      setUsers(Array.isArray(res.users) ? res.users : []);
      setTotal(Number(res.total) || 0);
      setStats(res.stats ? { ...EMPTY_STATS, ...res.stats } : EMPTY_STATS);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load user accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  /** Replaces a single row so the table updates without a full reload. */
  const applyUpdatedUser = (updated?: AdminManagedUser | null) => {
    if (!updated?.id) {
      loadUsers();
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
  };

  const isProtectedRow = (user: AdminManagedUser): boolean =>
    Boolean(user.isAdminAccount) ||
    Boolean(user.isSelf) ||
    Boolean(currentAdminEmail && user.email.toLowerCase() === currentAdminEmail.toLowerCase());

  const protectionTitle = (user: AdminManagedUser): string => {
    if (user.isSelf) return 'You cannot manage your own account';
    if (user.isAdminAccount) return 'Administrator accounts are managed under "Admins & Role Governance"';
    return 'This account is protected';
  };
// -------------------------------------------------------------
  // ADMIN ACTIONS
  // -------------------------------------------------------------
  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;
    const target = suspendTarget;
    setBusyUserId(target.id);
    setErrorMessage('');
    try {
      const res = await api.adminSuspendUser(target.id, {
        days: suspendDays,
        reason: suspendReason.trim() || undefined,
      });
      applyUpdatedUser(res.user);
      setSuspendTarget(null);
      setSuspendReason('');
      setSuspendDays(7);
      onSuccessMessage(res.message || `${target.email} has been suspended.`);
      // The status counters are server-derived, so refresh them once.
      loadUsers();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to suspend the account.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget) return;
    const target = blockTarget;
    setBusyUserId(target.id);
    setErrorMessage('');
    try {
      const res = await api.adminBlockUser(target.id, {
        reason: blockReason.trim() || undefined,
      });
      applyUpdatedUser(res.user);
      setBlockTarget(null);
      setBlockReason('');
      onSuccessMessage(res.message || `${target.email} has been blocked.`);
      loadUsers();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to block the account.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleActivate = async (user: AdminManagedUser) => {
    setBusyUserId(user.id);
    setErrorMessage('');
    try {
      const res = await api.adminActivateUser(user.id, {});
      applyUpdatedUser(res.user);
      onSuccessMessage(res.message || `${user.email} has been reactivated.`);
      loadUsers();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to reactivate the account.');
    } finally {
      setBusyUserId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyUserId(target.id);
    setErrorMessage('');
    try {
      const res = await api.adminDeleteUser(target.id, {
        confirmEmail: deleteConfirmText.trim().toLowerCase(),
      });
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setDeleteTarget(null);
      setDeleteConfirmText('');
      onSuccessMessage(res.message || `${target.email} has been permanently deleted.`);
      loadUsers();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete the account.');
    } finally {
      setBusyUserId(null);
    }
  };

  const openHistory = async (user: AdminManagedUser) => {
    setHistoryTarget(user);
    setHistoryEntries([]);
    setIsLoadingHistory(true);
    try {
      const res = await api.adminGetUserStatusHistory(user.id);
      setHistoryEntries(Array.isArray(res.history) ? res.history : []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to load the account action history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const deleteConfirmationMatches =
    Boolean(deleteTarget) &&
    deleteConfirmText.trim().toLowerCase() === (deleteTarget?.email || '').trim().toLowerCase();

  return (
    <div className="space-y-4 animate-in fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white font-serif">User Management</h2>
          <p className="text-xs text-stone-400">
            Suspend, block, reactivate or permanently delete member accounts. Every action is
            recorded in an audit trail and applied server-side only.
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white border border-stone-700 text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-indigo-400" /> Total Members
          </div>
          <div className="text-xl font-extrabold text-white mt-1">{stats.total.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Active
          </div>
          <div className="text-xl font-extrabold text-emerald-400 mt-1">{stats.active.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Suspended
          </div>
          <div className="text-xl font-extrabold text-amber-400 mt-1">{stats.suspended.toLocaleString()}</div>
        </div>
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400 flex items-center gap-1.5">
            <Ban className="w-3.5 h-3.5 text-rose-400" /> Blocked
          </div>
          <div className="text-xl font-extrabold text-rose-400 mt-1">{stats.blocked.toLocaleString()}</div>
        </div>
      </div>

      {/* Search & status filters */}
      <div className="bg-stone-900 p-4 rounded-2xl border border-stone-800 flex flex-col lg:flex-row items-center justify-between gap-3">
        <form
          className="relative w-full lg:w-80 flex items-center"
          onSubmit={(e) => {
            e.preventDefault();
            loadUsers();
          }}
        >
          <Search className="w-4 h-4 text-rose-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, city, country..."
            className="w-full bg-stone-950 border border-stone-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-rose-500 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-stone-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-stone-500" />
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                statusFilter === filter.id
                  ? 'bg-gradient-to-r from-rose-600 to-indigo-600 text-white border-transparent shadow'
                  : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
              }`}
            >
              {filter.label}
            </button>
          ))}
          <span className="text-[11px] text-stone-500">
            {total.toLocaleString()} account{total === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Error banner */}
      {errorMessage && (
        <div className="p-3 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center justify-between shadow animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button type="button" onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
{/* Accounts table */}
      <div className="overflow-x-auto rounded-2xl border border-stone-800 bg-stone-900 shadow">
        <table className="w-full text-left text-xs text-stone-300">
          <thead className="bg-stone-950 text-stone-400 uppercase tracking-wider text-[10px] border-b border-stone-800">
            <tr>
              <th className="p-3.5">Member</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Tier / Role</th>
              <th className="p-3.5">Location</th>
              <th className="p-3.5">Joined</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800">
            {isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-400">
                  <Loader2 className="w-5 h-5 animate-spin inline-block mr-2 text-rose-400" />
                  Loading member accounts...
                </td>
              </tr>
            )}

            {!isLoading && users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-500">
                  No member accounts match the current search and status filter.
                </td>
              </tr>
            )}

            {users.map((user) => {
              const status = (user.accountStatus || 'active') as AccountStatus;
              const protectedRow = isProtectedRow(user);
              const busy = busyUserId === user.id;
              const photo = user.profile?.photos?.[0];

              return (
                <tr key={user.id} className="hover:bg-stone-800/40 transition">
                  {/* Member identity */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      {photo ? (
                        <img
                          src={photo}
                          alt={user.profile?.name || 'Member'}
                          className="w-9 h-9 rounded-full object-cover border border-stone-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-stone-500" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate">
                          {user.profile?.name || 'Unnamed member'}
                        </div>
                        <div className="text-[11px] text-stone-400 truncate flex items-center gap-1">
                          <Mail className="w-3 h-3 shrink-0" />
                          {user.email}
                        </div>
                        <div className="text-[10px] text-stone-600 font-mono truncate">{user.id}</div>
                      </div>
                    </div>
                  </td>
{/* Status */}
                  <td className="p-3.5 align-top">
                    <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${STATUS_BADGE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    {status === 'suspended' && (
                      <div className="text-[10px] text-amber-400/90 mt-1">
                        {formatRemaining(user.suspendedUntil)}
                      </div>
                    )}
                    {user.statusReason && status !== 'active' && (
                      <div
                        className="text-[10px] text-stone-500 mt-1 max-w-[190px] truncate"
                        title={user.statusReason}
                      >
                        {user.statusReason}
                      </div>
                    )}
                  </td>

                  {/* Tier / Role */}
                  <td className="p-3.5 align-top">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        user.subscriptionTier === 'VIP'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-stone-800 text-stone-400'
                      }`}
                    >
                      {user.subscriptionTier}
                    </span>
                    {user.isAdminAccount && (
                      <div className="text-[10px] text-fuchsia-400 font-bold mt-1">ADMINISTRATOR</div>
                    )}
                    {user.isSelf && <div className="text-[10px] text-sky-400 font-bold mt-1">YOU</div>}
                  </td>

                  {/* Location */}
                  <td className="p-3.5 align-top text-stone-400">
                    {user.profile?.city || user.profile?.country
                      ? `${user.profile?.city || ''}${
                          user.profile?.city && user.profile?.country ? ', ' : ''
                        }${user.profile?.country || ''}`
                      : '—'}
                  </td>

                  {/* Joined */}
                  <td className="p-3.5 align-top text-stone-400">{formatDate(user.createdAt)}</td>
{/* Actions */}
                  <td className="p-3.5 align-top">
                    <div className="flex items-center justify-end gap-1.5 flex-wrap">
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />}

                      {/* Suspend — only for active accounts */}
                      {status === 'active' && (
                        <button
                          type="button"
                          disabled={protectedRow || busy}
                          title={protectedRow ? protectionTitle(user) : 'Temporarily disable this account'}
                          onClick={() => {
                            setSuspendTarget(user);
                            setSuspendDays(7);
                            setSuspendReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Clock className="w-3 h-3" />
                          <span>Suspend</span>
                        </button>
                      )}

                      {/* Block — hidden once the account is already blocked */}
                      {status !== 'blocked' && (
                        <button
                          type="button"
                          disabled={protectedRow || busy}
                          title={protectedRow ? protectionTitle(user) : 'Permanently restrict this account'}
                          onClick={() => {
                            setBlockTarget(user);
                            setBlockReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Ban className="w-3 h-3" />
                          <span>Block</span>
                        </button>
                      )}

                      {/* Reactivate */}
                      {status !== 'active' && (
                        <button
                          type="button"
                          disabled={protectedRow || busy}
                          title={protectedRow ? protectionTitle(user) : 'Restore full access'}
                          onClick={() => handleActivate(user)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <UserCheck className="w-3 h-3" />
                          <span>Reactivate</span>
                        </button>
                      )}

                      {/* Audit history */}
                      <button
                        type="button"
                        disabled={busy}
                        title="View the account action history"
                        onClick={() => openHistory(user)}
                        className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-40"
                      >
                        <History className="w-3 h-3" />
                      </button>

                      {/* Delete — the confirmation modal is always shown first */}
                      <button
                        type="button"
                        disabled={protectedRow || busy}
                        title={protectedRow ? protectionTitle(user) : 'Permanently delete this account'}
                        onClick={() => {
                          setDeleteTarget(user);
                          setDeleteConfirmText('');
                        }}
                        className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-rose-600 text-stone-400 hover:text-white text-[11px] font-semibold transition flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
{/* ------------------------------------------------------------- */}
      {/* MODAL: SUSPEND (temporary lock) */}
      {/* ------------------------------------------------------------- */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
              <Clock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-serif">Suspend this account?</h3>
              <p className="text-xs text-stone-400">
                <span className="font-semibold text-white">{suspendTarget.profile?.name || suspendTarget.email}</span>{' '}
                ({suspendTarget.email}) will be locked out immediately — all active sessions and realtime
                connections are terminated and the account cannot sign in again until the suspension expires or
                is lifted.
              </p>
            </div>

            {/* Duration presets */}
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-stone-300">Suspension duration</label>
              <div className="flex flex-wrap gap-2">
                {SUSPEND_PRESETS.map((preset) => (
                  <button
                    key={preset.days}
                    type="button"
                    onClick={() => setSuspendDays(preset.days)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold border transition ${
                      suspendDays === preset.days
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-stone-950 text-stone-400 border-stone-800 hover:text-stone-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={suspendDays}
                  onChange={(e) => setSuspendDays(Math.max(1, Number(e.target.value) || 1))}
                  className="w-24 bg-stone-950 border border-stone-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <span className="text-[11px] text-stone-400">custom days (1–3650)</span>
              </div>
              <p className="text-[11px] text-amber-400/90 bg-amber-950/40 p-2.5 rounded-xl border border-amber-800/40">
                Will be released automatically on{' '}
                {new Date(Date.now() + suspendDays * 86400000).toUTCString()}
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-stone-300">Reason (optional)</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={2}
                placeholder="e.g. Spam behaviour reported by multiple members"
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-amber-500 placeholder-stone-600 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSuspendTarget(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSuspend}
                disabled={busyUserId === suspendTarget.id}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-60"
              >
                {busyUserId === suspendTarget.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Suspend</span>
              </button>
            </div>
          </div>
        </div>
      )}
{/* ------------------------------------------------------------- */}
      {/* MODAL: BLOCK (permanent restriction) */}
      {/* ------------------------------------------------------------- */}
      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Ban className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-serif">Block this account?</h3>
              <p className="text-xs text-stone-400">
                <span className="font-semibold text-white">{blockTarget.profile?.name || blockTarget.email}</span>{' '}
                ({blockTarget.email}) will lose access immediately. Blocking is a restrictive status: the account
                stays blocked until an administrator explicitly reactivates it.
              </p>
              <p className="text-[11px] text-rose-400/90 mt-2 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/40 text-left">
                ⚠️ All active sessions and realtime connections will be terminated right away. The account data
                itself is preserved, so this action can be reversed with “Reactivate”.
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-stone-300">Reason (optional)</label>
              <textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={2}
                placeholder="e.g. Confirmed scam / fake profile"
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-rose-500 placeholder-stone-600 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                disabled={busyUserId === blockTarget.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-60"
              >
                {busyUserId === blockTarget.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Block</span>
              </button>
            </div>
          </div>
        </div>
      )}
{/* ------------------------------------------------------------- */}
      {/* MODAL: DELETE (irreversible — explicit confirmation required) */}
      {/* ------------------------------------------------------------- */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-rose-900/60 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-serif">Permanently delete this account?</h3>
              <p className="text-xs text-stone-400">
                <span className="font-semibold text-white">{deleteTarget.profile?.name || deleteTarget.email}</span>{' '}
                ({deleteTarget.email})
              </p>
            </div>

            <div className="text-[11px] text-rose-300/95 bg-rose-950/50 p-3 rounded-xl border border-rose-800/50 space-y-1.5 text-left">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                This action cannot be undone
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-rose-200/80">
                <li>The account, profile, photos, matches, likes and follows are removed</li>
                <li>Chat conversations and message history with this member are removed</li>
                <li>Call history, notifications and push tokens are removed</li>
                <li>Sessions are revoked and realtime connections are closed immediately</li>
                <li>
                  Only the payment ledger and the administrative audit record are retained for accounting and
                  accountability
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-stone-300">
                Type <span className="font-mono text-rose-300">{deleteTarget.email}</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                placeholder={deleteTarget.email}
                className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-rose-500 placeholder-stone-600 font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteConfirmText('');
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={!deleteConfirmationMatches || busyUserId === deleteTarget.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busyUserId === deleteTarget.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Delete Permanently</span>
              </button>
            </div>
          </div>
        </div>
      )}
{/* ------------------------------------------------------------- */}
      {/* MODAL: ACCOUNT ACTION HISTORY (audit trail) */}
      {/* ------------------------------------------------------------- */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white font-serif flex items-center gap-2">
                  <History className="w-4 h-4 text-sky-400" />
                  Account Action History
                </h3>
                <p className="text-[11px] text-stone-400">
                  {historyTarget.profile?.name || historyTarget.email} — {historyTarget.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryTarget(null);
                  setHistoryEntries([]);
                }}
                className="text-stone-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {isLoadingHistory && (
                <div className="p-6 text-center text-stone-400 text-xs">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-2 text-rose-400" />
                  Loading audit trail...
                </div>
              )}

              {!isLoadingHistory && historyEntries.length === 0 && (
                <div className="p-6 text-center text-stone-500 text-xs">
                  No administrative action has been recorded for this account yet.
                </div>
              )}

              {historyEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 rounded-xl bg-stone-950 border border-stone-800 flex items-start gap-3"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      entry.action === 'delete'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : entry.action === 'block'
                        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30'
                        : entry.action === 'suspend'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {entry.action === 'delete' ? (
                      <Trash2 className="w-3.5 h-3.5" />
                    ) : entry.action === 'block' ? (
                      <Ban className="w-3.5 h-3.5" />
                    ) : entry.action === 'suspend' ? (
                      <Clock className="w-3.5 h-3.5" />
                    ) : (
                      <UserCheck className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white uppercase">{entry.action}</span>
                      {entry.previousStatus && (
                        <span className="text-[10px] text-stone-500">
                          {entry.previousStatus} → {entry.newStatus}
                        </span>
                      )}
                    </div>
                    {entry.reason && <div className="text-[11px] text-stone-400 mt-0.5">{entry.reason}</div>}
                    <div className="text-[10px] text-stone-600 mt-1">
                      {entry.performedBy || 'unknown admin'}
                      {entry.performedByRole ? ` (${entry.performedByRole})` : ''} ·{' '}
                      {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  setHistoryTarget(null);
                  setHistoryEntries([]);
                }}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};