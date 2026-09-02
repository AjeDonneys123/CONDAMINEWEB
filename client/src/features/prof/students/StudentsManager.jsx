// @signatures: StudentsManager, getStudentWorkload, handleOpenCorrection, handleRemovePunishment, handleSaveCorrection, loadMatrix
import React, { useState, useEffect } from 'react';
import { resolveBackendAssetUrl } from '../../../utils/driveUrl';
import './StudentsManager.css';

const extractId = (value) => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value?.toHexString === 'function') return value.toHexString();
  if (typeof value?.toString === 'function' && value?.toString !== Object.prototype.toString) {
    const asString = value.toString();
    if (asString && asString !== '[object Object]') return asString;
  }
  if (typeof value === 'object') {
    if (value._id) return extractId(value._id);
    if (typeof value.id === 'string') return value.id;
    if (typeof value.$oid === 'string') return value.$oid;
  }
  return '';
};
const norm = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
const antiCheatTone = (antiCheat = {}) => {
  const lvl = String(antiCheat?.level || '').toUpperCase();
  const score = Number(antiCheat?.score || 0);
  if (lvl === 'RED' || score >= 8) return { label: 'TRICHE: ROUGE', chip: 'bg-red-100 text-red-700 border-red-200' };
  if (lvl === 'ORANGE' || score >= 4) return { label: 'TRICHE: ORANGE', chip: 'bg-amber-100 text-amber-700 border-amber-200' };
  return { label: 'TRICHE: VERTE', chip: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
};
const formatMs = (ms = 0) => {
  const v = Math.max(0, Number(ms || 0));
  const sec = Math.floor(v / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
const gradeToNumber = (raw = '') => {
  const txt = String(raw || '').trim().toUpperCase();
  if (!txt) return 0;
  const m = txt.match(/(\d+(?:[.,]\d+)?)/);
  if (m) {
    const n = Number(String(m[1]).replace(',', '.'));
    if (Number.isFinite(n)) return Math.max(0, Math.min(20, n));
  }
  const map = { 'A+': 20, 'A': 18, 'A-': 16, 'B+': 15, 'B': 14, 'B-': 13, 'C+': 12, 'C': 11, 'C-': 10, 'D+': 8, 'D': 7, 'D-': 6, 'E': 4, 'F': 0 };
  return map[txt] ?? 0;
};

export default function StudentsManager({ globalClassId }) {
  const [students, setStudents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [trackingData, setTrackingData] = useState({}); 
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState("");
  const [latePunishmentNames, setLatePunishmentNames] = useState([]);
  const [chapterNameById, setChapterNameById] = useState({});
  const [dnbMethodProgress, setDnbMethodProgress] = useState({});

  // MODALES
  const [editingSub, setEditingSub] = useState(null); 
  const [editorData, setEditorData] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [viewingStudent, setViewingStudent] = useState(null); // Pour la modale de suivi
  const [controlRecoveriesByStudent, setControlRecoveriesByStudent] = useState({});
  const [viewingWork, setViewingWork] = useState(null);
  const [ficheBoardActivity, setFicheBoardActivity] = useState(null);
  const [ficheBoardEditing, setFicheBoardEditing] = useState(null);
  const [ficheBoardSaving, setFicheBoardSaving] = useState(false);
  const [gptFeedbackModal, setGptFeedbackModal] = useState(null);
  const [gptFeedbackEntries, setGptFeedbackEntries] = useState([]);
  const [gptFeedbackLoading, setGptFeedbackLoading] = useState(false);
  const [gptFeedbackError, setGptFeedbackError] = useState('');
  const [dilVocabulary, setDilVocabulary] = useState([]);
  const [assessmentControls, setAssessmentControls] = useState([]);

  useEffect(() => {
    if (!globalClassId) return;
    loadMatrix();
  }, [globalClassId]);

  useEffect(() => {
    const studentId = extractId(viewingStudent?._id);
    if (!studentId || viewingStudent?.isDil !== true) {
      setDilVocabulary([]);
      return;
    }
    fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`)
      .then((response) => response.ok ? response.json() : [])
      .then((rows) => setDilVocabulary(Array.isArray(rows) ? rows : []))
      .catch(() => setDilVocabulary([]));
  }, [viewingStudent]);

  const loadMatrix = async () => {
    setLoading(true);
    try {
        const [sts, clsList, hws, gms, lms, exs, fiches, prods, subs, progs, chapters, draftDocs, controls] = await Promise.all([
            fetch('/api/admin/students').then(r => r.json()),
            fetch('/api/admin/classrooms').then(r => r.json()),
            fetch('/api/homework/all').then(r => r.json()),
            fetch('/api/games/all').then(r => r.json()),
            fetch('/api/learning/all').then(r => r.ok ? r.json() : []),
            fetch('/api/exposes/all').then(r => r.ok ? r.json() : []),
            fetch('/api/fiches/all').then(r => r.ok ? r.json() : []),
            fetch('/api/productions/all').then(r => r.ok ? r.json() : []),
            fetch('/api/homework/submissions').then(r => r.json()),
            fetch('/api/games/progress').then(r => r.json()),
            fetch('/api/structure/chapters').then(r => r.ok ? r.json() : []),
            fetch('/api/homework/draft-docs').then(r => r.ok ? r.json() : []),
            fetch('/api/controls/all').then(r => r.ok ? r.json() : [])
        ]);

        const currentClassObj = clsList.find(c => c._id === globalClassId);
        const currentClassName = currentClassObj ? currentClassObj.name : "";
        setClassName(currentClassName);

        const myStudents = sts
            .filter(s => {
                if (!currentClassObj) return false;
                if (currentClassObj.type === 'GROUP') {
                    const targetGroupId = String(globalClassId);
                    return (s.assignedGroups || []).some((g) => extractId(g) === targetGroupId);
                }
                return String(s.classId) === String(globalClassId);
            })
            .sort((a,b) => a.lastName.localeCompare(b.lastName));
        setStudents(myStudents);
        setAssessmentControls((controls || []).filter(row => (row.targetClassrooms || []).map(norm).includes(norm(currentClassName))));
        const methodProgress = {};
        progs.forEach((progress) => {
            const gameId = String(progress?.gameId || '');
            const match = gameId.match(/^dnb-doc-method-(presentation|image)::(\d+)$/);
            if (!match) return;
            const studentId = extractId(progress.studentId);
            if (!studentId) return;
            const total = Math.max(1, Number(match[2] || 1));
            const reached = Math.min(total, Math.max(0, Number(progress.levelReached || 0)));
            if (!methodProgress[studentId]) methodProgress[studentId] = {};
            methodProgress[studentId][match[1]] = { reached, total, complete: reached >= total };
        });
        setDnbMethodProgress(methodProgress);
        const recoveryPairs = await Promise.all(
          myStudents.map(async (student) => {
            const sid = extractId(student?._id);
            if (!sid) return [sid, []];
            try {
              const res = await fetch(`/api/admin/students/${encodeURIComponent(sid)}/control-recoveries`);
              const rows = res.ok ? await res.json() : [];
              return [sid, Array.isArray(rows) ? rows : []];
            } catch (_) {
              return [sid, []];
            }
          })
        );
        setControlRecoveriesByStudent(Object.fromEntries(recoveryPairs));
        const lateNames = myStudents
            .filter(s => s.punishmentStatus === 'LATE' || (s.punishmentStatus === 'PENDING' && s.punishmentDueDate && new Date(s.punishmentDueDate).getTime() <= Date.now()))
            .map(s => `${s.firstName} ${s.lastName}`);
        setLatePunishmentNames(lateNames);

        const chapterMap = {};
        (Array.isArray(chapters) ? chapters : []).forEach((ch) => {
            const id = extractId(ch?._id);
            if (!id) return;
            const section = String(ch?.section || '').trim();
            const title = String(ch?.title || '').trim();
            chapterMap[id] = section && title ? `${section} / ${title}` : (title || section || 'CHAPITRE');
        });
        setChapterNameById(chapterMap);

        const allActs = [
            ...hws.map(h => ({ ...h, type: 'homework', chapterIdStr: extractId(h.chapterId), label: '📝 ' + h.title })),
            ...gms.map(g => ({ ...g, type: 'game', chapterIdStr: extractId(g.chapterId), label: '🎮 ' + g.title })),
            ...lms.map(m => ({ ...m, type: 'learning', chapterIdStr: extractId(m.chapterId), label: '📚 ' + m.title })),
            ...exs.map(e => ({ ...e, type: 'expose', chapterIdStr: extractId(e.chapterId), label: '🗣️ ' + e.title })),
            ...fiches.map(f => ({ ...f, type: 'fiche', chapterIdStr: extractId(f.chapterId), label: '🗂️ ' + f.title })),
            ...prods.map(p => ({ ...p, type: 'production', chapterIdStr: extractId(p.chapterId), label: '🏗️ ' + p.title }))
        ];
        const classTargetKey = norm(currentClassName);
        const classStudentIds = new Set(myStudents.map((s) => extractId(s._id)));
        const scopedActs = allActs.filter((act) => {
            const chapterId = act.chapterIdStr || '';
            // Règle anti-fantôme: activité visible uniquement si liée à un chapitre existant.
            if (!chapterId || !chapterMap[chapterId]) return false;
            const targets = (act.targetClassrooms || []).map(norm);
            const hitsClassTarget = targets.includes(classTargetKey);
            const hasAssignedInClass = (act.assignedStudents || []).some((id) => classStudentIds.has(String(id)));
            return hitsClassTarget || hasAssignedInClass;
        }).map((act) => ({
            ...act,
            chapterLabel: chapterMap[act.chapterIdStr] || ''
        }));
        setActivities(scopedActs);

        const map = {};
        const hwTitleById = new Map((hws || []).map((h) => [String(h._id), h.title || '']));
        const studentNameKeyById = new Map(
            (sts || []).map((s) => [String(s._id), norm(`${s.firstName || ''} ${s.lastName || ''}`)])
        );
        subs.forEach(sub => {
            const sid = extractId(sub.studentId);
            const hid = extractId(sub.homeworkId);
            const hwTitleFromSub = typeof sub.homeworkId === 'object' ? sub.homeworkId?.title : '';
            const hwTitle = hwTitleFromSub || hwTitleById.get(String(hid)) || '';
            const sNameKey = studentNameKeyById.get(sid) || '';
            const payload = { done: true, score: sub.grade, subId: sub._id, antiCheat: sub.antiCheat || {} };
            if (hid) map[`${sid}_${hid}`] = payload;
            if (hwTitle) map[`${sid}_TITLE_${norm(hwTitle)}`] = payload;
            if (hwTitle && sNameKey) map[`${sNameKey}_TITLE_${norm(hwTitle)}`] = payload;
        });
        const latestDraftByKey = new Map();
        (draftDocs || []).forEach((d) => {
            const sid = extractId(d.studentId);
            const hid = extractId(d.homeworkId);
            if (!sid || !hid) return;
            const key = `${sid}_${hid}`;
            const prev = latestDraftByKey.get(key);
            const prevTs = new Date(prev?.updatedAt || prev?.lastRevisionAt || 0).getTime();
            const nextTs = new Date(d?.updatedAt || d?.lastRevisionAt || 0).getTime();
            if (!prev || nextTs >= prevTs) latestDraftByKey.set(key, d);
        });
        latestDraftByKey.forEach((d, key) => {
            if (!map[key]) map[key] = {};
            map[key].draftDoc = {
                docUrl: d?.docUrl || '',
                title: d?.title || '',
                lastWordCount: Number(d?.lastWordCount || 0),
                lastRevisionCount: Number(d?.lastRevisionCount || 0),
                lastRevisionAt: d?.lastRevisionAt || null
            };
        });
        progs.forEach(prog => {
            const sid = extractId(prog.studentId);
            const gid = extractId(prog.gameId);
            map[`${sid}_${gid}`] = { done: true, score: prog.lastScore ? `${prog.lastScore}pts` : 'JOUÉ', levelReached: Number(prog.levelReached || 0) };
        });
        lms.forEach((lm) => {
            const lmId = extractId(lm._id);
            (lm.completions || []).forEach((c) => {
                const sid = extractId(c.studentId);
                if (!sid || !lmId) return;
                map[`${sid}_${lmId}`] = {
                    done: true,
                    score: `STEP ${Number(c.currentStep || 0)}`,
                    currentStep: Number(c.currentStep || 0)
                };
            });
        });
        exs.forEach((expose) => {
            const exposeId = extractId(expose._id);
            (expose.presentations || []).forEach((p) => {
                const sid = extractId(p.studentId);
                if (!sid || !exposeId) return;
                map[`${sid}_${exposeId}`] = {
                    done: true,
                    score: '🎤',
                    presentation: {
                        canvasUrl: p.canvasUrl || '',
                        slidesText: p.slidesText || '',
                        recordingUrl: p.recordingUrl || '',
                        updatedAt: p.updatedAt || p.createdAt || null
                    }
                };
            });
        });
        fiches.forEach((fiche) => {
            const ficheId = extractId(fiche._id);
            (fiche.submissions || []).forEach((sub) => {
                const sid = extractId(sub.studentId);
                if (!sid || !ficheId) return;
                map[`${sid}_${ficheId}`] = {
                    // Nouvelle règle: toute sauvegarde, même incomplète, est visible côté prof.
                    done: true,
                    score: 'FICHE',
                    fiche: {
                        title: fiche.title || 'Fiche',
                        contentHtml: sub.contentHtml || '',
                        plainText: sub.plainText || '',
                        imageCount: Number(sub.imageCount || 0),
                        teacherValidated: sub.teacherValidated === true,
                        participantStudentIds: Array.isArray(sub.participantStudentIds) ? sub.participantStudentIds : [],
                        lessonSlot: Math.max(1, Number(sub.lessonSlot || 1)),
                        updatedAt: sub.updatedAt || sub.completedAt || null
                    }
                };
            });
        });
        prods.forEach((prod) => {
            const prodId = extractId(prod._id);
            (prod.submissions || []).forEach((sub) => {
                const sid = extractId(sub.studentId);
                if (!sid || !prodId) return;
                map[`${sid}_${prodId}`] = {
                    // Nouvelle règle: toute autosauvegarde ou sauvegarde manuelle apparaît côté prof.
                    done: true,
                    score: prod.productionType === 'qcm'
                        ? `${Number(sub.score || 0)} QCM`
                        : (prod.productionType === 'questionnaire' ? `${Array.isArray(sub.answers) ? sub.answers.length : 0} questions` : 'FICHE'),
                    production: {
                        type: String(prod.productionType || 'fiche'),
                        title: prod.title || 'Production',
                        contentHtml: sub.contentHtml || '',
                        plainText: sub.plainText || '',
                        answers: Array.isArray(sub.answers) ? sub.answers : [],
                        teacherValidated: sub.teacherValidated === true,
                        participantStudentIds: Array.isArray(sub.participantStudentIds) ? sub.participantStudentIds : [],
                        lessonSlot: Math.max(1, Number(sub.lessonSlot || 1)),
                        updatedAt: sub.updatedAt || sub.completedAt || null
                    }
                };
            });
        });
        setTrackingData(map);

    } catch (e) { console.error("Matrix Load Error", e); }
    setLoading(false);
  };

  // --- ACTIONS ---
  const handleOpenCorrection = async (subId) => {
      setEditingSub(subId);
      setEditorLoading(true);
      try {
          const res = await fetch(`/api/homework/submission/${subId}`);
          if (res.ok) setEditorData(await res.json());
      } catch(e) {}
      setEditorLoading(false);
  };

  const handleSaveCorrection = async () => {
      if (!editorData) return;
      await fetch(`/api/homework/submission/${editingSub}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(editorData) });
      setEditingSub(null); setEditorData(null); loadMatrix();
  };

  const handleRemovePunishment = async (hwId, sId) => {
      if(!confirm("Annuler cette punition pour l'élève ?")) return;
      await fetch('/api/homework/remove-punishment', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ homeworkId: hwId, studentId: sId }) });
      // On recharge la matrice pour mettre à jour la vue
      loadMatrix();
      setViewingStudent(null); // On ferme la modale pour rafraîchir
  };

  const handleValidateRecovery = async (recoveryId) => {
      try {
          const res = await fetch(`/api/admin/control-recoveries/${encodeURIComponent(recoveryId)}/validate`, { method: 'POST' });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || 'Validation impossible');
          setControlRecoveriesByStudent((prev) => {
            const sid = extractId(data?.item?.studentId);
            const current = Array.isArray(prev?.[sid]) ? prev[sid] : [];
            const next = current.map((row) => String(row?._id) === String(data?.item?._id) ? data.item : row);
            return { ...prev, [sid]: next };
          });
      } catch (e) {
          alert(e.message || 'Validation impossible');
      }
  };

  const openWorkViewer = (payload) => {
      if (!payload) return;
      setViewingWork(payload);
  };

  const isBoardActivity = (act) => (
      String(act?.type || '') === 'fiche'
      || (String(act?.type || '') === 'production' && String(act?.productionType || '') === 'fiche')
  );

  const handleOpenActivityWork = (student, act, status) => {
      if (!student || !act || !status?.done) return;
      if (act.type === 'homework' && status?.subId) return handleOpenCorrection(status.subId);
      if (act.type === 'expose' && status?.presentation) {
          return openWorkViewer({
              kind: 'expose',
              title: act.title || 'Exposé',
              studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
              chapterLabel: act.chapterLabel || chapterNameById[extractId(act.chapterId)] || '',
              expose: status.presentation
          });
      }
      if (act.type === 'production' && status?.production) {
          return openWorkViewer({
              kind: 'production',
              title: status.production.title || act.title || 'Production',
              studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
              chapterLabel: act.chapterLabel || chapterNameById[extractId(act.chapterId)] || '',
              production: status.production
          });
      }
      if (act.type === 'fiche' && status?.fiche) {
          return openWorkViewer({
              kind: 'fiche',
              title: status.fiche.title || act.title || 'Fiche',
              studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
              chapterLabel: act.chapterLabel || chapterNameById[extractId(act.chapterId)] || '',
              fiche: status.fiche
          });
      }
  };

  const handleOpenRecoveryWork = (student, rec) => {
      if (!student || !rec) return;
      openWorkViewer({
          kind: 'control-recovery',
          title: rec.title || 'RÉCUPÉRER CONTRÔLE',
          studentName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
          recovery: rec
      });
  };

  const formatGptFeedbackDate = (value) => {
      const d = new Date(value || Date.now());
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
      });
  };

  const openGptFeedback = async (student, act) => {
      const sid = extractId(student?._id);
      const moduleId = extractId(act?._id);
      const studentName = `${student?.firstName || ''} ${student?.lastName || ''}`.trim();
      setGptFeedbackModal({ student, act });
      setGptFeedbackEntries([]);
      setGptFeedbackError('');
      setGptFeedbackLoading(true);
      try {
          const params = new URLSearchParams();
          if (moduleId) params.set('moduleId', moduleId);
          if (sid) params.set('studentId', sid);
          params.set('limit', '60');
          const res = await fetch(`/api/learning/gpt-inbox?${params.toString()}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok || data?.ok === false) throw new Error(data?.error || 'Lecture impossible');
          const entries = Array.isArray(data?.entries) ? data.entries : [];
          const studentKey = norm(studentName);
          const filtered = entries.filter((entry) => {
              const entryStudentId = extractId(entry?.studentId);
              if (sid && entryStudentId && entryStudentId === sid) return true;
              return studentKey && norm(entry?.studentName || '') === studentKey;
          });
          setGptFeedbackEntries(filtered.length ? filtered : entries);
      } catch (e) {
          setGptFeedbackError(e.message || 'Impossible de consulter les retours GPT');
      } finally {
          setGptFeedbackLoading(false);
      }
  };

  // --- HELPER POUR LA MODALE SUIVI ---
  const getStudentWorkload = (sId) => {
      const currentStudentId = extractId(sId);
      const student = students.find((s) => extractId(s._id) === currentStudentId);
      if(!student) return [];
      
      const workload = [];
      const classTargetKey = norm(className);
      const studentId = currentStudentId;
      const studentNameKey = norm(`${student.firstName || ''} ${student.lastName || ''}`);

      activities.forEach(act => {
          // 1. CIBLAGE
          const assignedIds = (act.assignedStudents || []).map((id) => String(id));
          const isAssignedDirect = assignedIds.includes(studentId);
          const targets = (act.targetClassrooms || (act.classroom ? [act.classroom] : [])).map(norm);
          const isAssignedByClass = !!act.isAllClass && targets.includes(classTargetKey);
          const isAssigned = isAssignedDirect || isAssignedByClass;

          if (isAssigned) {
              const status =
                  trackingData[`${studentId}_${extractId(act._id)}`] ||
                  trackingData[`${studentId}_TITLE_${norm(act.title)}`] ||
                  trackingData[`${studentNameKey}_TITLE_${norm(act.title)}`];
              workload.push({
                  ...act,
                  isDone: Boolean(status?.done),
                  score: status?.score || null,
                  antiCheat: status ? (status.antiCheat || {}) : {},
                  presentation: status ? (status.presentation || null) : null,
                  draftDoc: status ? (status.draftDoc || null) : null,
                  production: status ? (status.production || null) : null
                  ,
                  fiche: status ? (status.fiche || null) : null
              });
          }
      });
      return workload;
  };

  if (!globalClassId) return <div className="p-10 text-center text-slate-400 font-bold">Veuillez sélectionner une classe en haut.</div>;
  if (loading) return <div className="p-10 text-center text-indigo-500 font-black animate-pulse">CHARGEMENT DE LA MATRICE...</div>;

  const workloadItems = viewingStudent ? getStudentWorkload(viewingStudent._id) : [];
  const controlRecoveries = viewingStudent ? (controlRecoveriesByStudent[extractId(viewingStudent._id)] || []) : [];
  const getControlRecoveryStatus = (student) => {
      const sid = extractId(student?._id);
      const rows = Array.isArray(controlRecoveriesByStudent?.[sid]) ? controlRecoveriesByStudent[sid] : [];
      if (rows.some((row) => row?.teacherValidated === true)) {
          return { label: 'VALIDÉ', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      }
      if (rows.length > 0) {
          return { label: 'EN COURS', className: 'bg-amber-100 text-amber-700 border-amber-200' };
      }
      return { label: 'AUCUN', className: 'bg-slate-100 text-slate-500 border-slate-200' };
  };
  const getPrimaryControlRecovery = (student) => {
      const sid = extractId(student?._id);
      const rows = Array.isArray(controlRecoveriesByStudent?.[sid]) ? controlRecoveriesByStudent[sid] : [];
      if (rows.length === 0) return null;
      const validated = rows.find((row) => row?.teacherValidated === true);
      if (validated) return validated;
      return [...rows].sort((a, b) => {
          const aTs = new Date(a?.updatedAt || a?.createdAt || 0).getTime();
          const bTs = new Date(b?.updatedAt || b?.createdAt || 0).getTime();
          return bTs - aTs;
      })[0] || null;
  };
  const getStudentRealizations = (student) => {
      const sid = extractId(student?._id);
      const studentNameKey = norm(`${student?.firstName || ''} ${student?.lastName || ''}`);
      const classTargetKey = norm(className);
      const homeworkValues = [];
      let gameLevels = 0;
      let learningSteps = 0;
      let homeworkTotal = 0;
      let gameTotal = 0;
      let learningTotal = 0;
      activities.forEach((act) => {
          const assignedIds = (act.assignedStudents || []).map((id) => String(id));
          const isAssignedDirect = assignedIds.includes(sid);
          const targets = (act.targetClassrooms || (act.classroom ? [act.classroom] : [])).map(norm);
          const isAssignedByClass = !!act.isAllClass && targets.includes(classTargetKey);
          if (!(isAssignedDirect || isAssignedByClass)) return;
          const status =
              trackingData[`${sid}_${extractId(act._id)}`] ||
              trackingData[`${sid}_TITLE_${norm(act.title)}`] ||
              trackingData[`${studentNameKey}_TITLE_${norm(act.title)}`];
          if (act.type === 'homework') {
              homeworkTotal += 1;
              homeworkValues.push(status?.done ? gradeToNumber(status?.score) : 0);
          } else if (act.type === 'game') {
              gameTotal += 1;
              gameLevels += Math.max(0, Number(status?.levelReached || 0));
          } else if (act.type === 'learning') {
              learningTotal += 1;
              learningSteps += Math.max(0, Number(status?.currentStep || 0));
          }
      });
      const hwAvg = homeworkValues.length > 0
        ? Math.round((homeworkValues.reduce((a, b) => a + b, 0) / homeworkValues.length) * 10) / 10
        : 0;
      return {
        homework: hwAvg,
        game: gameLevels,
        learning: learningSteps,
        totals: {
          homework: homeworkTotal,
          game: gameTotal,
          learning: learningTotal
        }
      };
  };

  const ficheBoardItems = ficheBoardActivity
    ? activities
        .filter((act) => {
            const sameCurrent = String(extractId(act._id)) === String(extractId(ficheBoardActivity._id));
            const sameFamily = String(act.type || '') === 'production';
            return sameCurrent || sameFamily;
        })
        .flatMap((act) => {
            if (String(act.type || '') === 'fiche') {
              return (act.submissions || []).map((source, index) => {
                const sid = extractId(source?.studentId);
                const student = students.find((row) => extractId(row._id) === sid);
                if (!sid || !student) return null;
                const participantIds = [...new Set([
                  sid,
                  ...((source.participantStudentIds || []).map((id) => String(id)))
                ])];
                const participantNames = participantIds
                  .map((id) => students.find((row) => extractId(row._id) === String(id)))
                  .filter(Boolean)
                  .map((row) => `${row.firstName || ''} ${row.lastName || ''}`.trim())
                  .filter(Boolean);
                return {
                  boardItemId: `${extractId(act._id)}::${extractId(source?._id || index)}`,
                  activityId: extractId(act._id),
                  activityType: String(act.type || ''),
                  submissionId: extractId(source?._id || index),
                  activityTitle: act.title || 'Fiche de révision',
                  contentType: 'fiche',
                  ownerStudentId: sid,
                  ownerName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                  participantIds,
                  participantNames,
                  lessonSlot: Math.max(1, Math.min(5, Number(source.lessonSlot || 1))),
                  typeLabel: 'Fiche de révision',
                  fiche: source
                };
              });
            }
            if (String(act.type || '') === 'production') {
              return (act.submissions || []).map((source, index) => {
                const sid = extractId(source?.studentId);
                const student = students.find((row) => extractId(row._id) === sid);
                if (!sid || !student) return null;
                const sourceType = String(act.productionType || source?.type || 'fiche');
                if (!['fiche', 'questionnaire', 'qcm'].includes(sourceType)) return null;
                const participantIds = [...new Set([
                  sid,
                  ...((source.participantStudentIds || []).map((id) => String(id)))
                ])];
                const participantNames = participantIds
                  .map((id) => students.find((row) => extractId(row._id) === String(id)))
                  .filter(Boolean)
                  .map((row) => `${row.firstName || ''} ${row.lastName || ''}`.trim())
                  .filter(Boolean);
                const typeLabel = sourceType === 'qcm'
                  ? 'QCM'
                  : (sourceType === 'questionnaire' ? 'Apprentissage' : 'Fiche de révision');
                return {
                  boardItemId: `${extractId(act._id)}::${extractId(source?._id || index)}`,
                  activityId: extractId(act._id),
                  activityType: String(act.type || ''),
                  submissionId: extractId(source?._id || index),
                  activityTitle: act.title || typeLabel,
                  contentType: sourceType,
                  ownerStudentId: sid,
                  ownerName: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
                  participantIds,
                  participantNames,
                  lessonSlot: Math.max(1, Math.min(5, Number(source.lessonSlot || 1))),
                  typeLabel,
                  fiche: source
                };
              });
            }
            return [];
        })
        .filter(Boolean)
    : [];

  const saveFicheBoardMeta = async (activityId, activityType, ownerStudentId, payload) => {
      if (!activityId || !ownerStudentId) return;
      setFicheBoardSaving(true);
      try {
          const basePath = String(activityType || '') === 'production'
              ? '/api/productions'
              : '/api/fiches';
          const res = await fetch(`${basePath}/${encodeURIComponent(String(activityId))}/submissions/${encodeURIComponent(String(ownerStudentId))}/meta`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data?.error || 'Enregistrement impossible');
          }
          await loadMatrix();
      } catch (e) {
          alert(e.message || 'Enregistrement impossible');
      } finally {
          setFicheBoardSaving(false);
      }
  };

  const handleFicheBoardDrop = async (event, lessonSlot) => {
      event.preventDefault();
      const raw = event.dataTransfer.getData('text/plain');
      if (!raw) return;
      const [activityId, submissionId] = String(raw).split('::');
      const item = ficheBoardItems.find((row) => row.activityId === activityId && row.submissionId === submissionId);
      if (!item || item.lessonSlot === lessonSlot) return;
      await saveFicheBoardMeta(item.activityId, item.activityType, item.ownerStudentId, {
          lessonSlot,
          participantStudentIds: item.participantIds.filter((id) => id !== item.ownerStudentId),
          submissionId: item.submissionId
      });
  };

  const openFicheBoardEditor = (item) => {
      if (!item) return;
      setFicheBoardEditing({
          ...item,
          participantStudentIds: item.participantIds.filter((id) => id !== item.ownerStudentId)
      });
  };

  const handleSaveFicheBoardEditor = async () => {
      if (!ficheBoardEditing?.ownerStudentId) return;
      await saveFicheBoardMeta(ficheBoardEditing.activityId, ficheBoardEditing.activityType, ficheBoardEditing.ownerStudentId, {
          lessonSlot: ficheBoardEditing.lessonSlot,
          participantStudentIds: ficheBoardEditing.participantStudentIds,
          submissionId: ficheBoardEditing.submissionId
      });
      setFicheBoardEditing(null);
  };

  return (
    <>
        {/* MODALE SUIVI ÉLÈVE */}
        {viewingStudent && (
            <div className="correction-overlay" onClick={() => setViewingStudent(null)}>
                <div className="correction-card !max-w-2xl !h-[80vh]" onClick={e => e.stopPropagation()}>
                    <div className="corr-header bg-slate-900">
                        <div>
                            <h2 className="text-xl font-black uppercase text-white">{viewingStudent.firstName} {viewingStudent.lastName}</h2>
                            <p className="text-xs text-slate-400 font-bold">SUIVI INDIVIDUEL</p>
                        </div>
                        <button onClick={() => setViewingStudent(null)} className="text-white text-2xl font-black">✕</button>
                    </div>
                    <div className="corr-body flex-col bg-slate-50 p-6 overflow-y-auto gap-4 custom-scrollbar">
                        {viewingStudent.isDil === true && (
                            <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-4">
                                <h4 className="text-xs font-black text-violet-700 uppercase mb-2">🌍 DIL · Vocabulaire espagnol</h4>
                                {dilVocabulary.length === 0 ? <p className="text-sm font-bold text-slate-400">Aucun mot enregistré pour le moment.</p> : (
                                    <div className="flex flex-wrap gap-2">
                                        {dilVocabulary.map((word) => (
                                            <span key={word._id} className={`rounded-lg px-2 py-1 text-xs font-black ${word.mastered ? 'bg-emerald-100 text-emerald-700' : 'bg-white text-slate-500 border border-violet-100'}`}>
                                                {word.spanish} → {word.mastered ? word.french : 'à apprendre'}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {/* NOTES MANUELLES DE SCAN */}
                        {Array.isArray(viewingStudent.manualScanGrades) && viewingStudent.manualScanGrades.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-black text-amber-600 uppercase mb-2">✋ Notes manuelles · Scan</h4>
                                {[...viewingStudent.manualScanGrades]
                                    .sort((a, b) => new Date(b.assignmentDate || b.gradedAt || 0) - new Date(a.assignmentDate || a.gradedAt || 0))
                                    .map((grade, index) => (
                                        <div key={`${grade.sessionId || index}`} className="bg-amber-50 border border-amber-200 p-3 rounded-xl flex justify-between items-center gap-3 mb-2">
                                            <div className="min-w-0">
                                                <div className="font-black text-slate-800 break-words">{grade.title || 'Devoir Scan'}</div>
                                                <div className="text-[10px] text-slate-500 font-bold">
                                                    {new Date(grade.assignmentDate || grade.gradedAt).toLocaleDateString('fr-FR')}
                                                </div>
                                            </div>
                                            <div className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-white font-black">{grade.value}/5</div>
                                        </div>
                                    ))}
                            </div>
                        )}
                        
                        {/* PUNITIONS */}
                        {workloadItems.filter(w => w.isPunishment).length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-black text-red-500 uppercase mb-2">⚖️ PUNITIONS EN COURS</h4>
                                {workloadItems.filter(w => w.isPunishment).map(w => (
                                    <div key={w._id} className="bg-red-50 border border-red-200 p-4 rounded-xl flex justify-between items-center mb-2">
                                        <div>
                                            <div className="font-bold text-red-700">{w.title}</div>
                                            <div className="text-[10px] text-red-400 font-bold">{w.isDone ? "RENDUE (EN ATTENTE VALIDATION)" : "NON FAITE"}</div>
                                        </div>
                                        {!w.isDone && (
                                            <button onClick={() => handleRemovePunishment(w._id, viewingStudent._id)} className="bg-white text-red-500 px-3 py-1 rounded border border-red-200 text-xs font-black hover:bg-red-500 hover:text-white transition-colors">
                                                🗑️ ANNULER
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* DEVOIRS */}
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2">📝 RÉCUPÉRATIONS DE CONTRÔLES</h4>
                        {controlRecoveries.map((rec) => (
                            <button key={rec._id} type="button" onClick={() => handleOpenRecoveryWork(viewingStudent, rec)} className="w-full text-left bg-amber-50 border border-amber-200 p-4 rounded-xl mb-3 hover:bg-amber-100 transition-colors">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <div className="font-bold text-slate-700">{rec.title || 'RÉCUPÉRER CONTRÔLE'}</div>
                                        <div className="text-[10px] font-black text-amber-700 uppercase">{rec.subject || 'GÉNÉRAL'} • PHASE {Number(rec.phase || 1)}</div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleValidateRecovery(rec._id); }}
                                        disabled={rec.teacherValidated === true}
                                        type="button"
                                        className="bg-white text-amber-700 px-3 py-2 rounded-xl border border-amber-300 text-xs font-black disabled:opacity-40"
                                    >
                                        {rec.teacherValidated ? 'VALIDÉ' : 'VALIDER'}
                                    </button>
                                </div>

                                <div className="mt-3 space-y-3 text-[12px] text-slate-700">
                                    <div>
                                        <div className="font-black uppercase text-[10px] text-slate-400 mb-1">Phase 1</div>
                                        <div className="font-semibold">Modalité: {rec.submissionMode === 'photo' ? 'Photo' : rec.submissionMode === 'keyboard' ? 'Clavier' : 'Prochain cours'}</div>
                                        {rec.uploadedPhotoUrl && (
                                            <img src={resolveBackendAssetUrl(rec.uploadedPhotoUrl)} alt="Contrôle refait" className="mt-2 max-h-56 rounded-xl border border-amber-200 bg-white" />
                                        )}
                                        {rec.typedRedoText && (
                                            <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3">{rec.typedRedoText}</div>
                                        )}
                                        {rec.nextCourseNote && (
                                            <div className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3">{rec.nextCourseNote}</div>
                                        )}
                                    </div>

                                    <div>
                                        <div className="font-black uppercase text-[10px] text-slate-400 mb-1">Phase 2</div>
                                        <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3">{rec.errorsExplanation || 'Aucune explication.'}</div>
                                    </div>

                                    <div>
                                        <div className="font-black uppercase text-[10px] text-slate-400 mb-1">Phases 3 et 4</div>
                                        <div className="space-y-2">
                                            {(Array.isArray(rec.selfQuestions) ? rec.selfQuestions : []).map((row, idx) => (
                                                <div key={`${rec._id}_${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                    <div className="font-black text-slate-700">Q{idx + 1}. {row.question || 'Question non renseignée'}</div>
                                                    <div className="mt-1"><span className="font-black text-slate-500">Réponse attendue:</span> {row.expectedAnswer || '—'}</div>
                                                    <div className="mt-1"><span className="font-black text-slate-500">Mots-clés:</span> {(row.expectedKeywords || []).join(', ') || '—'}</div>
                                                    <div className="mt-1"><span className="font-black text-slate-500">Réponse élève:</span> {row.studentAnswer || '—'}</div>
                                                    <div className="mt-2 inline-flex px-2 py-1 rounded-full border text-[10px] font-black bg-emerald-50 text-emerald-700 border-emerald-200">
                                                        {String(row.studentAnswer || '').trim() ? '☑ PHASE 4 RÉPONDUE' : '☐ PHASE 4 MANQUANTE'}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!Array.isArray(rec.selfQuestions) || rec.selfQuestions.length === 0) && (
                                                <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-400 italic">Aucune question créée.</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {controlRecoveries.length === 0 && (
                            <div className="text-[12px] text-slate-400 italic mb-4">Aucune récupération de contrôle.</div>
                        )}

                        {/* DEVOIRS */}
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2">📚 DEVOIRS</h4>
                        {workloadItems.filter(w => w.type === 'homework' && !w.isPunishment).map(w => (
                            <div key={w._id} className={`p-4 rounded-xl border flex justify-between items-center mb-2 ${w.isDone ? 'bg-green-50 border-green-200' : 'bg-white border-slate-200'}`}>
                                <div>
                                    <div className="font-bold text-slate-700">{w.title}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">{w.chapterLabel || chapterNameById[extractId(w.chapterId)] || ''}</div>
                                    <div className={`text-[10px] font-black uppercase ${w.isDone ? 'text-green-600' : 'text-red-400'}`}>
                                        {w.isDone ? `✅ FAIT (${w.score})` : '⭕ À FAIRE'}
                                    </div>
                                    {w.isDone && (
                                        <div className={`inline-flex mt-2 px-2 py-1 rounded-full border text-[9px] font-black ${antiCheatTone(w.antiCheat).chip}`}>
                                            {antiCheatTone(w.antiCheat).label}
                                        </div>
                                    )}
                                    {w.draftDoc?.docUrl && (
                                        <div className="mt-2">
                                            <a
                                                href={w.draftDoc.docUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-indigo-200 bg-indigo-50 text-indigo-700 text-[10px] font-black"
                                            >
                                                📄 BROUILLON DOC
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* JEUX */}
                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2 mt-4">🎮 JEUX</h4>
                        {workloadItems.filter(w => w.type === 'game').map(w => (
                            <div key={w._id} className={`p-4 rounded-xl border flex justify-between items-center mb-2 ${w.isDone ? 'bg-purple-50 border-purple-200' : 'bg-white border-slate-200'}`}>
                                <div>
                                    <div className="font-bold text-slate-700">{w.title}</div>
                                    <div className="text-[9px] font-black text-slate-400 uppercase">{w.chapterLabel || chapterNameById[extractId(w.chapterId)] || ''}</div>
                                    <div className={`text-[10px] font-black uppercase ${w.isDone ? 'text-purple-600' : 'text-red-400'}`}>
                                        {w.isDone ? `✅ JOUÉ (${w.score})` : '⭕ PAS ENCORE JOUÉ'}
                                    </div>
                                </div>
                            </div>
                        ))}

                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2 mt-4">🗣️ EXPOSÉS</h4>
                        {workloadItems.filter(w => w.type === 'expose').map(w => (
                            <button key={w._id} type="button" onClick={() => w.isDone && w.presentation && openWorkViewer({ kind: 'expose', title: w.title || 'Exposé', studentName: `${viewingStudent?.firstName || ''} ${viewingStudent?.lastName || ''}`.trim(), chapterLabel: w.chapterLabel || chapterNameById[extractId(w.chapterId)] || '', expose: w.presentation })} className={`w-full text-left p-4 rounded-xl border mb-2 transition-colors ${w.isDone ? 'bg-rose-50 border-rose-200 hover:bg-rose-100' : 'bg-white border-slate-200'}`}>
                                <div className="font-bold text-slate-700">{w.title}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase mb-2">{w.chapterLabel || chapterNameById[extractId(w.chapterId)] || ''}</div>
                                <div className={`text-[10px] font-black uppercase mb-2 ${w.isDone ? 'text-rose-600' : 'text-red-400'}`}>
                                    {w.isDone ? '✅ PRÉSENTATION ENREGISTRÉE' : '⭕ AUCUNE PRÉSENTATION'}
                                </div>
                                {w.presentation && (
                                    <div className="space-y-2">
                                        <div className="text-[11px] font-semibold text-slate-700">
                                            Slides: {w.presentation.slidesText || 'non renseigné'}
                                        </div>
                                        {w.presentation.canvasUrl && (
                                            <iframe
                                                src={w.presentation.canvasUrl}
                                                title={`canvas-${w._id}`}
                                                className="w-full h-[260px] rounded-xl border border-slate-200 bg-white"
                                            />
                                        )}
                                        {w.presentation.recordingUrl && (
                                            <audio controls className="w-full">
                                                <source src={w.presentation.recordingUrl} />
                                                Votre navigateur ne supporte pas l'audio.
                                            </audio>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}

                        <h4 className="text-xs font-black text-slate-400 uppercase mb-2 mt-4">🏗️ PRODUCTIONS</h4>
                        {workloadItems.filter(w => w.type === 'production').map(w => (
                            <button key={w._id} type="button" onClick={() => w.isDone && w.production && openWorkViewer({ kind: 'production', title: w.production.title || w.title || 'Production', studentName: `${viewingStudent?.firstName || ''} ${viewingStudent?.lastName || ''}`.trim(), chapterLabel: w.chapterLabel || chapterNameById[extractId(w.chapterId)] || '', production: w.production })} className={`w-full text-left p-4 rounded-xl border mb-2 transition-colors ${w.isDone ? 'bg-cyan-50 border-cyan-200 hover:bg-cyan-100' : 'bg-white border-slate-200'}`}>
                                <div className="font-bold text-slate-700">{w.title}</div>
                                <div className="text-[9px] font-black text-slate-400 uppercase mb-2">{w.chapterLabel || chapterNameById[extractId(w.chapterId)] || ''}</div>
                                <div className={`text-[10px] font-black uppercase mb-2 ${w.isDone ? 'text-cyan-700' : 'text-red-400'}`}>
                                    {w.isDone ? `✅ TERMINÉ (${w.score || 'OK'})` : '⭕ AUCUNE PRODUCTION'}
                                </div>
                                {w.production && (
                                    <div className="space-y-3">
                                        <div className="text-[10px] font-black uppercase text-slate-500">
                                            {String(w.production.type || 'fiche').toUpperCase()}
                                            {w.production.teacherValidated === true ? ' • VALIDÉ' : ''}
                                        </div>
                                        {w.production.type === 'fiche' && (
                                            <div className="rounded-xl border border-slate-200 bg-white p-3">
                                                {w.production.contentHtml
                                                    ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: w.production.contentHtml }} />
                                                    : <div className="text-slate-400 italic">Fiche vide.</div>}
                                            </div>
                                        )}
                                        {w.production.type !== 'fiche' && (
                                            <div className="space-y-2">
                                                {(w.production.answers || []).map((row, idx) => (
                                                    <div key={`${w._id}_${idx}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                                        {row.levelTitle && <div className="text-[10px] font-black uppercase text-cyan-700 mb-1">{row.levelTitle}</div>}
                                                        <div className="font-black text-slate-700">{row.prompt || 'Question non renseignée'}</div>
                                                        {w.production.type === 'questionnaire' && (
                                                            <>
                                                                <div className="mt-2"><span className="font-black text-slate-500">Réponse:</span> {row.answer || '—'}</div>
                                                                <div className="mt-1"><span className="font-black text-slate-500">Mots-clés:</span> {(row.expectedKeywords || []).join(' ') || '—'}</div>
                                                            </>
                                                        )}
                                                        {w.production.type === 'qcm' && (
                                                            <>
                                                                <div className="mt-2 grid gap-1">
                                                                    {(row.options || []).map((option, optIdx) => (
                                                                        <div key={optIdx} className={`rounded-lg border px-2 py-1 text-[12px] ${Number(row.correctIndex) === optIdx ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-black' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                                                            {option || '—'}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                ))}
                                                {(!Array.isArray(w.production.answers) || w.production.answers.length === 0) && (
                                                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-slate-400 italic">Aucune donnée enregistrée.</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </button>
                        ))}

                        {workloadItems.length === 0 && <div className="text-center p-10 text-slate-300 font-bold italic">Aucune activité assignée.</div>}
                    </div>
                </div>
            </div>
        )}

        {viewingWork && (
            <div className="correction-overlay" onClick={() => setViewingWork(null)}>
                <div className="correction-card !max-w-4xl !h-[82vh]" onClick={(e) => e.stopPropagation()}>
                    <div className="corr-header bg-slate-900">
                        <div>
                            <h2 className="text-xl font-black uppercase text-white">{viewingWork.title}</h2>
                            <p className="text-xs text-slate-400 font-bold">
                                {viewingWork.studentName || 'Élève'}
                                {viewingWork.chapterLabel ? ` • ${viewingWork.chapterLabel}` : ''}
                            </p>
                        </div>
                        <button onClick={() => setViewingWork(null)} className="text-white text-2xl font-black">✕</button>
                    </div>
                    <div className="corr-body flex-col bg-slate-50 p-6 overflow-y-auto gap-4 custom-scrollbar">
                        {viewingWork.kind === 'expose' && (
                            <div className="space-y-4">
                                <div className="text-[11px] font-black uppercase text-rose-600">Présentation enregistrée</div>
                                <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                                    <div><span className="font-black text-slate-500">Slides:</span> {viewingWork.expose?.slidesText || 'non renseigné'}</div>
                                </div>
                                {viewingWork.expose?.canvasUrl && <iframe src={viewingWork.expose.canvasUrl} title={`expose-${viewingWork.title}`} className="w-full min-h-[360px] rounded-xl border border-slate-200 bg-white" />}
                                {viewingWork.expose?.recordingUrl && <audio controls className="w-full"><source src={viewingWork.expose.recordingUrl} /></audio>}
                            </div>
                        )}
                        {viewingWork.kind === 'production' && (
                            <div className="space-y-4">
                                <div className="text-[11px] font-black uppercase text-emerald-600">{String(viewingWork.production?.type || 'fiche').toUpperCase()}</div>
                                {viewingWork.production?.type === 'fiche' ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                        {viewingWork.production?.contentHtml ? <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: viewingWork.production.contentHtml }} /> : <div className="text-slate-400 italic">Aucune donnée enregistrée.</div>}
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {(viewingWork.production?.answers || []).map((row, idx) => (
                                            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <div className="text-[10px] font-black uppercase text-slate-400">{(row.levelTitle || '').trim() || `Niveau/Leçon ${idx + 1}`}</div>
                                                <div className="mt-1 font-black text-slate-800">{row.prompt || 'Question non renseignée'}</div>
                                                {viewingWork.production?.type === 'questionnaire' && <>
                                                    <div className="mt-2"><span className="font-black text-slate-500">Réponse:</span> {row.answer || '—'}</div>
                                                    <div className="mt-1"><span className="font-black text-slate-500">Mots-clés:</span> {(row.expectedKeywords || []).join(' ') || '—'}</div>
                                                </>}
                                                {viewingWork.production?.type === 'qcm' && <div className="mt-2 grid gap-1">
                                                    {(row.options || []).map((option, optIdx) => (
                                                        <div key={optIdx} className={`rounded-lg border px-2 py-1 text-[12px] ${Number(row.correctIndex) === optIdx ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-black' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>{option || '—'}</div>
                                                    ))}
                                                </div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                        {viewingWork.kind === 'fiche' && (
                            <div className="space-y-4">
                                <div className="text-[11px] font-black uppercase text-sky-600">Fiche de révision</div>
                                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                                    {viewingWork.fiche?.contentHtml ? (
                                        <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: viewingWork.fiche.contentHtml }} />
                                    ) : (
                                        <div className="text-slate-400 italic">Aucune donnée enregistrée.</div>
                                    )}
                                </div>
                            </div>
                        )}
                        {viewingWork.kind === 'control-recovery' && (
                            <div className="space-y-4">
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                                    <div className="text-[10px] font-black uppercase text-amber-700">{viewingWork.recovery?.subject || 'GÉNÉRAL'} • PHASE {Number(viewingWork.recovery?.phase || 1)}</div>
                                    <div className="mt-2 text-sm text-slate-700">
                                        <div><span className="font-black text-slate-500">Mode:</span> {viewingWork.recovery?.submissionMode || 'keyboard'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Erreurs expliquées:</span> {viewingWork.recovery?.errorsExplanation || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Texte retapé:</span> {viewingWork.recovery?.typedRedoText || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Note prochain cours:</span> {viewingWork.recovery?.nextCourseNote || '—'}</div>
                                    </div>
                                </div>
                                {Array.isArray(viewingWork.recovery?.phase2Mistakes) && viewingWork.recovery.phase2Mistakes.length > 0 && viewingWork.recovery.phase2Mistakes.map((mistake, idx) => (
                                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                                        <div><span className="font-black text-slate-500">Question:</span> {mistake.questionNumber || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Erreur:</span> {mistake.whatWasWrong || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Correction:</span> {mistake.correctionMade || '—'}</div>
                                    </div>
                                ))}
                                {Array.isArray(viewingWork.recovery?.selfQuestions) && viewingWork.recovery.selfQuestions.length > 0 && viewingWork.recovery.selfQuestions.map((q, idx) => (
                                    <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
                                        <div className="font-black text-slate-800">{q.question || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Réponse attendue:</span> {q.expectedAnswer || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Mots-clés:</span> {(q.expectedKeywords || []).join(' ') || '—'}</div>
                                        <div className="mt-1"><span className="font-black text-slate-500">Réponse élève:</span> {q.studentAnswer || '—'}</div>
                                    </div>
                                ))}
                                {Array.isArray(viewingWork.recovery?.uploadedPhotoUrls) && viewingWork.recovery.uploadedPhotoUrls.length > 0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {viewingWork.recovery.uploadedPhotoUrls.map((url, idx) => (
                                            <img key={idx} src={resolveBackendAssetUrl(url)} alt={`copie-${idx + 1}`} className="w-full rounded-xl border border-slate-200 bg-white" />
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        {ficheBoardActivity && (
            <div className="correction-overlay" onClick={() => !ficheBoardSaving && setFicheBoardActivity(null)}>
                <div className="students-board-card" onClick={(e) => e.stopPropagation()}>
                    <div className="students-board-header">
                        <div>
                            <h2 className="students-board-title">{ficheBoardActivity.title || 'Fiche de révision'}</h2>
                            <p className="students-board-subtitle">Organise les travaux par leçon et ouvre chaque rendu pour voir le contenu.</p>
                        </div>
                        <button onClick={() => setFicheBoardActivity(null)} className="text-slate-500 text-2xl font-black" disabled={ficheBoardSaving}>✕</button>
                    </div>
                    <div className="students-board-grid">
                        {[1, 2, 3, 4, 5].map((lessonSlot) => (
                            <div
                                key={lessonSlot}
                                className="students-board-column"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => handleFicheBoardDrop(e, lessonSlot)}
                            >
                                <div className="students-board-column-head">Leçon {lessonSlot}</div>
                                <div className="students-board-column-body">
                                    {ficheBoardItems.filter((item) => item.lessonSlot === lessonSlot).map((item) => (
                                        <button
                                            key={item.boardItemId}
                                            type="button"
                                            className="students-board-work"
                                            draggable
                                            onDragStart={(e) => e.dataTransfer.setData('text/plain', `${item.activityId}::${item.submissionId}`)}
                                            onClick={() => openFicheBoardEditor(item)}
                                        >
                                            <div className="students-board-work-name">{item.ownerName}</div>
                                            <div className="students-board-work-type">{item.typeLabel}</div>
                                            <div className="students-board-work-type">{item.activityTitle}</div>
                                            <div className="students-board-work-group">{item.participantNames.join(', ')}</div>
                                        </button>
                                    ))}
                                    {ficheBoardItems.filter((item) => item.lessonSlot === lessonSlot).length === 0 && (
                                        <div className="students-board-empty">Aucun travail dans cette leçon.</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {ficheBoardEditing && (
            <div className="correction-overlay" onClick={() => !ficheBoardSaving && setFicheBoardEditing(null)}>
                <div className="students-board-editor" onClick={(e) => e.stopPropagation()}>
                    <div className="students-board-header">
                        <div>
                            <h2 className="students-board-title">{ficheBoardEditing.ownerName}</h2>
                            <p className="students-board-subtitle">{ficheBoardActivity?.title || 'Fiche de révision'} • Leçon {ficheBoardEditing.lessonSlot}</p>
                        </div>
                        <button onClick={() => setFicheBoardEditing(null)} className="text-slate-500 text-2xl font-black" disabled={ficheBoardSaving}>✕</button>
                    </div>
                    <div className="students-board-editor-body">
                        <div className="students-board-editor-preview">
                            {ficheBoardEditing.contentType === 'fiche' && ficheBoardEditing.fiche?.contentHtml ? (
                                <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: ficheBoardEditing.fiche.contentHtml }} />
                            ) : ficheBoardEditing.contentType === 'fiche' && String(ficheBoardEditing.fiche?.plainText || '').trim() ? (
                                <div className="whitespace-pre-wrap text-sm text-slate-700">{String(ficheBoardEditing.fiche?.plainText || '')}</div>
                            ) : ficheBoardEditing.contentType === 'fiche' ? (
                                <div className="text-slate-400 italic">Fiche vide.</div>
                            ) : ficheBoardEditing.contentType === 'questionnaire' ? (
                                Array.isArray(ficheBoardEditing.fiche?.answers) && ficheBoardEditing.fiche.answers.length > 0 ? (
                                    <div className="space-y-3">
                                        {ficheBoardEditing.fiche.answers.map((row, idx) => (
                                            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <div className="text-[10px] font-black uppercase text-slate-400">{(row.levelTitle || '').trim() || `Niveau/Leçon ${idx + 1}`}</div>
                                                <div className="mt-1 font-black text-slate-800">{row.prompt || 'Question non renseignée'}</div>
                                                <div className="mt-2"><span className="font-black text-slate-500">Réponse:</span> {row.answer || '—'}</div>
                                                <div className="mt-1"><span className="font-black text-slate-500">Mots-clés:</span> {(row.expectedKeywords || []).join(' ') || '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : String(ficheBoardEditing.fiche?.plainText || '').trim() ? (
                                    <div className="whitespace-pre-wrap text-sm text-slate-700">{String(ficheBoardEditing.fiche?.plainText || '')}</div>
                                ) : (
                                    <div className="text-slate-400 italic">Aucune réponse enregistrée.</div>
                                )
                            ) : ficheBoardEditing.contentType === 'qcm' ? (
                                Array.isArray(ficheBoardEditing.fiche?.answers) && ficheBoardEditing.fiche.answers.length > 0 ? (
                                    <div className="space-y-3">
                                        {ficheBoardEditing.fiche.answers.map((row, idx) => (
                                            <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-4">
                                                <div className="text-[10px] font-black uppercase text-slate-400">{(row.levelTitle || '').trim() || `Niveau/Leçon ${idx + 1}`}</div>
                                                <div className="mt-1 font-black text-slate-800">{row.prompt || 'Question non renseignée'}</div>
                                                <div className="mt-2 grid gap-1">
                                                    {(row.options || []).map((option, optIdx) => (
                                                        <div key={optIdx} className={`rounded-lg border px-2 py-1 text-[12px] ${Number(row.correctIndex) === optIdx ? 'border-emerald-200 bg-emerald-50 text-emerald-700 font-black' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                                                            {option || '—'}
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2"><span className="font-black text-slate-500">Choix élève:</span> {Number.isInteger(row.selectedIndex) && row.selectedIndex >= 0 ? ((row.options || [])[row.selectedIndex] || `Option ${row.selectedIndex + 1}`) : '—'}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : String(ficheBoardEditing.fiche?.plainText || '').trim() ? (
                                    <div className="whitespace-pre-wrap text-sm text-slate-700">{String(ficheBoardEditing.fiche?.plainText || '')}</div>
                                ) : (
                                    <div className="text-slate-400 italic">Aucune réponse enregistrée.</div>
                                )
                            ) : (
                                <div className="text-slate-400 italic">Aucun aperçu disponible.</div>
                            )}
                        </div>
                        <div className="students-board-editor-side">
                            <label className="corr-label">Leçon</label>
                            <select
                                className="students-board-select"
                                value={ficheBoardEditing.lessonSlot}
                                onChange={(e) => setFicheBoardEditing((prev) => ({ ...prev, lessonSlot: Number(e.target.value) || 1 }))}
                            >
                                {[1, 2, 3, 4, 5].map((slot) => <option key={slot} value={slot}>Leçon {slot}</option>)}
                            </select>
                            <label className="corr-label">Participants</label>
                            <div className="students-board-participants">
                                {students.map((student) => {
                                    const sid = extractId(student._id);
                                    const checked = sid === ficheBoardEditing.ownerStudentId || ficheBoardEditing.participantStudentIds.includes(sid);
                                    return (
                                        <label key={sid} className={`students-board-participant ${checked ? 'is-selected' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                disabled={sid === ficheBoardEditing.ownerStudentId}
                                                onChange={(e) => {
                                                    const nextIds = e.target.checked
                                                        ? [...ficheBoardEditing.participantStudentIds, sid]
                                                        : ficheBoardEditing.participantStudentIds.filter((id) => id !== sid);
                                                    setFicheBoardEditing((prev) => ({ ...prev, participantStudentIds: [...new Set(nextIds)] }));
                                                }}
                                            />
                                            <span>{student.firstName} {student.lastName}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                    <div className="corr-footer">
                        <button onClick={() => setFicheBoardEditing(null)} className="corr-btn-cancel">Fermer</button>
                        <button onClick={handleSaveFicheBoardEditor} className="corr-btn-save" disabled={ficheBoardSaving}>Enregistrer</button>
                    </div>
                </div>
            </div>
        )}

        {gptFeedbackModal && (
            <div className="correction-overlay" onClick={() => setGptFeedbackModal(null)}>
                <div className="students-gpt-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="students-gpt-modal-header">
                        <div>
                            <h2>Retours GPT</h2>
                            <p>
                                {gptFeedbackModal.student?.firstName} {gptFeedbackModal.student?.lastName}
                                {' '}• {gptFeedbackModal.act?.title || 'Apprentissage'}
                            </p>
                        </div>
                        <button type="button" onClick={() => setGptFeedbackModal(null)}>✕</button>
                    </div>
                    <div className="students-gpt-modal-body">
                        {gptFeedbackLoading && (
                            <div className="students-gpt-empty">Chargement des messages GPT...</div>
                        )}
                        {!gptFeedbackLoading && gptFeedbackError && (
                            <div className="students-gpt-error">{gptFeedbackError}</div>
                        )}
                        {!gptFeedbackLoading && !gptFeedbackError && gptFeedbackEntries.length === 0 && (
                            <div className="students-gpt-empty">
                                Aucun post GPT reçu pour cet élève et cette fiche.
                            </div>
                        )}
                        {!gptFeedbackLoading && !gptFeedbackError && gptFeedbackEntries.map((entry) => (
                            <article key={entry._id || `${entry.receivedAt}-${entry.message}`} className="students-gpt-entry">
                                <div className="students-gpt-entry-top">
                                    <span>{formatGptFeedbackDate(entry.receivedAt || entry.createdAt)}</span>
                                    <span className="students-gpt-chip">{entry.type || 'feedback'}</span>
                                    {entry.questionNumber ? <span className="students-gpt-chip is-question">Question {entry.questionNumber}</span> : null}
                                    {entry.mastered ? <span className="students-gpt-chip is-valid">Validé</span> : null}
                                </div>
                                {entry.message && <h3>{entry.message}</h3>}
                                {entry.feedback && <p>{entry.feedback}</p>}
                                {entry.summary && <p>{entry.summary}</p>}
                                {Array.isArray(entry.weakPoints) && entry.weakPoints.length > 0 && (
                                    <div className="students-gpt-subblock">
                                        <strong>À renforcer :</strong> {entry.weakPoints.join(', ')}
                                    </div>
                                )}
                                {Array.isArray(entry.errors) && entry.errors.length > 0 && (
                                    <div className="students-gpt-errors-list">
                                        {entry.errors.map((err, idx) => (
                                            <div key={`${entry._id || 'err'}-${idx}`}>
                                                <strong>{err.question || `Erreur ${idx + 1}`}</strong>
                                                {err.studentAnswer && <span> Réponse : {err.studentAnswer}</span>}
                                                {err.expected && <span> Attendu : {err.expected}</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </article>
                        ))}
                    </div>
                    <div className="students-gpt-modal-footer">
                        <button type="button" onClick={() => openGptFeedback(gptFeedbackModal.student, gptFeedbackModal.act)}>
                            Actualiser
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* MODALE CORRECTION (Existante) */}
        {editingSub && (
            <div className="correction-overlay">
                <div className="correction-card animate-in">
                    <div className="corr-header">
                        <h2 className="text-xl font-black uppercase">CORRECTION</h2>
                        <button onClick={() => setEditingSub(null)} className="text-slate-400 hover:text-white text-2xl font-black">✕</button>
                    </div>
                    {editorLoading || !editorData ? (
                        <div className="flex-1 flex items-center justify-center text-indigo-500 font-black">CHARGEMENT...</div>
                    ) : (
                        <>
                            <div className="corr-body">
                                <div className="mb-3">
                                    <div className={`inline-flex px-3 py-1 rounded-full border text-[10px] font-black ${antiCheatTone(editorData?.antiCheat || {}).chip}`}>
                                        {antiCheatTone(editorData?.antiCheat || {}).label}
                                    </div>
                                    {Array.isArray(editorData?.antiCheat?.reasons) && editorData.antiCheat.reasons.length > 0 && (
                                        <div className="mt-2 text-[11px] font-semibold text-slate-600">
                                            {editorData.antiCheat.reasons.slice(0, 3).join(' • ')}
                                        </div>
                                    )}
                                </div>
                                <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="text-[10px] font-black text-slate-500 uppercase mb-2">Surveillance</div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Temps réflexion avant écriture: {formatMs(editorData?.antiCheat?.telemetry?.firstWriteDelayMs || 0)}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        QCM vérification (durées): {(editorData?.antiCheat?.verification?.qcmDurationsMs || []).length > 0 ? (editorData.antiCheat.verification.qcmDurationsMs.map(formatMs).join(' / ')) : 'n/a'}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Score QCM: {Number(editorData?.antiCheat?.verification?.qcmScore || 0).toFixed(2)}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Mode réponse ouverte: {editorData?.antiCheat?.verification?.mode || 'texte'}
                                    </div>
                                    <div className="text-[11px] text-slate-700 font-semibold">
                                        Temps réponse ouverte: {formatMs(editorData?.antiCheat?.verification?.responseDurationMs || 0)}
                                    </div>
                                    <div className="mt-2 text-[11px] text-slate-700">
                                        <span className="font-black uppercase text-slate-500">Transcription / Réponse ouverte</span>
                                        <div className="mt-1 p-2 rounded border border-slate-100 bg-slate-50 whitespace-pre-wrap">
                                            {editorData?.antiCheat?.verification?.transcript || 'Aucune donnée'}
                                        </div>
                                    </div>
                                </div>
                                <div className="corr-panel-student">
                                    <label className="corr-label">✍️ TEXTE ÉLÈVE</label>
                                    <textarea className="corr-textarea student" value={editorData.content} onChange={e => setEditorData({...editorData, content: e.target.value})} />
                                </div>
                                <div className="corr-panel-prof">
                                    <label className="corr-label">🤖 FEEDBACK</label>
                                    <textarea className="corr-textarea feedback" value={editorData.feedback} onChange={e => setEditorData({...editorData, feedback: e.target.value})} />
                                    <div className="corr-grade-box">
                                        <label className="corr-label">NOTE</label>
                                        <input className="corr-grade-input" value={editorData.grade} onChange={e => setEditorData({...editorData, grade: e.target.value})} />
                                    </div>
                                </div>
                            </div>
                            <div className="corr-footer">
                                <button onClick={() => setEditingSub(null)} className="corr-btn-cancel">ANNULER</button>
                                <button onClick={handleSaveCorrection} className="corr-btn-save">ENREGISTRER</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* TABLEAU */}
        {assessmentControls.length > 0 && <div className="mb-5 rounded-[26px] border border-rose-200 bg-rose-50 p-5"><h3 className="font-black text-rose-800 text-lg mb-3">📝 CONTRÔLES ET CONTESTATIONS</h3>{assessmentControls.map(control => <details key={control._id} className="bg-white border rounded-2xl p-3 mb-2"><summary className="font-black cursor-pointer">{control.title} · {(control.submissions || []).length} copie(s)</summary><div className="mt-3 space-y-2">{(control.submissions || []).map(copy => { const student=students.find(s=>extractId(s._id)===String(copy.studentId)); const contests=(copy.answers||[]).flatMap(answer => { const whole=answer.contestStatus==='pending'?[{answer,message:answer.contestMessage}]:[]; const blanks=(answer.blankResults||[]).filter(blank=>blank.contestStatus==='pending').map(blank=>({answer,blankIndex:blank.index,message:blank.contestMessage})); return [...whole,...blanks]; }); return <div key={copy.id} className="border rounded-xl p-3"><strong>{student?.firstName} {student?.lastName} — {copy.score}/{copy.total}</strong>{contests.map(({answer,blankIndex,message})=><div key={`${answer.itemId}-${blankIndex ?? 'all'}`} className="mt-2 bg-amber-50 p-2 rounded-lg text-xs"><div className="font-bold">Contestation{Number.isInteger(blankIndex)?` · réponse ${blankIndex+1}`:''} : {message}</div><div className="flex gap-2 mt-2"><button onClick={()=>fetch(`/api/controls/${control._id}/contest/${copy.id}/${answer.itemId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({accepted:true,...(Number.isInteger(blankIndex)?{blankIndex}:{})})}).then(loadMatrix)} className="px-3 py-1 bg-green-600 text-white rounded">Accepter</button><button onClick={()=>fetch(`/api/controls/${control._id}/contest/${copy.id}/${answer.itemId}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({accepted:false,...(Number.isInteger(blankIndex)?{blankIndex}:{})})}).then(loadMatrix)} className="px-3 py-1 bg-red-600 text-white rounded">Refuser</button></div></div>)}</div>})}</div></details>)}</div>}
        <div className="bg-white rounded-[30px] border overflow-hidden shadow-xl animate-in flex flex-col max-h-[80vh]">
            <div className="p-6 bg-slate-50 border-b flex justify-between items-center">
                <h3 className="font-black text-slate-700 text-lg uppercase">📊 SUIVI D'ACTIVITÉ : {className}</h3>
                <span className="text-xs font-bold text-slate-400">{students.length} Élèves</span>
            </div>

            {latePunishmentNames.length > 0 && (
                <div className="mx-6 mt-4 mb-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-700 text-xs font-black uppercase">
                    ⚠️ Punitions en retard : {latePunishmentNames.join(', ')}
                </div>
            )}
            
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="students-table w-full">
                    <thead className="sticky top-0 z-10 bg-white shadow-sm">
                        <tr>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-left bg-slate-50 min-w-[200px] border-b border-r">Élève</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center bg-slate-50 border-b w-[100px]">Action</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center bg-slate-50 border-b w-[120px]">Récup contrôle</th>
                            <th className="p-4 text-[10px] font-black text-slate-400 uppercase text-center bg-slate-50 border-b w-[130px]">Réalisations</th>
                            {activities.filter(a => !a.isPunishment).map(act => (
                                <th
                                    key={act._id}
                                    className={`p-4 text-[9px] font-black text-slate-600 uppercase text-center border-b min-w-[100px] max-w-[170px] ${isBoardActivity(act) ? 'students-activity-head is-clickable' : ''}`}
                                    title={`${act.title} • ${act.chapterLabel || ''}`}
                                >
                                    {isBoardActivity(act) ? (
                                        <button
                                            type="button"
                                            className="students-activity-head-button"
                                            onClick={() => setFicheBoardActivity(act)}
                                        >
                                            <div className="truncate">{act.label}</div>
                                            <div className="text-[8px] text-slate-400 font-black truncate">{act.chapterLabel || ''}</div>
                                        </button>
                                    ) : (
                                        <>
                                            <div className="truncate">{act.label}</div>
                                            <div className="text-[8px] text-slate-400 font-black truncate">{act.chapterLabel || ''}</div>
                                        </>
                                    )}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s._id} className="hover:bg-blue-50/50 transition-colors group">
                                {(() => {
                                    const real = getStudentRealizations(s);
                                    return (
                                      <>
                                <td className="p-4 text-xs font-bold text-slate-700 border-r border-b group-hover:text-indigo-700">
                                    {s.firstName} {s.lastName}
                                    {s.punishmentStatus !== 'NONE' && <span className="ml-2 text-[8px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-black">PUNI</span>}
                                    {(() => {
                                        const progress = dnbMethodProgress[extractId(s._id)] || {};
                                        const items = [['presentation', 'DOC'], ['image', 'IMAGE']].filter(([key]) => progress[key]);
                                        if (!items.length) return null;
                                        return <div className="mt-1 flex flex-wrap gap-1">{items.map(([key, label]) => <span key={key} title={`Méthodo ${label.toLowerCase()} : ${progress[key].reached}/${progress[key].total}`} className={`rounded px-1.5 py-0.5 text-[8px] font-black ${progress[key].complete ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{label} {progress[key].complete ? '✓ FINI' : `${progress[key].reached}/${progress[key].total}`}</span>)}</div>;
                                    })()}
                                </td>
                                <td className="p-2 text-center border-b">
                                    <button onClick={() => setViewingStudent(s)} className="bg-slate-100 text-slate-500 px-3 py-1 rounded hover:bg-indigo-100 hover:text-indigo-600 text-[10px] font-black">📋 SUIVI</button>
                                </td>
                                <td className="p-2 text-center border-b">
                                    {(() => {
                                        const recoveryStatus = getControlRecoveryStatus(s);
                                        const recoveryItem = getPrimaryControlRecovery(s);
                                        const isClickable = Boolean(recoveryItem);
                                        return (
                                            <button
                                                type="button"
                                                disabled={!isClickable}
                                                onClick={() => {
                                                    if (!recoveryItem) return;
                                                    handleOpenRecoveryWork(s, recoveryItem);
                                                }}
                                                className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-[10px] font-black border ${recoveryStatus.className} ${isClickable ? 'hover:brightness-95 cursor-pointer' : 'cursor-default'}`}
                                            >
                                                {recoveryStatus.label}
                                            </button>
                                        );
                                    })()}
                                </td>
                                <td className="p-2 text-center border-b">
                                    <div className="inline-flex items-center gap-1">
                                        {real.totals.homework > 0 && <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-black bg-red-100 text-red-700 border border-red-200">{real.homework}</span>}
                                        {real.totals.game > 0 && <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-black bg-violet-100 text-violet-700 border border-violet-200">{real.game}</span>}
                                        {real.totals.learning > 0 && <span className="inline-flex items-center justify-center px-2 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200">{real.learning}</span>}
                                    </div>
                                </td>
                                {activities.filter(a => !a.isPunishment).map(act => {
                                    const studentNameKey = norm(`${s.firstName || ''} ${s.lastName || ''}`);
                                    const sid = extractId(s._id);
                                    const aid = extractId(act._id);
                                    const status =
                                        trackingData[`${sid}_${aid}`] ||
                                        trackingData[`${sid}_TITLE_${norm(act.title)}`] ||
                                        trackingData[`${studentNameKey}_TITLE_${norm(act.title)}`];
                                    return (
                                        <td key={act._id} className="p-2 text-center border-b">
                                            <div className="students-activity-cell-actions">
                                                {status?.done ? (
                                                    <button
                                                        onClick={() => handleOpenActivityWork(s, act, status)}
                                                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black border shadow-sm ${
                                                            act.type === 'homework'
                                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                                : act.type === 'game'
                                                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                                                    : act.type === 'production'
                                                                        ? 'bg-cyan-100 text-cyan-700 border-cyan-200'
                                                                        : act.type === 'fiche'
                                                                            ? 'bg-sky-100 text-sky-700 border-sky-200'
                                                                            : 'bg-rose-100 text-rose-700 border-rose-200'
                                                        }`}
                                                        title={act.type === 'homework' ? antiCheatTone(status.antiCheat).label : ''}
                                                    >
                                                        {status.score || 'OK'}
                                                    </button>
                                                ) : <div className="text-slate-200 text-xs">•</div>}
                                                {act.type === 'learning' && (
                                                    <button
                                                        type="button"
                                                        className="students-gpt-feedback-btn"
                                                        onClick={() => openGptFeedback(s, act)}
                                                        title="Voir les posts et feedbacks envoyés par le GPT"
                                                    >
                                                        GPT
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                      </>
                                    );
                                })()}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    </>
  );
}
