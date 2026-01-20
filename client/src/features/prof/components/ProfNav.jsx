import React from 'react';

/**
 * 🧭 NAVIGATION PROF/ADMIN V30
 * Gère l'affichage des onglets selon le statut isDeveloper et le Rôle.
 */
export default function ProfNav({ activeTab, onTabChange, user }) {
  
  let tabs = [];

  // 1. DÉVELOPPEUR (Jean ou promu) : Accès Total
  if (user.isDeveloper) {
      tabs = [
          { id: 'activities', label: '⚡ ACTIVITÉS', color: 'bg-purple-600' },
          { id: 'students', label: '👥 ÉLÈVES', color: 'bg-blue-600' },
          { id: 'admin', label: '⚙️ DÉVELOPPEUR', color: 'bg-slate-900' }
      ];
  } 
  // 2. ADMIN STAFF PUR (Proviseur) : Accès Gestion
  else if (user.role === 'admin') {
      tabs = [
          { id: 'admin', label: '🛡️ ADMINISTRATION', color: 'bg-slate-800' }
      ];
  } 
  // 3. PROF PUR : Accès Pédagogique
  else {
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