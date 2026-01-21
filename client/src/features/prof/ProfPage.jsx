import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import AdminDashboard from './admin/AdminDashboard';
import ConsoleReporter from './components/ConsoleReporter';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const getInitialUser = () => {
      const isJean = (user.firstName === 'Jean' && user.lastName === 'Vuillet');
      return { ...user, isDeveloper: user.isDeveloper === true || isJean };
  };

  const [liveUser, setLiveUser] = useState(getInitialUser());
  const [tab, setTab] = useState(liveUser.isDeveloper ? 'activities' : (user.role === 'admin' ? 'admin' : 'activities'));
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfileAndClasses = async () => {
    setLoading(true);
    try {
        const userId = liveUser.id || liveUser._id;
        const resCls = await fetch('/api/admin/classrooms');
        const allCls = resCls.ok ? await resCls.json() : [];

        const resMe = await fetch(`/api/admin/teachers/${userId}?report-silent=true`);
        
        if (resMe.ok) {
            const freshProfile = await resMe.json();
            setLiveUser(prev => ({ ...prev, ...freshProfile, isDeveloper: prev.isDeveloper }));
            
            let filteredCls = [];
            if (liveUser.isDeveloper) {
                filteredCls = allCls;
            } else {
                const assignedIds = freshProfile.assignedClasses || [];
                filteredCls = allCls.filter(c => assignedIds.some(id => String(id) === String(c._id)));
            }
            setClasses(filteredCls);

            if (filteredCls.length > 0) {
                const stillExists = filteredCls.some(c => String(c._id) === String(selectedClassId));
                if (!selectedClassId || !stillExists) {
                    setSelectedClassId(filteredCls[0]._id);
                }
            }
        }
    } catch(e) { console.warn("Sync Profile Warn:", e.message); }
    setLoading(false);
  };

  useEffect(() => { loadProfileAndClasses(); }, [tab]);

  // Récupération intelligente de la classe ET du niveau
  const currentClassObj = classes.find(c => String(c._id) === String(selectedClassId));
  const currentClassName = currentClassObj?.name || "";
  const currentLevel = currentClassObj?.level || ""; // V142: Niveau Explicite BDD

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={liveUser} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center min-h-[70px]">
            <span className="text-[10px] font-black text-slate-400 mr-2 uppercase tracking-widest whitespace-nowrap">
                {liveUser.isDeveloper ? '🛠️ MODE ARCHITECTE :' : '📚 MES CLASSES :'}
            </span>
            
            {loading ? (
                <span className="text-[10px] text-slate-300 font-black animate-pulse">CHARGEMENT...</span>
            ) : (
                <>
                    {classes.map(c => (
                        <button key={c._id} onClick={() => setSelectedClassId(c._id)} 
                                className={`px-5 py-2 rounded-xl font-black text-[10px] transition-all whitespace-nowrap border-2 flex items-center gap-2 ${String(selectedClassId) === String(c._id) ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                            {c.type === 'GROUP' ? '👥' : '🏫'} {c.name}
                            {/* Petit badge niveau pour debugger */}
                            {c.level && <span className="bg-white/20 px-1 rounded text-[8px] opacity-70">{c.level}</span>}
                        </button>
                    ))}
                </>
            )}
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} user={liveUser} />
        
        <div className="p-8 bg-white min-h-[600px]">
          {tab === 'activities' && (
            <ActivityStudio 
                globalClass={currentClassName} 
                globalClassId={selectedClassId} 
                globalLevel={currentLevel} // V142: On passe le niveau
                user={liveUser} 
                onRefreshRequest={loadProfileAndClasses} 
            />
          )}
          {tab === 'students' && <StudentsManager globalClassId={selectedClassId} />}
          {tab === 'admin' && <AdminDashboard user={liveUser} onRefresh={loadProfileAndClasses} />}
        </div>
      </div>
      
      {liveUser.isDeveloper && <ConsoleReporter user={liveUser} />}
      <div className="fixed bottom-4 right-4 bg-indigo-600 text-white font-black text-[9px] px-4 py-2 rounded-full shadow-2xl z-[20000]">STUDIO V142</div>
    </div>
  );
}