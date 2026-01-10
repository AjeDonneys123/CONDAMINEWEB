import React, { useState } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import ScansStudio from './scans/ScansStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('students');
  const [selectedClass, setSelectedClass] = useState("6D");

  const classes = ["6D", "5B", "5C", "2A", "2CD", "1BFI"];

  return (
    <div className="prof-page-container">
      <div className="prof-card bg-white shadow-2xl">
        <ProfHeader user={user} onLogout={onLogout} />
        
        {/* SÉLECTEUR DE CLASSE GLOBAL (Juste en dessous du Header) */}
        <div className="px-8 py-4 flex gap-2 overflow-x-auto custom-scrollbar border-b border-slate-50">
            {classes.map(c => (
                <button 
                    key={c} 
                    onClick={() => setSelectedClass(c)} 
                    className={`px-6 py-3 rounded-2xl font-black text-xs transition-all flex-shrink-0 ${selectedClass === c ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                >
                    {c}
                </button>
            ))}
        </div>

        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="prof-content-area p-4 sm:p-8">
          {tab === 'students' && <StudentsManager globalClass={selectedClass} />}
          {tab === 'activities' && <ActivityStudio globalClass={selectedClass} />}
          {tab === 'scans' && <ScansStudio globalClass={selectedClass} />}
        </div>
      </div>
    </div>
  );
}