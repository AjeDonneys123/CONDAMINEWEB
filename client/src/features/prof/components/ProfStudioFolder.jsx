import React, { useState, useEffect, useRef } from 'react';

export default function ProfStudioFolder({ 
    items, chapters, classFilter, 
    onArchive, onRename, onEditItem, onViewResults, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [allSessions, setAllSessions] = useState([]);
    const [showAll, setShowAll] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        fetch('/api/scan-sessions').then(r => r.json()).then(data => setAllSessions(Array.isArray(data) ? data : []));
    }, [items]);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    const getSubjectInfo = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s === 'H') return { code: 'H', label: 'Histoire', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50' };
        if (s === 'G') return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50' };
        if (s === 'E') return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50' };
        return { code: '?', label: 'Autre', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-50' };
    };

    const handleCreate = async (subject) => {
        const newChap = await onCreateChapter(subject);
        if (newChap && newChap._id) {
            setEditingId(newChap._id);
            setTempTitle(newChap.title);
            setOpenChaps(prev => ({...prev, [newChap._id]: true}));
        }
    };

    const handleRenameSubmit = () => {
        if (editingId && tempTitle.trim()) {
            onRename(editingId, tempTitle);
        }
        setEditingId(null);
    };

    // --- FILTRAGE ET TRI ---
    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    
    // Chapitres Actifs de la classe
    const activeChapters = chapters.filter(c => normalize(c.classroom) === normalize(classFilter) && !c.isArchived);
    
    // Chapitres Archivés de la classe (RESTAURÉS)
    const archivedChapters = chapters.filter(c => normalize(c.classroom) === normalize(classFilter) && c.isArchived);
    
    // Chapitres autres classes (mode debug)
    const otherChapters = chapters.filter(c => normalize(c.classroom) !== normalize(classFilter));

    const displayChapters = showAll ? [...activeChapters, ...otherChapters.filter(c => !c.isArchived)] : activeChapters;

    // --- RENDU SECTION ARCHIVES ---
    const renderArchiveSection = () => {
        if (archivedChapters.length === 0) return null;

        return (
            <div className="mb-8 p-6 bg-slate-800 rounded-[35px] border-4 border-slate-700 shadow-xl animate-in slide-in-from-top-4">
                <div className="flex items-center justify-center gap-2 mb-6 opacity-60">
                    <span className="text-2xl">📦</span>
                    <p className="font-black text-white text-[10px] uppercase tracking-widest">Archives {classFilter}</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                    {['H', 'G', 'E'].map(sub => {
                        const info = getSubjectInfo(sub);
                        const list = archivedChapters.filter(c => c.subject === sub);
                        return (
                            <div key={sub} className="bg-slate-700/50 p-3 rounded-2xl border border-slate-600">
                                <h4 className={`text-center font-black text-[9px] uppercase mb-3 ${info.color} opacity-80`}>{info.label}</h4>
                                <div className="space-y-2">
                                    {list.map(c => (
                                        <div key={c._id} className="bg-slate-600/50 p-2 px-3 rounded-xl flex justify-between items-center group hover:bg-slate-600 transition-all">
                                            <span className="text-[10px] font-bold text-slate-300 truncate flex-1 pr-2">{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} className="text-blue-300 hover:text-blue-100 font-bold text-xs" title="Désarchiver">⬆️</button>
                                        </div>
                                    ))}
                                    {list.length === 0 && <p className="text-center text-[8px] text-slate-500 font-bold py-2">-</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            
            {/* 1. LES ARCHIVES (Restaurées) */}
            {renderArchiveSection()}

            {/* 2. BOUTONS DE CRÉATION */}
            <div className="grid grid-cols-3 gap-4 mb-4">
                {['H', 'G', 'E'].map(s => (
                    <button key={s} onClick={() => handleCreate(s)} className={`p-4 bg-white border-2 border-dashed rounded-3xl font-black uppercase text-[10px] hover:scale-105 transition-all shadow-sm ${getSubjectInfo(s).color} ${getSubjectInfo(s).border}`}>
                        + Créer Dossier {getSubjectInfo(s).label}
                    </button>
                ))}
            </div>

            {/* 3. MESSAGE MASQUÉ */}
            {otherChapters.length > 0 && !showAll && (
                <div className="text-center mb-4">
                    <button onClick={() => setShowAll(true)} className="text-[9px] font-bold text-slate-300 uppercase hover:text-indigo-400 transition-colors">
                        (Voir {otherChapters.length} dossiers d'autres classes)
                    </button>
                </div>
            )}

            {/* 4. LISTE ACTIVE */}
            <div className="space-y-3">
                {displayChapters.map(chap => {
                    const info = getSubjectInfo(chap.subject);
                    const isOpen = !!openChaps[chap._id];
                    const isEditing = editingId === chap._id;
                    const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));
                    const chapSessions = allSessions.filter(s => String(s.chapterId) === String(chap._id));
                    const showClassBadge = showAll && normalize(chap.classroom) !== normalize(classFilter);

                    return (
                        <div key={chap._id} className={`bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all ${info.border}`}>
                            <div className="p-4 flex items-center justify-between bg-white">
                                <div className="flex items-center gap-4 flex-1">
                                    <div 
                                        className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm cursor-pointer transition-colors ${isOpen ? 'bg-indigo-600 text-white' : info.bg + ' ' + info.color}`}
                                        onClick={() => !isEditing && setOpenChaps({...openChaps, [chap._id]: !isOpen})}
                                    >
                                        {isOpen ? '▲' : info.code}
                                    </div>
                                    
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-2 animate-in fade-in">
                                            <input 
                                                ref={inputRef}
                                                className="text-lg font-bold outline-none bg-slate-50 border-b-2 border-indigo-500 w-full px-2 py-1 rounded" 
                                                value={tempTitle} 
                                                onChange={e => setTempTitle(e.target.value)} 
                                                onBlur={handleRenameSubmit} 
                                                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()} 
                                            />
                                            <button onMouseDown={handleRenameSubmit} className="bg-green-500 text-white px-3 rounded-lg font-bold">OK</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                            <span className="text-xl font-black text-slate-700 hover:text-indigo-600 transition-colors">{chap.title || "Nouveau Dossier"}</span>
                                            {showClassBadge && <span className="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded w-fit font-bold">Classe : {chap.classroom}</span>}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    {!isEditing && (
                                        <button onClick={() => { setEditingId(chap._id); setTempTitle(chap.title); }} className="w-10 h-10 flex items-center justify-center text-xl bg-slate-50 rounded-full hover:bg-yellow-100 hover:text-yellow-600 transition-all" title="Renommer">✏️</button>
                                    )}
                                    <button onClick={() => onArchive(chap._id, true)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-400 rounded-full hover:bg-slate-800 hover:text-white transition-all font-bold" title="Archiver">📦</button>
                                    <button onClick={() => onDeleteChapter(chap._id)} className="w-10 h-10 flex items-center justify-center bg-slate-50 text-red-300 rounded-full hover:bg-red-500 hover:text-white transition-all font-bold" title="Supprimer">🗑️</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                                    {chapItems.map(it => (
                                        <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border hover:border-indigo-200 transition-colors">
                                            <div className="flex items-center gap-3"><span className="text-lg">{it.actType === 'game' ? '🕹️' : '📄'}</span><b className="text-slate-700 text-sm">{it.title}</b></div>
                                            <div className="flex gap-2">
                                                <button onClick={() => onEditItem(it)} className="px-3 py-1 bg-indigo-50 text-indigo-500 rounded-lg font-bold text-[9px] uppercase hover:bg-indigo-100">Modifier</button>
                                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-6 h-6 flex items-center justify-center text-red-300 hover:text-red-500">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {chapItems.length === 0 && <p className="text-center py-4 text-slate-300 italic text-xs">Aucune activité dans ce dossier.</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {displayChapters.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-[30px] bg-slate-50">
                        <p className="text-slate-400 font-bold">Aucun dossier actif pour {classFilter}</p>
                        <p className="text-xs text-slate-300 mt-1">Créez-en un ou consultez les archives ci-dessus.</p>
                    </div>
                )}
            </div>
        </div>
    );
}