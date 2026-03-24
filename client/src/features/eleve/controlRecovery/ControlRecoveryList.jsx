import React, { useEffect, useState } from 'react';
import DashboardFolder from '../components/DashboardFolder';
import ControlRecoveryWorkspace from './ControlRecoveryWorkspace';
import HomeworkList from '../homework/HomeworkList';
import LearningList from '../learning/LearningList';
import ExposeList from '../exposes/ExposeList';
import LectureList from '../lectures/LectureList';
import FicheList from '../fiches/FicheList';
import ProductionsList from '../productions/ProductionsList';
import RevisionList from '../revisions/RevisionList';

const ACTIVITY_TABS = [
  { id: 'homework', label: '📚 Devoirs' },
  { id: 'production', label: '🏗️ Productions' },
  { id: 'learning', label: '🧠 Apprentissage' },
  { id: 'lecture', label: '📖 Lectures' },
  { id: 'fiche', label: '🗂️ Fiches' },
  { id: 'revision', label: '🧩 Révisions' },
  { id: 'expose', label: '🗣️ Exposés' },
  { id: 'recovery', label: '📝 Récupérations' }
];

export default function ControlRecoveryList({ user, pendingActivity, openPunishmentDirect = false, onPunishmentOpened, onActivityHandled }) {
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('homework');

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
    const type = String(pendingActivity?.type || '').trim();
    if (!type) return;
    if (type === 'homework' || type === 'production' || type === 'learning' || type === 'lecture' || type === 'fiche' || type === 'revision' || type === 'expose') {
      setActiveSection(type);
    }
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

  const renderSection = () => {
    if (activeSection === 'homework') {
      return (
        <HomeworkList
          user={user}
          openPunishmentDirect={openPunishmentDirect}
          onPunishmentOpened={onPunishmentOpened}
          openItemId={pendingActivity?.type === 'homework' && pendingActivity?.id !== '__punishment__' ? pendingActivity?.id : ''}
          onOpenHandled={() => onActivityHandled?.('homework')}
        />
      );
    }
    if (activeSection === 'learning') {
      return <LearningList user={user} openItemId={pendingActivity?.type === 'learning' ? pendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('learning')} />;
    }
    if (activeSection === 'production') {
      return <ProductionsList user={user} openItemId={pendingActivity?.type === 'production' ? pendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('production')} />;
    }
    if (activeSection === 'lecture') {
      return <LectureList user={user} openItemId={pendingActivity?.type === 'lecture' ? pendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('lecture')} />;
    }
    if (activeSection === 'fiche') {
      return <FicheList user={user} openItemId={pendingActivity?.type === 'fiche' ? pendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('fiche')} />;
    }
    if (activeSection === 'revision') {
      return <RevisionList user={user} openItemId={pendingActivity?.type === 'revision' ? pendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('revision')} />;
    }
    if (activeSection === 'expose') {
      return <ExposeList user={user} openItemId={pendingActivity?.type === 'expose' ? pendingActivity?.id : ''} onOpenHandled={() => onActivityHandled?.('expose')} />;
    }
    return <DashboardFolder items={items} type="learning" onSelect={setSelected} onDelete={handleDelete} />;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="px-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
          <div className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">Accès élève</div>
          <div className="mt-2 text-2xl font-black text-slate-800">Toutes les activités passent par ici</div>
          <div className="mt-2 text-sm font-semibold text-slate-500">Choisis une activité ou ouvre une récupération de contrôle. Les anciens onglets séparés ont été retirés pour éviter les doublons.</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {ACTIVITY_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`rounded-2xl border px-4 py-3 text-[12px] font-black transition ${activeSection === tab.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-between px-4">
        <div className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
          {activeSection === 'recovery' ? 'Mes récupérations' : 'Activité sélectionnée'}
        </div>
        <div className="flex gap-2">
          {activeSection === 'recovery' && (
            <button onClick={createNew} className="text-[10px] font-black text-white bg-emerald-600 px-4 py-2 rounded-xl border border-emerald-700">
              + RÉCUPÉRER UN CONTRÔLE
            </button>
          )}
          <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
            {loading ? '...' : '🔄 ACTUALISER'}
          </button>
        </div>
      </div>
      {renderSection()}
    </div>
  );
}
