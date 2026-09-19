import React, { useMemo, useState } from 'react';
import { HelpCircle, Mail, Copy, Check, ExternalLink } from 'lucide-react';

export const SUPPORT_EMAIL = 'support@lovemeetly.com';

export interface SupportCategory {
  id: string;
  label: string;
  subjectLabel: string;
  emoji: string;
}

export const SUPPORT_CATEGORIES: SupportCategory[] = [
  { id: 'account', label: 'Account / ID Issue', subjectLabel: 'Account/ID Issue', emoji: '👤' },
  { id: 'login', label: 'Login Issue', subjectLabel: 'Login Issue', emoji: '🔑' },
  { id: 'password', label: 'Password / Account Access Issue', subjectLabel: 'Password Issue', emoji: '🔐' },
  { id: 'payment', label: 'Payment Issue', subjectLabel: 'Payment Issue', emoji: '💳' },
  { id: 'subscription', label: 'Subscription / VIP Issue', subjectLabel: 'Subscription/VIP Issue', emoji: '👑' },
  { id: 'profile', label: 'Profile Issue', subjectLabel: 'Profile Issue', emoji: '📝' },
  { id: 'technical', label: 'Technical Issue', subjectLabel: 'Technical Issue', emoji: '🛠️' },
  { id: 'other', label: 'Other', subjectLabel: 'General Inquiry', emoji: '💬' },
];

export function buildSupportMailto(categoryId: string, accountEmail?: string | null): string {
  const category = SUPPORT_CATEGORIES.find((c) => c.id === categoryId) || SUPPORT_CATEGORIES[0];
  const subject = `Lovemeetly Support - ${category.subjectLabel}`;
  const lines: string[] = [
    'Hello Lovemeetly Support Team,',
    '',
    `Issue Category: ${category.label}`,
  ];
  if (accountEmail) lines.push(`Account Email: ${accountEmail}`);
  lines.push('App: Lovemeetly Web / Android', '', 'Please describe your problem here:', '', '');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
}

// Help & Support UI (no backend, mailto-based for web + Android).
export const HelpSupportSection: React.FC<{ accountEmail?: string | null }> = ({ accountEmail }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(SUPPORT_CATEGORIES[0].id);
  const [copied, setCopied] = useState(false);
  const selected = SUPPORT_CATEGORIES.find((c) => c.id === selectedCategoryId) || SUPPORT_CATEGORIES[0];
  const mailtoLink = useMemo(() => buildSupportMailto(selectedCategoryId, accountEmail), [selectedCategoryId, accountEmail]);
  const subjectPreview = `Lovemeetly Support - ${selected.subjectLabel}`;
  const handleContactSupport = () => { window.location.href = mailtoLink; };
  const handleCopyEmail = async () => {
    try { await navigator.clipboard.writeText(SUPPORT_EMAIL); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = SUPPORT_EMAIL;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* noop */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="section-help" aria-label="Help and Support" className="w-full bg-stone-900/90 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex items-center justify-center">
          <HelpCircle className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Help &amp; Support</h2>
          <p className="text-xs text-stone-400">Get help with your Lovemeetly account.</p>
        </div>
      </div>
      <div className="rounded-xl bg-stone-950/60 border border-stone-800/90 p-3.5 sm:p-4 space-y-2">
        <p className="text-sm font-bold text-white">Need Help?</p>
        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">If you are having any problem with your Lovemeetly account, our support team can help.</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-xs text-stone-300">
          {['Account / ID issue','Login / Sign-in issue','Password or account access issue','Payment / Billing issue','Subscription / VIP issue','Profile issue','App technical issue','Other problems'].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shrink-0" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-stone-300 uppercase tracking-wider">Select your issue category</p>
        <div role="radiogroup" aria-label="Issue category" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUPPORT_CATEGORIES.map((cat) => {
            const isSelected = cat.id === selectedCategoryId;
            return (
              <button key={cat.id} type="button" role="radio" aria-checked={isSelected} onClick={() => setSelectedCategoryId(cat.id)}
                className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${isSelected ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30' : 'bg-stone-950/60 border-stone-800/90 text-stone-300 hover:bg-stone-800 hover:text-white'}`}>
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-sm leading-none shrink-0">{cat.emoji}</span>
                  <span className="text-xs font-semibold truncate">{cat.label}</span>
                </span>
                {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-stone-500">Email subject: <span className="text-stone-300 font-mono">{subjectPreview}</span></p>
      </div>
      <div className="rounded-xl bg-stone-950/60 border border-stone-800/90 p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-stone-800 text-stone-200 flex items-center justify-center shrink-0">
            <Mail className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] text-stone-400 uppercase tracking-wider font-semibold">Contact email</p>
            <a id="link-support-email" href={mailtoLink} className="text-xs sm:text-sm font-semibold text-sky-300 hover:text-sky-200 break-all">{SUPPORT_EMAIL}</a>
          </div>
        </div>
        <button type="button" onClick={handleCopyEmail} className="px-3 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <button id="btn-contact-support" type="button" onClick={handleContactSupport} className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-950/50 cursor-pointer transition-all">
        <Mail className="w-4 h-4" />
        <span>Contact Support</span>
        <ExternalLink className="w-3.5 h-3.5 opacity-80" />
      </button>
      <p className="text-center text-[11px] text-stone-500">Tapping Contact Support opens your device email app addressed to {SUPPORT_EMAIL}.</p>
    </section>
  );
};

// End HelpSupportSection

