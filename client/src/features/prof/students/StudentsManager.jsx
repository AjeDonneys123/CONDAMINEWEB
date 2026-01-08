import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager() {
  const [players, setPlayers] = useState([]);
  const [idsWithScans, setIdsWithScans] = useState(new Set());
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedPlayerScans, setSelectedPlayerScans] = useState(null);
  const [activeScan, setActiveScan] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
        // Sécurisation des fetch pour éviter les erreurs de parsing sur corps vide
        const [playersRes, scansRes] = await Promise.all([
            fetch('/api/players').then(r => r.ok ? r.json() : []),
            fetch('/api/scans').then(r => r.ok ? r.json() : [])
        ]);
        
        setPlayers(playersRes);
        const hasScans = new Set(scansRes.map(s => (s.playerId?._id || s.playerId)?.toString()).filter(Boolean));
        setIdsWithScans(hasScans);
    } catch (e) { 
        console.error("Erreur front StudentsManager:", e); 
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const viewStudentArchives = async (player) => {
      const scans = await fetch(`/api/scans/player/${player._id}`).then(r => r.ok ? r.json() : []);
      setSelectedPlayerScans({ player, scans });
  };

  const filtered = players.filter(p => (filter === 'all' || p.classroom === filter) && ((p.firstName || "") + (p.lastName || "")).toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="manager-container animate-in fade-in">
      <div className="filter-bar">
        <select className="p-3 rounded-xl border-none font-bold bg-slate-100 outline-none" value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="all">Toutes les classes</option>
            <option value="1D">1ere BFI (1D)</option>
            <option value="6D">6eD</option>
            <option value="5B">5eB</option>
            <option value="5C">5eC</option>
            <option value="2A">2A</option>
            <option value="2CD">2CD</option>
        </select>
        <div className="stats-badge font-black">{filtered.length} ÉLÈVES</div>
      </div>
      
      <input className="search-input mb-4" placeholder="🔍 Chercher un nom..." value={search} onChange={e => setSearch(e.target.value)} />
      
      <div className="table-wrapper bg-white rounded-[35px] border-2 border-slate-50 overflow-hidden shadow-sm">
        <table className="students-table w-full">
            <thead className="bg-slate-50">
                <tr>
                    <th className="p-4 pl-8">Élève</th>
                    <th className="p-4 text-center">Classe</th>
                    <th className="p-4 text-center">Archives</th>
                    <th className="p-4 text-right pr-8">Actions</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id} className="hover:bg-slate-50/50 transition-colors border-b last:border-0">
                        <td className="p-4 pl-8"><b className="text-slate-700 text-lg">{p.firstName} {p.lastName}</b></td>
                        <td className="p-4 text-center"><span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black text-xs uppercase">{p.classroom}</span></td>
                        <td className="p-4 text-center">
                            <div className="inline-block relative">
                                <button onClick={() => viewStudentArchives(p)} className="bg-slate-100 hover:bg-white border-2 border-transparent hover:border-blue-400 p-2 px-4 rounded-xl text-[10px] font-black uppercase text-slate-500 hover:text-blue-500 transition-all cursor-pointer">📂 Archives</button>
                                {idsWithScans.has(p._id?.toString()) && <span className="notification-dot"></span>}
                            </div>
                        </td>
                        <td className="p-4 text-right pr-8">
                            <button className="bg-indigo-50 text-indigo-600 p-2 px-6 rounded-xl font-black text-[10px] uppercase hover:bg-indigo-600 hover:text-white transition-all cursor-pointer" onClick={() => { localStorage.setItem("player", JSON.stringify({...p, id: p._id})); window.location.reload(); }}>Tester ➔</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {selectedPlayerScans && (
          <div className="fixed inset-0 z-[7000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-2xl rounded-[50px] shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50 rounded-t-[50px]">
                      <h2 className="text-2xl font-black text-slate-800 uppercase">Dossier : {selectedPlayerScans.player.firstName}</h2>
                      <button onClick={() => setSelectedPlayerScans(null)} className="w-10 h-10 bg-white rounded-full shadow-sm font-black hover:bg-red-500 hover:text-white transition-all">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-4">
                      {selectedPlayerScans.scans.length > 0 ? selectedPlayerScans.scans.map(s => (
                          <div key={s._id} onClick={() => setActiveScan(s)} className="p-6 bg-slate-50 rounded-[30px] border-2 border-transparent hover:border-blue-500 hover:bg-white cursor-pointer transition-all flex justify-between items-center group shadow-sm">
                              <div><b className="text-slate-700 block text-lg font-black">Copie du {new Date(s.createdAt).toLocaleDateString()}</b><span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-lg text-xs font-black uppercase">Note : {s.grade}</span></div>
                              <span className="text-blue-500 font-black group-hover:translate-x-2 transition-transform">VOIR ➔</span>
                          </div>
                      )) : <div className="text-center py-10 text-slate-300 font-bold italic">Aucun document archivé.</div>}
                  </div>
              </div>
          </div>
      )}

      {activeScan && (
          <div className="fixed inset-0 z-[8000] bg-slate-900/95 flex items-center justify-center p-4 backdrop-blur-md">
              <div className="bg-white w-full max-w-7xl h-[92vh] rounded-[60px] flex flex-col overflow-hidden shadow-2xl border-[12px] border-white">
                  <div className="p-6 border-b flex justify-between items-center bg-slate-50/50">
                      <b className="text-xl uppercase text-slate-800 tracking-tighter">Visualisation de la copie</b>
                      <button onClick={() => setActiveScan(null)} className="w-12 h-12 bg-white shadow-md rounded-full text-xl font-black hover:bg-red-500 hover:text-white transition-all">✕</button>
                  </div>
                  <div className="flex-1 flex overflow-hidden">
                      <div className="flex-1 bg-slate-200 overflow-auto p-8 flex justify-center items-start">
                          <img src={`/api/view-copy/${activeScan.driveFileId}`} className="max-w-full shadow-2xl rounded-2xl border-4 border-white" />
                      </div>
                      <div className="flex-1 p-12 overflow-y-auto bg-white border-l">
                          <div className="mb-8 flex items-center gap-4"><span className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-3xl shadow-xl">{activeScan.grade}</span></div>
                          <div className="text-xl leading-relaxed text-slate-700 whitespace-pre-wrap font-medium flex-1" dangerouslySetInnerHTML={{ __html: activeScan.correctedTranscription }} />
                          <div className="mt-12 p-8 bg-emerald-50 rounded-[40px] border-2 border-emerald-100 shadow-inner">
                              <b className="text-emerald-800 text-xs uppercase tracking-widest block mb-3">Feedback :</b>
                              <p className="text-emerald-700 italic text-lg leading-snug">"{activeScan.feedback}"</p>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}