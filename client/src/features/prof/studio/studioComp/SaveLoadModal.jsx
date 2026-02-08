// @signatures: SaveLoadModal
import React, { useState, useEffect } from 'react';
import { api } from '../../../../services/api';
import './SaveLoadModal.css';

export default function SaveLoadModal({ mode, user, currentProject, onClose, onLoad, onSave, onNew }) {
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saveName, setSaveName] = useState(currentProject?.title || "Nouveau Projet");

    useEffect(() => {
        if (mode === 'LOAD' || mode === 'LIST') {
            setLoading(true);
            api.get(`/studio/projects/${user.id || user._id}`)
                .then(data => setProjects(data || []))
                .catch(() => setProjects([]))
                .finally(() => setLoading(false));
        }
    }, [mode, user]);

    const handleSaveClick = () => {
        if (!saveName.trim()) return alert("Nom requis !");
        onSave({ ...currentProject, title: saveName });
    };

    return (
        <div className="sl-modal-overlay" onClick={onClose}>
            <div className="sl-window" onClick={e => e.stopPropagation()}>
                <div className="sl-header">
                    <span className="sl-title">{mode === 'SAVE' ? '💾 Sauvegarder' : '📂 Charger un projet'}</span>
                    <button className="sl-close" onClick={onClose}>✕</button>
                </div>
                
                <div className="sl-body custom-scrollbar">
                    {mode === 'LOAD' && (
                        <>
                            <button className="sl-new-btn" onClick={onNew}>
                                <span>✨</span> Créer un nouveau projet vide
                            </button>
                            <div className="h-px bg-slate-100 mb-4"></div>
                            {loading ? <div className="text-center text-slate-400 font-bold p-4">Chargement...</div> : (
                                projects.map(p => (
                                    <div key={p._id} className="sl-project-item" onClick={() => onLoad(p)}>
                                        <span className="sl-p-name">{p.title}</span>
                                        <span className="sl-p-date">{new Date(p.updatedAt).toLocaleDateString()}</span>
                                    </div>
                                ))
                            )}
                            {projects.length === 0 && !loading && <div className="text-center text-slate-300 font-bold italic">Aucun projet sauvegardé.</div>}
                        </>
                    )}

                    {mode === 'SAVE' && (
                        <div className="sl-save-box">
                            <label className="text-xs font-black text-slate-400 uppercase">Nom du projet</label>
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
                                <span className="text-xs font-black text-slate-400 uppercase mb-2 block">Écraser une version existante :</span>
                                <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
                                    {projects.map(p => (
                                        <div key={p._id} className="sl-project-item !py-2 !border-dashed" onClick={() => { setSaveName(p.title); }}>
                                            <span className="sl-p-name opacity-60">{p.title}</span>
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
