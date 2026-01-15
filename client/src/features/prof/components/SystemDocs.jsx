import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { 
                id: 'US#1', title: 'Connexion Hybride', 
                files: [
                    { path: 'server/features/auth/auth.routes.js', desc: 'Gestion sécurisée des tokens OAuth2 et des accès par code secret.' },
                    { path: 'client/src/features/auth/Login.jsx', desc: 'Interface de login intelligente avec détection automatique du rôle.' }
                ], risk: 'LOW' 
            }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux (Zombie/Starship)', class: 'cat-games',
        stories: [
            { 
                id: 'US#10', title: 'Génération Quiz IA', 
                files: [
                    { path: 'server/features/games/games.routes.js', desc: 'Endpoint de gestion des niveaux et déclenchement de la génération.' },
                    { path: 'server/services/ai.service.js', desc: 'Moteur de conversion Gemini pour transformer les thèmes en questions JSON.' }
                ], risk: 'MEDIUM' 
            },
            { 
                id: 'US#11', title: 'Carnet d’erreurs', 
                files: [
                    { path: 'server/services/mistake.service.js', desc: 'OPTIMUM : Service central gérant l\'archivage des fautes d\'orthographe.' },
                    { path: 'server/models/Player.js', desc: 'Base de stockage des erreurs transverses (Jeux + Devoirs).' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { 
                id: 'US#3', title: 'Analyse et Correction IA', 
                files: [
                    { path: 'server/features/homework/homework.routes.js', desc: 'Orchestrateur : reçoit les copies, demande l\'IA et archive les rendus.' },
                    { path: 'server/services/mistake.service.js', desc: 'Injecte les fautes détectées dans le profil de l\'élève.' }
                ], risk: 'CRITICAL' 
            }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne & Capture', class: 'cat-scans',
        stories: [
            { 
                id: 'US#6', title: 'Capture Multi-Snap', 
                files: [
                    { path: 'client/src/features/prof/scans/ScansStudio.jsx', desc: 'Interface caméra avec prévisualisation et upload Base64.' }
                ], risk: 'LOW' 
            }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { 
                id: 'US#4', title: 'Hiérarchie Miroir', 
                files: [
                    { path: 'server/services/drive.service.js', desc: 'Responsable de la création physique des dossiers sur Google Drive.' },
                    { path: 'server/features/structure/structure.routes.js', desc: 'Fait le pont entre les dossiers BDD et les IDs physiques du Drive.' }
                ], risk: 'CRITICAL' 
            },
            { 
                id: 'US#9', title: 'Nettoyage Intégral', 
                files: [
                    { path: 'server/features/structure/structure.routes.js', desc: 'Garantit que supprimer dans l\'app supprime physiquement sur Drive.' }
                ], risk: 'HIGH' 
            }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { 
                id: 'US#13', title: 'Moniteur Déploiement', 
                files: [
                    { path: 'server/server.js', desc: 'Synchronise le Boot ID pour forcer le rechargement client.' }
                ], risk: 'MEDIUM' 
            },
            { 
                id: 'US#15', title: 'Raw Explorer BDD', 
                files: [
                    { path: 'server/features/admin/admin.routes.js', desc: 'Exportateur de collections pour diagnostic.' }
                ], risk: 'LOW' 
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
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Architecture Optimum V2</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 328 : Découplage de la logique de correction (MistakeService)</p>
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