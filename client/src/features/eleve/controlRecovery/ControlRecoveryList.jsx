import React, { useEffect, useState } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import ControlRecoveryWorkspace from './ControlRecoveryWorkspace';

export default function ControlRecoveryList({ user }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const sid = String(user?._id || user?.id || '');
      const res = await fetch(`/api/eleve/control-recovery/list/${encodeURIComponent(sid)}`);
      const data = res.ok ? await res.json() : [];
      setItems((data || []).map((row) => ({
        ...row,
        title: row.title || 'RÉCUPÉRER CONTRÔLE',
        subject: row.subject || 'GÉNÉRAL',
        status: row.completedAt ? 'done' : 'todo'
      })));
    } catch (_) {
      setItems([]);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  const createNew = async () => {
    try {
      const res = await fetch('/api/eleve/control-recovery/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: user?._id || user?.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Création impossible');
      setSelected(data.item);
      loadData();
    } catch (e) {
      alert(e.message || 'Création impossible');
    }
  };

  if (selected) {
    return <ControlRecoveryWorkspace user={user} item={selected} onQuit={() => { setSelected(null); loadData(); }} onSaved={setSelected} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between px-4">
        <button onClick={createNew} className="text-[10px] font-black text-white bg-emerald-600 px-4 py-2 rounded-xl border border-emerald-700">
          + RÉCUPÉRER UN CONTRÔLE
        </button>
        <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
          {loading ? '...' : '🔄 ACTUALISER'}
        </button>
      </div>
      <DashboardFolder items={items} type="learning" onSelect={setSelected} />
    </div>
  );
}
