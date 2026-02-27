// @signatures: HomeworkWorkspace, getModalConfig, handleInputCheck, handleModalAction, handleMouseDown, handleMouseMove, handleMouseUp, handleZoom, resolveSource, submitToIA
import React, { useState, useEffect, useRef } from 'react';
import './Homework.css';

export default function HomeworkWorkspace({ homework, user, onQuit }) {
  const [pageIdx, setPageIdx] = useState(0);
  const [activeDocIdx, setActiveDocIdx] = useState(0);
  const [activeInstrIdx, setActiveInstrIdx] = useState(0);
  const [splitTopPercent, setSplitTopPercent] = useState(65);
  const [isResizingSplit, setIsResizingSplit] = useState(false);
  const [answer, setAnswer] = useState('');
  const [draftText, setDraftText] = useState('');
  const [showDraft, setShowDraft] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [questionModalDocIdx, setQuestionModalDocIdx] = useState(0);
  const [windows, setWindows] = useState({
    question: { x: 80, y: 60, w: 980, h: 680 },
    draft: { x: 120, y: 110, w: 560, h: 520 },
    response: { x: 720, y: 120, w: 620, h: 560 }
  });
  const [windowAction, setWindowAction] = useState(null);
  const [windowZ, setWindowZ] = useState({ question: 19010, draft: 19020, response: 19030 });
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [showCheatAlert, setShowCheatAlert] = useState(false);
  const [behaviorNotice, setBehaviorNotice] = useState({ open: false, text: '' });
  const [cheatFlags, setCheatFlags] = useState({ pasteBursts: 0, largeInserts: 0, tabSwitches: 0, hiddenMs: 0, oralAIAssist: 0, fullscreenExits: 0 });
  const [verifyState, setVerifyState] = useState({
    open: false,
    loading: false,
    question: '',
    qcmQuestions: [],
    qcmAnswers: [],
    qcmDurationsMs: [],
    qcmStartedAt: 0,
    challengeId: '',
    expiresAt: 0,
    responseText: '',
    error: '',
    verifying: false
  });
  const [verifyRemainingMs, setVerifyRemainingMs] = useState(0);
  const [speechStatus, setSpeechStatus] = useState({ supported: false, listening: false });
  const [visibilityStart, setVisibilityStart] = useState(null);
  const [lastInputTs, setLastInputTs] = useState(Date.now());
  const [pageElapsedMs, setPageElapsedMs] = useState(0);
  const [micStatus, setMicStatus] = useState({ tested: false, ok: false, error: '' });
  const [oralRequired, setOralRequired] = useState(true);
  const [showStartGate, setShowStartGate] = useState(true);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [verifyOralEvidence, setVerifyOralEvidence] = useState({ used: false, suspiciousHits: 0 });
  const [sessionStartTs, setSessionStartTs] = useState(Date.now());
  const [firstWriteTs, setFirstWriteTs] = useState(null);
  const [writingTrace, setWritingTrace] = useState({
    answer: { events: 0, pauses: 0, revisions: 0, bursts: 0, lastTs: Date.now(), lastLen: 0 },
    draft: { events: 0, pauses: 0, revisions: 0, bursts: 0, lastTs: Date.now(), lastLen: 0 }
  });

  const [docState, setDocState] = useState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const [instrState, setInstrState] = useState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const homeworkStartTsRef = useRef(Date.now());
  const pageStartTsRef = useRef(Date.now());
  const workViewRef = useRef({ page: 0, idx: 0, startedAt: Date.now() });
  const instrViewRef = useRef({ page: 0, idx: 0, startedAt: Date.now() });
  const docTelemetryRef = useRef({});
  const monitorRecognitionRef = useRef(null);
  const monitorActiveRef = useRef(false);
  const verifyOpenRef = useRef(false);

  const currentPage = homework.levels[pageIdx];
  const instrDocs = currentPage.instructionUrls || [];
  const workDocs = currentPage.attachmentUrls || [];

  const ensurePageTelemetry = (pIdx) => {
    if (!docTelemetryRef.current[pIdx]) {
      const lvl = homework.levels?.[pIdx] || {};
      const wLen = (lvl.attachmentUrls || []).length;
      const iLen = (lvl.instructionUrls || []).length;
      docTelemetryRef.current[pIdx] = {
        workDocMs: Array.from({ length: wLen }, () => 0),
        instrDocMs: Array.from({ length: iLen }, () => 0)
      };
    }
    return docTelemetryRef.current[pIdx];
  };

  const commitViewDuration = (viewRef, type, nowTs = Date.now()) => {
    const snap = viewRef.current;
    if (!Number.isFinite(snap?.page) || !Number.isFinite(snap?.idx)) return;
    const elapsed = Math.max(0, nowTs - (snap.startedAt || nowTs));
    if (elapsed === 0) return;
    const pageTele = ensurePageTelemetry(snap.page);
    const target = type === 'work' ? pageTele.workDocMs : pageTele.instrDocMs;
    if (!target || snap.idx < 0 || snap.idx >= target.length) return;
    target[snap.idx] += elapsed;
    viewRef.current.startedAt = nowTs;
  };

  const getDocKind = (url = '') => {
    const u = String(url || '').toLowerCase();
    if (u.includes('.pdf') || u.includes('.txt') || u.includes('.doc') || u.includes('.odt')) return 'text';
    return 'image';
  };
  const getSchoolProfile = () => {
    const cls = String(user?.currentClass || '').toUpperCase().replace(/\s+/g, '');
    const m = cls.match(/(6|5|4|3|2|1|T)/);
    const code = m ? m[1] : null;
    let stage = 'unknown';
    let rank = 0;
    if (code === '6') { stage = 'college'; rank = 6; }
    if (code === '5') { stage = 'college'; rank = 5; }
    if (code === '4') { stage = 'college'; rank = 4; }
    if (code === '3') { stage = 'college'; rank = 3; }
    if (code === '2') { stage = 'lycee'; rank = 2; }
    if (code === '1') { stage = 'lycee'; rank = 1; }
    if (code === 'T') { stage = 'lycee'; rank = 0; }
    return { stage, rank, className: cls };
  };
  const shouldRequireDraftForTask = (instruction = '') => {
    const txt = String(instruction || '').toLowerCase();
    const isHeavyWriting = /dissertation|rédaction|redaction|analyse de texte|commentaire|argumente|développe|développer|essai|synthèse|synthese|brevet/.test(txt);
    const profile = getSchoolProfile();
    if (profile.stage === 'lycee') return isHeavyWriting || txt.length > 60;
    if (profile.stage === 'college') {
      if (profile.rank >= 4) return isHeavyWriting && /rédaction|redaction|brevet|dissertation/.test(txt);
      return isHeavyWriting;
    }
    return isHeavyWriting;
  };

  const estimateLevelMinMs = (level) => {
    const instr = String(level?.instruction || '');
    const docs = [...(level?.attachmentUrls || []), ...(level?.instructionUrls || [])];
    const docsMs = docs.reduce((acc, u) => acc + (getDocKind(u) === 'text' ? 45000 : 12000), 0);
    const reflectionMs = 25000;
    const draftMs = shouldRequireDraftForTask(instr) ? 20000 : 5000;
    let minMs = reflectionMs + draftMs + docsMs;
    if (/dissertation|rédige|rédaction|argumente|développe|analyse/i.test(instr)) minMs = Math.max(minMs, 30 * 60 * 1000);
    return minMs;
  };

  const computeDocConsultationForPage = (pIdx) => {
    const lvl = homework.levels?.[pIdx] || {};
    const pageTele = ensurePageTelemetry(pIdx);
    const work = lvl.attachmentUrls || [];
    const instr = lvl.instructionUrls || [];
    const workThresholds = work.map((u) => (getDocKind(u) === 'text' ? 12000 : 4000));
    const instrThresholds = instr.map((u) => (getDocKind(u) === 'text' ? 12000 : 4000));
    const consultedWork = workThresholds.filter((thr, i) => (pageTele.workDocMs[i] || 0) >= thr).length;
    const consultedInstr = instrThresholds.filter((thr, i) => (pageTele.instrDocMs[i] || 0) >= thr).length;
    const requiredDocs = work.length + instr.length;
    const consultedDocs = consultedWork + consultedInstr;
    const minDocsMs = [...workThresholds, ...instrThresholds].reduce((a, b) => a + b, 0);
    const spentDocsMs = [...(pageTele.workDocMs || []), ...(pageTele.instrDocMs || [])].reduce((a, b) => a + (b || 0), 0);
    return {
      requiredDocs,
      consultedDocs,
      allConsulted: requiredDocs === 0 ? true : consultedDocs >= requiredDocs,
      minDocsMs,
      spentDocsMs
    };
  };

  // CORRECTION V380 : Résolution d'URL Intelligente
  const resolveSource = (url) => {
      if (!url) return '';
      // Cas 1 : URL complète (ex: https://...)
      if (url.startsWith('http')) return url;
      // Cas 1b : URL API déjà prête (ex: /api/structure/proxy/...)
      if (url.startsWith('/api/')) return url;
      // Cas 2 : Upload local (ex: /uploads/...)
      if (url.startsWith('/uploads')) return url;
      // Cas 2b : Toute URL absolue locale
      if (url.startsWith('/')) return url;
      // Cas 3 : ID Drive ou autre -> Proxy
      return `/api/structure/proxy/${url}`;
  };

  useEffect(() => {
    setDocState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
    setInstrState({ scale: 1, x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
    setActiveDocIdx(0);
    setActiveInstrIdx(0);
    commitViewDuration(workViewRef, 'work');
    commitViewDuration(instrViewRef, 'instr');
    const now = Date.now();
    pageStartTsRef.current = now;
    ensurePageTelemetry(pageIdx);
    workViewRef.current = { page: pageIdx, idx: 0, startedAt: now };
    instrViewRef.current = { page: pageIdx, idx: 0, startedAt: now };
    setSessionStartTs(Date.now());
    setFirstWriteTs(null);
    setWritingTrace({
      answer: { events: 0, pauses: 0, revisions: 0, bursts: 0, lastTs: Date.now(), lastLen: 0 },
      draft: { events: 0, pauses: 0, revisions: 0, bursts: 0, lastTs: Date.now(), lastLen: 0 }
    });
    setPageElapsedMs(0);
  }, [pageIdx]);

  useEffect(() => {
    const t = setInterval(() => {
      setPageElapsedMs(Math.max(0, Date.now() - pageStartTsRef.current));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const now = Date.now();
    commitViewDuration(workViewRef, 'work', now);
    workViewRef.current = { page: pageIdx, idx: activeDocIdx, startedAt: now };
  }, [activeDocIdx, pageIdx]);

  useEffect(() => {
    const now = Date.now();
    commitViewDuration(instrViewRef, 'instr', now);
    instrViewRef.current = { page: pageIdx, idx: activeInstrIdx, startedAt: now };
  }, [activeInstrIdx, pageIdx]);

  useEffect(() => {
    if (!isResizingSplit) return;
    const handleMove = (e) => {
      const next = (e.clientY / window.innerHeight) * 100;
      setSplitTopPercent(Math.max(35, Math.min(85, next)));
    };
    const handleUp = () => setIsResizingSplit(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingSplit]);

  useEffect(() => {
    if (!showQuestionModal) return;
    setQuestionModalDocIdx(activeInstrIdx || 0);
  }, [showQuestionModal, activeInstrIdx]);

  useEffect(() => {
    if (!windowAction) return;
    const minW = 520;
    const minH = 340;

    const onMove = (e) => {
      const dx = e.clientX - windowAction.startX;
      const dy = e.clientY - windowAction.startY;
      const start = windowAction.startRect;
      let next = { ...start };

      if (windowAction.type === 'move') {
        next.x = Math.max(0, Math.min(window.innerWidth - start.w, start.x + dx));
        next.y = Math.max(0, Math.min(window.innerHeight - start.h, start.y + dy));
      } else if (windowAction.type === 'resize') {
        const dir = windowAction.dir;
        if (dir.includes('e')) next.w = Math.max(minW, Math.min(window.innerWidth - start.x, start.w + dx));
        if (dir.includes('s')) next.h = Math.max(minH, Math.min(window.innerHeight - start.y, start.h + dy));
        if (dir.includes('w')) {
          const rawX = start.x + dx;
          const maxX = start.x + start.w - minW;
          next.x = Math.max(0, Math.min(maxX, rawX));
          next.w = start.w - (next.x - start.x);
        }
        if (dir.includes('n')) {
          const rawY = start.y + dy;
          const maxY = start.y + start.h - minH;
          next.y = Math.max(0, Math.min(maxY, rawY));
          next.h = start.h - (next.y - start.y);
        }
      }
      setWindows((prev) => ({ ...prev, [windowAction.name]: next }));
    };

    const onUp = () => setWindowAction(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [windowAction]);

  useEffect(() => {
    const supportsSpeech = typeof window !== 'undefined' && (!!window.SpeechRecognition || !!window.webkitSpeechRecognition);
    setSpeechStatus({ supported: supportsSpeech, listening: false });
  }, []);

  useEffect(() => {
    const supported = typeof document !== 'undefined' &&
      !!(document.documentElement?.requestFullscreen || document.documentElement?.webkitRequestFullscreen);
    setFullscreenSupported(supported);
    setIsFullscreen(detectFullscreen());
    const onFsChange = () => {
      const active = detectFullscreen();
      setIsFullscreen(active);
      if (!showStartGate && supported && !active) {
        setCheatFlags((prev) => ({ ...prev, fullscreenExits: prev.fullscreenExits + 1 }));
        showBehaviorNotice("⚠️ Tu as quitté le plein écran. Reviens en plein écran.", 5000);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      document.removeEventListener('webkitfullscreenchange', onFsChange);
    };
  }, [showStartGate]);

  useEffect(() => {
    return () => {
      monitorActiveRef.current = false;
      if (monitorRecognitionRef.current) {
        try { monitorRecognitionRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        setVisibilityStart(Date.now());
        setCheatFlags((prev) => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }));
      } else if (visibilityStart) {
        const delta = Date.now() - visibilityStart;
        setVisibilityStart(null);
        setCheatFlags((prev) => ({ ...prev, hiddenMs: prev.hiddenMs + Math.max(0, delta) }));
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [visibilityStart]);

  useEffect(() => {
    if (!verifyState.open) return;
    verifyOpenRef.current = true;
    const timer = setInterval(() => {
      const left = Math.max(0, verifyState.expiresAt - Date.now());
      setVerifyRemainingMs(left);
      if (left <= 0) {
        setVerifyState((prev) => ({ ...prev, error: "Temps écoulé. Relance l'envoi.", open: false }));
        clearInterval(timer);
      }
    }, 250);
    return () => {
      verifyOpenRef.current = false;
      clearInterval(timer);
    };
  }, [verifyState.open, verifyState.expiresAt]);

  const handleModalAction = () => {
      if (!aiResult) return;
      const g = aiResult.grade;
      if (g === 'C' || g.includes('C')) { setAnswer(''); setAiResult(null); }
      else if (g === 'B' || g.includes('B')) {
          setAiResult(null);
          if(pageIdx < homework.levels.length - 1) { setPageIdx(pageIdx + 1); setAnswer(''); }
          else { onQuit(); }
      }
      else { setAiResult(null); if(pageIdx < homework.levels.length - 1) { setPageIdx(pageIdx + 1); setAnswer(''); } else { onQuit(); } }
  };

  const getModalConfig = () => {
      if (!aiResult) return {};
      const g = aiResult.grade;
      if (g === 'C' || g.includes('C')) return { title: "TRAVAIL INSUFFISANT (C)", btn: "RECOMMENCER À ZÉRO ↺", color: "#ef4444", msg: "Ta réponse va être effacée." };
      if (g === 'B' || g.includes('B')) return { title: "COMPÉTENCE EN COURS (B)", btn: "ENVOYER AU PROF ➔", color: "#eab308", msg: "Copie validée pour le suivi prof." };
      if (g === 'A+' || g.includes('+')) return { title: "EXCELLENT TRAVAIL (A+)", btn: "PAGE SUIVANTE ➔", color: "#14532d", msg: "Parfait !" };
      return { title: "TRAVAIL VALIDÉ (A)", btn: "PAGE SUIVANTE ➔", color: "#22c55e", msg: "C'est validé." };
  };
  const modalConfig = getModalConfig();

  const handleZoom = (type, delta) => { if (type === 'doc') { setDocState(prev => ({ ...prev, scale: Math.max(0.5, Math.min(4, prev.scale + delta)) })); } else { setInstrState(prev => ({ ...prev, scale: Math.max(0.5, Math.min(4, prev.scale + delta)) })); } };
  const handleMouseDown = (e, type) => { const state = type === 'doc' ? docState : instrState; const setState = type === 'doc' ? setDocState : setInstrState; setState({ ...state, dragging: true, startX: e.clientX - state.x, startY: e.clientY - state.y }); };
  const handleMouseMove = (e, type) => { const state = type === 'doc' ? docState : instrState; const setState = type === 'doc' ? setDocState : setInstrState; if (state.dragging) { setState({ ...state, x: e.clientX - state.startX, y: e.clientY - state.startY }); } };
  const handleMouseUp = (type) => { const state = type === 'doc' ? docState : instrState; const setState = type === 'doc' ? setDocState : setInstrState; setState({ ...state, dragging: false }); };
  const flagCheat = () => {
    setShowCheatAlert(true);
    setTimeout(() => setShowCheatAlert(false), 3500);
  };
  const showBehaviorNotice = (text, ms = 4000) => {
    setBehaviorNotice({ open: true, text });
    setTimeout(() => setBehaviorNotice({ open: false, text: '' }), ms);
  };
  const updateWritingTrace = (kind, nextValue, prevValue) => {
    const now = Date.now();
    const deltaChars = nextValue.length - prevValue.length;
    setWritingTrace((prev) => {
      const cur = prev[kind];
      const dt = Math.max(1, now - cur.lastTs);
      const updated = {
        ...cur,
        events: cur.events + 1,
        pauses: cur.pauses + (dt > 1800 ? 1 : 0),
        revisions: cur.revisions + (deltaChars < 0 ? 1 : 0),
        bursts: cur.bursts + (deltaChars > 24 && dt < 220 ? 1 : 0),
        lastTs: now,
        lastLen: nextValue.length
      };
      return { ...prev, [kind]: updated };
    });
    if (!firstWriteTs && nextValue.length > 0) setFirstWriteTs(now);
  };
  const handleInputCheck = (e) => {
    const newValue = e.target.value;
    const now = Date.now();
    const deltaChars = newValue.length - answer.length;
    const deltaTime = Math.max(1, now - lastInputTs);
    if (deltaChars > 50) {
      setCheatFlags((prev) => ({ ...prev, largeInserts: prev.largeInserts + 1 }));
      flagCheat();
    }
    if (deltaChars > 20 && deltaTime < 30) {
      setCheatFlags((prev) => ({ ...prev, pasteBursts: prev.pasteBursts + 1 }));
      flagCheat();
    }
    setLastInputTs(now);
    updateWritingTrace('answer', newValue, answer);
    setAnswer(newValue);
  };
  const handleDraftChange = (e) => {
    const newValue = e.target.value;
    updateWritingTrace('draft', newValue, draftText);
    setDraftText(newValue);
  };
  const handlePaste = () => {
    setCheatFlags((prev) => ({ ...prev, pasteBursts: prev.pasteBursts + 1 }));
    showBehaviorNotice("⚠️ Attention au copier-coller. Rédige avec tes propres mots.");
    flagCheat();
  };
  const formatMs = (ms = 0) => {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const runMicPreflight = async () => {
    try {
      if (!navigator?.mediaDevices?.getUserMedia) throw new Error("API micro indisponible");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicStatus({ tested: true, ok: true, error: '' });
      return true;
    } catch (e) {
      setMicStatus({ tested: true, ok: false, error: "Micro inaccessible. Autorise le micro avant d'envoyer." });
      return false;
    }
  };
  const detectFullscreen = () => {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  };
  const requestExamFullscreen = async () => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
        return true;
      }
      if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };
  const computeThinkingRisk = () => {
    commitViewDuration(workViewRef, 'work');
    commitViewDuration(instrViewRef, 'instr');
    const docsCount = Math.max(1, (workDocs?.length || 0) + (instrDocs?.length || 0));
    const minReadMs = Math.min(24000, docsCount * 3500);
    const elapsedToFirstWrite = firstWriteTs ? (firstWriteTs - sessionStartTs) : 0;
    const answerLen = answer.trim().length;
    const draftLen = draftText.trim().length;
    const a = writingTrace.answer;
    const d = writingTrace.draft;
    const requiresDraft = shouldRequireDraftForTask(currentPage?.instruction || '');
    let risk = 0;
    const reasons = [];
    const answerWords = new Set(String(answer || '').toLowerCase().split(/\W+/).filter(Boolean));
    const answerWordCount = String(answer || '').trim().split(/\s+/).filter(Boolean).length;
    const draftWords = new Set(String(draftText || '').toLowerCase().split(/\W+/).filter(Boolean));
    const inter = [...draftWords].filter((w) => answerWords.has(w)).length;
    const union = new Set([...answerWords, ...draftWords]).size || 1;
    const lexicalSimilarity = inter / union;
    const docConsult = computeDocConsultationForPage(pageIdx);
    const pageElapsed = Date.now() - pageStartTsRef.current;
    const minPageMs = estimateLevelMinMs(currentPage);
    const expectedElapsedToCurrent = homework.levels
      .slice(0, pageIdx + 1)
      .reduce((acc, lvl) => acc + estimateLevelMinMs(lvl), 0);
    const actualGlobalElapsed = Date.now() - homeworkStartTsRef.current;
    const typingWindowMs = Math.max(1, Date.now() - (firstWriteTs || sessionStartTs));
    const approxWpm = Math.round((answerWordCount / (typingWindowMs / 60000)) * 10) / 10;

    if (answerLen >= 80 && elapsedToFirstWrite < minReadMs) { risk += 2; reasons.push("écriture trop rapide après ouverture"); }
    if (a.bursts >= 2) { risk += 2; reasons.push("rafales de texte détectées"); }
    if (answerLen >= 180 && a.events <= 4) { risk += 2; reasons.push("réponse longue saisie en trop peu d'étapes"); }
    if (answerLen >= 120 && a.pauses === 0) { risk += 1; reasons.push("aucune pause de réflexion détectée"); }
    if (answerLen >= 180 && a.revisions === 0) { risk += 2; reasons.push("texte long sans retouches"); }
    if (answerLen >= 160 && approxWpm >= 55 && a.revisions <= 1) { risk += 2; reasons.push("vitesse de rédaction anormalement élevée"); }
    if (answerLen >= 140 && a.events <= 4) { risk += 2; reasons.push("progression de frappe trop linéaire"); }
    if (requiresDraft && answerLen >= 110 && draftLen < 20) { risk += 2; reasons.push("brouillon insuffisant pour ce type d'exercice"); }
    if (requiresDraft && draftLen >= 45 && d.events <= 2) { risk += 2; reasons.push("brouillon non progressif"); }
    if (requiresDraft && d.events > 0 && d.pauses === 0 && draftLen >= 70) { risk += 1; reasons.push("brouillon écrit d'un seul trait"); }
    if (requiresDraft && draftLen >= 90 && answerLen >= 90 && lexicalSimilarity > 0.9 && d.events <= 3) { risk += 2; reasons.push("brouillon trop lisse et trop proche de la copie finale"); }
    if (!docConsult.allConsulted && docConsult.requiredDocs > 0) { risk += 2; reasons.push("documents requis non consultés"); }
    if (docConsult.spentDocsMs < docConsult.minDocsMs * 0.7) { risk += 2; reasons.push("temps de consultation des documents insuffisant"); }
    if (pageElapsed < minPageMs * 0.35 && answerLen >= 120) { risk += 2; reasons.push("temps total question trop court"); }
    if (actualGlobalElapsed < expectedElapsedToCurrent * 0.3 && pageIdx >= 0) { risk += 1; reasons.push("temps global devoir trop court"); }
    if (cheatFlags.pasteBursts > 0) { risk = Math.max(risk, 10); reasons.push("copier-coller détecté (zone rouge)"); }
    if (cheatFlags.oralAIAssist > 0) { risk = Math.max(risk, 8); reasons.push("suspicion d'assistance IA à l'oral"); }
    if (Number(cheatFlags.fullscreenExits || 0) > 0) { risk += 2; reasons.push("sortie du mode plein écran détectée"); }

    return {
      risk,
      reasons,
      minReadMs,
      elapsedToFirstWrite,
      docConsult,
      minPageMs,
      pageElapsed,
      expectedElapsedToCurrent,
      actualGlobalElapsed,
      requiresDraft,
      answerLen,
      answerEvents: a.events,
      answerRevisions: a.revisions,
      answerPauses: a.pauses,
      approxWpm
    };
  };

  const buildAntiCheatPayload = (thinking, verification = {}) => {
    let score = Math.max(0, Math.min(10, Number(thinking?.risk || 0)));
    if (verification.asked) score = Math.max(score, 4);
    if (Number(cheatFlags.pasteBursts || 0) > 0) score = Math.max(score, 10);
    if (Number(cheatFlags.oralAIAssist || 0) > 0) score = Math.max(score, 8);
    if (Number(cheatFlags.fullscreenExits || 0) > 0) score = Math.max(score, 5);
    const level = score >= 8 ? 'RED' : score >= 4 ? 'ORANGE' : 'GREEN';
    const reasons = Array.isArray(thinking?.reasons) ? [...thinking.reasons] : [];
    if (verification.asked && !reasons.includes("question de vérification anti-triche déclenchée")) {
      reasons.push("question de vérification anti-triche déclenchée");
    }
    return {
      score,
      level,
      reasons,
      flags: { ...cheatFlags },
      verification: {
        asked: Boolean(verification.asked),
        passed: verification.passed === true,
        confidence: Number(verification.confidence || 0),
        mode: String(verification.mode || ''),
        feedback: String(verification.feedback || ''),
        qcmScore: Number(verification.qcmScore || 0),
        qcmDurationsMs: Array.isArray(verification.qcmDurationsMs) ? verification.qcmDurationsMs.map((x) => Number(x || 0)) : [],
        transcript: String(verification.transcript || '')
      },
      telemetry: {
        requiredDocs: Number(thinking?.docConsult?.requiredDocs || 0),
        consultedDocs: Number(thinking?.docConsult?.consultedDocs || 0),
        firstWriteDelayMs: Number(thinking?.elapsedToFirstWrite || 0),
        expectedElapsedMs: Number(thinking?.expectedElapsedToCurrent || 0),
        actualElapsedMs: Number(thinking?.actualGlobalElapsed || 0)
      }
    };
  };

  const beginVoiceTranscript = () => {
    if (monitorActiveRef.current) {
      setVerifyOralEvidence((prev) => ({ ...prev, used: true }));
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => setSpeechStatus((prev) => ({ ...prev, listening: true }));
    rec.onend = () => setSpeechStatus((prev) => ({ ...prev, listening: false }));
    rec.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript || '';
      if (!transcript) return;
      handleTranscriptSignal(transcript);
    };
    rec.onerror = () => setSpeechStatus((prev) => ({ ...prev, listening: false }));
    rec.start();
  };
  const handleTranscriptSignal = (transcript = '') => {
    if (!transcript) return;
    const low = transcript.toLowerCase();
    const suspicious = /(chatgpt|ia|intelligence artificielle|google|donne moi la réponse|donne la réponse|c'est quoi la réponse|réponds à ma place)/.test(low);
    if (suspicious) {
      setCheatFlags((prev) => ({ ...prev, oralAIAssist: prev.oralAIAssist + 1 }));
      setVerifyOralEvidence((prev) => ({ ...prev, suspiciousHits: prev.suspiciousHits + 1 }));
    }
    if (verifyOpenRef.current) {
      setVerifyOralEvidence((prev) => ({ ...prev, used: true }));
      setVerifyState((prev) => ({ ...prev, responseText: `${prev.responseText}${prev.responseText ? ' ' : ''}${transcript}` }));
    }
  };
  const startContinuousSpeechMonitor = () => {
    if (!oralRequired) return false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;
    try {
      if (monitorRecognitionRef.current) {
        try { monitorRecognitionRef.current.stop(); } catch (e) {}
        monitorRecognitionRef.current = null;
      }
      const rec = new SR();
      rec.lang = 'fr-FR';
      rec.continuous = true;
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onstart = () => setSpeechStatus((prev) => ({ ...prev, listening: true }));
      rec.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          if (!event.results[i].isFinal) continue;
          const t = event.results[i]?.[0]?.transcript || '';
          handleTranscriptSignal(t);
        }
      };
      rec.onerror = () => setSpeechStatus((prev) => ({ ...prev, listening: false }));
      rec.onend = () => {
        setSpeechStatus((prev) => ({ ...prev, listening: false }));
        if (!monitorActiveRef.current) return;
        setTimeout(() => {
          if (!monitorActiveRef.current || !monitorRecognitionRef.current) return;
          try { monitorRecognitionRef.current.start(); } catch (e) {}
        }, 300);
      };
      monitorRecognitionRef.current = rec;
      monitorActiveRef.current = true;
      rec.start();
      return true;
    } catch (e) {
      monitorActiveRef.current = false;
      return false;
    }
  };
  const handleAcceptExam = async () => {
    if (fullscreenSupported && !detectFullscreen()) {
      const entered = await requestExamFullscreen();
      if (!entered && !detectFullscreen()) {
        setMicStatus((prev) => ({ ...prev, error: "Active le plein écran avant de démarrer l'épreuve." }));
        return;
      }
    }
    const micOk = await runMicPreflight();
    if (micOk) {
      const started = startContinuousSpeechMonitor();
      if (!started) {
        setOralRequired(false);
        setMicStatus({ tested: true, ok: false, error: "Écoute continue indisponible. Mode secours activé." });
      }
    } else {
      setOralRequired(false);
    }
    setShowStartGate(false);
  };

  const startVerificationFlow = async () => {
      if (showStartGate) {
          alert("Lis et accepte d'abord les règles de l'épreuve.");
          return;
      }
      if (!answer.trim()) return;
      if (oralRequired && !micStatus.ok) {
          alert("🎤 Test micro requis avant envoi.");
          const micOk = await runMicPreflight();
          if (!micOk) {
            setOralRequired(false);
          }
      }
      const thinking = computeThinkingRisk();
      const forceVerification =
        thinking.answerLen >= 140 &&
        (
          thinking.answerEvents <= 6 ||
          thinking.answerRevisions === 0 ||
          thinking.approxWpm >= 50
        );
      const needsMoreReading = thinking.reasons.some((r) =>
        r.includes("documents requis non consultés") ||
        r.includes("temps de consultation des documents insuffisant") ||
        r.includes("écriture trop rapide après ouverture")
      );
      if (needsMoreReading) {
          showBehaviorNotice("📚 Merci de lire les documents avant de répondre.", 5000);
          openWindow('question');
          return;
      }
      if (cheatFlags.pasteBursts > 0) {
          showBehaviorNotice("⚠️ Copier-coller détecté: reformule ta réponse avec tes propres mots.");
      }
      if (thinking.risk < 2 && !forceVerification) {
          await submitToIA({ antiCheat: buildAntiCheatPayload(thinking, { asked: false, mode: 'no-check' }) });
          return;
      }
      setVerifyState({
        open: true,
        loading: true,
        question: '',
        qcmQuestions: [],
        qcmAnswers: [],
        qcmDurationsMs: [],
        qcmStartedAt: Date.now(),
        challengeId: '',
        expiresAt: 0,
        responseText: '',
        error: '',
        verifying: false
      });
      setVerifyOralEvidence({ used: false, suspiciousHits: 0 });
      try {
          const res = await fetch('/api/eleve/homework/anti-cheat/challenge', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  userText: answer,
                  instruction: currentPage.instruction || '',
                  playerId: user._id || user.id,
                  homeworkId: homework._id,
                  levelIndex: pageIdx,
                  cheatFlags,
                  writingTrace: {
                    answer: writingTrace.answer,
                    draft: writingTrace.draft,
                    firstWriteDelayMs: firstWriteTs ? firstWriteTs - sessionStartTs : 0,
                    answerLen: answer.trim().length,
                    draftLen: draftText.trim().length
                  },
                  docConsultation: thinking.docConsult,
                  estimatedTimes: {
                    minPageMs: thinking.minPageMs,
                    pageElapsed: thinking.pageElapsed,
                    expectedElapsedToCurrent: thinking.expectedElapsedToCurrent,
                    actualGlobalElapsed: thinking.actualGlobalElapsed
                  },
                  taskPolicy: {
                    requiresDraft: thinking.requiresDraft
                  },
                  suspicion: {
                    score: thinking.risk,
                    reasons: thinking.reasons
                  }
              })
          }).then(r => r.json());
          if (res?.requireSecurity === false) {
              if (res?.clearSuspicion) {
                  setCheatFlags({ pasteBursts: 0, largeInserts: 0, tabSwitches: 0, hiddenMs: 0, oralAIAssist: 0, fullscreenExits: 0 });
                  setShowCheatAlert(false);
              }
              setVerifyState({
                open: false,
                loading: false,
                question: '',
                qcmQuestions: [],
                qcmAnswers: [],
                qcmDurationsMs: [],
                qcmStartedAt: 0,
                challengeId: '',
                expiresAt: 0,
                responseText: '',
                error: '',
                verifying: false
              });
              await submitToIA({ antiCheat: buildAntiCheatPayload(thinking, { asked: false, mode: 'not-required' }) });
              return;
          }
          if (!res?.challengeId) throw new Error(res?.error || 'Challenge indisponible');
          const qcms = Array.isArray(res.qcmQuestions) ? res.qcmQuestions : [];
          setVerifyState({
            open: true,
            loading: false,
            question: res.question || '',
            qcmQuestions: qcms,
            qcmAnswers: qcms.map(() => -1),
            qcmDurationsMs: qcms.map(() => 0),
            qcmStartedAt: Date.now(),
            challengeId: res.challengeId,
            expiresAt: Number(res.expiresAt || 0),
            responseText: '',
            error: '',
            verifying: false
          });
          setVerifyRemainingMs(Math.max(0, Number(res.expiresAt || 0) - Date.now()));
      } catch (e) {
          setVerifyState({
            open: false,
            loading: false,
            question: '',
            qcmQuestions: [],
            qcmAnswers: [],
            qcmDurationsMs: [],
            qcmStartedAt: 0,
            challengeId: '',
            expiresAt: 0,
            responseText: '',
            error: String(e.message || e),
            verifying: false
          });
          alert("Vérification anti-triche indisponible.");
      }
  };

  const handleQcmPick = (qIdx, optionIdx) => {
      setVerifyState((prev) => {
          const answers = [...(prev.qcmAnswers || [])];
          const timings = [...(prev.qcmDurationsMs || [])];
          if (answers[qIdx] === -1 || answers[qIdx] === undefined) {
              const baseTs = Number(prev.qcmStartedAt || Date.now());
              timings[qIdx] = Math.max(0, Date.now() - baseTs);
          }
          answers[qIdx] = optionIdx;
          return { ...prev, qcmAnswers: answers, qcmDurationsMs: timings };
      });
  };

  const confirmVerification = async () => {
      if (!verifyState.responseText.trim()) return;
      if ((verifyState.qcmAnswers || []).some((x) => Number(x) < 0)) {
          setVerifyState((prev) => ({ ...prev, error: "Réponds à tous les QCM de vérification." }));
          return;
      }
      setVerifyState((prev) => ({ ...prev, verifying: true, error: '' }));
      try {
          const verdict = await fetch('/api/eleve/homework/anti-cheat/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  challengeId: verifyState.challengeId,
                  responseText: verifyState.responseText,
                  playerId: user._id || user.id,
                  qcmAnswers: verifyState.qcmAnswers,
                  qcmDurationsMs: verifyState.qcmDurationsMs,
                  responseMode: verifyOralEvidence.used ? 'voice' : 'text'
              })
          }).then(r => r.json());

          if (!verdict?.ok) {
              setVerifyState((prev) => ({ ...prev, verifying: false, error: verdict?.feedback || verdict?.error || "Réponse de vérification insuffisante." }));
              return;
          }
          setVerifyState({
            open: false,
            loading: false,
            question: '',
            qcmQuestions: [],
            qcmAnswers: [],
            qcmDurationsMs: [],
            qcmStartedAt: 0,
            challengeId: '',
            expiresAt: 0,
            responseText: '',
            error: '',
            verifying: false
          });
          const thinking = computeThinkingRisk();
          await submitToIA({
            antiCheat: buildAntiCheatPayload(thinking, {
              asked: true,
              passed: true,
              confidence: Number(verdict?.confidence || 0),
              feedback: String(verdict?.feedback || ''),
              mode: verifyOralEvidence.used ? 'voice' : 'text',
              qcmScore: Number(verdict?.qcmScore || 0),
              qcmDurationsMs: Array.isArray(verdict?.monitoring?.qcmDurationsMs) ? verdict.monitoring.qcmDurationsMs : (verifyState.qcmDurationsMs || []),
              transcript: String(verifyState.responseText || '')
            })
          });
      } catch (e) {
          setVerifyState((prev) => ({ ...prev, verifying: false, error: "Erreur de vérification." }));
      }
  };
  
  const submitToIA = async ({ antiCheat = null } = {}) => { 
      if(!answer.trim()) return; 
      setSubmitting(true); 
      try { 
          const thinking = computeThinkingRisk();
          const antiCheatPayload = antiCheat || buildAntiCheatPayload(thinking, { asked: false, mode: 'fallback' });
          const resp = await fetch('/api/eleve/homework/submit', { 
              method: 'POST', 
              headers: {'Content-Type':'application/json'}, 
              body: JSON.stringify({
                userText: answer,
                homeworkId: homework._id,
                levelIndex: pageIdx,
                playerId: user._id || user.id,
                antiCheat: antiCheatPayload
              }) 
          });
          const res = await resp.json();
          if (!resp.ok) {
              throw new Error(res?.error || "Erreur serveur IA");
          }
          setAiResult(res); 
      } catch(e) { alert(e?.message || "Erreur serveur IA"); } 
      setSubmitting(false); 
  };
  const startSplitResize = (e) => {
    e.preventDefault();
    setIsResizingSplit(true);
  };
  const bringWindowToFront = (name) => {
    setWindowZ((prev) => {
      const top = Math.max(prev.question, prev.draft, prev.response) + 1;
      return { ...prev, [name]: top };
    });
  };
  const openWindow = (name) => {
    if (name === 'question') setShowQuestionModal(true);
    if (name === 'draft') setShowDraft(true);
    if (name === 'response') setShowResponseModal(true);
    bringWindowToFront(name);
  };
  const startWindowMove = (e, name) => {
    e.preventDefault();
    bringWindowToFront(name);
    setWindowAction({
      name,
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...windows[name] }
    });
  };
  const startWindowResize = (e, name, dir) => {
    e.preventDefault();
    e.stopPropagation();
    bringWindowToFront(name);
    setWindowAction({
      name,
      type: 'resize',
      dir,
      startX: e.clientX,
      startY: e.clientY,
      startRect: { ...windows[name] }
    });
  };
  const suspicionRed = cheatFlags.pasteBursts > 0 || cheatFlags.oralAIAssist > 0;

  return (
    <div className="homework-container v8-liseuse">
      {showCheatAlert && <div className="cheat-alert-box">🚨 COPIER-COLLER DÉTECTÉ ! ÉCRIS TOI-MÊME.</div>}
      {behaviorNotice.open && <div className="v8-behavior-notice">{behaviorNotice.text}</div>}
      <button onClick={onQuit} className="v8-quit-btn">⬅ QUITTER</button>
      <div className={`v8-rules-card ${suspicionRed ? 'red' : ''}`}>
          <div className="v8-rules-head">
              <strong>Règles & Timer</strong>
              <span>{formatMs(pageElapsedMs)}</span>
          </div>
          <ul className="v8-rules-list">
              <li>Pas de copier-coller.</li>
              <li>Évite les changements d’onglet.</li>
              <li>Reste en plein écran pendant l’épreuve.</li>
              <li>Lis les documents avant de rédiger.</li>
              <li>{oralRequired ? 'Réponse orale obligatoire aux vérifications.' : 'Mode secours: réponse texte autorisée.'}</li>
          </ul>
          {fullscreenSupported && (
              <button className="v8-mic-test-btn" onClick={requestExamFullscreen}>
                  {isFullscreen ? '🖥️ Plein écran actif' : 'Activer le plein écran'}
              </button>
          )}
          <button className="v8-mic-test-btn" onClick={runMicPreflight}>
              {micStatus.ok ? '🎤 Micro OK' : 'Tester le micro'}
          </button>
          {micStatus.error && <div className="v8-rules-warn">{micStatus.error}</div>}
      </div>
      {showStartGate && (
          <div className="v8-startgate-overlay">
              <div className="v8-startgate-card">
                  <h3>Règles de l’épreuve</h3>
                  <ul>
                      <li>Pas de copier-coller.</li>
                      <li>Évite les changements d’onglet.</li>
                      <li>Plein écran obligatoire pendant l’épreuve.</li>
                      <li>Lis les documents avant de rédiger.</li>
                      <li>Le micro est testé au démarrage.</li>
                  </ul>
                  <div className="v8-startgate-actions">
                      <button className="primary" onClick={handleAcceptExam}>J’accepte</button>
                      <button className="ghost" onClick={() => { setOralRequired(false); setShowStartGate(false); }}>Continuer sans micro (secours)</button>
                  </div>
              </div>
          </div>
      )}

      {/* ZONE SUJET */}
      <div className="viewer-top-area" style={{ height: `${splitTopPercent}%` }} onMouseDown={(e) => handleMouseDown(e, 'doc')} onMouseMove={(e) => handleMouseMove(e, 'doc')} onMouseUp={() => handleMouseUp('doc')} onMouseLeave={() => handleMouseUp('doc')}>
          <div className="v8-zoom-controls">
              <button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('doc', 0.2); }}>+</button>
              <button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('doc', -0.2); }}>-</button>
          </div>
          {workDocs.length > 1 && (<><button className="v8-nav-arrow left" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(Math.max(0, activeDocIdx - 1)); }}>❮</button><button className="v8-nav-arrow right" onClick={(e) => { e.stopPropagation(); setActiveDocIdx(Math.min(workDocs.length - 1, activeDocIdx + 1)); }}>❯</button><div className="v8-doc-counter">{activeDocIdx + 1} / {workDocs.length}</div></>)}
          <div className="v8-pan-container" style={{ transform: `translate(${docState.x}px, ${docState.y}px) scale(${docState.scale})` }}>
              {workDocs.length > 0 ? (
                  <img src={resolveSource(workDocs[activeDocIdx])} className="v8-main-img" draggable="false" />
              ) : <div className="text-slate-700 font-black opacity-20">AUCUN DOCUMENT</div>}
          </div>
      </div>
      <div className={`v8-splitter ${isResizingSplit ? 'is-active' : ''}`} onMouseDown={startSplitResize}>
          <div className="v8-splitter-grip" />
      </div>

      {/* ZONE BAS */}
      <div className="interaction-bottom-area" style={{ height: `${100 - splitTopPercent}%` }}>
          <div className="question-panel" onDoubleClick={() => openWindow('question')}>
              <div className="question-header"><div className="v8-page-badge">ÉTAPE {pageIdx + 1}</div><div className="v8-instruction-text-mini">{currentPage.instruction || "Observez le document."}</div></div>
              <div className="v8-instruction-viewer" onMouseDown={(e) => handleMouseDown(e, 'instr')} onMouseMove={(e) => handleMouseMove(e, 'instr')} onMouseUp={() => handleMouseUp('instr')} onMouseLeave={() => handleMouseUp('instr')}>
                  <div className="v8-zoom-controls" style={{ bottom: '10px', right: '10px' }}><button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('instr', 0.2); }}>+</button><button className="btn-zoom" onClick={(e) => { e.stopPropagation(); handleZoom('instr', -0.2); }}>-</button></div>
                  <div className="v8-pan-container" style={{ transform: `translate(${instrState.x}px, ${instrState.y}px) scale(${instrState.scale})` }}>
                      {instrDocs.length > 0 ? (
                          <img src={resolveSource(instrDocs[activeInstrIdx])} className="v8-instr-img" draggable="false" />
                      ) : <div className="flex items-center justify-center h-full text-slate-300 font-bold text-xs uppercase">Aucune consigne image</div>}
                  </div>
              </div>
              {instrDocs.length > 1 && (<div className="flex gap-2 p-2 bg-white border-t border-slate-100 overflow-x-auto">{instrDocs.map((url, i) => (<img key={i} src={resolveSource(url)} onClick={() => setActiveInstrIdx(i)} className={`w-10 h-10 object-cover rounded border-2 cursor-pointer ${activeInstrIdx === i ? 'border-blue-500' : 'border-slate-200'}`} />))}</div>)}
          </div>

          <div className="answer-panel">
                      <textarea className="answer-input" value={answer} onChange={handleInputCheck} onPaste={handlePaste} placeholder="Votre réponse ici..." />
              <div className="v8-footer-actions">
                  <div className="v8-footer-left">
                      <div className="v8-progress">PAGE {pageIdx + 1} / {homework.levels.length}</div>
                      <button className="btn-draft" onClick={() => openWindow('draft')}>BROUILLON</button>
                      <button className="btn-response-window" onClick={() => openWindow('response')}>RÉPONSE FENÊTRE</button>
                  </div>
                  <button onClick={startVerificationFlow} disabled={submitting} className="btn-send-ai">{submitting ? 'ANALYSE...' : 'ENVOYER 🤖'}</button>
              </div>
          </div>
      </div>

      <div className="v8-windows-layer">
      {showQuestionModal && (
              <div
                  className={`v8-layer-panel v8-question-modal${windowAction ? ' is-moving' : ''}`}
                  style={{ left: windows.question.x, top: windows.question.y, width: windows.question.w, height: windows.question.h, zIndex: windowZ.question }}
                  onMouseDown={() => bringWindowToFront('question')}
              >
                  <div className="v8-layer-head v8-window-head" onMouseDown={(e) => startWindowMove(e, 'question')}>
                      <strong>Question - Étape {pageIdx + 1}</strong>
                      <button onClick={() => setShowQuestionModal(false)} onMouseDown={(e) => e.stopPropagation()}>✕</button>
                  </div>
                  <div className="v8-layer-body question-full">
                      <p className="v8-question-text">{currentPage.instruction || "Observez le document."}</p>
                      {instrDocs.length > 0 && (
                          <div className="v8-question-media-stage">
                              {instrDocs.length > 1 && <button className="v8-stage-nav left" onClick={() => setQuestionModalDocIdx(Math.max(0, questionModalDocIdx - 1))}>❮</button>}
                              <img src={resolveSource(instrDocs[questionModalDocIdx])} alt={`Consigne ${questionModalDocIdx + 1}`} className="v8-question-main-img" />
                              {instrDocs.length > 1 && <button className="v8-stage-nav right" onClick={() => setQuestionModalDocIdx(Math.min(instrDocs.length - 1, questionModalDocIdx + 1))}>❯</button>}
                              {instrDocs.length > 1 && <div className="v8-stage-counter">{questionModalDocIdx + 1} / {instrDocs.length}</div>}
                          </div>
                      )}
                      {instrDocs.length > 1 && (
                          <div className="v8-question-thumbs">
                              {instrDocs.map((url, i) => (
                                  <img key={i} src={resolveSource(url)} alt={`Mini ${i + 1}`} className={questionModalDocIdx === i ? 'active' : ''} onClick={() => setQuestionModalDocIdx(i)} />
                              ))}
                          </div>
                      )}
                      {instrDocs.length === 0 && <div className="v8-question-empty">Aucune image de consigne</div>}
                  </div>
                  <div className="v8-win-resize n" onMouseDown={(e) => startWindowResize(e, 'question', 'n')} />
                  <div className="v8-win-resize s" onMouseDown={(e) => startWindowResize(e, 'question', 's')} />
                  <div className="v8-win-resize e" onMouseDown={(e) => startWindowResize(e, 'question', 'e')} />
                  <div className="v8-win-resize w" onMouseDown={(e) => startWindowResize(e, 'question', 'w')} />
                  <div className="v8-win-resize ne" onMouseDown={(e) => startWindowResize(e, 'question', 'ne')} />
                  <div className="v8-win-resize nw" onMouseDown={(e) => startWindowResize(e, 'question', 'nw')} />
                  <div className="v8-win-resize se" onMouseDown={(e) => startWindowResize(e, 'question', 'se')} />
                  <div className="v8-win-resize sw" onMouseDown={(e) => startWindowResize(e, 'question', 'sw')} />
              </div>
      )}

      {showDraft && (
              <div className="v8-layer-panel v8-draft-panel" style={{ left: windows.draft.x, top: windows.draft.y, width: windows.draft.w, height: windows.draft.h, zIndex: windowZ.draft }} onMouseDown={() => bringWindowToFront('draft')}>
                  <div className="v8-layer-head v8-window-head" onMouseDown={(e) => startWindowMove(e, 'draft')}>
                      <strong>Brouillon</strong>
                      <button onClick={() => setShowDraft(false)} onMouseDown={(e) => e.stopPropagation()}>✕</button>
                  </div>
                  <div className="v8-layer-body">
                      <textarea className="v8-draft-input" placeholder="Écris ton brouillon ici..." value={draftText} onChange={handleDraftChange} onPaste={handlePaste} />
                  </div>
                  <div className="v8-win-resize n" onMouseDown={(e) => startWindowResize(e, 'draft', 'n')} />
                  <div className="v8-win-resize s" onMouseDown={(e) => startWindowResize(e, 'draft', 's')} />
                  <div className="v8-win-resize e" onMouseDown={(e) => startWindowResize(e, 'draft', 'e')} />
                  <div className="v8-win-resize w" onMouseDown={(e) => startWindowResize(e, 'draft', 'w')} />
                  <div className="v8-win-resize ne" onMouseDown={(e) => startWindowResize(e, 'draft', 'ne')} />
                  <div className="v8-win-resize nw" onMouseDown={(e) => startWindowResize(e, 'draft', 'nw')} />
                  <div className="v8-win-resize se" onMouseDown={(e) => startWindowResize(e, 'draft', 'se')} />
                  <div className="v8-win-resize sw" onMouseDown={(e) => startWindowResize(e, 'draft', 'sw')} />
              </div>
      )}
      {showResponseModal && (
              <div className="v8-layer-panel v8-response-panel" style={{ left: windows.response.x, top: windows.response.y, width: windows.response.w, height: windows.response.h, zIndex: windowZ.response }} onMouseDown={() => bringWindowToFront('response')}>
                  <div className="v8-layer-head v8-window-head" onMouseDown={(e) => startWindowMove(e, 'response')}>
                      <strong>Réponse</strong>
                      <button onClick={() => setShowResponseModal(false)} onMouseDown={(e) => e.stopPropagation()}>✕</button>
                  </div>
                  <div className="v8-layer-body">
                      <textarea className="v8-response-input" placeholder="Rédige ta réponse ici..." value={answer} onChange={handleInputCheck} onPaste={handlePaste} />
                  </div>
                  <div className="v8-win-resize n" onMouseDown={(e) => startWindowResize(e, 'response', 'n')} />
                  <div className="v8-win-resize s" onMouseDown={(e) => startWindowResize(e, 'response', 's')} />
                  <div className="v8-win-resize e" onMouseDown={(e) => startWindowResize(e, 'response', 'e')} />
                  <div className="v8-win-resize w" onMouseDown={(e) => startWindowResize(e, 'response', 'w')} />
                  <div className="v8-win-resize ne" onMouseDown={(e) => startWindowResize(e, 'response', 'ne')} />
                  <div className="v8-win-resize nw" onMouseDown={(e) => startWindowResize(e, 'response', 'nw')} />
                  <div className="v8-win-resize se" onMouseDown={(e) => startWindowResize(e, 'response', 'se')} />
                  <div className="v8-win-resize sw" onMouseDown={(e) => startWindowResize(e, 'response', 'sw')} />
              </div>
      )}
      </div>

      {verifyState.open && (
          <div className="v8-verify-overlay">
              <div className="v8-verify-box">
                  <div className="v8-verify-head">
                      <strong>Vérification de compréhension</strong>
                  </div>
                  {Array.isArray(verifyState.qcmQuestions) && verifyState.qcmQuestions.length > 0 && (
                      <div className="mb-3">
                          {verifyState.qcmQuestions.map((q, qIdx) => (
                              <div key={q.id || qIdx} className="mb-2">
                                  <div className="v8-verify-question">{qIdx + 1}. {q.question}</div>
                                  <div className="flex flex-wrap gap-2 mt-1">
                                      {(q.options || []).map((opt, optIdx) => {
                                          const selected = Number(verifyState.qcmAnswers?.[qIdx]) === optIdx;
                                          return (
                                              <button
                                                  key={`${qIdx}_${optIdx}`}
                                                  type="button"
                                                  className={`v8-verify-btn ${selected ? '' : 'ghost'}`}
                                                  onClick={() => handleQcmPick(qIdx, optIdx)}
                                              >
                                                  {String(opt || '')}
                                              </button>
                                          );
                                      })}
                                  </div>
                              </div>
                          ))}
                      </div>
                  )}
                  <div className="v8-verify-question">{verifyState.loading ? 'Chargement...' : verifyState.question}</div>
                  <textarea
                      className="v8-verify-input"
                      value={verifyState.responseText}
                      onChange={(e) => setVerifyState((prev) => ({ ...prev, responseText: e.target.value }))}
                      placeholder="Explique ce que tu as compris avec tes mots (ou utilise le micro)..."
                  />
                  <div className="v8-verify-actions">
                      <button className="v8-verify-btn ghost" onClick={() => setVerifyState((prev) => ({ ...prev, open: false }))}>Annuler</button>
                      {speechStatus.supported && <button className="v8-verify-btn ghost" onClick={beginVoiceTranscript}>{speechStatus.listening ? 'Écoute...' : 'Dicter ma réponse 🎤'}</button>}
                      <button className="v8-verify-btn" onClick={confirmVerification} disabled={verifyState.verifying || !verifyState.responseText.trim()}>
                          {verifyState.verifying ? 'Vérification...' : 'Valider'}
                      </button>
                  </div>
                  {verifyState.error && <div className="v8-verify-error">{verifyState.error}</div>}
              </div>
          </div>
      )}

      {aiResult && (
          <div className="ai-modal-overlay">
              <div className="ai-modal-box">
                  <div className="v8-grade-badge" style={{backgroundColor: modalConfig.color}}>{aiResult.grade}</div>
                  <h2 style={{color: modalConfig.color, fontWeight:900, marginBottom: '5px', textTransform:'uppercase'}}>{modalConfig.title}</h2>
                  <p className="text-xs text-slate-400 font-bold mb-4 uppercase">{modalConfig.msg}</p>
                  <div dangerouslySetInnerHTML={{__html: aiResult.feedback_fond}} className="v8-feedback-content custom-scrollbar" />
                  <button onClick={handleModalAction} className="v8-next-page-btn" style={{backgroundColor: modalConfig.color}}>{modalConfig.btn}</button>
              </div>
          </div>
      )}
    </div>
  );
}
