import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);

  const loadData = async () => {
    const myId = String(user._id || user.id);
    const myClass = (user.currentClass || "").toUpperCase().trim();

    try {
        const [allHw, allSubs] = await Promise.all([
            fetch('/api/homework/all').then(r => r.json()),
            fetch('/api/homework/submissions').then(r => r.json())
        ]);

        const myDoneHwIds = allSubs
            .filter(s => s.studentId && String(s.studentId) === myId)
            .map(s => String(s.homeworkId));

        const filtered = allHw.filter(hw => {
            const targets = hw.targetClassrooms || (hw.classroom ? [hw.classroom] : []);
            const isMyClassTargeted = targets.some(t => t.toUpperCase().trim() === myClass);
            const isAssignedIndividually = hw.assignedStudents?.some(id => String(id) === myId);
            
            if (isAssignedIndividually) return true;
            if (isMyClassTargeted && hw.isAllClass) return true;
            return false;
        }).map(hw => ({
            ...hw,
            // Standardisation du status pour DashboardFolder
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