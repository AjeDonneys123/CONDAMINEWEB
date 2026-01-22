import React, { useState } from 'react';

/**
 * 📂 DASHBOARD FOLDER ÉLÈVE V205 - STATUS BADGES
 * Ajout des pastilles Vertes/Rouges selon le statut 'done' passé dans les items.
 */
export default function DashboardFolder({ items, chapters, type, onSelect }) {
  const [openChaps, setOpenChaps] = useState({});
  const getSubjectStyle = (sub) => {
    if (sub === 'H') return { color: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', icon: '🏰' };
    if (sub === 'G') return { color: '#3b82f6', text: 'text-blue-600', bg: 'bg-blue-50', icon: '🌍' };
    return { color: '#22c55e', text: 'text-green-600', bg: 'bg-green-50', icon: '⚖️' };
  };

  const relevantChapters = chapters.filter(chap => {
      const itemsInChap = items.filter(it => String(it.chapterId) === String(chap._id));
      return itemsInChap.length > 0;
  });

  if (relevantChapters.length === 0) return (
      <div className="p-12 text-center">
          <div className="text-4xl mb-4">📭</div>
          <p className="font-bold text-slate-400 text-sm">Aucun {type === 'homework' ? 'devoir' : 'jeu'} disponible.</p>
      </div>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {relevantChapters.map(chap => {
          const info = getSubjectStyle(chap.subject);
          const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
          const isOpen = openChaps[chap._id];
          
          return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 border-pink-50 overflow-hidden shadow-sm animate-in">
                <button onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})} className={`w-full p-6 flex justify-between items-center ${isOpen ? info.bg : 'hover:bg-pink-50/50'}`}>
                    <div className="flex items-center gap-4">
                        <span className="text-2xl">{info.icon}</span>
                        <div className="flex flex-col items-start">
                            <span className="font-black text-slate-700 uppercase">{chap.title}</span>
                            {chap.classroom && <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded text-slate-400 font-bold">{chap.classroom}</span>}
                        </div>
                    </div>
                    <span className="font-bold text-pink-300">{isOpen ? '▲' : '▼'}</span>
                </button>
                
                {isOpen && <div className="p-4 space-y-2 border-t border-pink-50">
                    {chapItems.map(it => (
                        <div key={it._id} onClick={() => onSelect(it)} className="bg-white p-5 rounded-2xl flex justify-between items-center cursor-pointer hover:shadow-md border border-slate-50 transition-all">
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700">{it.title}</span>
                                {it.targetClassrooms && <span className="text-[9px] text-slate-400 font-bold">{it.targetClassrooms.join(', ')}</span>}
                            </div>
                            
                            {/* --- STATUS PASTILLE --- */}
                            {it.isDone ? (
                                <span className="px-3 py-1 bg-green-100 text-green-600 rounded-full text-[10px] font-black border border-green-200">
                                    ✅ FAIT
                                </span>
                            ) : (
                                <span className="px-3 py-1 bg-red-50 text-red-400 rounded-full text-[10px] font-black border border-red-100 animate-pulse">
                                    ⭕ À FAIRE
                                </span>
                            )}
                        </div>
                    ))}
                </div>}
            </div>
          );
      })}
    </div>
  );
}