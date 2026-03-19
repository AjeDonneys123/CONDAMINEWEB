import React, { useEffect, useState } from 'react';

export default function ProfAiConfigModal({ user, onClose }) {
  const userId = String(user?._id || user?.id || '').trim();
  const normalizedFirstName = String(user?.firstName || '').trim().replace(/\s+/g, '');
  const normalizedLastName = String(user?.lastName || '').trim().replace(/\s+/g, '');
  const defaultProjectName = normalizedFirstName || normalizedLastName
    ? `${normalizedFirstName}${normalizedLastName}Key`
    : 'MyGeminiKey';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    geminiApiEnabled: true,
    geminiProjectId: defaultProjectName,
    geminiApiKey: '',
    hasPersonalKey: false,
    isCentralAccount: false
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/auth/ai-config/${encodeURIComponent(userId)}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data?.error || 'Config IA introuvable');
        setForm((prev) => ({
          ...prev,
          geminiApiEnabled: data.geminiApiEnabled !== false,
          geminiProjectId: String(data.geminiProjectId || defaultProjectName),
          geminiApiKey: '',
          hasPersonalKey: data.hasPersonalKey === true,
          isCentralAccount: data.isCentralAccount === true
        }));
      } catch (e) {
        if (!cancelled) alert(String(e?.message || 'Erreur chargement config IA'));
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/auth/ai-config/${encodeURIComponent(userId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiApiEnabled: form.geminiApiEnabled,
          geminiProjectId: form.geminiProjectId,
          geminiApiKey: form.geminiApiKey
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Sauvegarde impossible');
      setForm((prev) => ({
        ...prev,
        geminiApiEnabled: data.geminiApiEnabled !== false,
        geminiProjectId: String(data.geminiProjectId || ''),
        geminiApiKey: '',
        hasPersonalKey: data.hasPersonalKey === true || prev.hasPersonalKey
      }));
      alert(form.isCentralAccount ? "Compte central conservé." : "Configuration IA enregistrée.");
    } catch (e) {
      alert(String(e?.message || 'Sauvegarde impossible'));
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-[28px] bg-white border border-slate-200 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-slate-50">
          <div>
            <div className="text-[11px] font-black uppercase tracking-widest text-slate-400">IA Professeur</div>
            <h3 className="text-xl font-black text-slate-800">Configuration Gemini</h3>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-full border border-slate-200 text-slate-400 font-black">✕</button>
        </div>
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="text-sm font-bold text-slate-400">Chargement...</div>
          ) : form.isCentralAccount ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="font-black text-emerald-700">Compte central Vuillet</div>
              <div className="text-sm text-emerald-700 mt-1">
                Ce compte continue d'utiliser la clé Gemini centrale Condamine.
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <label className="flex items-center gap-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.geminiApiEnabled}
                    onChange={(e) => setForm((prev) => ({ ...prev, geminiApiEnabled: e.target.checked }))}
                  />
                  Activer l'IA avec ma propre clé Gemini
                </label>
                <input
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-bold outline-none"
                  placeholder="Nom repère dans Condamine"
                  value={form.geminiProjectId}
                  onChange={(e) => setForm((prev) => ({ ...prev, geminiProjectId: e.target.value }))}
                />
                <input
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-bold outline-none"
                  placeholder={form.hasPersonalKey ? 'Nouvelle clé Gemini (laisser vide pour conserver l’actuelle)' : 'Coller ici votre clé Gemini'}
                  value={form.geminiApiKey}
                  onChange={(e) => setForm((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                />
                <div className="text-xs text-slate-500 font-semibold">
                  {form.hasPersonalKey ? 'Une clé personnelle est déjà enregistrée.' : 'Aucune clé personnelle enregistrée.'}
                </div>
              </div>
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-slate-700">
                <div className="font-black text-indigo-700 mb-1">Créer sa clé Gemini</div>
                <div>1. Ouvre AI Studio avec ton compte Google.</div>
                <div>2. Crée une clé API Gemini dans AI Studio.</div>
                <div>3. Colle la clé ici. Le nom repère peut rester <strong>{form.geminiProjectId || defaultProjectName}</strong>.</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="px-4 py-2 rounded-xl bg-white border border-slate-300 font-black text-[12px] text-slate-700">
                  Ouvrir AI Studio
                </a>
              </div>
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 bg-white font-black text-[12px] text-slate-600">
            Fermer
          </button>
          <button onClick={handleSave} disabled={loading || saving} className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-black text-[12px] disabled:opacity-50">
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
