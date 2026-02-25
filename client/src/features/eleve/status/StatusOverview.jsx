import React, { useEffect, useState } from 'react';
import './StatusOverview.css';

export default function StatusOverview({ user }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ disciplines: [] });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const id = user?._id || user?.id;
        if (!id) {
          setData({ disciplines: [] });
          return;
        }
        const res = await fetch(`/api/eleve/classroom/status-summary/${id}`);
        const json = await res.json();
        setData(json || { disciplines: [] });
      } catch (e) {
        setData({ disciplines: [] });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

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
              <span className="label">Croix</span>
              <span className="value cross">{d.crosses || 0}</span>
              <span className="label">Bonus</span>
              <span className="value bonus">{d.bonuses || 0}</span>
            </div>

            <div className="status-row">
              <span className="label">Devoirs</span>
              <span className="value">
                {d.homework?.done || 0}/{d.homework?.total || 0}
              </span>
              <span className="label">Jeux</span>
              <span className="value">
                {(d.games?.done || 0) + (d.games?.started || 0)}/{d.games?.total || 0}
              </span>
            </div>

            {(d.homework?.todoTitles?.length > 0 || d.games?.todoTitles?.length > 0) && (
              <div className="status-todo">
                {d.homework?.todoTitles?.length > 0 && (
                  <div>📚 À faire: {d.homework.todoTitles.join(', ')}</div>
                )}
                {d.games?.todoTitles?.length > 0 && (
                  <div>🎮 À lancer: {d.games.todoTitles.join(', ')}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}