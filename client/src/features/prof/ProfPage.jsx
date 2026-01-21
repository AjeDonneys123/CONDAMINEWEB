import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import './ProfPage.css';

/**
 * 🎓 PAGE PROFESSEUR V107
 * Fix: "Silent Check" pour éviter l'erreur 404 au démarrage si le token est périmé.
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
        const userId = user.id || user._id;
        
        // V107 : Ajout du paramètre '?report-silent=true' pour que ConsoleReporter ignore l'erreur si l'ID est introuvable
        const resCls = await fetch('/api/admin/classrooms');
        const allCls = resCls.ok ? await resCls.json() : [];

        const resMe = await fetch(`/api/admin/teachers/${userId}?report-silent=true`);
        
        // Si l'identité fail (404 car ID périmé), on utilise le profil local (localStorage) en fallback silencieux
        const myProfile = resMe.ok ? await resMe.json() : user;

        let filteredCls = [];
        if (superUser.isDeveloper) {
            filteredCls = allCls;
        } else {
            const assignedIds = myProfile.assignedClasses || [];
            filteredCls = allCls.filter(c => assignedIds.some(id => String(id) === String(c._id)));
        }

        setClasses(filteredCls);
        
        if (filteredCls.length > 0) {
            const stillExists = filteredCls.some(c => String(c._id) === String(selectedClassId));
            if (!selectedClassId || !stillExists) {
                setSelectedClassId(filteredCls[0]._id);
            }
        }
    } catch(e) { 
        console.warn("⚠️ Toolbar Warn:", e.message); 
    }
    setLoading(false);
  };

  useEffect(() => { loadProfileAndClasses(); }, [tab]);

  const currentClassName = classes.find(c => String(c._id) === String(selectedClassId))?.name || "";

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={superUser} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center min-h-[70px]">
            <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest whitespace-nowrap">
                {superUser.isDeveloper ? '🛠️ MODE ARCHITECTE :' : '📚 MES CLASSES :'}
            </span>
            
            {loading ? (
                <span className="text-[10px] text-slate-300 font-black animate-pulse">CHARGEMENT...</span>
            ) : (
                <>
                    {classes.map(c => (
                        <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                                className={`px-5 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap border-2 ${String(selectedClassId) === String(c._id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                            {c.type === 'GROUP' ? '👥' : '🏫'} {c.name}
                        </button>
                    ))}
                    {classes.length === 0 && (
                        <span className="text-[10px] text-red-400 font-black italic uppercase">⚠️ AUCUNE AFFECTATION</span>
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
      <div className="fixed bottom-4 right-4 bg-indigo-600 text-white font-black text-[9px] px-4 py-2 rounded-full shadow-2xl z-[20000]">STUDIO V107</div>
    </div>
  );
}