import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Connexion Hybride (Google/Code)', files: ['server/features/auth/auth.routes.js', 'client/src/features/auth/Login.jsx'] },
            { id: 'US#2', title: 'Isolation Prof/Élève', files: ['client/src/App.jsx', 'server/models/Teacher.js'] }
        ]
    },
    {
        id: 'games', title: '🕹️ Jeux (Zombie/Starship)', class: 'cat-games',
        stories: [
            { id: 'US#10', title: 'Génération de Quiz par IA Flash', files: ['server/features/games/games.routes.js', 'server/services/ai.service.js'] },
            { id: 'US#11', title: 'Mise à jour Carnet d’erreurs', files: ['server/features/homework/homework.routes.js', 'server/models/Player.js'] }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { id: 'US#3', title: 'Analyse et Correction IA', files: ['server/features/homework/homework.routes.js', 'server/services/ai.service.js'] },
            { id: 'US#14', title: 'Respect du Style Enseignant', files: ['server/models/TeacherStyle.js', 'client/src/features/eleve/homework/HomeworkWorkspace.jsx'] }
        ]
    },
    {
        id: 'scans', title: '📤 Scans & Capture IA', class: 'cat-scans',
        stories: [
            { id: 'US#6', title: 'Capture Multi-Snap Caméra', files: ['client/src/features/prof/scans/ScansStudio.jsx', 'server/features/scans/scans.routes.js'] }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Miroir Drive', class: 'cat-archiving',
        stories: [
            { id: 'US#4', title: 'Hiérarchie Drive Automatique', files: ['server/services/drive.service.js', 'server/features/structure/structure.routes.js'] },
            { id: 'US#5', title: 'Normalisation Physique des Noms', files: ['server/services/drive.service.js'] },
            { id: 'US#8', title: 'Synchronisation / Nuke', files: ['server/features/structure/structure.routes.js', 'client/src/features/prof/components/ProfStudioFolder.jsx'] },
            { id: 'US#9', title: 'Nettoyage Intégral Drive', files: ['server/features/homework/homework.routes.js', 'server/features/structure/structure.routes.js'] }
        ]
    },
    {
        id: 'admin', title: '⚙️ Administration', class: 'cat-admin',
        stories: [
            { id: 'US#13', title: 'Moniteur de Déploiement Auto', files: ['server/server.js', 'client/src/App.jsx'] },
            { id: 'US#15', title: 'Explorateur BDD (Raw Explorer)', files: ['server/features/admin/admin.routes.js', 'client/src/features/prof/components/DatabaseViewer.jsx'] }
        ]
    }
];

export default function SystemDocs({ onClose }) {
    return (
        <div className="docs-overlay animate-in" onClick={onClose}>
            <div className="docs-window" onClick={e => e.stopPropagation()}>
                <div className="docs-header">
                    <div>
                        <h2 className="text-2xl font-black uppercase tracking-tighter">Carte du Système Condamine</h2>
                        <p className="text-xs text-slate-400 font-bold">Liaison User Stories ➔ Fichiers de code</p>
                    </div>
                    <button className="btn-close-docs" onClick={onClose}>✕</button>
                </div>
                <div className="docs-content custom-scrollbar">
                    {DOC_MAP.map(cat => (
                        <div key={cat.id} className={`doc-category-card ${cat.class}`}>
                            <h3 className="cat-title">{cat.title}</h3>
                            {cat.stories.map(us => (
                                <div key={us.id} className="us-block">
                                    <span className="us-title">{us.id} : {us.title}</span>
                                    <div className="file-list">
                                        {us.files.map(f => (
                                            <span key={f} className="file-tag">{f}</span>
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