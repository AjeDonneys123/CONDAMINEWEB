import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';
import HomeworkResults from '../homework/HomeworkResults';

export default function ActivityStudio({ globalClass, teacherId }) {
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

    useEffect(() => { load(); }, [globalClass]); // Reload si on change de classe

    if (viewingResults) return <HomeworkResults homework={viewingResults} onBack={() => setViewingResults(null)} />;

    const normalize = (c) => c?.toString().toUpperCase().replace('E', '') || "";

    if (editingItem) {
        // Pour l'éditeur, on envoie les chapitres de la classe active
        const activeChaps = chapters.filter(c => normalize(c.classroom) === normalize(globalClass) && !c.isArchived);
        if (editingItem.type === 'homework') {
            return <HomeworkStudio initialData={editingItem.data} chapters={activeChaps} onClose={() => { setEditingItem(null); load(); }} />;
        }
        return <GameStudio initialData={editingItem.data} chapters={activeChaps} classFilter={globalClass} onClose={() => { setEditingItem(null); load(); }} />;
    }

    return (
        <div className="animate-in fade-in">
            {/* BARRE D'ACTIONS RAPIDES */}
            <div className="flex justify-start gap-4 mb-8 bg-white p-4 rounded-[30px] border-2 border-slate-50 shadow-sm">
                <button onClick={() => setEditingItem({ type: 'homework', data: null })} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Nouveau Devoir</button>
                <button onClick={() => setEditingItem({ type: 'game', data: null })} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all">+ Nouveau Jeu</button>
            </div>

            <ProfStudioFolder 
                chapters={chapters} // On envoie TOUT, le composant fils filtrera
                items={activities}
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
                    const res = await fetch('/api/chapters', { 
                        method:'POST', 
                        headers:{'Content-Type':'application/json'}, 
                        body: JSON.stringify({ title: 'Nouveau Dossier', subject, classroom: globalClass }) 
                    });
                    const newChap = await res.json();
                    load();
                    return newChap; // IMPORTANT : Retourne l'objet pour l'auto-focus
                }}
                onViewResults={(hw) => setViewingResults(hw)}
            />
        </div>
    );
}