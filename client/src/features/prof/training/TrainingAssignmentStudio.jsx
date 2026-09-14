import React, { useState } from 'react';
import ExamTrainingHub from '../../eleve/training/ExamTrainingHub';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

export default function TrainingAssignmentStudio({ user, allClasses, allStudents, chapters, globalClass, globalClassId, globalLevel, targetSection, onClose }) {
  const [selection, setSelection] = useState(new Map());
  const [distribution, setDistribution] = useState(() => globalClass ? { [globalClass]: { chapterId: '', studentIds: [] } } : {});
  const [viewingClass, setViewingClass] = useState(globalClass || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const previewUser = { ...user, currentClass: globalClass, className: globalClass, classId: globalClassId };

  const toggle = (item, checked) => setSelection((current) => {
    const next = new Map(current);
    if (checked) next.set(item.id, item); else next.delete(item.id);
    return next;
  });

  const publish = async () => {
    if (!selection.size || !Object.keys(distribution).length) return window.alert('Coche au moins une activité et un destinataire.');
    setSaving(true);
    try {
      const assignmentId = globalThis.crypto?.randomUUID?.() || `training-${Date.now()}`;
      await Promise.all(Object.entries(distribution).map(async ([className, config]) => {
        const classroom = (allClasses || []).find((row) => row.name === className);
        if (!classroom?._id) return;
        const fallbackChapter = (chapters || []).find((chapter) => !chapter.isArchived && String(chapter.section || '').toUpperCase() === String(targetSection || '').toUpperCase());
        const response = await fetch(`/api/prof/training/class/${encodeURIComponent(classroom._id)}/assignment`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignmentId, title: 'Nouvel entraînement', chapterId: config.chapterId || fallbackChapter?._id || '', items: [...selection.values()], teacherId: user?._id || user?.id, assignedStudentIds: config.studentIds || [] })
        });
        if (!response.ok) throw new Error(`Publication impossible pour ${className}`);
      }));
      window.alert('Nouvel entraînement publié.');
      onClose();
    } catch (error) { window.alert(error.message); }
    finally { setSaving(false); }
  };

  return <div className="fixed inset-0 z-[80] flex flex-col bg-slate-100">
    <header className="flex items-center justify-between border-b bg-white px-6 py-4"><div><div className="text-[10px] font-black uppercase text-violet-500">Nouvelle activité</div><h2 className="text-2xl font-black text-slate-900">Créer un entraînement</h2></div><button type="button" onClick={onClose} className="h-11 w-11 rounded-full border bg-slate-50 text-xl font-black">✕</button></header>
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_360px]">
      <main className="overflow-auto p-5"><div className="mx-auto max-w-6xl rounded-[30px] border bg-white p-4 shadow-sm"><ExamTrainingHub user={previewUser} canCalibrate={false} assignmentMode selectedAssignmentIds={new Set(selection.keys())} onAssignmentToggle={toggle} /></div></main>
      <StudioDistributionSidebar user={user} allClasses={allClasses} allStudents={allStudents} chapters={chapters} distribution={distribution} setDistribution={setDistribution} viewingClass={viewingClass} setViewingClass={setViewingClass} studentSearch={studentSearch} setStudentSearch={setStudentSearch} targetLevel={globalLevel} targetSection={targetSection} loading={saving} onSave={publish} saveLabel={`PUBLIER L’ENTRAÎNEMENT (${selection.size}) 🚀`} />
    </div>
  </div>;
}
