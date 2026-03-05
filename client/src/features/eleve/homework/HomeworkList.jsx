// @signatures: HomeworkList, loadData
import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({ user, openPunishmentDirect = false, onPunishmentOpened, openItemId = '', onOpenHandled }) {
  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const myId = String(user._id || user.id);
    
    try {
        const [hwRes, subRes] = await Promise.all([
          fetch(`/api/eleve/homework/list/${myId}`),
          fetch(`/api/eleve/homework/submissions/${myId}`)
        ]);
        if (!hwRes.ok) throw new Error("404");
        const data = await hwRes.json();
        const subs = subRes.ok ? await subRes.json() : [];
        const submittedByHomeworkId = new Set((subs || []).map(s => String(s.homeworkId)));

        setHomeworks(data.map(hw => ({
          ...hw,
          status: submittedByHomeworkId.has(String(hw._id)) ? 'done' : 'todo'
        })));
    } catch(e) { console.error("Err loading HW", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user]);

  useEffect(() => {
    if (!openPunishmentDirect || selectedHw) return;
    const punishment = (homeworks || []).find(h => h.isPunishment);
    if (punishment) {
      setSelectedHw(punishment);
    }
    if (onPunishmentOpened) onPunishmentOpened();
  }, [openPunishmentDirect, homeworks, selectedHw, onPunishmentOpened]);

  useEffect(() => {
    const targetId = String(openItemId || '').trim();
    if (!targetId || selectedHw) return;
    const target = (homeworks || []).find((h) => String(h?._id || '') === targetId);
    if (!target) return;
    setSelectedHw(target);
    if (onOpenHandled) onOpenHandled();
  }, [openItemId, homeworks, selectedHw, onOpenHandled]);

  if (selectedHw) return (
      <HomeworkWorkspace 
        homework={selectedHw} 
        user={user} 
        onQuit={() => { setSelectedHw(null); loadData(); }} 
      />
  );

  return (
      <div className="flex flex-col gap-4">
          <div className="flex justify-end px-4">
              <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
                  {loading ? '...' : '🔄 ACTUALISER'}
              </button>
          </div>
          <DashboardFolder items={homeworks} type="homework" onSelect={setSelectedHw} />
      </div>
  );
}
