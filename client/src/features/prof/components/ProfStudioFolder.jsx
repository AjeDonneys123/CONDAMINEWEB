import React, { useState, useEffect } from 'react';

const COLOR_PALETTE = [
    '#ef4444', // Rouge
    '#3b82f6', // Bleu
    '#22c55e', // Vert
    '#f59e0b', // Ambre
    '#8b5cf6', // Violet
    '#ec4899', // Rose
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#1e293b'  // Ardoise
];

export default function ProfStudioFolder({ 
    user, items = [], chapters = [], classFilter, 
    onArchive, onRename, onEditItem, onDeleteItem, onDeleteChapter, onCreateChapter, onNotify, onRefresh 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [sections, setSections] = useState([]);
    const [movingId, setMovingId] = useState(null); 
    const [colorPickerIdx, setColorPickerIdx] = useState(null); 

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";
    const smartSort = (a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: 'base' });

    useEffect(() => { 
        if (user?.subjectSections) setSections(user.subjectSections);
    }, [user]);

    const saveSections = async (newSections) => {
        const uid = user?.id || user?._id;
        setSections(newSections); 
        try {
            const res = await fetch(`/api/teacher/${uid}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: newSections, className: classFilter })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                localStorage.setItem('player', JSON.stringify(data.user));
                if (onNotify) onNotify(data);
            }
        } catch(e) { console.error("Erreur Synchro Matières:", e); }
    };

    const updateSectionColor = (idx, newColor) => {
        const newSections = [...sections];
        newSections[idx].color = newColor;
        saveSections(newSections);
        setColorPickerIdx(null); // Fermeture immédiate après choix
    };

    const autoColorize = () => {
        const newSections = sections.map((s, i) => ({
            ...s,
            color: COLOR_PALETTE[i % COLOR_PALETTE.length]
        }));
        saveSections(newSections);
    };

    const handleAddSection = () => {
        const n = prompt("Nom de la nouvelle matière ?");
        if (!n) return;
        const newColor = COLOR_PALETTE[sections.length % COLOR_PALETTE.length];
        saveSections([...sections, { name: n, color: newColor }]);
    };

    const moveChapter = async (chapId, newSubject) => {
        try {
            const res = await fetch('/api/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ _id: chapId, subject: newSubject, classroom: classFilter })
            });
            if (res.ok) {
                setMovingId(null);
                if (onNotify) onNotify({ message: `Dossier reclassé en ${newSubject}` });
                if (onRefresh) onRefresh();
            }
        } catch (e) { console.error(e); }
    };

    const activeChapters = chapters
        .filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter))
        .sort(smartSort);

    const archivedChapters = chapters
        .filter(c => c.isArchived && norm(c.classroom) === norm(classFilter));

    const orphanActive = activeChapters.filter(c => !sections.some(s => s.name === c.subject));
    const orphanArchived = archivedChapters.filter(c => !sections.some(s => s.name === c.subject));

    const renderChapterCard = (chap, section) => {
        const isOpen = openChaps[chap._id];
        const isEditing = editingId === chap._id;
        const isMoving = movingId === chap._id;
        const color = section?.color || "#94a3b8";
        const letter = (section?.name || "?").substring(0, 1).toUpperCase();
        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));

        return (
            <div 
                key={chap._id} 
                className={`bg-white rounded-[35px] border-2 shadow-sm transition-all mb-3 animate-in fade-in ${isMoving || isEditing ? 'z-[100] relative' : 'z-0 relative'}`} 
                style={{ borderColor: isOpen ? color : '#f1f5f9', overflow: 'visible' }}
            >
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm relative" style={{ backgroundColor: color }}>{letter}</div>
                        <div className="flex flex-col text-left">
                            {isEditing ? (
                                <input autoFocus className="text-sm font-black border-b-2 outline-none" style={{ borderColor: color }} value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => { onRename(chap._id, tempTitle, chap.subject); setEditingId(null); }} onKeyDown={e => e.key === 'Enter' && (onRename(chap._id, tempTitle, chap.subject), setEditingId(null))} onClick={e => e.stopPropagation()} />
                            ) : (
                                <span className="text-sm font-black text-slate-700">{chap.title || "Sans titre"}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-1 items-center">
                        <div className="relative">
                            <button title="Changer de matière" onClick={(e) => { e.stopPropagation(); setMovingId(isMoving ? null : chap._id); }} className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${isMoving ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'bg-slate-50 text-slate-300 hover:text-indigo-500'}`}>📁</button>
                            {isMoving && (
                                <div className="absolute right-0 top-10 z-[200] bg-white border-2 border-indigo-100 shadow-2xl rounded-2xl p-2 min-w-[180px] animate-in zoom-in">
                                    <p className="text-[9px] font-black text-slate-400 uppercase p-2 border-b mb-1 tracking-widest">Reclasser vers :</p>
                                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {sections.map(s => (
                                            <button key={s.name} onClick={() => moveChapter(chap._id, s.name)} className="w-full text-left p-3 hover:bg-indigo-50 rounded-xl text-[10px] font-bold text-slate-600 flex items-center gap-3 transition-colors">
                                                <span className="w-3 h-3 rounded-full shadow-sm flex-shrink-0" style={{ background: s.color }}></span> 
                                                <span className="truncate">{s.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <button title="Renommer" onClick={(e) => { e.stopPropagation(); setEditingId(chap._id); setTempTitle(chap.title); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 rounded-full hover:text-indigo-500">✏️</button>
                        <button title="Archiver/Désarchiver" onClick={(e) => { e.stopPropagation(); onArchive(chap._id, !chap.isArchived); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 rounded-full hover:bg-slate-800 hover:text-white">📦</button>
                        <button title="Supprimer Définitivement" onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-300 rounded-full font-black hover:bg-red-500">✕</button>
                    </div>
                </div>
                {isOpen && (
                    <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2 rounded-b-[33px] overflow-hidden">
                        {chapItems.map(it => (
                            <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200 cursor-pointer" onClick={() => onEditItem(it)}>
                                <b className="text-slate-700 text-xs">{it.actType === 'game' ? '🕹️' : '📄'} {it.title}</b>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteItem(it._id, it.actType); }} className="w-6 h-6 flex items-center justify-center bg-red-50 text-red-400 rounded-full font-black text-[10px]">✕</button>
                            </div>
                        ))}
                        {chapItems.length === 0 && <p className="text-center py-4 text-[9px] font-bold text-slate-300 uppercase">Dossier Vide</p>}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-20">
            {/* CARRE NOIR : CONFIGURATION ET ARCHIVES */}
            <div className="p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center mb-8 px-2">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        Configuration & Archives
                    </h3>
                    <div className="flex gap-2">
                        {isDeleteMode && (
                            <button onClick={autoColorize} className="bg-emerald-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase hover:bg-emerald-500 shadow-lg">🎨 Couleurs Auto</button>
                        )}
                        <button onClick={handleAddSection} className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase hover:bg-indigo-500 shadow-lg">+ Nouvelle Matière</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`px-5 py-2 rounded-2xl font-black text-[9px] uppercase transition-colors ${isDeleteMode ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{isDeleteMode ? 'Quitter Edition' : 'Gérer Matières'}</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {sections.map((s, idx) => {
                        const archs = archivedChapters.filter(c => c.subject === s.name);
                        const isPickingColor = colorPickerIdx === idx;
                        if (!isDeleteMode && archs.length === 0) return null;

                        return (
                            <div key={s.name} className="bg-slate-800/40 p-5 rounded-[30px] border border-slate-700 animate-in fade-in relative group" style={{ borderColor: s.color + '44' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-2" style={{ color: s.color }}>
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }}></span>
                                        {s.name}
                                    </h4>
                                    {isDeleteMode && (
                                        <div className="flex gap-2 relative">
                                            {/* SÉLECTEUR DE COULEUR LARGEMENT AMÉLIORÉ */}
                                            <button onClick={() => setColorPickerIdx(isPickingColor ? null : idx)} className="text-white hover:scale-125 transition-transform text-[12px] opacity-60 hover:opacity-100">🎨</button>
                                            <button onClick={() => saveSections(sections.filter(x => x.name !== s.name))} className="text-red-500 font-black hover:scale-125 transition-transform text-[12px] opacity-60 hover:opacity-100">✕</button>
                                            
                                            {isPickingColor && (
                                                <div className="absolute top-8 right-0 z-[300] bg-slate-800 border-2 border-slate-600 p-3 rounded-2xl shadow-2xl animate-in zoom-in w-[160px]">
                                                    <p className="text-[8px] font-black text-slate-400 uppercase mb-2 text-center tracking-tighter">Choisir couleur</p>
                                                    <div className="grid grid-cols-3 gap-2">
                                                        {COLOR_PALETTE.map(c => (
                                                            <button 
                                                                key={c} 
                                                                onClick={() => updateSectionColor(idx, c)} 
                                                                className="w-8 h-8 rounded-full border-2 border-white/10 hover:scale-110 transition-all hover:border-white shadow-inner" 
                                                                style={{ background: c }} 
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {archs.map(c => (
                                        <div key={c._id} className="bg-slate-800/80 p-2 px-3 rounded-xl flex justify-between items-center border border-slate-700/50">
                                            <span className="text-white font-bold text-[9px] truncate pr-2" title={c.title}>{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} className="text-emerald-400 font-bold p-1 hover:scale-125 transition-transform" title="Désarchiver">⬆️</button>
                                        </div>
                                    ))}
                                    {!isDeleteMode && archs.length === 0 && <div className="text-[8px] text-slate-600 uppercase font-black py-2">Vide</div>}
                                </div>
                            </div>
                        );
                    })}

                    {orphanArchived.length > 0 && (
                        <div className="bg-red-900/20 p-4 rounded-[30px] border border-red-900/30 animate-in fade-in">
                            <h4 className="font-black text-[9px] uppercase tracking-widest mb-4 text-red-400">⚠️ Archives Sans Matière</h4>
                            <div className="space-y-2">
                                {orphanArchived.map(c => (
                                    <div key={c._id} className="bg-red-900/40 p-2 px-3 rounded-xl flex justify-between items-center border border-red-900/20">
                                        <span className="text-red-200 font-bold text-[9px] truncate pr-2">{c.title}</span>
                                        <div className="flex gap-1">
                                            <button onClick={() => setMovingId(c._id)} className="text-blue-400 text-[10px]" title="Assigner matière">📁</button>
                                            <button onClick={() => onArchive(c._id, false)} className="text-white text-[10px]" title="Désarchiver">⬆️</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-16">
                {sections.map(s => {
                    const chaps = activeChapters.filter(c => c.subject === s.name);
                    return (
                        <div key={'active-' + s.name} className="animate-in fade-in">
                            <div className="flex items-center justify-between mb-4 px-6 border-b border-slate-100 pb-4">
                                <h3 className="font-black text-base uppercase tracking-widest text-left" style={{ color: s.color }}>{s.name}</h3>
                                <button onClick={() => { const n = prompt(`Nom du dossier dans ${s.name} ?`); if(n) onCreateChapter(s.name, n); }} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed hover:bg-white transition-colors" style={{ color: s.color, borderColor: s.color }}>+ CRÉER DOSSIER</button>
                            </div>
                            <div className="grid grid-cols-1 gap-1">
                                {chaps.map(chap => renderChapterCard(chap, s))}
                                {chaps.length === 0 && <p className="text-left px-8 py-4 text-[10px] font-black text-slate-300 uppercase tracking-widest">Aucun dossier actif</p>}
                            </div>
                        </div>
                    );
                })}

                {orphanActive.length > 0 && (
                    <div className="animate-in fade-in pt-10">
                        <div className="flex items-center justify-between mb-4 px-6 border-b border-red-100 pb-4">
                            <h3 className="font-black text-base uppercase tracking-widest text-red-500 text-left">⚠️ DOSSIERS À RECLASSER</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {orphanActive.map(chap => renderChapterCard(chap, { name: 'A RECLASSER', color: '#ef4444' }))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}