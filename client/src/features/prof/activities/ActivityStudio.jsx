// @signatures: ActivityStudio, fetchJson, handleDeleteItem, loadData
import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';

export default function ActivityStudio({ globalClass, globalClassId, globalLevel, user, onRefreshRequest }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]);
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const fetchJson = async (url) => {
                const res = await fetch(url);
                return res.ok ? await res.json() : [];
            };

            const [hw, gm, sc, cp, sts, cls] = await Promise.all([
                fetchJson('/api/homework/all'),
                fetchJson('/api/games/all'),
                fetchJson('/api/scans/sessions'), 
                fetchJson('/api/structure/chapters'),
                fetchJson('/api/admin/students'),
                fetchJson('/api/admin/classrooms')
            ]);
            
            setActivities([
                ...(hw || []).map(x => ({...x, actType: 'homework', typeLabel: '📝 DM'})), 
                ...(gm || []).map(x => ({...x, actType: 'game', typeLabel: '🎮 JEU'})),
                ...(sc || []).map(x => ({...x, actType: 'scan', typeLabel: '📸 DC', title: x.title || 'Scan sans titre'})) 
            ]);
            setChapters(cp || []);
            setAllStudents(sts || []);
            setAllClasses(cls || []);
        } catch (e) { console.error("ActivityStudio Load Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleDeleteItem = async (id, type) => {
        if (!confirm(`⚠️ Supprimer cet élément ?`)) return;
        const url = type === 'game' ? `/api/games/${id}` 
                  : (type === 'homework' ? `/api/homework/${id}` 
                  : (type === 'scan' ? `/api/scans/sessions/${id}` 
                  : `/api/structure/chapters/${id}`));
        const res = await fetch(url, { method: 'DELETE' });
        if (res.ok) loadData();
    };

    if (editingItem) {
        const props = {
            initialData: editingItem.data,
            chapters,
            globalClass,
            globalLevel,
            user,
            targetSection: editingItem.section,
            onClose: () => { setEditingItem(null); loadData(); }
        };
        return editingItem.type === 'homework' ? <HomeworkStudio {...props} /> : <GameStudio {...props} />;
    }

    return (
        <div className="space-y-8 animate-in fade-in relative">
            {loading && <div className="absolute top-4 right-4 z-50 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse shadow-lg">SYNCHRONISATION...</div>}
            
            <ProfStudioFolder 
                chapters={chapters} 
                items={activities} 
                studentsRef={allStudents}
                allClasses={allClasses}
                classFilter={globalClass}
                levelFilter={globalLevel}
                user={user}
                onEditItem={(it) => setEditingItem({type: it.actType, data: it})}
                onCreateActivity={(type, section) => setEditingItem({ type, section })}
                onDeleteItem={handleDeleteItem}
                onRefresh={() => { loadData(); if(onRefreshRequest) onRefreshRequest(); }}
            />
        </div>
    );
}
