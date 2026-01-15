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
            // US #15 : Diagnostic robuste des erreurs JSON
            const fetchJSON = async (url) => {
                const r = await fetch(url);
                if (!r.ok) {
                    const err = await r.json();
                    throw new Error(err.details || "Erreur Serveur");
                }
                return r.json();
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
            alert("Erreur de synchronisation avec la BDD : " + e.message);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleDeleteItem = async (id, type) => {
        if (!confirm("🗑️ Supprimer définitivement cet élément et son dossier Drive ?")) return;
        try {
            const res = await fetch(type === 'game' ? `/api/games/${id}` : `/api/homework/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error("Échec suppression");
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
                <button onClick={() => setEditingItem({type:'homework'})} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg hover:scale-105 transition-transform">NOUVEAU DEVOIR</button>
                <button onClick={() => setEditingItem({type:'game'})} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg hover:scale-105 transition-transform">NOUVEAU JEU</button>
            </div>
            {loading ? (
                <div className="text-center py-20 text-slate-300 font-black animate-pulse uppercase">Mise à jour...</div>
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