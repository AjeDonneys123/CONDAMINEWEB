import React from 'react';

export default function ProfHeader({ user, onLogout }) {
  return (
    <div className="p-8 border-b flex justify-between items-center bg-slate-50">
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tighter uppercase">CHEF D'ORCHESTRE 🎓</h2>
        <p className="text-slate-400 font-medium italic">Espace Enseignant V6.0</p>
      </div>
      <button onClick={onLogout} className="bg-white text-slate-400 px-6 py-2 rounded-2xl font-bold border hover:text-red-500 transition-all">Quitter</button>
    </div>
  );
}