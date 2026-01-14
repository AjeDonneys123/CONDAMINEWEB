import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import ScansStudio from './scans/ScansStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('students');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading] = useState(false);

  const loadClasses = async () => {
      try {
        const res = await fetch('/api/players').then(r => r.json());
        if (Array.isArray(res)) {
            const uniqueClasses = [...new Set(res.map(p => p.classroom))].filter(Boolean);
            setClasses(uniqueClasses);
            if (!selectedClass && uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
        }
      } catch(e) { console.error("Erreur classes"); }
  };

  useEffect(() => { loadClasses(); }, []);

  const deleteClass = async (name) => {
      if (!confirm(`⚠️ ATTENTION ! Supprimer la classe ${name} ?\nCela effacera TOUT (élèves, devoirs, dossiers) en BDD.`)) return;
      if (!confirm(`CONFIRMATION FINALE : Supprimer la ${name} ?`)) return;
      
      setLoading(true);
      try {
          const res = await fetch(`/api/classroom/${name}`, { method: 'DELETE' });
          if (res.ok) {
              setSelectedClass("");
              await loadClasses();
          }
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  return (
    <div className="prof-page-container">
      <div className="prof-card bg-white shadow-2xl">
        <ProfHeader user={user} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 overflow-x-auto border-b items-center bg-slate-50/50 no-scrollbar">
            {(classes || []).map(c => (
                <div key={c} className="flex items-center bg-white rounded-2xl border shadow-sm pr-1 group">
                    <button 
                        onClick={() => setSelectedClass(c)} 
                        className={`px-6 py-3 rounded-2xl font-black text-[10px] transition-all whitespace-nowrap ${selectedClass === c ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
                    >
                        {c}
                    </button>
                    <button 
                        onClick={() => deleteClass(c)} 
                        className="w-8 h-8 flex items-center justify-center text-red-100 hover:text-red-500 font-bold transition-colors"
                        title="Supprimer la classe"
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="prof-content-area p-4 sm:p-8">
          {tab === 'students' && <StudentsManager globalClass={selectedClass} user={user} />}
          {tab === 'activities' && <ActivityStudio globalClass={selectedClass} user={user} />}
          {tab === 'scans' && <ScansStudio globalClass={selectedClass} user={user} />}
        </div>
      </div>
    </div>
  );
}