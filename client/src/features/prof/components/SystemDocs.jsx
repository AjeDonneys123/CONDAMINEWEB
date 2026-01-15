import React from 'react';
import './SystemDocs.css';

const DOC_MAP = [
    {
        id: 'auth', title: '🔐 Authentification', class: 'cat-auth',
        stories: [
            { id: 'US#1', title: 'Accès Hybride', files: [{ path: 'server/features/auth/auth.routes.js', desc: 'Passerelle OAuth2.' }], risk: 'LOW' },
            { id: 'US#2', title: 'Isolation Rôles', files: [{ path: 'client/src/App.jsx', desc: 'State central de l\'application.' }], risk: 'HIGH' }
        ]
    },
    {
        id: 'homework', title: '📚 Devoirs & Pédagogie', class: 'cat-homework',
        stories: [
            { 
                id: 'US#3', title: 'Correction IA Flash', 
                files: [
                    { path: 'server/services/homework.service.js', desc: 'BLINDAGE : Encapsule l\'IA, les fautes et la BDD.' },
                    { path: 'server/features/homework/homework.routes.js', desc: 'Simple passerelle réseau.' }
                ], risk: 'MANAGED' 
            }
        ]
    },
    {
        id: 'archiving', title: '📂 Archivage & Drive', class: 'cat-archiving',
        stories: [
            { 
                id: 'US#4', title: 'Hiérarchie Auto-Gérée', 
                files: [
                    { path: 'server/services/structure.service.js', desc: 'BLINDAGE : Architecte BDD/Drive découplé.' },
                    { path: 'server/services/drive.service.js', desc: 'Ouvrier technique API Google.' }
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
                        <h2 className="text-2xl font-black uppercase">Constitution Condamine v2.3.3</h2>
                        <p className="text-xs text-slate-400 font-bold">Build 333 : Les zones CRITIQUES sont désormais ENCAPSULÉES dans des Services.</p>
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