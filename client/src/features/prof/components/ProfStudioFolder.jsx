import React, { useState, useEffect } from 'react';

const COLOR_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#facc15'];

export default function ProfStudioFolder({ items, chapters, classFilter, user, onEditItem, onDeleteItem, onRefresh }) {
    const [openChaps, setOpenChaps] = useState({});
    const [sections, setSections] = useState([]);
    const [isSyncing, setIsSyncing] = useState(false);

    useEffect(() => {
        if (user?.subjectSections) setSections(user.subjectSections);
    }, [user]);

    const saveTeacherSections = async (newSections) => {
        setSections(newSections);
        await fetch(`/api/teacher/${user.id || user._id}/sections`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sections: newSections })
        });
        const updatedUser = { ...user, subjectSections: newSections };
        localStorage.setItem('player', JSON.stringify(updatedUser));
    };

    const handleCreateChapter = async (subjectName) => {
        const title = prompt(`Nom du nouveau dossier dans ${subjectName} ?`);
        if (!title) return;
        
        setIsSyncing(true);
        try {
            const res = await fetch('/api/structure/chapters', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title, 
                    subject: subjectName, 
                    classroom: classFilter, 
                    teacherId: user.id || user._id 
                })
            });
            if (res.ok) onRefresh();
            else {
                const err = await res.json();
                alert("Erreur: " + err.error);
            }
        } catch (e) { alert("Erreur réseau"); }
        setIsSyncing(false);
    };

    const norm = (c) => c?.toString().toUpperCase().replace('E', '') || "";
    const activeChapters = chapters.filter(c => norm(c.classroom) === norm(classFilter) && !c.isArchived);

    return (
        <div className="space-y-12">
            {/* PANNEAU ADMIN MATIÈRES */}
            <div className="p-8 bg-slate-900 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <div className="flex justify-between items-center mb-8 px-2">
                    <h3 className="text-white font-black text-[10px] uppercase tracking-widest">Matières & Configuration</h3>
                    <button onClick={() => {
                        const name = prompt("Nom de la nouvelle matière ?");
                        if (name) saveTeacherSections([...sections, { name, color: COLOR_PALETTE[sections.length % 9] }]);
                    }} className="bg-indigo-600 text-white px-4 py-2 rounded-2xl font-black text-[9px] uppercase shadow-lg">+ Ajouter Matière</button>
                </div>
                <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
                    {sections.map((s, idx) => (
                        <div key={idx} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 min-w-[150px] flex justify-between items-center">
                            <span className="font-black text-[10px] uppercase" style={{ color: s.color }}>{s.name}</span>
                            <button onClick={() => saveTeacherSections(sections.filter(x => x.name !== s.name))} className="text-slate-600 hover:text-red-500 font-black">✕</button>
                        </div>
                    ))}
                </div>
            </div>

            {/* LISTE DYNAMIQUE */}
            <div className="space-y-16">
                {sections.map((s, sIdx) => {
                    const chaps = activeChapters.filter(c => c.subject === s.name);
                    return (
                        <div key={sIdx} className="animate-in fade-in">
                            <div className="flex items-center justify-between mb-6 px-6 border-b border-slate-100 pb-4">
                                <h3 className="font-black text-lg uppercase tracking-widest" style={{ color: s.color }}>{s.name}</h3>
                                <button 
                                    disabled={isSyncing}
                                    onClick={() => handleCreateChapter(s.name)} 
                                    className="text-[9px] font-black px-6 py-2 rounded-full border-2 border-dashed transition-all hover:bg-slate-50" 
                                    style={{ color: s.color, borderColor: s.color }}
                                >
                                    {isSyncing ? 'CRÉATION DRIVE...' : '+ CRÉER DOSSIER'}
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                {chaps.map(chap => {
                                    const isOpen = openChaps[chap._id];
                                    const chapItems = items.filter(it => String(it.chapterId) === String(chap._id));
                                    return (
                                        <div key={chap._id} className="bg-white rounded-[35px] border-2 shadow-sm transition-all" style={{ borderColor: isOpen ? s.color : '#f1f5f9' }}>
                                            <div className="p-5 flex items-center justify-between">
                                                <div className="flex items-center gap-4 flex-1 cursor-pointer" onClick={() => setOpenChaps({...openChaps, [chap._id]: !isOpen})}>
                                                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black" style={{ backgroundColor: s.color }}>{s.name.substring(0,1)}</div>
                                                    <div className="text-left">
                                                        <h4 className="font-black text-slate-700 uppercase text-sm">{chap.title}</h4>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">{chapItems.length} ÉLÉMENTS</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button onClick={async () => { if(confirm("Supprimer dossier et contenu Drive ?")) { await fetch(`/api/structure/chapters/${chap._id}`, {method:'DELETE'}); onRefresh(); } }} className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-300 rounded-full hover:bg-red-500 hover:text-white transition-all">✕</button>
                                                </div>
                                            </div>
                                            {isOpen && (
                                                <div className="p-4 bg-slate-50/30 border-t-2 border-dashed border-slate-100 space-y-3">
                                                    {chapItems.map(it => (
                                                        <div key={it._id} className="bg-white p-4 px-6 rounded-2xl flex justify-between items-center shadow-sm border border-slate-100">
                                                            <div className="flex flex-col">
                                                                <b className="text-slate-600 text-xs uppercase">{it.title}</b>
                                                                <span className={`text-[8px] font-black uppercase mt-1 px-2 py-0.5 rounded-full w-fit ${it.actType === 'game' ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                                                    {it.actType === 'game' ? '🕹️ Quiz' : '📝 Devoir'}
                                                                </span>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <button onClick={() => onEditItem(it)} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm">✎</button>
                                                                <button onClick={() => onDeleteItem(it._id, it.actType)} className="w-10 h-10 flex items-center justify-center bg-red-50 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all shadow-sm">🗑️</button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                    {chapItems.length === 0 && <p className="text-center text-[9px] font-bold text-slate-300 uppercase italic">Dossier vide</p>}
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