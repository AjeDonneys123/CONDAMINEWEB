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
            const fetchJSON = async (url) => {
                const response = await fetch(url);
                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                    throw new Error(errorBody.error || `Erreur ${response.status}`);
                }
                return response.json();
            };

            const [hw, gm, cp] = await Promise.all([
                fetchJSON('/api/homework/all'),
                fetchJSON('/api/games/all'),
                fetchJSON('/api/structure/chapters')
            ]);
            
            setActivities([
                ...hw.map(x => ({...x, actType: 'homework'})), 
                ...gm.map(x => ({...x, actType: 'game'}))
            ]);
            setChapters(cp || []);
        } catch (e) { 
            console.error("❌ Erreur Fetch:", e.message);
            // Si l'erreur est "Failed to fetch", le serveur est probablement éteint
            const msg = e.message === "Failed to fetch" 
                ? "Le serveur ne répond pas. Vérifiez que 'npm run dev' est bien lancé."
                : "Erreur BDD : " + e.message;
            alert(msg);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleDeleteItem = async (id, type) => {
        if (!confirm("🗑️ Confirmer la suppression ?")) return;
        try {
            const res = await fetch(type === 'game' ? `/api/games/${id}` : `/api/homework/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Erreur lors de la suppression");
            loadData();
        } catch (e) { alert(e.message); }
    };

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
                    onEditItem={(it) => setEditingItem({type: it.actType, data: it})}
                    onDeleteItem={handleDeleteItem}
                />
            )}
        </div>
    );
}