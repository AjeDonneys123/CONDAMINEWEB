// @signatures: ProfStudioFolder, executeDelete, fetchSections, handleArchiveChapter, handleCreateChapter, handleCreateSection, handleOpenEditSection, handleRenameChapter, handleSaveSectionEdit, handleUpdateChapterComplete, prepareDelete
import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, studentsRef, allClasses, classFilter, levelFilter, user, onEditItem, onCreateActivity, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionScope, setNewSectionScope] = useState("GLOBAL"); 
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [newChapterScope, setNewChapterScope] = useState("LEVEL"); 
    const [showEditChapterModal, setShowEditChapterModal] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null); 
    const [showEditSectionModal, setShowEditSectionModal] = useState(false);
    const [editingSection, setEditingSection] = useState(null); 
    const [deleteTarget, setDeleteTarget] = useState(null); 

    const getUserId = () => user?.id || user?._id;

    async function fetchSections() {
        const uid = getUserId();
        if (!uid || uid === 'undefined') return;
        try {
            const res = await fetch(`/api/structure/sections/${uid}?classContext=${classFilter || ""}`);
            if (res.ok) {
                const data = await res.json();
                let list = (Array.isArray(data) ? data : []).filter(s => s.name.toUpperCase() !== "GÉNÉRAL");
                list.unshift({ name: 'GÉNÉRAL', color: '#64748b', scope: 'GLOBAL' });
                setCustomSections(list);
            }
        } catch(e) {}
    }

    useEffect(() => { fetchSections(); }, [user, classFilter, onRefresh]);

    // --- RÉSOLUTION DU CONTEXTE (RÉPARÉ) ---
    const cleanFilter = (classFilter || "").trim().toUpperCase();
    const contextClassObj = (allClasses || []).find(c => c.name.toUpperCase() === cleanFilter);
    const contextClassId = contextClassObj?._id ? String(contextClassObj._id) : null;

    const studentsInActiveContext = Array.isArray(studentsRef) ? studentsRef.filter(s => {
        const isMatchMain = (s.currentClass || "").trim().toUpperCase() === cleanFilter;
        const isMatchGroup = contextClassId && (s.assignedGroups || []).some(gId => String(gId) === contextClassId);
        return isMatchMain || isMatchGroup;
    }) : [];

    const filteredChapters = (Array.isArray(chapters) ? chapters : []).filter(c => {
        if (c.section.toUpperCase() !== activeSection.toUpperCase() || c.isArchived !== showArchived) return false;
        if (c.hiddenIn && c.hiddenIn.includes(classFilter)) return false;
        const isMatch = (activeSection.toUpperCase() === "GÉNÉRAL" && c.title.toUpperCase() === "GÉNÉRAL") || (classFilter && c.classroom === classFilter) || (levelFilter && String(c.sharedLevel) === String(levelFilter)) || (!c.classroom && !c.sharedLevel);
        return isMatch;
    });

    const uniqueItems = Array.from(new Map((items || []).map(item => [item._id, item])).values());

    return (
        <div className="animate-in fade-in">
            {/* SECTIONS BAR */}
            <div className="p-6 rounded-b-[40px] bg-slate-900 shadow-xl overflow-visible">
                <div className="flex justify-between items-center mb-2 px-4">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest opacity-40">Sections Cloud</h3>
                    <div className="flex gap-2">
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-4 py-2 rounded-xl font-black text-[10px] transition-all ${showArchived ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'}`}>{showArchived ? '📂 Actifs' : '📦 Archives'}</button>
                        <button onClick={() => setShowSectionModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px] shadow-lg">+ Section</button>
                    </div>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-6 pt-8 px-4 overflow-y-visible">
                    {customSections.map((s, idx) => (
                        <div key={idx} className="relative group shrink-0">
                            <button onClick={() => { setActiveSection(s.name); setShowArchived(false); }} className={`min-w-[140px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center ${activeSection.toUpperCase() === s.name.toUpperCase() ? 'bg-slate-800 border-white/20 scale-105 shadow-lg' : 'bg-slate-800/40 border-transparent opacity-40 hover:opacity-100'}`}>
                                <span className="font-black text-[11px] uppercase truncate w-full px-2" style={{ color: s.color }}>{s.name}</span>
                                <div className="text-[7px] font-black text-white/30 mt-1 uppercase tracking-widest">{s.scope}</div>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-6 mt-10">
                <div className="flex justify-between items-end mb-8">
                    <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: (customSections.find(s=>s.name.toUpperCase()===activeSection.toUpperCase())?.color || '#64748b') }}>{activeSection}</h2>
                    {/* 🚀 BOUTONS DE CRÉATION RESTAURÉS */}
                    {!showArchived && (
                        <div className="flex gap-2">
                            <button onClick={() => onCreateActivity('homework', activeSection)} className="px-5 py-3 rounded-xl bg-orange-500 text-white text-[11px] font-black uppercase shadow-lg">+ Devoir</button>
                            <button onClick={() => onCreateActivity('game', activeSection)} className="px-5 py-3 rounded-xl bg-purple-600 text-white text-[11px] font-black uppercase shadow-lg">+ Jeu</button>
                            <button onClick={() => setShowChapterModal(true)} className="px-5 py-3 rounded-xl bg-slate-900 text-white text-[11px] font-black uppercase shadow-lg">+ Dossier</button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-4 pb-20">
                    {filteredChapters.sort((a,b) => a.title.localeCompare(b.title)).map(chap => {
                        const relevantItems = uniqueItems.filter(it => String(it.chapterId) === String(chap._id) && (!classFilter || (it.targetClassrooms && it.targetClassrooms.includes(classFilter))));

                        return (
                            <div key={chap._id} className="bg-white border-2 rounded-[30px] overflow-hidden shadow-sm border-slate-100">
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setOpenChaps({...openChaps, [chap._id]: !openChaps[chap._id]})}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow-inner" style={{ backgroundColor: (customSections.find(s=>s.name.toUpperCase()===activeSection.toUpperCase())?.color || '#64748b') }}>{openChaps[chap._id] ? '📂' : '📁'}</div>
                                        <h3 className="font-black text-slate-800 text-md uppercase">{chap.title}</h3>
                                    </div>
                                    <span className="text-[8px] font-black text-slate-400 uppercase">{relevantItems.length} ÉLÉMENTS</span>
                                </div>
                                {openChaps[chap._id] && (
                                    <div className="bg-slate-50/50 border-t p-4 space-y-2">
                                        {relevantItems.map(it => {
                                            const isFull = it.isAllClass === true;
                                            const assignedInThisClass = (it.assignedStudents || []).filter(id => 
                                                studentsInActiveContext.some(s => String(s._id) === String(id))
                                            );

                                            return (
                                                <div key={it._id} className="bg-white p-3 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-slate-700 text-xs uppercase">{it.typeLabel} | {it.title}</span>
                                                        {isFull ? (
                                                            <div className="text-[8px] text-emerald-500 font-bold mt-1 uppercase tracking-widest">🏫 {classFilter} : TOUTE LA CLASSE</div>
                                                        ) : (
                                                            <div className="text-[8px] text-orange-500 font-bold mt-1 uppercase tracking-widest">
                                                                👤 {classFilter} : {assignedInThisClass.length > 0 ? assignedInThisClass.map(id => {
                                                                    const s = studentsInActiveContext.find(st => String(st._id) === String(id));
                                                                    return s ? `${s.firstName} ${s.lastName.charAt(0)}.` : `[ID:${String(id).slice(-4)}]`;
                                                                }).join(', ') : "AUCUN ÉLÈVE DÉTECTÉ"}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button onClick={() => onEditItem(it)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[8px] font-black uppercase">ÉDITER</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
