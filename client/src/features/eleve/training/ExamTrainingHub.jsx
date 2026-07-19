import React, { useEffect, useState } from 'react';
import HomeworkList from '../homework/HomeworkList';

const normalizeClass = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const normalizeClassKey = (value = '') => normalizeClass(value).replace(/[^A-Z0-9]/g, '');

const normalizeLevel = (value = '') => {
  const raw = normalizeClass(value);
  if (/^(6|6E|6EME|SIXIEME)/.test(raw)) return '6';
  if (/^(5|5E|5EME|CINQUIEME)/.test(raw)) return '5';
  if (/^(4|4E|4EME|QUATRIEME)/.test(raw)) return '4';
  if (/^(3|3E|3EME|TROISIEME)/.test(raw)) return '3';
  if (/^(2|2DE|2NDE|SECONDE)/.test(raw)) return '2';
  if (/^(1|1ERE|PREMIERE)/.test(raw)) return '1';
  return raw.slice(0, 1);
};

export const getTrainingModeForStudent = (user = {}) => {
  const cls = normalizeClass(user.currentClass || user.className || '');
  if (/^3/.test(cls)) return 'dnb';
  if (/^(2|2DE|SECONDE)/.test(cls)) return 'seconde';
  return '';
};

const DNB_TABS = [
  { key: 'full', label: 'Brevet', hint: 'Sujet complet' },
  { key: 'docs', label: 'Docs', hint: 'Questions sur documents' },
  { key: 'paragraphe', label: 'Paragraphe', hint: 'Développement construit' },
  { key: 'reperes', label: 'Repères', hint: 'Dates, cartes, frises' },
  { key: 'emc', label: 'EMC', hint: 'Enseignement moral et civique' }
];

