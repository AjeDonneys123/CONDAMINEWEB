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
        const uniqueClasses = [...new Set(res.map(p => p.classroom))].filter(Boolean);
        setClasses(uniqueClasses);
        if (!selectedClass && uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
      } catch(e) { console.error("Erreur classes"); }
  };

  useEffect(() => { loadClasses(); }, []);

  const deleteClass = async (name) => {
      if (!confirm(`⚠️ ATTENTION ! Supprimer la classe ${name} ?\nCela effacera tous les élèves, devoirs et chapitres de cette classe.`)) return;
      if (!confirm(`Dernière chance : es-tu sûr de vouloir tout supprimer pour la ${name} ?`)) return;
      
      setLoading(true);
      try {
          await fetch(`/api/classroom/${name}`, { method: 'DELETE' });
          setSelectedClass("");
          await loadClasses();
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  return (
    <div className="prof-page-container">
      <div className="prof-card bg-white shadow-2xl">
        <ProfHeader user={user} onLogout={handleLogout} />
        
        <div className="px-8 py-4 flex gap-2 overflow-x-auto border-b items-center bg-slate-50/50">
            {classes.map(c => (
                <div key={c} className="flex items-center bg-white rounded-2xl border shadow-sm pr-2">
                    <button 
                        onClick={() => setSelectedClass(c)} 
                        className={`px-6 py-3 rounded-2xl font-black text-xs transition-all whitespace-nowrap ${selectedClass === c ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400'}`}
                    >
                        {c}
                    </button>
                    <button onClick={() => deleteClass(c)} className="ml-1 text-red-200 hover:text-red-500 font-bold px-2">✕</button>
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