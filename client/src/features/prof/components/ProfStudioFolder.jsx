import React, { useState, useEffect, useRef } from 'react';

export default function ProfStudioFolder({ 
    items, chapters, classFilter, 
    onArchive, onRename, onEditItem, onViewResults, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [showAllClasses, setShowAllClasses] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        if (editingId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingId]);

    // Normalisation robuste pour comparer les classes (6D === 6eD)
    const normClass = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";

    // Helper pour identifier la matière même si elle est mal écrite
    const getSubjectInfo = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s.startsWith('H')) return { code: 'H', label: 'Histoire', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50' };
        if (s.startsWith('G')) return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50' };
        if (s.startsWith('E')) return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50' };
        return { code: '?', label: 'Autre', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-50' };
    };

    const handleRenameSubmit = () => {
        if (editingId && tempTitle.trim()) onRename(editingId, tempTitle);
        setEditingId(null);
    };

    // --- LOGIQUE DE FILTRAGE ---
    const allChapters = chapters || [];
    
    // 1. Dossiers ACTIFS de la classe sélectionnée
    const activeChapters = allChapters.filter(c => !c.isArchived && normClass(c.classroom) === normClass(classFilter));
    
    // 2. Dossiers ARCHIVÉS (si showAllClasses est vrai, on prend tout, sinon juste la classe)
    const archivedChapters = allChapters.filter(c => {
        const isArchived = c.isArchived === true;
        const matchClass = showAllClasses || normClass(c.classroom) === normClass(classFilter);
        return isArchived && matchClass;
    });

    // 3. Dossiers des AUTRES classes (pour info)
    const otherClassesChapters = allChapters.filter(c => !c.isArchived && normClass(c.classroom) !== normClass(classFilter));

    // --- RENDU DE LA SECTION ARCHIVE ---
    const renderArchiveSection = () => {
        if (archivedChapters.length === 0) return null;

        return (
            <div className="mb-10 p-8 bg-slate-800 rounded-[45px] border-4 border-slate-700 shadow-2xl animate-in slide-in-from-top-4">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">📦</span>
                        <h3 className="font-black text-white text-xs uppercase tracking-widest">
                            Archives {showAllClasses ? "Globales" : classFilter} ({archivedChapters.length})
                        </h3>
                    </div>
                    <button 
                        onClick={() => setShowAllClasses(!showAllClasses)}
                        className="text-[9px] font-black text-slate-400 hover:text-white border border-slate-600 px-3 py-1 rounded-lg transition-all"
                    >
                        {showAllClasses ? "VOIR UNIQUEMENT CETTE CLASSE" : "VOIR TOUTES LES CLASSES"}
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['H', 'G', 'E'].map(subCode => {
                        const info = getSubjectInfo(subCode);
                        const list = archivedChapters.filter(c => getSubjectInfo(c.subject).code === subCode);
                        
                        return (
                            <div key={subCode} className="bg-slate-900/50 p-4 rounded-3xl border border-slate-700">
                                <h4 className={`text-center font-black text-[10px] uppercase mb-4 ${info.color}`}>{info.label}</h4>
                                <div className="space-y-2">
                                    {list.map(c => (
                                        <div key={c._id} className="bg-slate-800 p-3 rounded-2xl flex justify-between items-center group border border-transparent hover:border-slate-600">
                                            <div className="flex flex-col overflow-hidden">
                                                <span className="text-white font-bold text-sm truncate">{c.title}</span>
                                                <span className="text-[8px] text-slate-500 font-black uppercase">{c.classroom}</span>
                                            </div>
                                            <button onClick={() => onArchive(c._id, false)} className="text-blue-400 hover:scale-125 transition-transform font-bold p-1">⬆️</button>
                                        </div>
                                    ))}
                                    {list.length === 0 && <p className="text-center text-slate-600 text-[9px] font-bold py-4">Vide</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            
            {/* 1. SECTION ARCHIVES */}
            {renderArchiveSection()}

            {/* 2. BARRE D'ACTIONS RAPIDES */}
            <div className="flex items-center justify-between mb-2">
                <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest px-4">Dossiers Actuels ({classFilter})</h3>
                <div className="flex gap-2">
                    {['H', 'G', 'E'].map(s => (
                        <button key={s} onClick={() => onCreateChapter(s)} className={`px-4 py-2 bg-white border-2 border-dashed rounded-2xl font-black uppercase text-[9px] hover:bg-slate-50 transition-all ${getSubjectInfo(s).color} ${getSubjectInfo(s).border}`}>
                            + {getSubjectInfo(s).label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 3. LISTE DES DOSSIERS ACTIFS */}
            <div className="space-y-4">
                {activeChapters.map(chap => {
                    const info = getSubjectInfo(chap.subject);
                    const isOpen = !!openChaps[chap._id];
                    const isEditing = editingId === chap._id;
                    const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));

                    return (
                        <div key={chap._id} className={`bg-white rounded-[40px] border-2 shadow-sm overflow-hidden transition-all ${info.border}`}>
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div 
                                        className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg cursor-pointer ${isOpen ? 'bg-indigo-600 text-white' : info.bg + ' ' + info.color}`}
                                        onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}
                                    >
                                        {isOpen ? '▲' : info.code}
                                    </div>
                                    
                                    {isEditing ? (
                                        <div className="flex-1 flex gap-2">
                                            <input 
                                                ref={inputRef}
                                                className="text-xl font-bold outline-none bg-slate-50 border-b-2 border-indigo-500 w-full px-2" 
                                                value={tempTitle} 
                                                onChange={e => setTempTitle(e.target.value)} 
                                                onBlur={handleRenameSubmit} 
                                                onKeyDown={e => e.key === 'Enter' && handleRenameSubmit()} 
                                            />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                            <span className="text-2xl font-black text-slate-800">{chap.title || "Sans titre"}</span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{info.label} • {chapItems.length} activités</span>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setEditingId(chap._id); setTempTitle(chap.title); }} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full hover:bg-amber-100 text-amber-600 transition-all">✏️</button>
                                    <button onClick={() => onArchive(chap._id, true)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full hover:bg-slate-800 text-white transition-all">📦</button>
                                    <button onClick={() => onDeleteChapter(chap._id)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full hover:bg-red-500 text-white transition-all">🗑️</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="p-6 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-3">
                                    {chapItems.map(it => (
                                        <div key={it._id} className="bg-white p-4 px-6 rounded-3xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200 transition-all">
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl">{it.actType === 'game' ? '🕹️' : '📄'}</span>
                                                <b className="text-slate-700 font-bold">{it.title}</b>
                                            </div>
                                            <div className="flex gap-3">
                                                <button onClick={() => onEditItem(it)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[10px] uppercase">Modifier</button>
                                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="text-red-300 hover:text-red-500 font-bold">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {chapItems.length === 0 && <p className="text-center py-6 text-slate-300 italic text-sm">Dossier vide.</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
                
                {activeChapters.length === 0 && (
                    <div className="text-center py-20 border-4 border-dashed border-slate-100 rounded-[50px]">
                        <p className="text-slate-300 font-black uppercase tracking-tighter text-xl">Aucun dossier actif pour {classFilter}</p>
                    </div>
                )}
            </div>
        </div>
    );
}