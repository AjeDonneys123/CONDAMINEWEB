import React, { useState, useEffect, useRef } from 'react';

export default function ProfStudioFolder({ 
    items, chapters, classFilter, 
    onArchive, onRename, onEditItem, onViewResults, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");
    const [showGlobalArchives, setShowGlobalArchives] = useState(false);
    const inputRef = useRef(null);

    const norm = (c) => c?.toString().toUpperCase().replace('E', '').trim() || "";

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

    // --- LOGIQUE DE RÉCUPÉRATION ---
    const allChapters = chapters || [];
    
    // Dossiers actifs de cette classe
    const activeOnes = allChapters.filter(c => !c.isArchived && norm(c.classroom) === norm(classFilter));
    
    // Dossiers archivés (Filtre intelligent)
    const archivedOnes = allChapters.filter(c => {
        if (!c.isArchived) return false;
        if (showGlobalArchives) return true; // On montre tout si bouton cliqué
        return norm(c.classroom) === norm(classFilter);
    });

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            
            {/* SECTION ARCHIVES */}
            {archivedOnes.length > 0 && (
                <div className="p-8 bg-slate-900 rounded-[45px] border-4 border-slate-800 shadow-2xl animate-in slide-in-from-top-4">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">📦</span>
                            <h3 className="font-black text-white text-xs uppercase tracking-widest">
                                Archives {showGlobalArchives ? "Toutes Classes" : classFilter} ({archivedOnes.length})
                            </h3>
                        </div>
                        <button onClick={() => setShowGlobalArchives(!showGlobalArchives)} className="text-[8px] font-black text-slate-500 hover:text-white border border-slate-700 px-3 py-1 rounded-lg uppercase">
                            {showGlobalArchives ? "Cibler cette classe" : "Voir tout l'historique"}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {['H', 'G', 'E'].map(sCode => {
                            const info = getSubjectInfo(sCode);
                            const list = archivedOnes.filter(c => getSubjectInfo(c.subject).code === sCode);
                            return (
                                <div key={sCode} className="bg-slate-800/50 p-4 rounded-3xl border border-slate-700">
                                    <h4 className={`text-center font-black text-[9px] uppercase mb-4 ${info.color}`}>{info.label}</h4>
                                    <div className="space-y-2">
                                        {list.map(c => (
                                            <div key={c._id} className="bg-slate-800 p-3 rounded-2xl flex justify-between items-center border border-transparent hover:border-slate-600 transition-all">
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-white font-bold text-xs truncate">{c.title}</span>
                                                    <span className="text-[7px] text-slate-500 font-black uppercase">{c.classroom}</span>
                                                </div>
                                                <button onClick={() => onArchive(c._id, false)} className="text-blue-400 font-bold p-1">⬆️</button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* BARRE DE CRÉATION */}
            <div className="flex justify-between items-center px-4">
                <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-widest">Dossiers de Travail ({classFilter})</h3>
                <div className="flex gap-2">
                    {['H', 'G', 'E'].map(s => (
                        <button key={s} onClick={() => onCreateChapter(s)} className={`px-4 py-2 bg-white border-2 border-dashed rounded-2xl font-black uppercase text-[9px] hover:scale-105 transition-all ${getSubjectInfo(s).color} ${getSubjectInfo(s).border}`}>
                            + {getSubjectInfo(s).label}
                        </button>
                    ))}
                </div>
            </div>

            {/* LISTE ACTIVE */}
            <div className="space-y-4">
                {activeOnes.map(chap => {
                    const info = getSubjectInfo(chap.subject);
                    const isOpen = !!openChaps[chap._id];
                    const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));

                    return (
                        <div key={chap._id} className={`bg-white rounded-[40px] border-2 shadow-sm overflow-hidden transition-all ${info.border}`}>
                            <div className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-lg ${isOpen ? 'bg-indigo-600 text-white' : info.bg + ' ' + info.color}`}>
                                        {isOpen ? '▲' : info.code}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-2xl font-black text-slate-800">{chap.title || "Sans titre"}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{info.label} • {chapItems.length} contenus</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => onArchive(chap._id, true)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full hover:bg-slate-800 text-white transition-all">📦</button>
                                    <button onClick={() => onDeleteChapter(chap._id)} className="w-10 h-10 flex items-center justify-center bg-slate-50 rounded-full hover:bg-red-500 text-white transition-all">🗑️</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="p-6 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-3">
                                    {chapItems.map(it => (
                                        <div key={it._id} className="bg-white p-4 px-6 rounded-3xl flex justify-between items-center shadow-sm border border-transparent hover:border-indigo-200 transition-all">
                                            <b className="text-slate-700 font-bold">{it.actType === 'game' ? '🕹️' : '📄'} {it.title}</b>
                                            <div className="flex gap-3">
                                                <button onClick={() => onEditItem(it)} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-[9px] uppercase">Editer</button>
                                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="text-red-300 font-bold">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {chapItems.length === 0 && <p className="text-center py-6 text-slate-300 italic text-sm">Dossier vide.</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}