// @signatures: DatabaseViewer, currentData, loadData, renderCell
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
    gamelevels: "🎮 Quiz (Contient vos Niveaux).",
    gameprogress: "📈 Scores.",
    mistakes: "✒️ Orthographe.",
    accesslogs: "🔐 Logs.",
    bugreports: "🪲 Bugs.",
    projectdocs: "🧠 Doc IA.",
    studioprojects: "🎬 Projets Studio."
};

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('gamelevels'); // Focus Quiz
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
                setLoading(false); 
            })
            .catch(err => { setError(err.message); setLoading(false); });
    };

    useEffect(() => { loadData(); }, []);

    const renderCell = (val) => {
        if (val === null || val === undefined) return <span className="text-slate-300">-</span>;
        
        // Affichage amélioré des tableaux (Niveaux/Questions)
        if (Array.isArray(val) && val.length > 0) {
            return (
                <div className="text-[9px] font-mono">
                    <span className="font-bold text-indigo-600">Array({val.length})</span>
                    <pre className="bg-slate-50 p-1 rounded border border-slate-200 max-h-[100px] max-w-[300px] overflow-auto mt-1">
                        {JSON.stringify(val, null, 2)}
                    </pre>
                </div>
            );
        }
        
        if (typeof val === 'object') {
            return <pre className="text-[9px]">{JSON.stringify(val).substring(0, 50)}...</pre>;
        }
        
        return <span className="font-bold text-slate-700">{String(val)}</span>;
    };

    if (loading) return <div className="db-viewer-overlay"><h2 className="text-white font-black animate-pulse text-2xl">CHARGEMENT...</h2></div>;
    if (error) return <div className="db-viewer-overlay"><div className="bg-white p-8 rounded-2xl text-red-500 font-black">ERREUR: {error}<button onClick={onClose} className="block mt-4 bg-slate-800 text-white px-4 py-2 rounded">Fermer</button></div></div>;

    const currentData = (data && data[activeTab]) ? data[activeTab] : [];

    // --- SCAN ET TRI DES COLONNES ---
    const allKeys = new Set();
    currentData.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
    
    const columns = Array.from(allKeys)
        .filter(k => k !== '__v') // On cache la version interne mongo
        .sort((a, b) => {
            // ORDRE DE PRIORITÉ D'AFFICHAGE
            const priority = ['title', 'name', 'levels', 'questions', 'teacherId'];
            
            const idxA = priority.indexOf(a);
            const idxB = priority.indexOf(b);
            
            // Si les deux sont prioritaires, on respecte l'ordre de la liste
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            // Si l'un est prioritaire, il passe avant
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            
            // ID à la fin
            if (a === '_id') return 1;
            if (b === '_id') return -1;
            
            return a.localeCompare(b);
        });

    return (
        <div className="db-viewer-overlay" onClick={onClose}>
            <div className="db-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="db-header">
                    <div>
                        <h2 className="font-black uppercase text-xl text-slate-800">Visualisateur BDD</h2>
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
                                        <th key={col} className={col === 'levels' ? 'bg-green-200 text-green-800 border-b-4 border-green-500' : ''}>
                                            {col.toUpperCase()}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {currentData.map((row, i) => (
                                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                                        {columns.map(col => (
                                            <td key={col} className={`align-middle border-b border-slate-100 p-2 ${col === 'levels' ? 'bg-green-50/20' : ''}`}>
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
