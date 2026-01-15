import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import ScansStudio from './scans/ScansStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('activities');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  const loadClasses = async () => {
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      const uniqueClasses = [...new Set(data.map(p => p.classroom))].filter(Boolean).sort();
      setClasses(uniqueClasses);
      if (!selectedClass && uniqueClasses.length > 0) {
        setSelectedClass(uniqueClasses[0]);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { loadClasses(); }, []);

  return (
    <div className="prof-page-container">
      <div className="prof-card">
        <ProfHeader user={user} onLogout={onLogout} />
        
        {/* BARRE DES CLASSES DYNAMIQUE (US #15) */}
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar">
            {classes.map(c => (
                <button 
                  key={c} 
                  onClick={() => setSelectedClass(c)} 
                  className={`px-6 py-2 rounded-xl font-black text-[10px] whitespace-nowrap transition-all ${selectedClass === c ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white text-slate-400 border hover:bg-slate-50'}`}
                >
                  {c}
                </button>
            ))}
            {classes.length === 0 && <span className="text-[10px] font-bold text-slate-300 uppercase">Aucune classe détectée</span>}
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="p-8">
          {tab === 'students' && <StudentsManager globalClass={selectedClass} />}
          {tab === 'activities' && <ActivityStudio globalClass={selectedClass} user={user} />}
          {tab === 'scans' && <ScansStudio globalClass={selectedClass} user={user} />}
        </div>
      </div>
    </div>
  );
}