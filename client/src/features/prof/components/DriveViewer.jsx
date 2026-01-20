import React, { useState, useEffect } from 'react';
import './DriveViewer.css';

const DriveNode = ({ node, depth = 0, onDelete }) => {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const isFolder = node.type === 'folder';
    const isRoot = node.name === 'CONDA PROJECT';
    const isBranch = ['ENSEIGNANTS', 'ADMINISTRATION', 'CLASSES'].includes(node.name);

    return (
        <div className="drive-node" style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
            <div className={`drive-item ${isFolder ? 'is-folder' : 'is-file'} ${isBranch ? 'branch-style' : ''}`}>
                <div className="flex-1 flex flex-col cursor-pointer" onClick={() => isFolder && setIsOpen(!isOpen)}>
                    <div className="flex items-center gap-3">
                        <span className="drive-icon">{isFolder ? (isOpen ? '📂' : '📁') : '📄'}</span>
                        <span className="drive-name">{node.name}</span>
                    </div>
                </div>
                <div className="drive-actions">
                    {!isFolder && node.link && <a href={node.link} target="_blank" className="drive-action-btn view">👁️</a>}
                    {!isRoot && !isBranch && (
                        <button className="drive-action-btn delete" onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name); }}>✕</button>
                    )}
                </div>
            </div>
            {isFolder && isOpen && node.children && (
                <div className="drive-children">
                    {node.children.length > 0 ? (
                        node.children.map((child, i) => <DriveNode key={i} node={child} depth={depth + 1} onDelete={onDelete} />)
                    ) : (
                        <div className="drive-empty">Dossier vide</div>
                    )}
                </div>
            )}
        </div>
    );
};

export default function DriveViewer({ onClose }) {
    const [tree, setTree] = useState(null);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);

    const loadTree = async () => {
        setLoading(true);
        const res = await fetch('/api/structure/drive-tree');
        setTree(await res.json());
        setLoading(false);
    };

    const handleSync = async () => {
        if(!confirm("Lancer l'alignement ? Cela créera les dossiers et les élèves de test manquants.")) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/structure/sync-root', { method: 'POST' });
            if (res.ok) {
                alert("ALIGNEMENT V58 RÉUSSI : Tous les élèves test sont provisionnés !");
                await loadTree();
            }
        } catch (e) { alert("Erreur synchro"); }
        setSyncing(false);
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Supprimer ${name} ?`)) return;
        await fetch(`/api/structure/drive/${id}`, { method: 'DELETE' });
        loadTree();
    };

    useEffect(() => { loadTree(); }, []);

    return (
        <div className="drive-viewer-overlay" onClick={onClose}>
            <div className="drive-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="drive-viewer-header">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Mouchard V58</h2>
                        <p className="text-[9px] font-black text-emerald-400 tracking-widest uppercase">CONDA PROJECT : Provisionnement Auto</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleSync} disabled={syncing} className="v14-sync-btn">
                            {syncing ? 'RÉPARATION...' : '🔄 ALIGNER & RÉPARER TESTERS'}
                        </button>
                        <button onClick={onClose} className="v14-close-btn">✕</button>
                    </div>
                </div>
                <div className="drive-viewer-body custom-scrollbar">
                    {loading ? <div className="v14-loader"><div className="spinner"></div><span>SCAN DU DRIVE...</span></div> : tree && <DriveNode node={tree} onDelete={handleDelete} />}
                </div>
                <div className="p-4 bg-slate-50 text-[9px] text-slate-400 font-bold uppercase text-center border-t">
                    Note : Cliquez sur SYNCHRO pour créer les élèves test manquants des anciennes classes.
                </div>
            </div>
        </div>
    );
}