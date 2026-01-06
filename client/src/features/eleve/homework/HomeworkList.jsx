import React, { useState, useEffect } from 'react';
import { api } from '../../../services/api';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [hwData, chapData] = await Promise.all([
            api.getHomeworks(user.classroom),
            fetch('/api/chapters-all').then(r => r.json())
        ]);
        
        const myId = user.id || user._id;
        const userClass = user.classroom.toString().trim(); // ex: "6D"
        const userGrade = userClass.substring(0, 2).toLowerCase(); // ex: "6e"

        // FILTRAGE ROBUSTE
        const filteredHw = (hwData || []).filter(h => {
            // 1. Match par classe (ex: "6D")
            const classMatch = h.classroom === 'Toutes' || h.classroom === userClass;
            // 2. Match par niveau (ex: "6e")
            const gradeMatch = h.targetGrade === 'Tous' || userGrade.includes(h.targetGrade.toLowerCase());
            // 3. Match par élève précis
            const playerMatch = (!h.targetPlayerIds || h.targetPlayerIds.length === 0) || h.targetPlayerIds.includes(myId);

            return (classMatch || gradeMatch) && playerMatch;
        });

        setHomeworks(filteredHw);
        setChapters((chapData || []).filter(c => c.classroom === userClass));
      } catch(e) { console.error(e); }
      setLoading(false);
    };
    if (!selectedHw) load();
  }, [user.classroom, selectedHw, user.id, user._id]);

  if (selectedHw) return <HomeworkWorkspace homework={selectedHw} user={user} onQuit={() => setSelectedHw(null)} />;

  return (
    <div className="animate-in fade-in">
      {loading ? (
        <p className="text-center py-20 font-black text-pink-300 animate-pulse uppercase tracking-widest">Chargement des devoirs...</p>
      ) : homeworks.length > 0 ? (
        <DashboardFolder 
          items={homeworks} 
          chapters={chapters} 
          type="homework" 
          onSelect={setSelectedHw} 
          userClass={user.classroom} 
        />
      ) : (
        <div className="text-center py-20 bg-white rounded-[40px] border-4 border-dashed border-pink-50 max-w-2xl mx-auto">
            <span className="text-5xl block mb-4">🎉</span>
            <p className="font-black text-slate-400 uppercase">Aucun devoir pour le moment !</p>
        </div>
      )}
    </div>
  );
}