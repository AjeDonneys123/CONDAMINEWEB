import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ 
    user, items = [], chapters = [], classFilter, 
    onArchive, onRename, onEditItem, onDeleteItem, onDeleteChapter, onCreateChapter, onNotify 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [sections, setSections] = useState([]);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";
    const smartSort = (a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: 'base' });

    useEffect(() => { 
        if (user?.subjectSections) setSections(user.subjectSections);
    }, [user]);

    const saveSections = async (newSections) => {
        const uid = user?.id || user?._id;
        try {
            const res = await fetch(`/api/teacher/${uid}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: newSections, className: classFilter })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                localStorage.setItem('player', JSON.stringify(data.user));
                setSections(data.user.subjectSections);
                if (onNotify) onNotify({ message: data.message, drivePath: data.drivePath });
            }
        } catch(e) { console.error("Erreur Synchro:", e); }
    };

    const activeChapters = chapters
        .filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter))
        .sort(smartSort);

    const archivedChapters = chapters
        .filter(c => c.isArchived && norm(c.classroom) === norm(classFilter))
        .sort(smartSort);

    // US #3 : On affiche toujours les sections en mode Gérer, sinon seulement si elles ont des chapitres
    const visibleSections = isDeleteMode ? sections : sections.filter(s => activeChapters.some(c => c.subject === s.name));

    const renderChapterCard = (chap, section) => {
        const isOpen = openChaps[chap._id];
        const isEditing = editingId === chap._id;
        const color = section?.color || "#94a3b8";
        const letter = (section?.name || "?").substring(0, 1).toUpperCase();
        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));

        return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all mb-3" style={{ borderColor: isOpen ? color : '#f8fafc' }}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm relative" style={{ backgroundColor: color }}>{letter}</div>
                        <div className="flex flex-col">
                            {isEditing ? (
                                <input autoFocus className="text-sm font-black border-b-2 outline-none" style={{ borderColor: color }} value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => { onRename(chap._id, tempTitle, section.name); setEditingId(null); }} onKeyDown={e => e.key === 'Enter' && (onRename(chap._id, tempTitle, section.name), setEditingId(null))} onClick={e => e.stopPropagation()} />
                            ) : (
                                <span className="text-sm font-black text-slate-700">{chap.title || "Sans titre"}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(chap._id); setTempTitle(chap.title); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 rounded-full hover:text-indigo-500">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); onArchive(chap._id, !chap.isArchived); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 rounded-full hover:bg-slate-800 hover:text-white">📦</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-300 rounded-full font-black">✕</button>
                    </div>
                </div>
                {isOpen && (
                    <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                        {chapItems.map(it => (
                            <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200">
                                <b className="text-slate-700 text-xs">{it.actType === 'game' ? '🕹️' : '📄'} {it.title}</b>
                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-6 h-6 flex items-center justify-center bg-red-50 text-red-400 rounded-full font-black text-[10px]">✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-20">
            <div className="p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center mb-8 px-2">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest">📂 Configuration des Matières</h3>
                    <div className="flex gap-2">
                        <button onClick={() => { const n = prompt("Nom de la matière ?"); if(n) saveSections([...sections, {name:n, color:'#3b82f6'}]); }} className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase hover:bg-indigo-500 shadow-lg">+ Nouvelle</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`px-5 py-2 rounded-2xl font-black text-[9px] uppercase transition-colors ${isDeleteMode ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{isDeleteMode ? 'Terminer' : 'Gérer'}</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sections.map(s => {
                        const archs = archivedChapters.filter(c => c.subject === s.name);
                        if (!isDeleteMode && archs.length === 0) return null;
                        return (
                            <div key={s.name} className="bg-slate-800/40 p-4 rounded-[30px] border border-slate-700 animate-in fade-in relative">
                                <h4 className="font-black text-[9px] uppercase tracking-widest mb-4 flex justify-between items-center" style={{ color: s.color }}>
                                    {s.name}
                                    {isDeleteMode && <button onClick={() => saveSections(sections.filter(x => x.name !== s.name))} className="text-red-500 font-black">✕</button>}
                                </h4>
                                <div className="space-y-2">
                                    {archs.map(c => (
                                        <div key={c._id} className="bg-slate-800/80 p-2 px-3 rounded-xl flex justify-between items-center border border-slate-700/50">
                                            <span className="text-white font-bold text-[9px] truncate pr-2">{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} className="text-blue-400 font-bold p-1">⬆️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-16">
                {visibleSections.map(s => (
                    <div key={'active-' + s.name} className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-4 px-6 border-b border-slate-100 pb-4">
                            <h3 className="font-black text-base uppercase tracking-widest" style={{ color: s.color }}>{s.name}</h3>
                            <button onClick={() => { const n = prompt(`Nom du dossier dans ${s.name} ?`); if(n) onCreateChapter(s.name, n); }} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed hover:bg-white transition-colors" style={{ color: s.color, borderColor: s.color }}>+ CRÉER</button>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {activeChapters.filter(c => c.subject === s.name).map(chap => renderChapterCard(chap, s))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}