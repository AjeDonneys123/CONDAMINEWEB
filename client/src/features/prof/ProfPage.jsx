import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import './ProfPage.css';

/**
 * 🎓 PAGE PROFESSEUR V53
 * Filtrage dynamique de la barre "Classe Active" selon les affectations réelles.
 */
export default function ProfPage({ user, onLogout }) {
  const isJean = (user.firstName === 'Jean' && user.lastName === 'Vuillet');
  const superUser = { ...user, isDeveloper: user.isDeveloper === true || isJean };

  const [tab, setTab] = useState(superUser.isDeveloper ? 'activities' : (user.role === 'admin' ? 'admin' : 'activities'));
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfileAndClasses = async () => {
    setLoading(true);
    try {
        // 1. Récupérer toutes les classes de l'établissement
        const resCls = await fetch('/api/admin/classrooms');
        const allCls = await resCls.json();

        // 2. Récupérer le profil à jour pour les affectations
        const resMe = await fetch(`/api/admin/teachers/${user.id || user._id}`);
        const myProfile = await resMe.json();

        // 3. LOGIQUE DE FILTRAGE V53
        let filteredCls = [];
        
        if (superUser.isDeveloper) {
            // Le développeur voit tout pour pouvoir tester n'importe quelle classe
            filteredCls = allCls;
        } else {
            // Le prof ne voit que ce qui lui est assigné
            const assignedIds = myProfile.assignedClasses || [];
            filteredCls = allCls.filter(c => assignedIds.includes(c._id));
        }

        setClasses(filteredCls);
        
        // Sélection par défaut : la première de la liste filtrée
        if (filteredCls.length > 0 && !selectedClassId) {
            setSelectedClassId(filteredCls[0]._id);
        }
    } catch(e) { console.error("❌ ProfPage Load Error:", e); }
    setLoading(false);
  };

  // Rechargement quand on revient sur la page ou qu'on change d'onglet Admin
  useEffect(() => { loadProfileAndClasses(); }, [tab]);

  const currentClassName = classes.find(c => c._id === selectedClassId)?.name || "";

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={superUser} onLogout={onLogout} />
        
        {/* BANDEAU CLASSE ACTIVE (V53 : FILTRÉ) */}
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center min-h-[70px]">
            <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest whitespace-nowrap">
                {superUser.isDeveloper ? '🛠️ TOUTES LES CLASSES :' : '📚 MES CLASSES :'}
            </span>
            
            {loading ? (
                <div className="flex gap-2">
                    <div className="w-16 h-8 bg-slate-200 animate-pulse rounded-lg"></div>
                    <div className="w-16 h-8 bg-slate-200 animate-pulse rounded-lg"></div>
                </div>
            ) : (
                <>
                    {classes.map(c => (
                        <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                                className={`px-5 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap border-2 ${selectedClassId === c._id ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                            {c.type === 'GROUP' ? '👥' : '🏫'} {c.name}
                        </button>
                    ))}
                    {classes.length === 0 && (
                        <span className="text-[10px] text-red-400 font-black italic uppercase">
                            ⚠️ Aucune classe affectée. Contactez l'administrateur.
                        </span>
                    )}
                </>
            )}
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} user={superUser} />
        
        <div className="p-8 bg-white min-h-[600px]">
          {tab === 'activities' && <ActivityStudio globalClass={currentClassName} globalClassId={selectedClassId} user={superUser} />}
          {tab === 'students' && <StudentsManager globalClassId={selectedClassId} />}
          {tab === 'admin' && <AdminDashboard user={superUser} onRefresh={loadProfileAndClasses} />}
        </div>
      </div>
      
      {superUser.isDeveloper && <ConsoleReporter user={superUser} />}
      <div className="fixed bottom-4 right-4 bg-indigo-600 text-white font-black text-[9px] px-4 py-2 rounded-full shadow-2xl z-[20000]">STUDIO V53</div>
    </div>
  );
}