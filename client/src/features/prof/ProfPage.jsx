import React, { useState } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import ScansStudio from './scans/ScansStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('activities');
  const [selectedClass, setSelectedClass] = useState("6D");
  return (
    <div className="prof-page-container">
      <div className="prof-card">
        <ProfHeader user={user} onLogout={onLogout} />
        <div className="px-8 py-4 flex gap-2 border-b bg-slate-50/50">
            {["6D", "5B", "2CD"].map(c => (
                <button key={c} onClick={() => setSelectedClass(c)} className={`px-6 py-2 rounded-xl font-black text-[10px] ${selectedClass === c ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border'}`}>{c}</button>
            ))}
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