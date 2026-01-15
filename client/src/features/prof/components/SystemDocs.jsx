import React from 'react';
import './SystemDocs.css';

/**
 * 🗺️ CARTE INTÉGRALE DES 6 PILIERS (CONSTITUTION CONDAMINE)
 */
const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { 
                id: 'US#1', title: 'Connexion Hybride (Google/Code)', 
                files: [
                    { path: 'server/features/auth/auth.routes.js', desc: 'Pilote les jetons OAuth2 Google et valide le code secret prof.' },
                    { path: 'client/src/features/auth/Login.jsx', desc: 'Interface de saisie et redirection intelligente Prof/Élève.' }
                ], risk: 'LOW' 
            },
            { 
                id: 'US#2', title: 'Isolation Étanche', 
                files: [
                    { path: 'client/src/App.jsx', desc: 'Routeur racine gérant la persistance de session (State Central).' }
                ], risk: 'HIGH' 
            }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux (Zombie/Starship)', class: 'cat-games',
        stories: [
            { 
                id: 'US#10', title: 'Génération de Quiz IA', 
                files: [
                    { path: 'server/services/ai.service.js', desc: 'Moteur Gemini 2.0 Flash : traducteur de texte en JSON éducatif.' },
                    { path: 'server/features/games/games.routes.js', desc: 'Interface API pour la création et distribution des niveaux.' }
                ], risk: 'MEDIUM' 
            },
            { 
                id: 'US#11', title: 'Carnet d\'Erreurs Transverse', 
                files: [
                    { path: 'server/services/mistake.service.js', desc: 'Service optimum d\'archivage des fautes (Jeux + Devoirs).' },
                    { path: 'server/models/Player.js', desc: 'Stockage physique des erreurs d\'orthographe par élève.' }
                ], risk: 'LOW' 
            }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { 
                id: 'US#3', title: 'Analyse IA Flash', 
                files: [
                    { path: 'server/services/homework.service.js', desc: 'Encapsulation : Correction, notation et retour pédagogique.' },
                    { path: 'server/features/homework/homework.routes.js', desc: 'Passerelle réseau entre l\'élève et le moteur de correction.' }
                ], risk: 'MANAGED' 
            },
            { 
                id: 'US#14', title: 'Style Enseignant', 
                files: [
                    { path: 'server/models/TeacherStyle.js', desc: 'Base de données des règles de notation personnalisées (A/B/C).' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne (PilotSnap)', class: 'cat-scans',
        stories: [
            { 
                id: 'US#6', title: 'Capture Multi-Snap Caméra', 
                files: [
                    { path: 'client/src/features/prof/scans/ScansStudio.jsx', desc: 'Interface de pilotage caméra pour copies physiques.' },
                    { path: 'server/features/scans/scans.routes.js', desc: 'Gestionnaire de flux Base64 et archivage temporaire.' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { 
                id: 'US#4', title: 'Hiérarchie Drive Miroir', 
                files: [
                    { path: 'server/services/structure.service.js', desc: 'Architecte : réconcilie la BDD avec les dossiers physiques.' },
                    { path: 'server/services/drive.service.js', desc: 'Ouvrier technique : pilote direct de l\'API Google Drive.' }
                ], risk: 'MANAGED' 
            },
            { 
                id: 'US#8', title: 'Sync / Nuke / Supprimer', 
                files: [
                    { path: 'server/features/structure/structure.routes.js', desc: 'Aiguillage des ordres de destruction physique (US#9).' }
                ], risk: 'HIGH' 
            }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { 
                id: 'US#15', title: 'Gestion Classes & Profs', 
                files: [
                    { path: 'server/features/admin/admin.routes.js', desc: 'Contrôleur de suppression de classes et dump de diagnostic.' },
                    { path: 'client/src/features/prof/ProfPage.jsx', desc: 'Interface de pilotage et détection dynamique des classes.' }
                ], risk: 'HIGH' 
            },
            { 
                id: 'US#13', title: 'Diagnostic Déploiement', 
                files: [
                    { path: 'server/server.js', desc: 'Génère le Boot ID serveur pour rafraîchissement auto.' }
                ], risk: 'MEDIUM' 
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
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Carte du Système (Full 360°)</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 334 : Documentation intégrale des 6 piliers fonctionnels</p>
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