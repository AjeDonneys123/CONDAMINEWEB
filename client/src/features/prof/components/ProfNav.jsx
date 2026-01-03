import React from 'react';

export default function ProfNav({ activeTab, onTabChange }) {
  // Correction Tailwind : On définit les couleurs explicitement pour que le compilateur les voie
  const tabs = [
    { id: 'students', label: '👥 ÉLÈVES', style: 'bg-blue-600 shadow-blue-200 text-white' },
    { id: 'homework', label: '📚 DEVOIRS', style: 'bg-orange-500 shadow-orange-200 text-white' },
    { id: 'games', label: '🎮 JEUX', style: 'bg-purple-600 shadow-purple-200 text-white' }
  ];

  return (
    <div className="flex gap-4 p-6 bg-white border-b border-slate-100">
      {tabs.map(t => (
        <button 
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all duration-200 ${
            activeTab === t.id 
            ? `${t.style} shadow-lg scale-105` 
            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}