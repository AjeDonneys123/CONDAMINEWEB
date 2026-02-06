// @signatures: ProfStudioFolder, executeDelete, fetchSections, handleArchiveChapter, handleCreateChapter, handleCreateSection, handleOpenEditSection, handleRenameChapter, handleSaveSectionEdit, handleUpdateChapterComplete, prepareDelete
import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, studentsRef, allClasses, classFilter, levelFilter, user, onEditItem, onCreateActivity, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    
    // ÉTATS CRÉATION RESTAURÉS
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [newSectionScope, setNewSectionScope] = useState("GLOBAL"); 
    
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [newChapterScope, setNewChapterScope] = useState("LEVEL"); 

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

    // --- FONCTIONS DE CRÉATION RESTAURÉES ---
    const handleCreateSection = async () => {
        if (!newSectionName) return;
        const uid = getUserId();
        // Cible pour la section (ex: 6A ou 6)
        const target = newSectionScope === 'CLASS' ? classFilter : (newSectionScope === 'LEVEL' ? levelFilter : null);
        
        await fetch('/api/structure/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                teacherId: uid, 
                sectionName: newSectionName.toUpperCase(), 
                scope: newSectionScope, 
                target: target 
            })
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
            body: JSON.stringify({ 
                title: newChapterTitle.toUpperCase(), 
                section: activeSection, 
                teacherId: uid, 
                scope: newChapterScope, 
                target: target 
            })
        });
        setNewChapterTitle(""); setShowChapterModal(false); if (onRefresh) onRefresh();
    };

    const handleRenameChapter = async (e, chapId, oldTitle) => {
        e.stopPropagation();
        const n = prompt("Nouveau nom :", oldTitle);
        if (!n || n === oldTitle) return;
        const res = await fetch(`/api/structure/chapters/${chapId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: n.toUpperCase() })
        });
        if (res.ok && onRefresh) onRefresh();
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
        let url = (type === 'section') ? '/api/structure/sections' : (type === 'chapter') ? '/api/structure/chapters/delete-request' : '/api/structure/activity/delete-request';
        const body = { teacherId: uid, classId: classFilter, permanent };
        if (type === 'section') body.sectionName = deleteTarget?.name || id;
        if (type === 'chapter') body.chapterId = id;
        if (type === 'homework' || type === 'game') { body.id = id; body.type = type; }
        const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.ok) { setDeleteTarget(null); if (type === 'section') setActiveSection("GÉNÉRAL"); if (onRefresh) onRefresh(); }
    };

    // --- CONTEXTE ÉLÈVES ---
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
                        {/* BOUTON + SECTION RESTAURÉ */}
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
                    {!showArchived && (
                        <div className="flex gap-2">
                            <button onClick={() => onCreateActivity('homework', activeSection)} className="px-5 py-3 rounded-xl bg-orange-500 text-white text-[11px] font-black uppercase shadow-lg">+ Devoir</button>
                            <button onClick={() => onCreateActivity('game', activeSection)} className="px-5 py-3 rounded-xl bg-purple-600 text-white text-[11px] font-black uppercase shadow-lg">+ Jeu</button>
                            {/* BOUTON + DOSSIER RESTAURÉ */}
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
                                                    <button onClick={() => onEditItem(it, activeSection)} className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[8px] font-black uppercase">ÉDITER</button>
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

            {/* MODALE CRÉATION SECTION RESTAURÉE */}
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

            {/* MODALE CRÉATION DOSSIER RESTAURÉE */}
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
        </div>
    );
}
