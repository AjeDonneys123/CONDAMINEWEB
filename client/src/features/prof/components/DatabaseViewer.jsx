import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

const DESCRIPTIONS = {
    players: "👤 Base des élèves. Gère l'appartenance aux classes et l'historique des erreurs d'orthographe (US #11).",
    chapters: "📁 Dossiers de cours. Sert de pivot pour la création automatique de l'arborescence Google Drive (US #4).",
    homeworks: "📝 Paramètres des devoirs (IA). Définit les consignes, les documents supports et les élèves ciblés.",
    gamelevels: "🎮 Moteur de quiz. Contient les questions et les réponses pour les jeux Zombie et Starship (US #10).",
    scansessions: "📸 Sessions de scan camera. Fait le lien entre les photos brutes et les corrections IA générées.",
    teachers: "🎓 Comptes enseignants. Stocke les préférences, les matières et le code secret d'accès.",
    bugs: "🐞 Journal technique. Liste les incidents rapportés par les utilisateurs pour le débogage.",
    deploysignals: "📡 Signal de déploiement. Force le rafraîchissement auto des clients lors d'une mise à jour (US #13)."
};

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('players');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/database-dump')
            .then(res => res.json())
            .then(d => { setData(d); setLoading(false); });
    }, []);

    if (loading) return <div className="db-viewer-overlay"><div className="text-white font-black animate-pulse">ACCÈS MONGODB ATLAS...</div></div>;

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
    const columns = currentData.length > 0 ? Object.keys(currentData[0]).filter(k => k !== '__v') : [];

    return (
        <div className="db-viewer-overlay animate-in">
            <div className="db-viewer-window">
                <div className="db-header">
                    <h2 className="text-xl font-black uppercase">MongoDB Raw Explorer</h2>
                    <button onClick={onClose} className="font-black text-slate-300">✕</button>
                </div>
                <div className="db-tabs no-scrollbar overflow-x-auto">
                    {collections.map(c => (
                        <button key={c.key} onClick={() => setActiveTab(c.key)} className={`db-tab-btn whitespace-nowrap ${activeTab === c.key ? 'active ' + c.color : ''}`}>
                            {c.label} ({data[c.key]?.length || 0})
                        </button>
                    ))}
                </div>
                
                {/* BANDEAU DESCRIPTIF CONTEXTUEL */}
                <div className="db-tab-desc">
                    {DESCRIPTIONS[activeTab] || "Données système."}
                </div>

                <div className="db-table-container custom-scrollbar">
                    <table className="db-table">
                        <thead><tr>{columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
                        <tbody>
                            {currentData.map((row, i) => (
                                <tr key={i}>{columns.map(col => <td key={col}>{typeof row[col] === 'object' ? 'OBJ' : String(row[col])}</td>)}</tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}