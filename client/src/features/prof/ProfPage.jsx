import React, { useState } from 'react';
import ProfHeader from './components/ProfHeader';
import ProfNav from './components/ProfNav';
import StudentsManager from './students/StudentsManager';
import ActivityStudio from './activities/ActivityStudio';
import ScansStudio from './scans/ScansStudio';
import './ProfPage.css';

export default function ProfPage({ user, onLogout }) {
  const [tab, setTab] = useState('students');

  return (
    <div className="prof-page-container">
      <div className="prof-card">
        <ProfHeader user={user} onLogout={onLogout} />
        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="prof-content-area">
          {tab === 'students' && <StudentsManager />}
          {tab === 'activities' && <ActivityStudio />}
          {tab === 'scans' && <ScansStudio />}
        </div>
      </div>
    </div>
  );
}