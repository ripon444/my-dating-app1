import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  UserPlus,
  Search,
  Check,
  X,
  Edit2,
  Trash2,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Crown,
  Key,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Users,
  BarChart3,
  Coins,
  Globe,
  Clock,
  Settings,
  AlertTriangle,
  FileText,
  Zap
} from 'lucide-react';
import { AdminMember, AdminPermission, AdminRole } from '../../types';
import { api } from '../../services/api';

interface AdminMembersTabProps {
  currentAdminEmail?: string;
  isCurrentUserSuperAdmin?: boolean;
}

const PERMISSION_CONFIG: {
  key: AdminPermission;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  {
    key: 'kpi',
    label: 'Platform KPIs & Analytics',
    description: 'View revenue figures, registration trends, and platform metrics.',
    icon: BarChart3,
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
  },
  {
    key: 'subscriptions',
    label: 'Subscription Plans',
    description: 'Create, edit, adjust prices, and manage VIP/Premium packages.',
    icon: Crown,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
  },
  {
    key: 'boosts',
    label: 'Boost Packages & Pricing',
    description: 'Configure profile boost tiers, multiplier badges, and crypto pricing.',
    icon: Zap,
    color: 'text-orange-400 border-orange-500/30 bg-orange-500/10',
  },
  {
    key: 'payments',
    label: 'Payments & Billing Ledger',
    description: 'View crypto transactions, NOWPayments logs, and payment gateways.',
    icon: Coins,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
  },
  {
    key: 'users',
    label: 'Users & Profiles Management',
    description: 'Search, verify, edit profiles, ban/unban users, and grant subscriptions.',
    icon: Users,
    color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
  },
  {
    key: 'moderation',
    label: 'Moderation & Safety Queue',
    description: 'Investigate user reports, flagged messages, and safety complaints.',
    icon: AlertTriangle,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
  },
  {
    key: 'legal',
    label: 'Privacy & Terms Editor',
    description: 'Edit and publish platform Terms of Service, Privacy Policy, and Safety Tips.',
    icon: FileText,
    color: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
  },
  {
    key: 'providers',
    label: 'Partner Syndication Feeds',
    description: 'Manage external partner APIs, feed sync frequency, and imports.',
    icon: Globe,
    color: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
  },
  {
    key: 'logs',
    label: 'Audit & Sync Logs',
    description: 'Inspect real-time system synchronization logs and diagnostic audits.',
    icon: Clock,
    color: 'text-stone-400 border-stone-500/30 bg-stone-500/10',
  },
  {
    key: 'settings',
    label: 'System Configuration',
    description: 'Manage platform branding, maintenance mode, and general settings.',
    icon: Settings,
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  },
  {
    key: 'admins',
    label: 'Admins & Role Governance',
    description: 'Add sub-admins, configure permissions, and manage staff access.',
    icon: ShieldCheck,
    color: 'text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/10',
  },
];

const ROLE_PRESETS: {
  role: AdminRole;
  title: string;
  badgeColor: string;
  description: string;
  defaultPermissions: AdminPermission[];
}[] = [
  {
    role: 'SUPER_ADMIN',
    title: 'Super Administrator',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    description: 'Absolute authority across all modules, payments, and admin staffing.',
    defaultPermissions: ['kpi', 'subscriptions', 'boosts', 'payments', 'users', 'moderation', 'legal', 'providers', 'logs', 'settings', 'admins'],
  },
  {
    role: 'ADMIN',
    title: 'General Administrator',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'Full operational access across all platform modules (excluding admin staffing).',
    defaultPermissions: ['kpi', 'subscriptions', 'boosts', 'payments', 'users', 'moderation', 'legal', 'providers', 'logs', 'settings'],
  },
  {
    role: 'SUB_ADMIN',
    title: 'Sub-Admin / Manager',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    description: 'Customizable role tailored to your operations team requirements.',
    defaultPermissions: ['users', 'moderation', 'legal', 'logs'],
  },
  {
    role: 'FINANCE',
    title: 'Finance & Billing Lead',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    description: 'Access to revenue KPIs, subscription pricing plans, and payment logs.',
    defaultPermissions: ['kpi', 'subscriptions', 'boosts', 'payments'],
  },
  {
    role: 'MODERATOR',
    title: 'Community Moderator',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'Handles user verification, profile inspections, and moderation tickets.',
    defaultPermissions: ['users', 'moderation'],
  },
  {
    role: 'SUPPORT',
    title: 'Customer Support',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'Read-only access to user profiles and support tickets.',
    defaultPermissions: ['users', 'moderation', 'legal'],
  },
];

