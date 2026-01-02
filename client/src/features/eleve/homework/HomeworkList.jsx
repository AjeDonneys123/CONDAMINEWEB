import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import HomeworkWorkspace from './HomeworkWorkspace';

export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const data = await api.getHomeworks(user.classroom);
      setHomeworks(data || []);
      setLoading(false);
    };
    if (!selectedHw) load();
  }, [user.classroom, selectedHw]);

  if (selectedHw) {
    return (
      <div className="animate-in fade-in zoom-in duration-300">
        <button onClick={() => setSelectedHw(null)} className="mb-4 bg-white px-6 py-2 rounded-xl font-bold shadow-sm border text-slate-500 hover:text-red-500 transition-all">← QUITTER</button>
        <HomeworkWorkspace homework={selectedHw} user={user} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {loading ? (
        <p className="text-center py-20 font-bold text-slate-300 animate-pulse text-xl uppercase">Chargement des devoirs...</p>
      ) : homeworks.length > 0 ? (
        homeworks.map(hw => (
          <div key={hw._id} onClick={() => setSelectedHw(hw)} className="bg-white p-6 rounded-[32px] border border-slate-100 flex justify-between items-center group hover:border-blue-400 hover:shadow-xl transition-all cursor-pointer">
            <div>
              <h3 className="text-xl font-black text-slate-800">{hw.title}</h3>
              <p className="text-slate-400 font-bold text-xs uppercase">{new Date(hw.date).toLocaleDateString()}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all font-black">➔</div>
          </div>
        ))
      ) : (
        <div className="p-20 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100 font-bold text-slate-300 text-xl text-center">Aucun devoir en cours ! 🎉</div>
      )}
    </div>
  );
}