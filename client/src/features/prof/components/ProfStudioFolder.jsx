import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ items, chapters, classFilter, user, onEditItem, onDeleteItem, onRefresh }) {
    const [sections, setSections] = useState(user?.subjectSections || []);
    const [activeSection, setActiveSection] = useState(null); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 

    useEffect(() => {
        if (sections.length > 0 && !activeSection) {
            setActiveSection(sections[0].name.toUpperCase());
        }
    }, [sections]);

    // --- ACTIONS ---
    const handleAddSection = async () => {
        const name = prompt("Nom de la nouvelle section (ex: Géographie, Projets...) ?");
        if (!name) return;
        const normalized = name.toUpperCase().trim();
        const res = await fetch('/api/structure/sections', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: user.id || user._id, sectionName: normalized })
        });
        if (res.ok) {
            const newSecs = await res.json();
            setSections(newSecs);
            setActiveSection(normalized);
            const local = JSON.parse(localStorage.getItem('player'));
            localStorage.setItem('player', JSON.stringify({...local, subjectSections: newSecs}));
        }
    };

    const handleDeleteSection = async (name, e) => {
        e.stopPropagation();
        if(!confirm(`Supprimer la section "${name}" ?`)) return;
        const id = user.id || user._id;
        await fetch(`/api/structure/sections/${id}/${name}`, { method: 'DELETE' });
        setSections(sections.filter(s => s.name !== name));
        if(activeSection === name) setActiveSection(null);
    };

    const handleCreateChapter = async () => {
        if (!activeSection) return alert("Sélectionnez d'abord une section !");
        const title = prompt(`Nouveau chapitre dans "${activeSection}" ?`);
        if (!title) return;
        
        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                title: title.toUpperCase(), 
                section: activeSection, 
                classroom: classFilter ? classFilter.toUpperCase() : "", 
                teacherId: user.id || user._id 
            })
        });
        onRefresh();
    };

    const toggleArchive = async (chapId, currentState) => {
        await fetch(`/api/structure/chapters/${chapId}/archive`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived: !currentState })
        });
        onRefresh();
    };

    const deleteChapter = async (chapId) => {
        if(!confirm("Supprimer ce chapitre et tout son contenu ?")) return;
        await fetch(`/api/structure/chapters/${chapId}`, { method: 'DELETE' });
        onRefresh();
    };

    // --- LOGIQUE FILTRAGE ---
    const filterByClass = (list) => {
        if (!classFilter) return list;
        const f = classFilter.toUpperCase().trim();
        return list.filter(c => !(c.classroom) || c.classroom.toUpperCase().trim() === f);
    };

    const allRelevant = filterByClass(chapters);
    const archivedChapters = allRelevant.filter(c => c.isArchived === true);
    const activeChaptersInCurrentSection = allRelevant.filter(c => 
        !c.isArchived && (c.section || "GÉNÉRAL").toUpperCase() === (activeSection || "GÉNÉRAL").toUpperCase()
    );

    const activeColor = sections.find(s => s.name.toUpperCase() === activeSection)?.color || '#64748b';

    return (
        <div className="space-y-8 animate-in fade-in">
            
            {/* 1. TABLEAU NOIR (GESTIONNAIRE & MATRICE ARCHIVES) */}
            <div className="p-8 bg-slate-900 rounded-[45px] border-4 border-slate-800 shadow-2xl relative">
                
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <h3 className="text-white font-black text-[11px] uppercase tracking-[0.3em]">
                                Cloud Drive Condamine
                            </h3>
                            <span className="text-slate-500 text-[9px] font-bold uppercase mt-1">Matrice de dossiers</span>
                        </div>
                        
                        <button 
                            onClick={() => setShowArchived(!showArchived)} 
                            className={`px-5 py-2.5 rounded-2xl text-[10px] font-black transition-all border-2 flex items-center gap-2 ${showArchived ? 'bg-amber-500 border-amber-400 text-white shadow-[0_0_25px_rgba(245,158,11,0.4)]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'}`}
                        >
                            <span>{showArchived ? '📦' : '📂'}</span>
                            {showArchived ? 'MODE ARCHIVES' : `VOIR ARCHIVES (${archivedChapters.length})`}
                        </button>
                    </div>

                    {!showArchived && (
                        <button onClick={handleAddSection} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] hover:bg-indigo-500 shadow-xl transition-all uppercase tracking-widest">
                            + Nouvelle Section
                        </button>
                    )}
                </div>

                {/* --- AFFICHAGE --- */}
                {!showArchived ? (
                    <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                        {sections.map((s, idx) => (
                            <button 
                                key={idx} 
                                onClick={() => setActiveSection(s.name.toUpperCase())}
                                className={`group min-w-[200px] p-6 rounded-[28px] border-2 flex flex-col items-start gap-3 transition-all ${activeSection === s.name.toUpperCase() ? 'bg-slate-800 border-white/20 shadow-2xl scale-105' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'}`}
                            >
                                <div className="w-full flex justify-between items-center">
                                    <span className="font-black text-[12px] uppercase tracking-wider" style={{ color: s.color }}>{s.name}</span>
                                    <span onClick={(e) => handleDeleteSection(s.name, e)} className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-500 font-bold transition-all">✕</span>
                                </div>
                                <div className="text-[10px] font-black text-slate-500 uppercase">
                                    {allRelevant.filter(c => !c.isArchived && (c.section || "GÉNÉRAL").toUpperCase() === s.name.toUpperCase()).length} Dossiers
                                </div>
                            </button>
                        ))}
                    </div>
                ) : (
                    /* MATRICE DES ARCHIVES PAR COLONNES */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in zoom-in duration-300">
                        {sections.map((s, idx) => {
                            const sectionArchives = archivedChapters.filter(c => (c.section || "GÉNÉRAL").toUpperCase() === s.name.toUpperCase());
                            return (
                                <div key={idx} className="flex flex-col bg-slate-900/50 rounded-3xl border-2 border-slate-800 p-6 min-h-[200px] transition-all hover:border-slate-700">
                                    <div className="flex items-center gap-3 mb-5 pb-3 border-b border-slate-800">
                                        <div className="w-2 h-6 rounded-full" style={{ background: s.color }}></div>
                                        <h4 className="font-black text-[11px] uppercase text-white tracking-widest">{s.name}</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {sectionArchives.map(chap => (
                                            <div key={chap._id} className="group bg-slate-800/80 p-4 rounded-2xl border border-slate-700/50 flex justify-between items-center hover:bg-slate-800 hover:border-amber-500/50 transition-all">
                                                <span className="text-slate-300 font-bold text-[10px] truncate pr-2 uppercase">{chap.title}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => toggleArchive(chap._id, true)} className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-sm">📤</button>
                                                    <button onClick={() => deleteChapter(chap._id)} className="w-8 h-8 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm">✕</button>
                                                </div>
                                            </div>
                                        ))}
                                        {sectionArchives.length === 0 && <span className="text-slate-700 text-[9px] font-black uppercase text-center mt-4">Aucun archivé</span>}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 2. ZONE DE TRAVAIL (Masquée en mode Archives) */}
            {!showArchived && (
                <div className="animate-in slide-in-from-bottom-6 duration-500">
                    <div className="flex justify-between items-end mb-10 px-6">
                        <div>
                            <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>
                                {activeSection || "DOSSIERS"}
                            </h2>
                            <p className="text-[11px] font-black text-slate-400 tracking-[0.2em] uppercase mt-2">
                                {activeChaptersInCurrentSection.length} Chapitres actifs
                            </p>
                        </div>
                        {activeSection && (
                            <button onClick={handleCreateChapter} className="px-10 py-5 rounded-[22px] text-white text-[12px] font-black shadow-2xl hover:scale-105 transition-all uppercase tracking-widest" style={{ backgroundColor: activeColor }}>
                                + Nouveau Chapitre
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-6">
                        {activeChaptersInCurrentSection.map(chap => {
                            const isOpen = openChaps[chap._id];
                            const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
                            return (
                                <div key={chap._id} className={`bg-white border-2 rounded-[35px] overflow-hidden transition-all duration-500 ${isOpen ? 'shadow-2xl ring-8 ring-opacity-5' : 'shadow-sm hover:border-slate-300'}`} style={{ borderColor: isOpen ? activeColor : '#f1f5f9', '--tw-ring-color': activeColor }}>
                                    <div className="p-8 flex justify-between items-center cursor-pointer bg-white" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                        <div className="flex items-center gap-8">
                                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-xl transition-transform duration-500" style={{ backgroundColor: activeColor, transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                                {isOpen ? '📂' : '📁'}
                                            </div>
                                            <div>
                                                <h3 className="font-black text-slate-800 text-2xl uppercase tracking-tight">{chap.title}</h3>
                                                <div className="flex gap-3 mt-2">
                                                    <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-4 py-1.5 rounded-xl uppercase">{chapItems.length} Éléments</span>
                                                    {chap.classroom && <span className="text-[10px] font-black bg-indigo-50 text-indigo-500 px-4 py-1.5 rounded-xl uppercase">Classe {chap.classroom}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <button onClick={(e) => { e.stopPropagation(); toggleArchive(chap._id, false); }} className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center hover:bg-amber-100 hover:text-amber-600 transition-all shadow-inner" title="Archiver">📦</button>
                                            <button onClick={(e) => { e.stopPropagation(); deleteChapter(chap._id); }} className="w-14 h-14 rounded-2xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-inner">✕</button>
                                        </div>
                                    </div>
                                    {isOpen && (
                                        <div className="bg-slate-50/50 border-t p-8 space-y-4 animate-in slide-in-from-top-4">
                                            {chapItems.length === 0 && <div className="text-center py-10 border-4 border-dashed border-slate-200 rounded-[30px] text-slate-400 font-black uppercase text-[10px]">Dossier vide.</div>}
                                            {chapItems.map(it => (
                                                <div key={it._id} className="bg-white p-6 rounded-3xl flex justify-between items-center shadow-sm border border-slate-100 hover:shadow-xl hover:translate-x-2 transition-all">
                                                    <div className="flex items-center gap-6">
                                                        <span className={`text-[10px] font-black px-5 py-2.5 rounded-xl uppercase tracking-[0.2em] ${it.actType === 'game' ? 'bg-purple-600 text-white' : 'bg-orange-500 text-white'}`}>{it.typeLabel || 'ACT'}</span>
                                                        <span className="font-black text-slate-700 text-lg uppercase">{it.title}</span>
                                                    </div>
                                                    <div className="flex gap-4">
                                                        <button onClick={() => onEditItem(it)} className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-[10px] font-black hover:bg-indigo-600 transition-all uppercase tracking-widest">Modifier</button>
                                                        <button onClick={() => onDeleteItem(it._id, it.actType)} className="px-5 py-2.5 rounded-xl bg-red-50 text-red-500 text-[10px] font-black hover:bg-red-100 transition-colors">✕</button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}