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
        const res = await fetch('/api/players');
        if (!res.ok) throw new Error("Réponse serveur invalide");
        const data = await res.json();
        
        if (Array.isArray(data)) {
            const uniqueClasses = [...new Set(data.map(p => p.classroom))].filter(Boolean);
            setClasses(uniqueClasses);
            if (!selectedClass && uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
        }
      } catch(e) { 
          console.error("Erreur chargement classes:", e);
      }
  };

  useEffect(() => { loadClasses(); }, []);

  const deleteClass = async (name) => {
      if (!confirm(`⚠️ SUPPRIMER LA CLASSE ${name} ?\nCela effacera les élèves, devoirs et dossiers.`)) return;
      if (!confirm(`TAPEZ SUR OK POUR CONFIRMER LA SUPPRESSION DE LA ${name}`)) { return; }
      
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
                        className="w-8 h-8 flex items-center justify-center text-red-200 hover:text-red-500 font-bold transition-colors"
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