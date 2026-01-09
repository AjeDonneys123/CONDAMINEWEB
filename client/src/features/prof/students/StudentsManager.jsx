import React, { useState, useEffect } from 'react';
import './StudentsManager.css';

export default function StudentsManager() {
  const [players, setPlayers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(setPlayers);
  }, []);

  const viewWork = async (player) => {
      setLoadingFiles(true);
      try {
          const res = await fetch(`/api/player-productions/${player._id}`);
          const files = await res.json();
          setSelectedStudent({ player, files: Array.isArray(files) ? files : [] });
      } catch(e) { console.error(e); }
      setLoadingFiles(false);
  };

  const filtered = players.filter(p =>
    (filter === 'all' || p.classroom === filter) &&
    ((p.firstName || "") + " " + (p.lastName || "")).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="manager-container">
      <div className="filter-bar flex justify-between items-center bg-white p-4 rounded-[25px] border shadow-sm">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="p-2 rounded-xl border font-bold text-indigo-600 outline-none">
            <option value="all">Toutes les classes</option>
            <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option>
            <option value="2A">2de A</option><option value="1D">1ere BFI</option>
        </select>
        <div className="stats-badge bg-indigo-600 text-white px-4 py-2 rounded-xl font-black">{filtered.length} ÉLÈVES</div>
      </div>

      <div className="table-wrapper bg-white rounded-[30px] overflow-hidden border mt-4 shadow-sm">
        <table className="students-table w-full text-left border-collapse">
            <thead>
                <tr className="bg-slate-50 text-[10px] uppercase text-slate-400 font-black tracking-widest">
                    <th className="p-5 pl-8">Élève</th>
                    <th className="p-5">Classe</th>
                    <th className="p-5 text-right pr-8">Dossier Personnel</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map(p => (
                    <tr key={p._id} className="border-b hover:bg-slate-50 transition-colors">
                        <td className="p-5 pl-8 font-bold text-slate-700">{p.firstName} {p.lastName}</td>
                        <td className="p-5 text-xs font-black text-slate-400">{p.classroom === '1D' ? '1BFI' : p.classroom}</td>
                        <td className="p-5 text-right pr-8">
                            <button onClick={() => viewWork(p)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm">📂 Ouvrir</button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>

      {/* MODALE DES TRAVAUX DE L'ÉLÈVE */}
      {selectedStudent && (
          <div className="fixed inset-0 z-[7000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6">
              <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl flex flex-col max-h-[85vh]">
                  <div className="p-8 border-b flex justify-between items-center bg-slate-50 rounded-t-[40px]">
                      <div className="flex flex-col">
                        <h2 className="text-xl font-black uppercase text-indigo-600">{selectedStudent.player.firstName}</h2>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dossier PRODUCTIONS / {selectedStudent.player.firstName} {selectedStudent.player.lastName}</span>
                      </div>
                      <button onClick={() => setSelectedStudent(null)} className="text-2xl font-black text-slate-300 hover:text-red-500">✕</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                      {selectedStudent.files.map(f => (
                          <div key={f.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group hover:bg-white transition-all border border-transparent hover:border-indigo-100 shadow-sm">
                              <div className="flex items-center gap-4">
                                  <img src={f.thumbnailLink} className="h-14 w-11 object-cover rounded-lg border bg-white shadow-sm" alt="prev" />
                                  <b className="text-slate-600 text-sm">{f.name}</b>
                              </div>
                              <a href={f.webViewLink} target="_blank" rel="noreferrer" className="bg-white px-4 py-2 rounded-xl text-indigo-500 font-black text-[10px] uppercase border shadow-sm hover:bg-indigo-50 transition-all">Voir sur Drive ➔</a>
                          </div>
                      ))}
                      {selectedStudent.files.length === 0 && (
                        <div className="text-center py-20">
                            <span className="text-4xl block mb-2">📁</span>
                            <p className="text-slate-400 font-bold italic">Aucune copie trouvée dans le dossier Drive de cet élève.</p>
                        </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}