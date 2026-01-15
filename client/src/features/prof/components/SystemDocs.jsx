import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Accès Hybride', files: [{ path: 'server/features/auth/auth.routes.js', desc: 'OAuth2.' }], risk: 'LOW' },
            { id: 'US#2', title: 'Isolation Rôles', files: [{ path: 'client/src/App.jsx', desc: 'Routeur racine.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux', class: 'cat-games',
        stories: [
            { id: 'US#10', title: 'Quiz IA', files: [{ path: 'server/services/ai.service.js', desc: 'Moteur Gemini.' }], risk: 'MANAGED' },
            { id: 'US#11', title: 'Erreurs', files: [{ path: 'server/services/mistake.service.js', desc: 'Archivage fautes.' }], risk: 'LOW' }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs', class: 'cat-homework',
        stories: [
            { id: 'US#3', title: 'Analyse IA', files: [{ path: 'server/services/homework.service.js', desc: 'Correction IA.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne', class: 'cat-scans',
        stories: [
            { id: 'US#6', title: 'PilotSnap', files: [{ path: 'server/services/scan.service.js', desc: 'Sessions scan.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { id: 'US#4', title: 'Hiérarchie Drive', files: [{ path: 'server/services/structure.service.js', desc: 'Architecte.' }, { path: 'server/services/drive.service.js', desc: 'API Drive.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { id: 'US#15', title: 'Gestion de Classe', files: [{ path: 'server/services/admin.service.js', desc: 'Maintenance.' }], risk: 'MANAGED' }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Carte du Système (Build #133)</h2>
                        <p className="text-xs text-slate-400 font-bold">Mode Hybride Activé (Brain Gmail + Drive Pro)</p>
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