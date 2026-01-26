import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, classFilter, levelFilter, user, onEditItem, onDeleteItem, onCreateActivity, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState("GÉNÉRAL"); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    const [loading, setLoading] = useState(true);
    
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");
    const [deletingSection, setDeletingSection] = useState(false);

    const getUserId = () => { if (!user) return null; return user.id || user._id; };

    const fetchSections = async () => {
        const uid = getUserId();
        if (!uid) { setLoading(false); return; }
        
        const classParam = classFilter ? `&classContext=${encodeURIComponent(classFilter)}` : '';

        try {
            const res = await fetch(`/api/structure/sections/${uid}?_t=${Date.now()}${classParam}`);
            if (res.ok) {
                const data = await res.json();
                
                let applicableSections = [];
                if (Array.isArray(data)) {
                    applicableSections = data.filter(s => {
                        if (s.name === "GÉNÉRAL") return false; 
                        if (s.scope === 'LEVEL' && levelFilter && String(s.target).toUpperCase() !== String(levelFilter).toUpperCase()) return false;
                        if (s.scope === 'CLASS' && classFilter && String(s.target).toUpperCase() !== String(classFilter).toUpperCase()) return false;
                        return true;
                    });
                }

                setCustomSections(applicableSections);

                setActiveSection(prev => {
                    const stillExists = applicableSections.some(s => s.name === prev);
                    if (stillExists) return prev;
                    if (applicableSections.length > 0) return applicableSections[0].name;
                    return "GÉNÉRAL";
                });
            }
        } catch(e) { /* Silence */ }
        setLoading(false);
    };

    useEffect(() => { fetchSections(); }, [user, classFilter, onRefresh]); 

    // Helpers
    const uid = String(getUserId());
    const isJean = (user && user.firstName === 'Jean' && user.lastName === 'Vuillet');
    const myChapters = isJean ? (chapters||[]) : (chapters||[]).filter(c => String(c.teacherId) === uid);
    
    const contextChapters = myChapters.filter(c => {
        const cClass = (c.classroom || "").toUpperCase().trim();
        const fClass = (classFilter || "").toUpperCase().trim();
        const cLevel = c.sharedLevel ? String(c.sharedLevel).toUpperCase() : null;
        const fLevel = levelFilter ? String(levelFilter).toUpperCase() : null;

        if (cClass === "") return true; 
        if (cClass === fClass) return true;
        if (cLevel && fLevel && cLevel === fLevel) return true;
        if (!classFilter) return true;

        return false;
    });

    const chaptersInActiveSection = contextChapters.filter(c => {
        const sectionName = (c.section || "GÉNÉRAL").toUpperCase().trim();
        const currentActive = (activeSection || "GÉNÉRAL").toUpperCase().trim();
        const isCorrectStatus = !!c.isArchived === showArchived;
        return sectionName === currentActive && isCorrectStatus;
    });

    // --- ACTIONS ---
    const confirmCreateSection = async (scope) => { 
        if (!newSectionName) return; 
        let target = null; 
        if (scope === 'LEVEL') target = levelFilter; 
        if (scope === 'CLASS') target = classFilter; 
        try { 
            const res = await fetch('/api/structure/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId(), sectionName: newSectionName.toUpperCase().trim(), scope, target }) }); 
            if (res.status === 409) { const err = await res.json(); return alert("⚠️ " + err.error); } 
            if (res.ok) { 
                setActiveSection(newSectionName.toUpperCase().trim()); 
                setShowSectionModal(false); 
                setNewSectionName(""); 
                if(onRefresh) onRefresh(); 
                fetchSections();
            } 
        } catch (e) { alert("Erreur réseau."); } 
    };

    const handleDeleteSection = async (sectionName) => { 
        if(deletingSection) return;
        if(!confirm(`Supprimer la section "${sectionName}" ?\n⚠️ Le contenu sera déplacé dans le dossier GÉNÉRAL.`)) return; 
        setDeletingSection(true);
        try { 
            const res = await fetch('/api/structure/sections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId(), sectionName }) }); 
            if (res.ok) { 
                setActiveSection("GÉNÉRAL");
                if(onRefresh) onRefresh(); 
            } 
        } catch(e) { alert("Erreur réseau."); } 
        setDeletingSection(false);
    };

    const handleCreateChapter = async () => { 
        if (!classFilter) return alert("⚠️ Sélectionnez une classe."); 
        const title = prompt(`Nouveau dossier dans ${activeSection === "GÉNÉRAL" ? "l'Espace Général" : activeSection} ?`); 
        if (!title) return; 
        let isShared = false; 
        if (levelFilter) isShared = confirm(`Partager ce dossier avec tout le niveau ${levelFilter} ?`); 
        await fetch('/api/structure/chapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.toUpperCase(), section: activeSection, classroom: classFilter.toUpperCase(), teacherId: getUserId(), sharedLevel: isShared ? levelFilter : null }) }); 
        if(onRefresh) onRefresh(); 
    };

    const handleRenameChapter = async (chapId, currentTitle) => {
        if (currentTitle === "GÉNÉRAL") return alert("Le dossier système ne peut pas être renommé.");
        const newTitle = prompt("Nouveau nom du dossier :", currentTitle);
        if (!newTitle || newTitle === currentTitle) return;
        try {
            const res = await fetch(`/api/structure/chapters/${chapId}`, { method: 'PATCH', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ title: newTitle.toUpperCase().trim() }) });
            if(res.ok && onRefresh) onRefresh();
        } catch(e) { alert("Erreur renommage"); }
    };

    const isItemVisibleForClass = (item) => { 
        if (!classFilter) return true; 
        if (item.actType === 'scan') return true; 
        const targets = item.targetClassrooms || (item.classroom ? [item.classroom] : []); 
        if (item.actType === 'game' && targets.length === 0) return true; 
        if (targets.some(t => t.toUpperCase() === classFilter.toUpperCase())) return true; 
        return false; 
    };

    const handleDeleteItemWrapper = (id, type) => {
        if (type === 'chapter') { if(!confirm(`Supprimer ce dossier ?\n⚠️ Son contenu sera déplacé dans le dossier GÉNÉRAL.`)) return; }
        onDeleteItem(id, type);
    };

    const activeColorInfo = customSections.find(s => s.name === activeSection);
    const activeColor = activeColorInfo ? activeColorInfo.color : '#64748b'; 

    return (
        <div className="space-y-8 animate-in fade-in relative">
            {showSectionModal && (<div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-slate-900 border-2 border-slate-700 w-full max-w-lg rounded-[30px] p-8 text-center shadow-2xl"><h3 className="text-white font-black text-xl mb-6">NOUVELLE SECTION</h3><input className="bg-slate-800 text-white font-bold text-center text-xl border-b-2 border-indigo-500 outline-none p-4 w-full rounded-xl mb-8" placeholder="NOM" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} autoFocus /><div className="flex flex-col gap-3"><button onClick={() => confirmCreateSection('CLASS')} className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-xs">POUR {classFilter || 'CLASSE'}</button><button onClick={() => confirmCreateSection('LEVEL')} disabled={!levelFilter} className={`w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-xs ${!levelFilter && 'opacity-50'}`}>POUR NIVEAU {levelFilter || '?'}</button><button onClick={() => confirmCreateSection('GLOBAL')} className="w-full bg-slate-700 text-white p-4 rounded-xl font-black text-xs">GLOBAL</button></div><button onClick={() => setShowSectionModal(false)} className="mt-4 text-slate-400 font-bold text-xs hover:text-white">Annuler</button></div></div>)}

            <div className={`p-8 rounded-[45px] border-4 shadow-2xl relative transition-colors duration-500 ${showArchived ? 'bg-amber-950 border-amber-900' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <h3 className="text-white font-black text-[11px] uppercase tracking-[0.3em]">{showArchived ? 'ARCHIVES SECRÈTES' : 'CLOUD CONDAMINE'}</h3>
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black border-2 transition-all ${showArchived ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{showArchived ? '📂 RETOUR ACTIFS' : `📦 VOIR ARCHIVES`}</button>
                    </div>
                    <div className="flex items-center gap-2">
                        {!showArchived && (<button onClick={() => setShowSectionModal(true)} className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase border border-white/10 hover:bg-white/20 transition-all">+ Section</button>)}
                    </div>
                </div>
                
                {customSections.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar p-6 relative z-10 min-h-[140px]">
                        {customSections.map((s, idx) => {
                            const isActive = activeSection === s.name;
                            return (
                                <div key={idx} className="relative shrink-0">
                                    <button onClick={() => setActiveSection(s.name)} className={`min-w-[160px] p-5 rounded-2xl border-2 flex flex-col items-start gap-3 transition-all ${isActive ? 'bg-slate-800 border-white/20 shadow-xl scale-105' : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/60'}`}>
                                        <div className="flex justify-between w-full mb-1">
                                            <span className="font-black text-[11px] uppercase tracking-wider truncate text-left" style={{ color: s.color }}>{s.name}</span>
                                            {s.scope === 'GLOBAL' && <span className="text-[7px] bg-slate-600 text-white px-1 rounded font-bold">ALL</span>}
                                            {s.scope === 'LEVEL' && <span className="text-[7px] bg-indigo-500 text-white px-1 rounded font-bold">N{s.target}</span>}
                                            {s.scope === 'CLASS' && <span className="text-[7px] bg-emerald-500 text-white px-1 rounded font-bold">{s.target}</span>}
                                        </div>
                                        <span className="text-[9px] font-bold text-slate-500 uppercase">Dossiers...</span>
                                    </button>
                                    {!showArchived && (
                                        <div onClick={(e) => { e.stopPropagation(); handleDeleteSection(s.name); }} className="absolute -top-3 -right-2 w-8 h-8 bg-red-500 text-white rounded-full font-black text-xs flex items-center justify-center shadow-lg cursor-pointer border-2 border-slate-900 hover:bg-red-600 hover:scale-110 transition-transform" style={{ zIndex: 9999 }}>✕</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-4 relative z-10">
                        <div className="text-slate-500 font-bold text-[10px] uppercase text-center border border-dashed border-slate-700 rounded-xl p-3">
                            (Affichage Défaut : Espace Général)
                        </div>
                    </div>
                )}
            </div>

            <div className="animate-in slide-in-from-bottom-6">
                <div className="flex flex-wrap justify-between items-end mb-10 px-6 gap-4">
                    <div>
                        <h2 className="text-2xl md:text-5xl font-black uppercase tracking-tighter break-words" style={{ color: activeColor }}>
                            {activeSection === "GÉNÉRAL" ? "ESPACE GÉNÉRAL" : activeSection}
                        </h2>
                    </div>
                    {!showArchived && (
                        <div className="flex items-center gap-3">
                            {/* BOUTONS CRÉATION CONTEXTUELS */}
                            <button onClick={() => onCreateActivity('homework', activeSection)} className="px-6 py-4 rounded-[18px] bg-orange-500 text-white text-[10px] font-black shadow-lg hover:scale-105 transition-all active:scale-95 uppercase tracking-widest">+ DEVOIR</button>
                            <button onClick={() => onCreateActivity('game', activeSection)} className="px-6 py-4 rounded-[18px] bg-purple-600 text-white text-[10px] font-black shadow-lg hover:scale-105 transition-all active:scale-95 uppercase tracking-widest">+ JEU</button>
                            <div className="w-px h-8 bg-slate-300 mx-2"></div>
                            <button onClick={handleCreateChapter} className="px-6 py-4 rounded-[18px] bg-slate-900 text-white text-[10px] font-black shadow-lg hover:scale-105 transition-all active:scale-95 uppercase tracking-widest">+ DOSSIER</button>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {chaptersInActiveSection.length === 0 ? (
                        <div className="text-center p-10 border-4 border-dashed border-slate-200 rounded-[35px] text-slate-400 font-bold uppercase">
                            Aucun dossier ici.
                        </div>
                    ) : (
                        chaptersInActiveSection.map(chap => {
                            const isOpen = openChaps[chap._id];
                            const chapItems = items.filter(it => String(it.chapterId) === String(chap._id) && isItemVisibleForClass(it));
                            const isGeneralChap = chap.title.toUpperCase() === "GÉNÉRAL";
                            const canDelete = chaptersInActiveSection.length > 1;

                            return (
                                <div key={chap._id} className={`border-2 rounded-[35px] overflow-hidden transition-all shadow-sm ${showArchived ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#f1f5f9]'}`} style={{ borderColor: isOpen ? activeColor : undefined }}>
                                    <div className={`p-8 flex justify-between items-center cursor-pointer ${showArchived ? 'bg-amber-50' : 'bg-white'}`} onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                        <div className="flex items-center gap-8">
                                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl transition-transform" style={{ backgroundColor: showArchived ? '#d97706' : activeColor, transform: isOpen ? 'rotate(90deg)' : 'none' }}>{isOpen ? '📂' : '📁'}</div>
                                            <div>
                                                <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tight flex items-center gap-3">
                                                    {chap.title}
                                                    {!showArchived && !isGeneralChap && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRenameChapter(chap._id, chap.title); }} 
                                                            className="w-6 h-6 rounded bg-slate-100 text-slate-400 text-[10px] flex items-center justify-center hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
                                                            title="Renommer le dossier"
                                                        >✎</button>
                                                    )}
                                                </h3>
                                                <div className="flex gap-2 mt-1"><span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-xl uppercase">{chapItems.length} Éléments</span>{chap.sharedLevel && <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-3 py-1 rounded-xl uppercase border border-purple-200">PARTAGÉ {chap.sharedLevel}</span>}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={(e) => { e.stopPropagation(); fetch(`/api/structure/chapters/${chap._id}/archive`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({isArchived:!chap.isArchived})}).then(onRefresh); }} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center hover:bg-amber-100 transition-colors">{chap.isArchived ? '📤' : '📦'}</button>
                                            {!isGeneralChap && canDelete && (
                                                <button onClick={(e) => { e.stopPropagation(); handleDeleteItemWrapper(chap._id, 'chapter'); }} className="w-12 h-12 rounded-2xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-inner">✕</button>
                                            )}
                                        </div>
                                    </div>
                                    {isOpen && (<div className="bg-slate-50/50 border-t p-8 space-y-4">{chapItems.length > 0 ? chapItems.map(it => (<div key={it._id} className="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 hover:shadow-xl transition-all"><div className="flex items-center gap-5"><span className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-[0.2em] text-white ${it.actType === 'game' ? 'bg-purple-600' : 'bg-orange-500'}`}>{it.typeLabel || 'ACT'}</span><div className="flex flex-col items-start"><span className="font-black text-slate-700 uppercase">{it.title}</span></div></div><div className="flex gap-4"><button onClick={() => onEditItem(it)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase">Modifier</button><button onClick={() => onDeleteItem(it._id, it.actType)} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-500 text-[10px] font-black">✕</button></div></div>)) : <div className="text-center text-slate-400 text-xs italic py-4">Dossier vide.</div>}</div>)}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
}