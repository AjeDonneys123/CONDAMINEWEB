import React from 'react';

export default function ProfNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'students', label: '👥 ÉLÈVES', style: 'bg-blue-600', short: '👥' },
    { id: 'activities', label: '⚡ ACTIVITÉS', style: 'bg-purple-600', short: '⚡' },
    { id: 'scans', label: '📤 SCANS IA', style: 'bg-emerald-600', short: '📤' }
  ];

  return (
    <div className="flex gap-2 p-3 bg-white border-b border-slate-100 sm:p-6 sm:gap-4">
      {tabs.map(t => (
        <button 
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex-1 py-3 px-1 sm:py-4 rounded-2xl font-black text-xs sm:text-lg transition-all duration-200 ${
            activeTab === t.id 
            ? `${t.style} shadow-lg text-white scale-105` 
            : 'bg-slate-50 text-slate-400'
          }`}
        >
          {/* Affiche le texte court sur mobile, long sur PC */}
          <span className="hidden sm:inline">{t.label}</span>
          <span className="sm:hidden">{t.label.split(' ')[1]}</span>
        </button>
      ))}
    </div>
  );
}