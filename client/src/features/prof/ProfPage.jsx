import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const isJean = (user.firstName === 'Jean' && user.lastName === 'Vuillet');
  
  const superUser = {
      ...user,
      isAdmin: user.isAdmin === true || isJean,
      isDeveloper: user.isDeveloper === true || isJean
  };

  // 1. DÉFINITION DE LA VUE PAR DÉFAUT SELON LE RÔLE
  // Si Admin => 'admin', Sinon => 'activities'
  const [tab, setTab] = useState(superUser.isAdmin ? 'admin' : 'activities');
  
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");

  const loadClasses = async () => {
    try {
        const res = await fetch('/api/admin/classrooms');
        if (res.ok) {
            const data = await res.json();
            setClasses(data);
            if (!selectedClassId && data.length > 0) setSelectedClassId(data[0]._id);
        }
    } catch(e) {}
  };

  useEffect(() => { loadClasses(); }, []);

  const currentClassName = classes.find(c => c._id === selectedClassId)?.name || "";

  // Est-ce un "Simple Prof" (Ni Admin, Ni Dev) ?
  const isSimpleProf = !superUser.isAdmin && !superUser.isDeveloper;

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={superUser} onLogout={onLogout} />
        
        {/* SÉLECTEUR DE CLASSE : Caché pour l'Admin pur (inutile), Visible pour Prof et Dev */}
        {(isSimpleProf || superUser.isDeveloper) && (
            <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center">
                {classes.map(c => (
                    <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                            className={`px-6 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap ${selectedClassId === c._id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border shadow-sm'}`}>
                        {c.name}
                    </button>
                ))}
            </div>
        )}

        {/* NAVIGATION INTELLIGENTE */}
        <ProfNav activeTab={tab} onTabChange={setTab} user={superUser} />
        
        <div className="p-8">
          {tab === 'activities' && <ActivityStudio globalClass={currentClassName} globalClassId={selectedClassId} user={superUser} />}
          {tab === 'students' && <StudentsManager globalClassId={selectedClassId} />}
          
          {/* Dashboard Admin sécurisé */}
          {tab === 'admin' && superUser.isAdmin && <AdminDashboard user={superUser} onRefresh={loadClasses} />}
        </div>
      </div>
      
      {superUser.isDeveloper && <ConsoleReporter user={superUser} />}
    </div>
  );
}