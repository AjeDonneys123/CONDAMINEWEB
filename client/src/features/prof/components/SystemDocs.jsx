import React from 'react';
import './SystemDocs.css';

/**
 * 🗺️ CARTE DU SYSTÈME OPTIMUM (V2.3.6)
 * Cette carte reflète l'arbre de fichiers validé.
 */
const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Accès Hybride', files: [{ path: 'server/features/auth/auth.routes.js', desc: 'Gestion des jetons.' }], risk: 'LOW' },
            { id: 'US#2', title: 'Isolation Rôles', files: [{ path: 'client/src/App.jsx', desc: 'Routeur central Prof/Élève.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux', class: 'cat-games',
        stories: [
            { id: 'US#10', title: 'Quiz IA', files: [{ path: 'server/services/ai.service.js', desc: 'Moteur Gemini JSON.' }], risk: 'MANAGED' },
            { id: 'US#11', title: 'Erreurs', files: [{ path: 'server/services/mistake.service.js', desc: 'Archivage des fautes.' }], risk: 'LOW' }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs', class: 'cat-homework',
        stories: [
            { id: 'US#3', title: 'Analyse IA', files: [{ path: 'server/services/homework.service.js', desc: 'Logique de correction scellée.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { id: 'US#4', title: 'Miroir Cloud', files: [{ path: 'server/services/structure.service.js', desc: 'Gestion de l\'arborescence.' }, { path: 'server/services/drive.service.js', desc: 'API Google Drive.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { id: 'US#15', title: 'Classes', files: [{ path: 'server/features/admin/admin.routes.js', desc: 'Nettoyage des données.' }], risk: 'HIGH' }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Audit Architecture Optimum</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 336 : Le projet est propre et découplé.</p>
                    </div>
                    <button className="btn-close-docs" onClick={onClose}>✕</button>
                </div>
                <div className="docs-content custom-scrollbar">
                    {DOC_MAP.map(cat => (
                        <div key={cat.id} className={`doc-category-card ${cat.class}`}>
                            <h3 className="cat-title">{cat.title}</h3>
                            {cat.stories.map(us => (
                                <div key={us.id} className="us-block">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="us-title">{us.id} : {us.title}</span>
                                        <span className={`risk-badge risk-${us.risk.toLowerCase()}`}>{us.risk}</span>
                                    </div>
                                    <div className="file-list-docs">
                                        {us.files.map((f, idx) => (
                                            <div key={idx} className="file-entry-audit">
                                                <span className="file-path-audit">{f.path}</span>
                                                <p className="file-desc-audit">{f.desc}</p>
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