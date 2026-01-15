import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';

export default function ActivityStudio({ globalClass, user }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const [hw, gm, cp] = await Promise.all([
                fetch('/api/homework/all').then(r => r.json()),
                fetch('/api/games/all').then(r => r.json()),
                fetch('/api/structure/chapters').then(r => r.json())
            ]);
            setActivities([...hw.map(x => ({...x, actType: 'homework'})), ...gm.map(x => ({...x, actType: 'game'}))]);
            setChapters(cp || []);
        } catch (e) { console.error("❌ ActivityStudio Load error:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    if (editingItem) {
        if (editingItem.type === 'homework') return <HomeworkStudio initialData={editingItem.data} chapters={chapters} globalClass={globalClass} user={user} onClose={() => {setEditingItem(null); loadData();}} />;
        return <GameStudio initialData={editingItem.data} chapters={chapters} classFilter={globalClass} onClose={() => {setEditingItem(null); loadData();}} />;
    }

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex gap-4 mb-6">
                <button onClick={() => setEditingItem({type:'homework'})} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg">NOUVEAU DEVOIR</button>
                <button onClick={() => setEditingItem({type:'game'})} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg">NOUVEAU JEU</button>
            </div>
            {loading ? (
                <div className="text-center py-20 text-slate-300 font-black animate-pulse uppercase">Synchronisation...</div>
            ) : (
                <ProfStudioFolder 
                    chapters={chapters} 
                    items={activities} 
                    classFilter={globalClass}
                    user={user}
                    onEditItem={(it) => setEditingItem({type: it.actType, data: it})}
                    onDeleteItem={async (id, type) => {
                        if(confirm('Supprimer ?')) {
                            await fetch(type==='game'?`/api/games/${id}`:`/api/homework/${id}`, {method:'DELETE'});
                            loadData();
                        }
                    }}
                    onRefresh={loadData}
                />
            )}
        </div>
    );
}