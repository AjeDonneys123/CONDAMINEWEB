import React, { useState, useEffect } from 'react';

export default function StudentsManager() {
  const [players, setPlayers] = useState([]);
  const [filterClass, setFilterClass] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    const data = await fetch('/api/players').then(r => r.json());
    setPlayers(data || []);
  };
  useEffect(() => { load(); }, []);

  const handleTestClass = async () => {
    if(filterClass === 'all') return alert("Sélectionne une classe !");
    const res = await fetch('/api/register', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ firstName: "Eleve", lastName: "Test", classroom: filterClass })
    }).then(r => r.json());
    if (res.ok) { localStorage.setItem("player", JSON.stringify(res)); window.location.reload(); }
  };

  const filtered = players.filter(p => (filterClass === 'all' || p.classroom === filterClass) && (p.firstName + p.lastName).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex gap-4 bg-slate-50 p-4 rounded-3xl border border-slate-100">
        <select className="flex-1 p-4 rounded-2xl border-none font-bold bg-white outline-none cursor-pointer" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
            <option value="2A">2de A</option><option value="2CD">2de CD</option>
        </select>
        <button onClick={handleTestClass} className="bg-blue-600 text-white px-8 rounded-2xl font-black shadow-lg hover:bg-blue-700 transition-all uppercase tracking-tighter">🎮 Tester</button>
      </div>
      
      <input className="w-full p-4 rounded-2xl border-2 outline-none focus:border-blue-500 font-medium" placeholder="🔍 Chercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />

      <div className="border border-slate-100 rounded-[32px] overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                <tr><th className="p-5">Nom de l'élève</th><th className="p-5 text-center">Classe</th><th className="p-5 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
                {filtered.map(p => (
                    <tr key={p._id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-5 font-bold text-slate-700">{p.firstName} {p.lastName}</td>
                        <td className="p-5 text-center"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-xs font-black">{p.classroom}</span></td>
                        <td className="p-5 text-right">
                            <button onClick={async () => { if(confirm("Reset ?")) { await fetch('/api/reset-player', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({playerId: p._id})}); load(); } }} className="text-red-300 hover:text-red-500 font-bold text-xs uppercase tracking-tighter">Reset</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </div>
  );
}