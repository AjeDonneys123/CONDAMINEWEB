// @signatures: ProfHeader, checkDrive
import React, { useState, useEffect } from 'react';
import DatabaseViewer from './DatabaseViewer';
import DriveViewer from './DriveViewer';

export default function ProfHeader({ user, onLogout }) {
  const [showDB, setShowDB] = useState(false);
  const [showDrive, setShowDrive] = useState(false);
  const [drive, setDrive] = useState({ loading: true, ok: false, email: '' });

  const checkDrive = async () => {
    if (!user?.isDeveloper) {
      setDrive({ loading: false, ok: false, email: '' });
      return;
    }
    try {
      const userId = user.id || user._id;
      const res = await fetch(`/api/admin/drive-check?userId=${encodeURIComponent(userId || '')}`);
      const data = await res.json();
      setDrive({ loading: false, ok: data.ok, email: data.email });
    } catch (e) { setDrive({ loading: false, ok: false }); }
  };

  useEffect(() => { checkDrive(); }, []);

  return (
    <>
        {/* --- VERSION BUREAU (Classe 'desktop-only-header' gérée par CSS strict) --- */}
        <div className="desktop-only-header p-8 pb-4 justify-between items-center bg-white border-b hidden md:flex">
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
            {user?.isDeveloper && (
              <>
                <button onClick={() => setShowDrive(true)} className="bg-cyan-600 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform">☁️ DRIVE</button>
                <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-4 py-2 rounded-2xl font-black text-[10px] uppercase hover:scale-105 transition-transform">📊 BDD</button>
              </>
            )}
            <button onClick={onLogout} className="bg-white text-slate-300 px-4 py-2 rounded-2xl font-bold border text-[10px] hover:text-red-500">✕</button>
          </div>
        </div>

        {/* --- VERSION MOBILE (Classe 'mobile-only-header') --- */}
        <div className="mobile-only-header items-center justify-between p-3 bg-white border-b shadow-sm sticky top-0 z-50 md:hidden flex">
            {/* GAUCHE : IDENTITÉ */}
            <div className="flex items-center gap-2 overflow-hidden">
                <div className={`w-2 h-2 shrink-0 rounded-full ${drive.ok ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span className="font-black text-slate-800 text-xs uppercase truncate">
                    {user.firstName} {user.lastName}
                </span>
            </div>

            {/* DROITE : ACTIONS COMPACTES */}
            <div className="flex items-center gap-2 shrink-0">
                {user?.isDeveloper && (
                  <>
                    <button onClick={() => setShowDrive(true)} className="bg-cyan-600 text-white px-2 py-1 rounded-lg font-black text-[8px] uppercase">☁️ DRIVE</button>
                    <button onClick={() => setShowDB(true)} className="bg-slate-900 text-white px-2 py-1 rounded-lg font-black text-[8px] uppercase">📊 BDD</button>
                  </>
                )}
                <button onClick={onLogout} className="w-6 h-6 flex items-center justify-center bg-slate-100 text-slate-400 rounded-full font-bold text-xs ml-1 border border-slate-200">✕</button>
            </div>
        </div>
      
        {/* MODALES */}
        {showDB && user?.isDeveloper && <DatabaseViewer user={user} onClose={() => setShowDB(false)} />}
        {showDrive && user?.isDeveloper && <DriveViewer user={user} onClose={() => setShowDrive(false)} />}
    </>
  );
}
