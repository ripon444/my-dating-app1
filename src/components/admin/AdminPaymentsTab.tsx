import React, { useState, useEffect } from 'react';
import { 
  Coins, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  X, 
  ExternalLink, 
  Loader2, 
  Copy, 
  Check, 
  Eye, 
  EyeOff, 
  Settings, 
  Sliders, 
  ShieldCheck, 
  DollarSign,
  Filter
} from 'lucide-react';
import { PaymentTransaction, PaymentSummaryStats, NowPaymentsSettings } from '../../types';
import { api } from '../../services/api';

interface AdminPaymentsTabProps {
  onSuccessMessage: (msg: string) => void;
}

export const AdminPaymentsTab: React.FC<AdminPaymentsTabProps> = ({
  onSuccessMessage,
}) => {
  const [activeSubView, setActiveSubView] = useState<'transactions' | 'gateway_settings'>('transactions');

  // Transactions & Stats
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [stats, setStats] = useState<PaymentSummaryStats>({
    totalVolumeUsdt: 0,
    totalTransactions: 0,
    finishedCount: 0,
    waitingCount: 0,
    failedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTx, setSelectedTx] = useState<PaymentTransaction | null>(null);

  // Settings state
  const [settings, setSettings] = useState<NowPaymentsSettings | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [ipnSecret, setIpnSecret] = useState('');
  const [isSandbox, setIsSandbox] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [payoutCurrency, setPayoutCurrency] = useState('usdttrc20');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showIpnSecret, setShowIpnSecret] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [copiedIpnUrl, setCopiedIpnUrl] = useState(false);

  const loadPayments = async () => {
    setIsLoading(true);
    try {
      const res = await api.adminGetPayments({
        search: searchQuery.trim() || undefined,
        status: statusFilter || undefined,
      });
      setTransactions(res.transactions || []);
      setStats(res.stats || {
        totalVolumeUsdt: 0,
        totalTransactions: 0,
        finishedCount: 0,
        waitingCount: 0,
        failedCount: 0,
      });
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      const s = await api.adminGetPaymentSettings();
      setSettings(s);
      setApiKey(s.apiKey || '');
      setIpnSecret(s.ipnSecret || '');
      setIsSandbox(!!s.isSandbox);
      setIsEnabled(s.isEnabled !== false);
      setPayoutCurrency(s.payoutCurrency || 'usdttrc20');
    } catch (err) {
      console.error('Failed to load payment settings:', err);
    }
  };

  useEffect(() => {
    loadPayments();
    loadSettings();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadPayments();
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await api.adminSavePaymentSettings({
        apiKey: apiKey.trim(),
        ipnSecret: ipnSecret.trim(),
        isSandbox,
        isEnabled,
        payoutCurrency: payoutCurrency.trim().toLowerCase(),
      });
      onSuccessMessage('NOWPayments Gateway configuration saved successfully!');
      await loadSettings();
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const ipnCallbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/payments/nowpayments-ipn`
    : 'https://lovemeetly.com/api/payments/nowpayments-ipn';

  const handleCopyIpnUrl = () => {
    navigator.clipboard.writeText(ipnCallbackUrl);
    setCopiedIpnUrl(true);
    setTimeout(() => setCopiedIpnUrl(false), 2500);
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'finished':
      case 'confirmed':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Finished</span>
          </span>
        );
      case 'waiting':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-400 animate-pulse" />
            <span>Waiting</span>
          </span>
        );
      case 'confirming':
      case 'sending':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
            <span>Confirming</span>
          </span>
        );
      case 'failed':
      case 'expired':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold uppercase flex items-center gap-1">
            <AlertCircle className="w-3 h-3 text-red-400" />
            <span>{status}</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-stone-800 text-stone-400 text-[10px] font-bold uppercase">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white font-serif">Crypto Payments & Billing</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
              NOWPayments API
            </span>
          </div>
          <p className="text-xs text-stone-400 mt-0.5">
            Audit cryptocurrency transactions, monitor IPN webhooks, and configure gateway credentials.
          </p>
        </div>

        {/* Sub-tabs toggle */}
        <div className="flex items-center gap-2 bg-stone-900 p-1 rounded-2xl border border-stone-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubView('transactions')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubView === 'transactions'
                ? 'bg-amber-500 text-stone-950 shadow'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            <span>Transactions ({stats.totalTransactions})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('gateway_settings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeSubView === 'gateway_settings'
                ? 'bg-amber-500 text-stone-950 shadow'
                : 'text-stone-400 hover:text-white'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Gateway Settings</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400">Total Volume</div>
          <div className="text-xl font-black text-amber-400 mt-1">
            {stats.totalVolumeUsdt.toLocaleString()} USDT
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Completed Crypto Volume</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400">Successful Invoices</div>
          <div className="text-xl font-black text-emerald-400 mt-1">
            {stats.finishedCount}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Subscriptions activated</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400">Pending / Confirming</div>
          <div className="text-xl font-black text-amber-300 mt-1">
            {stats.waitingCount}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Awaiting network confirmation</div>
        </div>

        <div className="p-4 rounded-2xl bg-stone-900 border border-stone-800 shadow">
          <div className="text-[11px] font-semibold text-stone-400">Failed / Expired</div>
          <div className="text-xl font-black text-red-400 mt-1">
            {stats.failedCount}
          </div>
          <div className="text-[10px] text-stone-400 mt-0.5">Cancelled or timed out</div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* SUBVIEW 1: TRANSACTIONS LIST */}
      {/* ------------------------------------------------------------- */}
      {activeSubView === 'transactions' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="bg-stone-900 p-4 rounded-2xl border border-stone-800 flex flex-col sm:flex-row items-center justify-between gap-3">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80 flex items-center">
              <Search className="w-4 h-4 text-amber-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by Order ID, Payment ID, or Email..."
                className="w-full bg-stone-950 border border-stone-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); loadPayments(); }}
                  className="absolute right-2.5 text-stone-400 hover:text-white p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <div className="flex items-center gap-1.5 text-xs text-stone-400">
                <Filter className="w-3.5 h-3.5" />
                <span>Status:</span>
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-stone-950 border border-stone-700 rounded-xl px-3 py-1.5 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">All Statuses</option>
                <option value="finished">Finished (Completed)</option>
                <option value="waiting">Waiting</option>
                <option value="confirming">Confirming</option>
                <option value="failed">Failed / Expired</option>
              </select>

              <button
                type="button"
                onClick={loadPayments}
                disabled={isLoading}
                className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white border border-stone-700 transition"
                title="Refresh Payments"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Transactions Table */}
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-stone-400">
              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
              <span className="text-xs">Loading payment transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-stone-900 border border-stone-800 text-stone-400 text-xs">
              No transactions match your search query.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-800 bg-stone-900 shadow">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="bg-stone-950 text-stone-400 uppercase tracking-wider text-[10px] border-b border-stone-800">
                  <tr>
                    <th className="p-3.5">Date</th>
                    <th className="p-3.5">Order ID</th>
                    <th className="p-3.5">User</th>
                    <th className="p-3.5">Plan</th>
                    <th className="p-3.5">Amount</th>
                    <th className="p-3.5">Pay Coin</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-stone-800/40 transition">
                      <td className="p-3.5 text-stone-400 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString([], {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="p-3.5 font-mono text-stone-200">
                        <div className="font-bold">{tx.order_id}</div>
                        {tx.payment_id && (
                          <div className="text-[10px] text-stone-500">ID: {tx.payment_id}</div>
                        )}
                      </td>

                      <td className="p-3.5 text-stone-200">
                        <div className="font-medium text-white">{tx.user_email || 'User'}</div>
                        <div className="text-[10px] text-stone-500 font-mono truncate max-w-[120px]">{tx.user_id}</div>
                      </td>

                      <td className="p-3.5 font-semibold text-amber-300">
                        {tx.plan_name}
                      </td>

                      <td className="p-3.5 font-extrabold text-white">
                        {tx.amount} {tx.currency}
                      </td>

                      <td className="p-3.5 font-mono uppercase text-stone-300">
                        {tx.pay_currency || 'USDT'}
                      </td>

                      <td className="p-3.5">
                        {getStatusBadge(tx.payment_status)}
                      </td>

                      <td className="p-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedTx(tx)}
                          className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-semibold transition"
                        >
                          Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* SUBVIEW 2: GATEWAY SETTINGS */}
      {/* ------------------------------------------------------------- */}
      {activeSubView === 'gateway_settings' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveSettings} className="p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow space-y-6">
            <div>
              <h3 className="font-bold text-white text-base font-serif flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-400" />
                <span>NOWPayments API & Webhook Credentials</span>
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Configure your NOWPayments merchant account credentials to enable automated crypto checkout and instant subscription activation.
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300 flex items-center justify-between">
                <span>NOWPayments API Key *</span>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-stone-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showApiKey ? 'Hide' : 'Show'}</span>
                </button>
              </label>
              <input
                type={showApiKey ? 'text' : 'password'}
                required
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="e.g., 9X6Y...-M8Z..."
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-stone-500">
                Obtain this from your NOWPayments Account Dashboard &rarr; Store Settings &rarr; API Keys.
              </p>
            </div>

            {/* IPN Secret */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300 flex items-center justify-between">
                <span>Instant Payment Notification (IPN) Secret Key *</span>
                <button
                  type="button"
                  onClick={() => setShowIpnSecret(!showIpnSecret)}
                  className="text-stone-400 hover:text-white flex items-center gap-1 text-[11px]"
                >
                  {showIpnSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showIpnSecret ? 'Hide' : 'Show'}</span>
                </button>
              </label>
              <input
                type={showIpnSecret ? 'text' : 'password'}
                required
                value={ipnSecret}
                onChange={(e) => setIpnSecret(e.target.value)}
                placeholder="e.g., your_ipn_secret_key"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-stone-500">
                Used to cryptographically verify incoming webhook signatures with HMAC-SHA512.
              </p>
            </div>

            {/* Sandbox Mode & Gateway Enabled */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-800">
              <label className="flex items-start gap-3 p-4 rounded-2xl bg-stone-950 border border-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-stone-700 text-amber-500 focus:ring-amber-500 bg-stone-900"
                />
                <div>
                  <div className="text-xs font-bold text-white">Enable Payment Gateway</div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    Allow members to purchase VIP subscriptions using cryptocurrency checkout.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 p-4 rounded-2xl bg-stone-950 border border-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSandbox}
                  onChange={(e) => setIsSandbox(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-stone-700 text-amber-500 focus:ring-amber-500 bg-stone-900"
                />
                <div>
                  <div className="text-xs font-bold text-amber-300">Sandbox Testnet Mode</div>
                  <p className="text-[11px] text-stone-400 mt-0.5">
                    When enabled, points to api.sandbox.nowpayments.io for testing without real funds.
                  </p>
                </div>
              </label>
            </div>

            {/* Payout Currency */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300">Preferred Settlement / Payout Currency</label>
              <input
                type="text"
                value={payoutCurrency}
                onChange={(e) => setPayoutCurrency(e.target.value)}
                placeholder="usdttrc20"
                className="w-full sm:w-64 bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-amber-500"
              />
              <p className="text-[10px] text-stone-500">
                Recommended: <strong className="text-amber-400">usdttrc20</strong> (Tether on TRON network for ultra-low network fees).
              </p>
            </div>

            {/* Save Button */}
            <div className="flex justify-end pt-3">
              <button
                type="submit"
                disabled={isSavingSettings}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 shadow-lg transition"
              >
                {isSavingSettings ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Gateway Configuration...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Gateway Settings</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Webhook Callback Box */}
          <div className="p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow space-y-3">
            <h4 className="font-bold text-white text-sm font-serif flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>NOWPayments IPN Webhook Integration Instructions</span>
            </h4>
            <p className="text-xs text-stone-400 leading-relaxed">
              To enable automatic, instant activation of subscriptions immediately when members complete payment, register this Webhook URL inside your NOWPayments dashboard.
            </p>

            <div className="p-3.5 rounded-xl bg-stone-950 border border-stone-800 flex items-center justify-between gap-3">
              <span className="font-mono text-xs text-amber-300 truncate select-all">{ipnCallbackUrl}</span>
              <button
                type="button"
                onClick={handleCopyIpnUrl}
                className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
              >
                {copiedIpnUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedIpnUrl ? 'Copied' : 'Copy URL'}</span>
              </button>
            </div>

            <ol className="list-decimal list-inside text-xs text-stone-400 space-y-1 pt-1">
              <li>Open your <a href="https://account.nowpayments.io/" target="_blank" rel="noreferrer" className="text-amber-400 underline">NOWPayments Dashboard</a></li>
              <li>Go to <strong>Store Settings &rarr; Instant Payment Notifications (IPN)</strong></li>
              <li>Paste the Callback URL shown above into the <strong>IPN Callback URL</strong> field</li>
              <li>Copy your generated <strong>IPN Secret Key</strong> into the field above and save</li>
            </ol>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-stone-900 w-full max-w-lg rounded-3xl border border-stone-800 shadow-2xl p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-white font-serif">Transaction Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-stone-950 border border-stone-800 space-y-2">
                <div className="flex justify-between">
                  <span className="text-stone-400">Order ID:</span>
                  <span className="font-mono font-bold text-white">{selectedTx.order_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">NOWPayments Payment ID:</span>
                  <span className="font-mono text-amber-300">{selectedTx.payment_id || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Status:</span>
                  <span>{getStatusBadge(selectedTx.payment_status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Plan:</span>
                  <span className="font-bold text-white">{selectedTx.plan_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Amount:</span>
                  <span className="font-extrabold text-emerald-400">{selectedTx.amount} {selectedTx.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Pay Currency:</span>
                  <span className="uppercase font-mono text-stone-200">{selectedTx.pay_currency || 'USDT'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">User Email:</span>
                  <span className="text-white">{selectedTx.user_email || 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">User ID:</span>
                  <span className="font-mono text-stone-400 text-[10px]">{selectedTx.user_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Created At:</span>
                  <span className="text-stone-300">{new Date(selectedTx.created_at).toLocaleString()}</span>
                </div>
                {selectedTx.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-stone-400">Completed At:</span>
                    <span className="text-emerald-400">{new Date(selectedTx.completed_at).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {selectedTx.invoice_url && (
                <div className="pt-2">
                  <a
                    href={selectedTx.invoice_url}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs flex items-center justify-center gap-2 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>View NOWPayments Hosted Invoice</span>
                  </a>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setSelectedTx(null)}
                className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold"
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
