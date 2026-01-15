import React, { useState, useEffect } from 'react';
import DatabaseViewer from './DatabaseViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  const [drive, setDrive] = useState({ loading: true, ok: false, email: '' });

  const checkDrive = async () => {
    try {
      const res = await fetch('/api/admin/drive-check');
      const data = await res.json();
      setDrive({ loading: false, ok: data.ok, email: data.email });
    } catch (e) { setDrive({ loading: false, ok: false }); }
  };

  useEffect(() => { checkDrive(); }, []);

  const handleFixDrive = () => window.open('/api/auth/google/login', '_blank');

  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white border-b">
      <div className="text-left">
        <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">{user.firstName} {user.lastName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-3 h-3 rounded-full ${drive.loading ? 'bg-slate-300' : drive.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {drive.loading ? 'Vérification...' : drive.ok ? `PRO : ${drive.email}` : 'Drive Déconnecté'}
          </span>
          {!drive.ok && !drive.loading && (
            <button onClick={handleFixDrive} className="text-[9px] bg-red-50 text-red-500 px-2 py-0.5 rounded-md font-bold hover:bg-red-500 hover:text-white transition-all">RÉPARER</button>
          )}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg">📊 BDD</button>
        <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border border-slate-100 text-[10px] uppercase hover:text-red-500">✕</button>
      </div>
      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}