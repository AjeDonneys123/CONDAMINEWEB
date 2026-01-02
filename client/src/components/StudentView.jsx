import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import HomeworkWorkspace from './homework/HomeworkWorkspace';

const StudentView = ({ user }) => {
  const [activeTab, setActiveTab] = useState('devoirs');
  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [mistakes, setMistakes] = useState([]);
  const [showMistakes, setShowMistakes] = useState(false);

  useEffect(() => {
    api.getHomeworks(user.classroom).then(d => setHomeworks(d || []));
  }, [user.classroom]);

  const loadMistakes = async () => {
      const data = await fetch(`/api/player-mistakes/${user.id || user._id}`).then(r => r.json());
      setMistakes(data);
      setShowMistakes(true);
  };

  const deleteMistake = async (mId) => {
      await fetch('/api/delete-mistake', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ playerId: user.id || user._id, mistakeId: mId })
      });
      loadMistakes();
  };

  if (selectedHw) return <div className="p-4"><button onClick={() => setSelectedHw(null)} className="mb-4 bg-white px-6 py-2 rounded-xl font-bold shadow-sm border">← QUITTER</button><HomeworkWorkspace homework={selectedHw} user={user} /></div>;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex justify-between items-center mb-8 bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex p-1 bg-slate-200 rounded-2xl shadow-inner">
            <button onClick={() => setActiveTab('devoirs')} className={`px-8 py-3 rounded-xl font-black transition-all ${activeTab === 'devoirs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>📚 DEVOIRS</button>
            <button onClick={() => setActiveTab('jeux')} className={`px-8 py-3 rounded-xl font-black transition-all ${activeTab === 'jeux' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>🎮 JEUX</button>
        </div>
        <button onClick={loadMistakes} className="bg-pink-500 text-white px-6 py-3 rounded-2xl font-black shadow-lg shadow-pink-100 hover:scale-105 transition-all flex items-center gap-2">📝 MES FAUTES</button>
      </div>

      {activeTab === 'devoirs' && (
        <div className="grid gap-4">
          {homeworks.map(hw => (
            <div key={hw._id} onClick={() => setSelectedHw(hw)} className="bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group hover:border-blue-400 cursor-pointer transition-all">
              <div><h3 className="text-xl font-black text-slate-800">{hw.title}</h3><p className="text-slate-400 font-bold text-xs uppercase">{new Date(hw.date).toLocaleDateString()}</p></div>
              <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all font-black">➔</div>
            </div>
          ))}
        </div>
      )}

      {/* MODALE MES FAUTES */}
      {showMistakes && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-800">Mon Carnet de Fautes</h2>
                    <button onClick={() => setShowMistakes(false)} className="w-10 h-10 bg-slate-100 rounded-full font-bold">✕</button>
                </div>
                <div className="overflow-y-auto space-y-3">
                    {mistakes.length > 0 ? mistakes.map((m, i) => (
                        <div key={m._id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center group">
                            <div>
                                <span className="text-red-500 line-through font-bold">{m.wrong}</span>
                                <span className="mx-2 text-slate-400">➔</span>
                                <span className="text-green-600 font-bold">{m.correct}</span>
                                <p className="text-[10px] text-slate-400 italic mt-1">{m.rule}</p>
                            </div>
                            <button onClick={() => deleteMistake(m._id)} className="text-slate-300 hover:text-red-500 font-black px-2">✕</button>
                        </div>
                    )) : <p className="text-center text-slate-400 py-10 font-bold">Aucune faute enregistrée ! Félicitations 🎉</p>}
                </div>
            </div>
          </div>
      )}
    </div>
  );
};
export default StudentView;