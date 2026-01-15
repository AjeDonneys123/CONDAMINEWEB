import React from 'react';
export default function ProfNav({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'students', label: '👥 ÉLÈVES', color: 'bg-blue-600' },
    { id: 'activities', label: '⚡ ACTIVITÉS', color: 'bg-purple-600' },
    { id: 'scans', label: '📤 SCANS IA', color: 'bg-emerald-600' }
  ];
  return (
    <div className="flex gap-4 p-6 bg-white border-b">
      {tabs.map(t => (
        <button key={t.id} onClick={() => onTabChange(t.id)} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${activeTab === t.id ? t.color + ' text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400'}`}>{t.label}</button>
      ))}
    </div>
  );
}