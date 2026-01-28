// @signatures: AdminPage, handleRefresh
import React from 'react';
import AdminDashboard from '../prof/admin/AdminDashboard'; // On réutilise le composant existant
import './AdminPage.css';

export default function AdminPage({ user, onLogout }) {
  // Fonction vide pour le refresh car l'admin gère sa propre data
  const handleRefresh = () => {};

  return (
    <div className="admin-page-wrapper">
      <div className="admin-header-bar">
        <div className="flex items-center gap-4">
            <span className="text-3xl">🛡️</span>
            <div>
                <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Espace Administration</h1>
                <p className="text-xs font-bold text-slate-400 uppercase">Bienvenue, {user.firstName}</p>
            </div>
        </div>
        <button onClick={onLogout} className="bg-white text-slate-400 hover:text-red-500 px-4 py-2 rounded-xl font-black text-xs border border-slate-200 transition-colors">
            DÉCONNEXION
        </button>
      </div>
      
      <div className="admin-content-area">
        <AdminDashboard user={user} onRefresh={handleRefresh} />
      </div>
    </div>
  );
}
