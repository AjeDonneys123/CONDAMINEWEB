import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function StudentsTab() {
  const [players, setPlayers] = useState([]);
  const [filterClass, setFilterClass] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    const data = await api.get('/players');
    setPlayers(data || []);
  };

  useEffect(() => { load(); }, []);

  const handleReset = async (id) => {
    if(!window.confirm("Effacer la progression ?")) return;
    const res = await api.post('/reset-player', { playerId: id });
    if(res.ok) load();
  };

  const handleTestClass = async () => {
    if(filterClass === 'all') return alert("Choisis une classe !");
    const res = await api.post('/register', { firstName: "Eleve", lastName: "Test", classroom: filterClass });
    if(res.ok) {
        localStorage.setItem("player", JSON.stringify(res));
        window.location.reload();
    }
  };

  const filtered = players.filter(p => {
    const matchClass = filterClass === 'all' || p.classroom === filterClass;
    const matchName = (p.firstName + ' ' + p.lastName).toLowerCase().includes(search.toLowerCase());
    return matchClass && matchName;
  });

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <select className="flex-1 p-4 rounded-2xl border-2 bg-slate-50 font-bold outline-none" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2de A</option><option value="2CD">2de CD</option>
        </select>
        <button onClick={handleTestClass} className="bg-blue-600 text-white px-8 rounded-2xl font-black shadow-lg">🎮 TESTER CLASSE</button>
      </div>
      
      <input className="w-full p-4 rounded-2xl border-2 outline-none focus:border-blue-500" placeholder="🔍 Chercher un nom..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="border rounded-3xl overflow-hidden">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase">
                <tr><th className="p-4">Nom</th><th className="p-4">Classe</th><th className="p-4 text-center">Fautes</th><th className="p-4 text-right">Action</th></tr>
            </thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id} className="border-t">
                        <td className="p-4 font-bold">{p.firstName} {p.lastName}</td>
                        <td className="p-4">{p.classroom}</td>
                        <td className="p-4 text-center"><span className="bg-red-50 text-red-500 px-2 py-1 rounded-lg font-bold">{p.spellingMistakes?.length || 0}</span></td>
                        <td className="p-4 text-right">
                            <button onClick={() => handleReset(p._id)} className="bg-slate-100 text-slate-400 text-xs font-bold p-2 rounded-lg hover:bg-red-500 hover:text-white transition-all">RESET</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}