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
        const playersRes = await fetch('/api/players').then(r => r.ok ? r.json() : []);
        const scansRes = await fetch('/api/scans').then(r => r.ok ? r.json() : []);
        
        setPlayers(Array.isArray(playersRes) ? playersRes : []);
        const hasScans = new Set((Array.isArray(scansRes) ? scansRes : []).map(s => (s.playerId?._id || s.playerId)?.toString()).filter(Boolean));
        setIdsWithScans(hasScans);
    } catch (e) { console.error("Erreur StudentsManager:", e); }
  };

  useEffect(() => { loadData(); }, []);

  const viewStudentArchives = async (player) => {
      const scans = await fetch(`/api/scans/player/${player._id}`).then(r => r.ok ? r.json() : []);
      setSelectedPlayerScans({ player, scans: Array.isArray(scans) ? scans : [] });
  };

  const filtered = players.filter(p => (filter === 'all' || p.classroom === filter) && ((p.firstName || "") + (p.lastName || "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="manager-container">
      <div className="filter-bar">
        <select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Toutes les classes</option><option value="6D">6eD</option><option value="5B">5eB</option><option value="1D">1D BFI</option>
        </select>
        <div className="stats-badge font-black">{filtered.length} ÉLÈVES</div>
      </div>
      <input className="search-input" placeholder="🔍 Chercher un élève..." value={search} onChange={e => setSearch(e.target.value)} />
      <div className="table-wrapper">
        <table className="students-table w-full">
            <thead><tr className="bg-slate-50 text-left">
                <th className="p-4 pl-8">Élève</th>
                <th className="p-4">Classe</th>
                <th className="p-4 text-center">Copies</th>
                <th className="p-4 text-right pr-8">Action</th>
            </tr></thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id} className="border-b hover:bg-slate-50">
                        <td className="p-4 pl-8 font-bold">{p.firstName} {p.lastName}</td>
                        <td className="p-4 text-xs uppercase font-black">{p.classroom}</td>
                        <td className="p-4 text-center relative">
                            <button onClick={() => viewStudentArchives(p)} className="p-2 bg-slate-100 rounded-lg text-[10px] font-black uppercase">Voir</button>
                            {idsWithScans.has(p._id?.toString()) && <span className="notification-dot"></span>}
                        </td>
                        <td className="p-4 text-right pr-8"><button className="text-indigo-600 font-bold" onClick={() => { localStorage.setItem("player", JSON.stringify({...p, id: p._id})); window.location.reload(); }}>Tester ➔</button></td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {selectedPlayerScans && (
          <div className="fixed inset-0 z-[7000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50 rounded-t-[40px]">
                      <h2 className="text-2xl font-black uppercase">Archives : {selectedPlayerScans.player.firstName}</h2>
                      <button onClick={() => setSelectedPlayerScans(null)} className="text-2xl font-black">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-4">
                      {selectedPlayerScans.scans.map(s => (
                          <div key={s._id} onClick={() => setActiveScan(s)} className="p-6 bg-slate-50 rounded-3xl border-2 border-transparent hover:border-indigo-500 hover:bg-white cursor-pointer flex justify-between items-center transition-all shadow-sm">
                              <div><b className="text-slate-700 block text-lg font-black">Correction du {new Date(s.createdAt).toLocaleDateString()}</b><span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-xs font-black">Note : {s.grade}</span></div>
                              <span className="text-blue-500 font-black">VOIR ➔</span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      {activeScan && (
          <div className="fixed inset-0 z-[8000] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[60px] flex flex-col overflow-hidden shadow-2xl border-[12px] border-white">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                      <b className="text-xl uppercase text-slate-800">Visualisation</b>
                      <button onClick={() => setActiveScan(null)} className="w-12 h-12 bg-slate-200 rounded-full text-xl font-black hover:bg-red-500 hover:text-white transition-all">✕</button>
                  </div>
                  <div className="flex-1 flex overflow-hidden">
                      <div className="flex-1 bg-slate-200 overflow-auto p-4 flex justify-center items-start">
                          <img src={`/api/view-copy/${activeScan.driveFileId}`} className="max-w-full shadow-2xl rounded-xl border-4 border-white" />
                      </div>
                      <div className="flex-1 p-10 overflow-y-auto bg-white border-l">
                          <div className="mb-6"><span className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-2xl">{activeScan.grade}</span></div>
                          <div className="text-lg leading-relaxed text-slate-700 whitespace-pre-wrap font-medium flex-1" dangerouslySetInnerHTML={{ __html: activeScan.correctedTranscription }} />
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}