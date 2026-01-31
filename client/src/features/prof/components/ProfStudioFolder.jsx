// @signatures: ProfStudioFolder, confirmCreateChapter, confirmDelete, confirmMoveChapter, fetchSections, handleArchiveChapter, handleCreateChapter, handleDeleteChapter, handleMoveChapter, handleRenameChapter, isChapterVisible, isItemVisibleForClass
import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, studentsRef, classFilter, levelFilter, user, onEditItem, onDeleteItem, onCreateActivity, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [loading, setLoading] = useState(true);
    const [showArchived, setShowArchived] = useState(false); 
    
    // MODALES
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [showChapterModal, setShowChapterModal] = useState(false);
    const [newChapterTitle, setNewChapterTitle] = useState("");
    const [showMoveModal, setShowMoveModal] = useState(false);
    const [movingChapter, setMovingChapter] = useState(null);
    const [deleteRequest, setDeleteRequest] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const getUserId = () => { if (!user) return null; return user.id || user._id; };

    const fetchSections = async () => {
        const uid = getUserId();
        if (!uid) { setLoading(false); return; }
        const classParam = classFilter ? `&classContext=${encodeURIComponent(classFilter)}` : '';
        try {
            const res = await fetch(`/api/prof/structure/sections/${uid}?_t=${Date.now()}${classParam}`);
            if (res.ok) {
                const data = await res.json();
                const visibleSections = data.filter(s => {
                    if (s.name === "GÉNÉRAL") return false;
                    if (s.hiddenIn && s.hiddenIn.includes(classFilter)) return false;
                    return true;
                });
                setCustomSections(visibleSections);
                if (!visibleSections.some(s => s.name === activeSection)) setActiveSection("GÉNÉRAL");
            }
        } catch(e) { }
        setLoading(false);
    };

    useEffect(() => { fetchSections(); }, [user, classFilter, onRefresh]); 

    const isChapterVisible = (chap) => {
        if (!classFilter) return true; 
        const chapClass = (chap.classroom || "").toUpperCase().trim();
        const chapLevel = (chap.sharedLevel || "").trim();
        const currentClass = classFilter.toUpperCase().trim();
        if (chapClass === currentClass) return true;
        if (chapLevel && String(chapLevel) === String(levelFilter)) return true;
        if (!chapClass && !chapLevel && chap.section === "GÉNÉRAL") return true;
        return false;
    };

    const handleRenameChapter = async (e, chapId, oldTitle) => {
        e.stopPropagation();
        const newTitle = prompt("Nouveau nom du dossier :", oldTitle);
        if (!newTitle || newTitle === oldTitle) return;
        await fetch(`/api/prof/structure/chapters/${chapId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle }) });
        if(onRefresh) onRefresh();
    };

    const handleArchiveChapter = async (e, chapId, shouldArchive) => {
        e.stopPropagation();
        if (shouldArchive && !confirm("📦 Archiver ce dossier ? Il ne sera plus visible par les élèves.")) return;
        await fetch(`/api/prof/structure/chapters/${chapId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isArchived: shouldArchive }) });
        if(onRefresh) onRefresh();
    };

    const handleDeleteChapter = async (e, chapId, title) => {
        e.stopPropagation();
        if (!confirm(`⚠️ Supprimer définitivement le dossier "${title}" et tout son contenu ?`)) return;
        await fetch(`/api/prof/structure/chapters/${chapId}`, { method: 'DELETE' });
        if(onRefresh) onRefresh();
    };

    const handleMoveChapter = (e, chap) => { e.stopPropagation(); setMovingChapter(chap); setShowMoveModal(true); };

    const confirmMoveChapter = async (sectionName) => {
        if (!movingChapter) return;
        setIsProcessing(true);
        try {
            await fetch(`/api/prof/structure/chapters/${movingChapter._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section: sectionName.toUpperCase().trim() }) });
            setShowMoveModal(false); setMovingChapter(null); if(onRefresh) onRefresh();
        } catch(e) { alert("Erreur lors du déplacement"); }
        setIsProcessing(false);
    };

    const confirmDelete = async (sectionName, isPermanent) => {
        if (isProcessing) return;
        setIsProcessing(true);
        try {
            const res = await fetch('/api/prof/structure/sections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId(), sectionName, permanent: isPermanent, classId: classFilter }) });
            if (res.ok) { setDeleteRequest(null); setActiveSection("GÉNÉRAL"); fetchSections(); if (onRefresh) onRefresh(); }
        } catch (e) { alert("Erreur réseau"); }
        setIsProcessing(false);
    };

    const confirmCreateSection = async (scope) => { 
        if (!newSectionName) return; 
        let target = null; if (scope === 'LEVEL') target = levelFilter; if (scope === 'CLASS') target = classFilter; 
        try { 
            const res = await fetch('/api/prof/structure/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId(), sectionName: newSectionName.toUpperCase().trim(), scope, target }) }); 
            if (res.ok) { setActiveSection(newSectionName.toUpperCase().trim()); setShowSectionModal(false); setNewSectionName(""); fetchSections(); if(onRefresh) onRefresh(); } 
        } catch (e) { alert("Erreur réseau."); } 
    };

    const handleCreateChapter = () => { if (!classFilter) return alert("⚠️ Sélectionnez une classe d'abord."); setNewChapterTitle(""); setShowChapterModal(true); };

    const confirmCreateChapter = async (scope) => {
        if (!newChapterTitle.trim()) return alert("Veuillez donner un nom au dossier.");
        const isLevel = scope === 'LEVEL';
        await fetch('/api/prof/structure/chapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newChapterTitle.toUpperCase(), section: activeSection, classroom: isLevel ? "" : classFilter.toUpperCase(), sharedLevel: isLevel ? levelFilter : "", teacherId: getUserId() }) }); 
        setShowChapterModal(false); if(onRefresh) onRefresh();
    };

    const isItemVisibleForClass = (item) => { if (!classFilter) return true; const targets = item.targetClassrooms || (item.classroom ? [item.classroom] : []); return targets.length === 0 || targets.some(t => t.toUpperCase() === classFilter.toUpperCase()); };

    const activeColorInfo = customSections.find(s => s.name === activeSection);
    const activeColor = activeColorInfo ? activeColorInfo.color : '#64748b'; 

    return (
        <div className="animate-in fade-in relative">
            
            {/* 1. MODALE SUPPRESSION SECTION */}
            {deleteRequest && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-10 px-4">
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setDeleteRequest(null)}></div>
                    <div className="relative bg-slate-900 border-2 border-white/10 p-8 rounded-[40px] max-w-md w-full text-center shadow-2xl animate-in slide-in-from-top">
                        <div className="w-16 h-16 bg-red-500/20 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-6">🗑️</div>
                        <h3 className="text-white font-black text-xl uppercase mb-2">Gérer la section</h3>
                        <p className="text-slate-400 text-[10px] font-bold mb-8 uppercase tracking-widest opacity-60">"{deleteRequest.name}"</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => confirmDelete(deleteRequest.name, false)} className="w-full p-4 bg-white text-slate-900 rounded-2xl font-black text-xs uppercase hover:bg-slate-200 transition-all">🙈 Cacher pour {classFilter}</button>
                            <button onClick={() => confirmDelete(deleteRequest.name, true)} className="w-full p-4 bg-red-600 text-white rounded-2xl font-black text-xs uppercase hover:bg-red-700 transition-all">🔥 Supprimer partout</button>
                            <button onClick={() => setDeleteRequest(null)} className="mt-4 text-slate-500 font-black text-[9px] uppercase tracking-widest">Annuler</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. MODALE DÉPLACEMENT (MOVE) */}
            {showMoveModal && movingChapter && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-10 px-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMoveModal(false)}></div>
                    <div className="relative bg-white border-4 border-indigo-600 w-full max-w-lg rounded-[50px] p-10 text-center shadow-2xl animate-in slide-in-from-top">
                        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-[25px] flex items-center justify-center text-4xl mx-auto mb-6">📤</div>
                        <h3 className="text-slate-900 font-black text-2xl mb-2 uppercase tracking-tighter">Déplacer le dossier</h3>
                        <p className="text-indigo-600 text-[11px] font-black uppercase mb-8 tracking-widest">"{movingChapter.title}"</p>
                        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar p-2">
                            {customSections.map((s, idx) => (
                                <button key={idx} onClick={() => confirmMoveChapter(s.name)} className="w-full p-4 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50 font-black text-slate-700 text-xs uppercase transition-all flex items-center justify-between group">
                                    <span>Vers {s.name}</span><span className="opacity-0 group-hover:opacity-100 transition-opacity">➔</span>
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setShowMoveModal(false)} className="mt-8 text-slate-300 font-black text-[10px] uppercase hover:text-slate-500 tracking-widest">Annuler</button>
                    </div>
                </div>
            )}

            {/* 3. MODALE CRÉATION SECTION */}
            {showSectionModal && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-10 px-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowSectionModal(false)}></div>
                    <div className="relative bg-slate-900 border-2 border-slate-700 w-full max-w-lg rounded-[40px] p-8 text-center shadow-2xl animate-in slide-in-from-top">
                        <h3 className="text-white font-black text-xl mb-6 uppercase tracking-tighter">Nouvelle Section</h3>
                        <input className="bg-slate-800 text-white font-black text-center text-xl border-b-2 border-indigo-500 outline-none p-4 w-full rounded-2xl mb-8" placeholder="NOM" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} autoFocus />
                        <div className="flex flex-col gap-3">
                            <button onClick={() => confirmCreateSection('CLASS')} className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-xs uppercase">Privé : {classFilter}</button>
                            <button onClick={() => confirmCreateSection('LEVEL')} disabled={!levelFilter} className={`w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-xs uppercase ${!levelFilter && 'opacity-50'}`}>Niveau : {levelFilter}</button>
                            <button onClick={() => confirmCreateSection('GLOBAL')} className="w-full bg-slate-700 text-white p-4 rounded-xl font-black text-xs uppercase">Global (Toutes classes)</button>
                        </div>
                        <button onClick={() => setShowSectionModal(false)} className="mt-6 text-slate-500 font-bold text-[9px] uppercase hover:text-white">Annuler</button>
                    </div>
                </div>
            )}

            {/* 4. MODALE CRÉATION DOSSIER */}
            {showChapterModal && (
                <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-10 px-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowChapterModal(false)}></div>
                    <div className="relative bg-white border-4 border-orange-500 w-full max-w-lg rounded-[50px] p-10 text-center shadow-[0_40px_100px_rgba(0,0,0,0.4)] animate-in slide-in-from-top">
                        <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-[25px] flex items-center justify-center text-4xl mx-auto mb-6 shadow-sm">📁</div>
                        <h3 className="text-slate-900 font-black text-2xl mb-2 uppercase tracking-tighter">Nouveau Dossier</h3>
                        <p className="text-slate-400 text-[10px] font-black uppercase mb-8 tracking-widest">Section : {activeSection}</p>
                        <input className="bg-slate-50 text-slate-800 font-black text-center text-2xl border-2 border-slate-100 outline-none p-5 w-full rounded-[25px] mb-8 focus:border-orange-500 focus:bg-white transition-all shadow-inner" placeholder="TITRE" value={newChapterTitle} onChange={e => setNewChapterTitle(e.target.value)} autoFocus />
                        <div className="grid grid-cols-1 gap-3">
                            <button onClick={() => confirmCreateChapter('CLASS')} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white p-5 rounded-[20px] font-black text-xs uppercase shadow-lg shadow-emerald-500/20 transition-all active:scale-95">🔒 UNIQUEMENT POUR {classFilter}</button>
                            <button onClick={() => confirmCreateChapter('LEVEL')} disabled={!levelFilter} className={`w-full bg-blue-600 hover:bg-blue-700 text-white p-5 rounded-[20px] font-black text-xs uppercase shadow-lg shadow-blue-500/20 transition-all active:scale-95 ${!levelFilter && 'opacity-30'}`}>🌐 POUR TOUS LES {levelFilter || '...'}</button>
                        </div>
                        <button onClick={() => setShowChapterModal(false)} className="mt-8 text-slate-300 font-black text-[10px] uppercase hover:text-slate-500 tracking-widest transition-colors">Annuler la création</button>
                    </div>
                </div>
            )}

            {/* HEADER DE SECTION / CLOUD STORAGE */}
            <div className="p-8 pt-14 rounded-b-[50px] rounded-t-none border-x-4 border-b-4 bg-slate-900 border-slate-800 shadow-2xl relative overflow-visible mt-0">
                <div className="flex justify-between items-center mb-8 px-4">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                        <h3 className="text-white font-black text-[10px] uppercase tracking-[0.4em] opacity-40">Cloud Drive Storage</h3>
                    </div>
                    <button onClick={() => setShowSectionModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-500 hover:scale-105 transition-all">+ Nouvelle Section</button>
                </div>
                
                <div className="flex gap-4 overflow-x-auto no-scrollbar p-6 relative min-h-[140px]">
                    <div className="relative shrink-0">
                        <button onClick={() => { setActiveSection("GÉNÉRAL"); setShowArchived(false); }} className={`min-w-[160px] p-5 rounded-2xl border-2 flex flex-col items-start gap-3 transition-all ${activeSection === "GÉNÉRAL" ? 'bg-slate-800 border-white/20 shadow-xl scale-105' : 'bg-slate-800/40 border-slate-800 opacity-30'}`}>
                            <span className="font-black text-[11px] uppercase text-slate-400">GÉNÉRAL</span>
                        </button>
                    </div>
                    {customSections.map((s, idx) => (
                        <div key={idx} className="relative shrink-0">
                            <button onClick={() => setActiveSection(s.name)} className={`min-w-[160px] p-5 rounded-2xl border-2 flex flex-col items-start gap-3 transition-all ${activeSection === s.name ? 'bg-slate-800 border-white/20 shadow-xl scale-105' : 'bg-slate-800/40 border-slate-800'}`}>
                                <span className="font-black text-[11px] uppercase tracking-wider text-left" style={{ color: s.color }}>{s.name}</span>
                                <span className="text-[7px] text-slate-500 font-bold uppercase">{s.scope}</span>
                            </button>
                            <div onClick={(e) => { e.stopPropagation(); setDeleteRequest(s); }} className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full font-black text-[10px] flex items-center justify-center shadow-lg cursor-pointer border-2 border-slate-900 hover:scale-125 hover:bg-red-600 transition-all z-20">✕</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="px-6 mt-12">
                <div className="flex justify-between items-end mb-10">
                    <div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter flex items-center gap-4" style={{ color: activeColor }}>
                            {activeSection}
                            {showArchived && <span className="text-xl bg-orange-100 text-orange-600 px-4 py-1 rounded-full border-2 border-orange-200">ARCHIVES</span>}
                        </h2>
                        <div className="h-2 w-24 rounded-full mt-2" style={{ backgroundColor: activeColor, opacity: 0.3 }}></div>
                    </div>
                    <div className="flex gap-3">
                        {activeSection !== "GÉNÉRAL" && (
                            <button onClick={() => setShowArchived(!showArchived)} className={`px-6 py-4 rounded-[18px] text-[10px] font-black shadow-lg uppercase transition-all ${showArchived ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                                {showArchived ? '↩ Retour' : '📦 Voir Archives'}
                            </button>
                        )}
                        {!showArchived && (
                            <>
                                <button onClick={() => onCreateActivity('homework', activeSection)} className="px-6 py-4 rounded-[18px] bg-orange-500 text-white text-[10px] font-black shadow-lg uppercase">+ Devoir</button>
                                <button onClick={() => onCreateActivity('game', activeSection)} className="px-6 py-4 rounded-[18px] bg-purple-600 text-white text-[10px] font-black shadow-lg uppercase">+ Jeu</button>
                                <button onClick={handleCreateChapter} className="px-6 py-4 rounded-[18px] bg-slate-900 text-white text-[10px] font-black shadow-lg uppercase">+ Dossier</button>
                            </>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-6 pb-20">
                    {chapters
                        .filter(c => (c.section || "GÉNÉRAL").toUpperCase() === activeSection.toUpperCase())
                        .filter(c => !!c.isArchived === showArchived)
                        .filter(isChapterVisible)
                        .sort((a, b) => (a.title || "").localeCompare((b.title || ""), undefined, { numeric: true, sensitivity: 'base' }))
                        .map(chap => {
                            const chapItems = items.filter(it => String(it.chapterId) === String(chap._id) && isItemVisibleForClass(it));
                            return (
                                <div key={chap._id} className={`bg-white border-2 rounded-[35px] overflow-hidden shadow-sm transition-all ${showArchived ? 'border-orange-200 opacity-80' : 'border-[#f1f5f9]'}`}>
                                    <div className="p-8 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors" onClick={() => setOpenChaps({...openChaps, [chap._id]: !openChaps[chap._id]})}>
                                        <div className="flex items-center gap-6">
                                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-inner ${showArchived ? 'bg-orange-400' : ''}`} style={!showArchived ? { backgroundColor: activeColor } : {}}>{openChaps[chap._id] ? '📂' : '📁'}</div>
                                            <div className="flex flex-col">
                                                <h3 className="font-black text-slate-800 text-xl uppercase leading-tight">{chap.title}</h3>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-[9px] font-black text-slate-400 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded uppercase">{chapItems.length} ÉLÉMENTS</span>
                                                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded uppercase">
                                                        {chap.sharedLevel ? `PARTAGÉ ${chap.sharedLevel}` : chap.classroom}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-4">
                                            {/* ACTIONS DOSSIER RESTAURÉES */}
                                            <div className="flex gap-2 items-center">
                                                {!showArchived && <button onClick={(e) => handleRenameChapter(e, chap._id, chap.title)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-black text-xs flex items-center justify-center" title="Renommer">✏️</button>}
                                                
                                                {activeSection !== "GÉNÉRAL" && (
                                                    <button onClick={(e) => handleArchiveChapter(e, chap._id, !showArchived)} className={`w-10 h-10 rounded-xl bg-slate-50 text-slate-400 transition-all font-black text-xs flex items-center justify-center ${showArchived ? 'hover:bg-green-50 hover:text-green-600' : 'hover:bg-orange-50 hover:text-orange-600'}`} title={showArchived ? "Désarchiver" : "Archiver"}>
                                                        {showArchived ? '↩' : '📦'}
                                                    </button>
                                                )}

                                                {activeSection === "GÉNÉRAL" && !showArchived && (
                                                    <button onClick={(e) => handleMoveChapter(e, chap)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-orange-50 hover:text-orange-600 transition-all font-black text-xs flex items-center justify-center" title="Déplacer vers une matière">📤</button>
                                                )}
                                                <button onClick={(e) => handleDeleteChapter(e, chap._id, chap.title)} className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all font-black text-xs flex items-center justify-center" title="Supprimer">✕</button>
                                            </div>
                                            
                                            {/* BOUTON "+" RESTAURÉ (GRAND ET CLAIR) */}
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-2xl transition-all ${openChaps[chap._id] ? 'bg-slate-800 text-white rotate-0' : 'bg-slate-100 text-slate-300'}`}>
                                                {openChaps[chap._id] ? '−' : '+'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {openChaps[chap._id] && (
                                        <div className="bg-slate-50/50 border-t p-6 space-y-3">
                                            {chapItems.map(it => {
                                                const assignedNames = it.isAllClass ? [] : (it.assignedStudents || [])
                                                    .map(id => (studentsRef || []).find(s => String(s._id) === String(id)))
                                                    .filter(s => !!s)
                                                    .map(s => `${s.firstName} ${s.lastName}`);

                                                return (
                                                    <div key={it._id} className="bg-white p-5 rounded-2xl flex justify-between items-start shadow-sm border border-slate-100 hover:border-indigo-200 transition-all">
                                                        <div className="flex items-start gap-4">
                                                            <span className="text-[10px] font-black bg-slate-100 text-slate-400 px-3 py-1 rounded-lg uppercase mt-1">
                                                                {it.actType === 'homework' ? '📝 DM' : it.actType === 'game' ? '🎮 JEU' : '📸 DC'}
                                                            </span>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-slate-700 text-xs uppercase">{it.title}</span>
                                                                {it.isAllClass ? (
                                                                    <span className="text-[8px] font-black text-emerald-500 uppercase mt-1">🌍 CLASSE ENTIÈRE</span>
                                                                ) : (
                                                                    <div className="flex flex-col gap-1 mt-2">
                                                                        <span className="text-[8px] font-black text-orange-500 uppercase">🎯 CIBLÉ ({assignedNames.length} ÉLÈVES) :</span>
                                                                        <div className="flex flex-wrap gap-1">
                                                                            {assignedNames.map((name, i) => (
                                                                                <span key={i} className="bg-orange-50 text-orange-600 border border-orange-100 text-[7px] font-black px-2 py-0.5 rounded-md uppercase">{name}</span>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {/* BOUTON ÉDITER NOIR RESTAURÉ */}
                                                            {!showArchived && <button onClick={() => onEditItem(it)} className="px-5 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase shadow-lg hover:bg-black transition-all active:scale-95">ÉDITER</button>}
                                                            <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-10 h-10 rounded-xl bg-red-50 text-red-500 font-bold hover:bg-red-500 hover:text-white transition-all flex items-center justify-center shadow-sm">✕</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {chapItems.length === 0 && <div className="text-center py-6 text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] italic">Dossier vide</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    }
                </div>
            </div>
        </div>
    );
}
