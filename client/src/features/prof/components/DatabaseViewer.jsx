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
    players_legacy: "⚠️ LEGACY. Anciennes données à migrer."
};

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('students');
    const [loading, setLoading] = useState(true);

    const loadData = () => {
        setLoading(true);
        fetch('/api/admin/database-dump')
            .then(res => res.json())
            .then(d => { setData(d); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(() => { loadData(); }, []);

    const handleMigrate = async () => {
        if(!confirm("Lancer la migration vers la structure ARCHITECTE PRO ?")) return;
        await fetch('/api/admin/maintenance/migrate-legacy', { method: 'POST' });
        loadData();
    };

    if (loading) return <div className="db-viewer-overlay"><h2 className="text-white font-black animate-pulse">SYNCHRONISATION BDD PRO...</h2></div>;

    const collections = Object.keys(data || {}).sort();
    const currentData = data[activeTab] || [];
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
                        <button onClick={onClose} className="w-10 h-10 bg-slate-100 rounded-full font-black">✕</button>
                    </div>
                </div>

                <div className="db-tabs no-scrollbar">
                    {collections.map(c => (
                        <button key={c} onClick={() => setActiveTab(c)} className={`db-tab-btn ${activeTab === c ? 'active' : ''}`}>
                            {c} ({data[c].length})
                        </button>
                    ))}
                </div>
                
                <div className="p-4 bg-indigo-50 text-indigo-700 font-bold text-[10px] uppercase">
                    {DESCRIPTIONS[activeTab]}
                </div>

                <div className="db-table-container custom-scrollbar">
                    {currentData.length > 0 ? (
                        <table className="db-table">
                            <thead><tr>{columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
                            <tbody>
                                {currentData.map((row, i) => (
                                    <tr key={i}>
                                        {columns.map(col => (
                                            <td key={col} className="truncate max-w-[150px]">
                                                {typeof row[col] === 'object' ? 'OBJET' : String(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <div className="p-20 text-center text-slate-300 font-black">TABLE VIDE</div>}
                </div>
            </div>
        </div>
    );
}