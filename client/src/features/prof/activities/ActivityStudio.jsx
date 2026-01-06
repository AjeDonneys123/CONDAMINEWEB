import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import './ActivityStudio.css';

export default function ActivityStudio() {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [classFilter, setClassFilter] = useState('6D');
    const [tab, setTab] = useState('homework');
    const [editingItem, setEditingItem] = useState(null);

    const load = async () => {
        try {
            const [hw, gm, cp] = await Promise.all([
                fetch('/api/homework-all').then(r => r.json()),
                fetch('/api/game-levels/all').then(r => r.json()),
                fetch('/api/chapters-all').then(r => r.json())
            ]);
            const all = [
                ...(Array.isArray(hw) ? hw : []).map(x => ({ ...x, actType: 'homework' })),
                ...(Array.isArray(gm) ? gm : []).map(x => ({ ...x, actType: 'game' }))
            ];
            setActivities(all);
            setChapters(Array.isArray(cp) ? cp : []);
        } catch (e) { console.error(e); }
    };

    useEffect(() => { load(); }, []);

    const moveItem = async (itemId, chapterId, type) => {
        await fetch('/api/move-item', { 
            method: 'POST', 
            headers: {'Content-Type':'application/json'}, 
            body: JSON.stringify({ itemId, chapterId: chapterId === 'none' ? null : chapterId, type }) 
        });
        load();
    };

    const activeChapters = chapters.filter(c => c.classroom === classFilter && !c.isArchived);
    const filteredActivities = activities.filter(a => a.actType === tab && (a.classroom === classFilter || a.classroom === 'Toutes'));

    if (editingItem) {
        if (editingItem.type === 'homework') return <HomeworkStudio initialData={editingItem.data} chapters={activeChapters} onClose={() => { setEditingItem(null); load(); }} />;
        return <GameStudio initialData={editingItem.data} chapters={activeChapters} onClose={() => { setEditingItem(null); load(); }} />;
    }

    return (
        <div className="p-4 animate-in fade-in">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[35px] border shadow-sm">
                <div className="flex gap-2">
                    <button onClick={() => setTab('homework')} className={`px-8 py-3 rounded-xl font-black ${tab === 'homework' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-400'}`}>📚 DEVOIRS</button>
                    <button onClick={() => setTab('game')} className={`px-8 py-3 rounded-xl font-black ${tab === 'game' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-400'}`}>🎮 JEUX</button>
                </div>
                <select className="bg-slate-100 p-3 rounded-xl font-black" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                </select>
            </div>

            <button onClick={() => setEditingItem({ type: tab, data: null })} className={`w-full mb-10 p-8 rounded-[40px] font-black text-2xl text-white shadow-xl ${tab === 'game' ? 'bg-purple-600' : 'bg-orange-500'}`}>
                + CRÉER UN {tab === 'game' ? 'QUIZ' : 'DEVOIR'}
            </button>

            <div className="space-y-4">
                {filteredActivities.map(act => (
                    <div key={act._id} className="bg-white p-6 rounded-[35px] border-2 border-slate-50 flex justify-between items-center">
                        <div className="flex items-center gap-6">
                            <span className="text-3xl">{tab === 'game' ? '🕹️' : '📄'}</span>
                            <div>
                                <b className="text-slate-800 text-lg block">{act.title}</b>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="text-[10px] font-black text-slate-300 uppercase">Dossier :</span>
                                    <select 
                                        className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 px-3 py-1 rounded-full border-none outline-none"
                                        value={act.chapterId || 'none'}
                                        onChange={(e) => moveItem(act._id, e.target.value, act.actType)}
                                    >
                                        <option value="none">-- Aucun --</option>
                                        {activeChapters.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => setEditingItem({ type: tab, data: act })} className="px-6 py-3 bg-slate-50 text-slate-400 rounded-2xl font-bold text-xs uppercase">Éditer</button>
                             <button onClick={async () => { if(confirm("Supprimer ?")) { await fetch(tab==='game'?`/api/game-levels/${act._id}`:`/api/homework/${act._id}`, {method:'DELETE'}); load(); }}} className="text-red-400 font-bold p-2 text-xl">✕</button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}