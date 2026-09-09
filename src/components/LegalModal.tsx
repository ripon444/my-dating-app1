import React, { useState, useEffect } from 'react';
import { Shield, BookOpen, Lock, AlertCircle, X, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext';
import { LegalDocument } from '../types';
import { api } from '../services/api';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: string;
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'terms',
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [documents, setDocuments] = useState<Record<string, LegalDocument>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api.getLegalDocuments()
        .then((res) => {
          if (res.documents) {
            const map: Record<string, LegalDocument> = {};
            res.documents.forEach((d) => {
              map[d.id] = d;
            });
            setDocuments(map);
          }
        })
        .catch((err) => {
          console.warn('Failed to load legal documents:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentDoc = documents[activeTab];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="bg-stone-900 w-full max-w-3xl rounded-3xl border border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-stone-800 bg-stone-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-rose-500" />
            <h2 className="text-lg font-bold text-white font-serif">Trust, Safety & Legal Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-800 bg-stone-900/60 px-6 gap-2 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'safety', label: 'Safety Tips', icon: Shield },
            { id: 'guidelines', label: 'Community Guidelines', icon: BookOpen },
            { id: 'terms', label: 'Terms of Service', icon: Lock },
            { id: 'privacy', label: 'Privacy Policy', icon: AlertCircle },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-3 px-3 border-b-2 transition flex items-center gap-1.5 shrink-0 ${
                  isActive
                    ? 'border-rose-500 text-rose-400 font-bold'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs sm:text-sm text-stone-300 leading-relaxed">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
              <span>Loading latest terms & policies...</span>
            </div>
          ) : currentDoc ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-stone-800">
                <h3 className="text-base font-bold text-white font-serif">{currentDoc.title}</h3>
                <div className="flex items-center gap-3 text-[11px] text-stone-400 font-mono">
                  {currentDoc.version && <span>Version {currentDoc.version}</span>}
                  {currentDoc.updated_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-500" />
                      <span>Updated {new Date(currentDoc.updated_at).toLocaleDateString()}</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="text-stone-300 leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
                {currentDoc.content}
              </div>
            </div>
          ) : (
            // Built-in Fallbacks if backend is starting or offline
            <>
              {activeTab === 'safety' && (
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-white font-serif">Top Dating Safety Guidelines</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-1.5">
                      <div className="font-bold text-rose-400">1. Never Send Money or Financial Details</div>
                      <p className="text-stone-400">
                        Never wire funds, share credit cards, or invest in cryptocurrency pitches from anyone you meet online.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-1.5">
                      <div className="font-bold text-rose-400">2. Protect Personal Identifiers</div>
                      <p className="text-stone-400">
                        Keep your home address, workplace details, and government IDs confidential until high mutual trust is established.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-1.5">
                      <div className="font-bold text-rose-400">3. Meet in Public First</div>
                      <p className="text-stone-400">
                        Always arrange initial dates in well-lit, populated public venues like cafes, restaurants, or museums.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-stone-800/60 border border-stone-700/60 space-y-1.5">
                      <div className="font-bold text-rose-400">4. Inform a Trusted Friend</div>
                      <p className="text-stone-400">
                        Share your date location and plans with a friend or family member before meeting in person.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'guidelines' && (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white font-serif">Community Guidelines</h3>
                  <p>
                    Lovemeetly is dedicated to fostering genuine, respectful, and safe human connections worldwide. We strictly prohibit:
                  </p>
                  <ul className="list-disc list-inside space-y-2 text-xs text-stone-300">
                    <li>Underage accounts: All members must be at least 18 years of age.</li>
                    <li>Harassment, stalking, hate speech, or non-consensual sexually explicit messages.</li>
                    <li>Commercial advertising, prostitution, or financial scam operations.</li>
                    <li>Impersonation, catfishing, or upload of unverified celebrity imagery.</li>
                  </ul>
                </div>
              )}

              {activeTab === 'terms' && (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white font-serif">Terms of Service</h3>
                  <p className="text-xs text-stone-400">Effective: January 2026</p>
                  <p>
                    By registering or using Lovemeetly, you represent and warrant that you are at least 18 years old, possess the legal capacity to form a binding contract, and agree to abide by all platform rules and subscription billing terms.
                  </p>
                  <p>
                    Subscriptions auto-renew monthly and can be cancelled at any time prior to the billing cycle end date without penalty.
                  </p>
                </div>
              )}

              {activeTab === 'privacy' && (
                <div className="space-y-3">
                  <h3 className="text-base font-bold text-white font-serif">Privacy Policy</h3>
                  <p className="text-xs text-stone-400">GDPR & CCPA Compliant</p>
                  <p>
                    We do not sell your personal data. Exact GPS coordinates are never displayed publicly to other users; only approximate regional approximations (e.g. "Near Dhaka") are computed. All chat messages and WebRTC voice/video calls utilize industry-standard cryptographic encryption.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-950 border-t border-stone-800 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-bold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
