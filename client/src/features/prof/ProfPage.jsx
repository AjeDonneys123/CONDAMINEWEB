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
      const res = await fetch('/api/players').then(r => r.json());
      const uniqueClasses = [...new Set(res.map(p => p.classroom))];
      setClasses(uniqueClasses);
      if (!selectedClass && uniqueClasses.length > 0) setSelectedClass(uniqueClasses[0]);
  };

  useEffect(() => { loadClasses(); }, []);

  const handleWizard = async () => {
      setLoading(true);
      await fetch('/api/create-class-wizard', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ teacherId: user.id, className: wizardData.name, rawData: wizardData.raw })
      });
      setShowWizard(false);
      loadClasses();
      setLoading(false);
  };

  return (
    <div className="prof-page-container">
      <div className="prof-card bg-white shadow-2xl">
        <ProfHeader user={user} onLogout={onLogout} />
        
        <div className="px-8 py-4 flex gap-2 overflow-x-auto border-b items-center">
            {classes.map(c => (
                <button key={c} onClick={() => setSelectedClass(c)} className={`px-6 py-3 rounded-2xl font-black text-xs transition-all ${selectedClass === c ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}>{c}</button>
            ))}
            <button onClick={() => setShowWizard(true)} className="w-10 h-10 rounded-full bg-emerald-500 text-white font-black">+</button>
        </div>

        {showWizard && (
            <div className="fixed inset-0 z-[8000] bg-slate-900/90 flex items-center justify-center p-6">
                <div className="bg-white p-8 rounded-[40px] max-w-xl w-full space-y-4">
                    <h2 className="text-xl font-black uppercase">Ajouter une classe (Wizard IA)</h2>
                    <input className="w-full p-4 bg-slate-50 rounded-2xl outline-none font-bold" placeholder="Nom de la classe (ex: 6D)" value={wizardData.name} onChange={e=>setWizardData({...wizardData, name:e.target.value})} />
                    <textarea className="w-full p-4 h-48 bg-slate-50 rounded-2xl outline-none text-sm" placeholder="Colle la liste ici (Nom Prénom Email...)" value={wizardData.raw} onChange={e=>setWizardData({...wizardData, raw:e.target.value})} />
                    <div className="flex gap-4">
                        <button onClick={()=>setShowWizard(false)} className="flex-1 p-4 font-bold text-slate-400">Annuler</button>
                        <button onClick={handleWizard} disabled={loading} className="flex-2 p-4 bg-emerald-500 text-white rounded-2xl font-black uppercase">{loading ? 'Analyse IA...' : 'Créer la classe ✨'}</button>
                    </div>
                </div>
            </div>
        )}

        <ProfNav activeTab={tab} onTabChange={setTab} />
        
        <div className="prof-content-area p-4 sm:p-8">
          {tab === 'students' && <StudentsManager globalClass={selectedClass} teacherId={user.id} />}
          {tab === 'activities' && <ActivityStudio globalClass={selectedClass} teacherId={user.id} />}
          {tab === 'scans' && <ScansStudio globalClass={selectedClass} teacherId={user.id} />}
        </div>
      </div>
    </div>
  );
}