import React, { useState, useEffect, useMemo } from 'react';
import ControlList from '../controls/ControlList';

export default function LearnedWorkspace({ user, openItemId = '', onNavigate }) {
  const [activeSubTab, setActiveSubTab] = useState('fiches'); // 'fiches' | 'controls'
  const [learnedList, setLearnedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedDrafts, setExpandedDrafts] = useState({});
  const [expandedEssays, setExpandedEssays] = useState({});
  const [copiedId, setCopiedId] = useState(null);

  // Deep-link check: if URL has ?control=..., jump to controls tab
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('control') || openItemId) {
      setActiveSubTab('controls');
    }
  }, [openItemId]);

  const loadLearnedData = async () => {
    setLoading(true);
    try {
      const studentId = String(user?._id || user?.id || '').trim();
      if (!studentId) {
        setLearnedList([]);
        setLoading(false);
        return;
      }
      const res = await fetch(`/api/eleve/homework/learned/${studentId}`);
      if (res.ok) {
        const data = await res.json();
        setLearnedList(Array.isArray(data) ? data : []);
      } else {
        setLearnedList([]);
      }
    } catch (err) {
      console.error('[LearnedWorkspace] Erreur chargement fiches:', err);
      setLearnedList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLearnedData();
  }, [user?._id, user?.id]);

  const toggleDraft = (id) => {
    setExpandedDrafts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleEssay = (id) => {
    setExpandedEssays((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (item) => {
    const textParts = [
      `=== FICHE DE RÉVISION : ${item.homeworkTitle.toUpperCase()} ===`,
      item.promptTopic ? `Sujet : ${item.promptTopic}\n` : '',
      item.memoSheet ? `--- 🧠 FICHE MÉMO & PLAN CONSOLIDÉ ---\n${item.memoSheet}\n` : '',
      item.draftContent ? `--- 📝 BROUILLON D'ARGUMENTS & EXEMPLES ---\n${item.draftContent}\n` : '',
      item.finalEssay ? `--- ✍️ COPIE FINALE RENDUE ---\n${item.finalEssay}` : ''
    ].filter(Boolean).join('\n\n');

    try {
      await navigator.clipboard.writeText(textParts);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (_) {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = textParts;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return learnedList;
    const term = searchTerm.toLowerCase();
    return learnedList.filter((item) => {
      const title = (item.homeworkTitle || '').toLowerCase();
      const topic = (item.promptTopic || '').toLowerCase();
      const memo = (item.memoSheet || '').toLowerCase();
      const draft = (item.draftContent || '').toLowerCase();
      return title.includes(term) || topic.includes(term) || memo.includes(term) || draft.includes(term);
    });
  }, [learnedList, searchTerm]);

  // Total accumulated bonus points (capped at individual caps or max)
  const totalBonus = useMemo(() => {
    return learnedList.reduce((acc, curr) => acc + (Number(curr.examBonusPoints) || 0), 0);
  }, [learnedList]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      {/* 1. HERO HEADER */}
      <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-10 -mt-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-black uppercase tracking-wider">
              <span>💡 ESPACE MÉMORISATION & BROUILLONS</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">
              J'ai appris...
            </h1>
            <p className="text-amber-100 text-sm md:text-base max-w-2xl font-medium leading-relaxed">
              Consulte tes fiches mémo, tes plans consolidés et tes brouillons d'arguments affûtés. 
              Tout ce que tu as construit et perfectionné avec l'IA est archivé ici pour tes révisions de DS.
            </p>
          </div>

          {/* Quick Stats Pill */}
          <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-4 flex items-center gap-4 shrink-0">
            <div className="text-center px-2">
              <div className="text-2xl md:text-3xl font-black">{learnedList.length}</div>
              <div className="text-[10px] uppercase font-bold text-amber-200 tracking-wider">Fiches & Brouillons</div>
            </div>
            {totalBonus > 0 && (
              <>
                <div className="w-[1px] h-10 bg-white/20" />
                <div className="text-center px-2">
                  <div className="text-2xl md:text-3xl font-black text-amber-300">+{totalBonus.toFixed(1)} pt</div>
                  <div className="text-[10px] uppercase font-bold text-amber-200 tracking-wider">Bonus DS cumulé</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* SUB-TABS NAVIGATION */}
        <div className="mt-8 flex flex-wrap items-center gap-3 pt-4 border-t border-white/20">
          <button
            onClick={() => setActiveSubTab('fiches')}
            className={`px-5 py-2.5 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'fiches'
                ? 'bg-white text-rose-600 shadow-lg scale-105'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span>📑 Mes Fiches & Brouillons ({learnedList.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('controls')}
            className={`px-5 py-2.5 rounded-2xl font-black text-sm transition-all flex items-center gap-2 ${
              activeSubTab === 'controls'
                ? 'bg-white text-rose-600 shadow-lg scale-105'
                : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <span>📝 Contrôles & Évaluations sur table</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-TAB CONTENT */}
      {activeSubTab === 'controls' ? (
        <div className="bg-white rounded-3xl border-2 border-slate-100 shadow-sm p-4 md:p-6">
          <ControlList user={user} openItemId={openItemId} />
        </div>
      ) : (
        <div className="space-y-6">
          {/* SEARCH & FILTERS BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="relative w-full sm:w-80">
              <span className="absolute left-3.5 top-2.5 text-slate-400">🔍</span>
              <input
                type="text"
                placeholder="Rechercher par notion, date, exemple..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                onClick={loadLearnedData}
                disabled={loading}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5"
              >
                <span>{loading ? '⏳' : '🔄'}</span>
                <span>Actualiser</span>
              </button>
            </div>
          </div>

          {/* LIST OF LEARNED CARDS */}
          {loading ? (
            <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-100 shadow-sm">
              <div className="text-4xl animate-bounce mb-3">💡</div>
              <div className="text-sm font-bold text-slate-400">Chargement de tes fiches et brouillons...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center space-y-4">
              <div className="text-5xl">🌱</div>
              <h3 className="text-xl font-black text-slate-700">
                {searchTerm ? 'Aucune fiche ne correspond à ta recherche' : 'Aucune fiche de révision enregistrée pour le moment'}
              </h3>
              <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
                {searchTerm
                  ? 'Essaie avec d\'autres mots-clés (ex: "Athènes", "Monarchie", "AEI"...)'
                  : 'Dès que tu auras finalisé un devoir avec l\'IA en mode entraînement ou rédaction, ton plan consolidé, tes conseils majeurs et ton brouillon d\'arguments apparaîtront ici !'}
              </p>
              {!searchTerm && onNavigate && (
                <button
                  onClick={() => onNavigate('training')}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-lg transition transform active:scale-95 inline-flex items-center gap-2"
                >
                  <span>🎯 Commencer un entraînement</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredItems.map((item) => {
                const isDraftOpen = !!expandedDrafts[item.id];
                const isEssayOpen = !!expandedEssays[item.id];
                const isCopied = copiedId === item.id;
                const formattedDate = item.createdAt
                  ? new Date(item.createdAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : '';

                return (
                  <article
                    key={item.id}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
                  >
                    {/* CARD HEADER */}
                    <div className="p-5 md:p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-black uppercase tracking-wider">
                            {item.assessmentKind === 'rqp'
                              ? '✍️ RQP (Réponse Problématisée)'
                              : item.assessmentKind === 'commentaire'
                              ? '📖 Commentaire de document'
                              : '✍️ Rédaction'}
                          </span>
                          {formattedDate && (
                            <span className="text-xs font-bold text-slate-400">
                              📅 {formattedDate}
                            </span>
                          )}
                          {item.examBonusPoints > 0 && (
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-black flex items-center gap-1 shadow-sm">
                              <span>🎟️ +{item.examBonusPoints} pt au DS</span>
                              <span className="text-[9px] font-normal text-amber-700">(plafond {item.examBonusPointsMaxCap || 15.5})</span>
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-black text-slate-800 leading-tight">
                          {item.homeworkTitle}
                        </h2>
                        {item.promptTopic && (
                          <p className="text-xs text-slate-500 font-medium italic line-clamp-2">
                            « {item.promptTopic} »
                          </p>
                        )}
                      </div>

                      {/* COPY BUTTON */}
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item)}
                          className={`px-4 py-2.5 rounded-2xl font-black text-xs transition flex items-center gap-2 shadow-sm ${
                            isCopied
                              ? 'bg-emerald-600 text-white shadow-emerald-500/30'
                              : 'bg-white border border-slate-300 hover:border-amber-400 text-slate-700 hover:text-amber-700'
                          }`}
                        >
                          <span>{isCopied ? '✅' : '📋'}</span>
                          <span>{isCopied ? 'Fiche copiée !' : 'Copier ma fiche'}</span>
                        </button>
                      </div>
                    </div>

                    {/* CARD BODY: 1. MEMO SHEET */}
                    <div className="p-5 md:p-6 space-y-5">
                      {item.memoSheet ? (
                        <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🧠</span>
                            <h3 className="font-black text-indigo-950 text-sm uppercase tracking-wide">
                              Fiche Mémo DS (Plan consolidé & Conseils majeurs de l'IA)
                            </h3>
                          </div>
                          <div className="text-xs md:text-sm text-indigo-950 leading-relaxed font-medium whitespace-pre-wrap bg-white/80 p-4 rounded-xl border border-indigo-100">
                            {item.memoSheet}
                          </div>
                        </div>
                      ) : null}

                      {/* 2. DRAFT CONTENT (LE BROUILLON COMPLET D'ARGUMENTS & D'EXEMPLES) */}
                      {item.draftContent ? (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">📝</span>
                              <div>
                                <h3 className="font-black text-amber-950 text-sm uppercase tracking-wide">
                                  Brouillon final d'idées & d'arguments précis
                                </h3>
                                <p className="text-[11px] text-amber-800 font-medium">
                                  Contient les chiffres, dates, citations et arguments validés pour le DS
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => toggleDraft(item.id)}
                              className="text-xs font-bold text-amber-900 bg-amber-200/70 hover:bg-amber-200 px-3 py-1.5 rounded-xl transition"
                            >
                              {isDraftOpen ? '▲ Masquer' : '▼ Déplier le brouillon'}
                            </button>
                          </div>

                          {isDraftOpen ? (
                            <div className="text-xs md:text-sm text-slate-800 font-mono leading-relaxed whitespace-pre-wrap bg-white p-4 rounded-xl border border-amber-200 max-h-96 overflow-y-auto shadow-inner">
                              {item.draftContent}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-600 font-mono bg-white/70 p-3 rounded-xl border border-amber-100 line-clamp-3">
                              {item.draftContent}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* 3. FINAL ESSAY (COPIE RENDUE) */}
                      {item.finalEssay && (
                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => toggleEssay(item.id)}
                            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 transition"
                          >
                            <span>✍️ {isEssayOpen ? 'Masquer la copie finale rendue' : 'Consulter ma copie finale rédigée'}</span>
                            <span className="text-[10px]">{isEssayOpen ? '▲' : '▼'}</span>
                          </button>

                          {isEssayOpen && (
                            <div className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs md:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
                              {item.finalEssay}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
