import React, { useState, useEffect } from 'react';

export default function ChapterManager() {
    const [chapters, setChapters] = useState([]);
    const [classFilter, setClassFilter] = useState('6D');
    const [editingId, setEditingId] = useState(null);
    const [tempTitle, setTempTitle] = useState('');

    const load = async () => {
        try {
            const res = await fetch('/api/chapters-all');
            const data = await res.json();
            setChapters(Array.isArray(data) ? data : []);
        } catch (e) { 
            console.error("Erreur chargement", e); 
            setChapters([]);
        }
    };
    
    useEffect(() => { load(); }, []);

    const createChapter = async (subjectCode) => {
        await fetch('/api/chapters', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ 
                title: '', 
                subject: subjectCode,
                classroom: classFilter 
            }) 
        });
        load();
    };

    const updateChapter = async (id, payload) => {
        await fetch('/api/chapters', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ _id: id, ...payload }) 
        });
        load();
    };

    const deleteChapter = async (id) => {
        if (!window.confirm("Supprimer ce dossier ?")) return;
        await fetch('/api/chapters/' + id, { method: 'DELETE' });
        load();
    };

    const getStyle = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s === 'H') return { code: 'H', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50', label: 'Histoire' };
        if (s === 'G') return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50', label: 'Géographie' };
        if (s === 'E') return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50', label: 'EMC' };
        return { code: '?', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-100', label: 'Inconnu' };
    };

    const myChapters = chapters.filter(c => c.classroom === classFilter);

    const renderArchiveCol = (subCode, label) => {
        const info = getStyle(subCode);
        const list = myChapters.filter(c => c.isArchived && c.subject === subCode);
        return (
            <div className="bg-slate-800/50 border-2 border-dashed border-slate-700 p-4 rounded-[30px] min-h-[140px]">
                <h4 className={`text-center font-black text-[9px] uppercase mb-4 ${info.color}`}>{label}</h4>
                <div className="space-y-2">
                    {list.map(chap => (
                        <div key={chap._id} className="bg-slate-700/50 p-3 rounded-xl flex justify-between items-center border border-slate-600">
                            <span className="text-white font-black text-[10px] truncate">{chap.title || "Sans titre"}</span>
                            <button onClick={() => updateChapter(chap._id, {isArchived: false})} className="text-white font-bold">⬆️</button>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-4">
            {/* HEADER */}
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[35px] border-2 border-orange-50 shadow-sm">
                <h2 className="font-black text-slate-800 uppercase tracking-widest text-xs">Gestion des dossiers</h2>
                <select className="bg-slate-100 p-3 rounded-xl font-black outline-none border-none" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                </select>
            </div>

            {/* ARCHIVES */}
            <div className="mb-12 bg-slate-900 p-8 rounded-[55px] border-8 border-slate-800 shadow-2xl">
                <div className="grid grid-cols-3 gap-6">
                    {renderArchiveCol('H', 'Histoire')}
                    {renderArchiveCol('G', 'Géographie')}
                    {renderArchiveCol('E', 'EMC')}
                </div>
            </div>

            {/* CREATION */}
            <div className="grid grid-cols-3 gap-6 mb-12">
                {['H', 'G', 'E'].map(s => {
                    const info = getStyle(s);
                    return (
                        <button key={s} onClick={() => createChapter(s)} className={`p-8 bg-white border-4 border-dashed rounded-[40px] font-black uppercase text-xs transition-all active:scale-95 ${info.color} ${info.border}`}>
                            + Dossier {info.label}
                        </button>
                    );
                })}
            </div>

            {/* LISTE ACTIVE */}
            <div className="space-y-4">
                {myChapters.filter(c => !c.isArchived).map(chap => {
                    const info = getStyle(chap.subject);
                    return (
                        <div key={chap._id} className={`p-6 bg-white rounded-[35px] border-2 ${info.border} flex justify-between items-center shadow-sm`}>
                            <div className="flex items-center gap-6 flex-1">
                                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${info.bg} ${info.color}`}>{info.code}</span>
                                {editingId === chap._id ? (
                                    <input 
                                        autoFocus
                                        className="text-2xl font-black border-b-4 border-orange-500 outline-none w-full bg-transparent"
                                        value={tempTitle}
                                        onChange={e => setTempTitle(e.target.value)}
                                        onBlur={() => { updateChapter(chap._id, {title: tempTitle}); setEditingId(null); }}
                                        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                                    />
                                ) : (
                                    <span className="text-2xl font-black text-slate-700 cursor-pointer flex-1" onClick={() => { setEditingId(chap._id); setTempTitle(chap.title); }}>
                                        {chap.title || <span className="text-slate-200 italic font-medium">Cliquer pour nommer...</span>}
                                    </span>
                                )}
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => updateChapter(chap._id, {isArchived: true})} className="px-5 py-3 bg-slate-50 rounded-2xl font-black text-[10px] uppercase text-slate-400 hover:bg-slate-800 hover:text-white transition-all">📦 Archiver</button>
                                <button onClick={() => deleteChapter(chap._id)} className="p-3 text-red-300 font-black hover:scale-110">✕</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}