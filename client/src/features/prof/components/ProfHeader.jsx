import React, { useState } from 'react';
import DatabaseViewer from './DatabaseViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);

  // Sécurité pour éviter le crash si user n'est pas encore là
  if (!user) return <div className="p-8 bg-white animate-pulse font-black uppercase">Connexion au profil...</div>;

  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white relative border-b border-slate-50">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tighter uppercase">{user.firstName} {user.lastName}</h2>
        <p className="text-indigo-500 font-black text-[10px] uppercase tracking-widest">Compte Enseignant Actif</p>
      </div>
      <div className="flex gap-3">
          <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition-all">📊 BDD</button>
          <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border border-slate-100 hover:text-red-500 transition-all text-[10px] uppercase">Quitter</button>
      </div>

      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}