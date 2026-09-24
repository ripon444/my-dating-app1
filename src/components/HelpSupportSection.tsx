import React, { useState } from 'react';
import { HelpCircle, Mail, Check, Send, Loader2, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export const SUPPORT_EMAIL = 'support@lovemeetly.com';
export const SUPPORT_REQUEST_MIN_LENGTH = 10;
export const SUPPORT_REQUEST_MAX_LENGTH = 2000;

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

// Help & Support: in-app support request form.
// Category + description are POSTed to /api/support/request, which delivers the
// request to the Lovemeetly support inbox (support@lovemeetly.com) through the
// existing Nodemailer transport in server/email.ts.
export const HelpSupportSection: React.FC<{ accountEmail?: string | null }> = ({ accountEmail }) => {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(SUPPORT_CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [submittedRequestId, setSubmittedRequestId] = useState<string | null>(null);

  const selected = SUPPORT_CATEGORIES.find((c) => c.id === selectedCategoryId) || SUPPORT_CATEGORIES[0];
  const subjectPreview = `Lovemeetly Support - ${selected.subjectLabel}`;
  const trimmedDescription = description.trim();
  const isDescriptionValid = trimmedDescription.length >= SUPPORT_REQUEST_MIN_LENGTH;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (!isDescriptionValid) {
      setErrorMessage(`Please describe your problem in at least ${SUPPORT_REQUEST_MIN_LENGTH} characters.`);
      return;
    }
    if (!accountEmail) {
      setErrorMessage('Your account email could not be detected. Please sign in again and retry.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const result = await api.submitSupportRequest({
        category: selectedCategoryId,
        description: trimmedDescription,
        accountEmail,
      });
      setSubmittedRequestId(result?.requestId || 'SENT');
      setDescription('');
    } catch (err) {
      setErrorMessage((err as Error)?.message || 'Support request could not be sent. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendAnotherRequest = () => {
    setSubmittedRequestId(null);
    setErrorMessage('');
    setDescription('');
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
      {submittedRequestId ? (
        <div className="rounded-xl bg-stone-950/60 border border-emerald-500/30 p-4 space-y-3 text-center">
          <div className="w-11 h-11 rounded-full bg-emerald-500/15 text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Support Request Sent</h3>
            <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
              Your request has been submitted to <span className="text-sky-300 font-mono">{SUPPORT_EMAIL}</span>. Our support team will reply to {accountEmail}.
            </p>
            {submittedRequestId !== 'SENT' && (
              <p className="text-[11px] text-stone-500">
                Reference ID: <span className="text-stone-300 font-mono">{submittedRequestId}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleSendAnotherRequest}
            className="w-full py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send Another Request</span>
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-stone-300 uppercase tracking-wider">1. Select a problem category</p>
            <div role="radiogroup" aria-label="Problem category" className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SUPPORT_CATEGORIES.map((cat) => {
                const isSelected = cat.id === selectedCategoryId;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => {
                      setSelectedCategoryId(cat.id);
                      if (errorMessage) setErrorMessage('');
                    }}
                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer ${isSelected ? 'bg-sky-500/15 border-sky-500 text-white shadow-sm ring-1 ring-sky-500/30' : 'bg-stone-950/60 border-stone-800/90 text-stone-300 hover:bg-stone-800 hover:text-white'}`}
                  >
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

          <div className="space-y-2">
            <label htmlFor="support-request-description" className="text-xs font-semibold text-stone-300 uppercase tracking-wider block">
              2. Describe the problem
            </label>
            <textarea
              id="support-request-description"
              rows={5}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errorMessage) setErrorMessage('');
              }}
              maxLength={SUPPORT_REQUEST_MAX_LENGTH}
              placeholder="Tell us what happened, including any error message and the steps that led to the problem..."
              className="w-full bg-stone-950/60 border border-stone-800/90 rounded-xl p-3 text-xs sm:text-sm text-white placeholder-stone-500 focus:outline-none focus:border-sky-500 leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>At least {SUPPORT_REQUEST_MIN_LENGTH} characters</span>
              <span>{trimmedDescription.length}/{SUPPORT_REQUEST_MAX_LENGTH}</span>
            </div>
          </div>

          {errorMessage && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-300 leading-relaxed">{errorMessage}</p>
            </div>
          )}

          <button
            id="btn-send-support-request"
            type="submit"
            disabled={isSubmitting || !isDescriptionValid}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-sky-950/50 cursor-pointer transition-all"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            <span>{isSubmitting ? 'Sending...' : 'Send Support Request'}</span>
          </button>

          <p className="text-center text-[11px] text-stone-500 flex items-center justify-center gap-1.5 flex-wrap">
            <Mail className="w-3 h-3" />
            <span>Sent in-app to {SUPPORT_EMAIL}{accountEmail ? ` from ${accountEmail}` : ''}</span>
          </p>
        </form>
      )}
    </section>
  );
};

// End HelpSupportSection

