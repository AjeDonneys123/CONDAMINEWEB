import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ 
    user, items, chapters, classFilter, 
    onArchive, onRename, onEditItem, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [pickingSectionFor, setPickingSectionFor] = useState(null);
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    
    // Initialisation des super-dossiers
    const [sections, setSections] = useState(user?.subjectSections || []);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";

    useEffect(() => { 
        if (user?.subjectSections) setSections(user.subjectSections); 
    }, [user]);

    const saveSections = async (newSections) => {
        const uid = user?.id || user?._id;
        if (!uid) return;

        setSections(newSections);

        try {
            const res = await fetch("/api/teacher/" + uid + "/sections", {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: newSections })
            });

            if (res.ok) {
                // Synchronisation immédiate du stockage local pour persistance au refresh
                const updatedUser = { ...user, subjectSections: newSections };
                localStorage.setItem('player', JSON.stringify(updatedUser));
                console.log("✅ Super-dossiers synchronisés.");
            }
        } catch(e) { 
            console.error("Erreur sauvegarde sections:", e); 
        }
    };

    const addSection = () => {
        const name = prompt("Nom du nouveau super-dossier (ex: Français, Géométrie...)");
        if (!name) return;
        const colors = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899"];
        const color = colors[sections.length % colors.length];
        saveSections([...sections, { name, color }]);
    };

    const removeSection = (name) => {
        if(!confirm("Supprimer le super-dossier '" + name + "' ?\nLes dossiers contenus ne seront pas supprimés mais n'auront plus de catégorie.")) return;
        saveSections(sections.filter(s => s.name !== name));
        setIsDeleteMode(false);
    };

    const handleRenameSubmit = (id) => {
        if (tempTitle.trim()) {
            onRename(id, tempTitle);
        }
        setEditingId(null);
    };

    const changeChapterSection = async (chapId, sectionName) => {
        try {
            await fetch('/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: chapId, subject: sectionName })
            });
            setPickingSectionFor(null);
            // Rafraîchissement pour refléter le changement de classement
            window.location.reload(); 
        } catch(e) { console.error(e); }
    };

    const activeChapters = (chapters || []).filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter));
    const archivedChapters = (chapters || []).filter(c => c.isArchived && norm(c.classroom) === norm(classFilter));

    const renderChapterCard = (chap, section, isOpen, chapItems) => {
        const isEditing = editingId === chap._id;
        const color = section?.color || "#cbd5e1";
        const letter = section?.name?.substring(0, 1).toUpperCase() || "?";

        return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all" style={{ borderColor: isOpen ? color : '#f8fafc' }}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div 
                            className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm hover:scale-110 transition-transform relative"
                            style={{ backgroundColor: color }}
                            onClick={(e) => { e.stopPropagation(); setPickingSectionFor(chap._id); }}
                            title="Changer de super-dossier"
                        >
                            {pickingSectionFor === chap._id ? "..." : letter}
                            {pickingSectionFor === chap._id && (
                                <div className="absolute top-full left-0 mt-2 bg-white shadow-2xl rounded-2xl p-2 z-[110] border flex flex-col gap-1 min-w-[150px]">
                                    {sections.map(s => (
                                        <button key={s.name} onClick={(e) => { e.stopPropagation(); changeChapterSection(chap._id, s.name); }} className="p-2 text-[10px] font-black uppercase rounded-lg hover:bg-slate-50 text-left" style={{ color: s.color }}>
                                            {s.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            {isEditing ? (
                                <input 
                                    autoFocus 
                                    className="text-xl font-black outline-none border-b-2" 
                                    style={{ borderColor: color }} 
                                    value={tempTitle} 
                                    onChange={e => setTempTitle(e.target.value)} 
                                    onKeyDown={e => e.key === 'Enter' && handleRenameSubmit(chap._id)}
                                    onBlur={() => handleRenameSubmit(chap._id)} 
                                    onClick={e=>e.stopPropagation()} 
                                />
                            ) : (
                                <span className="text-xl font-black text-slate-800">{chap.title || "Sans titre"}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{(chapItems || []).length} ÉLÉMENTS</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(chap._id); setTempTitle(chap.title); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); onArchive(chap._id, !chap.isArchived); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full text-slate-400 hover:bg-slate-800 hover:text-white">📦</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full text-red-200 hover:bg-red-50 hover:text-red-500">🗑️</button>
                    </div>
                </div>
                {isOpen && (
                    <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                        {(chapItems || []).map(it => (
                            <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200">
                                <b className="text-slate-700 text-sm">{it.actType === 'game' ? '🕹️' : '📄'} {it.title}</b>
                                <div className="flex gap-2">
                                    <button onClick={() => onEditItem(it)} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[9px] uppercase">Modifier</button>
                                    <button onClick={() => onDeleteItem(it._id, it.actType)} className="text-red-300 font-bold p-1 hover:text-red-500">✕</button>
                                </div>
                            </div>
                        ))}
                        {chapItems.length === 0 && <p className="text-center py-4 text-[10px] font-bold text-slate-300 uppercase">Dossier vide</p>}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-20">
            {/* ZONE ARCHIVES ET GESTION DES SUPER-DOSSIERS */}
            <div className="p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-8 px-2">
                    <h3 className="text-white font-black text-xs uppercase tracking-widest px-2">📂 Configuration Super-Dossiers</h3>
                    <div className="flex gap-2 relative">
                        <button onClick={addSection} className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform">+ Nouveau Super-Dossier</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`px-5 py-2 rounded-2xl font-black text-[10px] uppercase transition-all ${isDeleteMode ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                            {isDeleteMode ? 'Terminer' : 'Gérer'}
                        </button>
                        {isDeleteMode && (
                            <div className="absolute top-full right-0 mt-2 bg-white shadow-2xl rounded-2xl p-3 z-[120] border min-w-[200px] animate-in zoom-in">
                                <p className="text-[9px] font-black text-slate-400 uppercase mb-2 px-2">Cliquer pour supprimer</p>
                                {sections.map(s => (
                                    <button key={s.name} onClick={() => removeSection(s.name)} className="p-3 text-[10px] font-black text-slate-700 hover:bg-red-50 text-left w-full uppercase flex justify-between items-center">
                                        <span>{s.name}</span>
                                        <span className="text-red-500">🗑️</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {sections.map(s => {
                        const chaps = archivedChapters.filter(c => c.subject === s.name);
                        return (
                            <div key={s.name} className="bg-slate-800/40 p-5 rounded-[35px] border border-slate-700">
                                <h4 className="font-black text-[10px] uppercase tracking-widest mb-4" style={{ color: s.color }}>{s.name} (Archives)</h4>
                                <div className="space-y-2">
                                    {chaps.map(c => (
                                        <div key={c._id} className="bg-slate-800/80 p-2 px-3 rounded-xl flex justify-between items-center group border border-slate-700/50">
                                            <span className="text-white font-bold text-[11px] truncate pr-2">{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} title="Désarchiver" className="text-blue-400 font-bold p-1 hover:scale-125 transition-transform">⬆️</button>
                                        </div>
                                    ))}
                                    {chaps.length === 0 && <p className="text-[9px] font-bold text-slate-600 italic uppercase">Aucune archive</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ZONE DOSSIERS ACTIFS CLASSÉS PAR SUPER-DOSSIERS */}
            <div className="space-y-16">
                {sections.map(s => (
                    <div key={'active-' + s.name} className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-6 px-6 border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-3 h-8 rounded-full" style={{ backgroundColor: s.color }}></div>
                                <h3 className="font-black text-lg uppercase tracking-widest" style={{ color: s.color }}>{s.name}</h3>
                            </div>
                            <button onClick={() => onCreateChapter(s.name)} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed hover:bg-slate-50 transition-colors" style={{ color: s.color, borderColor: s.color }}>
                                + CRÉER UN DOSSIER {s.name.toUpperCase()}
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {activeChapters.filter(c => c.subject === s.name)
                                .map(chap => renderChapterCard(
                                    chap, 
                                    s, 
                                    openChaps[chap._id], 
                                    (items || []).filter(it => String(it.chapterId) === String(chap._id))
                                ))}
                            {activeChapters.filter(c => c.subject === s.name).length === 0 && (
                                <p className="text-center py-6 text-slate-300 font-bold text-xs uppercase italic">Aucun dossier actif dans cette catégorie</p>
                            )}
                        </div>
                    </div>
                ))}
                
                {/* Dossiers sans catégorie (au cas où) */}
                {activeChapters.filter(c => !sections.some(s => s.name === c.subject)).length > 0 && (
                    <div className="bg-slate-50 p-6 rounded-[40px] border-2 border-dashed border-slate-200 opacity-60">
                        <h3 className="font-black text-xs text-slate-400 uppercase mb-4 px-4">Dossiers non classés</h3>
                        <div className="space-y-2">
                             {activeChapters.filter(c => !sections.some(s => s.name === c.subject)).map(chap => (
                                 renderChapterCard(chap, null, openChaps[chap._id], (items || []).filter(it => String(it.chapterId) === String(chap._id)))
                             ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}