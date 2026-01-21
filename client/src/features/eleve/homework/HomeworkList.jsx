import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

/**
 * 📚 LISTE DEVOIRS ÉLÈVE V137 (MULTI-CLASSE FILTER)
 * L'élève voit le devoir si sa classe est dans 'targetClassrooms'.
 */
export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);

  useEffect(() => {
    const myClass = (user.currentClass || "").toUpperCase().trim();
    const myId = String(user._id || user.id);

    fetch('/api/homework/all').then(r => r.json()).then(all => {
        const filtered = all.filter(hw => {
            // 1. Cible Classe Multiple
            const targets = hw.targetClassrooms || (hw.classroom ? [hw.classroom] : []);
            const isMyClassTargeted = targets.some(t => t.toUpperCase().trim() === myClass);
            
            // 2. Assignation Individuelle
            const isAssignedIndividually = hw.assignedStudents?.some(id => String(id) === myId);
            
            // 3. Mode "Toute la classe" ou "Juste moi"
            if (isAssignedIndividually) return true;
            if (isMyClassTargeted && hw.isAllClass) return true;
            
            return false;
        });
        setHomeworks(filtered);
    });

    fetch('/api/structure/chapters').then(r => r.json()).then(setChapters);
  }, [user]);

  if (selectedHw) return <HomeworkWorkspace homework={selectedHw} user={user} onQuit={() => setSelectedHw(null)} />;
  return <DashboardFolder items={homeworks} chapters={chapters} type="homework" onSelect={setSelectedHw} />;
}