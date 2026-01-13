import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';
import HomeworkResults from '../homework/HomeworkResults';

export default function ActivityStudio({ globalClass, user }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [editingItem, setEditingItem] = useState(null); 
    const [viewingResults, setViewingResults] = useState(null);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        setLoading(true);
        try {
            const [hwRes, gmRes, cpRes] = await Promise.all([
                fetch('/api/homework-all').then(r => r.json()),
                fetch('/api/game-levels/all').then(r => r.json()),
                fetch('/api/chapters-all').then(r => r.json())
            ]);
            
            setActivities([
                ...(Array.isArray(hwRes) ? hwRes : []).map(x => ({ ...x, actType: 'homework' })),
                ...(Array.isArray(gmRes) ? gmRes : []).map(x => ({ ...x, actType: 'game' }))
            ]);
            setChapters(Array.isArray(cpRes) ? cpRes : []);
        } catch (e) { console.error("Erreur chargement Studio:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

    if (editingItem) {
        const activeChaps = chapters.filter(c => c.classroom === globalClass && !c.isArchived);
        if (editingItem.type === 'homework') {
            return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} onClose={() => { setEditingItem(null); loadData(); }} />;
        }
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={globalClass} onClose={() => { setEditingItem(null); loadData(); }} />;
    }

    const handleCreateChapter = async (subjectName) => {
        try {
            const res = await fetch('/api/chapters', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body: JSON.stringify({ 
                    title: 'Nouveau Dossier', 
                    subject: subjectName, 
                    classroom: globalClass, 
                    teacherId: user?.id || user?._id 
                }) 
            });
            if (res.ok) await loadData();
        } catch (e) { console.error(e); }
    };

    return (
        <div className="animate-in fade-in">
            <div className="flex justify-start gap-4 mb-8 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-sm">
                <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg"> Nouveau Devoir</button>
                <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg"> Nouveau Jeu</button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-300 font-black animate-pulse uppercase">Récupération des dossiers...</div>
            ) : (
                <ProfStudioFolder 
                    user={user}
                    chapters={chapters}
                    items={activities}
                    classFilter={globalClass}
                    onArchive={async (id, state) => {
                        await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, isArchived:state})});
                        loadData();
                    }}
                    onRename={async (id, title) => {
                        await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, title})});
                        loadData();
                    }}
                    onEditItem={(it) => setEditingItem({ type: it.actType, data: it })}
                    onDeleteItem={async (id, type) => {
                        if(!confirm("Supprimer cet élément ?")) return;
                        const endpoint = type === 'game' ? `/api/game-levels/${id}` : `/api/homework/${id}`;
                        await fetch(endpoint, { method: 'DELETE' });
                        loadData();
                    }}
                    onDeleteChapter={async (id) => {
                        if(!confirm("Supprimer ce dossier ?")) return;
                        await fetch(`/api/chapters/${id}`, { method: 'DELETE' });
                        loadData();
                    }}
                    onCreateChapter={handleCreateChapter}
                />
            )}
        </div>
    );
}