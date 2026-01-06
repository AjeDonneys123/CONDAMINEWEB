import React, { useState, useEffect } from 'react';

export default function ProfStudioFolder({ 
    items, chapters, classFilter, 
    onArchive, onRename, onEditItem, onViewResults, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [openChaps, setOpenChaps] = useState({});
    const [allPlayers, setAllPlayers] = useState([]);
    const [editingChapTitle, setEditingChapTitle] = useState({ id: null, val: '' });

    useEffect(() => {
        fetch('/api/players').then(r => r.ok ? r.json() : []).then(data => setAllPlayers(data)).catch(() => []);
    }, []);

    const getSubjectInfo = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s === 'H') return { code: 'H', label: 'Histoire', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50' };
        if (s === 'G') return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50' };
        if (s === 'E') return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50' };
        return { code: '?', label: 'Autre', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-50' };
    };

    const toggleChap = (id) => {
        setOpenChaps(prev => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {(chapters || []).map(chap => {
                if (chap.isArchived) return null;
                const info = getSubjectInfo(chap.subject);
                const isOpen = !!openChaps[chap._id];
                const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));

                return (
                    <div key={chap._id} className={`bg-white rounded-[40px] border-2 shadow-md mb-6 overflow-hidden transition-all ${info.border}`}>
                        <div className="flex items-center p-3 gap-4">
                            <div className="flex items-center gap-6 flex-1">
                                {/* 1. BADGE */}
                                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${info.bg} ${info.color}`}>{info.code}</span>

                                {/* 2. INJECTION : SPAN FLÈCHE */}
                                <span 
                                    onClick={() => toggleChap(chap._id)} 
                                    className={`text-2xl cursor-pointer transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : 'text-slate-300 hover:text-blue-400'}`}
                                >
                                    ▼
                                </span>

                                {/* 3. TITRE */}
                                {editingChapTitle.id === chap._id ? (
                                    <input 
                                        autoFocus
                                        className="text-2xl font-black outline-none border-b-2 border-orange-400 w-full bg-transparent"
                                        value={editingChapTitle.val}
                                        onChange={e => setEditingChapTitle({...editingChapTitle, val: e.target.value})}
                                        onBlur={() => { onRename(chap._id, editingChapTitle.val); setEditingChapTitle({id:null, val:''}); }}
                                    />
                                ) : (
                                    <span className="text-2xl font-black text-slate-700 cursor-pointer" onClick={() => toggleChap(chap._id)}>
                                        {chap.title || "Sans titre"}
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pr-4">
                                <button onClick={() => setEditingChapTitle({id: chap._id, val: chap.title})} className="p-2 text-slate-300">✏️</button>
                                <button onClick={() => onArchive(chap._id, true)} className="bg-slate-50 px-3 py-1 rounded-xl text-[10px] font-black text-slate-400 uppercase">Archiver</button>
                                <button onClick={() => onDeleteChapter(chap._id)} className="p-2 text-red-200">✕</button>
                            </div>
                        </div>

                        {isOpen && (
                            <div className="p-5 bg-slate-50/50 border-t-2 border-dashed border-slate-100">
                                {chapItems.map(it => (
                                    <div key={it._id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm mb-2">
                                        <div className="flex items-center gap-4">
                                            <span className="text-2xl">{it.actType === 'game' ? '🕹️' : '📄'}</span>
                                            <b className="text-slate-700 text-sm">{it.title}</b>
                                        </div>
                                        <div className="flex gap-2">
                                            {it.actType === 'homework' && <button onClick={() => onViewResults(it)} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-[10px] uppercase">Copies</button>}
                                            <button onClick={() => onEditItem(it)} className="px-4 py-2 bg-white text-slate-400 border rounded-xl font-bold text-[10px] uppercase">Modifier</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}