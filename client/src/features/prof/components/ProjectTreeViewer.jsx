import React, { useState, useEffect } from 'react';
import './ProjectTreeViewer.css';

/**
 * Composant de ligne de l'arbre V1
 * Affiche le nom sur la ligne 1 et la description métier sur la ligne 2
 */
const TreeNode = ({ node, depth = 0 }) => {
    const [isOpen, setIsOpen] = useState(depth < 2);
    const isFolder = node.type === 'folder';
    
    return (
        <div className="tree-node">
            <div className={`tree-item ${isFolder ? 'is-folder' : 'is-file'}`} onClick={() => isFolder && setIsOpen(!isOpen)}>
                <div className="tree-main-info">
                    <span className="toggle-icon">{isFolder ? (isOpen ? '▼' : '▶') : '•'}</span>
                    <span className="node-icon">{isFolder ? '📁' : '📄'}</span>
                    <span className="node-name">{node.name}</span>
                    {!isFolder && <span className="size-badge">{node.size ? `${(node.size/1024).toFixed(1)} kb` : ''}</span>}
                    {node.isDirty && <span className="dirty-dot pulse">●</span>}
                </div>
                {/* LIGNE 2 : DESCRIPTION FONCTIONNELLE */}
                <div className="tree-desc-row">{node.desc}</div>
            </div>
            {isFolder && isOpen && node.children && (
                <div className="tree-children">
                    {node.children.map((child, i) => <TreeNode key={i} node={child} depth={depth + 1} />)}
                </div>
            )}
        </div>
    );
};

export default function ProjectTreeViewer({ onClose }) {
    const [tree, setTree] = useState(null);
    const [loading, setLoading] = useState(true);
    const [hasDirty, setHasDirty] = useState(false);

    const loadData = async (forceIA = false, initFromTxt = false) => {
        setLoading(true);
        if (initFromTxt) await fetch('/api/admin/init-tree', { method: 'POST' });
        
        const url = `/api/admin/project-tree${forceIA ? '?refresh=true' : ''}`;
        const res = await fetch(url);
        const data = await res.json();
        setTree(data);

        const checkDirty = (n) => n.isDirty || (n.children && n.children.some(checkDirty));
        setHasDirty(checkDirty(data));
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    return (
        <div className="tree-overlay animate-in" onClick={onClose}>
            <div className="tree-window" onClick={e => e.stopPropagation()}>
                <div className="tree-header">
                    <div className="text-left">
                        <h2 className="text-xl font-black text-indigo-400">ARCHITECT GRAPH V1</h2>
                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-widest">Documentation structurelle Version 0</span>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => loadData(false, true)} className="btn-tree secondary">RECHARGER TXT 🚀</button>
                        {hasDirty && <button onClick={() => loadData(true, false)} className="btn-tree primary pulse">MAJ DOC IA 🤖</button>}
                        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-800 text-slate-400 rounded-full">✕</button>
                    </div>
                </div>
                <div className="tree-body custom-scrollbar">
                    {loading ? <div className="p-20 text-center animate-pulse text-indigo-400 font-black">SCAN DU CODE...</div> : <TreeNode node={tree} />}
                </div>
            </div>
        </div>
    );
}