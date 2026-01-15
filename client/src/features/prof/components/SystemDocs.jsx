import React from 'react';
import './SystemDocs.css';

/**
 * 🗺️ CARTE DU SYSTÈME CONDAMINE (FULL 6 PILIERS)
 * Build 337 : Inclusion de la fonctionnalité Scanne.
 */
const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Accès Hybride', files: [{ path: 'server/features/auth/auth.routes.js', desc: 'Passerelle OAuth2 et codes secrets.' }], risk: 'LOW' },
            { id: 'US#2', title: 'Isolation Rôles', files: [{ path: 'client/src/App.jsx', desc: 'Routeur et persistance session.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux', class: 'cat-games',
        stories: [
            { id: 'US#10', title: 'Quiz IA', files: [{ path: 'server/services/ai.service.js', desc: 'Moteur Gemini JSON.' }], risk: 'MANAGED' },
            { id: 'US#11', title: 'Erreurs', files: [{ path: 'server/services/mistake.service.js', desc: 'Service d\'archivage des fautes.' }], risk: 'LOW' }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs', class: 'cat-homework',
        stories: [
            { id: 'US#3', title: 'Analyse IA', files: [{ path: 'server/services/homework.service.js', desc: 'Intelligence de correction scellée.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne (PilotSnap)', class: 'cat-scans',
        stories: [
            { id: 'US#6', title: 'Capture Multi-Snap', files: [
                { path: 'server/services/scan.service.js', desc: 'Service de gestion des sessions de capture.' },
                { path: 'client/src/features/prof/scans/ScansStudio.jsx', desc: 'Contrôleur caméra et interface de rafale.' }
            ], risk: 'MEDIUM' }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { id: 'US#4', title: 'Miroir Cloud', files: [{ path: 'server/services/structure.service.js', desc: 'Architecte BDD/Drive.' }, { path: 'server/services/drive.service.js', desc: 'API Google Drive.' }], risk: 'MANAGED' }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { id: 'US#15', title: 'Classes', files: [{ path: 'server/features/admin/admin.routes.js', desc: 'Nettoyage radical des données.' }], risk: 'HIGH' }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Audit Architecture Condamine</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 337 : Rétablissement de l'exhaustivité (6 piliers)</p>
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