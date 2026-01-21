import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

const DESCRIPTIONS = {
    academicyears: "📅 Années Scolaires.",
    enrollments: "🔗 Inscriptions (Lien Student <-> Class).",
    students: "👤 Profils Elèves.",
    classrooms: "🏫 Classes & Groupes.",
    subjects: "📚 Matières.",
    teachers: "🎓 Enseignants.",
    admins: "🛡️ Staff & Développeurs.",
    chapters: "📁 Chapitres (Dossiers).",
    homeworks: "📝 Devoirs.",
    submissions: "📤 Rendus.",
    gamelevels: "🎮 Quiz.",
    gameprogress: "📈 Scores.",
    mistakes: "✒️ Orthographe.",
    accesslogs: "🔐 Logs.",
    bugreports: "🪲 Bugs.",
    projectdocs: "🧠 Doc IA."
};

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('classrooms'); // Par défaut sur classrooms pour vérifier
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = () => {
        setLoading(true);
        setError(null);
        fetch('/api/admin/database-dump')
            .then(async res => {
                if(!res.ok) throw new Error(await res.text());
                return res.json();
            })
            .then(d => { 
                setData(d); 
                const keys = Object.keys(d || {});
                if (keys.length > 0 && !d[activeTab]) setActiveTab(keys[0]);
                setLoading(false); 
            })
            .catch(err => { setError(err.message); setLoading(false); });
    };

    useEffect(() => { loadData(); }, []);

    const renderCell = (val) => {
        if (val === null || val === undefined) return <span className="text-slate-300">-</span>;
        if (typeof val === 'object') {
            return (
                <pre className="text-[9px] bg-slate-100 p-1 rounded border border-slate-200 max-h-[60px] overflow-y-auto whitespace-pre-wrap font-mono scrollbar-thin">
                    {JSON.stringify(val, null, 0)}
                </pre>
            );
        }
        return <span className="font-bold text-slate-700">{String(val)}</span>;
    };

    if (loading) return <div className="db-viewer-overlay"><h2 className="text-white font-black animate-pulse text-2xl">CHARGEMENT BDD...</h2></div>;
    if (error) return <div className="db-viewer-overlay"><div className="bg-white p-8 rounded-2xl text-red-500 font-black">ERREUR: {error}<button onClick={onClose} className="block mt-4 bg-slate-800 text-white px-4 py-2 rounded">Fermer</button></div></div>;

    const currentData = (data && data[activeTab]) ? data[activeTab] : [];

    // --- CORRECTION V143 : SCAN COMPLET DES COLONNES ---
    // On ne regarde plus juste la ligne 0, on regarde TOUT pour trouver toutes les clés possibles
    const allKeys = new Set();
    currentData.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
    // On convertit le Set en Array, on retire __v, et on trie pour avoir _id et name en premier
    const columns = Array.from(allKeys)
        .filter(k => k !== '__v')
        .sort((a, b) => {
            if (a === '_id') return -1;
            if (b === '_id') return 1;
            if (a === 'name') return -1;
            if (b === 'name') return 1;
            if (a === 'level') return -1; // On met level en évidence
            return a.localeCompare(b);
        });

    return (
        <div className="db-viewer-overlay" onClick={onClose}>
            <div className="db-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="db-header">
                    <div>
                        <h2 className="font-black uppercase text-xl text-slate-800">Visualisateur de Données V143</h2>
                        <span className="text-[9px] text-indigo-500 font-black tracking-widest uppercase">Base MongoDB Brute</span>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full font-black hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="db-tabs no-scrollbar">
                    {Object.keys(data || {}).sort().map(c => (
                        <button key={c} onClick={() => setActiveTab(c)} className={`db-tab-btn ${activeTab === c ? 'active' : ''}`}>
                            {c} ({data[c]?.length || 0})
                        </button>
                    ))}
                </div>
                
                <div className="p-4 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase border-b border-indigo-100 flex justify-between items-center">
                    <span>{DESCRIPTIONS[activeTab] || `COLLECTION : ${activeTab.toUpperCase()}`}</span>
                    <span className="bg-white px-2 py-1 rounded text-indigo-400">{currentData.length} entrées</span>
                </div>

                <div className="db-table-container custom-scrollbar">
                    {currentData.length > 0 ? (
                        <table className="db-table">
                            <thead>
                                <tr>
                                    {columns.map(col => (
                                        <th key={col} className={col === 'level' ? 'bg-yellow-100 text-yellow-700' : ''}>{col.toUpperCase()}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.map((row, i) => (
                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                        {columns.map(col => (
                                            <td key={col} className={`align-middle border-b border-slate-100 p-2 ${col === 'level' ? 'bg-yellow-50/50 font-black text-center' : ''}`}>
                                                {renderCell(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <div className="p-20 text-center text-slate-300 font-black text-xl uppercase">TABLE {activeTab} VIDE</div>}
                </div>
            </div>
        </div>
    );
}