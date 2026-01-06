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

    const renderArchiveSection = () => {
        const archived = chapters.filter(c => c.isArchived);
        if (archived.length === 0) return null;

        return (
            <div className="mb-10 p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <p className="text-center text-slate-400 font-black text-[10px] uppercase mb-8 tracking-[0.3em]">📂 Archives Classées</p>
                <div className="grid grid-cols-3 gap-6">
                    {['H', 'G', 'E'].map(sub => {
                        const info = getSubjectInfo(sub);
                        const list = archived.filter(c => c.subject === sub);
                        return (
                            <div key={sub} className="bg-slate-800/40 p-5 rounded-[35px] border border-slate-700 min-h-[100px]">
                                <h4 className={`text-center font-black text-[10px] uppercase mb-4 ${info.color}`}>{info.label}</h4>
                                <div className="space-y-2">
                                    {list.map(c => (
                                        <div key={c._id} className="bg-slate-700/40 p-3 rounded-2xl flex justify-between items-center shadow-sm border border-slate-600/30">
                                            <span className="text-[10px] font-bold text-slate-300 truncate pr-2">{c.title}</span>
                                            <button onClick={() => onArchive(c._id, false)} className="text-blue-400 hover:scale-125 transition-all font-bold">⬆️</button>
                                        </div>
                                    ))}
                                    {list.length === 0 && <p className="text-center text-[9px] text-slate-600 font-bold uppercase py-2">Vide</p>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="max-w-4xl mx-auto">
            {/* 1. ARCHIVES EN HAUT */}
            {renderArchiveSection()}

            {/* 2. BOUTONS CREATION */}
            <div className="grid grid-cols-3 gap-6 mb-10">
                {['H', 'G', 'E'].map(s => (
                    <button key={s} onClick={() => onCreateChapter(s)} className={`p-6 bg-white border-4 border-dashed rounded-[40px] font-black uppercase text-[10px] hover:bg-slate-50 transition-all ${getSubjectInfo(s).color} ${getSubjectInfo(s).border}`}>
                        + Dossier {getSubjectInfo(s).label}
                    </button>
                ))}
            </div>

            {/* 3. LISTE ACTIVE */}
            <div className="space-y-4">
                {chapters.filter(c => !c.isArchived).map(chap => {
                    const info = getSubjectInfo(chap.subject);
                    const isOpen = !!openChaps[chap._id];
                    const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));

                    return (
                        <div key={chap._id} className={`bg-white rounded-[40px] border-2 shadow-sm mb-4 overflow-hidden transition-all ${info.border}`}>
                            <div className="flex items-center p-3 gap-4">
                                <div className="flex items-center gap-6 flex-1">
                                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${info.bg} ${info.color}`}>{info.code}</span>
                                    <span onClick={() => toggleChap(chap._id)} className={`text-2xl cursor-pointer transition-transform ${isOpen ? 'rotate-180 text-blue-600' : 'text-slate-200'}`}>▼</span>
                                    {editingChapTitle.id === chap._id ? (
                                        <input 
                                            autoFocus
                                            className="text-2xl font-black outline-none border-b-2 border-orange-400 w-full bg-transparent"
                                            value={editingChapTitle.val}
                                            onChange={e => setEditingChapTitle({...editingChapTitle, val: e.target.value})}
                                            onBlur={() => { onRename(chap._id, editingChapTitle.val); setEditingChapTitle({id:null, val:''}); }}
                                        />
                                    ) : (
                                        <span className="text-2xl font-black text-slate-700 cursor-pointer hover:text-blue-600" onClick={() => toggleChap(chap._id)}>
                                            {chap.title || "Sans titre"}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 pr-4">
                                    <button onClick={() => setEditingChapTitle({id: chap._id, val: chap.title})} className="p-2 opacity-40 hover:opacity-100">✏️</button>
                                    <button onClick={() => onArchive(chap._id, true)} className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 uppercase hover:bg-slate-800 hover:text-white transition-all">Archiver</button>
                                </div>
                            </div>
                            {isOpen && (
                                <div className="p-5 bg-slate-50/50 border-t-2 border-dashed border-slate-100">
                                    <div className="space-y-2">
                                        {chapItems.map(it => (
                                            <div key={it._id} className="bg-white p-4 rounded-2xl border border-slate-100 flex justify-between items-center shadow-sm mb-2">
                                                <div className="flex items-center gap-4">
                                                    <span className="text-2xl">{it.actType === 'game' ? '🕹️' : '📄'}</span>
                                                    <b className="text-slate-700 text-sm">{it.title}</b>
                                                </div>
                                                <div className="flex gap-2">
                                                    {it.actType === 'homework' && <button onClick={() => onViewResults(it)} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-[10px] uppercase shadow-sm">Copies</button>}
                                                    <button onClick={() => onEditItem(it)} className="px-4 py-2 bg-white text-slate-400 border rounded-xl font-bold text-[10px] uppercase hover:bg-slate-50">Modifier</button>
                                                    <button onClick={() => onDeleteItem(it._id, it.actType)} className="p-2 text-red-300">✕</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}