import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);

  const loadData = async () => {
    // Sécurisation des données utilisateur
    const myId = String(user._id || user.id);
    const myClass = (user.currentClass || "").toUpperCase().trim();
    
    // Vérification du statut punition
    const isPunished = user.punishmentStatus === 'PENDING' || user.punishmentStatus === 'LATE';

    try {
        const [allHw, allSubs] = await Promise.all([
            fetch('/api/homework/all').then(r => r.json()),
            fetch('/api/homework/submissions').then(r => r.json())
        ]);

        // Liste des IDs de devoirs déjà rendus par l'élève
        const myDoneHwIds = allSubs
            .filter(s => s.studentId && String(s.studentId) === myId)
            .map(s => String(s.homeworkId));

        const filtered = allHw.filter(hw => {
            // 1. CIBLAGE (Est-ce que ce devoir concerne ma classe ?)
            const targets = (hw.targetClassrooms || []).map(t => t.toUpperCase().trim());
            const legacyTarget = hw.classroom ? hw.classroom.toUpperCase().trim() : null;
            const isMyClassTargeted = targets.includes(myClass) || legacyTarget === myClass;

            // 2. LOGIQUE SPÉCIALE PUNITION
            if (hw.isPunishment) {
                // Si ce n'est pas pour ma classe, je ne le vois pas
                if (!isMyClassTargeted) return false;

                // Si je suis PUNI, je DOIS voir la punition de ma classe
                if (isPunished) {
                    // Sauf si je l'ai déjà rendue (auquel cas elle disparaît)
                    const isDone = myDoneHwIds.includes(String(hw._id));
                    return !isDone;
                }
                
                // Si je ne suis pas puni, je ne vois jamais les punitions
                return false;
            }

            // 3. LOGIQUE DEVOIRS NORMAUX
            const isAssignedIndividually = hw.assignedStudents?.some(id => String(id) === myId);
            const isAssigned = isAssignedIndividually || (isMyClassTargeted && hw.isAllClass);
            
            return isAssigned;

        }).map(hw => ({
            ...hw,
            status: myDoneHwIds.includes(String(hw._id)) ? 'done' : 'todo'
        }));

        setHomeworks(filtered);
    } catch(e) { console.error("Err loading HW", e); }
  };

  useEffect(() => {
    loadData();
    fetch('/api/structure/chapters').then(r => r.json()).then(setChapters);
  }, [user]); 

  if (selectedHw) return (
      <HomeworkWorkspace 
        homework={selectedHw} 
        user={user} 
        onQuit={() => { setSelectedHw(null); loadData(); }} 
      />
  );

  return <DashboardFolder items={homeworks} chapters={chapters} type="homework" onSelect={setSelectedHw} />;
}