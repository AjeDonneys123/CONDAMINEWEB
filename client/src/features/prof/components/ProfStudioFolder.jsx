import React, { useState, useEffect } from 'react';

/**
 * 📂 PROF STUDIO FOLDER - VERSION 87
 * Nettoyage des overlays et visibilité par classe.
 */
export default function ProfStudioFolder({ items, chapters, classFilter, user, onEditItem, onDeleteItem, onRefresh }) {
    const [sections, setSections] = useState(user?.subjectSections || []);
    const [activeSection, setActiveSection] = useState(null); 
    const [openChaps, setOpenChaps] = useState({}); 
    const [showArchived, setShowArchived] = useState(false); 

    useEffect(() => {
        if (user?.subjectSections) {
            setSections(user.subjectSections);
            if (user.subjectSections.length > 0 && !activeSection) {
                setActiveSection(user.subjectSections[0].name.toUpperCase());
            }
        }
    }, [user]);

    const handleAddSection = async () => {
        const name = prompt("Nom de la section ?");
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
        }
    };

    const handleCreateChapter = async () => {
        if (!classFilter) return alert("Sélectionnez une classe avant de créer un dossier.");
        const title = prompt(`Nouveau chapitre dans ${activeSection} ?`);
        if (!title) return;
        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: title.toUpperCase(), section: activeSection, classroom: classFilter.toUpperCase(), teacherId: user.id || user._id })
        });
        onRefresh();
    };

    const allChapters = chapters || [];
    const myId = String(user.id || user._id);
    const myChapters = user.lastName === 'Vuillet' ? allChapters : allChapters.filter(c => String(c.teacherId) === myId);

    const filtered = myChapters.filter(c => {
        const isCorrectClass = !classFilter || (c.classroom || "").toUpperCase() === classFilter.toUpperCase();
        const isCorrectSection = (c.section || "GÉNÉRAL").toUpperCase() === (activeSection || "GÉNÉRAL").toUpperCase();
        const isCorrectStatus = c.isArchived === showArchived;
        return isCorrectClass && isCorrectSection && isCorrectStatus;
    });

    const activeColor = sections.find(s => s.name.toUpperCase() === (activeSection || ''))?.color || '#64748b';

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="p-8 bg-slate-900 rounded-[45px] border-4 border-slate-800 shadow-2xl relative">
                <div className="flex justify-between items-center mb-8">
                    <div className="flex items-center gap-6">
                        <h3 className="text-white font-black text-[11px] uppercase tracking-[0.3em]">Cloud Condamine</h3>
                        <button onClick={() => setShowArchived(!showArchived)} className={`px-5 py-2.5 rounded-2xl text-[10px] font-black border-2 transition-all ${showArchived ? 'bg-amber-500 border-amber-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                            {showArchived ? '📦 ARCHIVES' : `VOIR ARCHIVES`}
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[10px]">STUDIO V87</div>
                        <button onClick={handleAddSection} className="bg-white/10 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase border border-white/10 hover:bg-white/20 transition-all">+ Section</button>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {sections.map((s, idx) => (
                        <button key={idx} onClick={() => {setActiveSection(s.name.toUpperCase()); setShowArchived(false);}}
                            className={`group min-w-[180px] p-5 rounded-2xl border-2 flex flex-col items-start gap-3 transition-all ${activeSection === s.name.toUpperCase() ? 'bg-slate-800 border-white/20 shadow-xl scale-105' : 'bg-slate-800/40 border-slate-800'}`}
                        >
                            <span className="font-black text-[11px] uppercase tracking-wider" style={{ color: s.color }}>{s.name}</span>
                            <span className="text-[9px] font-bold text-slate-500 uppercase">
                                {myChapters.filter(c => !c.isArchived && (c.classroom || "").toUpperCase() === (classFilter || "").toUpperCase() && c.section === s.name.toUpperCase()).length} Dossiers
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-in slide-in-from-bottom-6">
                <div className="flex justify-between items-end mb-10 px-6">
                    <div>
                        <h2 className="text-5xl font-black uppercase tracking-tighter" style={{ color: activeColor }}>{activeSection || "Dossiers"}</h2>
                        <p className="text-[11px] font-black text-slate-400 tracking-[0.2em] uppercase mt-2">{filtered.length} Chapitres actifs en {classFilter || 'Vue Globale'}</p>
                    </div>
                    {activeSection && !showArchived && (
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
                                            <span className="text-[10px] font-black bg-slate-100 text-slate-500 px-3 py-1 rounded-xl uppercase">{chapItems.length} Éléments</span>
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
                </div>
            </div>
        </div>
    );
}