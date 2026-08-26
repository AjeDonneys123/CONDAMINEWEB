// @signatures: SaveLoadModal, handleDeleteProject, handleSaveClick
import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import './SaveLoadModal.css';

// Les jeux importés/de la bibliothèque peuvent être ouverts et activés, mais
// ne doivent jamais être supprimables depuis la fenêtre « Charger ».
const BUILT_IN_GAME_PATTERN = /\b(jumper|starship|zombie|tapping|pok[eé]mon|cr[eé]atures|for[êe]t|wispguard|gardien|multiplication)\b/i;
const isBuiltInGame = (project) => Boolean(
    project?.isBuiltInGame || project?.isExternalGame || project?.isReadOnly ||
    BUILT_IN_GAME_PATTERN.test(String(project?.title || ''))
);

/**
 * 📂 MODALE DE GESTION DE PROJETS V500
 * - Chargement avec bouton suppression (X) sauf sur le premier fichier.
 * - Sauvegarde avec écrasement ou création.
 */
export default function SaveLoadModal({ mode, user, currentProject, onClose, onLoad, onSave, onNew }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saveName, setSaveName] = useState(currentProject?.title || "Nouveau Projet");
    const [showTrash, setShowTrash] = useState(false);

    const loadList = () => {
        setLoading(true);
        api.get(`/studio/projects/${user.id || user._id}`)
            .then(data => setProjects(data || []))
            .catch(() => setProjects([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        if (mode === 'LOAD' || mode === 'LIST' || mode === 'SAVE') {
            loadList();
        }
    }, [mode, user]);

    useEffect(() => {
        if (mode !== 'LOAD') setShowTrash(false);
    }, [mode]);

    const handleSaveClick = () => {
        if (!saveName.trim()) return alert("Nom requis !");
        onSave({ ...currentProject, title: saveName });
    };

    const patchProject = async (baseProject, patch) => {
        await api.post('/studio', { ...baseProject, ...patch });
        loadList();
    };

    const handleDeleteProject = async (e, project) => {
        e.stopPropagation();
        if (isBuiltInGame(project)) return;
        if (!confirm("Déplacer ce projet dans la corbeille ?")) return;
        try {
            await patchProject(project, { isTrashed: true });
        } catch (e) {
            alert("Erreur lors du déplacement vers la corbeille.");
        }
    };

    const handleToggleProjectStatus = async (e, project) => {
        e.stopPropagation();
        try {
            await patchProject(project, { isProduction: !project.isProduction });
        } catch (e2) {
            alert("Erreur lors du changement de statut.");
        }
    };

    const handleRestoreProject = async (e, project) => {
        e.stopPropagation();
        try {
            await patchProject(project, { isTrashed: false });
        } catch (e2) {
            alert("Erreur lors de la restauration.");
        }
    };

    const handlePermanentDelete = async (e, projectId) => {
        e.stopPropagation();
        if (!confirm("Supprimer définitivement ce projet de la corbeille ?")) return;
        try {
            const res = await fetch(`/api/studio/${projectId}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('delete-failed');
            loadList();
        } catch (e2) {
            alert("Erreur lors de la suppression définitive.");
        }
    };

    const activeProjects = projects
        .filter(p => !p.isTrashed)
        .sort((a, b) => Number(isBuiltInGame(b)) - Number(isBuiltInGame(a)));
    const trashedProjects = projects.filter(p => !!p.isTrashed);

    return (
        <div className="sl-modal-overlay" onClick={onClose}>
            <div className="sl-window" onClick={e => e.stopPropagation()}>
                <div className="sl-header">
                    <span className="sl-title">
                        {mode === 'SAVE' ? '💾 Sauvegarder' : '📂 Charger un projet'}
                    </span>
                    <button className="sl-close" onClick={onClose}>✕</button>
                </div>
                
                <div className="sl-body custom-scrollbar">
                    {mode === 'LOAD' && (
                        <>
                            <div className="sl-toolbar">
                                <button className="sl-new-btn !mb-0" onClick={onNew}>
                                    <span>✨</span> Créer un nouveau projet vide
                                </button>
                                <button
                                    className="sl-trash-btn"
                                    onClick={() => setShowTrash(v => !v)}
                                    title="Afficher la corbeille"
                                >
                                    {showTrash ? '↩ Projets' : `🗑 Corbeille (${trashedProjects.length})`}
                                </button>
                            </div>
                            <div className="h-px bg-slate-100 mb-4"></div>
                            
                            {loading ? (
                                <div className="text-center text-slate-400 font-bold p-4 animate-pulse">Chargement...</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {!showTrash && activeProjects.map((p) => {
                                        const builtIn = isBuiltInGame(p);
                                        return (
                                        <div key={p._id} className="sl-project-item group" onClick={() => !p.isVirtualBuiltin && onLoad(p)}>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="sl-p-name">{p.title}</span>
                                                    <span className={`sl-p-status ${p.isProduction ? 'prod' : 'ready'}`}>
                                                        {p.isProduction ? 'ACTIF' : 'INACTIF'}
                                                    </span>
                                                    {builtIn && <span className="sl-p-library">JEU INTÉGRÉ</span>}
                                                </div>
                                                <span className="sl-p-date">{p.isVirtualBuiltin ? 'Jeu élève · visibilité contrôlée ici' : new Date(p.updatedAt).toLocaleDateString()}</span>
                                            </div>

                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className={`px-2 py-1 rounded-lg text-[9px] font-black border ${
                                                        p.isProduction
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    }`}
                                                    onClick={(e) => handleToggleProjectStatus(e, p)}
                                                    title={p.isProduction ? "Rendre le jeu inactif" : "Rendre le jeu actif"}
                                                >
                                                    {p.isProduction ? 'DÉSACTIVER' : 'ACTIVER'}
                                                </button>
                                                {!builtIn && <button
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 font-black text-xs border border-red-100 hover:bg-red-500 hover:text-white"
                                                    onClick={(e) => handleDeleteProject(e, p)}
                                                    title="Déplacer dans la corbeille"
                                                >
                                                    ✕
                                                </button>}
                                            </div>
                                        </div>
                                        );
                                    })}

                                    {showTrash && trashedProjects.map((p) => (
                                        <div key={p._id} className="sl-project-item sl-project-item-trash group">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="sl-p-name">{p.title}</span>
                                                    <span className={`sl-p-status ${p.isProduction ? 'prod' : 'ready'}`}>
                                                        {p.isProduction ? 'PRODUCTION' : 'PRÊT'}
                                                    </span>
                                                </div>
                                                <span className="sl-p-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    className="px-2 py-1 rounded-lg text-[9px] font-black border bg-sky-50 text-sky-700 border-sky-200"
                                                    onClick={(e) => handleRestoreProject(e, p)}
                                                    title="Restaurer le projet"
                                                >
                                                    Restaurer
                                                </button>
                                                <button
                                                    className="px-2 py-1 rounded-lg text-[9px] font-black border bg-red-50 text-red-700 border-red-200"
                                                    onClick={(e) => handlePermanentDelete(e, p._id)}
                                                    title="Supprimer définitivement"
                                                >
                                                    Purger
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {!showTrash && activeProjects.length === 0 && !loading && (
                                <div className="text-center text-slate-300 font-bold italic p-10">Aucun projet sauvegardé.</div>
                            )}
                            {showTrash && trashedProjects.length === 0 && !loading && (
                                <div className="text-center text-slate-300 font-bold italic p-10">Corbeille vide.</div>
                            )}
                        </>
                    )}

                    {mode === 'SAVE' && (
                        <div className="sl-save-box">
                            <label className="text-xs font-black text-slate-400 uppercase ml-1">Nom du projet</label>
                            <input 
                                className="sl-input" 
                                value={saveName} 
                                onChange={e => setSaveName(e.target.value)} 
                                placeholder="Mon Super Jeu..." 
                                autoFocus
                            />
                            <button className="sl-confirm-btn" onClick={handleSaveClick}>
                                Confirmer la sauvegarde
                            </button>
                            
                            <div className="mt-6">
                                <span className="text-[10px] font-black text-slate-300 uppercase mb-3 block tracking-widest">Écraser une version existante :</span>
                                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {projects.filter(p => !p.isTrashed).map(p => (
                                        <div key={p._id} className="sl-project-item !py-2 !border-dashed opacity-60 hover:opacity-100" onClick={() => setSaveName(p.title)}>
                                            <div className="flex items-center gap-2">
                                                <span className="sl-p-name text-xs">{p.title}</span>
                                                <span className={`sl-p-status ${p.isProduction ? 'prod' : 'ready'}`}>
                                                    {p.isProduction ? 'PRODUCTION' : 'PRÊT'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
