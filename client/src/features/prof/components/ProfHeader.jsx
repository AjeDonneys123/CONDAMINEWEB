import React, { useState, useEffect } from 'react';
import DatabaseViewer from './DatabaseViewer';
import DriveViewer from './DriveViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [drive, setDrive] = useState({ loading: true, ok: false, email: '' });

  const checkDrive = async () => {
    try {
      const res = await fetch('/api/admin/drive-check');
      const data = await res.json();
      setDrive({ loading: false, ok: data.ok, email: data.email });
    } catch (e) { setDrive({ loading: false, ok: false }); }
  };

  useEffect(() => { checkDrive(); }, []);

  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white border-b">
      <div className="text-left">
        <h2 className="text-2xl font-black text-slate-800 uppercase">{user.firstName} {user.lastName}</h2>
        <div className="flex items-center gap-2 mt-1">
          <div className={`w-3 h-3 rounded-full ${drive.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
          <span className="text-[10px] font-black uppercase text-slate-400">
            {drive.ok ? `PRO : ${drive.email}` : 'Drive Déconnecté'}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        {/* BOUTON MOUCHARD DRIVE V14 */}
        <button onClick={() => setShowDrive(true)} className="bg-cyan-600 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-cyan-100 transition-transform active:scale-95">☁️ DRIVE</button>
        
        <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase">📊 BDD</button>
        <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border text-[10px]">✕</button>
      </div>
      
      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
      {showDrive && <DriveViewer onClose={() => setShowDrive(false)} />}
    </div>
  );
}