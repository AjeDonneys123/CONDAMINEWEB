import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { 
                id: 'US#1', title: 'Connexion Hybride', 
                files: [
                    { path: 'server/features/auth/auth.routes.js', desc: 'Gère les flux OAuth Google et vérification des mots de passe.' },
                    { path: 'client/src/features/auth/Login.jsx', desc: 'Interface de saisie et redirection selon le rôle (Prof/Élève).' }
                ], risk: 'LOW' 
            },
            { 
                id: 'US#2', title: 'Isolation Prof/Élève', 
                files: [
                    { path: 'client/src/App.jsx', desc: 'Routeur racine et persistance de session locale.' }
                ], risk: 'HIGH' 
            }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux (Zombie/Starship)', class: 'cat-games',
        stories: [
            { 
                id: 'US#10', title: 'Génération Quiz IA', 
                files: [
                    { path: 'server/features/games/games.routes.js', desc: 'Point d\'entrée API pour la création et suppression de quiz.' },
                    { path: 'server/services/ai.service.js', desc: 'Moteur Gemini 2.0 Flash traduisant les cours en JSON Questions/Réponses.' }
                ], risk: 'MEDIUM' 
            },
            { 
                id: 'US#11', title: 'Mise à jour Carnet d’erreurs', 
                files: [
                    { path: 'server/models/Player.js', desc: 'Stocke les fautes d\'orthographe détectées pour chaque élève.' }
                ], risk: 'HIGH' 
            }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { 
                id: 'US#3', title: 'Analyse et Correction IA', 
                files: [
                    { path: 'server/features/homework/homework.routes.js', desc: 'Orchestre la correction entre le texte élève et l\'IA.' },
                    { path: 'server/models/Submission.js', desc: 'Archive historique des copies et notes attribuées.' }
                ], risk: 'CRITICAL' 
            },
            { 
                id: 'US#14', title: 'Style Enseignant', 
                files: [
                    { path: 'server/models/TeacherStyle.js', desc: 'Mémoire pédagogique (Notation A/B/C ou /20).' }
                ], risk: 'MEDIUM' 
            }
        ]
    },
    {
        id: 'scans', title: '📤 Scanne & Capture', class: 'cat-scans',
        stories: [
            { 
                id: 'US#6', title: 'Capture Multi-Snap', 
                files: [
                    { path: 'client/src/features/prof/scans/ScansStudio.jsx', desc: 'Pilote caméra pour capture de copies physiques.' },
                    { path: 'server/models/ScanSession.js', desc: 'Structure de données des sessions de scan en attente.' }
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
                    { path: 'server/services/drive.service.js', desc: 'Génie civil du Drive : crée et organise les dossiers physiques.' },
                    { path: 'server/features/structure/structure.routes.js', desc: 'Synchronise les chapitres BDD avec l\'arborescence Cloud.' }
                ], risk: 'CRITICAL' 
            },
            { 
                id: 'US#9', title: 'Nettoyage Intégral', 
                files: [
                    { path: 'server/features/structure/structure.routes.js', desc: 'Exécute la destruction physique des entités sur Drive (US#9).' }
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
                    { path: 'server/server.js', desc: 'Génère le Boot ID unique à chaque démarrage serveur.' }
                ], risk: 'MEDIUM' 
            },
            { 
                id: 'US#15', title: 'Raw Explorer BDD', 
                files: [
                    { path: 'server/features/admin/admin.routes.js', desc: 'Expose le dump sécurisé des collections MongoDB.' },
                    { path: 'client/src/features/prof/components/DatabaseViewer.jsx', desc: 'Interface de diagnostic des données brutes.' }
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
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Carte du Système (Audit Porosité)</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 327 : Documentation technique & fonctionnelle</p>
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