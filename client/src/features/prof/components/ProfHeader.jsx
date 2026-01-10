import React, { useState } from 'react';

export default function ProfHeader({ user, onLogout }) {
  const [bugs, setBugs] = useState([]);
  const [showBugs, setShowBugs] = useState(false);

  const loadBugs = async () => {
      const data = await fetch('/api/bugs').then(r => r.json());
      setBugs(data);
      setShowBugs(true);
  };

  const deleteBug = async (id) => {
      await fetch(`/api/bugs/${id}`, { method: 'DELETE' });
      loadBugs();
  };

  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white relative">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">Jean Vuillet</h2>
        <p className="text-indigo-500 font-black text-xs uppercase tracking-widest">Histoire Géo EMC</p>
      </div>
      <div className="flex gap-4">
          <button onClick={loadBugs} className="bg-amber-100 text-amber-600 px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-sm">🐞 Bugs ({bugs.length})</button>
          <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border border-slate-100 hover:text-red-500 transition-all text-[10px] uppercase">Quitter</button>
      </div>

      {showBugs && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
              <div className="bg-white w-full max-w-2xl rounded-[40px] shadow-2xl p-8 max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-2xl font-black">Signalements Élèves 🐞</h2>
                      <button onClick={() => setShowBugs(false)} className="text-2xl font-bold">✕</button>
                  </div>
                  <div className="overflow-y-auto space-y-3">
                      {bugs.map(b => (
                          <div key={b._id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center">
                              <div>
                                  <b className="text-purple-600">{b.reporter} ({b.classroom})</b>
                                  <p className="text-sm text-slate-600 mt-1">{b.description}</p>
                              </div>
                              <button onClick={() => deleteBug(b._id)} className="text-red-300 hover:text-red-500 font-bold px-2">Vu</button>
                          </div>
                      ))}
                      {bugs.length === 0 && <p className="text-center py-10 text-slate-300 font-bold">Zéro bug signalé ! 🌴</p>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}