export const AdminMembersTab: React.FC<AdminMembersTabProps> = ({
  currentAdminEmail = '',
  isCurrentUserSuperAdmin = true,
}) => {
  const [members, setMembers] = useState<AdminMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<AdminMember | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<AdminRole>('SUB_ADMIN');
  const [formPermissions, setFormPermissions] = useState<AdminPermission[]>(['users', 'moderation']);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formNotes, setFormNotes] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Delete Confirmation State
  const [deletingMember, setDeletingMember] = useState<AdminMember | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadMembers = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await api.adminGetMembers();
      if (res?.members) {
        setMembers(res.members);
      }
    } catch (err: any) {
      console.error('Failed to load admin members:', err);
      setErrorMsg(err?.message || 'Failed to fetch administrator members list.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, []);

  // Quick Password Generator
  const generateStrongPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*';
    let pwd = '';
    for (let i = 0; i < 14; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pwd);
    setShowPassword(true);
  };

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setEditingMember(null);
    setFormName('');
    setFormEmail('');
    setFormPassword('');
    setFormRole('SUB_ADMIN');
    setFormPermissions(['users', 'moderation', 'logs']);
    setFormIsActive(true);
    setFormNotes('');
    setModalError('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (member: AdminMember) => {
    setEditingMember(member);
    setFormName(member.name);
    setFormEmail(member.email);
    setFormPassword('');
    setFormRole(member.role);
    setFormPermissions([...member.permissions]);
    setFormIsActive(member.isActive);
    setFormNotes(member.notes || '');
    setModalError('');
    setShowPassword(false);
    setIsModalOpen(true);
  };

  // Handle Preset Change
  const handleRolePresetSelect = (role: AdminRole) => {
    setFormRole(role);
    const preset = ROLE_PRESETS.find((p) => p.role === role);
    if (preset) {
      setFormPermissions([...preset.defaultPermissions]);
    }
  };

  // Toggle single permission
  const handleTogglePermission = (permKey: AdminPermission) => {
    setFormPermissions((prev) => {
      if (prev.includes(permKey)) {
        return prev.filter((k) => k !== permKey);
      } else {
        return [...prev, permKey];
      }
    });
  };

  // Select all or none
  const handleSelectAllPermissions = () => {
    setFormPermissions(PERMISSION_CONFIG.map((p) => p.key));
  };
  const handleClearAllPermissions = () => {
    setFormPermissions([]);
  };

  // Submit Create or Update
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError('');

    const cleanName = formName.trim();
    const cleanEmail = formEmail.trim().toLowerCase();

    if (!cleanName) {
      setModalError('Please provide the full name of the administrator.');
      return;
    }
    if (!cleanEmail) {
      setModalError('Please provide a valid email address.');
      return;
    }

    if (!editingMember && !formPassword.trim()) {
      setModalError('Please set an initial login password for this administrator.');
      return;
    }

    setModalLoading(true);
    try {
      if (editingMember) {
        // Update existing member
        const res = await api.adminUpdateMember(editingMember.id, {
          name: cleanName,
          role: formRole,
          permissions: formPermissions,
          isActive: formIsActive,
          notes: formNotes.trim(),
          password: formPassword.trim() || undefined,
        });
        setSuccessMsg(res.message || `Updated administrator '${cleanName}' successfully.`);
      } else {
        // Create new member
        const res = await api.adminCreateMember({
          name: cleanName,
          email: cleanEmail,
          role: formRole,
          permissions: formPermissions,
          password: formPassword.trim(),
          notes: formNotes.trim(),
        });
        setSuccessMsg(res.message || `Administrator '${cleanName}' added successfully.`);
      }

      setIsModalOpen(false);
      await loadMembers();
    } catch (err: any) {
      setModalError(err?.message || 'Operation failed. Please verify your inputs.');
    } finally {
      setModalLoading(false);
    }
  };

  // Toggle Member Active Status Directly
  const handleToggleActiveStatus = async (member: AdminMember) => {
    const isPrimarySuper =
      member.email.toLowerCase() === 'admin@love.com' ||
      member.email.toLowerCase() === 'tanvirahmadkst@gmail.com' ||
      member.email.toLowerCase().includes('tanvir');

    if (isPrimarySuper && member.isActive) {
      setErrorMsg('Cannot disable primary Founder Super Administrator account.');
      return;
    }

    try {
      await api.adminUpdateMember(member.id, {
        isActive: !member.isActive,
      });
      setSuccessMsg(
        `Administrator '${member.name}' is now ${!member.isActive ? 'Active' : 'Suspended'}.`
      );
      await loadMembers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update administrator status.');
    }
  };

  // Delete Member
  const handleConfirmDelete = async () => {
    if (!deletingMember) return;
    setDeleteLoading(true);
    try {
      const res = await api.adminDeleteMember(deletingMember.id);
      setSuccessMsg(res.message || `Administrator '${deletingMember.name}' access revoked.`);
      setDeletingMember(null);
      await loadMembers();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to revoke administrator access.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filtered list
  const filteredMembers = members.filter((m) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const match =
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (roleFilter !== 'ALL' && m.role !== roleFilter) {
      return false;
    }
    if (statusFilter === 'ACTIVE' && !m.isActive) return false;
    if (statusFilter === 'DISABLED' && m.isActive) return false;
    return true;
  });

  const superAdminCount = members.filter((m) => m.role === 'SUPER_ADMIN').length;
  const subAdminCount = members.filter((m) => m.role !== 'SUPER_ADMIN').length;
  const activeCount = members.filter((m) => m.isActive).length;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-stone-900 border border-stone-800 p-5 rounded-2xl shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2 font-serif">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Administrators & Sub-Admin Roles
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              Role-Based Access Control (RBAC)
            </span>
          </div>
          <p className="text-xs text-stone-400 max-w-2xl">
            Grant sub-admins granular permissions across Payments, Subscriptions, Users, and Moderation.
            Sub-admins only see and manage the modules you assign them.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadMembers}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white border border-stone-700 transition"
            title="Refresh Admin List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 transition shadow-md"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Administrator</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider">Total Administrators</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-white font-serif">{members.length}</p>
            <Users className="w-4 h-4 text-stone-500" />
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider">Super Admins</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-amber-400 font-serif">{superAdminCount}</p>
            <Crown className="w-4 h-4 text-amber-500" />
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider">Sub-Admins & Staff</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-sky-400 font-serif">{subAdminCount}</p>
            <Sliders className="w-4 h-4 text-sky-500" />
          </div>
        </div>

        <div className="bg-stone-900 border border-stone-800 p-4 rounded-2xl">
          <p className="text-[11px] text-stone-400 uppercase font-semibold tracking-wider">Active Staff</p>
          <div className="mt-1 flex items-baseline justify-between">
            <p className="text-2xl font-bold text-emerald-400 font-serif">{activeCount}</p>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-xs flex items-center justify-between shadow-lg">
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
        <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg('')} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-900 p-3.5 rounded-2xl border border-stone-800">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or notes..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-indigo-500 placeholder-stone-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Roles</option>
            <option value="SUPER_ADMIN">Super Admins</option>
            <option value="ADMIN">General Admins</option>
            <option value="SUB_ADMIN">Sub-Admins</option>
            <option value="FINANCE">Finance & Billing</option>
            <option value="MODERATOR">Moderators</option>
            <option value="SUPPORT">Customer Support</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-stone-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="DISABLED">Suspended</option>
          </select>
        </div>
      </div>

      {/* Administrators Table */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-stone-400 gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <p className="text-xs">Loading administrators directory...</p>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-16 text-center text-stone-400">
            <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-stone-600" />
            <p className="text-sm font-semibold text-stone-300">No administrators match your criteria.</p>
            <p className="text-xs text-stone-500 mt-1">Try resetting your search query or filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-950/60 border-b border-stone-800 text-stone-400 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="p-4">Administrator</th>
                  <th className="p-4">Role & Authority</th>
                  <th className="p-4">Assigned Permissions</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Created / Notes</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800/60">
                {filteredMembers.map((member) => {
                  const rolePreset = ROLE_PRESETS.find((r) => r.role === member.role);
                  const isPrimarySuper =
                    member.email.toLowerCase() === 'admin@love.com' ||
                    member.email.toLowerCase() === 'tanvirahmadkst@gmail.com' ||
                    member.email.toLowerCase().includes('tanvir');

                  const isSelf = currentAdminEmail && member.email.toLowerCase() === currentAdminEmail.toLowerCase();

                  return (
                    <tr key={member.id} className="hover:bg-stone-850/40 transition">
                      {/* Name & Email */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-stone-800 to-stone-700 border border-stone-700 flex items-center justify-center font-bold text-sm text-stone-200">
                            {member.name ? member.name.charAt(0).toUpperCase() : 'A'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-white text-xs">{member.name}</span>
                              {isPrimarySuper && (
                                <span title="Primary Founder Super Admin">
                                  <Crown className="w-3.5 h-3.5 text-amber-400" />
                                </span>
                              )}
                              {isSelf && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30">
                                  You
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-stone-400 font-mono">{member.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="p-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                            rolePreset?.badgeColor || 'bg-stone-800 text-stone-300 border-stone-700'
                          }`}
                        >
                          {member.role === 'SUPER_ADMIN' && <Crown className="w-3 h-3" />}
                          {rolePreset?.title || member.role}
                        </span>
                      </td>

                      {/* Permissions Pills */}
                      <td className="p-4 max-w-xs">
                        {member.role === 'SUPER_ADMIN' ? (
                          <span className="text-amber-400/90 font-medium text-[11px] flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" /> All System Privileges Unrestricted
                          </span>
                        ) : member.permissions && member.permissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {member.permissions.map((permKey) => {
                              const cfg = PERMISSION_CONFIG.find((p) => p.key === permKey);
                              return (
                                <span
                                  key={permKey}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-stone-800 text-stone-300 border border-stone-700/60"
                                >
                                  {cfg?.label.split(' ')[0] || permKey}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-stone-500 italic text-[11px]">No specific permissions assigned</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4">
                        <button
                          type="button"
                          disabled={isPrimarySuper}
                          onClick={() => handleToggleActiveStatus(member)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition ${
                            member.isActive
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                              : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                          } ${isPrimarySuper ? 'cursor-default opacity-80' : 'cursor-pointer'}`}
                          title={isPrimarySuper ? 'Founder account cannot be suspended' : 'Click to toggle active status'}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              member.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
                            }`}
                          />
                          {member.isActive ? 'Active' : 'Suspended'}
                        </button>
                      </td>

                      {/* Created Date / Notes */}
                      <td className="p-4">
                        <div className="text-[11px] text-stone-400">
                          {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : 'System Genesis'}
                        </div>
                        {member.notes && (
                          <p className="text-[10px] text-stone-500 truncate max-w-[160px]" title={member.notes}>
                            {member.notes}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Button */}
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(member)}
                            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition"
                            title="Edit Permissions & Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete Button (Protected for Super Admins and Self) */}
                          {!isPrimarySuper && !isSelf && (
                            <button
                              type="button"
                              onClick={() => setDeletingMember(member)}
                              className="p-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition"
                              title="Revoke Administrator Access"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* ------------------------------------------------------------- */}
      {/* MODAL: ADD / EDIT ADMINISTRATOR & PERMISSIONS */}
      {/* ------------------------------------------------------------- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in overflow-y-auto">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-rose-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  {editingMember ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-serif">
                    {editingMember ? `Edit Permissions: ${editingMember.name}` : 'Add New Administrator / Sub-Admin'}
                  </h3>
                  <p className="text-xs text-stone-400">
                    {editingMember
                      ? 'Adjust role authority, granular access rights, or update password.'
                      : 'Create a new staff administrator account with custom module permissions.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Error Alert */}
            {modalError && (
              <div className="p-3.5 rounded-2xl bg-rose-950/80 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSubmitForm} className="space-y-5">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Full Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Farhan Chowdhury"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-stone-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-300 mb-1">
                    Email Address <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingMember)}
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    placeholder="admin.staff@lovemeetly.com"
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-stone-600 ${
                      editingMember ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-300">
                    {editingMember ? 'Reset Login Password (leave blank to keep current)' : 'Login Password *'}
                  </label>
                  <button
                    type="button"
                    onClick={generateStrongPassword}
                    className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Key className="w-3 h-3" />
                    Generate Strong Password
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingMember ? '••••••••••••' : 'Enter strong password (minimum 8 chars)'}
                    className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role Presets */}
              <div>
                <label className="block text-xs font-semibold text-stone-300 mb-2">
                  Role Preset Authority
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ROLE_PRESETS.map((preset) => {
                    const isSelected = formRole === preset.role;
                    return (
                      <button
                        key={preset.role}
                        type="button"
                        onClick={() => handleRolePresetSelect(preset.role)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow'
                            : 'bg-stone-950 border-stone-800 text-stone-400 hover:border-stone-700 hover:text-stone-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{preset.title}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                        </div>
                        <p className="text-[10px] text-stone-500 line-clamp-2">{preset.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Granular Permissions Checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <label className="text-xs font-semibold text-stone-300">
                      Granular Module Permissions
                    </label>
                    <p className="text-[11px] text-stone-500">
                      Sub-admins will only see tabs and access endpoints corresponding to these checks.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllPermissions}
                      className="text-[11px] text-indigo-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-stone-600">•</span>
                    <button
                      type="button"
                      onClick={handleClearAllPermissions}
                      className="text-[11px] text-stone-400 hover:underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1 border border-stone-800 rounded-2xl bg-stone-950/70">
                  {PERMISSION_CONFIG.map((perm) => {
                    const Icon = perm.icon;
                    const isChecked = formPermissions.includes(perm.key) || formRole === 'SUPER_ADMIN';
                    const isDisabled = formRole === 'SUPER_ADMIN';

                    return (
                      <label
                        key={perm.key}
                        className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition ${
                          isChecked
                            ? 'bg-stone-850/80 border-stone-700'
                            : 'bg-stone-950 border-stone-800/80 opacity-60 hover:opacity-100'
                        } ${isDisabled ? 'cursor-not-allowed' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={isDisabled}
                          onChange={() => handleTogglePermission(perm.key)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-0 focus:outline-none bg-stone-900 border-stone-700"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-stone-300" />
                            <span className="text-xs font-bold text-white truncate">{perm.label}</span>
                          </div>
                          <p className="text-[10px] text-stone-400 mt-0.5 leading-tight">{perm.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status and Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 border-t border-stone-800">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Staff Account Status</label>
                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded text-emerald-600 focus:ring-0 bg-stone-900 border-stone-700"
                    />
                    <span className={`text-xs font-bold ${formIsActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formIsActive ? 'Active (Allowed)' : 'Suspended'}
                    </span>
                  </label>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-300 mb-1">Administrative Notes</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="e.g. Bangladesh shift lead - handles user verifications"
                    className="w-full px-3 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white focus:outline-none focus:border-indigo-500 placeholder-stone-600"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={modalLoading}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow disabled:opacity-60"
                >
                  {modalLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingMember ? 'Save Changes' : 'Create Administrator'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL: DELETE / REVOKE CONFIRMATION */}
      {/* ------------------------------------------------------------- */}
      {deletingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white font-serif">Revoke Administrator Access?</h3>
              <p className="text-xs text-stone-400">
                Are you sure you want to remove <span className="font-semibold text-white">{deletingMember.name}</span> ({deletingMember.email}) from the platform administration team?
              </p>
              <p className="text-[11px] text-rose-400/90 mt-2 bg-rose-950/40 p-2.5 rounded-xl border border-rose-800/40 text-left">
                ⚠️ Their admin role will be demoted to standard user and all current administrative sessions will be terminated immediately.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingMember(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow"
              >
                {deleteLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Revoke Access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
