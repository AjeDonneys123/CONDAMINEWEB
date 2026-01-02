import React, { useState, useEffect } from 'react';

export default function MistakesBook({ user }) {
  const [mistakes, setMistakes] = useState([]);

  const load = async () => {
    const data = await fetch(`/api/player-mistakes/${user.id || user._id}`).then(r => r.json());
    setMistakes(data || []);
  };

  useEffect(() => { load(); }, []);

  const deleteMistake = async (mId) => {
    await fetch('/api/delete-mistake', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ playerId: user.id || user._id, mistakeId: mId })
    });
    load();
  };

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm animate-in fade-in slide-in-from-bottom-4">
      <h2 className="text-2xl font-black mb-6 uppercase italic tracking-tight">Mon Carnet d'Orthographe ✒️</h2>
      <div className="space-y-3">
        {mistakes.length > 0 ? mistakes.map((m) => (
            <div key={m._id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex justify-between items-center group hover:bg-white hover:shadow-md transition-all">
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <span className="text-red-500 line-through font-bold text-lg">{m.wrong}</span>
                        <span className="text-slate-300">➔</span>
                        <span className="text-green-600 font-black text-lg">{m.correct}</span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest">{m.rule || "Usage courant"}</p>
                </div>
                <button onClick={() => deleteMistake(m._id)} className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:bg-red-50 hover:text-red-500 transition-all font-bold">✕</button>
            </div>
        )) : <div className="text-center py-20 text-slate-300 font-black uppercase italic">Zéro faute ! Félicitations 🏆</div>}
      </div>
    </div>
  );
}