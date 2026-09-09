import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Shield, 
  Lock, 
  BookOpen, 
  AlertCircle, 
  Check, 
  X, 
  RefreshCw, 
  Loader2, 
  Save, 
  Eye, 
  Clock, 
  UserCheck, 
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { LegalDocument } from '../../types';
import { api } from '../../services/api';

interface AdminLegalDocumentsTabProps {
  onSuccessMessage: (msg: string) => void;
}

export const AdminLegalDocumentsTab: React.FC<AdminLegalDocumentsTabProps> = ({
  onSuccessMessage,
}) => {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeDocId, setActiveDocId] = useState<string>('terms');

  // Form states for the currently selected document
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [docVersion, setDocVersion] = useState('1.0');
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const loadDocuments = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const res = await api.getAdminLegalDocuments();
      setDocuments(res.documents || []);
      
      // Load active doc
      const current = (res.documents || []).find((d) => d.id === activeDocId) || res.documents?.[0];
      if (current) {
        setDocTitle(current.title);
        setDocContent(current.content);
        setDocVersion(current.version || '1.0');
        setActiveDocId(current.id);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load legal documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleSelectDoc = (docId: string) => {
    setActiveDocId(docId);
    const doc = documents.find((d) => d.id === docId);
    if (doc) {
      setDocTitle(doc.title);
      setDocContent(doc.content);
      setDocVersion(doc.version || '1.0');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docContent.trim()) {
      setErrorMessage('Content cannot be empty.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    try {
      await api.adminUpdateLegalDocument(activeDocId, {
        title: docTitle.trim(),
        content: docContent.trim(),
        version: docVersion.trim(),
      });
      onSuccessMessage(`Legal Document "${docTitle || activeDocId}" updated successfully!`);
      loadDocuments();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save document');
    } finally {
      setIsSaving(false);
    }
  };

  const docIcons: Record<string, any> = {
    terms: Lock,
    privacy: AlertCircle,
    guidelines: BookOpen,
    safety: Shield,
  };

  const activeDoc = documents.find((d) => d.id === activeDocId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-400 text-xs font-bold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4" />
            <span>Compliance, Legal & Safety Administration</span>
          </div>
          <h2 className="text-xl font-bold text-white font-serif">Legal Content & Platform Terms Editor</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            Post and update Privacy Policy, Terms of Service, Community Guidelines, and Safety Tips live from this control panel.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadDocuments}
            disabled={isLoading}
            className="p-2.5 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-300 hover:text-white border border-stone-700 transition"
            title="Refresh legal documents"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage('')} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Document Selector Navigation */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { id: 'terms', label: 'Terms of Service', icon: Lock, desc: 'User agreement & contract' },
          { id: 'privacy', label: 'Privacy Policy', icon: AlertCircle, desc: 'Data security & GDPR/CCPA' },
          { id: 'guidelines', label: 'Community Guidelines', icon: BookOpen, desc: 'Conduct & anti-harassment' },
          { id: 'safety', label: 'Safety Tips', icon: Shield, desc: 'Dating guidance & fraud alerts' },
        ].map((item) => {
          const Icon = item.icon;
          const isSelected = activeDocId === item.id;
          const doc = documents.find((d) => d.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectDoc(item.id)}
              className={`p-4 rounded-2xl border text-left transition relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-gradient-to-br from-rose-950/40 via-stone-900 to-indigo-950/40 border-rose-500 shadow-md shadow-rose-950/30'
                  : 'bg-stone-900 border-stone-800 hover:border-stone-700 text-stone-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-rose-500 text-white' : 'bg-stone-800 text-stone-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {doc?.version && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800 text-stone-300 border border-stone-700">
                      v{doc.version}
                    </span>
                  )}
                </div>
                <div className="font-bold text-sm text-white">{item.label}</div>
                <p className="text-[11px] text-stone-400 mt-0.5">{item.desc}</p>
              </div>

              {doc?.updated_at && (
                <div className="text-[10px] text-stone-500 font-mono mt-3 pt-2 border-t border-stone-800/80 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(doc.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Editor Container */}
      <div className="p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Header of the active document */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                {React.createElement(docIcons[activeDocId] || FileText, { className: 'w-5 h-5' })}
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Editing: {docTitle || activeDocId}</h3>
                <div className="flex items-center gap-3 text-[11px] text-stone-400 mt-0.5">
                  {activeDoc?.last_updated_by && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-400" />
                      <span>Last edited by {activeDoc.last_updated_by}</span>
                    </span>
                  )}
                  {activeDoc?.updated_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-500" />
                      <span>{new Date(activeDoc.updated_at).toLocaleString()}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle Preview / Edit */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode(!previewMode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                  previewMode
                    ? 'bg-rose-600 text-white border-rose-500'
                    : 'bg-stone-800 text-stone-300 border-stone-700 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{previewMode ? 'Return to Editor' : 'Live User Preview'}</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-lg shadow-rose-950/40 flex items-center gap-1.5 transition cursor-pointer"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save & Publish Live</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Title & Version Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-stone-300">Document Title</label>
              <input
                type="text"
                required
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                placeholder="e.g. Terms of Service & User Agreement"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-300">Document Version</label>
              <input
                type="text"
                required
                value={docVersion}
                onChange={(e) => setDocVersion(e.target.value)}
                placeholder="e.g. 2.1"
                className="w-full bg-stone-950 border border-stone-700 rounded-xl px-3.5 py-2 text-xs text-white font-mono focus:outline-none focus:border-rose-500"
              />
            </div>
          </div>

          {/* Body: Editor or Preview */}
          {previewMode ? (
            <div className="p-6 rounded-2xl bg-stone-950 border border-stone-800 space-y-4 max-h-[500px] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <h4 className="text-lg font-bold text-white font-serif">{docTitle}</h4>
                <span className="text-xs font-mono text-stone-400">Version {docVersion}</span>
              </div>
              <div className="text-xs sm:text-sm text-stone-300 leading-relaxed whitespace-pre-wrap font-sans">
                {docContent}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-stone-400">
                <label className="font-semibold text-stone-300">Document Content (Live text)</label>
                <span className="text-[11px] text-stone-500 font-mono">{docContent.length} characters</span>
              </div>
              <textarea
                rows={16}
                required
                value={docContent}
                onChange={(e) => setDocContent(e.target.value)}
                placeholder="Enter document text..."
                className="w-full bg-stone-950 border border-stone-700 rounded-2xl p-4 text-xs sm:text-sm text-white font-mono leading-relaxed placeholder-stone-600 focus:outline-none focus:border-rose-500 transition"
              />
            </div>
          )}

          {/* Quick Help & Publishing Notice */}
          <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex items-start gap-3">
            <HelpCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
            <div className="text-xs text-stone-400 leading-relaxed">
              <strong className="text-stone-200">Immediate platform update:</strong> Changes published here are instantaneously updated in all public user modals, registration footers, and trust center dialogs across the platform.
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
