import React, { useState, useEffect } from 'react';

export default function MistakesBook({ user }) {
  const [mistakes, setMistakes] = useState([]);
  useEffect(() => {
    fetch('/api/players').then(r => r.json()).then(all => {
        const me = all.find(p => p._id === (user._id || user.id));
        setMistakes(me?.spellingMistakes || []);
    });
  }, []);

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-sm animate-in">
      <h2 className="text-2xl font-black mb-6">Mon Carnet d'Orthographe ✒️</h2>
      <div className="space-y-3">
        {mistakes.map((m, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-2xl flex gap-4">
                <span className="text-red-500 line-through font-bold">{m.wrong}</span>
                <span>➔</span>
                <span className="text-green-600 font-black">{m.correct}</span>
            </div>
        ))}
        {mistakes.length === 0 && <p className="text-slate-300">Aucune erreur enregistrée.</p>}
      </div>
    </div>
  );
}