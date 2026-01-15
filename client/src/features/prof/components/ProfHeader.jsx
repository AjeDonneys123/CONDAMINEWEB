import React, { useState } from 'react';
import DatabaseViewer from './DatabaseViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white border-b border-slate-50">
      <div className="text-left">
        <h2 className="text-2xl font-black text-slate-800 uppercase">{user.firstName} {user.lastName}</h2>
        <span className="text-[10px] font-black text-emerald-500 uppercase">Compte PRO : condamine.edu.ec</span>
      </div>
      <div className="flex gap-3">
          <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px]">📊 BDD</button>
          <button onClick={onLogout} className="text-slate-300 font-bold text-[10px]">QUITTER</button>
      </div>
      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}