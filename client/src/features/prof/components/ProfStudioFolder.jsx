// @signatures: ProfStudioFolder, executeDelete, fetchSections, handleArchiveChapter, handleCreateChapter, handleCreateSection, handleOpenEditSection, handleOpenEditChapter, handleSaveChapterEdit, handleSaveSectionEdit, prepareDelete
import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, studentsRef, allClasses, classFilter, levelFilter, user, onEditItem, onCreateActivity, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    
    // CRÉATION
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionScope, setNewSectionScope] = useState("GLOBAL"); 
    
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [newChapterScope, setNewChapterScope] = useState("LEVEL"); 

    // ÉDITION SECTION
    const [showEditSectionModal, setShowEditSectionModal] = useState(false);
    const [editingSection, setEditingSection] = useState(null);

    // ÉDITION DOSSIER (RESTAURÉE)
    const [showEditChapterModal, setShowEditChapterModal] = useState(false);
    const [editingChapter, setEditingChapter] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null); 

    const PRESET_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#f43f5e", "#64748b"];

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

    // --- FONCTIONS CRÉATION ---
    const handleCreateSection = async () => {
        if (!newSectionName) return;
        const uid = getUserId();
        const target = newSectionScope === 'CLASS' ? classFilter : (newSectionScope === 'LEVEL' ? levelFilter : null);
        await fetch('/api/structure/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: uid, sectionName: newSectionName.toUpperCase(), scope: newSectionScope, target: target })
        });
        setNewSectionName(""); setShowSectionModal(false); fetchSections();
    };

    const handleCreateChapter = async () => {
        if (!newChapterTitle) return;
        const uid = getUserId();
        const target = newChapterScope === 'CLASS' ? classFilter : levelFilter;
        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newChapterTitle.toUpperCase(), section: activeSection, teacherId: uid, scope: newChapterScope, target: target })
        });
        setNewChapterTitle(""); setShowChapterModal(false); if (onRefresh) onRefresh();
    };

    // --- ÉDITION SECTION ---
    const handleOpenEditSection = (s) => {
        setEditingSection({ oldName: s.name, name: s.name, color: s.color, scope: s.scope, target: s.target });
        setShowEditSectionModal(true);
    };

    const handleSaveSectionEdit = async () => {
        if (!editingSection.name) return;
        const target = editingSection.scope === 'CLASS' ? classFilter : (editingSection.scope === 'LEVEL' ? levelFilter : editingSection.target);
        
        const res = await fetch('/api/structure/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                teacherId: getUserId(), 
                oldName: editingSection.oldName, 
                sectionName: editingSection.name.toUpperCase(), 
                color: editingSection.color,
                scope: editingSection.scope,
                target: target
            })
        });
        if (res.ok) {
            if (activeSection === editingSection.oldName) setActiveSection(editingSection.name.toUpperCase());
            setShowEditSectionModal(false);
            fetchSections();
            if (onRefresh) onRefresh(); 
        }
    };

    // --- ÉDITION DOSSIER (RESTAURÉE SANS PROMPT) ---
    const handleOpenEditChapter = (e, chap) => {
        e.stopPropagation();
        // Déduction du scope actuel
        const scope = chap.classroom ? "CLASS" : "LEVEL"; 
        setEditingChapter({ id: chap._id, title: chap.title, scope });
        setShowEditChapterModal(true);
    };

    const handleSaveChapterEdit = async () => {
        if (!editingChapter || !editingChapter.title) return;
        const target = editingChapter.scope === 'CLASS' ? classFilter : levelFilter;
        
        const res = await fetch(`/api/structure/chapters/${editingChapter.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: editingChapter.title.toUpperCase().trim(),
                scope: editingChapter.scope,
                target: target
            })
        });
        if (res.ok) {
            setShowEditChapterModal(false);
            setEditingChapter(null);
            if (onRefresh) onRefresh();
        }
    };

    const handleArchiveChapter = async (e, chapId, shouldArchive) => {
        e.stopPropagation();
        const res = await fetch(`/api/structure/chapters/${chapId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived: shouldArchive })
        });
        if (res.ok && onRefresh) onRefresh();
    };

    // --- SUPPRESSION ---
    const prepareDelete = (e, item, type) => {
        e.stopPropagation();
        if (type === 'chapter' && activeSection === "GÉNÉRAL" && item.title === "GÉNÉRAL") {
            alert("🔒 Dossier Protégé.");
            return;
        }
        const name = type === 'section' ? item.name : item.title;
        const id = item._id || item.id;
        let isShared = type === 'section' ? item.scope !== 'CLASS' : (type === 'chapter' ? !!item.sharedLevel : (item.targetClassrooms && item.targetClassrooms.length > 1));
        if (!isShared) {
            if (confirm(`Supprimer ${name} ?`)) executeDelete(id, type, true);
        } else {
            setDeleteTarget({ id, type, name });
        }
    };

    const executeDelete = async (id, type, permanent) => {
        const uid = getUserId();
        let url = (type === 'section') ? '/api/structure/sections/delete-request' : (type === 'chapter') ? '/api/structure/chapters/delete-request' : '/api/structure/activity/delete-request';
        const body = { teacherId: uid, classId: classFilter, permanent };
        if (type === 'section') body.sectionName = deleteTarget?.name || id;
        if (type === 'chapter') body.chapterId = id;
        if (type === 'homework' || type === 'game') { body.id = id; body.type = type; }
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { setDeleteTarget(null); if (type === 'section') setActiveSection("GÉNÉRAL"); if (onRefresh) onRefresh(); }
    };

    // --- FILTRAGE ---
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
                    {customSections.map((s, idx) => {
                        const isGeneral = s.name.toUpperCase() === "GÉNÉRAL";
                        const isActive = activeSection.toUpperCase() === s.name.toUpperCase();
                        return (
                            <div key={idx} className="relative group shrink-0">
                                <button onClick={() => { setActiveSection(s.name); setShowArchived(false); }} className={`min-w-[140px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center justify-center ${isActive ? 'bg-slate-800 border-white/20 scale-105 shadow-lg' : 'bg-slate-800/40 border-transparent opacity-40 hover:opacity-100'}`}>
                                    <span className="font-black text-[11px] uppercase truncate w-full px-2" style={{ color: s.color }}>{s.name}</span>
                                    <div className="text-[7px] font-black text-white/30 mt-1 uppercase tracking-widest">{s.scope}</div>
                                </button>
                                {!isGeneral && (
                                    <div className="absolute -top-3 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <button onClick={(e) => { e.stopPropagation(); handleOpenEditSection(s); }} className="w-7 h-7 bg-white shadow-2xl rounded-full flex items-center justify-center text-[11px] border border-slate-200 hover:scale-110 transition-transform cursor-pointer">✏️</button>
                                        <button onClick={(e) => prepareDelete(e, s, 'section')} className="w-7 h-7 bg-red-500 text-white shadow-2xl rounded-full flex items-center justify-center text-[10px] font-black hover:scale-110 transition-transform cursor-pointer">✕</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="px-6 mt-10">
                <div className="flex justify-between items-end mb-8">
                    <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: (customSections.find(s=>s.name.toUpperCase()===activeSection.toUpperCase())?.color || '#64748b') }}>{activeSection}</h2>
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
                        const isRoot = activeSection === "GÉNÉRAL" && chap.title === "GÉNÉRAL";

                        return (
                            <div key={chap._id} className="bg-white border-2 rounded-[30px] overflow-hidden shadow-sm border-slate-100">
                                <div className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50" onClick={() => setOpenChaps({...openChaps, [chap._id]: !openChaps[chap._id]})}>
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xl shadow-inner" style={{ backgroundColor: (customSections.find(s=>s.name.toUpperCase()===activeSection.toUpperCase())?.color || '#64748b') }}>{openChaps[chap._id] ? '📂' : '📁'}</div>
                                        <div>
                                            {/* BADGES CORRIGÉS : SEULEMENT NIVEAU OU CLASSE */}
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-black text-slate-800 text-md uppercase">{chap.title}</h3>
                                                {chap.classroom ? (
                                                    <span className="bg-indigo-50 text-indigo-400 text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-indigo-100">🏫 CLASSE</span>
                                                ) : (!isRoot) ? (
                                                    <span className="bg-purple-100 text-purple-600 text-[7px] font-black px-2 py-0.5 rounded uppercase tracking-widest border border-purple-200">🎓 NIVEAU</span>
                                                ) : null}
                                            </div>
                                            <span className="text-[8px] font-black text-slate-400 uppercase">{relevantItems.length} ÉLÉMENTS</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={(e) => handleOpenEditChapter(e, chap)} className="p-2 text-slate-300 hover:text-indigo-500 transition-colors">✏️</button>
                                        <button onClick={(e) => handleArchiveChapter(e, chap._id, !showArchived)} className="p-2 text-slate-300 hover:text-orange-500 transition-colors text-xl">{showArchived ? '♻️' : '📦'}</button>
                                        {!isRoot && <button onClick={(e) => prepareDelete(e, chap, 'chapter')} className="p-2 text-red-200 hover:text-red-500 transition-colors text-xl font-bold">✕</button>}
                                    </div>
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
                                                    <div className="flex gap-2">
                                                        <button onClick={() => onEditItem(it, activeSection)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[8px] font-black uppercase">ÉDITER</button>
                                                        <button onClick={(e) => prepareDelete(e, it, it.actType)} className="px-2 py-1.5 rounded-lg bg-red-50 text-red-500 text-[10px]">✕</button>
                                                    </div>
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

            {/* MODALE CRÉATION SECTION */}
            {showSectionModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-6 uppercase text-slate-800">Nouvelle Section</h3>
                        <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold mb-6 outline-none focus:ring-4 ring-indigo-500/20" placeholder="Nom de la matière" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
                        <div className="grid grid-cols-3 gap-3 mb-8">
                            <button onClick={() => setNewSectionScope("GLOBAL")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newSectionScope === "GLOBAL" ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>🌍 GLOBAL</button>
                            <button onClick={() => setNewSectionScope("LEVEL")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newSectionScope === "LEVEL" ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>🎓 NIVEAU</button>
                            <button onClick={() => setNewSectionScope("CLASS")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newSectionScope === "CLASS" ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>🏫 CLASSE</button>
                        </div>
                        <div className="flex gap-4"><button onClick={() => setShowSectionModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button><button onClick={handleCreateSection} className="flex-1 p-5 rounded-2xl font-black text-xs bg-indigo-600 text-white uppercase shadow-xl">Valider ✨</button></div>
                    </div>
                </div>
            )}

            {/* MODALE CRÉATION DOSSIER */}
            {showChapterModal && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-md shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Nouveau Dossier</h3>
                        <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold mb-6 outline-none focus:ring-4 ring-slate-900/10" placeholder="Titre (ex: CH1, CH2...)" value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} autoFocus />
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <button onClick={() => setNewChapterScope("LEVEL")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newChapterScope === "LEVEL" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🎓 TOUTES LES {levelFilter || '?'}</button>
                            <button onClick={() => setNewChapterScope("CLASS")} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${newChapterScope === "CLASS" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🏫 UNIQUEMENT {classFilter}</button>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowChapterModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button>
                            <button onClick={handleCreateChapter} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-900 text-white uppercase shadow-xl">Créer 📂</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALE ÉDITION SECTION */}
            {showEditSectionModal && editingSection && (
                <div className="fixed inset-0 z-[40000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Édition Section</h3>
                        <div className="mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-1">Nom</label>
                            <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold outline-none focus:ring-4 ring-indigo-500/20" value={editingSection.name} onChange={e => setEditingSection({...editingSection, name: e.target.value})} />
                        </div>
                        <div className="mb-6">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3">Couleur</label>
                            <div className="grid grid-cols-6 gap-2 px-2">
                                {PRESET_COLORS.map(c => (
                                    <button key={c} onClick={() => setEditingSection({...editingSection, color: c})} className={`w-10 h-10 rounded-xl border-4 transition-all ${editingSection.color === c ? 'border-slate-900 scale-110 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'}`} style={{ backgroundColor: c }} />
                                ))}
                            </div>
                        </div>
                        <div className="mb-8">
                            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 block mb-3">Portée</label>
                            <div className="grid grid-cols-3 gap-3">
                                {['GLOBAL', 'LEVEL', 'CLASS'].map(s => (
                                    <button key={s} onClick={() => setEditingSection({...editingSection, scope: s})} className={`p-4 rounded-2xl font-black text-[9px] border-2 transition-all ${editingSection.scope === s ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>
                                        {s === 'GLOBAL' ? '🌍 GÉNÉRAL' : s === 'LEVEL' ? '🎓 NIVEAU' : '🏫 CLASSE'}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowEditSectionModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button>
                            <button onClick={handleSaveSectionEdit} className="flex-1 p-5 rounded-2xl font-black text-xs bg-indigo-600 text-white uppercase shadow-xl">Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODALE ÉDITION DOSSIER (NOUVEAU) */}
            {showEditChapterModal && editingChapter && (
                <div className="fixed inset-0 z-[40000] flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-md shadow-2xl animate-in zoom-in">
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Édition Dossier</h3>
                        <input className="w-full p-5 rounded-2xl bg-slate-100 border-none font-bold mb-6 outline-none focus:ring-4 ring-slate-900/10" value={editingChapter.title} onChange={e => setEditingChapter({...editingChapter, title: e.target.value})} />
                        <div className="grid grid-cols-2 gap-3 mb-8">
                            <button onClick={() => setEditingChapter({...editingChapter, scope: "LEVEL"})} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${editingChapter.scope === "LEVEL" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🎓 NIVEAU {levelFilter || '?'}</button>
                            <button onClick={() => setEditingChapter({...editingChapter, scope: "CLASS"})} className={`p-4 rounded-2xl font-black text-[10px] border-2 transition-all ${editingChapter.scope === "CLASS" ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>🏫 CLASSE {classFilter}</button>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setShowEditChapterModal(false)} className="flex-1 p-5 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase">Annuler</button>
                            <button onClick={handleSaveChapterEdit} className="flex-1 p-5 rounded-2xl font-black text-xs bg-indigo-600 text-white uppercase shadow-xl">Sauvegarder</button>
                        </div>
                    </div>
                </div>
            )}

            {deleteTarget && (
                <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-slate-900/95 backdrop-blur-md">
                    <div className="bg-white p-10 rounded-[50px] w-full max-w-lg shadow-2xl animate-in zoom-in text-center">
                        <div className="w-20 h-20 bg-red-100 text-red-500 rounded-full flex items-center justify-center text-4xl mx-auto mb-6">🗑️</div>
                        <h3 className="text-2xl font-black mb-2 uppercase text-slate-800">Action sur "{deleteTarget.name}"</h3>
                        <p className="text-sm text-slate-400 mb-8 px-6">Cet élément est partagé. Voulez-vous le supprimer définitivement ou simplement le masquer dans la classe **{classFilter}** ?</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, false)} className="w-full p-5 rounded-2xl font-black text-xs bg-slate-900 text-white uppercase shadow-lg hover:scale-105 transition-transform">🙈 Masquer ici (conserver ailleurs)</button>
                            <button onClick={() => executeDelete(deleteTarget.id, deleteTarget.type, true)} className="w-full p-5 rounded-2xl font-black text-xs bg-red-600 text-white uppercase shadow-lg hover:scale-105 transition-transform">🔥 Supprimer définitivement pour TOUS</button>
                            <button onClick={() => setDeleteTarget(null)} className="w-full p-4 rounded-2xl font-black text-xs bg-slate-100 text-slate-400 uppercase mt-4">Annuler</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
