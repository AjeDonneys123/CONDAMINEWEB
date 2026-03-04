import React, { useEffect, useState } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import ExposeWorkspace from './ExposeWorkspace';

export default function ExposeList({ user }) {
    const [exposes, setExposes] = useState([]);
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const id = String(user._id || user.id);
            const res = await fetch(`/api/eleve/exposes/list/${id}`);
            const rows = res.ok ? await res.json() : [];
            setExposes((rows || []).map((x) => ({
                ...x,
                status: x.studentSubmission?.updatedAt ? 'done' : 'todo',
                subject: x.chapterSection || x.subject || 'GÉNÉRAL'
            })));
        } catch (e) {
            setExposes([]);
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [user]);

    if (selected) {
        return (
            <ExposeWorkspace
                expose={selected}
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
            <DashboardFolder items={exposes} type="expose" onSelect={setSelected} />
        </div>
    );
}
