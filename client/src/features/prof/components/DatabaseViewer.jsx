import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('players');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/database-dump')
            .then(r => r.json())
            .then(d => { setData(d); setLoading(false); });
    }, []);

    const exportToCSV = (collectionKey) => {
        const items = data[collectionKey];
        if (!items || items.length === 0) return;
        
        const headers = Object.keys(items[0]).join(',');
        const rows = items.map(row => 
            Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')
        ).join('\n');
        
        const csvContent = "data:text/csv;charset=utf-8," + headers + "\n" + rows;
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `condamine_${collectionKey}.csv`);
        document.body.appendChild(link);
        link.click();
    };

    if (loading) return (
        <div className="db-viewer-overlay">
            <div className="animate-pulse font-black text-white text-2xl">CHARGEMENT DE LA BDD...</div>
        </div>
    );

    const collections = [
        { key: 'players', label: '👥 Élèves', color: 'bg-blue-500' },
        { key: 'chapters', label: '📁 Chapitres', color: 'bg-indigo-500' },
        { key: 'homework', label: '📄 Devoirs', color: 'bg-orange-500' },
        { key: 'games', label: '🕹️ Jeux', color: 'bg-purple-500' },
        { key: 'scans', label: '📸 Scans', color: 'bg-emerald-500' }
    ];

    const currentData = data[activeTab] || [];
    const columns = currentData.length > 0 ? Object.keys(currentData[0]) : [];

    return (
        <div className="db-viewer-overlay animate-in fade-in">
            <div className="db-viewer-window shadow-2xl">
                <div className="db-header">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black uppercase tracking-tighter">Explorateur BDD</h2>
                        <button onClick={() => exportToCSV(activeTab)} className="px-4 py-1 bg-emerald-100 text-emerald-700 rounded-lg font-black text-[10px] uppercase hover:bg-emerald-200 transition-colors">📥 Télécharger .CSV (Excel)</button>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full font-black text-slate-400 hover:text-red-500">✕</button>
                </div>

                <div className="db-tabs">
                    {collections.map(c => (
                        <button 
                            key={c.key} 
                            onClick={() => setActiveTab(c.key)}
                            className={`db-tab-btn ${activeTab === c.key ? 'active ' + c.color : ''}`}
                        >
                            {c.label}
                            <span className="ml-2 opacity-50 text-[10px]">{data[c.key]?.length}</span>
                        </button>
                    ))}
                </div>

                <div className="db-table-container custom-scrollbar">
                    <table className="db-table">
                        <thead>
                            <tr>
                                {columns.map(col => <th key={col}>{col}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {currentData.map((row, i) => (
                                <tr key={i}>
                                    {columns.map(col => (
                                        <td key={col} className="truncate max-w-[200px]" title={String(row[col])}>
                                            {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {currentData.length === 0 && (
                        <div className="py-20 text-center text-slate-300 font-bold uppercase">Aucune donnée dans cette collection</div>
                    )}
                </div>
            </div>
        </div>
    );
}