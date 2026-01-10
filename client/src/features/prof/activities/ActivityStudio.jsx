import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';
import HomeworkResults from '../homework/HomeworkResults';

export default function ActivityStudio({ globalClass }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
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

    // Normalisation pour le filtrage (ex: "6D" matchera "6eD")
    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";

    if (editingItem) {
        const activeChaps = chapters.filter(c => normalize(c.classroom) === normalize(globalClass) && !c.isArchived);
        if (editingItem.type === 'homework') {
            return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} onClose={() => { setEditingItem(null); load(); }} />;
        }
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={globalClass} onClose={() => { setEditingItem(null); load(); }} />;
    }

    // Filtrage des données selon la classe sélectionnée en haut de page
    const filteredChapters = chapters.filter(c => normalize(c.classroom) === normalize(globalClass));
    const filteredActivities = activities.filter(a => normalize(a.classroom) === normalize(globalClass) || a.classroom === 'Toutes');

    return (
        <div className="animate-in fade-in">
            {/* BARRE D'ACTIONS RAPIDES (Sans le sélecteur de classe qui est déjà en haut) */}
            <div className="flex justify-start gap-4 mb-8 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-sm">
                <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Nouveau Devoir</button>
                <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Nouveau Jeu</button>
            </div>

            <ProfStudioFolder 
                chapters={filteredChapters}
                items={filteredActivities}
                classFilter={globalClass}
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
                    if(!confirm("Supprimer cet élément ?")) return;
                    await fetch(type === 'game' ? `/api/game-levels/${id}` : `/api/homework/${id}`, { method: 'DELETE' });
                    load();
                }}
                onDeleteChapter={async (id) => {
                    if(!confirm("Supprimer le dossier complet sur Drive et en BDD ?")) return;
                    await fetch(`/api/chapters/${id}`, { method: 'DELETE' });
                    load();
                }}
                onCreateChapter={async (subject) => {
                    await fetch('/api/chapters', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: 'Nouveau Dossier', subject, classroom: globalClass }) });
                    load();
                }}
                onViewResults={(hw) => setViewingResults(hw)}
            />
        </div>
    );
}