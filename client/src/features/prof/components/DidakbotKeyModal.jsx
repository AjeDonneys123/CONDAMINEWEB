import React, { useState, useEffect } from 'react';

export default function DidakbotKeyModal({ user, onClose, onKeyUpdated }) {
  const initialKey = String(user?.didakbotKey || window.localStorage.getItem('conda_didakbot_key') || '').trim();
  const [keyInput, setKeyInput] = useState(initialKey);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (initialKey && !keyInput) setKeyInput(initialKey);
  }, [initialKey]);

  const handleCopy = async () => {
    if (!keyInput.trim()) return;
    try {
      await navigator.clipboard.writeText(keyInput.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
  };

  const handleSave = async () => {
    const cleanKey = keyInput.trim().toUpperCase();
    setSaving(true);
    setSavedSuccess(false);
    try {
      window.localStorage.setItem('conda_didakbot_key', cleanKey);
      const userId = user?.id || user?._id;
      if (userId) {
        await fetch(`/api/admin/teachers/${userId}/didakbot-key`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: cleanKey })
        });
      }
      if (onKeyUpdated) onKeyUpdated(cleanKey);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      alert("Erreur lors de la sauvegarde : " + e.message);
    }
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🤖</span>
            <div>
              <h3 className="text-base font-black text-slate-800">
                Mes Chatbots Pédagogiques (Didak'bot 3)
              </h3>
              <p className="text-[11px] font-medium text-slate-400">
                Plateforme libre NovaPéda · 0 € Coût API
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold flex items-center justify-center transition"
          >
            ✕
          </button>
        </div>

        {/* CLÉ CRÉATEUR ENCADRÉ */}
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-950 tracking-wider">
            <span>🔑</span>
            <span>Votre Identifiant Unique Enseignant</span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Cet identifiant vous permet de <strong>retrouver et modifier vos chatbots</strong> sur Didak'bot, et de <strong>surveiller l'historique des discussions</strong> de vos élèves.
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
              placeholder="Ex : K2L6SK8B"
              className="flex-1 px-4 py-2.5 rounded-xl border border-cyan-300 bg-white font-mono font-black text-sm text-cyan-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 uppercase tracking-wider"
            />
            <button
              type="button"
              onClick={handleCopy}
              disabled={!keyInput.trim()}
              className={`px-3.5 py-2.5 rounded-xl font-black text-xs transition flex items-center gap-1.5 ${
                copied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white border border-cyan-300 hover:bg-cyan-100 text-cyan-900 shadow-sm'
              }`}
              title="Copier la clé"
            >
              <span>{copied ? '✓' : '📋'}</span>
              <span>{copied ? 'Copié !' : 'Copier'}</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition ${
                savedSuccess ? 'bg-emerald-600' : 'bg-cyan-600 hover:bg-cyan-700'
              }`}
            >
              {saving ? '...' : savedSuccess ? '✓ Sauvegardé' : 'Enregistrer'}
            </button>
          </div>

          <div className="text-[11px] text-cyan-800 flex items-center gap-1.5">
            <span>✓</span>
            <span>Votre clé est conservée sur CondamineWeb et synchronisée sur tous vos appareils.</span>
          </div>
        </div>

        {/* ACTIONS DIDAKBOT */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
          <a
            href="https://novapeda.eu/didakbot3.php"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md transition"
          >
            <span>🚀 Ouvrir Didak'bot 3 (NovaPéda)</span>
            <span className="text-[10px]">↗</span>
          </a>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-black text-xs transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
