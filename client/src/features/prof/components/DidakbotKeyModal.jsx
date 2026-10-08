import React, { useState } from 'react';

const makeKeyRow = (row = {}, index = 0) => ({
  name: String(row?.name || (index === 0 ? 'Clé principale' : `Clé ${index + 1}`)),
  key: String(row?.key || '').trim().toUpperCase(),
  isDefault: row?.isDefault === true
});

export default function DidakbotKeyModal({ user, onClose, onKeyUpdated }) {
  const legacyKey = String(user?.didakbotKey || window.localStorage.getItem('conda_didakbot_key') || '').trim().toUpperCase();
  const initialKeys = Array.isArray(user?.didakbotKeys) && user.didakbotKeys.length
    ? user.didakbotKeys.map(makeKeyRow)
    : legacyKey ? [{ name: 'Clé principale', key: legacyKey, isDefault: true }] : [{ name: 'Clé principale', key: '', isDefault: true }];
  const initialDefault = Math.max(0, initialKeys.findIndex((row) => row.isDefault));
  const [keys, setKeys] = useState(initialKeys);
  const [defaultIndex, setDefaultIndex] = useState(initialDefault);
  const [copiedIndex, setCopiedIndex] = useState(-1);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState('');

  const updateKey = (index, field, value) => setKeys((previous) => previous.map((row, rowIndex) => rowIndex === index ? { ...row, [field]: field === 'key' ? value.toUpperCase() : value } : row));
  const addKey = () => setKeys((previous) => [...previous, { name: `Clé ${previous.length + 1}`, key: '', isDefault: false }]);
  const removeKey = (index) => {
    setKeys((previous) => previous.filter((_, rowIndex) => rowIndex !== index));
    setDefaultIndex((previous) => index === previous ? Math.max(0, previous - 1) : index < previous ? previous - 1 : previous);
  };

  const handleCopy = async (key, index) => {
    if (!key.trim()) return;
    try {
      await navigator.clipboard.writeText(key.trim());
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(-1), 2000);
    } catch (_) { setError('Copie impossible dans ce navigateur.'); }
  };

  const handleSave = async () => {
    const cleanKeys = keys.map((row, index) => ({
      name: String(row.name || '').trim(),
      key: String(row.key || '').trim().toUpperCase(),
      isDefault: index === defaultIndex
    })).filter((row) => row.name && row.key);
    if (keys.some((row) => String(row.key || '').trim() && !String(row.name || '').trim())) return setError('Donne un nom à chaque clé renseignée.');
    if (!cleanKeys.length) return setError('Ajoute au moins une clé Didak’bot.');
    setSaving(true); setSavedSuccess(false); setError('');
    try {
      const userId = user?.id || user?._id;
      if (!userId) throw new Error('Compte enseignant introuvable.');
      const response = await fetch(`/api/admin/teachers/${userId}/didakbot-key`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: cleanKeys })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result?.ok !== true) throw new Error(result?.error || 'Sauvegarde impossible.');
      const primaryKey = String(result.didakbotKey || cleanKeys[0].key);
      window.localStorage.setItem('conda_didakbot_key', primaryKey);
      if (onKeyUpdated) onKeyUpdated(primaryKey, result.didakbotKeys || cleanKeys);
      setKeys((result.didakbotKeys || cleanKeys).map(makeKeyRow));
      setDefaultIndex(Math.max(0, (result.didakbotKeys || cleanKeys).findIndex((row) => row.isDefault)));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      setError(e.message || 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fadeIn" onClick={onClose}>
      <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5"><span className="text-2xl">🤖</span><div><h3 className="text-base font-black text-slate-800">Mes Chatbots Pédagogiques (Didak'bot 3)</h3><p className="text-[11px] font-medium text-slate-400">Plateforme libre NovaPéda · 0 € Coût API</p></div></div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold">✕</button>
        </div>

        <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-cyan-950 tracking-wider"><span>🔑</span><span>Identifiants enseignants Didak’bot</span></div>
          <p className="text-xs text-slate-600 leading-relaxed">Enregistre plusieurs clés et donne à chacune un nom pour retrouver les bots concernés. La clé marquée <b>Principale</b> reste celle utilisée par les outils CondaWeb existants.</p>

          <div className="space-y-3">
            {keys.map((row, index) => (
              <div key={`didakbot-key-${index}`} className="rounded-xl border border-cyan-200 bg-white p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input aria-label={`Nom de la clé ${index + 1}`} value={row.name} onChange={(event) => updateKey(index, 'name', event.target.value)} placeholder="Nom, ex. 2A RQP" maxLength={60} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800" />
                  <label className="flex shrink-0 items-center gap-1 text-[11px] font-black text-cyan-800"><input type="radio" name="didakbot-primary-key" checked={defaultIndex === index} onChange={() => setDefaultIndex(index)} /> Principale</label>
                  {keys.length > 1 && <button type="button" onClick={() => removeKey(index)} aria-label={`Supprimer la clé ${index + 1}`} className="rounded-lg px-2 py-1 font-black text-red-500 hover:bg-red-50">×</button>}
                </div>
                <div className="flex gap-2">
                  <input aria-label={`Clé Didak’bot ${index + 1}`} type="text" value={row.key} onChange={(event) => updateKey(index, 'key', event.target.value)} placeholder="Ex. K2L6SK8B" className="min-w-0 flex-1 rounded-lg border border-cyan-200 px-3 py-2 font-mono text-sm font-black uppercase tracking-wider text-cyan-900" />
                  <button type="button" onClick={() => handleCopy(row.key, index)} disabled={!row.key.trim()} className="rounded-lg border border-cyan-200 px-3 py-2 text-xs font-black text-cyan-900 disabled:opacity-40">{copiedIndex === index ? '✓ Copié' : '📋 Copier'}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={addKey} disabled={keys.length >= 20} className="rounded-xl border border-cyan-300 bg-white px-4 py-2.5 text-xs font-black text-cyan-900 disabled:opacity-40">＋ Ajouter une clé</button>
            <button type="button" onClick={handleSave} disabled={saving} className={`rounded-xl px-4 py-2.5 text-xs font-black text-white shadow-md ${savedSuccess ? 'bg-emerald-600' : 'bg-cyan-600 hover:bg-cyan-700'}`}>{saving ? 'Enregistrement…' : savedSuccess ? '✓ Enregistré' : 'Enregistrer les clés'}</button>
          </div>
          {error && <p role="alert" className="text-xs font-bold text-red-600">{error}</p>}
          <div className="text-[11px] text-cyan-800">✓ Les clés et leurs noms sont conservés sur CondamineWeb et synchronisés sur vos appareils.</div>
        </div>

        <div className="flex flex-col items-center justify-between gap-3 pt-1 sm:flex-row">
          <a href="https://novapeda.eu/didakbot3.php" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white shadow-md hover:bg-slate-800">🚀 Ouvrir Didak'bot 3 (NovaPéda) ↗</a>
          <button type="button" onClick={onClose} className="w-full sm:w-auto rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-600 hover:bg-slate-50">Fermer</button>
        </div>
      </div>
    </div>
  );
}
