import React from 'react';

export default function ProfNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'students', label: '👥 ÉLÈVES', color: 'blue' },
    { id: 'homework', label: '📚 DEVOIRS', color: 'orange' },
    { id: 'games', label: '🎮 JEUX', color: 'purple' }
  ];

  return (
    <div className="flex gap-2 p-4 bg-white">
      {tabs.map(t => (
        <button 
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex-1 py-5 rounded-3xl font-black text-lg transition-all ${
            activeTab === t.id 
            ? `bg-${t.color}-600 text-white shadow-xl shadow-${t.color}-100 scale-105` 
            : 'text-slate-400 hover:bg-slate-50'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}