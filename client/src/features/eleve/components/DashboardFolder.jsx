import React, { useState } from 'react';

export default function DashboardFolder({ items, chapters, type, onSelect }) {
  const [openChaps, setOpenChaps] = useState({});
  const getSubjectStyle = (sub) => {
    if (sub === 'H') return { color: '#ef4444', text: 'text-red-600', bg: 'bg-red-50', icon: '🏰' };
    if (sub === 'G') return { color: '#3b82f6', text: 'text-blue-600', bg: 'bg-blue-50', icon: '🌍' };
    return { color: '#22c55e', text: 'text-green-600', bg: 'bg-green-50', icon: '⚖️' };
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {chapters.map(chap => {
          const info = getSubjectStyle(chap.subject);
          const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
          if (chapItems.length === 0) return null;
          const isOpen = openChaps[chap._id];
          return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 border-pink-50 overflow-hidden shadow-sm">
                <button onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})} className={`w-full p-6 flex justify-between items-center ${isOpen ? info.bg : ''}`}>
                    <span className="font-black text-slate-700">{info.icon} {chap.title}</span>
                    <span>{isOpen ? '▲' : '▼'}</span>
                </button>
                {isOpen && <div className="p-4 space-y-2">
                    {chapItems.map(it => (
                        <div key={it._id} onClick={() => onSelect(it)} className="bg-slate-50 p-4 rounded-2xl flex justify-between cursor-pointer hover:bg-pink-50">
                            <span className="font-bold text-slate-600">{it.title}</span>
                            <span className="text-pink-400">➔</span>
                        </div>
                    ))}
                </div>}
            </div>
          );
      })}
    </div>
  );
}