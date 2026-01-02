import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const StudentView = ({ user }) => {
  const [activeTab, setActiveTab] = useState('devoirs');
  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await api.getHomeworks(user.classroom);
      setHomeworks(data || []);
      setLoading(false);
    }
    load();
  }, [user.classroom]);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex p-1 bg-slate-200 rounded-2xl w-fit mb-8">
        <button 
          onClick={() => setActiveTab('devoirs')}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab === 'devoirs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
        >📚 Mes Devoirs</button>
        <button 
          onClick={() => setActiveTab('jeux')}
          className={`px-8 py-3 rounded-xl font-bold transition-all ${activeTab === 'jeux' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600'}`}
        >🎮 Mini-Jeux</button>
      </div>

      {activeTab === 'devoirs' && (
        <div className="space-y-4">
          {loading ? <p className="text-center py-10">Recherche de tes devoirs...</p> : 
           homeworks.length > 0 ? homeworks.map(hw => (
            <div key={hw._id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group hover:border-blue-300 transition-all cursor-pointer">
              <div>
                <h3 className="text-xl font-black text-slate-800">{hw.title}</h3>
                <p className="text-slate-400 font-medium">Classe : {hw.classroom} • {new Date(hw.date).toLocaleDateString()}</p>
              </div>
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">➔</div>
            </div>
          )) : (
            <div className="bg-white p-12 rounded-3xl text-center border-4 border-dashed border-slate-100">
              <span className="text-5xl">🎉</span>
              <p className="mt-4 text-slate-500 font-bold">Aucun devoir en cours ! Profite bien.</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'jeux' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-8 rounded-3xl shadow-sm border-b-8 border-green-500 hover:-translate-y-1 transition-all cursor-pointer">
             <span className="text-5xl">🧟</span>
             <h3 className="text-2xl font-black mt-4">ZOMBIE GRAMMAR</h3>
             <p className="text-slate-500 mt-2">Défends-toi en corrigeant les fautes.</p>
             <button className="mt-6 w-full py-4 bg-green-600 text-white rounded-2xl font-bold shadow-lg">JOUER</button>
          </div>
          <div className="bg-white p-8 rounded-3xl shadow-sm border-b-8 border-slate-200 opacity-50">
             <span className="text-5xl">🚀</span>
             <h3 className="text-2xl font-black mt-4">STARSHIP</h3>
             <p className="text-slate-500 mt-2">Arrive bientôt dans ta galaxie.</p>
             <button disabled className="mt-6 w-full py-4 bg-slate-300 text-white rounded-2xl font-bold">VERROUILLÉ</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentView;