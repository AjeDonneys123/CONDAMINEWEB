import React, { useState, useEffect } from 'react';
import './DatabaseViewer.css';

const DESCRIPTIONS = {
    players: "👤 Base des élèves. Gère l'appartenance aux classes et l'historique des erreurs d'orthographe (US #11).",
    chapters: "📁 Dossiers de cours. Sert de pivot pour la création automatique de l'arborescence Google Drive (US #4).",
    homeworks: "📝 Paramètres des devoirs (IA). Définit les consignes, les documents supports et les dossiers Cloud associés.",
    gamelevels: "🎮 Moteur de quiz. Contient les questions et les réponses pour les jeux Zombie et Starship (US #10).",
    scansessions: "📸 Sessions de scan camera. Fait le lien entre les photos brutes et les corrections IA générées.",
    submissions: "📤 Rendu des élèves. Contient les textes tapés par les élèves et les notes attribuées par l'IA.",
    teachers: "🎓 Comptes enseignants. Stocke les préférences, les matières et le code secret d'accès.",
    bugs: "🐞 Journal technique. Liste les incidents rapportés par les utilisateurs pour le débogage.",
    deploysignals: "📡 Signal de déploiement. Force le rafraîchissement auto des clients lors d'une mise à jour (US #13)."
};

export default function DatabaseViewer({ onClose }) {
    const [data, setData] = useState(null);
    const [activeTab, setActiveTab] = useState('players');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetch('/api/database-dump')
            .then(async res => {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.details || `Erreur ${res.status}`);
                }
                return res.json();
            })
            .then(d => { setData(d); setLoading(false); })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="db-viewer-overlay"><div className="text-white font-black animate-pulse">SYNCHRO BDD...</div></div>;

    if (error) return (
        <div className="db-viewer-overlay">
            <div className="bg-white p-8 rounded-3xl max-w-lg text-center shadow-2xl">
                <h2 className="text-red-600 font-black text-xl mb-4">ERREUR SERVEUR</h2>
                <p className="text-slate-500 text-sm mb-6">{error}</p>
                <button onClick={onClose} className="bg-slate-900 text-white px-6 py-2 rounded-xl font-bold">FERMER</button>
            </div>
        </div>
    );

    const collections = [
        { key: 'players', label: 'players', color: 'bg-blue-500' },
        { key: 'chapters', label: 'chapters', color: 'bg-indigo-500' },
        { key: 'homeworks', label: 'homeworks', color: 'bg-orange-500' },
        { key: 'gamelevels', label: 'gamelevels', color: 'bg-purple-500' },
        { key: 'scansessions', label: 'scans', color: 'bg-emerald-500' },
        { key: 'submissions', label: 'rendus', color: 'bg-pink-500' },
        { key: 'teachers', label: 'profs', color: 'bg-slate-700' }
    ];

    const currentData = (data && data[activeTab]) ? data[activeTab] : [];
    const columns = currentData.length > 0 ? Object.keys(currentData[0]).filter(k => k !== '__v') : [];

    return (
        <div className="db-viewer-overlay animate-in">
            <div className="db-viewer-window shadow-2xl">
                <div className="db-header">
                    <div className="flex flex-col text-left">
                        <h2 className="text-xl font-black uppercase">MongoDB Raw Explorer</h2>
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Diagnostic en direct</span>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full font-black text-slate-400 hover:text-red-500 transition-colors">✕</button>
                </div>

                <div className="db-tabs no-scrollbar overflow-x-auto">
                    {collections.map(c => (
                        <button 
                            key={c.key} 
                            onClick={() => setActiveTab(c.key)} 
                            className={`db-tab-btn whitespace-nowrap ${activeTab === c.key ? 'active ' + c.color : ''}`}
                        >
                            {c.label} ({data?.[c.key]?.length || 0})
                        </button>
                    ))}
                </div>
                
                <div className="db-tab-desc">
                    {DESCRIPTIONS[activeTab] || "Données système."}
                </div>

                <div className="db-table-container custom-scrollbar">
                    {currentData.length > 0 ? (
                        <table className="db-table">
                            <thead><tr>{columns.map(col => <th key={col} className="uppercase text-[9px] font-black text-slate-400">{col}</th>)}</tr></thead>
                            <tbody>
                                {currentData.map((row, i) => (
                                    <tr key={i} className="hover:bg-slate-50">
                                        {columns.map(col => (
                                            <td key={col} className="truncate max-w-[200px]">
                                                {typeof row[col] === 'object' ? 'OBJ' : String(row[col])}
                                            </td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : <div className="p-20 text-center text-slate-300 font-black uppercase text-xs">Collection vide</div>}
                </div>
            </div>
        </div>
    );
}