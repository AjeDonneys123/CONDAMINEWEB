import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

const DESCRIPTIONS = {
    academicyears: "📅 Années Scolaires. Pivot de l'archivage.",
    enrollments: "🔗 Inscriptions. Lien Student <-> Class par année.",
    students: "👤 Profils Elèves. Données permanentes.",
    classrooms: "🏫 Classes & Groupes Pédagogiques.",
    subjects: "📚 Matières. Catalogue officiel.",
    teachers: "🎓 Enseignants. Préférences et sections.",
    admins: "🛡️ Staff & Développeurs.",
    chapters: "📁 Chapitres. Dossiers Cloud Drive.",
    homeworks: "📝 Devoirs. Consignes IA.",
    submissions: "📤 Rendus. Notes et feedback IA.",
    gamelevels: "🎮 Quiz. Moteur Zombie/Starship.",
    gameprogress: "📈 Scores. Progression jeux.",
    mistakes: "✒️ Orthographe. Carnet de remédiation.",
    accesslogs: "🔐 Sécurité. Logs d'accès système.",
    bugreports: "🪲 Bugs. Erreurs capturées.",
    projectdocs: "🧠 Mémoire IA. Documentation code.",
    players: "⚠️ LEGACY. Anciennes données à migrer."
};

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('students');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = () => {
        setLoading(true);
        setError(null);
        fetch('/api/admin/database-dump')
            .then(async res => {
                if(!res.ok) {
                    const txt = await res.text();
                    throw new Error(txt || "Erreur serveur inconnue");
                }
                return res.json();
            })
            .then(d => { 
                setData(d); 
                // Si l'onglet actif n'existe pas ou est vide, on cherche le premier non vide
                const keys = Object.keys(d || {});
                if (keys.length > 0) {
                    if (!d[activeTab]) setActiveTab(keys[0]);
                }
                setLoading(false); 
            })
            .catch(err => {
                console.error("DB LOAD ERROR:", err);
                setError(err.message);
                setLoading(false);
            });
    };

    useEffect(() => { loadData(); }, []);

    const handleMigrate = async () => {
        if(!confirm("Lancer la migration vers la structure ARCHITECTE PRO ?")) return;
        setLoading(true);
        try {
            await fetch('/api/admin/maintenance/migrate-legacy', { method: 'POST' });
            loadData();
        } catch(e) { alert("Erreur migration"); setLoading(false); }
    };

    if (loading) return <div className="db-viewer-overlay"><h2 className="text-white font-black animate-pulse text-2xl">SYNCHRONISATION BDD PRO...</h2></div>;
    
    if (error) return (
        <div className="db-viewer-overlay">
            <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-lg">
                <h2 className="text-red-500 font-black text-xl mb-4">ERREUR CRITIQUE</h2>
                <div className="bg-slate-100 p-4 rounded-xl text-xs font-mono text-left mb-4 overflow-auto max-h-40">
                    {error}
                </div>
                <button onClick={onClose} className="bg-slate-800 text-white px-6 py-2 rounded-xl font-bold">FERMER</button>
            </div>
        </div>
    );

    const collections = Object.keys(data || {}).sort();
    const currentData = (data && data[activeTab]) ? data[activeTab] : [];
    const columns = currentData.length > 0 ? Object.keys(currentData[0]).filter(k => k !== '__v') : [];

    return (
        <div className="db-viewer-overlay" onClick={onClose}>
            <div className="db-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="db-header">
                    <div className="flex flex-col">
                        <h2 className="font-black uppercase text-xl text-slate-800">Condamine Architecte Pro</h2>
                        <span className="text-[9px] text-indigo-500 font-black tracking-widest uppercase">Système de Base de Données Relationnelle</span>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleMigrate} className="bg-amber-100 text-amber-600 px-4 py-2 rounded-xl font-black text-[10px]">MIGRATION PRO</button>
                        <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full font-black hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                    </div>
                </div>

                <div className="db-tabs no-scrollbar">
                    {collections.map(c => (
                        <button key={c} onClick={() => setActiveTab(c)} className={`db-tab-btn ${activeTab === c ? 'active' : ''}`}>
                            {c} ({data[c]?.length || 0})
                        </button>
                    ))}
                </div>
                
                <div className="p-4 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase border-b border-indigo-100">
                    {DESCRIPTIONS[activeTab] || `COLLECTION : ${activeTab.toUpperCase()}`}
                </div>

                <div className="db-table-container custom-scrollbar">
                    {currentData.length > 0 ? (
                        <table className="db-table">
                            <thead><tr>{columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
                            <tbody>
                                {currentData.map((row, i) => (
                                    <tr key={i}>
                                        {columns.map(col => (
                                            <td key={col} className="truncate max-w-[150px]" title={typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col])}>
                                                {typeof row[col] === 'object' ? (Array.isArray(row[col]) ? `[Array(${row[col].length})]` : '{Objet}') : String(row[col])}
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