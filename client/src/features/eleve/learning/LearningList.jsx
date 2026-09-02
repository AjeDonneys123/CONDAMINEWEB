import React, { useEffect, useState } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import LearningWorkspace from './LearningWorkspace';

export default function LearningList({ user, openItemId = '', onOpenHandled }) {
    const [modules, setModules] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const id = String(user._id || user.id);
            const visitorQuery = user?.isVisitorPreview ? `?forGames=1&level=${encodeURIComponent(user.currentClass || '')}` : '';
            const res = await fetch(`/api/eleve/learning/list/${id}${visitorQuery}`);
            const rows = res.ok ? await res.json() : [];
            setModules((rows || []).map(m => {
                const isLocked = m.isLycee && !m.isTraceEcriteValidated;
                return {
                    ...m,
                    title: isLocked ? `🔒 ${m.title}` : (m.isLycee && m.isTraceEcriteValidated ? `✓ ${m.title}` : m.title),
                    status: m.completion?.completedAt ? 'done' : 'todo',
                    subject: m.chapterSection || m.subject || 'GÉNÉRAL'
                };
            }));
        } catch (e) {
            setModules([]);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [user]);

    useEffect(() => {
        const targetId = String(openItemId || '').trim();
        if (!targetId || selected) return;
        const target = (modules || []).find((m) => String(m?._id || '') === targetId);
        if (!target) return;
        setSelected(target);
        if (onOpenHandled) onOpenHandled();
    }, [openItemId, modules, selected, onOpenHandled]);

    if (selected) {
        return (
            <LearningWorkspace
                module={selected}
                user={user}
                onQuit={() => {
                    setSelected(null);
                    loadData();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end px-4">
                <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
                    {loading ? '...' : '🔄 ACTUALISER'}
                </button>
            </div>
            <DashboardFolder items={modules} type="learning" onSelect={setSelected} />
        </div>
    );
}
