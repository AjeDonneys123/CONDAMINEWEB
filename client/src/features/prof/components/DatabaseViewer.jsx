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
                if (!res.ok) throw new Error("Le serveur ne répond pas (Erreur 500)");
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
                <p className="font-black text-slate-800 uppercase text-xs">Analyse de la base de données...</p>
            </div>
        </div>
    );

    if (error) return (
        <div className="db-viewer-overlay" onClick={onClose}>
            <div className="bg-red-50 p-10 rounded-[40px] text-center border-4 border-red-200 shadow-2xl" onClick={e => e.stopPropagation()}>
                <span className="text-5xl block mb-4">⚠️</span>
                <h2 className="text-red-600 font-black uppercase mb-2">Erreur de chargement</h2>
                <p className="text-red-400 text-xs font-bold mb-6">{error}</p>
                <button onClick={onClose} className="bg-red-600 text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px]">Fermer</button>
            </div>
        </div>
    );

    const collections = [
        { key: 'players', label: '👥 Élèves', color: 'bg-blue-500' },
        { key: 'chapters', label: '📁 Chapitres', color: 'bg-indigo-500' },
        { key: 'homework', label: '📄 Devoirs', color: 'bg-orange-500' },
        { key: 'games', label: '🕹️ Jeux', color: 'bg-purple-500' },
        { key: 'scans', label: '📸 Scans', color: 'bg-emerald-500' },
        { key: 'teachers', label: '🎓 Profs', color: 'bg-slate-700' }
    ];

    const currentData = data ? (data[activeTab] || []) : [];
    const columns = currentData.length > 0 ? Object.keys(currentData[0]).filter(k => k !== '__v') : [];

    return (
        <div className="db-viewer-overlay animate-in fade-in">
            <div className="db-viewer-window shadow-2xl">
                <div className="db-header">
                    <h2 className="text-xl font-black uppercase tracking-tighter">Explorateur de données</h2>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full font-black text-slate-400 hover:text-red-500">✕</button>
                </div>

                <div className="db-tabs">
                    {collections.map(c => (
                        <button 
                            key={c.key} 
                            onClick={() => setActiveTab(c.key)}
                            className={`db-tab-btn ${activeTab === c.key ? 'active ' + c.color : ''}`}
                        >
                            {c.label} ({data[c.key]?.length || 0})
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
                                        {columns.map(col => (
                                            <td key={col} className="truncate max-w-[150px]" title={JSON.stringify(row[col])}>
                                                {typeof row[col] === 'object' ? 'Object' : String(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="py-20 text-center text-slate-300 font-bold uppercase">Aucune donnée trouvée</div>
                    )}
                </div>
            </div>
        </div>
    );
}