function DnbChapterFolders({ user, sectionFilter = 'full', onOpenChapter }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const studentId = String(user?._id || user?.id || '').trim();
    const studentClass = String(user?.currentClass || user?.className || '').trim();
    const studentClassKey = normalizeClassKey(studentClass);
    const studentLevel = normalizeLevel(studentClass);
    if (!studentId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/eleve/homework/list/${studentId}`)
      .then((res) => res.ok ? res.json() : [])
      .then(async (data) => {
        if (cancelled) return;
        const homeworks = Array.isArray(data) ? data : [];
        const dnbHomeworks = homeworks.filter((hw) => String(hw.assessmentKind || '') === 'dnb');
        const teacherIds = [...new Set(dnbHomeworks.map((hw) => String(hw.teacherId || '').trim()).filter(Boolean))];
        let chapters = [];
        if (teacherIds.length > 0) {
          const chapterResults = await Promise.all(teacherIds.map((teacherId) =>
            fetch(`/api/structure/chapters?teacherId=${encodeURIComponent(teacherId)}&classContext=${encodeURIComponent(user?.currentClass || user?.className || '')}`)
              .then((res) => res.ok ? res.json() : [])
              .catch(() => [])
          ));
          chapters = chapterResults.flat().filter(Boolean);
        }

        const dnbCountByChapterAndSubject = new Map();
        dnbHomeworks.forEach((hw) => {
          const chapterId = String(hw.chapterId || '').trim();
          if (!chapterId) return;
          const subjects = [...new Set((hw.levels || [])
            .filter((lvl) => sectionFilter === 'full' || String(lvl.dnbSection || 'docs') === String(sectionFilter))
            .map((lvl) => String(lvl.dnbSubject || 'histoire'))
            .filter((subject) => sectionFilter === 'emc' ? subject === 'emc' : ['histoire', 'geo'].includes(subject)))];
          subjects.forEach((subject) => {
            const key = `${subject}:${chapterId}`;
            dnbCountByChapterAndSubject.set(key, (dnbCountByChapterAndSubject.get(key) || 0) + 1);
          });
        });

        const chapterRows = chapters
          .map((chapter) => {
            const sectionRaw = String(chapter.section || '').toUpperCase();
            const title = String(chapter.title || '').trim();
            const subject = sectionRaw.includes('EMC') ? 'emc' : (sectionRaw.includes('GEO') ? 'geo' : (sectionRaw.includes('HIST') ? 'histoire' : ''));
            if (!subject) return null;
            if (['DNB', 'GÉNÉRAL', 'GENERAL'].includes(title.toUpperCase())) return null;
            if (sectionFilter === 'emc' && subject !== 'emc') return null;
            if (sectionFilter !== 'emc' && subject === 'emc') return null;
            if (chapter.isArchived === true) return null;
            if (Array.isArray(chapter.hiddenIn) && chapter.hiddenIn.some((cls) => normalizeClassKey(cls) === studentClassKey)) return null;
            const chapterClassKey = normalizeClassKey(chapter.classroom || '');
            const chapterLevel = normalizeLevel(chapter.sharedLevel || '');
            const matchesCurrentClass = chapterClassKey && chapterClassKey === studentClassKey;
            const matchesCurrentLevel = chapterLevel && chapterLevel === studentLevel;
            if (!matchesCurrentClass && !matchesCurrentLevel) return null;
            const chapterId = String(chapter._id || '').trim();
            return {
              key: `${subject}:${chapterId}`,
              subject,
              chapterId,
              title,
              section: String(chapter.section || '').trim(),
              count: dnbCountByChapterAndSubject.get(`${subject}:${chapterId}`) || 0
            };
          })
          .filter(Boolean);

        const groups = new Map();
        dnbHomeworks
          .forEach((hw) => {
            const subjects = [...new Set((hw.levels || [])
              .filter((lvl) => sectionFilter === 'full' || String(lvl.dnbSection || 'docs') === String(sectionFilter))
              .map((lvl) => String(lvl.dnbSubject || 'histoire'))
              .filter((subject) => sectionFilter === 'emc' ? subject === 'emc' : ['histoire', 'geo'].includes(subject)))];
            subjects.forEach((subject) => {
              const chapterId = String(hw.chapterId || '').trim() || `title:${hw.chapterTitle || hw.title || 'DNB'}`;
              const key = `${subject}:${chapterId}`;
              const previous = groups.get(key) || {
                key,
                subject,
                chapterId: String(hw.chapterId || '').trim(),
                title: String(hw.chapterTitle || hw.title || 'DNB').trim(),
                section: String(hw.chapterSection || '').trim(),
                itemIds: new Set()
              };
              previous.itemIds.add(String(hw._id || ''));
              groups.set(key, previous);
            });
          });
        const fallbackRows = [...groups.values()].map((group) => ({
          ...group,
          count: group.itemIds.size
        })).filter((group) => !['DNB', 'GÉNÉRAL', 'GENERAL', 'EMC'].includes(String(group.title || '').toUpperCase()));

        const finalRows = chapterRows.length > 0 ? chapterRows : fallbackRows;
        setRows(finalRows.sort((a, b) => a.title.localeCompare(b.title, 'fr')));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, sectionFilter]);

  const renderColumn = (subject, label, colorClass) => {
    const items = rows.filter((row) => row.subject === subject);
    const folderTone = subject === 'histoire' ? 'bg-red-500' : (subject === 'emc' ? 'bg-violet-600' : 'bg-emerald-500');
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className={`text-4xl font-black uppercase ${colorClass}`}>{label}</div>
        <div className="mt-4 flex flex-col gap-3">
          {items.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm font-bold text-slate-400">
              Aucun dossier pour l'instant.
            </div>
          ) : items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpenChapter(item)}
              className="w-full text-left rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-violet-200 transition"
            >
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl ${folderTone}`}>
                  📁
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-black text-slate-900 truncate">{item.title}</div>
                  <div className="text-xs font-black text-slate-400 mt-1">{item.count} élément{item.count > 1 ? 's' : ''}</div>
                </div>
              </div>
            </button>
          ))}
          {loading && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-black text-slate-400">
              Chargement...
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`mx-4 grid gap-4 ${sectionFilter === 'emc' ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
      {sectionFilter === 'emc' ? (
        renderColumn('emc', 'EMC', 'text-violet-600')
      ) : (
        <>
          {renderColumn('histoire', 'Histoire', 'text-red-500')}
          {renderColumn('geo', 'Géo', 'text-emerald-600')}
        </>
      )}
    </div>
  );
}

function DnbReperesSubjectFolders({ onOpenSubject }) {
  const subjects = [
    { subject: 'histoire', title: 'Histoire', color: 'text-red-500', bg: 'bg-red-500', hint: 'Dates, périodes, repères historiques' },
    { subject: 'geo', title: 'Géo', color: 'text-emerald-600', bg: 'bg-emerald-500', hint: 'Cartes, localisations, repères géographiques' }
  ];
  return (
    <div className="mx-4 grid gap-4 md:grid-cols-2">
      {subjects.map((item) => (
        <button
          key={item.subject}
          type="button"
          onClick={() => onOpenSubject({
            key: `reperes:${item.subject}`,
            subject: item.subject,
            title: item.title,
            subjectOnly: true
          })}
          className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:shadow-md hover:border-violet-200 transition"
        >
          <div className={`text-4xl font-black uppercase ${item.color}`}>{item.title}</div>
          <div className="mt-5 flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl ${item.bg}`}>📁</div>
            <div>
              <div className="text-lg font-black text-slate-900">Tous les repères</div>
              <div className="text-xs font-black text-slate-400 mt-1">{item.hint}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function ExamTrainingHub({ user }) {
  const mode = getTrainingModeForStudent(user);
  const [section, setSection] = useState(mode === 'seconde' ? 'rqp' : 'full');
  const [dnbSubject, setDnbSubject] = useState('all');
  const [selectedDnbChapter, setSelectedDnbChapter] = useState(null);

  if (mode === 'dnb') {
    const activeTab = DNB_TABS.find((tab) => tab.key === section) || DNB_TABS[0];
    const showSubjectFilter = false;
    const levelFilter = section === 'full'
      ? null
      : {
          dnbSection: section,
          dnbSubject: dnbSubject === 'all' ? null : dnbSubject
        };
    const showChapterFolders = ['full', 'docs', 'paragraphe', 'emc'].includes(section);
    const selectedChapterLevelFilter = selectedDnbChapter
      ? {
          dnbSubject: selectedDnbChapter.subject,
          ...(selectedDnbChapter.subjectOnly ? {} : { chapterId: selectedDnbChapter.chapterId }),
          ...(section !== 'full' ? { dnbSection: section } : {})
        }
      : null;

    return (
      <section className="flex flex-col gap-4">
        <div className="mx-4 rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <div className="text-[11px] font-black uppercase text-violet-500">Brevet</div>
          <h2 className="text-3xl font-black text-slate-900 m-0">Entraînement DNB</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">
            Choisis le brevet complet ou entraîne-toi exercice par exercice.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DNB_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setSection(tab.key);
                  setSelectedDnbChapter(null);
                  setDnbSubject('all');
                }}
                title={tab.hint}
                className={`px-4 py-3 rounded-2xl border text-sm font-black ${section === tab.key ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-violet-700 border-violet-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {showSubjectFilter && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-[11px] font-black uppercase text-violet-400">Matière</span>
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'histoire', label: 'Histoire' },
                { key: 'geo', label: 'Géo' }
              ].map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setDnbSubject(sub.key)}
                  className={`px-3 py-2 rounded-xl border text-xs font-black ${dnbSubject === sub.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 text-[11px] font-bold text-violet-500">
            Affichage : {activeTab.hint}{showSubjectFilter && dnbSubject !== 'all' ? ` · ${dnbSubject === 'geo' ? 'Géo' : 'Histoire'}` : ''}
          </div>
        </div>
        {section === 'reperes' && !selectedDnbChapter ? (
          <DnbReperesSubjectFolders onOpenSubject={setSelectedDnbChapter} />
        ) : showChapterFolders && !selectedDnbChapter ? (
          <DnbChapterFolders user={user} sectionFilter={section} onOpenChapter={setSelectedDnbChapter} />
        ) : (showChapterFolders || section === 'reperes') && selectedDnbChapter ? (
          <>
            <div className="mx-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <div className="text-[11px] font-black uppercase text-slate-400">
                  {activeTab.hint} · {selectedDnbChapter.subject === 'emc' ? 'EMC' : (selectedDnbChapter.subject === 'geo' ? 'Géographie' : 'Histoire')}
                </div>
                <div className="text-xl font-black text-slate-900">{selectedDnbChapter.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDnbChapter(null)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600"
              >
                ← Retour aux dossiers
              </button>
            </div>
            <HomeworkList
              user={user}
              assessmentKinds={['dnb']}
              levelFilter={selectedChapterLevelFilter}
              emptyTitle="Aucun entraînement publié dans ce chapitre pour l'instant."
            />
          </>
        ) : (
          <HomeworkList
            user={user}
            assessmentKinds={['dnb']}
            levelFilter={levelFilter}
            emptyTitle={section === 'emc' ? "Aucun entraînement EMC disponible pour l'instant." : "Aucun exercice DNB disponible dans cette section pour l'instant."}
          />
        )}
      </section>
    );
  }

  if (mode === 'seconde') {
    const isRqp = section === 'rqp';
    return (
      <section className="flex flex-col gap-4">
        <div className="mx-4 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <div className="text-[11px] font-black uppercase text-blue-500">Seconde</div>
          <h2 className="text-3xl font-black text-slate-900 m-0">Entraînement</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">
            Choisis une section puis ouvre le sujet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSection('rqp')}
              className={`px-4 py-3 rounded-2xl border text-sm font-black ${isRqp ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-700 border-blue-200'}`}
            >
              RQP
            </button>
            <button
              type="button"
              onClick={() => setSection('commentaire')}
              className={`px-4 py-3 rounded-2xl border text-sm font-black ${!isRqp ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-700 border-emerald-200'}`}
            >
              Question commentaire
            </button>
          </div>
        </div>
        <HomeworkList
          user={user}
          assessmentKinds={[isRqp ? 'rqp' : 'commentaire']}
          emptyTitle={isRqp ? "Aucun entraînement RQP disponible pour l'instant." : "Aucune question commentaire disponible pour l'instant."}
        />
      </section>
    );
  }

  return (
    <div className="mx-4 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">📚</div>
      <div className="text-lg font-black text-slate-700">Aucun entraînement spécial pour ta classe.</div>
    </div>
  );
}
