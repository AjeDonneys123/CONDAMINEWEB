import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager({ globalClass }) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');

  const loadData = async () => {
    try {
        const res = await fetch('/api/players');
        if (!res.ok) return console.error("Serveur Erreur 500 sur Players");
        const data = await res.json();
        setPlayers(Array.isArray(data) ? data : []);
    } catch (e) {
        console.error("Erreur de décodage JSON sur Players");
    }
  };

  useEffect(() => { loadData(); }, [globalClass]);

  const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
  const filtered = players.filter(p =>
    normalize(p.classroom) === normalize(globalClass) &&
    ((p.firstName || "") + " " + (p.lastName || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="manager-container animate-in fade-in">
      <div className="filter-bar flex justify-between items-center bg-white p-4 rounded-[25px] border shadow-sm">
        <input 
            className="flex-1 outline-none font-bold text-slate-400 bg-transparent" 
            placeholder="Rechercher un élève..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
        />
        <div className="stats-badge bg-indigo-600 text-white px-4 py-2 rounded-xl font-black">{filtered.length} ÉLÈVES</div>
      </div>

      <div className="table-wrapper bg-white rounded-[30px] overflow-hidden border mt-6 shadow-sm">
        <table className="students-table w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                    <th className="p-5 pl-8">Élève</th>
                    <th className="p-5 text-right pr-8">Actions</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-5 pl-8 font-bold text-slate-700">{p.firstName} {p.lastName}</td>
                        <td className="p-5 text-right pr-8">
                            <button className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase">Dossier</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center py-20 text-slate-300 font-black uppercase text-[10px]">Aucun élève</p>}
      </div>
    </div>
  );
}