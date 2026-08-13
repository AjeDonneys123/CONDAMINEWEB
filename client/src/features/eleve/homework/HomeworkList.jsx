// @signatures: HomeworkList, loadData
import React, { useState, useEffect } from 'react';
import HomeworkWorkspace from './HomeworkWorkspace';
import DashboardFolder from '../components/DashboardFolder';

export default function HomeworkList({
  user,
  openPunishmentDirect = false,
  onPunishmentOpened,
  openItemId = '',
  onOpenHandled,
  assessmentKinds = null,
  levelFilter = null,
  emptyTitle = '',
  compact = false,
  titleOverride = ''
}) {
  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const myId = String(user._id || user.id);
    
    try {
        const [hwRes, subRes] = await Promise.all([
          fetch(`/api/eleve/homework/list/${myId}${user?.isVisitorPreview ? `?visitor=1&level=${encodeURIComponent(user.currentClass || '')}` : ''}`),
          user?.isVisitorPreview ? Promise.resolve({ ok: true, json: async () => [] }) : fetch(`/api/eleve/homework/submissions/${myId}`)
        ]);
        if (!hwRes.ok) throw new Error("404");
        const data = await hwRes.json();
        const subs = subRes.ok ? await subRes.json() : [];
        const submittedByHomeworkId = new Set((subs || []).map(s => String(s.homeworkId)));

        const allowedKinds = Array.isArray(assessmentKinds)
          ? new Set(assessmentKinds.map((x) => String(x || '').trim()))
          : null;
        const filteredByKind = allowedKinds
          ? data.filter((hw) => allowedKinds.has(String(hw.assessmentKind || '').trim()))
          : data;
        const filtered = levelFilter
          ? filteredByKind
              .filter((hw) => !levelFilter.chapterId || String(hw.chapterId || '') === String(levelFilter.chapterId))
              .map((hw) => {
                const matchingLevels = (hw.levels || [])
                  .map((lvl, index) => ({ ...lvl, _sourceLevelIndex: index }))
                  .filter((lvl) => {
                    const sectionOk = !levelFilter.dnbSection || String(lvl.dnbSection || 'docs') === String(levelFilter.dnbSection);
                    const subjectOk = !levelFilter.dnbSubject || String(lvl.dnbSubject || 'histoire') === String(levelFilter.dnbSubject);
                    return sectionOk && subjectOk;
                  });
                return matchingLevels.length > 0 ? { ...hw, levels: matchingLevels } : null;
              })
              .filter(Boolean)
          : filteredByKind;

        setHomeworks(filtered.map(hw => ({
          ...hw,
          status: submittedByHomeworkId.has(String(hw._id)) ? 'done' : 'todo'
        })));
    } catch(e) { console.error("Err loading HW", e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [user, JSON.stringify(assessmentKinds), JSON.stringify(levelFilter)]);

  useEffect(() => {
    if (!openPunishmentDirect || selectedHw) return;
    const punishment = (homeworks || []).find(h => h.isPunishment);
    if (punishment) {
      setSelectedHw(punishment);
    }
    if (onPunishmentOpened) onPunishmentOpened();
  }, [openPunishmentDirect, homeworks, selectedHw, onPunishmentOpened]);

  useEffect(() => {
    const targetId = String(openItemId || '').trim();
    if (!targetId || selectedHw) return;
    const target = (homeworks || []).find((h) => String(h?._id || '') === targetId);
    if (!target) return;
    setSelectedHw(target);
    if (onOpenHandled) onOpenHandled();
  }, [openItemId, homeworks, selectedHw, onOpenHandled]);

  if (selectedHw) return (
      <HomeworkWorkspace 
        homework={selectedHw} 
        user={user} 
        onQuit={() => { setSelectedHw(null); loadData(); }} 
      />
  );

  return (
      <div className="flex flex-col gap-4">
          <div className="flex justify-end px-4">
              <button onClick={loadData} className="text-[10px] font-black text-blue-500 bg-white px-3 py-1 rounded-xl border border-blue-100">
                  {loading ? '...' : '🔄 ACTUALISER'}
              </button>
          </div>
          {emptyTitle && homeworks.length === 0 && !loading ? (
            <div className="mx-4 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
              <div className="text-3xl mb-2">📁</div>
              <div className="text-lg font-black text-slate-700">{emptyTitle}</div>
              <div className="text-sm font-bold text-slate-400 mt-1">Ton professeur publiera les sujets ici.</div>
            </div>
          ) : compact ? (
            <div className="grid gap-2">
              {homeworks.map((hw) => (
                <button
                  key={hw._id}
                  type="button"
                  onClick={() => setSelectedHw(hw)}
                  className="w-full rounded-2xl border border-violet-100 bg-white px-3 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg bg-emerald-100 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">DNB</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">
                      {titleOverride || hw.title}
                    </span>
                    <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${hw.status === 'done' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {hw.status === 'done' ? 'Fait' : 'À faire'}
                    </span>
                    <span className="text-sm font-black text-violet-400">›</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <DashboardFolder items={homeworks} type="homework" onSelect={setSelectedHw} />
          )}
      </div>
  );
}
