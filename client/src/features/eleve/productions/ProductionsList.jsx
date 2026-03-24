import React, { useEffect, useState } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import ProductionWorkspace from './ProductionWorkspace';

export default function ProductionsList({ user, openItemId = '', onOpenHandled }) {
    const [items, setItems] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const id = String(user._id || user.id);
            const res = await fetch(`/api/eleve/productions/list/${id}`);
            const rows = res.ok ? await res.json() : [];
            setItems((rows || []).map((x) => ({
                ...x,
                subject: x.chapterSection || x.subject || 'GÉNÉRAL',
                status: x.status || (x.studentSubmission?.completedAt ? 'done' : 'todo')
            })));
        } catch (_) {
            setItems([]);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [user]);

    useEffect(() => {
        const targetId = String(openItemId || '').trim();
        if (!targetId || selected) return;
        const target = (items || []).find((x) => String(x?._id || '') === targetId);
        if (!target) return;
        setSelected(target);
        if (onOpenHandled) onOpenHandled();
    }, [openItemId, items, selected, onOpenHandled]);

    if (selected) {
        return <ProductionWorkspace production={selected} user={user} onQuit={() => { setSelected(null); loadData(); }} />;
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-end px-4">
                <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
                    {loading ? '...' : '🔄 ACTUALISER'}
                </button>
            </div>
            <DashboardFolder items={items} type="fiche" onSelect={setSelected} />
        </div>
    );
}
