// @signatures: HomeworkList, loadData
import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({ user, openPunishmentDirect = false, onPunishmentOpened }) {
  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const myId = String(user._id || user.id);
    
    try {
        // FIX V99 : Route HERMÉTIQUE ÉLÈVE pour les devoirs
        const res = await fetch(`/api/eleve/homework/list/${myId}`);
        if (!res.ok) throw new Error("404");
        const data = await res.json();
        
        setHomeworks(data.map(hw => ({ ...hw, status: 'todo' })));
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
