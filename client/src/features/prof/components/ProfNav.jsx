import React from 'react';

export default function ProfNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'students', label: '👥 ÉLÈVES', style: 'bg-blue-600' },
    { id: 'activities', label: '⚡ ACTIVITÉS', style: 'bg-purple-600' },
    { id: 'scans', label: '📤 SCANS IA', style: 'bg-emerald-600' }
  ];

  return (
    <div className="flex gap-4 p-6 bg-white border-b border-slate-100">
      {tabs.map(t => (
        <button 
          key={t.id}
          onClick={() => onTabChange(t.id)}
          className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all duration-200 ${
            activeTab === t.id 
            ? `${t.style} shadow-lg scale-105 text-white` 
            : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}