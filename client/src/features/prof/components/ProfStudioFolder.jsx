import React, { useState } from 'react';

export default function ProfStudioFolder({ items, chapters, classFilter, onEditItem, onDeleteItem }) {
    const [openChaps, setOpenChaps] = useState({});

    // Normalisation pour le filtrage classe
    const norm = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    
    // FILTRAGE : On affiche les chapitres non archivés de la classe sélectionnée
    const filteredChapters = chapters.filter(c => norm(c.classroom) === norm(classFilter) && !c.isArchived);

    return (
        <div className="space-y-4">
            {filteredChapters.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                    <p className="text-slate-300 font-black uppercase text-xs">Aucun dossier trouvé pour {classFilter}</p>
                </div>
            )}

            {filteredChapters.map(chap => {
                const isOpen = openChaps[chap._id];
                const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));

                return (
                    <div key={chap._id} className="bg-white rounded-[35px] border-2 border-slate-50 overflow-hidden shadow-sm transition-all mb-4">
                        <button 
                            onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}
                            className={`w-full p-6 flex justify-between items-center transition-colors ${isOpen ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}
                        >
                            <div className="flex items-center gap-4 text-left">
                                <span className="text-2xl">📂</span>
                                <div>
                                    <h3 className="font-black text-slate-700 uppercase text-sm leading-tight">{chap.title}</h3>
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{chapItems.length} ÉLÉMENTS</span>
                                </div>
                            </div>
                            <span className="text-slate-300 font-black">{isOpen ? '▲' : '▼'}</span>
                        </button>

                        {isOpen && (
                            <div className="p-4 bg-slate-50/30 border-t border-slate-100 space-y-3">
                                {chapItems.map(it => (
                                    <div key={it._id} className="bg-white p-4 px-6 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100 group">
                                        <div className="flex flex-col">
                                            <b className="text-slate-600 text-xs uppercase tracking-tight">{it.title}</b>
                                            <span className={`text-[8px] font-black uppercase mt-1 px-2 py-0.5 rounded-full w-fit ${it.actType === 'game' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                {it.actType === 'game' ? '🕹️ Quiz' : '📝 Devoir'}
                                            </span>
                                        </div>
                                        
                                        <div className="flex gap-2">
                                            <button onClick={() => onEditItem(it)} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                <span className="font-black">✎</span>
                                            </button>
                                            <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">
                                                <span className="font-black">🗑️</span>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {chapItems.length === 0 && (
                                    <p className="text-center py-4 text-[9px] font-black text-slate-300 uppercase italic tracking-widest">Dossier vide</p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}