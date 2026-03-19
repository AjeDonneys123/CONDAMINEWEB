// @signatures: ProfHeader, checkDrive
import React, { useState, useEffect } from 'react';
import DatabaseViewer from './DatabaseViewer';
import DriveViewer from './DriveViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [drive, setDrive] = useState({ loading: true, ok: false, email: '' });
  const [aiUsage, setAiUsage] = useState({
    loading: true,
    remainingPct: 100,
    remainingUsd: 0,
    spentUsd: 0,
    budgetUsd: 0,
    promptTokens: 0,
    candidateTokens: 0,
    totalTokens: 0,
    measurement: 'estimated_local',
    googleCloudConfigured: false,
    googleCloudError: ''
  });

  const checkDrive = async () => {
    if (!user?.isDeveloper) {
      setDrive({ loading: false, ok: false, email: '' });
      return;
    }
    try {
      const userId = user.id || user._id;
      const res = await fetch(`/api/admin/drive-check?userId=${encodeURIComponent(userId || '')}`);
      const data = await res.json();
      setDrive({ loading: false, ok: data.ok, email: data.email });
    } catch (e) { setDrive({ loading: false, ok: false }); }
  };

  const loadAiUsage = async () => {
    if (!user?.isDeveloper) {
      setAiUsage((prev) => ({ ...prev, loading: false }));
      return;
    }
    try {
      const userId = user.id || user._id;
      const res = await fetch(`/api/admin/ai-usage?userId=${encodeURIComponent(userId || '')}&teacherId=${encodeURIComponent(userId || '')}`);
      const data = await res.json();
      const freeTier = data?.freeTier || {};
      const centralDay = data?.day?.central || {};
      setAiUsage({
        loading: false,
        remainingPct: Number(freeTier.remainingPct || 0),
        remainingUsd: Number(freeTier.remainingUsd || 0),
        spentUsd: Number(freeTier.spentUsd || 0),
        budgetUsd: Number(freeTier.budgetUsd || 0),
        promptTokens: Number(centralDay.promptTokens || freeTier.promptTokens || 0),
        candidateTokens: Number(centralDay.candidateTokens || freeTier.candidateTokens || 0),
        totalTokens: Number(centralDay.totalTokens || freeTier.totalTokens || 0),
        measurement: String(freeTier.measurement || 'estimated_local'),
        googleCloudConfigured: Boolean(freeTier.googleCloudConfigured),
        googleCloudError: String(freeTier.googleCloudError || '')
      });
    } catch (e) {
      setAiUsage((prev) => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    checkDrive();
    loadAiUsage();
    if (!user?.isDeveloper) return undefined;
    const timer = setInterval(loadAiUsage, 10000);
    return () => clearInterval(timer);
  }, [user?.id, user?._id, user?.isDeveloper]);

  const aiToneClass = aiUsage.remainingPct > 60
    ? 'bg-emerald-600'
    : aiUsage.remainingPct > 25
      ? 'bg-amber-500'
      : 'bg-red-600';
  const aiLabel = aiUsage.loading
    ? 'IA...'
    : `IA ${Math.round(aiUsage.remainingPct)}%`;
  const aiTitle = aiUsage.loading
    ? 'Chargement de la consommation IA...'
    : `Ressource IA restante aujourd'hui: ${aiUsage.remainingUsd.toFixed(2)}$ / ${aiUsage.budgetUsd.toFixed(2)}$ | Dépensé aujourd'hui: ${aiUsage.spentUsd.toFixed(4)}$ | Tokens envoyés aujourd'hui: ${aiUsage.promptTokens.toLocaleString('fr-FR')} | Tokens reçus aujourd'hui: ${aiUsage.candidateTokens.toLocaleString('fr-FR')} | Total tokens aujourd'hui: ${aiUsage.totalTokens.toLocaleString('fr-FR')} | Source: ${aiUsage.measurement === 'exact_google_cloud' ? 'Google Cloud exact pour le coût' : 'Fallback local estimé'}${aiUsage.googleCloudError ? ` | Erreur GCP: ${aiUsage.googleCloudError}` : ''}`;

  return (
    <>
        {/* --- VERSION BUREAU (Classe 'desktop-only-header' gérée par CSS strict) --- */}
        <div className="desktop-only-header p-8 pb-4 justify-between items-center bg-white border-b hidden md:flex">
          <div className="text-left">
            <h2 className="text-2xl font-black text-slate-800 uppercase">{user.firstName} {user.lastName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${drive.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-[10px] font-black uppercase text-slate-400">
                {drive.ok ? `PRO : ${drive.email}` : 'Drive Déconnecté'}
              </span>
            </div>
          </div>
          <div className="flex gap-3">
            {user?.isDeveloper && (
              <>
                <button title={aiTitle} className={`${aiToneClass} text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg`}>
                  {aiLabel}{!aiUsage.loading && aiUsage.measurement === 'exact_google_cloud' ? ' GCP' : ''}
                </button>
                <button onClick={() => setShowDrive(true)} className="bg-cyan-600 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform">☁️ DRIVE</button>
                <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase hover:scale-105 transition-transform">📊 BDD</button>
              </>
            )}
            <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border text-[10px] hover:text-red-500">✕</button>
          </div>
        </div>

        {/* --- VERSION MOBILE (Classe 'mobile-only-header') --- */}
        <div className="mobile-only-header items-center justify-between p-3 bg-white border-b shadow-sm sticky top-0 z-50 md:hidden flex">
            {/* GAUCHE : IDENTITÉ */}
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`w-2 h-2 shrink-0 rounded-full ${drive.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className="font-black text-slate-800 text-xs uppercase truncate">
                    {user.firstName} {user.lastName}
                </span>
            </div>

            {/* DROITE : ACTIONS COMPACTES */}
            <div className="flex items-center gap-2 shrink-0">
                {user?.isDeveloper && (
                  <>
                    <button title={aiTitle} className={`${aiToneClass} text-white px-2 py-1 rounded-lg font-black text-[8px] uppercase`}>
                      {aiLabel}{!aiUsage.loading && aiUsage.measurement === 'exact_google_cloud' ? ' GCP' : ''}
                    </button>
                    <button onClick={() => setShowDrive(true)} className="bg-cyan-600 text-white px-2 py-1 rounded-lg font-black text-[8px] uppercase">☁️ DRIVE</button>
                    <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-2 py-1 rounded-lg font-black text-[8px] uppercase">📊 BDD</button>
                  </>
                )}
                <button onClick={onLogout} className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full font-bold text-xs ml-1 border border-slate-200">✕</button>
            </div>
        </div>
      
        {/* MODALES */}
        {showDB && user?.isDeveloper && <DatabaseViewer user={user} onClose={() => setShowDB(false)} />}
        {showDrive && user?.isDeveloper && <DriveViewer user={user} onClose={() => setShowDrive(false)} />}
    </>
  );
}
