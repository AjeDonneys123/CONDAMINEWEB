import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { 
                id: 'US#1', title: 'Accès Hybride (Google/Code)', 
                files: [
                    { path: 'server/features/auth/auth.routes.js', desc: 'Pilote les jetons OAuth2 Google et valide le code secret prof.' },
                    { path: 'client/src/features/auth/Login.jsx', desc: 'Formulaire intelligent aiguillant vers l\'interface Prof ou Élève.' }
                ], risk: 'LOW' 
            },
            { 
                id: 'US#2', title: 'Isolation Étanche', 
                files: [
                    { path: 'client/src/App.jsx', desc: 'Garantit qu\'un élève ne peut jamais accéder aux routes prof via le state React.' }
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
                    { path: 'server/services/ai.service.js', desc: 'Moteur Gemini 2.0 convertissant un sujet brut en JSON pédagogique.' },
                    { path: 'server/features/games/games.routes.js', desc: 'Interface API pour stocker et distribuer les niveaux de jeux.' }
                ], risk: 'MEDIUM' 
            },
            { 
                id: 'US#11', title: 'Carnet d\'Erreurs Transverse', 
                files: [
                    { path: 'server/services/mistake.service.js', desc: 'Service optimum d\'archivage des fautes (utilisé par Jeux et Devoirs).' },
                    { path: 'server/models/Player.js', desc: 'Stockage physique des erreurs orthographiques de l\'élève.' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { 
                id: 'US#3', title: 'Correction IA Flash', 
                files: [
                    { path: 'server/services/homework.service.js', desc: 'Encapsule la logique de correction, notation et feedback IA.' },
                    { path: 'server/features/homework/homework.routes.js', desc: 'Passerelle réseau entre l\'élève et le service de correction.' }
                ], risk: 'CRITICAL' 
            },
            { 
                id: 'US#14', title: 'Mémoire Pédagogique', 
                files: [
                    { path: 'server/models/TeacherStyle.js', desc: 'Définit les règles de notation (A/B/C pour 6/5e, /20 pour lycée).' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne (PilotSnap)', class: 'cat-scans',
        stories: [
            { 
                id: 'US#6', title: 'Capture Multi-Snap', 
                files: [
                    { path: 'client/src/features/prof/scans/ScansStudio.jsx', desc: 'Interface caméra mobile optimisée pour les rafales de copies.' },
                    { path: 'server/features/scans/scans.routes.js', desc: 'Réceptionne les flux Base64 et prépare l\'envoi vers Drive.' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { 
                id: 'US#4', title: 'Hiérarchie Auto-Gérée', 
                files: [
                    { path: 'server/services/structure.service.js', desc: 'Architecte : réconcilie la BDD avec les dossiers physiques du Drive.' },
                    { path: 'server/services/drive.service.js', desc: 'Ouvrier technique : exécute les appels vers l\'API Google Drive.' }
                ], risk: 'CRITICAL' 
            },
            { 
                id: 'US#8', title: 'Synchronisation / Nuke', 
                files: [
                    { path: 'server/features/structure/structure.routes.js', desc: 'Exécute le recalage BDD/Drive ou la purge totale d\'une classe.' }
                ], risk: 'HIGH' 
            }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { 
                id: 'US#15', title: 'Gestion de Classe & Profs', 
                files: [
                    { path: 'server/features/admin/admin.routes.js', desc: 'Permet la création/suppression de classes avec nettoyage en cascade.' },
                    { path: 'client/src/features/prof/ProfPage.jsx', desc: 'Contrôleur central de l\'espace enseignant et sélecteur dynamique.' }
                ], risk: 'HIGH' 
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
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Carte du Système (Audit Porosité)</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 332 : Surveillance des points de rupture</p>
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
                                                <span className="file-tag-path">{f.path}</span>
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