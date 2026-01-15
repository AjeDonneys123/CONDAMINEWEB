import React, { useState, useEffect } from 'react';

const COLOR_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#facc15'];

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
    const [isSyncing, setIsSyncing] = useState(false);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";
    const smartSort = (a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: 'base' });

    useEffect(() => { if (user?.subjectSections) setSections(user.subjectSections); }, [user]);

    const handleNuke = async () => {
        if (!confirm("🚨 ATTENTION : Ceci va EFFACER TOUS les chapitres et devoirs de cette classe sur l'app ET sur le Drive !")) return;
        if (!confirm("Voulez-vous vraiment repartir de zéro pour cette classe ?")) return;
        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync-drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classroom: classFilter, teacherId: user.id || user._id, mode: 'nuke' })
            });
            const data = await res.json();
            onNotify(data);
            onRefresh();
        } catch (e) { console.error(e); }
        setIsSyncing(false);
    };

    const handleForceSync = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync-drive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classroom: classFilter, teacherId: user.id || user._id })
            });
            const data = await res.json();
            onNotify(data);
            onRefresh();
        } catch (e) { console.error(e); }
        setIsSyncing(false);
    };

    const saveSections = async (newSections, deletedName = null) => {
        const uid = user?.id || user?._id;
        setSections(newSections); 
        try {
            await fetch(`/api/teacher/${uid}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: newSections, className: classFilter, deletedSection: deletedName })
            });
            onRefresh();
        } catch(e) { console.error(e); }
    };

    const activeChapters = chapters.filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter)).sort(smartSort);
    const archivedChapters = chapters.filter(c => c.isArchived && norm(c.classroom) === norm(classFilter));
    const orphanActive = activeChapters.filter(c => !sections.some(s => s.name === c.subject));

    const renderChapterCard = (chap, section) => {
        const isOpen = openChaps[chap._id];
        const color = section?.color || "#94a3b8";
        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
        return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm mb-3 relative overflow-visible transition-all" style={{ borderColor: isOpen ? color : '#f1f5f9', zIndex: movingId === chap._id ? 100 : 1 }}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm" style={{ backgroundColor: color }}>{section?.name?.substring(0,1)}</div>
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-black text-slate-700">{chap.title}</span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                        </div>
                    </div>
                    <div className="flex gap-1 items-center">
                        <button onClick={(e) => { e.stopPropagation(); setMovingId(movingId === chap._id ? null : chap._id); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full">📁</button>
                        {movingId === chap._id && (
                            <div className="absolute right-0 top-10 z-[200] bg-white border-2 shadow-2xl rounded-2xl p-2 min-w-[150px] animate-in zoom-in">
                                {sections.map(s => (
                                    <button key={s.name} onClick={async () => { 
                                        await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:chap._id, subject:s.name, classroom:classFilter, teacherId: user.id || user._id}) });
                                        setMovingId(null); onRefresh();
                                    }} className="w-full text-left p-2 hover:bg-slate-50 rounded-lg text-[10px] font-bold flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }}></span> {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); onArchive(chap._id, !chap.isArchived); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 rounded-full">📦</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-300 rounded-full">✕</button>
                    </div>
                </div>
                {isOpen && (
                    <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                        {chapItems.map(it => (
                            <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm cursor-pointer border border-transparent" onClick={() => onEditItem(it)}>
                                <b className="text-slate-700 text-xs">{it.title}</b>
                                <button onClick={(e) => { e.stopPropagation(); onDeleteItem(it._id, it.actType); }} className="text-red-400 font-black text-[10px]">✕</button>
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
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest">Configuration & Miroir</h3>
                    <div className="flex gap-2">
                        <button onClick={handleForceSync} disabled={isSyncing} className="bg-white text-indigo-600 px-4 py-2 rounded-2xl font-black text-[9px] uppercase shadow-lg">🔄 Synchro</button>
                        <button onClick={handleNuke} disabled={isSyncing} className="bg-red-600 text-white px-4 py-2 rounded-2xl font-black text-[9px] uppercase shadow-lg">🧨 Nuke</button>
                        <button onClick={() => { const n = prompt("Nom ?"); if(n) saveSections([...sections, {name:n, color:COLOR_PALETTE[sections.length%9]}]); }} className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-black text-[9px] uppercase shadow-lg">+ Matière</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`px-4 py-2 rounded-2xl font-black text-[9px] uppercase transition-colors ${isDeleteMode ? 'bg-amber-500' : 'bg-slate-700'}`}>{isDeleteMode ? 'OK' : 'Gérer'}</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {sections.map((s, idx) => {
                        const archs = archivedChapters.filter(c => c.subject === s.name);
                        return (
                            <div key={s.name} className="bg-slate-800/40 p-5 rounded-[30px] border border-slate-700 relative" style={{ borderColor: s.color + '44' }}>
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-black text-[9px] uppercase tracking-widest flex items-center gap-2" style={{ color: s.color }}>{s.name}</h4>
                                    {isDeleteMode && <button onClick={() => saveSections(sections.filter(x => x.name !== s.name), s.name)} className="text-red-500 font-black text-[12px]">✕</button>}
                                </div>
                                <div className="space-y-2">
                                    {archs.map(c => (
                                        <div key={c._id} className="bg-slate-800/80 p-2 px-3 rounded-xl flex justify-between items-center border border-slate-700/50">
                                            <span className="text-white font-bold text-[9px] truncate pr-2">{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} className="text-emerald-400 font-bold p-1">⬆️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-16">
                {sections.map(s => {
                    const chaps = activeChapters.filter(c => c.subject === s.name);
                    return (
                        <div key={'active-' + s.name} className="animate-in fade-in">
                            <div className="flex items-center justify-between mb-4 px-6 border-b border-slate-100 pb-4">
                                <h3 className="font-black text-base uppercase tracking-widest text-left" style={{ color: s.color }}>{s.name}</h3>
                                <button onClick={() => { const n = prompt(`Dossier ?`); if(n) onCreateChapter(s.name, n); }} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed" style={{ color: s.color, borderColor: s.color }}>+ Créer</button>
                            </div>
                            <div className="grid grid-cols-1 gap-1">{chaps.map(chap => renderChapterCard(chap, s))}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}