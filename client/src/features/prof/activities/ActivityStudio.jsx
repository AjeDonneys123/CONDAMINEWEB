import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';
import HomeworkResults from '../homework/HomeworkResults';

export default function ActivityStudio({ globalClass, user }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [editingItem, setEditingItem] = useState(null); 
    const [loading, setLoading] = useState(true);
    const [notification, setNotification] = useState(null);

    const showNotify = (msg, path) => {
        setNotification({ msg, path });
        setTimeout(() => setNotification(null), 5000);
    };

    const loadData = async () => {
        if (!globalClass) return;
        setLoading(true);
        try {
            const [hwRes, gmRes, cpRes] = await Promise.all([
                fetch('/api/homework/all'),
                fetch('/api/games/all'),
                fetch('/api/chapters-all')
            ]);
            if (hwRes.ok && gmRes.ok && cpRes.ok) {
                const hw = await hwRes.json();
                const gm = await gmRes.json();
                const cp = await cpRes.json();
                setActivities([...hw.map(x => ({ ...x, actType: 'homework' })), ...gm.map(x => ({ ...x, actType: 'game' }))]);
                setChapters(cp);
            }
        } catch (e) { console.error(e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleCreateChapter = async (subjectName, title) => {
        const res = await fetch('/api/chapters', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body: JSON.stringify({ title, subject: subjectName, classroom: globalClass, teacherId: user.id || user._id }) 
        });
        const data = await res.json();
        if (res.ok) {
            showNotify(data.message, data.drivePath);
            await loadData();
        }
    };

    const handleRenameChapter = async (id, title, subject) => {
        const res = await fetch('/api/chapters', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body:JSON.stringify({_id:id, title, classroom: globalClass, subject})
        });
        const data = await res.json();
        if (res.ok) {
            showNotify(data.message, data.drivePath);
            await loadData();
        }
    };

    const handleDeleteChapter = async (id) => {
        if (!confirm("Supprimer ce dossier et son contenu Drive ?")) return;
        const res = await fetch(`/api/chapters/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            showNotify(data.message, data.drivePath);
            await loadData();
        }
    };

    if (editingItem) {
        const activeChaps = chapters.filter(c => c.classroom === globalClass && !c.isArchived);
        if (editingItem.type === 'homework') return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} globalClass={globalClass} onClose={() => { setEditingItem(null); loadData(); }} />;
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={globalClass} onClose={() => { setEditingItem(null); loadData(); }} />;
    }

    return (
        <div className="animate-in fade-in relative">
            {notification && (
                <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-xl px-4 animate-in slide-in-from-top-4">
                    <div className="bg-slate-900 border-2 border-emerald-500 rounded-3xl p-5 shadow-2xl flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-2xl">✅</div>
                        <div className="flex-1">
                            <h4 className="text-white font-black text-sm uppercase">{notification.msg}</h4>
                            <p className="text-emerald-400 font-mono text-[10px] break-all tracking-tighter mt-1">{notification.path}</p>
                        </div>
                        <button onClick={() => setNotification(null)} className="text-slate-500 font-bold">✕</button>
                    </div>
                </div>
            )}

            <div className="flex justify-start gap-4 mb-8 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-sm">
                <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform"> Nouveau Devoir</button>
                <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-transform"> Nouveau Jeu</button>
            </div>

            {!loading && (
                <ProfStudioFolder 
                    user={user} chapters={chapters} items={activities} classFilter={globalClass}
                    onArchive={async (id, state) => {
                        await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({_id:id, isArchived:state})});
                        loadData();
                    }}
                    onRename={handleRenameChapter}
                    onEditItem={(it) => setEditingItem({ type: it.actType, data: it })}
                    onDeleteItem={async (id, type) => {
                        if(!confirm("Supprimer ?")) return;
                        const endpoint = type === 'game' ? `/api/games/${id}` : `/api/homework/${id}`;
                        await fetch(endpoint, { method: 'DELETE' });
                        loadData();
                    }}
                    onDeleteChapter={handleDeleteChapter}
                    onCreateChapter={handleCreateChapter}
                    onNotify={showNotify}
                />
            )}
        </div>
    );
}