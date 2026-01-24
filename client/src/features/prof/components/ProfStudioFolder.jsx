import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, classFilter, levelFilter, user, onEditItem, onDeleteItem, onRefresh, studentsRef }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState('GÉNÉRAL'); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    const [loading, setLoading] = useState(true);
    
    // MODALE
    const [showSectionModal, setShowSectionModal] = useState(false);
    const [newSectionName, setNewSectionName] = useState("");

    const getUserId = () => {
        if (!user) return null;
        const id = user.id || user._id;
        if (!id || id === 'undefined') return null;
        return id;
    };

    useEffect(() => {
        const fetchSections = async () => {
            const uid = getUserId();
            if (!uid) { setLoading(false); return; }
            try {
                const res = await fetch(`/api/structure/sections/${uid}?_t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data)) setCustomSections(data);
                }
            } catch(e) { /* Silence */ }
            setLoading(false);
        };
        fetchSections();
    }, [user]);

    const formatSimpleName = (first, last) => {
        const f = (first || "").split(' ')[0];
        const l = (last || "").split(' ')[0];
        return `${f} ${l}`;
    };

    const allChapters = chapters || [];
    const uid = String(getUserId());
    const isJean = (user && user.firstName === 'Jean' && user.lastName === 'Vuillet');
    const myChapters = isJean ? allChapters : allChapters.filter(c => String(c.teacherId) === uid);

    const currentLevel = levelFilter ? String(levelFilter).toUpperCase().trim() : (classFilter ? (classFilter.match(/^(\d+|[A-Z]+)/) || [])[0] : null);

    const contextChapters = myChapters.filter(c => {
        const cClass = (c.classroom || "").toUpperCase();
        const fClass = (classFilter || "").toUpperCase();
        
        let isCorrectClass = cClass === fClass;
        if (!isCorrectClass && c.sharedLevel && currentLevel && String(c.sharedLevel) === String(currentLevel)) isCorrectClass = true;
        if (!classFilter) isCorrectClass = true;

        return isCorrectClass;
    });

    const visibleSections = customSections.filter(s => {
        if (!s.scope || s.scope === 'GLOBAL') return true;
        if (!classFilter) return true;
        const targetStr = String(s.target || "").toUpperCase().trim();
        const classStr = String(classFilter || "").toUpperCase().trim();
        if (s.scope === 'LEVEL') return currentLevel && targetStr === currentLevel;
        if (s.scope === 'CLASS') return targetStr === classStr;
        return false;
    });

    const displaySections = visibleSections.length > 0 ? visibleSections : [{ name: 'GÉNÉRAL', color: '#64748b', isVirtual: true }];
    const activeColorInfo = displaySections.find(s => s.name === activeSection);
    const activeColor = activeColorInfo ? activeColorInfo.color : '#64748b';

    const displayedChapters = contextChapters.filter(c => {
        const isCorrectSection = (c.section || "GÉNÉRAL").toUpperCase() === activeSection.toUpperCase();
        const isCorrectStatus = !!c.isArchived === showArchived;
        return isCorrectSection && isCorrectStatus;
    });

    const confirmCreateSection = async (scope) => { if (!newSectionName) return; let target = null; if (scope === 'LEVEL') target = currentLevel; if (scope === 'CLASS') target = classFilter; try { const res = await fetch('/api/structure/sections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId(), sectionName: newSectionName.toUpperCase().trim(), scope, target }) }); if (res.status === 409) { const err = await res.json(); return alert("⚠️ " + err.error); } if (res.ok) { const newList = await res.json(); setCustomSections(newList); setActiveSection(newSectionName.toUpperCase().trim()); setShowSectionModal(false); setNewSectionName(""); if(onRefresh) onRefresh(); } } catch (e) { alert("Erreur réseau."); } };
    const handleDeleteSection = async (sectionName) => { if(!confirm(`Supprimer la section "${sectionName}" ?`)) return; try { const res = await fetch('/api/structure/sections', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId(), sectionName }) }); if (res.ok) { const newList = await res.json(); setCustomSections(newList); if(activeSection === sectionName) setActiveSection('GÉNÉRAL'); if(onRefresh) onRefresh(); } } catch(e) { alert("Erreur réseau."); } };
    const handleReset = async () => { if(!confirm("⚠️ R.A.Z : Tout effacer et remettre 'GÉNÉRAL' ?")) return; try { const res = await fetch('/api/structure/sections/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: getUserId() }) }); if(res.ok) { const newList = await res.json(); setCustomSections(newList); setActiveSection('GÉNÉRAL'); if(onRefresh) onRefresh(); } } catch(e) { alert("Erreur Reset."); } };
    const handleCreateChapter = async () => { if (!classFilter) return alert("⚠️ Sélectionnez une classe."); const title = prompt(`Nouveau dossier dans ${activeSection} ?`); if (!title) return; let isShared = false; if (currentLevel) isShared = confirm(`Partager ce dossier avec tout le niveau ${currentLevel} ?`); await fetch('/api/structure/chapters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: title.toUpperCase(), section: activeSection, classroom: classFilter.toUpperCase(), teacherId: getUserId(), sharedLevel: isShared ? currentLevel : null }) }); if(onRefresh) onRefresh(); };

    // --- LOGIQUE VISIBILITÉ ---
    const isItemVisibleForClass = (item) => {
        if (!classFilter) return true;
        // Scan : pas de filtre classe explicite, on affiche tout ce qui est dans le dossier
        if (item.actType === 'scan') return true; 

        const targets = item.targetClassrooms || (item.classroom ? [item.classroom] : []);
        if (item.actType === 'game' && targets.length === 0) return true;
        if (targets.some(t => t.toUpperCase() === classFilter.toUpperCase())) return true;
        return false;
    };

    return (
        <div className="space-y-8 animate-in fade-in relative">
            {showSectionModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-slate-900 border-2 border-slate-700 w-full max-w-lg rounded-[30px] p-8 text-center shadow-2xl">
                        <h3 className="text-white font-black text-xl mb-6">NOUVELLE SECTION</h3>
                        <input className="bg-slate-800 text-white font-bold text-center text-xl border-b-2 border-indigo-500 outline-none p-4 w-full rounded-xl mb-8" placeholder="NOM" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} autoFocus />
                        <div className="flex flex-col gap-3">
                            <button onClick={() => confirmCreateSection('CLASS')} className="w-full bg-emerald-600 text-white p-4 rounded-xl font-black text-xs">POUR {classFilter || 'CLASSE'}</button>
                            <button onClick={() => confirmCreateSection('LEVEL')} disabled={!currentLevel} className={`w-full bg-indigo-600 text-white p-4 rounded-xl font-black text-xs ${!currentLevel && 'opacity-50'}`}>POUR NIVEAU {currentLevel || '?'}</button>
                            <button onClick={() => confirmCreateSection('GLOBAL')} className="w-full bg-slate-700 text-white p-4 rounded-xl font-black text-xs">GLOBAL</button>
                        </div>
                        <button onClick={() => setShowSectionModal(false)} className="mt-4 text-slate-400 font-bold text-xs hover:text-white">Annuler</button>
                    </div>
                </div>
            )}

            <div className={`p-8 rounded-[45px] border-4 shadow-2xl relative transition-colors duration-500 ${showArchived ? 'bg-amber-950 border-amber-900' : 'bg-slate-900 border-slate-800'}`}>
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <h3 className="text-white font-black text-[11px] uppercase tracking-[0.3em]">{showArchived ? 'ARCHIVES SECRÈTES' : 'CLOUD CONDAMINE'}</h3>
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black border-2 transition-all ${showArchived ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_20px_rgba(245,158,11,0.5)]' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{showArchived ? '📂 RETOUR ACTIFS' : `📦 VOIR ARCHIVES`}</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px]">STUDIO V214</div>
                        {!showArchived && (<><button onClick={handleReset} className="bg-red-900/50 text-red-400 px-3 py-2 rounded-xl font-black text-[9px] hover:bg-red-900 border border-red-900/50">R.A.Z</button><button onClick={() => setShowSectionModal(true)} className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase border border-white/10 hover:bg-white/20 transition-all">+ Section</button></>)}
                    </div>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pt-6 pb-4 relative z-10">
                    {loading ? <span className="text-white font-black animate-pulse text-xs">CHARGEMENT...</span> : displaySections.map((s, idx) => {
                        const count = contextChapters.filter(c => { const matchSection = (c.section || "GÉNÉRAL").toUpperCase() === s.name; const matchStatus = !!c.isArchived === showArchived; return matchSection && matchStatus; }).length;
                        return (<div key={idx} className="relative shrink-0"><button onClick={() => setActiveSection(s.name)} className={`min-w-[160px] p-5 rounded-2xl border-2 flex flex-col items-start gap-3 transition-all ${activeSection === s.name ? 'bg-slate-800 border-white/20 shadow-xl scale-105' : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/60'}`}><div className="flex justify-between w-full mb-1"><span className="font-black text-[11px] uppercase tracking-wider truncate text-left" style={{ color: s.color }}>{s.name}</span>{s.scope === 'GLOBAL' && <span className="text-[7px] bg-slate-600 text-white px-1 rounded font-bold">ALL</span>}{s.scope === 'LEVEL' && <span className="text-[7px] bg-indigo-500 text-white px-1 rounded font-bold">N{s.target}</span>}</div><span className={`text-[9px] font-bold uppercase ${count > 0 ? 'text-white' : 'text-slate-600'}`}>{count} Dossiers</span></button>{displaySections.length >= 2 && !s.isVirtual && (<div onClick={(e) => { e.stopPropagation(); handleDeleteSection(s.name); }} className="absolute -top-3 -right-2 w-8 h-8 bg-red-500 text-white rounded-full font-black text-xs flex items-center justify-center shadow-lg cursor-pointer border-2 border-slate-900 hover:bg-red-600 hover:scale-110 transition-transform" style={{ zIndex: 9999 }}>✕</div>)}</div>);
                    })}
                </div>
            </div>

            <div className="animate-in slide-in-from-bottom-6">
                <div className="flex justify-between items-end mb-10 px-6">
                    <div><h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>{activeSection}</h2><p className="text-[11px] font-black text-slate-400 tracking-[0.2em] uppercase mt-2">{displayedChapters.length} Dossiers {showArchived ? 'ARCHIVÉS' : 'ACTIFS'}</p></div>
                    {!showArchived && <button onClick={handleCreateChapter} className="px-10 py-5 rounded-[22px] text-white text-[12px] font-black shadow-2xl hover:scale-105 transition-all active:scale-95 uppercase tracking-widest" style={{ backgroundColor: activeColor }}>+ NOUVEAU DOSSIER</button>}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {displayedChapters.map(chap => {
                        const isOpen = openChaps[chap._id];
                        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id) && isItemVisibleForClass(it));
                        
                        return (
                            <div key={chap._id} className={`border-2 rounded-[35px] overflow-hidden transition-all shadow-sm ${showArchived ? 'bg-amber-50 border-amber-200' : 'bg-white border-[#f1f5f9]'}`} style={{ borderColor: isOpen ? activeColor : undefined }}>
                                <div className={`p-8 flex justify-between items-center cursor-pointer ${showArchived ? 'bg-amber-50' : 'bg-white'}`} onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                    <div className="flex items-center gap-8">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl transition-transform" style={{ backgroundColor: showArchived ? '#d97706' : activeColor, transform: isOpen ? 'rotate(90deg)' : 'none' }}>{isOpen ? '📂' : '📁'}</div>
                                        <div><h3 className="font-black text-slate-800 text-2xl uppercase tracking-tight">{chap.title}</h3><div className="flex gap-2 mt-1"><span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-xl uppercase">{chapItems.length} Éléments</span>{chap.sharedLevel && <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-3 py-1 rounded-xl uppercase border border-purple-200">PARTAGÉ {chap.sharedLevel}</span>}</div></div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={(e) => { e.stopPropagation(); fetch(`/api/structure/chapters/${chap._id}/archive`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({isArchived:!chap.isArchived})}).then(onRefresh); }} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center hover:bg-amber-100 transition-colors">{chap.isArchived ? '📤' : '📦'}</button>
                                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Supprimer ?')) onDeleteItem(chap._id, 'chapter'); }} className="w-12 h-12 rounded-2xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-inner">✕</button>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="bg-slate-50/50 border-t p-8 space-y-4">
                                        {chapItems.length > 0 ? chapItems.map(it => {
                                            
                                            // --- GESTION AFFICHAGE SELON TYPE (DC vs DM/JEU) ---
                                            let subTitle = "Chargement...";
                                            let subtitleColor = "text-slate-400";
                                            let badgeColor = it.actType === 'game' ? 'bg-purple-600' : (it.actType === 'scan' ? 'bg-teal-500' : 'bg-orange-500');

                                            if (it.actType === 'scan') {
                                                // --- SPÉCIAL SCAN : Affichage du nombre de copies ---
                                                const copyCount = (it.copyUrls || []).length;
                                                subTitle = `${copyCount} COPIES SCANNÉES`;
                                                subtitleColor = "text-teal-600";
                                            } else {
                                                // --- DM / JEU : Affichage des cibles ---
                                                const targets = (it.targetClassrooms && it.targetClassrooms.length > 0) ? it.targetClassrooms : (it.classroom ? [it.classroom] : []);
                                                const assignedIds = it.assignedStudents || [];

                                                if (targets.length === 0) {
                                                    subTitle = (it.actType === 'game') ? "🎮 JEU OUVERT (LEGACY)" : "⚠️ AUCUNE CIBLE";
                                                } else {
                                                    const totalPerClass = {};
                                                    if (studentsRef) { studentsRef.forEach(s => { const c = s.currentClass; if(c) totalPerClass[c] = (totalPerClass[c] || 0) + 1; }); }
                                                    const assignedByClass = {};
                                                    if (studentsRef && assignedIds.length > 0) { studentsRef.forEach(s => { if (assignedIds.some(id => String(id) === String(s._id))) { const c = s.currentClass; if (!assignedByClass[c]) assignedByClass[c] = []; assignedByClass[c].push(formatSimpleName(s.firstName, s.lastName)); } }); }

                                                    const parts = [];
                                                    targets.forEach(cls => {
                                                        const assignedCount = (assignedByClass[cls] || []).length;
                                                        const totalCount = totalPerClass[cls] || 0;
                                                        const isGameLegacyFull = (it.actType === 'game' && assignedIds.length === 0);

                                                        if (it.isAllClass === true || isGameLegacyFull) { parts.push(cls); } 
                                                        else if (totalCount > 0 && assignedCount >= totalCount) { parts.push(cls); } 
                                                        else if (assignedCount > 0) { parts.push(`${cls}: ${assignedByClass[cls].join(', ')}`); } 
                                                        else { parts.push(`${cls} (0)`); }
                                                    });

                                                    if (parts.length > 0) { subTitle = `👤 ${parts.join(' | ')}`; subtitleColor = "text-indigo-500"; } 
                                                    else { subTitle = "⚠️ AUCUN ÉLÈVE"; }
                                                }
                                            }

                                            return (
                                                <div key={it._id} className="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                                                    <div className="flex items-center gap-5">
                                                        <span className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-[0.2em] text-white ${badgeColor}`}>{it.typeLabel || 'ACT'}</span>
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-black text-slate-700 uppercase">{it.title}</span>
                                                            <span className={`text-[9px] font-bold uppercase mt-0.5 ${subtitleColor}`}>{subTitle}</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <button onClick={() => onEditItem(it)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase">Modifier</button>
                                                        <button onClick={() => onDeleteItem(it._id, it.actType)} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-500 text-[10px] font-black">✕</button>
                                                    </div>
                                                </div>
                                            );
                                        }) : <div className="text-center text-slate-400 text-xs italic py-4">Dossier vide.</div>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {displayedChapters.length === 0 && <div className="p-20 text-center border-4 border-dashed border-slate-100 rounded-[40px]"><p className="font-black text-slate-300 text-xl uppercase">Aucun dossier {showArchived ? 'archivé' : 'actif'}</p><p className="text-xs font-bold text-slate-400 mt-2">dans la section {activeSection}</p></div>}
                </div>
            </div>
        </div>
    );
}