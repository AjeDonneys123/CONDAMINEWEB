import React, { useState, useEffect } from 'react';

export default function ChapterManager() {
    const [chapters, setChapters] = useState([]);
    const [activities, setActivities] = useState([]);
    const [openChaps, setOpenChaps] = useState({});
    const [classFilter, setClassFilter] = useState('6D');
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState('');

    const load = async () => {
        try {
            const [chapRes, hwRes, gmRes] = await Promise.all([
                fetch('/api/chapters-all').then(r => r.json()),
                fetch('/api/homework-all').then(r => r.json()),
                fetch('/api/game-levels/all').then(r => r.json())
            ]);
            setChapters(Array.isArray(chapRes) ? chapRes : []);
            setActivities([
                ...(hwRes || []).map(x => ({ ...x, actType: 'homework' })),
                ...(gmRes || []).map(x => ({ ...x, actType: 'game' }))
            ]);
        } catch (e) { console.error(e); }
    };
    
    useEffect(() => { load(); }, [classFilter]);

    const updateChapter = async (id, payload) => {
        await fetch('/api/chapters', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ _id: id, ...payload }) 
        });
        load();
    };

    const toggleChap = (id) => {
        setOpenChaps(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const getStyle = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s === 'H') return { code: 'H', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50', label: 'Histoire' };
        if (s === 'G') return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50', label: 'Géographie' };
        if (s === 'E') return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50', label: 'EMC' };
        return { code: '?', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-100', label: 'Inconnu' };
    };

    const myChapters = chapters.filter(c => c.classroom === classFilter);

    const renderArchiveCol = (subCode) => {
        const info = getStyle(subCode);
        const list = myChapters.filter(c => c.isArchived && c.subject === subCode);
        return (
            <div className="bg-slate-800/60 p-4 rounded-[25px] border border-slate-700 min-h-[120px]">
                <h4 className={`text-center font-black text-[9px] uppercase mb-4 ${info.color}`}>{info.label}</h4>
                <div className="space-y-2">
                    {list.map(chap => (
                        <div key={chap._id} className="bg-slate-700/50 p-2 rounded-xl flex justify-between items-center border border-slate-600/50">
                            <span className="text-white font-bold text-[10px] truncate pr-2">{chap.title || "Sans titre"}</span>
                            <button onClick={() => updateChapter(chap._id, {isArchived: false})} className="text-white hover:text-green-400 transition-colors">⬆️</button>
                        </div>
                    ))}
                    {list.length === 0 && <p className="text-[8px] text-slate-600 text-center uppercase font-bold py-4">Aucun</p>}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-6 bg-white p-6 rounded-[35px] border-2 border-orange-50 shadow-sm">
                <h2 className="font-black text-slate-800 uppercase text-xs tracking-widest">Gestionnaire de Dossiers</h2>
                <select className="bg-slate-100 p-3 rounded-xl font-black outline-none border-none" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                </select>
            </div>

            {/* SECTION ARCHIVES : PLACÉE AU DESSUS */}
            <div className="mb-10 bg-slate-900 p-8 rounded-[50px] border-4 border-slate-800 shadow-2xl">
                <p className="text-center text-slate-400 font-black text-[10px] uppercase mb-8 tracking-[0.3em]">📂 Zone d'Archives (Masqué aux élèves)</p>
                <div className="grid grid-cols-3 gap-6">
                    {renderArchiveCol('H')}
                    {renderArchiveCol('G')}
                    {renderArchiveCol('E')}
                </div>
            </div>

            {/* LISTE ACTIVE */}
            <div className="space-y-4">
                <p className="text-[11px] font-black text-slate-400 uppercase ml-6 mb-4 tracking-wider">Dossiers Actifs</p>
                {myChapters.filter(c => !c.isArchived).map(chap => {
                    const info = getStyle(chap.subject);
                    const isOpen = !!openChaps[chap._id];
                    const chapItems = activities.filter(a => String(a.chapterId) === String(chap._id));

                    return (
                        <div key={chap._id} className={`bg-white rounded-[35px] border-2 ${info.border} overflow-hidden shadow-sm`}>
                            <div className="p-4 flex justify-between items-center">
                                <div className="flex items-center gap-6 flex-1">
                                    <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${info.bg} ${info.color}`}>{info.code}</span>
                                    <span onClick={() => toggleChap(chap._id)} className={`text-2xl cursor-pointer transition-all ${isOpen ? 'rotate-180 text-blue-600' : 'text-slate-200'}`}>▼</span>
                                    {editingId === chap._id ? (
                                        <input 
                                            autoFocus
                                            className="text-2xl font-black border-b-4 border-orange-500 outline-none w-full bg-transparent"
                                            value={tempTitle}
                                            onChange={e => setTempTitle(e.target.value)}
                                            onBlur={() => { updateChapter(chap._id, {title: tempTitle}); setEditingId(null); }}
                                        />
                                    ) : (
                                        <span className="text-2xl font-black text-slate-700 cursor-pointer" onClick={() => toggleChap(chap._id)}>
                                            {chap.title || "Nommer le dossier..."}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => {setEditingId(chap._id); setTempTitle(chap.title);}} className="p-2 opacity-40 hover:opacity-100">✏️</button>
                                    <button onClick={() => updateChapter(chap._id, {isArchived: true})} className="px-5 py-3 bg-slate-50 rounded-2xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-800 hover:text-white transition-all">Archiver</button>
                                </div>
                            </div>
                            {isOpen && (
                                <div className="p-6 bg-slate-50 border-t-2 border-dashed border-slate-100">
                                    {chapItems.length > 0 ? chapItems.map(it => (
                                        <div key={it._id} className="bg-white p-3 rounded-xl mb-2 flex justify-between items-center shadow-sm">
                                            <span className="font-bold text-slate-600">{it.actType === 'game' ? '🕹️' : '📄'} {it.title}</span>
                                        </div>
                                    )) : <p className="text-center text-slate-300 italic text-sm">Aucun contenu</p>}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}