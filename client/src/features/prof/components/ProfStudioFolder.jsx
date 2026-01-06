import React, { useState } from 'react';

export default function ProfStudioFolder({ 
    type, items, chapters, classFilter, 
    onMoveItem, onArchive, onRename, onEditItem, onViewResults, onDeleteItem, onDeleteChapter, onCreateChapter 
}) {
    const [editingChap, setEditingChap] = useState({ id: null, title: '' });

    const getSubjectInfo = (t) => {
        const clean = (t || "").trim().toUpperCase();
        const f = clean[0];
        if (f === 'H') return { code: 'H', label: 'Histoire', style: 'subject-H', text: 'text-H', icon: '🏰', bg: 'bg-H' };
        if (f === 'G') return { code: 'G', label: 'Géographie', style: 'subject-G', text: 'text-G', icon: '🌍', bg: 'bg-G' };
        if (f === 'E') return { code: 'E', label: 'EMC', style: 'subject-E', text: 'text-E', icon: '⚖️', bg: 'bg-E' };
        return { code: 'A', label: 'Autre', style: 'subject-A', text: 'text-slate-500', icon: '📁', bg: 'bg-slate-100' };
    };

    const renderChapter = (chap, info) => {
        const chapItems = items.filter(it => it.chapterId?.toString() === chap._id?.toString());
        const isBeingEdited = editingChap.id === chap._id;

        return (
            <div key={chap._id} className={`p-8 rounded-[50px] border-2 bg-white ${info.style} shadow-sm transition-all`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    const itemId = e.dataTransfer.getData("itemId");
                    const chapId = e.dataTransfer.getData("chapterId");
                    if(itemId) onMoveItem(itemId, chap._id);
                    if(chapId && chapId !== chap._id) onArchive(chapId, false);
                }}
            >
                <div className="flex items-center gap-4 mb-6" draggable onDragStart={e => e.dataTransfer.setData("chapterId", chap._id)}>
                    <span className="text-xl opacity-20 cursor-grab">⠿</span>
                    <input 
                        className={`text-2xl font-black bg-transparent outline-none w-full ${info.text}`}
                        value={isBeingEdited ? editingChap.title : chap.title}
                        onFocus={() => setEditingChap({ id: chap._id, title: chap.title })}
                        onChange={(e) => setEditingChap({ ...editingChap, title: e.target.value })}
                        onBlur={() => { if(editingChap.title !== chap.title) onRename(chap._id, editingChap.title); setEditingChap({ id: null, title: '' }); }}
                        onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                    />
                    <div className="flex gap-2">
                        <button onClick={() => onArchive(chap._id, true)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200">📁</button>
                        <button onClick={() => onDeleteChapter(chap._id)} className="p-2 text-red-300 hover:text-red-500">✕</button>
                    </div>
                </div>

                <div className="space-y-3">
                    {chapItems.map(it => (
                        <div key={it._id} draggable onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData("itemId", it._id); }}
                            className="bg-slate-50 p-5 rounded-[25px] border border-slate-100 flex justify-between items-center cursor-grab hover:bg-white hover:border-slate-300 transition-all shadow-sm"
                        >
                            <b className="text-slate-700 text-sm font-bold">{it.title}</b>
                            <div className="flex gap-2">
                                {onViewResults && <button onClick={() => onViewResults(it)} className="px-4 py-2 bg-blue-500 text-white rounded-xl font-bold text-[10px]">RÉSULTATS</button>}
                                <button onClick={() => onEditItem(it)} className="px-4 py-2 bg-white text-slate-500 border rounded-xl font-bold text-[10px]">ÉDITER</button>
                                <button onClick={() => onDeleteItem(it._id)} className="text-red-300 font-black px-2">✕</button>
                            </div>
                        </div>
                    ))}
                    {chapItems.length === 0 && <div className="py-8 border-4 border-dashed border-slate-50 rounded-[35px] text-center text-slate-200 font-black text-xs uppercase">Dossier Vide</div>}
                </div>
            </div>
        );
    };

    return (
        <div className="studio-folder-root">
            {/* SUPER ARCHIVES */}
            <div className="mb-12 p-10 bg-slate-100 rounded-[55px] border-4 border-dashed border-slate-200"
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                    const chapId = e.dataTransfer.getData("chapterId");
                    if(chapId) onArchive(chapId, true);
                }}
            >
                <p className="text-center text-slate-400 font-black text-[10px] uppercase mb-8 tracking-[0.3em]">📁 ARCHIVES - CHAPITRES TERMINÉS ({classFilter})</p>
                <div className="archive-grid-3">
                    {['H', 'G', 'E'].map(sub => {
                        const info = getSubjectInfo(sub);
                        const list = chapters.filter(c => c.isArchived && getSubjectInfo(c.title).code === sub);
                        return (
                            <div key={sub} className="archive-col">
                                <h4 className={`archive-col-title ${info.text} font-black text-[10px] mb-4 uppercase text-center`}>{info.label}</h4>
                                <div className="space-y-2">
                                    {list.map(chap => (
                                        <div key={chap._id} draggable onDragStart={e => e.dataTransfer.setData("chapterId", chap._id)}
                                            className={`${info.bg} p-3 rounded-xl border ${info.style} text-[10px] font-black flex justify-between items-center cursor-grab hover:bg-white`}
                                        >
                                            <span>{chap.title}</span>
                                            <button onClick={() => onArchive(chap._id, false)}>⬆️</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* SECTIONS ACTIVES H / G / E */}
            {['H', 'G', 'E'].map(sub => {
                const info = getSubjectInfo(sub);
                return (
                    <div key={sub} className="mb-12">
                        <div className="flex justify-between items-center px-6 mb-6">
                            <h2 className={`subject-section-title ${info.text} font-black text-xl flex items-center gap-3`}>
                                <span>{info.icon}</span> {info.label}
                            </h2>
                            <button onClick={() => onCreateChapter(sub)} className={`px-5 py-2 rounded-2xl font-black text-[10px] text-white shadow-md hover:scale-105 transition-all ${sub === 'H' ? 'bg-red-500' : sub === 'G' ? 'bg-blue-500' : 'bg-green-500'}`}>
                                + CHAPITRE {info.label}
                            </button>
                        </div>
                        <div className="space-y-8">
                            {chapters.filter(c => !c.isArchived && getSubjectInfo(c.title).code === sub).map(chap => renderChapter(chap, info))}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}