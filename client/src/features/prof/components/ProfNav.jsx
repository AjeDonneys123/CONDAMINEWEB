import React from 'react';

export default function ProfNav({ activeTab, onTabChange, user }) {
  
  const allTabs = {
      activities: { id: 'activities', label: '⚡ ACTIVITÉS', color: 'bg-purple-600' },
      classroom: { id: 'classroom', label: '🎓 CLASSE', color: 'bg-emerald-600' },
      scans: { id: 'scans', label: '📸 SCAN', color: 'bg-orange-500' },
      studio: { id: 'studio', label: '🎬 STUDIO', color: 'bg-pink-600', hideOnMobile: true }, 
      students: { id: 'students', label: '👥 ÉLÈVES', color: 'bg-blue-600', hideOnMobile: true },
      admin: { id: 'admin', label: '⚙️ DEV', color: 'bg-slate-900' }
  };

  let tabs = [];

  if (user.isDeveloper) {
      tabs = [allTabs.activities, allTabs.classroom, allTabs.scans, allTabs.studio, allTabs.students, allTabs.admin];
  } else if (user.role === 'admin') {
      tabs = [ { id: 'admin', label: '🛡️ ADMIN', color: 'bg-slate-800' } ];
  } else {
      tabs = [allTabs.activities, allTabs.classroom, allTabs.scans, allTabs.studio, allTabs.students];
  }

  return (
    /* MODIF : Padding réduit sur mobile (p-2) et plus grand sur PC (md:p-6) */
    <div className="flex gap-2 md:gap-4 p-2 md:p-6 bg-white border-b overflow-x-auto no-scrollbar justify-between md:justify-start sticky top-0 z-30">
      {tabs.map(t => (
        <button 
            key={t.id} 
            onClick={() => onTabChange(t.id)} 
            className={`
                /* MODIF : Flex-1 pour équilibrer sur mobile, min-width réduit */
                flex-1 md:flex-none min-w-[30%] md:min-w-[120px] 
                py-3 md:py-4 rounded-xl md:rounded-2xl 
                font-black text-[10px] md:text-xs transition-all 
                ${activeTab === t.id ? t.color + ' text-white shadow-md scale-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}
                ${t.hideOnMobile ? 'hidden md:block' : ''} 
            `}
        >
            {t.label}
        </button>
      ))}
    </div>
  );
}