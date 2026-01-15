import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { 
                id: 'US#1', title: 'Accès Hybride', 
                files: [
                    { path: 'server/features/auth/auth.routes.js', desc: 'Gestion des jetons et validation sécurisée.' },
                    { path: 'client/src/features/auth/Login.jsx', desc: 'Interface de tri Prof/Élève.' }
                ], risk: 'LOW' 
            },
            { 
                id: 'US#2', title: 'Isolation Étanche', 
                files: [
                    { path: 'client/src/App.jsx', desc: 'SÉCURISÉ : Routeur découplé du moniteur réseau.' }
                ], risk: 'MANAGED' 
            }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux (Zombie/Starship)', class: 'cat-games',
        stories: [
            { 
                id: 'US#10', title: 'Génération Quiz IA', 
                files: [
                    { path: 'server/services/ai.service.js', desc: 'Moteur Gemini protégé par un sanitizer JSON.' }
                ], risk: 'MANAGED' 
            },
            { 
                id: 'US#11', title: 'Carnet d\'Erreurs', 
                files: [
                    { path: 'server/services/mistake.service.js', desc: 'Service central d\'archivage des fautes.' }
                ], risk: 'LOW' 
            }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { 
                id: 'US#3', title: 'Correction IA', 
                files: [
                    { path: 'server/services/homework.service.js', desc: 'SÉCURISÉ : Logique métier hors des routes.' }
                ], risk: 'MANAGED' 
            }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne (PilotSnap)', class: 'cat-scans',
        stories: [
            { 
                id: 'US#6', title: 'Capture Multi-Snap', 
                files: [
                    { path: 'client/src/features/prof/scans/ScansStudio.jsx', desc: 'Contrôleur caméra natif.' }
                ], risk: 'LOW' 
            }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { 
                id: 'US#4', title: 'Hiérarchie Drive', 
                files: [
                    { path: 'server/services/structure.service.js', desc: 'SÉCURISÉ : Création atomique BDD + Drive.' },
                    { path: 'server/services/drive.service.js', desc: 'Vérificateur de jeton avant action.' }
                ], risk: 'MANAGED' 
            }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { 
                id: 'US#15', title: 'Gestion Classes', 
                files: [
                    { path: 'server/features/admin/admin.routes.js', desc: 'Nettoyage en cascade sécurisé.' }
                ], risk: 'MANAGED' 
            }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Tableau des Risques Condamine</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 335 : Les points de rupture sont passés sous contrôle (MANAGED)</p>
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