import React, { useState, useEffect } from 'react';

/**
 * 📂 PROF STUDIO FOLDER - VERSION 144 (LOGIQUE PURE)
 * Amélioration : Utilise le niveau certifié par la BDD (levelFilter) 
 * au lieu de le deviner à partir du nom de la classe.
 */
export default function ProfStudioFolder({ items, chapters, classFilter, levelFilter, user, onEditItem, onDeleteItem, onRefresh }) {
    const [customSections, setCustomSections] = useState([]);
    const [activeSection, setActiveSection] = useState('GÉNÉRAL'); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 
    const [loading, setLoading] = useState(true);
    
    // MODALE
    const [showCreateModal, setShowCreateModal] = useState(false);
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
                    if (Array.isArray(data)) {
                        setCustomSections(data);
                        const exists = data.some(s => s.name === activeSection) || activeSection === 'GÉNÉRAL';
                        if (!exists) setActiveSection(data.length > 0 ? data[0].name : 'GÉNÉRAL');
                    }
                }
            } catch(e) { /* Silence */ }
            setLoading(false);
        };
        fetchSections();
    }, [user, activeSection]);

    // --- CŒUR DE LA LOGIQUE V144 ---
    // On utilise le niveau envoyé par la BDD (via ProfPage -> ActivityStudio -> ici)
    // Si pas de niveau BDD (ex: ancienne classe), on fallback sur la regex, mais c'est rare.
    const currentLevel = levelFilter 
        ? String(levelFilter).toUpperCase().trim() 
        : (classFilter ? (classFilter.match(/^(\d+|[A-Z]+)/) || [])[0] : null);

    const visibleSections = customSections.filter(s => {
        if (!s.scope || s.scope === 'GLOBAL') return true;
        if (!classFilter) return true; // Vue globale prof = on voit tout

        const targetStr = String(s.target || "").toUpperCase().trim();
        const classStr = String(classFilter || "").toUpperCase().trim();

        if (s.scope === 'LEVEL') return currentLevel && targetStr === currentLevel;
        if (s.scope === 'CLASS') return targetStr === classStr;

        return false;
    });

    const displaySections = visibleSections.length > 0 
        ? visibleSections 
        : [{ name: 'GÉNÉRAL', color: '#64748b', isVirtual: true }];

    // --- ACTIONS ---
    const confirmCreateSection = async (scope) => {
        if (!newSectionName) return alert("Nom vide !");
        
        let target = null;
        if (scope === 'LEVEL') target = currentLevel;
        if (scope === 'CLASS') target = classFilter;

        if ((scope === 'LEVEL' || scope === 'CLASS') && !target) {
            return alert(`Impossible de déterminer le contexte. Niveau: ${currentLevel}, Classe: ${classFilter}`);
        }

        try {
            const res = await fetch('/api/structure/sections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    teacherId: getUserId(), 
                    sectionName: newSectionName.toUpperCase().trim(),
                    scope,
                    target
                })
            });
            if (res.ok) {
                const newList = await res.json();
                setCustomSections(newList);
                setActiveSection(newSectionName.toUpperCase().trim());
                setShowCreateModal(false);
                setNewSectionName("");
                if(onRefresh) onRefresh();
            } else { alert("Erreur serveur."); }
        } catch (e) { alert("Erreur réseau."); }
    };

    const handleDeleteSection = async (sectionName) => {
        if(!confirm(`Supprimer définitivement la section "${sectionName}" ?`)) return;
        const uid = getUserId();
        try {
            const res = await fetch('/api/structure/sections', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId: uid, sectionName })
            });
            if (res.ok) {
                const newList = await res.json();
                setCustomSections(newList);
                if(activeSection === sectionName) setActiveSection('GÉNÉRAL');
                if(onRefresh) onRefresh();
            } else {
                const err = await res.json();
                alert(err.error || "Erreur suppression");
            }
        } catch(e) { alert("Erreur réseau."); }
    };

    const handleReset = async () => {
        if(!confirm("⚠️ R.A.Z : Tout effacer et remettre 'GÉNÉRAL' ?")) return;
        const uid = getUserId();
        try {
            const res = await fetch('/api/structure/sections/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: uid }) });
            if(res.ok) { const newList = await res.json(); setCustomSections(newList); setActiveSection('GÉNÉRAL'); if(onRefresh) onRefresh(); }
        } catch(e) { alert("Erreur Reset."); }
    };

    const handleCreateChapter = async () => {
        if (!classFilter) return alert("⚠️ Sélectionnez une classe.");
        const title = prompt(`Nouveau dossier dans ${activeSection} ?`);
        if (!title) return;
        const uid = getUserId();

        let isShared = false;
        if (currentLevel) {
            isShared = confirm(`Partager ce dossier avec tout le niveau ${currentLevel} ?\n(Visible pour toutes les classes du niveau ${currentLevel})`);
        }

        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: title.toUpperCase(), 
                section: activeSection, 
                classroom: classFilter.toUpperCase(), 
                teacherId: uid,
                sharedLevel: isShared ? currentLevel : null
            })
        });
        if(onRefresh) onRefresh();
    };

    const allChapters = chapters || [];
    const uid = String(getUserId());
    const isJean = (user && user.firstName === 'Jean' && user.lastName === 'Vuillet');
    const myChapters = isJean ? allChapters : allChapters.filter(c => String(c.teacherId) === uid);

    const filtered = myChapters.filter(c => {
        const cClass = (c.classroom || "").toUpperCase();
        const fClass = (classFilter || "").toUpperCase();
        
        // 1. Classe Exacte
        let isCorrectClass = cClass === fClass;
        
        // 2. Niveau Partagé (V144 : Utilise le niveau BDD)
        if (!isCorrectClass && c.sharedLevel && currentLevel) {
            if (String(c.sharedLevel) === String(currentLevel)) isCorrectClass = true;
        }
        
        if (!classFilter) isCorrectClass = true;

        const isCorrectSection = (c.section || "GÉNÉRAL").toUpperCase() === activeSection.toUpperCase();
        const isCorrectStatus = !!c.isArchived === showArchived;
        return isCorrectClass && isCorrectSection && isCorrectStatus;
    });

    const activeColorInfo = displaySections.find(s => s.name === activeSection);
    const activeColor = activeColorInfo ? activeColorInfo.color : '#64748b';

    return (
        <div className="space-y-8 animate-in fade-in relative">
            
            {/* MODALE CRÉATION */}
            {showCreateModal && (
                <div className="absolute inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm rounded-[45px] flex flex-col items-center justify-center p-8 text-center animate-in zoom-in duration-200">
                    <h3 className="text-white font-black text-xl mb-6">NOUVELLE SECTION</h3>
                    <input className="bg-white/10 text-white font-black text-center text-2xl border-b-2 border-indigo-500 outline-none pb-2 w-full max-w-md mb-8 placeholder:text-white/20"
                        placeholder="NOM" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} autoFocus />
                    <div className="flex flex-wrap gap-4 justify-center w-full">
                        <button onClick={() => confirmCreateSection('CLASS')} className="flex-1 bg-emerald-500 text-white p-4 rounded-xl font-black text-[10px] hover:scale-105 transition-all shadow-lg uppercase">
                            POUR {classFilter || 'CLASSE'}
                        </button>
                        <button onClick={() => confirmCreateSection('LEVEL')} disabled={!currentLevel} className={`flex-1 bg-indigo-500 text-white p-4 rounded-xl font-black text-[10px] hover:scale-105 transition-all shadow-lg uppercase ${!currentLevel && 'opacity-50'}`}>
                            POUR NIVEAU {currentLevel || '?'}
                        </button>
                        <button onClick={() => confirmCreateSection('GLOBAL')} className="flex-1 bg-slate-700 text-white p-4 rounded-xl font-black text-[10px] hover:scale-105 transition-all shadow-lg uppercase">
                            GLOBAL
                        </button>
                    </div>
                    <button onClick={() => setShowCreateModal(false)} className="mt-8 text-slate-400 font-bold text-xs hover:text-white underline">Annuler</button>
                </div>
            )}

            <div className="p-8 bg-slate-900 rounded-[45px] border-4 border-slate-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-6 relative z-10">
                    <div className="flex items-center gap-6">
                        <h3 className="text-white font-black text-[11px] uppercase tracking-[0.3em]">Cloud Condamine</h3>
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black border-2 transition-all ${showArchived ? 'bg-amber-500 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>{showArchived ? '📦 ARCHIVES' : `VOIR ARCHIVES`}</button>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px]">STUDIO V144</div>
                        <button onClick={handleReset} className="bg-red-900/50 text-red-400 px-3 py-2 rounded-xl font-black text-[9px] hover:bg-red-900 border border-red-900/50">R.A.Z</button>
                        <button onClick={() => setShowCreateModal(true)} className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase border border-white/10 hover:bg-white/20 transition-all">+ Section</button>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar pt-6 pb-4 relative z-10">
                    {loading ? <span className="text-white font-black animate-pulse text-xs">CHARGEMENT...</span> : displaySections.map((s, idx) => (
                        <div key={idx} className="relative shrink-0">
                            <button onClick={() => {setActiveSection(s.name); setShowArchived(false);}}
                                className={`min-w-[160px] p-5 rounded-2xl border-2 flex flex-col items-start gap-3 transition-all ${activeSection === s.name ? 'bg-slate-800 border-white/20 shadow-xl scale-105' : 'bg-slate-800/40 border-slate-800 hover:bg-slate-800/60'}`}
                            >
                                <div className="flex justify-between w-full mb-1">
                                    <span className="font-black text-[11px] uppercase tracking-wider truncate text-left" style={{ color: s.color }}>{s.name}</span>
                                    {s.scope === 'GLOBAL' && <span className="text-[7px] bg-slate-600 text-white px-1 rounded font-bold">ALL</span>}
                                    {s.scope === 'LEVEL' && <span className="text-[7px] bg-indigo-500 text-white px-1 rounded font-bold">N{s.target}</span>}
                                    {s.scope === 'CLASS' && <span className="text-[7px] bg-emerald-500 text-white px-1 rounded font-bold">{s.target}</span>}
                                </div>
                                <span className="text-[9px] font-bold text-slate-500 uppercase">
                                    {filtered.filter(c => (c.section || "GÉNÉRAL").toUpperCase() === s.name).length} Dossiers
                                </span>
                            </button>
                            {displaySections.length >= 2 && !s.isVirtual && (
                                <div onClick={(e) => { e.stopPropagation(); handleDeleteSection(s.name); }}
                                    className="absolute -top-3 -right-2 w-8 h-8 bg-red-500 text-white rounded-full font-black text-xs flex items-center justify-center shadow-lg cursor-pointer border-2 border-slate-900 hover:bg-red-600 hover:scale-110 transition-transform" style={{ zIndex: 9999 }} title="Supprimer">✕</div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* CHAPITRES */}
            <div className="animate-in slide-in-from-bottom-6">
                <div className="flex justify-between items-end mb-10 px-6">
                    <div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>{activeSection}</h2>
                        <p className="text-[11px] font-black text-slate-400 tracking-[0.2em] uppercase mt-2">{filtered.length} Chapitres actifs en {classFilter || 'Vue Globale'}</p>
                    </div>
                    {!showArchived && (
                        <button onClick={handleCreateChapter} className="px-10 py-5 rounded-[22px] text-white text-[12px] font-black shadow-2xl hover:scale-105 transition-all active:scale-95 uppercase tracking-widest" style={{ backgroundColor: activeColor }}>+ NOUVEAU DOSSIER</button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6">
                    {filtered.map(chap => {
                        const isOpen = openChaps[chap._id];
                        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
                        return (
                            <div key={chap._id} className="bg-white border-2 rounded-[35px] overflow-hidden transition-all shadow-sm" style={{ borderColor: isOpen ? activeColor : '#f1f5f9' }}>
                                <div className="p-8 flex justify-between items-center cursor-pointer bg-white" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                    <div className="flex items-center gap-8">
                                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl transition-transform" style={{ backgroundColor: activeColor, transform: isOpen ? 'rotate(90deg)' : 'none' }}>{isOpen ? '📂' : '📁'}</div>
                                        <div>
                                            <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tight">{chap.title}</h3>
                                            <div className="flex gap-2 mt-1">
                                                <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-xl uppercase">{chapItems.length} Éléments</span>
                                                {chap.sharedLevel && <span className="text-[10px] font-black bg-purple-100 text-purple-600 px-3 py-1 rounded-xl uppercase border border-purple-200">PARTAGÉ {chap.sharedLevel}</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button onClick={(e) => { e.stopPropagation(); fetch(`/api/structure/chapters/${chap._id}/archive`, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({isArchived:!chap.isArchived})}).then(onRefresh); }} className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center hover:bg-amber-100">{chap.isArchived ? '📤' : '📦'}</button>
                                        <button onClick={(e) => { e.stopPropagation(); if(confirm('Supprimer ?')) onDeleteItem(chap._id, 'chapter'); }} className="w-12 h-12 rounded-2xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-inner">✕</button>
                                    </div>
                                </div>
                                {isOpen && (
                                    <div className="bg-slate-50/50 border-t p-8 space-y-4">
                                        {chapItems.map(it => (
                                            <div key={it._id} className="bg-white p-5 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 hover:shadow-xl transition-all">
                                                <div className="flex items-center gap-5">
                                                    <span className={`text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-[0.2em] ${it.actType === 'game' ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white'}`}>{it.typeLabel || 'ACT'}</span>
                                                    <span className="font-black text-slate-700 uppercase">{it.title}</span>
                                                </div>
                                                <div className="flex gap-4">
                                                    <button onClick={() => onEditItem(it)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase">Modifier</button>
                                                    <button onClick={() => onDeleteItem(it._id, it.actType)} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-500 text-[10px] font-black">✕</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    {filtered.length === 0 && (
                        <div className="p-20 text-center border-4 border-dashed border-slate-100 rounded-[40px]">
                            <p className="font-black text-slate-300 text-xl uppercase">Dossier vide</p>
                            <p className="text-xs font-bold text-slate-400 mt-2">Créez un dossier pour commencer</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}