import React, { useState } from 'react';
import StudentsTab from './dashboard/StudentsTab';
import HomeworksTab from './dashboard/HomeworksTab';
import GamesTab from './dashboard/GamesTab';

const TeacherView = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState('students');

  return (
    <div className="max-w-5xl mx-auto py-8">
      <div className="bg-white rounded-[40px] shadow-xl overflow-hidden border border-slate-100">
        {/* Header Interne */}
        <div className="p-8 border-b flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-3xl font-black text-slate-800">🎓 Dashboard</h2>
            <p className="text-slate-400 font-medium italic">Maître Jean Vuillet</p>
          </div>
          <button onClick={onLogout} className="bg-white text-slate-400 px-6 py-2 rounded-2xl font-bold border hover:text-red-500 hover:border-red-200 transition-all">Déconnexion</button>
        </div>

        {/* Onglets de navigation */}
        <div className="flex gap-2 p-4 bg-white">
          {[
            { id: 'students', label: '👥 Élèves', color: 'blue' },
            { id: 'homeworks', label: '📚 Devoirs', color: 'orange' },
            { id: 'games', label: '🎮 Jeux', color: 'purple' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-4 rounded-2xl font-black text-lg transition-all ${
                activeTab === tab.id 
                ? `bg-${tab.color}-600 text-white shadow-lg shadow-${tab.color}-100 scale-105` 
                : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Contenu dynamique */}
        <div className="p-8 min-h-[400px]">
          {activeTab === 'students' && <StudentsTab />}
          {activeTab === 'homeworks' && <HomeworksTab />}
          {activeTab === 'games' && <GamesTab />}
        </div>
      </div>
    </div>
  );
};
export default TeacherView;