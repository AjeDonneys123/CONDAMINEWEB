import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  // Jean Vuillet est toujours considéré comme développeur suprême
  const isJean = (user.firstName === 'Jean' && user.lastName === 'Vuillet');
  
  // Construction de l'objet SuperUser avec les droits calculés
  const superUser = {
      ...user,
      isAdmin: user.isAdmin === true || isJean,
      isDeveloper: user.isDeveloper === true || isJean
  };

  // Vue par défaut intelligente
  const [tab, setTab] = useState(
      superUser.isDeveloper ? 'activities' : (superUser.isAdmin ? 'admin' : 'activities')
  );
  
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

  // Un "Simple Prof" est quelqu'un qui n'est NI admin NI dév.
  // Il a besoin du sélecteur de classe pour travailler.
  // Le développeur aussi en a besoin pour tester.
  const needsClassSelector = !superUser.isAdmin || superUser.isDeveloper;

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={superUser} onLogout={onLogout} />
        
        {/* SÉLECTEUR DE CLASSE */}
        {needsClassSelector && (
            <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center">
                <span className="text-[10px] font-black text-slate-300 mr-2 uppercase tracking-widest">Classe active :</span>
                {classes.map(c => (
                    <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                            className={`px-6 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap ${selectedClassId === c._id ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-400 border shadow-sm'}`}>
                        {c.name}
                    </button>
                ))}
                {classes.length === 0 && <span className="text-xs text-red-400 font-bold italic">Aucune classe configurée (Voir Admin)</span>}
            </div>
        )}

        {/* NAVIGATION */}
        <ProfNav activeTab={tab} onTabChange={setTab} user={superUser} />
        
        <div className="p-8 bg-white min-h-[600px]">
          {/* VUES PÉDAGOGIQUES (Prof + Dev) */}
          {(superUser.role === 'prof' || superUser.isDeveloper) && tab === 'activities' && (
             <ActivityStudio globalClass={currentClassName} globalClassId={selectedClassId} user={superUser} />
          )}
          
          {(superUser.role === 'prof' || superUser.isDeveloper) && tab === 'students' && (
             <StudentsManager globalClassId={selectedClassId} />
          )}
          
          {/* VUE ADMINISTRATIVE (Admin + Dev) */}
          {superUser.isAdmin && tab === 'admin' && (
             <AdminDashboard user={superUser} onRefresh={loadClasses} />
          )}
        </div>
      </div>
      
      {/* OUTILS DE DEBUG POUR LE DÉVELOPPEUR */}
      {superUser.isDeveloper && <ConsoleReporter user={superUser} />}
    </div>
  );
}