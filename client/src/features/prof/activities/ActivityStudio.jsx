import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';

export default function ActivityStudio({ globalClass, user }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [editingItem, setEditingItem] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    const showNotify = (data) => {
        setNotification({ msg: data.message || data.error, isError: !!data.error });
        setTimeout(() => setNotification(null), 5000);
    };

    const loadData = async () => {
        if (!globalClass) return;
        setLoading(true);
        try {
            const [hwRes, gmRes, cpRes] = await Promise.all([
                fetch('/api/homework/all'),
                fetch('/api/games/all'),
                fetch('/api/structure/chapters') // ROUTE MODULAIRE
            ]);
            
            if (hwRes.ok && gmRes.ok && cpRes.ok) {
                const hw = await hwRes.json();
                const gm = await gmRes.json();
                const cp = await cpRes.json();
                
                setActivities([
                    ...hw.map(x => ({ ...x, actType: 'homework' })),
                    ...gm.map(x => ({ ...x, actType: 'game' }))
                ]);
                setChapters(cp || []);
            }
        } catch (e) { console.error("Erreur Studio:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleCreateChapter = async (subjectName, title) => {
        const res = await fetch('/api/structure/chapters', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body: JSON.stringify({ title, subject: subjectName, classroom: globalClass, teacherId: user.id || user._id }) 
        });
        if (res.ok) {
            showNotify({ message: "Chapitre créé" });
            await loadData();
        }
    };

    if (editingItem) {
        const activeChaps = chapters.filter(c => c.classroom === globalClass && !c.isArchived);
        if (editingItem.type === 'homework') return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} globalClass={globalClass} user={user} onClose={() => { setEditingItem(null); loadData(); }} />;
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={globalClass} onClose={() => { setEditingItem(null); loadData(); }} />;
    }

    return (
        <div className="animate-in fade-in relative">
            {notification && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg px-4">
                    <div className={`rounded-3xl p-4 shadow-2xl flex items-center gap-4 border-2 ${notification.isError ? 'bg-red-600 border-red-400' : 'bg-slate-900 border-emerald-500'}`}>
                        <div className="flex-1">
                            <h4 className="text-white font-black text-xs uppercase">{notification.msg}</h4>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-start gap-4 mb-8 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-sm">
                <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg"> Nouveau Devoir</button>
                <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg"> Nouveau Jeu</button>
            </div>

            {!loading ? (
                <ProfStudioFolder 
                    user={user} 
                    chapters={chapters} 
                    items={activities} 
                    classFilter={globalClass}
                    onRefresh={loadData}
                    onArchive={async (id, state) => {
                        await fetch('/api/structure/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, isArchived:state, teacherId: user.id || user._id})});
                        loadData();
                    }}
                    onRename={async (id, title, subject) => {
                        await fetch('/api/structure/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, title, classroom: globalClass, subject, teacherId: user.id || user._id})});
                        loadData();
                    }}
                    onEditItem={(it) => setEditingItem({ type: it.actType, data: it })}
                    onDeleteItem={async (id, type) => {
                        if(!confirm("Supprimer l'élément ?")) return;
                        await fetch(type === 'game' ? `/api/games/${id}` : `/api/homework/${id}`, { method: 'DELETE' });
                        loadData();
                    }}
                    onDeleteChapter={async (id) => {
                        if (!confirm("Supprimer dossier et son contenu Drive ?")) return;
                        await fetch(`/api/structure/chapters/${id}`, { method: 'DELETE' });
                        loadData();
                    }}
                    onCreateChapter={handleCreateChapter}
                    onNotify={showNotify}
                />
            ) : (
                <div className="text-center py-20 text-slate-300 font-black animate-pulse uppercase">Initialisation...</div>
            )}
        </div>
    );
}