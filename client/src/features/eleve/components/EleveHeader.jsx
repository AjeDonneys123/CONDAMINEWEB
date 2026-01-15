import React from 'react';
import './EleveHeader.css';

export default function EleveHeader({ user, onLogout, onBackToProf, activeTab, onTabChange }) {
  return (
    <div className="header-wrapper">
      <div className="top-bar">
        <div className="flex items-center gap-4">
          <h1 className="brand-name">Condamine</h1>
          <button onClick={onBackToProf} className="text-[10px] font-black text-pink-300">🎓 PROF</button>
        </div>
        <div className="flex items-center gap-4">
            <span className="user-badge">{user.firstName}</span>
            <button onClick={onLogout} className="font-black text-pink-400">✕</button>
        </div>
      </div>
      <div className="nav-tabs">
        <button onClick={() => onTabChange('devoirs')} className={`tab-item ${activeTab === 'devoirs' ? 'tab-active' : ''}`}>📚 DEVOIRS</button>
        <button onClick={() => onTabChange('francais')} className={`tab-item ${activeTab === 'francais' ? 'tab-active' : ''}`}>🇫🇷 FRANÇAIS</button>
        <button onClick={() => onTabChange('jeux')} className={`tab-item ${activeTab === 'jeux' ? 'tab-active' : ''}`}>🎮 JEUX</button>
      </div>
    </div>
  );
}