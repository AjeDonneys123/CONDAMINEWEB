// @signatures: SaveLoadModal, handleDeleteProject, handleSaveClick
import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import './SaveLoadModal.css';

/**
 * 📂 MODALE DE GESTION DE PROJETS V500
 * - Chargement avec bouton suppression (X) sauf sur le premier fichier.
 * - Sauvegarde avec écrasement ou création.
 */
export default function SaveLoadModal({ mode, user, currentProject, onClose, onLoad, onSave, onNew }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saveName, setSaveName] = useState(currentProject?.title || "Nouveau Projet");

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

    const handleSaveClick = () => {
        if (!saveName.trim()) return alert("Nom requis !");
        onSave({ ...currentProject, title: saveName });
    };

    const handleDeleteProject = async (e, id) => {
        e.stopPropagation(); // Évite de charger le projet en cliquant sur le X
        if (!confirm("⚠️ Supprimer définitivement ce projet ?")) return;
        
        try {
            const res = await fetch(`/api/studio/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadList(); // Rafraîchit la liste
            }
        } catch (e) {
            alert("Erreur lors de la suppression.");
        }
    };

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
                            <button className="sl-new-btn" onClick={onNew}>
                                <span>✨</span> Créer un nouveau projet vide
                            </button>
                            <div className="h-px bg-slate-100 mb-4"></div>
                            
                            {loading ? (
                                <div className="text-center text-slate-400 font-bold p-4 animate-pulse">Chargement...</div>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {projects.map((p, index) => (
                                        <div key={p._id} className="sl-project-item group" onClick={() => onLoad(p)}>
                                            <div className="flex flex-col">
                                                <span className="sl-p-name">{p.title}</span>
                                                <span className="sl-p-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
                                            </div>
                                            
                                            {/* ❌ BOUTON SUPPRIMER : Présent sur tous sauf le premier (index 0) */}
                                            {index !== 0 && (
                                                <button 
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-black text-xs border border-red-100 hover:bg-red-500 hover:text-white"
                                                    onClick={(e) => handleDeleteProject(e, p._id)}
                                                    title="Supprimer ce projet"
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {projects.length === 0 && !loading && (
                                <div className="text-center text-slate-300 font-bold italic p-10">Aucun projet sauvegardé.</div>
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
                                    {projects.map(p => (
                                        <div key={p._id} className="sl-project-item !py-2 !border-dashed opacity-60 hover:opacity-100" onClick={() => setSaveName(p.title)}>
                                            <span className="sl-p-name text-xs">{p.title}</span>
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
