import React from 'react';

export default function ProfNav({ activeTab, onTabChange, user }) {
  
  // Configuration centralisée des onglets
  const allTabs = {
      activities: { id: 'activities', label: '⚡ ACTIVITÉS', color: 'bg-purple-600' },
      classroom: { id: 'classroom', label: '🎓 CLASSE', color: 'bg-emerald-600' },
      scans: { id: 'scans', label: '📸 SCAN', color: 'bg-orange-500' },
      // Ces deux onglets seront masqués sur mobile via la propriété hideOnMobile
      studio: { id: 'studio', label: '🎬 STUDIO', color: 'bg-pink-600', hideOnMobile: true }, 
      students: { id: 'students', label: '👥 ÉLÈVES', color: 'bg-blue-600', hideOnMobile: true },
      admin: { id: 'admin', label: '⚙️ DEV', color: 'bg-slate-900' }
  };

  let tabs = [];

  if (user.isDeveloper) {
      tabs = [allTabs.activities, allTabs.classroom, allTabs.scans, allTabs.studio, allTabs.students, allTabs.admin];
  } 
  else if (user.role === 'admin') {
      tabs = [ { id: 'admin', label: '🛡️ ADMINISTRATION', color: 'bg-slate-800' } ];
  } 
  else {
      // Professeur standard
      tabs = [allTabs.activities, allTabs.classroom, allTabs.scans, allTabs.studio, allTabs.students];
  }

  return (
    <div className="flex gap-4 p-6 bg-white border-b overflow-x-auto no-scrollbar">
      {tabs.map(t => (
        <button 
            key={t.id} 
            onClick={() => onTabChange(t.id)} 
            className={`
                flex-1 min-w-[120px] py-4 rounded-2xl font-black text-xs transition-all 
                ${activeTab === t.id ? t.color + ' text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}
                ${t.hideOnMobile ? 'hidden md:block' : ''} 
            `}
        >
            {t.label}
        </button>
      ))}
    </div>
  );
}