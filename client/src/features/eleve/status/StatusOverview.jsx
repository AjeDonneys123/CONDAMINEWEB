import React, { useEffect, useRef, useState } from 'react';
import './StatusOverview.css';

export default function StatusOverview({ user, onOpenActivity }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ disciplines: [] });
  const hasLoadedOnceRef = useRef(false);
  const userId = user?._id || user?.id;

  useEffect(() => {
    const load = async () => {
      // Affiche le loader uniquement au tout premier chargement
      if (!hasLoadedOnceRef.current) setLoading(true);
      try {
        if (!userId) {
          if (!hasLoadedOnceRef.current) setData({ disciplines: [] });
          return;
        }
        const params = new URLSearchParams();
        if (user?.isVisitorPreview === true) {
          params.set('visitor', '1');
          params.set('level', String(user?.currentClass || ''));
        }
        const suffix = params.toString() ? `?${params.toString()}` : '';
        const res = await fetch(`/api/eleve/classroom/status-summary/${userId}${suffix}`);
        const json = await res.json();
        setData(json || { disciplines: [] });
        hasLoadedOnceRef.current = true;
      } catch (e) {
        // En cas d'erreur réseau ponctuelle, on garde l'ancien état affiché
        if (!hasLoadedOnceRef.current) setData({ disciplines: [] });
      } finally {
        if (!hasLoadedOnceRef.current) setLoading(false);
        else setLoading(false);
      }
    };
    load();
  }, [userId, user?.isVisitorPreview, user?.currentClass]);

  if (loading) {
    return <div className="status-page">Chargement du statut...</div>;
  }

  const disciplines = data?.disciplines || [];
  if (disciplines.length === 0) {
    return (
      <div className="status-page">
        <div className="status-empty">Aucune discipline active pour ta classe/groupe.</div>
      </div>
    );
  }

  return (
    <div className="status-page">
      <div className="status-grid">
        {disciplines.map((d) => (
          <div key={d.subject} className="status-card">
            <div className="status-title">{d.subject}</div>
            <div className="status-teachers">{(d.teachers || []).join(' • ')}</div>

            <div className="status-row">
              <span className="label">Activités</span>
              <span className="value">
                {d.activities?.done || 0}/{d.activities?.total || 0}
              </span>
            </div>

            {(d.activities?.todoItems?.length > 0) && (
              <div className="status-todo">
                <div className="mb-1">{Number(d.activities?.todo || 0) > 0 ? 'À faire:' : 'À refaire:'}</div>
                <div className="flex flex-wrap gap-2">
                  {(d.activities.todoItems || []).map((it, idx) => (
                    <button
                      key={`${it.type}_${it.id}_${idx}`}
                      type="button"
                      className="px-2 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-black text-blue-700 hover:bg-blue-50"
                      onClick={() => onOpenActivity && onOpenActivity(it)}
                    >
                      {it.label || it.title || 'Activité'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(d.activities?.savedItems?.length > 0) && (
              <div className="status-saved">
                <div className="mb-1">À refaire:</div>
                <div className="flex flex-wrap gap-2">
                  {(d.activities.savedItems || []).map((it, idx) => (
                    <button
                      key={`${it.type}_${it.id}_${idx}`}
                      type="button"
                      className="status-saved-btn"
                      onClick={() => onOpenActivity && onOpenActivity(it)}
                    >
                      {it.label || it.title || 'Activité'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
