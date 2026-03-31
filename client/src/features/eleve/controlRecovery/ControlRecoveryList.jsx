import React, { useEffect, useState } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import ControlRecoveryWorkspace from './ControlRecoveryWorkspace';
import ProductionsList from '../productions/ProductionsList';
import HomeworkList from '../homework/HomeworkList';
import LearningList from '../learning/LearningList';
import CommentsList from '../comments/CommentsList';
import ExposeList from '../exposes/ExposeList';
import LectureList from '../lectures/LectureList';
import FicheList from '../fiches/FicheList';
import RevisionList from '../revisions/RevisionList';

export default function ControlRecoveryList({ user, pendingActivity, openPunishmentDirect = false, onPunishmentOpened, onActivityHandled }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [latchedPendingActivity, setLatchedPendingActivity] = useState(null);

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

  useEffect(() => {
    const nextId = String(pendingActivity?.id || '').trim();
    const nextType = String(pendingActivity?.type || '').trim();
    if (!nextId || !nextType) return;
    setLatchedPendingActivity(pendingActivity);
  }, [pendingActivity]);

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

  const handleDelete = async (item) => {
    if (!item?._id) return;
    if (!window.confirm("Êtes vous sur de vouloir supprimer ce devoir ?")) return;
    try {
      const res = await fetch(`/api/eleve/control-recovery/${encodeURIComponent(item._id)}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Suppression impossible');
      if (selected && String(selected._id) === String(item._id)) setSelected(null);
      await loadData();
    } catch (e) {
      alert(e.message || 'Suppression impossible');
    }
  };

  if (selected) {
    return <ControlRecoveryWorkspace user={user} item={selected} onQuit={() => { setSelected(null); loadData(); }} onSaved={setSelected} />;
  }

  const effectivePendingActivity = pendingActivity?.id ? pendingActivity : latchedPendingActivity;
  const pendingType = String(effectivePendingActivity?.type || '').trim();

  const renderPendingActivity = () => {
    if (pendingType === 'homework') {
      return (
        <HomeworkList
          user={user}
          openPunishmentDirect={openPunishmentDirect}
          onPunishmentOpened={onPunishmentOpened}
          openItemId={effectivePendingActivity?.type === 'homework' && effectivePendingActivity?.id !== '__punishment__' ? effectivePendingActivity?.id : ''}
          onOpenHandled={() => onActivityHandled?.('homework')}
        />
      );
    }
    if (pendingType === 'learning') {
      return <LearningList user={user} openItemId={effectivePendingActivity?.type === 'learning' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('learning')} />;
    }
    if (pendingType === 'production') {
      return <ProductionsList user={user} openItemId={effectivePendingActivity?.type === 'production' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('production')} />;
    }
    if (pendingType === 'comment') {
      return <CommentsList user={user} openItemId={effectivePendingActivity?.type === 'comment' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('comment')} />;
    }
    if (pendingType === 'lecture') {
      return <LectureList user={user} openItemId={effectivePendingActivity?.type === 'lecture' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('lecture')} />;
    }
    if (pendingType === 'fiche') {
      return <FicheList user={user} openItemId={effectivePendingActivity?.type === 'fiche' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('fiche')} />;
    }
    if (pendingType === 'revision') {
      return <RevisionList user={user} openItemId={effectivePendingActivity?.type === 'revision' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('revision')} />;
    }
    if (pendingType === 'expose') {
      return <ExposeList user={user} openItemId={effectivePendingActivity?.type === 'expose' ? effectivePendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('expose')} />;
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between px-4">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          {pendingType ? 'Activité ouverte depuis Status' : 'Mes récupérations'}
        </div>
        <div className="flex gap-2">
          {!pendingType && (
            <button onClick={createNew} className="text-[10px] font-black text-white bg-emerald-600 px-4 py-2 rounded-xl border border-emerald-700">
              + RÉCUPÉRER UN CONTRÔLE
            </button>
          )}
          <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
            {loading ? '...' : '🔄 ACTUALISER'}
          </button>
        </div>
      </div>
      {pendingType
        ? renderPendingActivity()
        : <DashboardFolder items={items} type="learning" onSelect={setSelected} onDelete={handleDelete} />}
    </div>
  );
}
