import React, { useState, useEffect } from 'react';
import './DriveViewer.css';

const DriveNode = ({ node, depth = 0, onDelete }) => {
    const [isOpen, setIsOpen] = useState(depth < 1);
    const isFolder = node.type === 'folder';
    const isRoot = node.name === 'CONDA CLASSE';

    return (
        <div className="drive-node" style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
            <div className={`drive-item ${isFolder ? 'is-folder' : 'is-file'}`}>
                <div className="flex-1 flex items-center gap-3 cursor-pointer" onClick={() => isFolder && setIsOpen(!isOpen)}>
                    <span className="drive-icon">{isFolder ? (isOpen ? '📂' : '📁') : '📄'}</span>
                    <span className="drive-name">{node.name}</span>
                </div>
                
                <div className="drive-actions">
                    {!isFolder && node.link && (
                        <a href={node.link} target="_blank" className="drive-action-btn view" title="Ouvrir">👁️</a>
                    )}
                    
                    {/* Bouton de suppression nuclear - Sauf pour la racine */}
                    {!isRoot && (
                        <button 
                            className="drive-action-btn delete" 
                            onClick={(e) => { e.stopPropagation(); onDelete(node.id, node.name, isFolder); }}
                            title="Supprimer définitivement"
                        >
                            ✕
                        </button>
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
    const [isDeleting, setIsDeleting] = useState(false);

    const loadTree = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/structure/drive-tree');
            const data = await res.json();
            setTree(data);
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    const handleDelete = async (id, name, isFolder) => {
        const type = isFolder ? "LE DOSSIER" : "LE FICHIER";
        if (!window.confirm(`⚠️ ATTENTION ⚠️\n\nÊtes-vous sûr de vouloir supprimer définitivement ${type} :\n"${name}" ?\n\nCette action est irréversible sur Google Drive.`)) return;

        setIsDeleting(true);
        try {
            const res = await fetch(`/api/structure/drive/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadTree();
            } else {
                alert("Erreur lors de la suppression.");
            }
        } catch (e) { alert("Erreur réseau"); }
        setIsDeleting(false);
    };

    useEffect(() => { loadTree(); }, []);

    return (
        <div className="drive-viewer-overlay" onClick={onClose}>
            <div className="drive-viewer-window" onClick={e => e.stopPropagation()}>
                <div className="drive-viewer-header">
                    <div>
                        <h2 className="text-xl font-black text-white uppercase tracking-tighter">Mouchard Nucléaire Drive</h2>
                        <p className="text-[9px] font-black text-red-400 tracking-[0.2em]">CONTRÔLE TOTAL DU CLOUD</p>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={loadTree} className="v14-refresh-btn">ACTUALISER</button>
                        <button onClick={onClose} className="v14-close-btn">✕</button>
                    </div>
                </div>
                <div className="drive-viewer-body custom-scrollbar">
                    {(loading || isDeleting) ? (
                        <div className="v14-loader">
                            <div className="spinner"></div>
                            <span>{isDeleting ? 'SUPPRESSION EN COURS...' : 'SCAN DU CLOUD EN COURS...'}</span>
                        </div>
                    ) : (
                        tree && <DriveNode node={tree} onDelete={handleDelete} />
                    )}
                </div>
            </div>
        </div>
    );
}