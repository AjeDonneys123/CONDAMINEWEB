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
        <button onClick={() => setSelectedHw(null)} className="mb-4 bg-white px-6 py-2 rounded-xl font-bold shadow-sm border text-pink-500 border-pink-100 hover:bg-pink-50 transition-all">← RETOUR</button>
        <HomeworkWorkspace homework={selectedHw} user={user} onQuit={() => setSelectedHw(null)} />
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {loading ? (
        <p className="text-center py-20 font-bold text-pink-300 animate-pulse text-xl uppercase">Chargement des devoirs...</p>
      ) : homeworks.length > 0 ? (
        homeworks.map(hw => (
          <div key={hw._id} onClick={() => setSelectedHw(hw)} className="bg-white p-6 rounded-[32px] border-2 border-transparent flex justify-between items-center group hover:border-pink-400 hover:shadow-xl transition-all cursor-pointer shadow-sm">
            <div>
              <h3 className="text-xl font-black text-slate-800">{hw.title}</h3>
              <p className="text-pink-400 font-bold text-xs uppercase">{new Date(hw.date).toLocaleDateString()}</p>
            </div>
            <div className="w-12 h-12 bg-pink-50 text-pink-400 rounded-2xl flex items-center justify-center group-hover:bg-pink-600 group-hover:text-white transition-all font-black">➔</div>
          </div>
        ))
      ) : (
        <div className="p-12 text-center bg-white rounded-[30px] border-4 border-dashed border-pink-100">
            <span className="text-4xl mb-4 block">🌸</span>
            <p className="font-bold text-pink-400 text-lg">Aucun devoir en cours !</p>
            <p className="text-xs text-pink-300 mt-2 font-medium">C'est le moment de se détendre.</p>
        </div>
      )}
    </div>
  );
}