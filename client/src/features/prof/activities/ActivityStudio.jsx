import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';

export default function ActivityStudio({ globalClass, user }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [editingItem, setEditingItem] = useState(null);

    const loadData = async () => {
        const [hw, gm, cp] = await Promise.all([
            fetch('/api/homework/all').then(r => r.json()),
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/structure/chapters').then(r => r.json())
        ]);
        setActivities([...hw.map(x => ({...x, actType: 'homework'})), ...gm.map(x => ({...x, actType: 'game'}))]);
        setChapters(cp);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    if (editingItem) {
        if (editingItem.type === 'homework') return <HomeworkStudio initialData={editingItem.data} chapters={chapters} globalClass={globalClass} user={user} onClose={() => {setEditingItem(null); loadData();}} />;
        return <GameStudio initialData={editingItem.data} chapters={chapters} classFilter={globalClass} onClose={() => {setEditingItem(null); loadData();}} />;
    }

    return (
        <div className="space-y-8">
            <div className="flex gap-4">
                <button onClick={() => setEditingItem({type:'homework'})} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px]">NOUVEAU DEVOIR</button>
                <button onClick={() => setEditingItem({type:'game'})} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px]">NOUVEAU JEU</button>
            </div>
            <ProfStudioFolder 
                user={user} chapters={chapters} items={activities} classFilter={globalClass}
                onRefresh={loadData} onEditItem={(it) => setEditingItem({type: it.actType, data: it})}
            />
        </div>
    );
}