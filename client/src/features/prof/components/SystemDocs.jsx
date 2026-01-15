import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Connexion Hybride', files: ['server/features/auth/auth.routes.js', 'client/src/features/auth/Login.jsx'], risk: 'LOW' },
            { id: 'US#2', title: 'Isolation Prof/Élève', files: ['client/src/App.jsx'], risk: 'HIGH' }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux', class: 'cat-games',
        stories: [
            { id: 'US#10', title: 'Génération Quiz IA', files: ['server/features/games/games.routes.js', 'server/services/ai.service.js'], risk: 'MEDIUM' },
            { id: 'US#11', title: 'Carnet d’erreurs', files: ['server/models/Player.js', 'server/features/homework/homework.routes.js'], risk: 'HIGH' }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs', class: 'cat-homework',
        stories: [
            { id: 'US#3', title: 'Analyse IA', files: ['server/features/homework/homework.routes.js', 'server/services/ai.service.js'], risk: 'CRITICAL' }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { id: 'US#4', title: 'Hiérarchie Drive', files: ['server/services/drive.service.js', 'server/features/structure/structure.routes.js'], risk: 'MEDIUM' },
            { id: 'US#9', title: 'Nettoyage Intégral', files: ['server/features/homework/homework.routes.js', 'server/features/structure/structure.routes.js'], risk: 'HIGH' }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { id: 'US#13', title: 'Moniteur Déploiement', files: ['server/server.js', 'client/src/App.jsx'], risk: 'MEDIUM' },
            { id: 'US#15', title: 'Raw Explorer BDD', files: ['server/features/admin/admin.routes.js', 'client/src/features/prof/components/DatabaseViewer.jsx'], risk: 'LOW' }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Carte du Système (Audit Porosité)</h2>
                        <p className="text-xs text-slate-400 font-bold">Analyse Build 326 : Surveillance des fichiers partagés</p>
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
                                        {us.files.map(f => (
                                            <span key={f} className={`file-tag ${DOC_MAP.filter(c => c.stories.some(s => s.files.includes(f))).length > 1 ? 'is-shared' : ''}`}>
                                                {f} {DOC_MAP.filter(c => c.stories.some(s => s.files.includes(f))).length > 1 ? '⚠️' : ''}
                                            </span>
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