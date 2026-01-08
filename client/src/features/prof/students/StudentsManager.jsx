import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager() {
  const [players, setPlayers] = useState([]);
  const [idsWithScans, setIdsWithScans] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPlayerScans, setSelectedPlayerScans] = useState(null);
  const [activeScan, setActiveScan] = useState(null);

  const loadData = async () => {
    try {
        const [playersRes, scansRes] = await Promise.all([
            fetch('/api/players').then(r => r.json()),
            fetch('/api/scans').then(r => r.json())
        ]);
        setPlayers(playersRes || []);
        // On construit le Set des IDs ayant des corrections
        const hasScans = new Set((scansRes || []).map(s => (s.playerId?._id || s.playerId)?.toString()));
        setIdsWithScans(hasScans);
    } catch (e) { console.error("Erreur chargement élèves/scans:", e); }
  };

  useEffect(() => { loadData(); }, []);

  const viewStudentArchives = async (player) => {
      try {
        const scans = await fetch(`/api/scans/player/${player._id}`).then(r => r.json());
        setSelectedPlayerScans({ player, scans: scans || [] });
      } catch (e) { alert("Erreur lors de la récupération des archives."); }
  };

  const filtered = players.filter(p => (filter === 'all' || p.classroom === filter) && (p.firstName + p.lastName).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="manager-container animate-in fade-in">
      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option><option value="1D">1D BFI</option>
        </select>
        <div className="stats-badge">{filtered.length} élèves</div>
      </div>
      
      <input className="search-input" placeholder="🔍 Chercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
      
      <div className="table-wrapper">
        <table className="students-table">
            <thead><tr><th>Élève</th><th>Classe</th><th>Archives</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id} className="student-row-ui">
                        <td className="name-cell"><b className="block">{p.firstName} {p.lastName}</b></td>
                        <td className="class-cell"><span>{p.classroom}</span></td>
                        <td>
                            <div className="archive-btn-container">
                                <button onClick={() => viewStudentArchives(p)} className="btn-archive-view">📂 Voir Archives</button>
                                {idsWithScans.has(p._id?.toString()) && <span className="notification-dot"></span>}
                            </div>
                        </td>
                        <td className="action-cell text-right">
                            <button className="btn-test" onClick={() => { localStorage.setItem("player", JSON.stringify({...p, id: p._id})); window.location.reload(); }}>Tester</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* MODALE LISTE DES COPIES */}
      {selectedPlayerScans && (
          <div className="fixed inset-0 z-[7000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50 rounded-t-[40px]">
                      <h2 className="text-2xl font-black text-slate-800 uppercase">Copies : {selectedPlayerScans.player.firstName}</h2>
                      <button onClick={() => setSelectedPlayerScans(null)} className="text-2xl font-black">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-3">
                      {selectedPlayerScans.scans.length > 0 ? selectedPlayerScans.scans.map(s => (
                          <div key={s._id} onClick={() => setActiveScan(s)} className="p-5 bg-slate-50 rounded-2xl border-2 border-transparent hover:border-indigo-500 cursor-pointer transition-all flex justify-between items-center group">
                              <div>
                                  <b className="text-slate-700 block text-lg">Correction du {new Date(s.createdAt).toLocaleDateString()}</b>
                                  <p className="text-xs text-emerald-600 font-bold uppercase">Note : {s.grade}</p>
                              </div>
                              <span className="text-indigo-500 font-black">VOIR ➔</span>
                          </div>
                      )) : <p className="text-center py-10 text-slate-300 font-bold italic uppercase">Dossier vide</p>}
                  </div>
              </div>
          </div>
      )}

      {/* MODALE VUE MIROIR */}
      {activeScan && (
          <div className="fixed inset-0 z-[8000] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[60px] flex flex-col overflow-hidden shadow-2xl">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                      <b className="text-xl uppercase text-slate-800">Visualisation Miroir</b>
                      <button onClick={() => setActiveScan(null)} className="w-12 h-12 bg-slate-200 rounded-full text-xl font-black">✕</button>
                  </div>
                  <div className="flex-1 flex overflow-hidden">
                      <div className="flex-1 bg-slate-200 overflow-auto p-4 flex justify-center items-start">
                          <img src={`/api/view-copy/${activeScan.driveFileId}`} className="max-w-full shadow-2xl rounded-xl border-4 border-white" alt="Original" />
                      </div>
                      <div className="flex-1 p-10 overflow-y-auto bg-white border-l">
                          <div className="mb-6"><span className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-2xl">{activeScan.grade}</span></div>
                          <div className="text-lg leading-relaxed text-slate-700 whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: activeScan.correctedTranscription }} />
                          <div className="mt-8 p-6 bg-emerald-50 rounded-3xl border border-emerald-100 shadow-inner">
                              <p className="text-emerald-700 italic">"{activeScan.feedback}"</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}