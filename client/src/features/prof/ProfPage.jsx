import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('activities');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  // --- SÉCURITÉ : GOD MODE (JEAN VUILLET) ---
  const isJean = (user.firstName === 'Jean' && user.lastName === 'Vuillet');
  const superUser = {
      ...user,
      isAdmin: user.isAdmin || isJean,
      isDeveloper: user.isDeveloper || isJean
  };

  const loadClasses = async () => {
    try {
        const res = await fetch('/api/admin/classrooms');
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) {
                setClasses(data);
                if (!selectedClassId && data.length > 0) setSelectedClassId(data[0]._id);
            }
        }
    } catch(e) {}
  };

  useEffect(() => { loadClasses(); }, []);

  const currentClassName = classes.find(c => c._id === selectedClassId)?.name || "";

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={superUser} onLogout={onLogout} />
        
        {/* SÉLECTEUR DE CLASSE */}
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center">
            {classes.length === 0 && <span className="text-xs text-slate-400 italic">Aucune classe. Créez-en une dans l'Admin.</span>}
            {classes.map(c => (
                <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                        className={`px-6 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap ${selectedClassId === c._id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border shadow-sm'}`}>
                    {c.type === 'GROUP' ? '🏷️ ' : ''}{c.name}
                </button>
            ))}
        </div>

        {/* NAVIGATION */}
        <ProfNav activeTab={tab} onTabChange={setTab} isAdmin={superUser.isAdmin} />
        
        <div className="p-8">
          {tab === 'activities' && <ActivityStudio globalClass={currentClassName} globalClassId={selectedClassId} user={superUser} />}
          {tab === 'students' && <StudentsManager globalClassId={selectedClassId} />}
          {tab === 'admin' && superUser.isAdmin && <AdminDashboard user={superUser} onRefresh={loadClasses} />}
          {tab === 'scans' && <div className="p-20 text-center text-slate-300 font-black uppercase">Module Scan bientôt disponible</div>}
        </div>
      </div>

      {superUser.isDeveloper && <ConsoleReporter user={superUser} />}
    </div>
  );
}