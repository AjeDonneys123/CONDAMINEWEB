import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

/**
 * 📚 LISTE DEVOIRS ÉLÈVE V80
 * Filtrage strict par classe administrative et normalisation.
 */
export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);

  useEffect(() => {
    const myClass = (user.currentClass || "").toUpperCase().trim();
    const myId = String(user._id || user.id);

    fetch('/api/homework/all').then(r => r.json()).then(all => {
        // FILTRAGE V80 : Devoirs de ma classe OU m'étant personnellement assignés
        const filtered = all.filter(hw => {
            const hwClass = (hw.classroom || "").toUpperCase().trim();
            const isMyClass = hwClass === myClass;
            const isAssigned = hw.assignedStudents?.some(id => String(id) === myId);
            return isMyClass || isAssigned;
        });
        setHomeworks(filtered);
    });

    fetch('/api/structure/chapters').then(r => r.json()).then(setChapters);
  }, [user]);

  if (selectedHw) return <HomeworkWorkspace homework={selectedHw} user={user} onQuit={() => setSelectedHw(null)} />;
  return <DashboardFolder items={homeworks} chapters={chapters} type="homework" onSelect={setSelectedHw} />;
}