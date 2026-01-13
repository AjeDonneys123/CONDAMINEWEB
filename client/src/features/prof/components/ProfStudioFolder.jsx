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
    
    // Persistence Mobile (User Story #1)
    const [sections, setSections] = useState([]);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";

    useEffect(() => { 
        if (user?.subjectSections && user.subjectSections.length > 0) {
            setSections(user.subjectSections);
        } else {
            setSections([
                { name: 'Histoire', color: '#ef4444' },
                { name: 'Géographie', color: '#3b82f6' },
                { name: 'EMC', color: '#22c55e' }
            ]);
        }
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
                const updatedUser = { ...user, subjectSections: newSections };
                localStorage.setItem('player', JSON.stringify(updatedUser));
            }
        } catch(e) { console.error(e); }
    };

    const addSection = () => {
        const name = prompt("Nom du super-dossier (ex: Français, Géo...)");
        if (!name) return;
        const colors = ["#ef4444", "#3b82f6", "#22c55e", "#a855f7", "#f59e0b", "#ec4899"];
        const color = colors[sections.length % colors.length];
        saveSections([...sections, { name, color }]);
    };

    const removeSection = (name) => {
        if(!confirm("Supprimer ce super-dossier ?")) return;
        saveSections(sections.filter(s => s.name !== name));
        setIsDeleteMode(false);
    };

    const changeChapterSection = async (chapId, sectionName) => {
        await fetch('/api/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ _id: chapId, subject: sectionName })
        });
        setPickingSectionFor(null);
        window.location.reload(); 
    };

    const activeChapters = (chapters || []).filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter));
    const archivedChapters = (chapters || []).filter(c => c.isArchived && norm(c.classroom) === norm(classFilter));
    const orphanChapters = activeChapters.filter(c => !sections.some(s => s.name === c.subject));

    const renderChapterCard = (chap, section, isOpen, chapItems) => {
        const color = section?.color || "#94a3b8";
        const letter = section?.name?.substring(0, 1).toUpperCase() || "?";
        return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all mb-3" style={{ borderColor: isOpen ? color : '#f8fafc' }}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm relative" style={{ backgroundColor: color }} onClick={(e) => { e.stopPropagation(); setPickingSectionFor(chap._id); }}>
                            {pickingSectionFor === chap._id ? "..." : letter}
                            {pickingSectionFor === chap._id && (
                                <div className="absolute top-full left-0 mt-2 bg-white shadow-2xl rounded-2xl p-2 z-[110] border min-w-[150px]">
                                    {sections.map(s => <button key={s.name} onClick={(e) => { e.stopPropagation(); changeChapterSection(chap._id, s.name); }} className="p-2 text-[10px] font-black uppercase rounded-lg hover:bg-slate-50 text-left w-full" style={{ color: s.color }}>{s.name}</button>)}
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col">
                            {editingId === chap._id ? (
                                <input autoFocus className="text-xl font-black outline-none border-b-2" style={{ borderColor: color }} value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => { onRename(chap._id, tempTitle); setEditingId(null); }} onClick={e=>e.stopPropagation()} />
                            ) : (
                                <span className="text-lg font-black text-slate-700">{chap.title || "Sans titre"}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(chap._id); setTempTitle(chap.title); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); onArchive(chap._id, !chap.isArchived); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full hover:bg-slate-800 hover:text-white">📦</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-full font-black border border-red-100">✕</button>
                    </div>
                </div>
                {isOpen && (
                    <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                        {chapItems.map(it => (
                            <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200">
                                <b className="text-slate-700 text-sm">{it.actType === 'game' ? '🕹️' : '📄'} {it.title}</b>
                                <div className="flex gap-2">
                                    <button onClick={() => onEditItem(it)} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[9px] uppercase">Modifier</button>
                                    <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-600 rounded-lg font-black text-xs border border-red-100">✕</button>
                                </div>
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
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest">📂 Super-Dossiers</h3>
                    <div className="flex gap-2">
                        <button onClick={addSection} className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase shadow-lg">+ Nouveau</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`px-5 py-2 rounded-2xl font-black text-[9px] uppercase ${isDeleteMode ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>Gérer</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {sections.map(s => (
                        <div key={s.name} className="bg-slate-800/40 p-5 rounded-[35px] border border-slate-700">
                            <h4 className="font-black text-[10px] uppercase tracking-widest mb-4 flex justify-between" style={{ color: s.color }}>
                                {s.name} {isDeleteMode && <span onClick={() => removeSection(s.name)} className="cursor-pointer bg-red-500 text-white w-4 h-4 flex items-center justify-center rounded-full text-[8px]">✕</span>}
                            </h4>
                            <div className="space-y-2">
                                {archivedChapters.filter(c => c.subject === s.name).map(c => (
                                    <div key={c._id} className="bg-slate-800/80 p-2 px-3 rounded-xl flex justify-between items-center border border-slate-700/50">
                                        <span className="text-white font-bold text-[11px] truncate pr-2">{c.title}</span>
                                        <button onClick={() => onArchive(c._id, false)} className="text-blue-400 font-bold p-1">⬆️</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-16">
                {sections.map(s => (
                    <div key={'active-' + s.name} className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-4 px-6 border-b border-slate-100 pb-4">
                            <h3 className="font-black text-lg uppercase tracking-widest" style={{ color: s.color }}>{s.name}</h3>
                            <button onClick={() => onCreateChapter(s.name)} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed" style={{ color: s.color, borderColor: s.color }}>+ CRÉER UN DOSSIER {s.name.toUpperCase()}</button>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {activeChapters.filter(c => c.subject === s.name).map(chap => renderChapterCard(chap, s, openChaps[chap._id], (items || []).filter(it => String(it.chapterId) === String(chap._id))))}
                        </div>
                    </div>
                ))}
                {orphanChapters.length > 0 && (
                    <div className="animate-in fade-in pt-10 border-t-4 border-dashed border-slate-100">
                        <h3 className="font-black text-slate-300 text-xs uppercase tracking-widest px-6 mb-4">Dossiers à classer</h3>
                        {orphanChapters.map(chap => renderChapterCard(chap, null, openChaps[chap._id], (items || []).filter(it => String(it.chapterId) === String(chap._id))))}
                    </div>
                )}
            </div>
        </div>
    );
}