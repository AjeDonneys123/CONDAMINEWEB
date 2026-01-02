import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const TeacherView = ({ onLogout }) => {
  const [players, setPlayers] = useState([]);
  const [view, setView] = useState('dashboard');
  const [classFilter, setClassFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => { 
    const data = await api.get('/players'); 
    setPlayers(data || []); 
  };
  
  useEffect(() => { load(); }, []);

  const handleReset = async (id) => {
    if(!confirm("Effacer progression de cet élève ?")) return;
    const res = await api.post('/reset-player', { playerId: id });
    if(res.ok) load();
  };

  const testClass = async () => {
    if(classFilter === 'all') return alert("Sélectionne une classe pour tester");
    const res = await api.post('/register', { firstName: "Eleve", lastName: "Test", classroom: classFilter });
    if(res.ok) { 
        localStorage.setItem('player', JSON.stringify(res)); 
        window.location.reload(); 
    }
  };

  const filtered = players.filter(p => {
    const matchSearch = (p.firstName + ' ' + p.lastName).toLowerCase().includes(search.toLowerCase());
    const matchClass = classFilter === 'all' || p.classroom === classFilter;
    return matchSearch && matchClass;
  });

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* HEADER */}
      <div className="flex justify-between mb-6 items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-2xl font-black text-slate-800 font-serif italic">Maître Jean Vuillet ✒️</h2>
        <button onClick={onLogout} className="bg-slate-100 text-slate-500 px-6 py-2 rounded-xl font-bold hover:bg-red-50 hover:text-red-500 transition-all">
          Déconnexion
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        
        {/* COLONNE GAUCHE : LISTE ET FILTRES (75%) */}
        <div className="w-full lg:w-3/4 space-y-6">
          
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap gap-4 items-center">
            <input 
                className="flex-1 min-w-[200px] p-4 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-blue-500 outline-none font-medium" 
                placeholder="🔍 Chercher un élève..." 
                value={search} 
                onChange={e => setSearch(e.target.value)} 
            />
            <select 
                className="p-4 rounded-2xl bg-slate-50 border-none font-bold text-blue-600 outline-none cursor-pointer" 
                value={classFilter} 
                onChange={e => setClassFilter(e.target.value)}
            >
              <option value="all">Toutes les classes</option>
              <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
              <option value="2A">2de A</option><option value="2CD">2de CD</option>
            </select>
            <button 
                onClick={testClass} 
                className="bg-blue-600 text-white px-6 py-4 rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-95 transition-all"
            >
                🎮 TESTER LA CLASSE
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-slate-100">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-bold">
                <tr>
                    <th className="p-5">Élève</th>
                    <th className="p-5">Classe</th>
                    <th className="p-5 text-center">Fautes</th>
                    <th className="p-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-5 font-bold text-slate-700">{p.firstName} {p.lastName}</td>
                    <td className="p-5 text-slate-500 font-medium">{p.classroom}</td>
                    <td className="p-5 text-center">
                        <span className={`px-3 py-1 rounded-full font-bold text-sm ${p.spellingMistakes?.length > 0 ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                            {p.spellingMistakes?.length || 0}
                        </span>
                    </td>
                    <td className="p-5 text-right">
                      <button 
                        onClick={() => handleReset(p._id)} 
                        className="text-xs bg-slate-100 text-slate-400 hover:bg-red-500 hover:text-white p-2 rounded-lg font-bold transition-all"
                      >
                        RESET
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="p-20 text-center text-slate-300 font-bold">Aucun élève trouvé.</div>}
          </div>
        </div>

        {/* COLONNE DROITE : ACTIONS FIXES (25%) */}
        <div className="w-full lg:w-1/4 sticky top-4 space-y-4">
            <button 
                onClick={() => setView('homework')} 
                className="w-full bg-orange-500 text-white p-8 rounded-[32px] font-black text-xl shadow-xl shadow-orange-100 border-b-8 border-orange-700 hover:translate-y-1 hover:border-b-4 transition-all flex flex-col items-center gap-2"
            >
                <span className="text-4xl">📚</span>
                CRÉER DEVOIR
            </button>
            
            <button 
                onClick={() => setView('games')} 
                className="w-full bg-purple-600 text-white p-8 rounded-[32px] font-black text-xl shadow-xl shadow-purple-100 border-b-8 border-purple-800 hover:translate-y-1 hover:border-b-4 transition-all flex flex-col items-center gap-2"
            >
                <span className="text-4xl">🎮</span>
                GÉRER JEUX
            </button>

            <div className="bg-white p-6 rounded-3xl border border-dashed border-slate-200 text-center">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-tight">Stats Globales</p>
                <div className="text-3xl font-black text-slate-700 mt-1">{players.length}</div>
                <p className="text-slate-400 text-xs">élèves inscrits</p>
            </div>
        </div>

      </div>

      {/* MODALES DE CRÉATION (S'affichent par-dessus) */}
      {view !== 'dashboard' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
                <div className="p-8 border-b flex justify-between items-center">
                    <h2 className="text-3xl font-black">{view === 'homework' ? '📚 Nouveau Devoir' : '🎮 Gestion des Niveaux'}</h2>
                    <button onClick={() => setView('dashboard')} className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center font-bold text-2xl hover:bg-red-50 hover:text-red-500 transition-all">✕</button>
                </div>
                <div className="flex-1 overflow-y-auto p-8">
                    <p className="p-20 text-center border-4 border-dashed rounded-3xl text-slate-300 font-bold text-xl italic">
                        {view === 'homework' ? 'Le formulaire de création de devoirs arrive ici...' : 'L\'interface de gestion des jeux arrive ici...'}
                    </p>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
export default TeacherView;