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
        } catch (e) { console.error("Load error:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    // CRÉATION INSTANTANÉE (Optimistic UI)
    const handleCreateChapter = async (subjectName, title) => {
        // ID temporaire pour l'affichage immédiat
        const tempId = "temp-" + Date.now();
        const newTempChapter = {
            _id: tempId,
            title: title || "Nouveau Dossier",
            subject: subjectName,
            classroom: globalClass,
            isArchived: false
        };

        // 1. Ajout immédiat à la liste (UI ultra réactive)
        setChapters(prev => [newTempChapter, ...prev]);

        try {
            const res = await fetch('/api/chapters', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body: JSON.stringify({ title, subject: subjectName, classroom: globalClass, teacherId: user?.id || user?._id }) 
            });
            const finalData = await res.json();
            
            // 2. Remplacer l'item temporaire par le vrai item (avec son vrai ID BDD)
            setChapters(prev => prev.map(c => c._id === tempId ? finalData : c));
        } catch (e) {
            console.error(e);
            loadData(); // En cas d'erreur, on reset proprement
        }
    };

    const handleRenameChapter = async (id, title) => {
        setChapters(prev => prev.map(c => c._id === id ? { ...c, title } : c));
        try {
            await fetch('/api/chapters', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body:JSON.stringify({_id:id, title})
            });
        } catch (e) { loadData(); }
    };

    const handleDeleteChapter = async (id) => {
        if (!confirm("Supprimer ce dossier ?")) return;
        setChapters(prev => prev.filter(c => c._id !== id));
        await fetch(`/api/chapters/${id}`, { method: 'DELETE' });
    };

    if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;
    if (editingItem) {
        const activeChaps = chapters.filter(c => c.classroom === globalClass && !c.isArchived);
        if (editingItem.type === 'homework') return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} onClose={() => { setEditingItem(null); loadData(); }} />;
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={globalClass} onClose={() => { setEditingItem(null); loadData(); }} />;
    }

    return (
        <div className="animate-in fade-in">
            <div className="flex justify-start gap-4 mb-8 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-sm">
                <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform"> Nouveau Devoir</button>
                <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform"> Nouveau Jeu</button>
            </div>

            {loading && chapters.length === 0 ? <div className="text-center py-20 text-slate-300 font-black animate-pulse uppercase italic">Chargement...</div> : (
                <ProfStudioFolder 
                    user={user} chapters={chapters} items={activities} classFilter={globalClass}
                    onArchive={async (id, state) => {
                        setChapters(prev => prev.map(c => c._id === id ? { ...c, isArchived: state } : c));
                        await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, isArchived:state})});
                    }}
                    onRename={handleRenameChapter}
                    onEditItem={(it) => setEditingItem({ type: it.actType, data: it })}
                    onDeleteItem={async (id, type) => {
                        if(!confirm("Supprimer ?")) return;
                        setActivities(prev => prev.filter(a => a._id !== id));
                        const endpoint = type === 'game' ? `/api/game-levels/${id}` : `/api/homework/${id}`;
                        await fetch(endpoint, { method: 'DELETE' });
                    }}
                    onDeleteChapter={handleDeleteChapter}
                    onCreateChapter={handleCreateChapter}
                />
            )}
        </div>
    );
}