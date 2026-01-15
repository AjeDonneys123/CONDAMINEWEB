import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Connexion Hybride', files: [{ path: 'server/features/auth/auth.routes.js', desc: 'Gestion des tokens et mots de passe.' }], risk: 'LOW' },
            { id: 'US#2', title: 'Isolation Prof/Élève', files: [{ path: 'client/src/App.jsx', desc: 'Routeur racine de l\'application.' }], risk: 'HIGH' }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux', class: 'cat-games',
        stories: [
            { id: 'US#10', title: 'Génération Quiz IA', files: [{ path: 'server/services/ai.service.js', desc: 'Générateur Gemini 2.0.' }], risk: 'MEDIUM' },
            { id: 'US#11', title: 'Carnet d’erreurs', files: [{ path: 'server/services/mistake.service.js', desc: 'Service central d\'archivage des erreurs.' }], risk: 'LOW' }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs', class: 'cat-homework',
        stories: [
            { id: 'US#3', title: 'Analyse et Correction IA', files: [
                { path: 'server/services/homework.service.js', desc: 'Encapsule toute la logique de correction élève.' },
                { path: 'server/features/homework/homework.routes.js', desc: 'Point d\'entrée réseau (découplé).' }
            ], risk: 'MEDIUM' }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { id: 'US#4', title: 'Hiérarchie Miroir', files: [
                { path: 'server/services/structure.service.js', desc: 'Gère la double création BDD + Drive.' },
                { path: 'server/services/drive.service.js', desc: 'Interface technique Google Drive API.' }
            ], risk: 'HIGH' }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Architecture Optimum V3 (Découplée)</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 329 : Les routes sont devenues des passerelles, la logique est dans les Services.</p>
                    </div>
                    <button className="btn-close-docs" onClick={onClose}>✕</button>
                </div>
                <div className="docs-content custom-scrollbar">
                    {DOC_MAP.map(cat => (
                        <div key={cat.id} className={`doc-category-card ${cat.class}`}>
                            <h3 className="cat-title">{cat.title}</h3>
                            {cat.stories.map(us => (
                                <div key={us.id} className="us-block">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="us-title">{us.id} : {us.title}</span>
                                        <span className={`risk-badge risk-${us.risk.toLowerCase()}`}>{us.risk}</span>
                                    </div>
                                    <div className="file-list">
                                        {us.files.map((f, idx) => (
                                            <div key={idx} className="file-item-doc">
                                                <span className="file-tag-path">{f.path}</span>
                                                <p className="file-desc-text">{f.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}