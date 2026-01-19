import React from 'react';

export default function ProfNav({ activeTab, onTabChange, user }) {
  
  let tabs = [];

  if (user.isDeveloper) {
      // 1. LE DÉVELOPPEUR (Jean) : Accès Total
      tabs = [
          { id: 'activities', label: '⚡ ACTIVITÉS', color: 'bg-purple-600' },
          { id: 'students', label: '👥 ÉLÈVES', color: 'bg-blue-600' },
          { id: 'admin', label: '⚙️ ADMIN', color: 'bg-slate-800' }
      ];
  } else if (user.isAdmin) {
      // 2. L'ADMINISTRATEUR : Accès Admin Uniquement
      tabs = [
          { id: 'admin', label: '🛡️ ADMINISTRATION', color: 'bg-slate-800' }
      ];
  } else {
      // 3. LE PROFESSEUR : Accès Pédagogique Uniquement
      tabs = [
          { id: 'activities', label: '⚡ ACTIVITÉS', color: 'bg-purple-600' },
          { id: 'students', label: '👥 ÉLÈVES', color: 'bg-blue-600' }
      ];
  }

  return (
    <div className="flex gap-4 p-6 bg-white border-b overflow-x-auto no-scrollbar">
      {tabs.map(t => (
        <button 
            key={t.id} 
            onClick={() => onTabChange(t.id)} 
            className={`flex-1 min-w-[120px] py-4 rounded-2xl font-black text-xs transition-all ${activeTab === t.id ? t.color + ' text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
        >
            {t.label}
        </button>
      ))}
    </div>
  );
}