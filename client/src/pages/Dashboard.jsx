import React, { useState } from 'react';
import StudentsTab from '../components/dashboard/StudentsTab';
import HomeworksTab from '../components/dashboard/HomeworksTab';
import GamesTab from '../components/dashboard/GamesTab';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('students');
  const user = JSON.parse(localStorage.getItem("player") || "{}");
  const isProf = user.id === 'prof';

  if (!user.id) return <div className="card">Non connecté.</div>;

  return (
    <div className="card">
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h2 style={{margin:0}}>
            {isProf ? "🎓 Tableau de Bord" : `Espace Élève`}
        </h2>
        {isProf && <span style={{fontSize:'0.8em', background:'#dbeafe', color:'#1e40af', padding:'5px 10px', borderRadius:'10px'}}>Enseignant</span>}
      </div>
      
      {isProf ? (
        <>
            <div className="tabs-container">
            <button className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>👥 Élèves</button>
            <button className={`tab-btn ${activeTab === 'homeworks' ? 'active' : ''}`} onClick={() => setActiveTab('homeworks')}>📚 Devoirs</button>
            <button className={`tab-btn ${activeTab === 'games' ? 'active' : ''}`} onClick={() => setActiveTab('games')}>🎮 Jeux</button>
            </div>

            <div className="tab-content" style={{minHeight:'300px'}}>
                {activeTab === 'students' && <StudentsTab />}
                {activeTab === 'homeworks' && <HomeworksTab />}
                {activeTab === 'games' && <GamesTab />}
            </div>
        </>
      ) : (
        <p>Interface élève en construction...</p>
      )}
    </div>
  );
}