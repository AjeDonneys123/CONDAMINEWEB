import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';
import HomeworkResults from '../homework/HomeworkResults';

export default function ActivityStudio() {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [classFilter, setClassFilter] = useState('6D');
    const [editingItem, setEditingItem] = useState(null); 
    const [viewingResults, setViewingResults] = useState(null);

    const load = async () => {
        try {
            const fetchJSON = (url) => fetch(url).then(r => r.ok ? r.json() : []);
            const [hwRes, gmRes, cpRes] = await Promise.all([
                fetchJSON('/api/homework-all'),
                fetchJSON('/api/game-levels/all'),
                fetchJSON('/api/chapters-all')
            ]);
            const all = [
                ...(hwRes || []).map(x => ({ ...x, actType: 'homework' })),
                ...(gmRes || []).map(x => ({ ...x, actType: 'game' }))
            ];
            setActivities(all);
            setChapters(cpRes || []);
        } catch (e) { console.error("Erreur ActivityStudio:", e); }
    };

    useEffect(() => { load(); }, []);

    if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

    if (editingItem) {
        const activeChaps = chapters.filter(c => c.classroom === classFilter && !c.isArchived);
        if (editingItem.type === 'homework') {
            return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} onClose={() => { setEditingItem(null); load(); }} />;
        }
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={classFilter} onClose={() => { setEditingItem(null); load(); }} />;
    }

    return (
        <div className="p-4 animate-in fade-in">
            <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[35px] border-2 border-slate-50 shadow-sm">
                <div className="flex gap-4">
                    <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg">+ NOUVEAU DEVOIR</button>
                    <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-xs shadow-lg">+ NOUVEAU JEU</button>
                </div>
                <select className="bg-slate-100 p-3 rounded-xl font-black text-slate-600 outline-none border-none" value={classFilter} onChange={e => setClassFilter(e.target.value)}>
                    <option value="6D">6eD</option><option value="5B">5eB</option><option value="5C">5eC</option><option value="2A">2A</option><option value="2CD">2CD</option>
                </select>
            </div>
            <ProfStudioFolder 
                chapters={chapters.filter(c => c.classroom === classFilter)}
                items={activities.filter(a => a.classroom === classFilter || a.classroom === 'Toutes')}
                classFilter={classFilter}
                onArchive={async (id, state) => {
                    await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, isArchived:state})});
                    load();
                }}
                onRename={async (id, title) => {
                    await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, title})});
                    load();
                }}
                onEditItem={(it) => setEditingItem({ type: it.actType, data: it })}
                onDeleteItem={async (id, type) => {
                    if(!confirm("Supprimer ?")) return;
                    await fetch(type === 'game' ? `/api/game-levels/${id}` : `/api/homework/${id}`, { method: 'DELETE' });
                    load();
                }}
                onDeleteChapter={async (id) => {
                    if(!confirm("Supprimer le dossier ?")) return;
                    await fetch(`/api/chapters/${id}`, { method: 'DELETE' });
                    load();
                }}
                onCreateChapter={async (subject) => {
                    await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: 'Nouveau Dossier', subject, classroom: classFilter }) });
                    load();
                }}
                onViewResults={(hw) => setViewingResults(hw)}
            />
        </div>
    );
}