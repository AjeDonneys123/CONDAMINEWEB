import React, { useState, useEffect } from 'react';

export default function DashboardFolder({ items, chapters, type, onSelect }) {
  const [openChaps, setOpenChaps] = useState({});
  const [allPlayers, setAllPlayers] = useState([]);

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(data => setAllPlayers(data || []));
  }, []);

  const getSubjectStyle = (sub) => {
    if (sub === 'H') return { code: 'H', label: 'Histoire', color: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', icon: '🏰' };
    if (sub === 'G') return { code: 'G', label: 'Géographie', color: '#3b82f6', text: 'text-blue-600', bg: 'bg-blue-50', icon: '🌍' };
    if (sub === 'E') return { code: 'E', label: 'EMC', color: '#22c55e', text: 'text-green-600', bg: 'bg-green-50', icon: '⚖️' };
    return { code: 'A', label: 'Autre', color: '#94a3b8', text: 'text-slate-500', bg: 'bg-slate-50', icon: '📁' };
  };

  const renderSection = (subCode, isArchived) => {
    const info = getSubjectStyle(subCode);
    const myChapters = (chapters || []).filter(c => c.isArchived === isArchived && c.subject === subCode);
    const chapsWithItems = myChapters.filter(chap => 
        (items || []).some(it => it.chapterId?.toString() === chap._id?.toString())
    );

    if (chapsWithItems.length === 0) return null;

    return (
      <div key={subCode + isArchived} className="mb-10 animate-in fade-in">
        <h3 className={`text-[10px] font-black mb-4 px-6 uppercase tracking-widest ${info.text}`}>
          {info.icon} {info.label} {isArchived ? '(Archives)' : ''}
        </h3>
        <div className="space-y-4">
          {chapsWithItems.map(chap => {
            const chapItems = (items || []).filter(it => it.chapterId?.toString() === chap._id?.toString());
            const isOpen = openChaps[chap._id];

            return (
              <div key={chap._id} className="bg-white rounded-[35px] border-2 border-pink-50 overflow-hidden shadow-sm transition-all">
                <button 
                  onClick={() => setOpenChaps(p => ({...p, [chap._id]: !isOpen}))}
                  className={`w-full p-6 flex justify-between items-center transition-all ${isOpen ? info.bg : 'hover:bg-pink-50/20'}`}
                >
                  <span className="font-black text-slate-700 text-lg text-left">{chap.title}</span>
                  <span className="font-black" style={{ color: info.color }}>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && (
                  <div className="p-4 bg-slate-50/50 space-y-2">
                    {chapItems.map(it => {
                      // Détection des noms d'élèves ciblés
                      let targetLabel = "";
                      if (it.targetPlayerIds && it.targetPlayerIds.length > 0) {
                          const names = it.targetPlayerIds.map(id => {
                              const p = allPlayers.find(x => x._id === id);
                              return p ? p.firstName : "...";
                          });
                          targetLabel = ` pour ${names.join(', ')}`;
                      }

                      return (
                        <div 
                          key={it._id} 
                          onClick={() => onSelect(it)}
                          className="bg-white p-5 rounded-2xl flex justify-between items-center cursor-pointer border border-transparent hover:border-pink-300 shadow-sm transition-all"
                        >
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-600">{type === 'game' ? '🕹️ ' : '📄 '}{it.title}</span>
                            {targetLabel && <span className="text-[9px] font-black text-orange-400 uppercase">{targetLabel}</span>}
                          </div>
                          <span className="text-pink-400 font-black">➔</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      {['H', 'G', 'E'].map(s => renderSection(s, false))}
      {(chapters || []).some(c => c.isArchived) && (
          <div className="mt-20 pt-10 border-t-4 border-dashed border-pink-100 opacity-50">
              <h2 className="text-center font-black text-pink-300 uppercase tracking-widest text-xl mb-10">📂 Archives des dossiers passés</h2>
              {['H', 'G', 'E'].map(s => renderSection(s, true))}
          </div>
      )}
    </div>
  );
}