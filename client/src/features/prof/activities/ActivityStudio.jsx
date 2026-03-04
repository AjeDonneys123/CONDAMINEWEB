// @signatures: ActivityStudio, fetchJson, handleDeleteItem, loadData
import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import LearningStudio from '../learning/LearningStudio';
import ExposeStudio from '../exposes/ExposeStudio';
import ProfStudioFolder from '../components/ProfStudioFolder';

export default function ActivityStudio({ globalClass, globalClassId, globalLevel, user, onRefreshRequest }) {
    const [activities, setActivities] = useState([]);
    const [chapters, setChapters] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [allClasses, setAllClasses] = useState([]); // Ajouté
    const [editingItem, setEditingItem] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const teacherId = String(user?._id || user?.id || '').trim();
            const fetchJson = async (url) => {
                const res = await fetch(url);
                return res.ok ? await res.json() : [];
            };

            const [hw, gm, lrn, ex, sc, cp, sts, cls] = await Promise.all([
                fetchJson('/api/homework/all'),
                fetchJson('/api/games/all'),
                fetchJson('/api/learning/all'),
                fetchJson('/api/exposes/all'),
                fetchJson('/api/scans/sessions'), 
                fetchJson(`/api/structure/chapters?teacherId=${encodeURIComponent(teacherId)}&classContext=${encodeURIComponent(globalClass || '')}`),
                fetchJson('/api/admin/students'),
                fetchJson('/api/admin/classrooms') // Ajouté
            ]);
            
            setActivities([
                ...(hw || []).map(x => ({...x, actType: 'homework', typeLabel: '📝 DM'})), 
                ...(gm || []).map(x => ({...x, actType: 'game', typeLabel: '🎮 JEU'})),
                ...(lrn || []).map(x => ({...x, actType: 'learning', typeLabel: '🧠 APP'})),
                ...(ex || []).map(x => ({...x, actType: 'expose', typeLabel: '🗣️ EXP'})),
                ...(sc || []).map(x => ({...x, actType: 'scan', typeLabel: '📸 DC', title: x.title || 'Scan sans titre'})) 
            ]);
            setChapters(cp || []);
            setAllStudents(sts || []);
            setAllClasses(cls || []); // Stocké
        } catch (e) { console.error("ActivityStudio Load Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleDeleteItem = async (id, type) => {
        if (!confirm(`⚠️ Supprimer cet élément ?`)) return;
        
        let url;
        if (type === 'game') url = `/api/games/${id}`;
        else if (type === 'homework') url = `/api/homework/${id}`;
        else if (type === 'learning') url = `/api/learning/${id}`;
        else if (type === 'expose') url = `/api/exposes/${id}`;
        else if (type === 'scan') url = `/api/scans/sessions/${id}`;
        else url = `/api/structure/chapters/${id}`;

        const res = await fetch(url, { method: 'DELETE' });
        if (res.ok) loadData();
        else alert("Erreur suppression");
    };

    if (editingItem) {
        const activeSectionName = editingItem.section || editingItem.data?.subject || "GÉNÉRAL";
        const props = {
            initialData: editingItem.data,
            chapters,
            allClasses, // Transmis
            allStudents, // Transmis
            globalClass,
            globalLevel,
            targetLevel: globalLevel, 
            user,
            targetSection: activeSectionName,
            onClose: () => { setEditingItem(null); loadData(); }
        };
        if (editingItem.type === 'homework') return <HomeworkStudio {...props} />;
        if (editingItem.type === 'learning') return <LearningStudio {...props} />;
        if (editingItem.type === 'expose') return <ExposeStudio {...props} />;
        return <GameStudio {...props} />;
    }

    return (
        <div className="space-y-8 animate-in fade-in relative">
            {loading && <div className="absolute top-4 right-4 z-50 bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black animate-pulse shadow-lg">SYNCHRONISATION...</div>}
            
            <ProfStudioFolder 
                chapters={chapters} 
                items={activities} 
                studentsRef={allStudents}
                allClasses={allClasses} // Transmis
                classFilter={globalClass}
                levelFilter={globalLevel}
                user={user}
                onEditItem={(it, sectionContext) => setEditingItem({type: it.actType, data: it, section: sectionContext})}
                onCreateActivity={(type, section) => setEditingItem({ type, section })}
                onDeleteItem={handleDeleteItem}
                onRefresh={() => { loadData(); if(onRefreshRequest) onRefreshRequest(); }}
            />
        </div>
    );
}
