import React, { useState, useEffect } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('activities');
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");

  const loadClasses = async () => {
    try {
      const res = await fetch('/api/admin/players');
      const data = await res.json();
      const uniqueClasses = [...new Set(data.map(p => p.classroom))].filter(Boolean).sort();
      setClasses(uniqueClasses);
      if (!selectedClass && uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
    } catch (e) {}
  };

  useEffect(() => { loadClasses(); }, []);

  return (
    <div className="prof-page-container">
      <div className="prof-card shadow-2xl">
        <ProfHeader user={user} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50 overflow-x-auto no-scrollbar items-center">
            {classes.map(c => (
                <button 
                    key={c}
                    onClick={() => setSelectedClass(c)} 
                    className={`px-6 py-2 rounded-xl font-black text-[10px] shadow-sm transition-all ${selectedClass === c ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400'}`}
                >
                    {c}
                </button>
            ))}
            <button onClick={() => { const n = prompt("Nom classe ?"); if(n) {setClasses([...classes, n.toUpperCase()]); setSelectedClass(n.toUpperCase());} }} className="bg-white border-2 border-dashed border-slate-200 text-slate-300 px-4 py-2 rounded-xl font-black text-[10px] hover:border-indigo-500 transition-all">+ CLASSE</button>
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="p-8">
          {tab === 'students' && <StudentsManager globalClass={selectedClass} />}
          {tab === 'activities' && <ActivityStudio globalClass={selectedClass} user={user} />}
          {tab === 'scans' && <div className="p-20 text-slate-300 font-black uppercase text-xl">Module Scan en attente</div>}
        </div>
      </div>
    </div>
  );
}