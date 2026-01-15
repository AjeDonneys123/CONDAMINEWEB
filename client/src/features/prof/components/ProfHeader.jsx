import React, { useState, useEffect } from 'react';
import DatabaseViewer from './DatabaseViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  const [driveStatus, setDriveStatus] = useState({ loading: true, ok: false, email: '' });

  const checkDrive = async () => {
      setDriveStatus(prev => ({ ...prev, loading: true }));
      try {
          const res = await fetch('/api/drive-check');
          const data = await res.json();
          setDriveStatus({ loading: false, ok: data.ok, email: data.email || data.error });
      } catch (e) {
          setDriveStatus({ loading: false, ok: false, email: 'Serveur injoignable' });
      }
  };

  useEffect(() => { checkDrive(); }, []);

  if (!user) return <div className="p-8 bg-white animate-pulse">Chargement...</div>;

  return (
    <div className="p-8 pb-4 flex justify-between items-center bg-white relative border-b border-slate-50">
      <div className="flex flex-col">
        <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">{user.firstName} {user.lastName}</h2>
        
        {/* INDICATEUR DE CONNEXION DRIVE (Diagnostic) */}
        <div className="flex items-center gap-2 mt-1 cursor-pointer" onClick={checkDrive} title="Cliquer pour re-tester la connexion">
            <div className={`w-2 h-2 rounded-full ${driveStatus.loading ? 'bg-slate-300 animate-pulse' : driveStatus.ok ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-500 shadow-[0_0_8px_#ef4444]'}`}></div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${driveStatus.ok ? 'text-emerald-600' : 'text-red-500'}`}>
                Drive : {driveStatus.loading ? 'Vérification...' : driveStatus.ok ? `Connecté (${driveStatus.email})` : `Erreur (${driveStatus.email})`}
            </span>
        </div>
      </div>

      <div className="flex gap-3">
          <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-slate-800 transition-all">📊 BDD</button>
          <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border border-slate-100 hover:text-red-500 transition-all text-[10px] uppercase">Quitter</button>
      </div>

      {showDB && <DatabaseViewer onClose={() => setShowDB(false)} />}
    </div>
  );
}