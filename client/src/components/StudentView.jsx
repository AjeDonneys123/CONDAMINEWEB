import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import HomeworkWorkspace from './homework/HomeworkWorkspace';

const StudentView = ({ user }) => {
  const [activeTab, setActiveTab] = useState('devoirs');
  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    const data = await api.get(`/homework/${user.classroom}`);
    setHomeworks(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedHw) loadData();
  }, [user.classroom, selectedHw]);

  if (selectedHw) {
    return (
      <div className="max-w-6xl mx-auto py-2">
        <button onClick={() => setSelectedHw(null)} className="mb-4 bg-white px-6 py-2 rounded-xl font-bold shadow-sm border text-slate-500 hover:text-red-500 transition-all">← QUITTER</button>
        <HomeworkWorkspace homework={selectedHw} user={user} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex p-1 bg-slate-200 rounded-2xl w-fit mb-8 shadow-inner">
        <button onClick={() => setActiveTab('devoirs')} className={`px-8 py-3 rounded-xl font-black transition-all ${activeTab === 'devoirs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>📚 DEVOIRS</button>
        <button onClick={() => setActiveTab('jeux')} className={`px-8 py-3 rounded-xl font-black transition-all ${activeTab === 'jeux' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>🎮 JEUX</button>
      </div>

      {activeTab === 'devoirs' && (
        <div className="grid gap-4">
          {loading ? (
            <p className="text-center py-20 font-bold text-slate-300 animate-pulse text-xl uppercase tracking-widest">Recherche des devoirs...</p>
          ) : homeworks.length > 0 ? (
            homeworks.map(hw => (
              <div key={hw._id} onClick={() => setSelectedHw(hw)} className="bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer">
                <div>
                  <h3 className="text-xl font-black text-slate-800">{hw.title}</h3>
                  <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">{new Date(hw.date).toLocaleDateString()}</p>
                </div>
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all font-black">➔</div>
              </div>
            ))
          ) : (
            <div className="p-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100 font-bold text-slate-300 text-xl">Aucun devoir pour le moment ! 🎉</div>
          )}
        </div>
      )}

      {activeTab === 'jeux' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-8 rounded-[40px] border-b-8 border-green-600 shadow-xl hover:-translate-y-1 transition-all group">
                <span className="text-5xl group-hover:scale-110 transition-transform block w-fit">🧟</span>
                <h3 className="text-2xl font-black mt-4">ZOMBIE GRAMMAR</h3>
                <button className="mt-6 w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg">JOUER</button>
            </div>
            <div className="bg-white p-8 rounded-[40px] border-b-8 border-slate-200 opacity-40">
                <span className="text-5xl block w-fit">🚀</span>
                <h3 className="text-2xl font-black mt-4">STARSHIP</h3>
                <button disabled className="mt-6 w-full py-4 bg-slate-300 text-white rounded-2xl font-black cursor-not-allowed">VERROUILLÉ</button>
            </div>
        </div>
      )}
    </div>
  );
};
export default StudentView;