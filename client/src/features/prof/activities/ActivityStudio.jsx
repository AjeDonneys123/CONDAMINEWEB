import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';

export default function ActivityStudio({ globalClass, globalClassId, globalLevel, user, onRefreshRequest }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const fetchJson = async (url) => {
                const res = await fetch(url);
                if (!res.ok) return [];
                return res.json();
            };

            const [hw, gm, cp, sts] = await Promise.all([
                fetchJson('/api/homework/all'),
                fetchJson('/api/games/all'),
                fetchJson('/api/structure/chapters'),
                fetchJson('/api/admin/students')
            ]);
            
            setActivities([
                ...hw.map(x => ({...x, actType: 'homework', typeLabel: '📝 DM'})), 
                ...gm.map(x => ({...x, actType: 'game', typeLabel: '🎮 JEU'}))
            ]);
            setChapters(cp || []);
            setAllStudents(sts || []);
        } catch (e) { console.error("ActivityStudio Load error:", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleDeleteItem = async (id, type) => {
        if (!confirm(`⚠️ Supprimer cet élément ?`)) return;
        const url = type === 'game' ? `/api/games/${id}` : (type === 'homework' ? `/api/homework/${id}` : `/api/structure/chapters/${id}`);
        const res = await fetch(url, { method: 'DELETE' });
        if (res.ok) loadData();
    };

    if (editingItem) {
        if (editingItem.type === 'homework') {
            return (
                <HomeworkStudio 
                    initialData={editingItem.data} 
                    chapters={chapters} 
                    globalClass={globalClass} 
                    globalClassId={globalClassId} 
                    user={user} 
                    onClose={() => {setEditingItem(null); loadData();}} 
                />
            );
        }
        // FIX: Ajout de user={user} ici pour éviter le crash "reading id of undefined"
        return (
            <GameStudio 
                initialData={editingItem.data} 
                chapters={chapters} 
                classFilter={globalClass} 
                user={user} 
                onClose={() => {setEditingItem(null); loadData();}} 
            />
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in">
            <div className="flex gap-4 mb-6">
                <button onClick={() => setEditingItem({type:'homework'})} className="bg-orange-500 text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg">+ CRÉER UN DEVOIR (DM)</button>
                <button onClick={() => setEditingItem({type:'game'})} className="bg-purple-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] shadow-lg">+ CRÉER UN JEU</button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-300 font-black animate-pulse">Chargement...</div>
            ) : (
                <ProfStudioFolder 
                    chapters={chapters} 
                    items={activities} 
                    studentsRef={allStudents}
                    classFilter={globalClass}
                    levelFilter={globalLevel}
                    user={user}
                    onEditItem={(it) => setEditingItem({type: it.actType, data: it})}
                    onDeleteItem={handleDeleteItem}
                    onRefresh={() => { loadData(); if(onRefreshRequest) onRefreshRequest(); }}
                />
            )}
        </div>
    );
}