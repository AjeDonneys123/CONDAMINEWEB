import React, { useState } from 'react';

export default function ProfStudioFolder({ 
    items, chapters, classFilter, 
    onArchive, onRename, onEditItem, onViewResults, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState("");

    const getSubjectInfo = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s === 'H') return { code: 'H', label: 'Histoire', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50' };
        if (s === 'G') return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50' };
        if (s === 'E') return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50' };
        return { code: '?', label: 'Autre', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-50' };
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="grid grid-cols-3 gap-4 mb-8">
                {['H', 'G', 'E'].map(s => (
                    <button key={s} onClick={() => onCreateChapter(s)} className={`p-4 bg-white border-2 border-dashed rounded-3xl font-black uppercase text-[10px] hover:scale-95 transition-all ${getSubjectInfo(s).color} ${getSubjectInfo(s).border}`}>
                        + Dossier {getSubjectInfo(s).label}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {chapters.filter(c => !c.isArchived).map(chap => {
                    const info = getSubjectInfo(chap.subject);
                    const isOpen = !!openChaps[chap._id];
                    // Filtrage des items (Jeux, Devoirs standards ET Devoirs Scanés)
                    const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));

                    return (
                        <div key={chap._id} className={`bg-white rounded-[35px] border-2 shadow-sm overflow-hidden transition-all ${info.border}`}>
                            <div className="p-4 flex items-center justify-between">
                                <div className="flex items-center gap-4 flex-1">
                                    <div 
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs cursor-pointer ${isOpen ? 'bg-indigo-600 text-white' : info.bg + ' ' + info.color}`}
                                        onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}
                                    >
                                        {isOpen ? '▲' : info.code}
                                    </div>
                                    
                                    {editingId === chap._id ? (
                                        <input 
                                            autoFocus 
                                            className="text-lg font-bold border-b-2 border-indigo-400 outline-none bg-transparent"
                                            value={tempTitle}
                                            onChange={e => setTempTitle(e.target.value)}
                                            onBlur={() => { onRename(chap._id, tempTitle); setEditingId(null); }}
                                            onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                        />
                                    ) : (
                                        <b className="text-slate-700 text-lg cursor-pointer" onClick={() => setOpenId(chap._id)}>{chap.title || "Sans titre"}</b>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setEditingId(chap._id); setTempTitle(chap.title); }} className="p-2 opacity-30 hover:opacity-100">✏️</button>
                                    <button onClick={() => onArchive(chap._id, true)} className="px-3 py-1.5 bg-slate-50 text-slate-400 rounded-lg font-black text-[9px] uppercase">Archiver</button>
                                    <button onClick={() => onDeleteChapter(chap._id)} className="p-2 text-red-200 hover:text-red-500">✕</button>
                                </div>
                            </div>

                            {isOpen && (
                                <div className="p-4 bg-slate-50/50 border-t-2 border-dashed border-slate-100 space-y-2">
                                    {chapItems.map(it => (
                                        <div key={it._id} className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm border border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <span className="text-xl">{it.actType === 'game' ? '🕹️' : '📄'}</span>
                                                <div className="flex flex-col">
                                                    <b className="text-slate-700 text-sm">{it.title}</b>
                                                    {it.copyUrls && <span className="text-[9px] font-black text-emerald-500 uppercase">Devoir Scané ({it.copyUrls.length} copies)</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <button onClick={() => onEditItem(it)} className="px-3 py-1 bg-slate-50 text-slate-400 rounded-lg font-bold text-[9px] uppercase">Editer</button>
                                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="p-1 text-red-200">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                    {chapItems.length === 0 && <p className="text-center py-4 text-slate-300 italic text-xs">Dossier vide</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}