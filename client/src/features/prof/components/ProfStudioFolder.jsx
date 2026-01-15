import React, { useState } from 'react';

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function ProfStudioFolder({ items, chapters, classFilter, user, onEditItem, onDeleteItem, onRefresh }) {
    const [openChaps, setOpenChaps] = useState({});
    const [sections, setSections] = useState(user?.subjectSections || []);

    const saveSections = async (newSecs) => {
        const id = user.id || user._id;
        const res = await fetch(`/api/admin/teacher/${id}/sections`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sections: newSecs })
        });
        if (res.ok) {
            setSections(newSecs);
            const local = JSON.parse(localStorage.getItem('player'));
            localStorage.setItem('player', JSON.stringify({...local, subjectSections: newSecs}));
        }
    };

    const handleCreateChapter = async (subject) => {
        const title = prompt(`Nom du dossier dans ${subject} ?`);
        if (!title) return;
        await fetch('/api/structure/chapters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, subject, classroom: classFilter, teacherId: user.id || user._id })
        });
        onRefresh();
    };

    const classChapters = (chapters || []).filter(c => c.classroom === classFilter);

    return (
        <div className="space-y-12">
            <div className="p-6 bg-slate-900 rounded-[35px] border-4 border-slate-800 shadow-xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest px-2">Matières Drive Condamine</h3>
                    <button onClick={() => { const n = prompt("Nom matière ?"); if(n) saveSections([...sections, { name: n.toUpperCase(), color: COLORS[sections.length % 6] }]); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-black text-[9px] tracking-tighter hover:bg-indigo-500">+ MATIÈRE</button>
                </div>
                <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
                    {sections.map((s, idx) => (
                        <div key={idx} className="bg-slate-800 p-3 px-5 rounded-xl border border-slate-700 flex items-center gap-4 animate-in">
                            <span className="font-black text-[10px] uppercase" style={{ color: s.color }}>{s.name}</span>
                            <button onClick={() => { if(confirm("Supprimer ?")) saveSections(sections.filter(x => x.name !== s.name)) }} className="text-slate-600 hover:text-red-500 font-bold">✕</button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-16">
                {sections.map((s, sIdx) => {
                    const chaps = classChapters.filter(c => c.subject === s.name);
                    return (
                        <div key={sIdx} className="animate-in fade-in">
                            <div className="flex items-center justify-between mb-6 px-6 border-b pb-4">
                                <h3 className="font-black text-xl uppercase tracking-tighter" style={{ color: s.color }}>{s.name}</h3>
                                <button onClick={() => handleCreateChapter(s.name)} className="text-[10px] font-black px-6 py-2 rounded-full border-2 border-dashed hover:bg-slate-50 transition-all" style={{ color: s.color, borderColor: s.color }}>+ CRÉER DOSSIER CLOUD</button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {chaps.map(chap => {
                                    const isOpen = openChaps[chap._id];
                                    const chapItems = (items || []).filter(it => String(it.chapterId) === String(chap._id));
                                    return (
                                        <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm transition-all" style={{ borderColor: isOpen ? s.color : '#f1f5f9' }}>
                                            <div className="p-6 flex items-center justify-between cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md" style={{ backgroundColor: s.color }}>{s.name[0]}</div>
                                                    <div className="text-left">
                                                        <h4 className="font-black text-slate-800 uppercase text-md leading-tight">{chap.title}</h4>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{chapItems.length} ÉLÉMENTS CLOUD</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {isOpen && (
                                                <div className="p-4 bg-slate-50/50 border-t space-y-2 rounded-b-[35px]">
                                                    {chapItems.map(it => (
                                                        <div key={it._id} className="bg-white p-3 px-5 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                                                            <div className="text-left">
                                                                <b className="text-slate-700 text-xs font-black uppercase">{it.title}</b>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => onEditItem(it)} className="w-8 h-8 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg text-xs">✎</button>
                                                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-500 rounded-lg text-xs">🗑️</button>
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
                    );
                })}
            </div>
        </div>
    );
}