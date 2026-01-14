import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ 
    user, items = [], chapters = [], classFilter, 
    onArchive, onRename, onEditItem, onDeleteItem, onDeleteChapter, onCreateChapter, onNotify 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [sections, setSections] = useState([]);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";
    const smartSort = (a, b) => (a.title || "").localeCompare(b.title || "", undefined, { numeric: true, sensitivity: 'base' });

    useEffect(() => { 
        if (user?.subjectSections) setSections(user.subjectSections);
    }, [user]);

    const saveSections = async (newSections) => {
        const uid = user?.id || user?._id;
        try {
            const res = await fetch(`/api/teacher/${uid}/sections`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sections: newSections, className: classFilter })
            });
            const data = await res.json();
            if (res.ok && data.user) {
                localStorage.setItem('player', JSON.stringify(data.user));
                setSections(data.user.subjectSections);
                if (onNotify) onNotify(data);
            }
        } catch(e) { console.error(e); }
    };

    // 1. Filtrage des chapitres pour la classe active
    const activeChapters = chapters
        .filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter))
        .sort(smartSort);

    const archivedChapters = chapters
        .filter(c => c.isArchived && norm(c.classroom) === norm(classFilter))
        .sort(smartSort);

    // 2. Logique de visibilité corrigée (US #3)
    // On affiche une section si elle a des chapitres ACTIFS, ou si on est en mode "Gérer"
    const getVisibleSections = () => {
        let list = sections.filter(s => isDeleteMode || activeChapters.some(c => c.subject === s.name));
        
        // Ajout dynamique de "Autres" si des chapitres ne rentrent pas dans les cases
        const extraChapters = activeChapters.filter(c => !sections.some(s => s.name === c.subject));
        if (extraChapters.length > 0) {
            list.push({ name: 'Autres', color: '#64748b' });
        }
        return list;
    };

    const renderChapterCard = (chap, section) => {
        const isOpen = openChaps[chap._id];
        const isEditing = editingId === chap._id;
        const color = section?.color || "#94a3b8";
        const letter = (section?.name || "?").substring(0, 1).toUpperCase();
        
        // On récupère les items (devoirs/jeux) liés à ce chapitre
        const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));

        return (
            <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all mb-3 animate-in fade-in" style={{ borderColor: isOpen ? color : '#f1f5f9' }}>
                <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-sm relative transition-transform hover:scale-110" style={{ backgroundColor: color }}>
                            {letter}
                        </div>
                        <div className="flex flex-col">
                            {isEditing ? (
                                <input autoFocus className="text-sm font-black border-b-2 outline-none" style={{ borderColor: color }} value={tempTitle} onChange={e => setTempTitle(e.target.value)} onBlur={() => { onRename(chap._id, tempTitle, section.name); setEditingId(null); }} onKeyDown={e => e.key === 'Enter' && (onRename(chap._id, tempTitle, section.name), setEditingId(null))} onClick={e => e.stopPropagation()} />
                            ) : (
                                <span className="text-sm font-black text-slate-700">{chap.title || "Sans titre"}</span>
                            )}
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{chapItems.length} ÉLÉMENTS</span>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); setEditingId(chap._id); setTempTitle(chap.title); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 rounded-full hover:text-indigo-500 hover:bg-indigo-50">✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); onArchive(chap._id, !chap.isArchived); }} className="w-8 h-8 flex items-center justify-center bg-slate-50 text-slate-300 rounded-full hover:bg-slate-800 hover:text-white">📦</button>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChapter(chap._id); }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-300 rounded-full font-black hover:bg-red-500 hover:text-white">✕</button>
                    </div>
                </div>
                {isOpen && (
                    <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                        {chapItems.map(it => (
                            <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200 cursor-default group">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg">{it.actType === 'game' ? '🕹️' : '📄'}</span>
                                    <b className="text-slate-700 text-xs uppercase tracking-tight">{it.title}</b>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => onEditItem(it)} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg font-black text-[9px] uppercase">Modifier</button>
                                    <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg font-black text-xs">✕</button>
                                </div>
                            </div>
                        ))}
                        {chapItems.length === 0 && <div className="text-center py-4 text-slate-300 text-[10px] font-bold uppercase tracking-widest italic">Ce dossier est vide</div>}
                    </div>
                )}
            </div>
        );
    };

    const visibleSections = getVisibleSections();

    return (
        <div className="max-w-5xl mx-auto space-y-12 pb-20">
            {/* CARRE NOIR : CONFIGURATION ET ARCHIVES */}
            <div className="p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center mb-8 px-2">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span>
                        Configuration des Matières
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={() => { const n = prompt("Nom de la matière ?"); if(n) saveSections([...sections, {name:n, color:'#3b82f6'}]); }} className="bg-indigo-600 text-white px-5 py-2 rounded-2xl font-black text-[9px] uppercase hover:bg-indigo-500 shadow-lg">+ Nouvelle</button>
                        <button onClick={() => setIsDeleteMode(!isDeleteMode)} className={`px-5 py-2 rounded-2xl font-black text-[9px] uppercase transition-colors ${isDeleteMode ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>{isDeleteMode ? 'Terminer' : 'Gérer'}</button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {sections.map(s => {
                        const archs = archivedChapters.filter(c => c.subject === s.name);
                        if (!isDeleteMode && archs.length === 0) return null;
                        return (
                            <div key={s.name} className="bg-slate-800/40 p-4 rounded-[30px] border border-slate-700 animate-in fade-in relative group">
                                <h4 className="font-black text-[9px] uppercase tracking-widest mb-4 flex justify-between items-center" style={{ color: s.color }}>
                                    {s.name}
                                    {isDeleteMode && <button onClick={() => saveSections(sections.filter(x => x.name !== s.name))} className="text-red-500 font-black hover:scale-125 transition-transform">✕</button>}
                                </h4>
                                <div className="space-y-2">
                                    {archs.map(c => (
                                        <div key={c._id} className="bg-slate-800/80 p-2 px-3 rounded-xl flex justify-between items-center border border-slate-700/50 hover:border-indigo-500 transition-colors group/item">
                                            <span className="text-white font-bold text-[9px] truncate pr-2">{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} className="text-emerald-400 font-bold p-1 hover:scale-125 transition-transform" title="Désarchiver">⬆️</button>
                                        </div>
                                    ))}
                                    {archs.length === 0 && isDeleteMode && <div className="text-[8px] text-slate-600 uppercase font-black py-2 italic">Aucune archive</div>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ZONES ACTIVES */}
            <div className="space-y-16">
                {visibleSections.map(s => (
                    <div key={'active-' + s.name} className="animate-in fade-in">
                        <div className="flex items-center justify-between mb-4 px-6 border-b border-slate-100 pb-4">
                            <h3 className="font-black text-base uppercase tracking-widest" style={{ color: s.color }}>{s.name}</h3>
                            <button onClick={() => { const n = prompt(`Nom du dossier dans ${s.name} ?`); if(n) onCreateChapter(s.name, n); }} className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed hover:bg-white transition-all hover:scale-105" style={{ color: s.color, borderColor: s.color }}>+ CRÉER UN CHAPITRE</button>
                        </div>
                        <div className="grid grid-cols-1 gap-1">
                            {activeChapters.filter(c => c.subject === s.name || (s.name === "Autres" && !sections.some(sec => sec.name === c.subject))).map(chap => renderChapterCard(chap, s))}
                        </div>
                    </div>
                ))}
                
                {visibleSections.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-[50px] border-4 border-dashed border-slate-100">
                        <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-4">Aucun dossier actif dans cette classe</p>
                        <button onClick={() => setIsDeleteMode(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Configurer les matières</button>
                    </div>
                )}
            </div>
        </div>
    );
}