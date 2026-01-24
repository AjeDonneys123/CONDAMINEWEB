import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import StudioDashboard from './studio/StudioDashboard'; 
import ClassroomManager from './classroom/ClassroomManager'; 
import ScansStudio from './scans/ScansStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const getInitialUser = () => {
      const isJean = (user.firstName === 'Jean' && user.lastName === 'Vuillet');
      return { ...user, isDeveloper: user.isDeveloper === true || isJean };
  };

  const [liveUser, setLiveUser] = useState(getInitialUser());
  const [tab, setTab] = useState('activities');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  
  // ÉTATS DE CHARGEMENT ET D'ERREUR
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const loadProfileAndClasses = async () => {
    setLoading(true);
    setFetchError(null); // Reset de l'erreur avant tentative
    
    try {
        const userId = liveUser.id || liveUser._id;
        
        // 1. Récupération des classes
        const resCls = await fetch('/api/admin/classrooms');
        if (!resCls.ok) throw new Error("Erreur chargement classes");
        const allCls = await resCls.json();

        // 2. Récupération du profil prof (pour les assignations)
        const resMe = await fetch(`/api/admin/teachers/${userId}?report-silent=true`);
        if (!resMe.ok) throw new Error("Erreur chargement profil");
        
        const freshProfile = await resMe.json();
        setLiveUser(prev => ({ ...prev, ...freshProfile, isDeveloper: prev.isDeveloper }));
        
        let filteredCls = [];
        if (liveUser.isDeveloper) filteredCls = allCls;
        else {
            const assignedIds = freshProfile.assignedClasses || [];
            filteredCls = allCls.filter(c => assignedIds.some(id => String(id) === String(c._id)));
        }
        
        setClasses(filteredCls);
        
        // Sélection par défaut intelligente
        if (filteredCls.length > 0) {
            const stillExists = filteredCls.some(c => String(c._id) === String(selectedClassId));
            if (!selectedClassId || !stillExists) setSelectedClassId(filteredCls[0]._id);
        }

    } catch(e) { 
        console.error("Sync Profile Error:", e.message);
        setFetchError("ÉCHEC CONNEXION"); // On capture l'erreur pour l'interface
    }
    setLoading(false);
  };

  useEffect(() => { loadProfileAndClasses(); }, [tab]);

  const currentClassObj = classes.find(c => String(c._id) === String(selectedClassId));
  const currentClassName = currentClassObj?.name || "";
  const currentLevel = currentClassObj?.level || "";

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={liveUser} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center min-h-[70px]">
            <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest whitespace-nowrap">
                {liveUser.isDeveloper ? '🛠️ MODE ARCHITECTE :' : '📚 MES CLASSES :'}
            </span>
            
            {loading ? (
                <span className="text-[10px] text-slate-300 font-black animate-pulse">CHARGEMENT EN COURS...</span>
            ) : fetchError ? (
                // BOUTON ROUGE SI ERREUR INTERNET
                <button onClick={loadProfileAndClasses} className="bg-red-500 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg animate-bounce flex items-center gap-2 hover:bg-red-600 transition-colors">
                    ⚠️ {fetchError} • RÉESSAYER
                </button>
            ) : classes.length === 0 ? (
                // CAS AUCUNE CLASSE TROUVÉE MAIS CONNEXION OK
                <span className="text-[10px] text-slate-400 font-bold italic bg-slate-100 px-3 py-1 rounded">Aucune classe assignée.</span>
            ) : (
                // LISTE DES CLASSES NORMALE
                <>
                    {classes.map(c => (
                        <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                                className={`px-5 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap border-2 flex items-center gap-2 ${String(selectedClassId) === String(c._id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                            {c.type === 'GROUP' ? '👥' : '🏫'} {c.name}
                            {c.level && <span className="bg-white/20 px-1 rounded text-[8px] opacity-70">{c.level}</span>}
                        </button>
                    ))}
                </>
            )}
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} user={liveUser} />
        
        <div className="p-8 bg-white min-h-[600px]">
          {/* SI ERREUR OU PAS DE CLASSE SÉLECTIONNÉE, ON AFFICHE UN MESSAGE */}
          {!selectedClassId && !loading && !fetchError ? (
             <div className="flex flex-col items-center justify-center h-[400px] text-slate-300">
                <span className="text-4xl mb-4">👈</span>
                <span className="font-black text-xl uppercase">SÉLECTIONNEZ UNE CLASSE CI-DESSUS</span>
             </div>
          ) : (
             <>
                {tab === 'activities' && <ActivityStudio globalClass={currentClassName} globalClassId={selectedClassId} globalLevel={currentLevel} user={liveUser} onRefreshRequest={loadProfileAndClasses} />}
                {tab === 'classroom' && <ClassroomManager globalClassId={selectedClassId} user={liveUser} />}
                {tab === 'scans' && <ScansStudio user={liveUser} globalClass={currentClassName} />}
                {tab === 'studio' && <StudioDashboard user={liveUser} />}
                {tab === 'students' && <StudentsManager globalClassId={selectedClassId} />}
                {tab === 'admin' && <AdminDashboard user={liveUser} onRefresh={loadProfileAndClasses} />}
             </>
          )}
        </div>
      </div>
      {liveUser.isDeveloper && <ConsoleReporter user={liveUser} />}
    </div>
  );
}