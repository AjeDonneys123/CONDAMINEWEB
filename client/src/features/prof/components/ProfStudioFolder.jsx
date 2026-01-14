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
    const [sections, setSections] = useState([]);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";

    useEffect(() => { 
        if (user?.subjectSections) setSections(user.subjectSections); 
    }, [user]);

    const saveSections = async (newSections) => {
        const uid = user?.id || user?._id;
        if (!uid) return;
        setSections(newSections);
        try {
            const res = await fetch(`/api/teacher/${uid}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: newSections })
            });
            if (res.ok) {
                const updatedUser = { ...user, subjectSections: newSections };
                localStorage.setItem('player', JSON.stringify(updatedUser));
            }
        } catch(e) { console.error("Erreur sections:", e); }
    };

    const renderChapterCard = (chap, section, isOpen, chapItems) => {
        const color = section?.color || "#94a3b8";
        const letter = section?.name?.substring(0, 1).toUpperCase() || "?";
        return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all mb-3" style={{ borderColor: isOpen ? color : '#f8fafc' }}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm relative" style={{ backgroundColor: color }} onClick={(e) => { e.stopPropagation(); setPickingSectionFor(chap._id); }}>
                            {pickingSectionFor === chap._id ? "..." : letter}
                        </div>
                        <div className="flex flex-col">
                            {editingId === chap._id ? (
                                <input autoFocus className="text-lg font-black outline-none border-b-2" value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => { onRename(chap._id, tempTitle); setEditingId(null); }} />
                            ) : (
                                <span className="text-lg font-black text-slate-700">{chap.title}</span>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(chap._id); setTempTitle(chap.title); }} className="w-9 h-9 flex items-center justify-center bg-slate-50 rounded-full">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-600 rounded-full font-black">✕</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-12">
            <div className="p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center mb-8">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest">📂 Super-Dossiers</h3>
                    <div className="flex gap-2">
                        <button onClick={() => {const n=prompt("Nom?"); if(n) saveSections([...sections, {name:n, color:'#3b82f6'}]);}} className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase">+ Nouveau</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className="bg-slate-700 text-slate-300 px-5 py-2 rounded-2xl font-black text-[9px] uppercase">Gérer</button>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {sections.map(s => (
                        <div key={s.name} className="bg-slate-800/40 p-5 rounded-[35px] border border-slate-700">
                            <h4 className="font-black text-[10px] uppercase mb-4 flex justify-between" style={{ color: s.color }}>
                                {s.name} {isDeleteMode && <span onClick={() => {if(confirm("Supprimer?")) saveSections(sections.filter(x=>x.name!==s.name));}} className="cursor-pointer text-red-500">✕</span>}
                            </h4>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-16">
                {sections.map(s => (
                    <div key={'active-' + s.name} className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-4 border-b pb-4">
                            <h3 className="font-black text-lg uppercase" style={{ color: s.color }}>{s.name}</h3>
                            <button onClick={() => {const n=prompt("Nom?"); if(n) onCreateChapter(s.name, n);}} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed" style={{ color: s.color, borderColor: s.color }}>+ CRÉER</button>
                        </div>
                        <div className="grid grid-cols-1">
                            {(chapters || []).filter(c => c.subject === s.name && !c.isArchived).map(chap => renderChapterCard(chap, s, openChaps[chap._id], []))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}