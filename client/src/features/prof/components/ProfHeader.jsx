import React, { useState, useEffect } from 'react';
import DatabaseViewer from './DatabaseViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  const [driveStatus, setDriveStatus] = useState({ loading: true, ok: false, email: '', isPro: false });

  const checkDrive = async () => {
      if (!user) return;
      setDriveStatus(prev => ({ ...prev, loading: true }));
      try {
          const res = await fetch('/api/drive-check');
          const data = await res.json();
          setDriveStatus({ loading: false, ok: data.ok, email: data.email || data.error, isPro: data.isPro });
      } catch (e) { setDriveStatus({ loading: false, ok: false, email: 'Erreur' }); }
  };

  useEffect(() => { checkDrive(); }, [user]);

  // FIX CRASH firstName
  const nameDisplay = user?.firstName ? `${user.firstName} ${user.lastName}` : "Chargement...";

  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white relative border-b border-slate-50">
      <div className="flex flex-col text-left">
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{nameDisplay}</h2>
        <div className="flex items-center gap-2 mt-1 cursor-pointer group" onClick={checkDrive}>
            <div className={`w-2.5 h-2.5 rounded-full ${driveStatus.loading ? 'bg-slate-300 animate-pulse' : (driveStatus.ok && driveStatus.isPro) ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 animate-bounce'}`}></div>
            <span className={`text-[10px] font-black uppercase tracking-widest ${ (driveStatus.ok && driveStatus.isPro) ? 'text-emerald-600' : 'text-red-500'}`}>
                Drive : {driveStatus.loading ? 'Vérification...' : (driveStatus.isPro ? `PRO (${driveStatus.email})` : `🚨 ERREUR (${driveStatus.email})`)}
            </span>
        </div>
      </div>
      <div className="flex gap-3">
          <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg">📊 BDD</button>
          <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border border-slate-100 hover:text-red-500 text-[10px] uppercase">Quitter</button>
      </div>
      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}