import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('players');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/database-dump')
            .then(res => {
                if (!res.ok) throw new Error("Erreur Serveur (500)");
                return res.json();
            })
            .then(d => { 
                setData(d); 
                setLoading(false); 
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return (
        <div className="db-viewer-overlay">
            <div className="bg-white p-10 rounded-[40px] text-center shadow-2xl">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="font-black text-slate-800 uppercase text-xs animate-pulse">Lecture réelle des collections MongoDB...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="db-viewer-overlay" onClick={onClose}>
            <div className="bg-red-50 p-10 rounded-[40px] text-center border-4 border-red-200 shadow-2xl" onClick={e => e.stopPropagation()}>
                <span className="text-5xl block mb-4">⚠️</span>
                <h2 className="text-red-600 font-black uppercase mb-2">Erreur BDD</h2>
                <p className="text-red-400 text-xs font-bold mb-6">{error}</p>
                <button onClick={onClose} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px]">Fermer</button>
            </div>
        </div>
    );

    // US #15 : Onglets alignés sur les noms physiques des collections MongoDB
    const collections = [
        { key: 'players', label: 'players', color: 'bg-blue-500' },
        { key: 'chapters', label: 'chapters', color: 'bg-indigo-500' },
        { key: 'homeworks', label: 'homeworks', color: 'bg-orange-500' },
        { key: 'gamelevels', label: 'gamelevels', color: 'bg-purple-500' },
        { key: 'scansessions', label: 'scansessions', color: 'bg-emerald-500' },
        { key: 'teachers', label: 'teachers', color: 'bg-slate-700' },
        { key: 'bugs', label: 'bugs', color: 'bg-red-400' },
        { key: 'deploysignals', label: 'deploy', color: 'bg-slate-400' }
    ];

    const currentData = data ? (data[activeTab] || []) : [];
    // On filtre __v pour la clarté mais on garde _id pour le diagnostic
    const columns = currentData.length > 0 ? Object.keys(currentData[0]).filter(k => k !== '__v') : [];

    return (
        <div className="db-viewer-overlay animate-in fade-in">
            <div className="db-viewer-window shadow-2xl">
                <div className="db-header">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-black uppercase tracking-tighter">MongoDB Raw Explorer</h2>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Vue en temps réel des collections physiques</span>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full font-black text-slate-400 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="db-tabs overflow-x-auto no-scrollbar">
                    {collections.map(c => (
                        <button 
                            key={c.key} 
                            onClick={() => setActiveTab(c.key)}
                            className={`db-tab-btn whitespace-nowrap ${activeTab === c.key ? 'active ' + c.color : ''}`}
                        >
                            {c.label} <span className="ml-1 opacity-50">({data[c.key]?.length || 0})</span>
                        </button>
                    ))}
                </div>

                <div className="db-table-container custom-scrollbar">
                    {currentData.length > 0 ? (
                        <table className="db-table">
                            <thead>
                                <tr>{columns.map(col => <th key={col}>{col}</th>)}</tr>
                            </thead>
                            <tbody>
                                {currentData.map((row, i) => (
                                    <tr key={i}>
                                        {columns.map(col => {
                                            const val = row[col];
                                            const isObj = val && typeof val === 'object';
                                            return (
                                                <td key={col} className="truncate max-w-[200px]" title={JSON.stringify(val)}>
                                                    {isObj ? (Array.isArray(val) ? `Array(${val.length})` : 'Object') : String(val)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-20 text-center">
                            <span className="text-4xl block mb-4">📭</span>
                            <p className="text-slate-300 font-black uppercase text-xs">Collection "{activeTab}" vide</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}