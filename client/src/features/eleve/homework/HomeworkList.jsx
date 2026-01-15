import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({ user }) {
  const [homeworks, setHomeworks] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);

  useEffect(() => {
    fetch('/api/homework/all').then(r => r.json()).then(setHomeworks);
    fetch('/api/structure/chapters').then(r => r.json()).then(setChapters);
  }, []);

  if (selectedHw) return <HomeworkWorkspace homework={selectedHw} user={user} onQuit={() => setSelectedHw(null)} />;
  return <DashboardFolder items={homeworks} chapters={chapters} type="homework" onSelect={setSelectedHw} />;
}