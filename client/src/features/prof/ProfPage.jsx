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
  const [showWizard, setShowWizard] = useState(false);
  const [wizardData, setWizardData] = useState({ name: '', raw: '' });
  const [loading, setLoading] = useState(false);

  const loadClasses = async () => {
      try {
        const res = await fetch('/api/players').then(r => r.json());
        if (!Array.isArray(res)) return;
        const uniqueClasses = [...new Set(res.map(p => p.classroom))].filter(Boolean);
        setClasses(uniqueClasses);
        if (!selectedClass && uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
      } catch(e) { console.error("Erreur classes"); }
  };

  useEffect(() => { loadClasses(); }, []);

  const handleWizard = async () => {
      setLoading(true);
      try {
          await fetch('/api/create-class-wizard', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({ teacherId: user?.id || user?._id, className: wizardData.name, rawData: wizardData.raw })
          });
          setShowWizard(false);
          await loadClasses();
      } catch(e) { console.error(e); }
      setLoading(false);
  };

  return (
    <div className="prof-page-container">
      <div className="prof-card bg-white shadow-2xl">
        <ProfHeader user={user} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 overflow-x-auto border-b items-center bg-slate-50/50">
            {classes.map(c => (
                <button key={c} onClick={() => setSelectedClass(c)} className={`px-6 py-3 rounded-2xl font-black text-xs transition-all whitespace-nowrap ${selectedClass === c ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border'}`}>{c}</button>
            ))}
            <button onClick={() => setShowWizard(true)} className="w-10 h-10 min-w-[40px] rounded-full bg-emerald-500 text-white font-black shadow-md">+</button>
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="prof-content-area p-4 sm:p-8">
          {tab === 'students' && <StudentsManager globalClass={selectedClass} user={user} />}
          {tab === 'activities' && <ActivityStudio globalClass={selectedClass} user={user} teacherId={user?.id || user?._id} />}
          {tab === 'scans' && <ScansStudio globalClass={selectedClass} user={user} />}
        </div>
      </div>
    </div>
  );
}