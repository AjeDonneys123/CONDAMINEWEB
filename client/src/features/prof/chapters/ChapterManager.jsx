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
        } catch (e) { console.error(e); }
    };
    
    useEffect(() => { load(); }, []);

    const getStyle = (sub) => {
        const s = (sub || "").toUpperCase();
        if (s === 'H') return { code: 'H', label: 'Histoire', color: 'text-red-500', border: 'border-red-500', bg: 'bg-red-50' };
        if (s === 'G') return { code: 'G', label: 'Géographie', color: 'text-blue-500', border: 'border-blue-500', bg: 'bg-blue-50' };
        if (s === 'E') return { code: 'E', label: 'EMC', color: 'text-green-500', border: 'border-green-500', bg: 'bg-green-50' };
        return { code: '?', label: 'Inconnu', color: 'text-slate-400', border: 'border-slate-300', bg: 'bg-slate-100' };
    };

    const myChapters = chapters.filter(c => c.classroom === classFilter);

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[35px] border-2 border-orange-50 shadow-sm">
                <h2 className="font-black text-slate-800 uppercase text-xs">Dossiers</h2>
                <select className="bg-slate-100 p-3 rounded-xl font-black outline-none border-none" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                </select>
            </div>
            <div className="space-y-4">
                {myChapters.filter(c => !c.isArchived).map(chap => {
                    const info = getStyle(chap.subject);
                    return (
                        <div key={chap._id} className={`p-6 bg-white rounded-[35px] border-2 ${info.border} flex justify-between items-center shadow-sm`}>
                            <div className="flex items-center gap-6">
                                <span className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl ${info.bg} ${info.color}`}>{info.code}</span>
                                <span className="text-2xl font-black text-slate-700">{chap.title || "Sans titre"}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}