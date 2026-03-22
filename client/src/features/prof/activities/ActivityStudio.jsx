// @signatures: ActivityStudio, fetchJson, handleDeleteItem, loadData
import React, { useState, useEffect } from 'react';
import HomeworkStudio from '../homework/HomeworkStudio';
import GameStudio from '../games/GameStudio';
import LearningStudio from '../learning/LearningStudio';
import ExposeStudio from '../exposes/ExposeStudio';
import LectureStudio from '../lectures/LectureStudio';
import FicheStudio from '../fiches/FicheStudio';
import RevisionStudio from '../revisions/RevisionStudio';
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

            const [hw, gm, lrn, ex, lec, fic, rev, sc, cp, sts, cls] = await Promise.all([
                fetchJson('/api/homework/all'),
                fetchJson('/api/games/all'),
                fetchJson('/api/learning/all'),
                fetchJson('/api/exposes/all'),
                fetchJson('/api/lectures/all'),
                fetchJson('/api/fiches/all'),
                fetchJson('/api/revisions/all'),
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
                ...(lec || []).map(x => ({...x, actType: 'lecture', typeLabel: '📖 LEC'})),
                ...(fic || []).map(x => ({...x, actType: 'fiche', typeLabel: '🗂️ FIC'})),
                ...(rev || []).map(x => ({...x, actType: 'revision', typeLabel: '🧩 REV'})),
                ...(sc || []).map(x => ({...x, actType: 'scan', typeLabel: '📸 DC', title: x.title || 'Scan sans titre'})) 
            ]);
            setChapters(cp || []);
            setAllStudents(sts || []);
            setAllClasses(cls || []); // Stocké
        } catch (e) { console.error("ActivityStudio Load Error", e); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [globalClass]);

    const handleDeleteItem = async (id, type, title = '') => {
        const itemTypeLabel = type === 'expose'
            ? 'cet exposé'
            : type === 'learning'
                ? 'cet apprentissage'
                : type === 'lecture'
                    ? 'cette lecture'
                    : type === 'fiche'
                        ? 'cette fiche'
                        : type === 'revision'
                            ? 'cette révision'
                    : type === 'game'
                        ? 'ce jeu'
                        : type === 'homework'
                            ? 'ce devoir'
                            : 'cet élément';
        const targetLabel = String(title || '').trim();
        const message = targetLabel
            ? `⚠️ Confirmer la suppression de ${itemTypeLabel} : "${targetLabel}" ?`
            : `⚠️ Confirmer la suppression de ${itemTypeLabel} ?`;
        if (!confirm(message)) return;
        
        let url;
        if (type === 'game') url = `/api/games/${id}`;
        else if (type === 'homework') url = `/api/homework/${id}`;
        else if (type === 'learning') url = `/api/learning/${id}`;
        else if (type === 'expose') url = `/api/exposes/${id}`;
        else if (type === 'lecture') url = `/api/lectures/${id}`;
        else if (type === 'fiche') url = `/api/fiches/${id}`;
        else if (type === 'revision') url = `/api/revisions/${id}`;
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
        if (editingItem.type === 'lecture') return <LectureStudio {...props} />;
        if (editingItem.type === 'fiche') return <FicheStudio {...props} />;
        if (editingItem.type === 'revision') return <RevisionStudio {...props} />;
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
