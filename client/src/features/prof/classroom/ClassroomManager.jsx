// @signatures: ClassroomManager, addBehavior, changeGrid, getMyStats, handleDragOver, handleDragStart, handleDrop, handleFileSelect, handleOpenStudent, loadData, moveStudentTo, renderGrid, renderHeaders, renderList, toggleSeparator
import React, { useState, useEffect, useRef } from 'react';
import './ClassroomManager.css';

export default function ClassroomManager({ globalClassId, user }) {
    const [students, setStudents] = useState([]);
    const [gridSize, setGridSize] = useState({ cols: 6, rows: 5 });
    const [separators, setSeparators] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [iaLoading, setIaLoading] = useState(false);
    const [importPanelOpen, setImportPanelOpen] = useState(false);
    const [sheetUrl, setSheetUrl] = useState('');
    
    // UI STATES
    const [viewMode, setViewMode] = useState('PLAN');
    const [searchTerm, setSearchTerm] = useState("");
    const [planFinder, setPlanFinder] = useState("");
    const [frenchMode, setFrenchMode] = useState(false);
    const [frenchStudentIds, setFrenchStudentIds] = useState([]);
    const [frenchExpression, setFrenchExpression] = useState("");
    const [frenchKeywords, setFrenchKeywords] = useState([]);
    const [frenchSaving, setFrenchSaving] = useState(false);
    const [voiceSupported, setVoiceSupported] = useState(false);
    const [voiceListening, setVoiceListening] = useState(false);
    const [placementStudent, setPlacementStudent] = useState(null);
    
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [isEditingNickname, setIsEditingNickname] = useState(false);
    const [currentNote, setCurrentNote] = useState("");
    const [currentNickname, setCurrentNickname] = useState("");
    const [swapSource, setSwapSource] = useState(null);
    const [isSwapMode, setIsSwapMode] = useState(false);
    const [actionFlash, setActionFlash] = useState('');
    const [classPoints, setClassPoints] = useState(0);
    const penaltyLogRef = useRef({});
    const [draggingId, setDraggingId] = useState(null);
    const [dragOverCell, setDragOverCell] = useState(null);
    const fileInputRef = useRef(null);
    const speechRecognitionRef = useRef(null);
    const keepListeningRef = useRef(false);
    const currentViewModeRef = useRef('PLAN');
    const lastVoiceValueRef = useRef({ PLAN: '', LIST: '' });
    const actionHoldTimerRef = useRef(null);
    const actionHoldModeRef = useRef('idle');
    const behaviorRepeatDelayRef = useRef(null);
    const behaviorRepeatIntervalRef = useRef(null);
    const behaviorRepeatStudentRef = useRef(null);
    const behaviorRepeatDidRepeatRef = useRef(false);
    const behaviorRepeatBusyRef = useRef(false);
    
    const myId = user ? (user._id || user.id) : null;
    const isPunishmentLate = (student) => {
        if (!student) return false;
        if (student.punishmentStatus === 'LATE') return true;
        if (student.punishmentStatus !== 'PENDING' || !student.punishmentDueDate) return false;
        const dueTs = new Date(student.punishmentDueDate).getTime();
        return Number.isFinite(dueTs) && dueTs <= Date.now();
    };

    const loadData = async () => {
        if (!globalClassId) return;
        try {
            const resClass = await fetch(`/api/classroom/${globalClassId}`);
            if (resClass.ok) {
                const clsInfo = await resClass.json();
                if (clsInfo.layout) {
                    setSeparators(clsInfo.layout.separators || []);
                    setGridSize({ 
                        cols: clsInfo.layout.cols || 6, 
                        rows: clsInfo.layout.rows || 5 
                    });
                }
                setClassPoints(clsInfo.classPoints || 0);
            }
            const queryParams = myId ? `?teacherId=${myId}` : '';
            const res = await fetch(`/api/classroom/plan/${globalClassId}${queryParams}`);
            
            if (res.ok) {
                const data = await res.json();
                const nextStudents = Array.isArray(data) ? data : [];
                setStudents(nextStudents);
                setSelectedStudent((current) => {
                    if (!current?._id) return current;
                    return nextStudents.find((student) => String(student._id) === String(current._id)) || current;
                });
            }
        } catch(e) { console.error(e); }
        setLoading(false);
    };

    const updateClassPoints = async (change) => {
        try {
            const res = await fetch(`/api/classroom/${globalClassId}/live-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: change > 0 ? 'add-point' : 'remove-point' })
            });
            if (res.ok) {
                const updatedCls = await res.json();
                setClassPoints(updatedCls.classPoints || 0);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const highlightStudentOnBoard = async (student) => {
        if (!student?._id) return;
        const displayName = getDisplayName(student);
        try {
            await fetch(`/api/classroom/${globalClassId}/live-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'highlight', studentName: displayName })
            });
            setActionFlash('highlight');
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { loadData(); }, [globalClassId, myId]);

    useEffect(() => {
        currentViewModeRef.current = viewMode;
    }, [viewMode]);

    useEffect(() => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
            setVoiceSupported(false);
            return;
        }
        setVoiceSupported(true);
        const recognition = new SR();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results || [])
                .map((r) => String(r?.[0]?.transcript || ''))
                .join(' ')
                .trim();
            if (!transcript) return;
            if (frenchMode) {
                setFrenchExpression(transcript);
                setFrenchKeywords([]);
            } else if (currentViewModeRef.current === 'PLAN') {
                setPlanFinder(transcript);
                lastVoiceValueRef.current.PLAN = transcript;
            } else {
                setSearchTerm(transcript);
                lastVoiceValueRef.current.LIST = transcript;
            }
        };

        recognition.onerror = () => {
            setVoiceListening(false);
        };

        recognition.onend = () => {
            if (keepListeningRef.current) {
                try {
                    recognition.start();
                    setVoiceListening(true);
                } catch (_) {
                    setVoiceListening(false);
                }
            } else {
                setVoiceListening(false);
            }
        };

        speechRecognitionRef.current = recognition;
        return () => {
            keepListeningRef.current = false;
            try { recognition.onresult = null; recognition.onend = null; recognition.onerror = null; recognition.stop(); } catch (_) {}
            speechRecognitionRef.current = null;
        };
    }, [frenchMode]);

    const toggleVoiceFinder = () => {
        if (!voiceSupported || !speechRecognitionRef.current) return;
        if (voiceListening) {
            keepListeningRef.current = false;
            try { speechRecognitionRef.current.stop(); } catch (_) {}
            if (frenchMode) {
                lastVoiceValueRef.current.PLAN = String(frenchExpression || '');
            } else if (currentViewModeRef.current === 'PLAN') {
                setPlanFinder('');
                lastVoiceValueRef.current.PLAN = '';
            } else {
                setSearchTerm('');
                lastVoiceValueRef.current.LIST = '';
            }
            setVoiceListening(false);
            return;
        }
        if (frenchMode) {
            lastVoiceValueRef.current.PLAN = String(frenchExpression || '');
        } else if (currentViewModeRef.current === 'PLAN') {
            lastVoiceValueRef.current.PLAN = String(planFinder || '');
        } else {
            lastVoiceValueRef.current.LIST = String(searchTerm || '');
        }
        keepListeningRef.current = true;
        try {
            speechRecognitionRef.current.start();
            setVoiceListening(true);
        } catch (_) {
            setVoiceListening(false);
        }
    };

    const toggleSeparator = async (colIndex) => { let newSeps = [...separators]; if (newSeps.includes(colIndex)) newSeps = newSeps.filter(s => s !== colIndex); else newSeps.push(colIndex); setSeparators(newSeps); try { await fetch('/api/classroom/layout', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ classId: globalClassId, separators: newSeps }) }); } catch(e){} };
    const changeGrid = async (dC, dR) => { 
        const newSize = { cols: Math.max(2, gridSize.cols + dC), rows: Math.max(2, gridSize.rows + dR) };
        setGridSize(newSize); 
        try {
            await fetch('/api/classroom/layout', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ classId: globalClassId, cols: newSize.cols, rows: newSize.rows }) 
            });
        } catch(e) {}
    };
    const handleDragStart = (e, sId) => { setDraggingId(sId); e.dataTransfer.setData("text/plain", sId); e.dataTransfer.effectAllowed = "move"; };
    const handleDragOver = (e, x, y) => { e.preventDefault(); setDragOverCell(`${x}-${y}`); };
    const handleDrop = async (e, x, y) => { e.preventDefault(); setDragOverCell(null); const sId = draggingId; if (!sId) return; const targetStudent = students.find(s => s.seatX === x && s.seatY === y); const movedStudent = students.find(s => s._id === sId); if (targetStudent && targetStudent._id !== sId) { const oldX = movedStudent.seatX; const oldY = movedStudent.seatY; setStudents(prev => prev.map(s => { if (s._id === sId) return { ...s, seatX: x, seatY: y }; if (s._id === targetStudent._id) return { ...s, seatX: oldX, seatY: oldY }; return s; })); } else { setStudents(prev => prev.map(s => s._id === sId ? { ...s, seatX: x, seatY: y } : s)); } try { await fetch('/api/classroom/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ studentId: sId, x, y }) }); } catch(err) { loadData(); } setDraggingId(null); };
    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!confirm(`Analyser et appliquer le plan « ${file.name} » ?`)) return;
        setIaLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('classId', globalClassId);
        try {
            const response = await fetch('/api/classroom/import-plan', { method: 'POST', body: formData });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Import impossible.');
            setImportPanelOpen(false);
            await loadData();
            alert(data?.message || `Plan importé : ${data?.count || 0} élève(s) placé(s).`);
        } catch(error) { alert(error.message || 'Erreur pendant l’import du plan.'); }
        setIaLoading(false);
        e.target.value = null;
    };
    const handleSheetImport = async () => {
        if (!sheetUrl.trim()) return alert('Colle le lien Google Sheets.');
        setIaLoading(true);
        try {
            const response = await fetch('/api/classroom/import-plan-sheet', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ classId: globalClassId, sheetUrl: sheetUrl.trim() })
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data?.error || 'Import Google Sheets impossible.');
            setSheetUrl('');
            setImportPanelOpen(false);
            await loadData();
            alert(data.message || 'Plan Google Sheets importé.');
        } catch (error) { alert(error.message || 'Import Google Sheets impossible.'); }
        setIaLoading(false);
    };
    const getMyStats = (stu) => { if (!stu.behaviorRecords) return { scores: [] }; return stu.behaviorRecords.find(r => String(r.teacherId) === String(myId)) || { scores: [] }; };
    const getStudentGrades = (stu) => {
        const stats = getMyStats(stu);
        if (Array.isArray(stats.scores) && stats.scores.length) return stats.scores;
        return [{ id: 'legacy', value: Number(stats.baseScore ?? 15) + (Number(stats.bonuses || 0) * 0.5) - Number(stats.crosses || 0) }];
    };
    const getSelectedGrade = (stu) => {
        const grades = getStudentGrades(stu);
        const selected = grades.find(g => String(g.id) === String(getMyStats(stu).selectedScoreId || ''));
        return selected || grades[grades.length - 1];
    };
    const getStudentScore = (stu) => {
        const stats = getMyStats(stu);
        return Number(getSelectedGrade(stu)?.value ?? 15);
    };
    const formatScore = (value) => {
        const n = Number(value || 0);
        return Number.isInteger(n) ? String(n) : n.toFixed(1);
    };
    const showScoreEvolutionOnBoard = async (student, delta) => {
        if (!globalClassId || !student?._id) return;
        const nextScore = getStudentScore(student) + Number(delta || 0);
        const shortName = `${getDisplayName(student)} ${String(student?.lastName || '').slice(0, 1)}.`.trim();
        const isUp = Number(delta || 0) > 0;
        const message = isUp
            ? `Bravo ${shortName} ! Nouvelle note : ${formatScore(nextScore)}`
            : `${shortName} - Nouvelle note : ${formatScore(nextScore)}`;
        try {
            await fetch(`/api/classroom/${globalClassId}/live-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: isUp ? 'bonus-message' : 'highlight',
                    studentName: message,
                    message
                })
            });
        } catch (e) {
            console.error(e);
        }
    };
    const trackPenaltyWarning = async (studentId, student) => {
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;
        const rows = (penaltyLogRef.current[studentId] || []).filter((ts) => now - ts <= hourMs);
        rows.push(now);
        penaltyLogRef.current[studentId] = rows;
        if (rows.length < 2) return;
        const warning = {
            studentId,
            name: `${getDisplayName(student)} ${String(student?.lastName || '').slice(0, 1)}.`.trim(),
            expiresAt: now + hourMs
        };
        const currentWarnings = Object.entries(penaltyLogRef.current)
            .map(([id, timestamps]) => {
                const recent = (timestamps || []).filter((ts) => now - ts <= hourMs);
                if (recent.length < 2) return null;
                const matchedStudent = students.find((s) => String(s._id) === String(id));
                return {
                    studentId: id,
                    name: matchedStudent
                        ? `${getDisplayName(matchedStudent)} ${String(matchedStudent?.lastName || '').slice(0, 1)}.`.trim()
                        : warning.name,
                    expiresAt: Math.min(...recent.slice(-2)) + hourMs
                };
            })
            .filter(Boolean)
            .filter((row) => Number(row.expiresAt || 0) > now && String(row.studentId) !== String(studentId));
        const nextWarnings = [warning, ...currentWarnings].slice(0, 8);
        try {
            await fetch(`/api/classroom/${globalClassId}/live-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'hour-warnings', warnings: nextWarnings })
            });
        } catch (e) {
            console.error(e);
        }
    };
    const addClassScorePoint = async () => {
        const visibleStudents = students.filter((s) => s?._id);
        for (const student of visibleStudents) {
            await addBehavior(student._id, 'ADJUST_SCORE', { delta: 1 }, { keepDrawerOpen: true, silentReload: true, skipFlash: true });
        }
        await updateClassPoints(1);
        try {
            await fetch(`/api/classroom/${globalClassId}/live-action`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'class-bonus', message: 'Bravo +1' })
            });
        } catch (e) {
            console.error(e);
        }
        await loadData();
    };
    const getCrossCountdownLabel = (stu) => {
        const stats = getMyStats(stu);
        const crosses = Math.max(0, Number(stats?.crosses || 0));
        if (crosses <= 0) return '';
        const nextTs = stats?.nextCrossRemovalAt ? new Date(stats.nextCrossRemovalAt).getTime() : NaN;
        if (!Number.isFinite(nextTs)) return '3';
        const msLeft = Math.max(0, nextTs - Date.now());
        const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
        if (daysLeft <= 1) return '1';
        if (daysLeft < 7) return `${daysLeft}`;
        const weeksLeft = Math.ceil(daysLeft / 7);
        return `${weeksLeft}`;
    };
    const handleSwapStudents = async (a, b) => {
        if (!a || !b || String(a._id) === String(b._id)) return;
        const aX = a.seatX, aY = a.seatY;
        const bX = b.seatX, bY = b.seatY;
        if (aX === undefined || aY === undefined || bX === undefined || bY === undefined) return;

        // Optimistic UI
        setStudents(prev => prev.map(s => {
            if (String(s._id) === String(a._id)) return { ...s, seatX: bX, seatY: bY };
            if (String(s._id) === String(b._id)) return { ...s, seatX: aX, seatY: aY };
            return s;
        }));

        try {
            await fetch('/api/classroom/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ studentId: a._id, x: bX, y: bY })
            });
            await fetch('/api/classroom/move', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ studentId: b._id, x: aX, y: aY })
            });
            await loadData();
        } catch (e) {
            loadData();
        }
    };

    const getDisplayName = (stu) => String(stu?.nickname || '').trim() || String(stu?.firstName || '');
    const getForcedSixCount = (stu) => {
        const stats = getMyStats(stu);
        return Math.max(0, Number(stats.forcedSixCount || (stats.forcedSix ? 1 : 0)));
    };
    const hasScoreDebt = (stu) => Boolean(getMyStats(stu).forcedSix || getForcedSixCount(stu) > 0);
    const getStudentStateClass = (stu) => {
        if (stu?.punishmentStatus && stu.punishmentStatus !== 'NONE') return 'punished';
        if (stu?.myNote) return 'has-note';
        if (getMyStats(stu).workIncomplete) return 'work-incomplete';
        return '';
    };
    const getActivityStats = (stu) => {
        const raw = stu?.activityStats || {};
        const homework = Number(raw.homework || 0);
        const game = Number(raw.game || 0);
        const learning = Number(raw.learning || 0);
        return {
            homework: Number.isFinite(homework) ? homework : 0,
            game: Number.isFinite(game) ? game : 0,
            learning: Number.isFinite(learning) ? learning : 0
        };
    };
    const getActivityTotals = (stu) => {
        const raw = stu?.activityTotals || {};
        const homework = Number(raw.homework || 0);
        const game = Number(raw.game || 0);
        const learning = Number(raw.learning || 0);
        return {
            homework: Number.isFinite(homework) ? homework : 0,
            game: Number.isFinite(game) ? game : 0,
            learning: Number.isFinite(learning) ? learning : 0
        };
    };
    const getStudentStars = (stu) => Math.max(0, Math.floor(Number(stu?.trainingStars) || 0));
    const topTrainingStars = students.reduce((highest, student) => Math.max(highest, getStudentStars(student)), 0);
    const isTrainingStarLeader = (student) => topTrainingStars > 0 && getStudentStars(student) === topTrainingStars;
    const normalizeText = (val) => String(val || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    const isPlanFinderMatch = (stu) => {
        const term = normalizeText(planFinder);
        if (!term) return false;
        const fullName = `${stu?.firstName || ''} ${stu?.lastName || ''} ${getDisplayName(stu)}`;
        return normalizeText(fullName).includes(term);
    };
    const isListFinderMatch = (stu) => {
        const term = normalizeText(searchTerm);
        if (!term) return true;
        const fullName = `${stu?.firstName || ''} ${stu?.lastName || ''} ${getDisplayName(stu)}`;
        return normalizeText(fullName).includes(term);
    };
    const planFinderCount = students.filter(isPlanFinderMatch).length;
    const selectedPlanStudents = students.filter(isPlanFinderMatch);
    const listFinderCount = students.filter(isListFinderMatch).length;
    const frenchSelectedStudents = students.filter((student) => frenchStudentIds.includes(String(student._id)));
    const effectivePlanRows = Math.max(gridSize.rows, Math.ceil(students.length / Math.max(1, gridSize.cols)));

    const handleOpenStudent = (stu) => {
        if (frenchMode) {
            const id = String(stu?._id || '');
            if (!id) return;
            setFrenchStudentIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
            return;
        }
        if (placementStudent && String(placementStudent?._id || '') === String(stu?._id || '')) {
            setPlacementStudent(null);
        }
        if (isSwapMode) {
            if (!swapSource) {
                setSwapSource(stu);
                return;
            }
            if (String(swapSource._id) === String(stu._id)) {
                setSwapSource(null);
                return;
            }
            handleSwapStudents(swapSource, stu);
            setSwapSource(null);
            setIsSwapMode(false);
            return;
        }
        setSelectedStudent(stu);
        // En mode FR, le clic sert uniquement à choisir le destinataire de
        // l'expression : il ne doit jamais ouvrir le panneau inférieur de notes.
        if (frenchMode) return;
        setCurrentNote(stu.myNote || "");
        setCurrentNickname(stu.nickname || "");
        setShowNoteInput(false);
        setIsEditingNickname(false);
    };

    const saveFrenchExpression = async () => {
        const expression = String(frenchExpression || '').trim().replace(/\s+/g, ' ');
        if (!expression) return alert('Écris ou dicte un mot ou une expression.');
        const recipientIds = frenchStudentIds.length ? frenchStudentIds : students.map((student) => String(student._id)).filter(Boolean);
        if (!recipientIds.length) return alert('Aucun élève dans cette classe.');
        setFrenchSaving(true);
        try {
            const responses = await Promise.all(recipientIds.map(async (studentId) => {
                const response = await fetch(`/api/eleve/dil/${encodeURIComponent(studentId)}/vocabulary`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ french: expression, spanish: expression, focusWords: frenchKeywords, source: 'teacher-french' })
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) throw new Error(data?.error || 'Enregistrement impossible.');
                return data;
            }));
            setFrenchExpression('');
            setFrenchKeywords([]);
            alert(`Ajouté à la liste de ${responses.length} élève${responses.length > 1 ? 's' : ''}.`);
        } catch (error) {
            alert(error.message || 'Enregistrement impossible.');
        } finally {
            setFrenchSaving(false);
        }
    };

    const toggleFrenchMode = () => {
        setFrenchMode((value) => !value);
        setFrenchStudentIds([]);
        setVoiceListening(false);
        keepListeningRef.current = false;
        try { speechRecognitionRef.current?.stop(); } catch (_) {}
    };

    const normaliseFrenchKeyword = (value) => String(value || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]/g, '');

    const toggleFrenchKeyword = (word) => {
        const key = normaliseFrenchKeyword(word);
        if (!key) return;
        setFrenchKeywords((items) => items.some((item) => normaliseFrenchKeyword(item) === key)
            ? items.filter((item) => normaliseFrenchKeyword(item) !== key)
            : [...items, word]);
    };

    const renderFrenchAssignmentPanel = () => {
        if (!frenchMode) return null;
        const words = String(frenchExpression || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’\-]*/gu) || [];
        return (
            <div className="french-assignment-panel">
                <div className="french-assignment-heading">🇫🇷 Ajout de français {frenchSelectedStudents.length ? <strong>pour {frenchSelectedStudents.map(getDisplayName).join(', ')}</strong> : <span>pour toute la classe</span>}</div>
                <p>Écris ou dicte un mot, une expression ou une phrase. Clique sur les mots à travailler pour les repérer ensuite dans un texte à trous. Sans élève sélectionné, l’ajout est envoyé à toute la classe.</p>
                {!!words.length && <div className="french-keyword-list">{words.map((word, index) => {
                    const selected = frenchKeywords.some((item) => normaliseFrenchKeyword(item) === normaliseFrenchKeyword(word));
                    return <button type="button" key={`${word}-${index}`} className={selected ? 'selected' : ''} onClick={() => toggleFrenchKeyword(word)}>{selected ? '✓ ' : ''}{word}</button>;
                })}</div>}
                {!!frenchKeywords.length && <small>Mots repérés : {frenchKeywords.join(' · ')}</small>}
            </div>
        );
    };

    const startDrawerActionHold = () => {
        actionHoldModeRef.current = 'pending';
        if (actionHoldTimerRef.current) clearTimeout(actionHoldTimerRef.current);
        actionHoldTimerRef.current = setTimeout(() => {
            actionHoldModeRef.current = 'long';
            actionHoldTimerRef.current = null;
        }, 350);
    };

    const endDrawerActionHold = () => {
        if (actionHoldTimerRef.current) {
            clearTimeout(actionHoldTimerRef.current);
            actionHoldTimerRef.current = null;
        }
        if (actionHoldModeRef.current === 'pending') {
            actionHoldModeRef.current = 'short';
        }
    };

    const resetDrawerActionHold = () => {
        if (actionHoldTimerRef.current) {
            clearTimeout(actionHoldTimerRef.current);
            actionHoldTimerRef.current = null;
        }
        actionHoldModeRef.current = 'idle';
    };

    const getDrawerActionKeepOpen = () => {
        const keepOpen = actionHoldModeRef.current === 'long';
        resetDrawerActionHold();
        return keepOpen;
    };

    const stopBehaviorRepeat = (closeDrawer = false) => {
        const hadActiveRepeat = Boolean(
            behaviorRepeatDelayRef.current
            || behaviorRepeatIntervalRef.current
            || behaviorRepeatStudentRef.current
        );
        if (behaviorRepeatDelayRef.current) {
            clearTimeout(behaviorRepeatDelayRef.current);
            behaviorRepeatDelayRef.current = null;
        }
        if (behaviorRepeatIntervalRef.current) {
            clearInterval(behaviorRepeatIntervalRef.current);
            behaviorRepeatIntervalRef.current = null;
        }
        behaviorRepeatStudentRef.current = null;
        if (closeDrawer && hadActiveRepeat) setSelectedStudent(null);
    };

    const startBehaviorRepeat = (studentId, scoreId, delta) => {
        if (!studentId || !scoreId) return;
        stopBehaviorRepeat(false);
        behaviorRepeatDidRepeatRef.current = false;
        behaviorRepeatStudentRef.current = { studentId, scoreId, delta };
        const adjust = async () => {
            if (!behaviorRepeatStudentRef.current || behaviorRepeatBusyRef.current) return;
            behaviorRepeatBusyRef.current = true;
            try {
                await addBehavior(
                    studentId,
                    'ADJUST_SCORE',
                    { scoreId, delta },
                    { keepDrawerOpen: true, silentReload: true, skipFlash: true }
                );
            } finally {
                behaviorRepeatBusyRef.current = false;
            }
        };
        // Un clic bref est traite par onClick. La repetition ne commence que
        // lorsque le bouton est reellement maintenu.
        behaviorRepeatDelayRef.current = setTimeout(() => {
            behaviorRepeatDelayRef.current = null;
            if (!behaviorRepeatStudentRef.current) return;
            behaviorRepeatDidRepeatRef.current = true;
            adjust();
            behaviorRepeatIntervalRef.current = setInterval(adjust, 550);
        }, 450);
    };

    const scoreHoldProps = (student, delta) => ({
        onPointerDown: (event) => {
            event.currentTarget.setPointerCapture?.(event.pointerId);
            startBehaviorRepeat(student?._id, getSelectedGrade(student)?.id, delta);
        },
        onPointerUp: () => stopBehaviorRepeat(false),
        onPointerCancel: () => stopBehaviorRepeat(false),
        onLostPointerCapture: () => stopBehaviorRepeat(false),
        onClick: (event) => {
            event.preventDefault();
            if (behaviorRepeatDidRepeatRef.current) {
                behaviorRepeatDidRepeatRef.current = false;
                return;
            }
            const scoreId = getSelectedGrade(student)?.id;
            if (!student?._id || !scoreId) return;
            addBehavior(
                student._id,
                'ADJUST_SCORE',
                { scoreId, delta },
                { keepDrawerOpen: true }
            );
        },
        onContextMenu: (event) => event.preventDefault()
    });

    const saveNicknameInline = () => {
        if (!selectedStudent?._id) return;
        addBehavior(selectedStudent._id, 'SAVE_NICKNAME', currentNickname);
        setIsEditingNickname(false);
    };

    useEffect(() => {
        if (!actionFlash) return undefined;
        const t = setTimeout(() => setActionFlash(''), 1000);
        return () => clearTimeout(t);
    }, [actionFlash]);

    useEffect(() => () => stopBehaviorRepeat(false), []);
    
    // --- GESTION DES ACTIONS ---
    const addBehavior = async (sid, type, extra = null, options = {}) => { 
        if (!myId) return alert("Erreur: ID Professeur introuvable.");
        const keepDrawerOpen = Boolean(options.keepDrawerOpen);
        const skipFlash = Boolean(options.skipFlash);
        const silentReload = Boolean(options.silentReload);
        const targetStudent = students.find((s) => String(s._id) === String(sid));
        if (!skipFlash && targetStudent && type === 'ADJUST_SCORE') {
            showScoreEvolutionOnBoard(targetStudent, Number(extra?.delta || 0));
        }

        const optimisticScoreId = type === 'ADD_SCORE'
            ? `score-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
            : '';
        const updateStudentLocally = (s) => {
            if (!s || String(s._id) !== String(sid)) return s;
            const newS = { ...s, behaviorRecords: [...(s.behaviorRecords || [])] };
            let rIdx = newS.behaviorRecords.findIndex(r => String(r.teacherId) === String(myId));
            if(rIdx === -1) { newS.behaviorRecords.push({ teacherId: myId, scores: [] }); rIdx = newS.behaviorRecords.length - 1; }
            
            const r = { ...newS.behaviorRecords[rIdx] };
            let scores = Array.isArray(r.scores) && r.scores.length
                ? r.scores.map(g => ({ ...g }))
                : [{ id: 'legacy', value: Number(r.baseScore ?? 15) + Number(r.bonuses || 0) * .5 - Number(r.crosses || 0) }];
            if (type === 'ADD_SCORE') {
                const g = { id: optimisticScoreId, value: 15 };
                scores.push(g);
                r.selectedScoreId = g.id;
            }
            if (type === 'SELECT_SCORE') {
                const selected = scores.find(g => String(g.id) === String(extra?.scoreId));
                r.selectedScoreId = selected?.id || scores[scores.length - 1].id;
            }
            if (type === 'ADJUST_SCORE') {
                const requestedId = extra?.scoreId || r.selectedScoreId || scores[scores.length - 1].id;
                const selected = scores.find(g => String(g.id) === String(requestedId)) || scores[scores.length - 1];
                scores = scores.map(g => String(g.id) === String(selected.id)
                    ? { ...g, value: Math.max(0, Math.min(20, Number(g.value || 0) + Number(extra?.delta || 0))) }
                    : g
                );
                r.selectedScoreId = selected.id;
            }
            if (type === 'DELETE_SCORE' && scores.length > 1) {
                const requestedId = extra?.scoreId || r.selectedScoreId || scores[scores.length - 1].id;
                const remaining = scores.filter(g => String(g.id) !== String(requestedId));
                if (remaining.length) {
                    scores = remaining;
                    r.selectedScoreId = remaining[remaining.length - 1].id;
                }
            }
            if (type === 'TOGGLE_FORCED_SIX') {
                r.forcedSix = !r.forcedSix;
                r.forcedSixCount = r.forcedSix ? Math.max(1, Number(r.forcedSixCount || 0)) : 0;
            }
            if (type === 'ADD_FORCED_SIX') {
                if (!r.forcedSix) {
                    const requestedId = extra?.scoreId || r.selectedScoreId || scores[scores.length - 1].id;
                    const selected = scores.find(g => String(g.id) === String(requestedId)) || scores[scores.length - 1];
                    scores = scores.map(g => String(g.id) === String(selected.id)
                        ? { ...g, value: Math.max(0, Math.min(20, Number(g.value || 0) - 9)) }
                        : g
                    );
                    r.selectedScoreId = selected.id;
                    r.forcedSixScoreId = String(selected.id);
                    r.forcedSixDebtAmount = 9;
                    r.forcedSixCount = 1;
                    r.forcedSix = true;
                }
            }
            if (type === 'REMOVE_FORCED_SIX') {
                if (r.forcedSix) {
                    const requestedId = r.forcedSixScoreId || r.selectedScoreId || scores[scores.length - 1].id;
                    const selected = scores.find(g => String(g.id) === String(requestedId)) || scores[scores.length - 1];
                    scores = scores.map(g => String(g.id) === String(selected.id)
                        ? { ...g, value: Math.max(0, Math.min(20, Number(g.value || 0) + Number(r.forcedSixDebtAmount || 9))) }
                        : g
                    );
                    r.selectedScoreId = selected.id;
                }
                r.forcedSixCount = 0;
                r.forcedSix = false;
                r.forcedSixScoreId = '';
                r.forcedSixDebtAmount = 0;
            }
            if (type === 'TOGGLE_INCOMPLETE') r.workIncomplete = !r.workIncomplete;
            r.scores = scores;
            if (type === 'SAVE_NICKNAME') newS.nickname = String(extra || '').trim();
            
            // Mise à jour visuelle immédiate pour la punition supprimée
            if (type === 'REMOVE_PUNISHMENT') {
                newS.punishmentStatus = 'NONE';
            }
            if (type === 'ADD_PUNISHMENT') newS.punishmentStatus = 'PENDING';

            newS.behaviorRecords[rIdx] = r;
            return newS;
        };

        // Le plan et le tiroir utilisent deux états distincts : les deux doivent
        // être mis à jour pour que la note sélectionnée réagisse immédiatement.
        setStudents(prev => prev.map(updateStudentLocally));
        setSelectedStudent(prev => updateStudentLocally(prev));
        if (selectedStudent && String(selectedStudent._id) === String(sid)) {
            if (type === 'ADJUST_SCORE') setActionFlash(Number(extra?.delta || 0) < 0 ? 'cross' : 'bonus');
        }

        try {
            const res = await fetch('/api/classroom/behavior', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ studentId: sid, type, teacherId: myId, extraData: extra }) 
            });

            if (res.ok) {
                if (!silentReload) await loadData();
                const shouldCloseDrawer = ['SAVE_NOTE', 'REMOVE_PUNISHMENT'].includes(type) && !keepDrawerOpen;
                if (shouldCloseDrawer) setSelectedStudent(null);
            } else {
                const payload = await res.json().catch(() => ({}));
                throw new Error(payload?.error || `Erreur serveur (${res.status})`);
            }
        } catch(e) { console.error("Erreur API", e); loadData(); }
    };

    const moveStudentTo = async (sid, x, y) => { try { await fetch('/api/classroom/move', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ studentId: sid, x, y }) }); await loadData(); } catch(e){} };
    const handlePlaceStudentToCell = async (x, y) => {
        if (!placementStudent?._id) return;
        const targetStudent = students.find((s) => s.seatX === x && s.seatY === y);
        if (targetStudent && String(targetStudent._id) !== String(placementStudent._id)) {
            alert("Cette place est déjà occupée.");
            return;
        }
        await moveStudentTo(placementStudent._id, x, y);
        setPlacementStudent(null);
        setPlanFinder('');
    };

    if (!globalClassId) return <div className="p-10 text-center text-slate-400 font-black">SÉLECTIONNEZ UNE CLASSE</div>;

    const renderGrid = () => {
        const validSeats = students.filter((student) => Number.isInteger(student.seatX) && Number.isInteger(student.seatY)
            && student.seatX >= 0 && student.seatX < gridSize.cols && student.seatY >= 0 && student.seatY < effectivePlanRows);
        const uniqueSeats = new Set(validSeats.map((student) => `${student.seatX}-${student.seatY}`));
        const hasMeaningfulPlan = uniqueSeats.size > 1 || students.length <= 1;
        const occupied = new Set();
        const placedIds = new Set();
        const displayedStudents = [];
        if (hasMeaningfulPlan) {
            validSeats.forEach((student) => {
                const seatKey = `${student.seatX}-${student.seatY}`;
                if (occupied.has(seatKey)) return;
                occupied.add(seatKey);
                placedIds.add(String(student._id));
                displayedStudents.push(student);
            });
        }
        const unplacedStudents = students.filter((student) => !placedIds.has(String(student._id)))
            .sort((a, b) => {
                const first = String(a.firstName || '').localeCompare(String(b.firstName || ''), 'fr', { sensitivity: 'base' });
                return first || String(a.lastName || '').localeCompare(String(b.lastName || ''), 'fr', { sensitivity: 'base' });
            });
        let nextCell = 0;
        unplacedStudents.forEach((student) => {
            while (occupied.has(`${nextCell % gridSize.cols}-${Math.floor(nextCell / gridSize.cols)}`)) nextCell += 1;
            const seatX = nextCell % gridSize.cols;
            const seatY = Math.floor(nextCell / gridSize.cols);
            if (seatY < effectivePlanRows) {
                occupied.add(`${seatX}-${seatY}`);
                displayedStudents.push({ ...student, seatX, seatY });
            }
            nextCell += 1;
        });
        const cells = [];
        for (let y = 0; y < effectivePlanRows; y++) {
            for (let x = 0; x < gridSize.cols; x++) {
                const student = displayedStudents.find(s => s.seatX === x && s.seatY === y);
                const isOver = dragOverCell === `${x}-${y}`;
                const hasSep = separators.includes(x);
                cells.push(
                    <div
                        key={`${x}-${y}`}
                        className={`grid-cell-wrapper ${isOver ? 'drag-over' : ''} ${hasSep ? 'has-separator' : ''} ${placementStudent ? 'placement-mode' : ''}`}
                        style={{ gridColumn: x + 1, gridRow: y + 1 }}
                        onDragOver={(e) => handleDragOver(e, x, y)}
                        onDrop={(e) => handleDrop(e, x, y)}
                        onClick={() => {
                            if (placementStudent) {
                                handlePlaceStudentToCell(x, y);
                                return;
                            }
                            if (!isSwapMode && !student && swapSource) {
                                moveStudentTo(swapSource._id, x, y);
                                setSwapSource(null);
                            }
                        }}
                    >
                        {student ? (
                            <div className={`student-card-drag ${draggingId === student._id ? 'dragging' : ''} ${getStudentStateClass(student)} ${isTrainingStarLeader(student) ? 'has-training-leader' : ''} ${isSwapMode && String(swapSource?._id) === String(student._id) ? 'swap-source' : ''} ${isPlanFinderMatch(student) ? 'finder-hit' : ''} ${frenchMode && frenchStudentIds.includes(String(student._id)) ? 'french-selected' : ''}`} draggable="true" onDragStart={(e) => handleDragStart(e, student._id)} onClick={(e) => { e.stopPropagation(); handleOpenStudent(student); }}>
                                {isTrainingStarLeader(student) && <div className="sc-training-leader" title="Meilleur total d’étoiles">★</div>}
                                <div className="sc-training-stars" title="Étoiles gagnées en entraînement">⭐ {getStudentStars(student)}</div>
                                {student.myNote && <div className="sc-note-badge">N</div>}
                                {student.punishmentStatus && student.punishmentStatus !== 'NONE' && (<div className={`sc-punishment-badge ${isPunishmentLate(student) ? 'late' : 'pending'}`}>P</div>)}
                                <div className="sc-realizations sc-realizations-inline">
                                    {getActivityTotals(student).homework > 0 && <span className="alpha-mini-stat hw" title="Devoir">{getActivityStats(student).homework}</span>}
                                    {getActivityTotals(student).game > 0 && <span className="alpha-mini-stat game" title="Jeu">{getActivityStats(student).game}</span>}
                                    {getActivityTotals(student).learning > 0 && <span className={`alpha-mini-stat learning learning-${student.learningStatus || 'yellow'}`} title="Apprentissage : vert = tout validé, orange = partiel, jaune = non ouvert">{getActivityStats(student).learning}</span>}
                                </div>
                                <div className="sc-avatar-row">
                                    <div className="sc-avatar">{student.gender === 'F' ? '👧' : '👦'}</div>
                                </div>
                                <div className={`sc-name ${getMyStats(student).workIncomplete ? 'work-incomplete' : ''}`}>{getDisplayName(student)}<br/>{student.lastName.slice(0,1)}.</div>
                                <div className="sc-grades">{getStudentGrades(student).map(g => <span key={g.id} className={`sc-score positive ${hasScoreDebt(student) && String(g.id) === String(getMyStats(student).forcedSixScoreId || getSelectedGrade(student)?.id) ? 'debt' : ''}`}>{formatScore(g.value)}</span>)}</div>
                            </div>
                        ) : ( <div className={`grid-cell-empty ${isOver ? 'drag-over' : ''}`}>+</div> )}
                    </div>
                );
            }
        }
        return cells;
    };

    const renderHeaders = () => {
        const headers = [];
        for (let x = 0; x < gridSize.cols; x++) {
            headers.push(
                <div key={x} className="col-header-cell">COL {x+1}
                    {x < gridSize.cols - 1 && (<div className="separator-trigger" onDoubleClick={() => toggleSeparator(x)}><div className="separator-line-hint"></div></div>)}
                </div>
            );
        }
        return headers;
    };

    const renderList = () => {
        const filtered = students
            .filter(isListFinderMatch)
            .sort((a, b) => {
                const firstCmp = String(a.firstName || '').localeCompare(String(b.firstName || ''), 'fr', { sensitivity: 'base' });
                if (firstCmp !== 0) return firstCmp;
                return String(a.lastName || '').localeCompare(String(b.lastName || ''), 'fr', { sensitivity: 'base' });
            });
        const alphaRows = Math.max(gridSize.rows, Math.ceil(filtered.length / Math.max(1, gridSize.cols)));
        return (
            <div className="list-container custom-scrollbar alphabetic-layout">
                <div className="list-finder-row">
                    <input className="plan-finder-input" placeholder={frenchMode ? (frenchSelectedStudents.length ? `Mot ou expression pour ${frenchSelectedStudents.length} élève(s)…` : 'Mot ou expression pour toute la classe…') : '🔎 Trouver un élève de la classe...'} value={frenchMode ? frenchExpression : searchTerm} onChange={e => frenchMode ? (setFrenchExpression(e.target.value), setFrenchKeywords([])) : setSearchTerm(e.target.value)} />
                    <div className="plan-finder-count-wrap">
                        {!frenchMode && <span className="plan-finder-count" title={searchTerm.trim() ? 'Élèves trouvés dans la classe' : 'Élèves de la classe'}>
                            {searchTerm.trim() ? listFinderCount : students.length}
                        </span>}
                        <button className={`french-mode-btn ${frenchMode ? 'active' : ''}`} onClick={toggleFrenchMode} title="Mode français : choisis un élève puis ajoute un mot ou une expression">FR</button>
                        {(frenchMode ? frenchExpression : searchTerm).trim() && (
                            <button
                                className="finder-clear-btn"
                                onClick={() => frenchMode ? (setFrenchExpression(''), setFrenchKeywords([])) : setSearchTerm('')}
                                title="Effacer la recherche"
                            >
                                ✕
                            </button>
                        )}
                        {frenchMode && <button className="french-validate-btn" onClick={saveFrenchExpression} disabled={frenchSaving || !frenchExpression.trim()}>{frenchSaving ? '…' : 'VALIDER'}</button>}
                    </div>
                </div>
                {renderFrenchAssignmentPanel()}
                <div className="alpha-plan-board">
                    <div className="grid-header-row alpha-header-row" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))` }}>
                        {Array.from({ length: gridSize.cols }).map((_, x) => <div key={x} className="col-header-cell">COL {x + 1}</div>)}
                    </div>
                    <div className="interactive-grid alpha-grid" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))`, gridTemplateRows: `repeat(${alphaRows}, var(--cell-size, 100px))` }}>
                        {Array.from({ length: gridSize.cols * alphaRows }).map((_, idx) => {
                            const student = filtered[idx] || null;
                            const col = idx % gridSize.cols;
                            const row = Math.floor(idx / gridSize.cols);
                            if (!student) {
                                return (
                                    <div
                                        key={`alpha-empty-${idx}`}
                                        className="grid-cell-wrapper alpha-static-cell"
                                        style={{ gridColumn: col + 1, gridRow: row + 1 }}
                                    >
                                        <div className="grid-cell-empty">+</div>
                                    </div>
                                );
                            }
                            const stats = getMyStats(student);
                            const aStats = getActivityStats(student);
                            const aTotals = getActivityTotals(student);
                            return (
                                <div
                                    key={student._id}
                                    className="grid-cell-wrapper alpha-static-cell"
                                    style={{ gridColumn: col + 1, gridRow: row + 1 }}
                                >
                                    <div
                                        className={`student-card-drag alpha-grid-card ${getStudentStateClass(student)} ${isTrainingStarLeader(student) ? 'has-training-leader' : ''} ${isSwapMode && String(swapSource?._id) === String(student._id) ? 'swap-source' : ''} ${isListFinderMatch(student) && searchTerm.trim() ? 'finder-hit' : ''} ${frenchMode && frenchStudentIds.includes(String(student._id)) ? 'french-selected' : ''}`}
                                        onClick={() => handleOpenStudent(student)}
                                    >
                                        {isTrainingStarLeader(student) && <div className="sc-training-leader" title="Meilleur total d’étoiles">★</div>}
                                        <div className="sc-training-stars" title="Étoiles gagnées en entraînement">⭐ {getStudentStars(student)}</div>
                                        <div className="alpha-grid-topline">
                                            {aTotals.homework > 0 && <span className="alpha-mini-stat hw">{aStats.homework}</span>}
                                            {aTotals.game > 0 && <span className="alpha-mini-stat game">{aStats.game}</span>}
                                            {aTotals.learning > 0 && <span className={`alpha-mini-stat learning learning-${student.learningStatus || 'yellow'}`}>{aStats.learning}</span>}
                                        </div>
                                        <div className="sc-avatar">{student.gender === 'F' ? '👧' : '👦'}</div>
                                        <div className={`sc-name ${stats.workIncomplete ? 'work-incomplete' : ''}`}>{getDisplayName(student)}<br />{String(student.lastName || '').slice(0, 1)}.</div>
                                        <div className="sc-grades">{getStudentGrades(student).map(g => <span key={g.id} className="sc-score positive">{formatScore(g.value)}</span>)}{Array.from({ length: getForcedSixCount(student) }).map((_, sixIdx) => <span key={`six-${sixIdx}`} className="sc-score forced">6</span>)}</div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    };

    const renderPlanMatchesList = () => {
        if (!planFinder.trim()) return null;
        const filtered = [...selectedPlanStudents].sort((a, b) => String(a.lastName || '').localeCompare(String(b.lastName || '')));
        if (filtered.length === 0) return null;
        return (
            <div className="plan-matches-list custom-scrollbar">
                {filtered.map((s) => {
                    const stats = getMyStats(s);
                    const aStats = getActivityStats(s);
                    const aTotals = getActivityTotals(s);
                    const isPlaced = Number.isFinite(Number(s?.seatX)) && Number.isFinite(Number(s?.seatY));
                    const isPlacementActive = String(placementStudent?._id || '') === String(s._id || '');
                    return (
                        <div key={s._id} className={`plan-match-row ${isPlacementActive ? 'placing' : ''}`}>
                            <div className="plan-match-info" onClick={() => handleOpenStudent(s)}>
                                <span className="plan-match-name">{s.lastName} {getDisplayName(s)}</span>
                                <span className="plan-match-stats">
                                    Note {formatScore(getStudentScore(s))}
                                    {' | '}
                                    {isPlaced ? `placé ${Number(s.seatX) + 1}-${Number(s.seatY) + 1}` : 'non placé'}
                                    <span className="plan-match-real">
                                        {aTotals.homework > 0 && <span className="sc-real-badge hw">{aStats.homework}</span>}
                                        {aTotals.game > 0 && <span className="sc-real-badge game">{aStats.game}</span>}
                                        {aTotals.learning > 0 && <span className={`sc-real-badge learning learning-${s.learningStatus || 'yellow'}`}>{aStats.learning}</span>}
                                    </span>
                                </span>
                            </div>
                            <div className="plan-match-actions">
                                <button
                                    className={`btn-list-action btn-place ${isPlacementActive ? 'active' : ''}`}
                                    onClick={() => setPlacementStudent((prev) => String(prev?._id || '') === String(s._id || '') ? null : s)}
                                    title="Placer dans le plan"
                                >
                                    {isPlacementActive ? 'OK' : 'Placer'}
                                </button>
                                <button className="btn-list-action btn-x" {...scoreHoldProps(s, -0.5)}>-0.5</button>
                                <button className="btn-list-action btn-v" {...scoreHoldProps(s, 0.5)}>+0.5</button>
                                <button className="btn-list-action btn-c" onClick={() => handleOpenStudent(s)}>📝</button>
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="classroom-wrapper" style={{ '--grid-cols': gridSize.cols }}>
            <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*,.csv,.tsv,.txt,text/csv,text/tab-separated-values" onChange={handleFileSelect} />
            {iaLoading && <div className="ia-loader"><div className="spinner-ia"></div><span>IA ACTIVE...</span></div>}
            
            <div className="cm-header">
                <h2 className="cm-title md:block hidden">{viewMode === 'PLAN' ? 'MODE PLAN' : 'MODE LISTE'}</h2>
                <div className="cm-header-center">
                    <div className="view-switcher">
                        <button className={`view-btn ${viewMode === 'PLAN' ? 'active' : ''}`} onClick={() => setViewMode('PLAN')}>📍 PLAN</button>
                        <button className={`view-btn ${viewMode === 'LIST' ? 'active' : ''}`} onClick={() => setViewMode('LIST')}>A</button>
                    </div>
                    <button
                        className={`voice-finder-btn ${voiceListening ? 'active' : ''}`}
                        onClick={toggleVoiceFinder}
                        disabled={!voiceSupported}
                        title={voiceSupported ? (frenchMode ? 'Dicter un mot ou une expression' : 'Recherche vocale élève') : 'Reconnaissance vocale non disponible'}
                    >
                        {voiceListening ? '🎙️ ON' : '🎙️'}
                    </button>
                </div>
                
                <div className="class-points-controls" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#eff6ff', padding: '4px 10px', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <button className="pts-btn" onClick={() => updateClassPoints(-1)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>-</button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 900, color: '#1e3a8a', minWidth: '45px', textAlign: 'center' }}>🏆 {classPoints} pts</span>
                    <button className="pts-btn" onClick={() => updateClassPoints(1)} style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '50%', width: '24px', height: '24px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>+</button>
                    <button className="class-score-btn" onClick={addClassScorePoint}>+1 classe</button>
                </div>

                <button
                    className={`cm-swap-btn ${isSwapMode ? 'active' : ''}`}
                    onClick={() => {
                        setIsSwapMode(prev => {
                            const next = !prev;
                            if (!next) setSwapSource(null);
                            return next;
                        });
                        setSelectedStudent(null);
                    }}
                    title="Intervertir deux élèves"
                >
                    {isSwapMode ? (swapSource ? '🔁 CHOISIS 2E ÉLÈVE' : '🔁 CHOISIS 1ER ÉLÈVE') : '🔁 INTERVERTIR'}
                </button>
            </div>
            
            {viewMode === 'PLAN' ? (
                <>
                    <div className="plan-finder-row">
                        <input
                            className="plan-finder-input"
                            placeholder={frenchMode ? (frenchSelectedStudents.length ? `Mot ou expression pour ${frenchSelectedStudents.length} élève(s)…` : 'Mot ou expression pour toute la classe…') : '🔎 Trouver un élève de la classe...'}
                            value={frenchMode ? frenchExpression : planFinder}
                            onChange={(e) => frenchMode ? (setFrenchExpression(e.target.value), setFrenchKeywords([])) : setPlanFinder(e.target.value)}
                        />
                        <div className="plan-finder-count-wrap">
                            {!frenchMode && <span className="plan-finder-count" title={planFinder.trim() ? 'Élèves trouvés dans la classe' : 'Élèves de la classe'}>
                                {planFinder.trim() ? planFinderCount : students.length}
                            </span>}
                            <button
                                className={`french-mode-btn ${frenchMode ? 'active' : ''}`}
                                onClick={toggleFrenchMode}
                                title="Mode français : choisis un élève puis ajoute un mot ou une expression"
                            >FR</button>
                            {((frenchMode ? frenchExpression : planFinder).trim()) && (
                                <button
                                    className="finder-clear-btn"
                                    onClick={() => frenchMode ? (setFrenchExpression(''), setFrenchKeywords([])) : setPlanFinder('')}
                                    title={frenchMode ? 'Effacer le mot ou l’expression' : 'Effacer la recherche'}
                                >
                                ✕
                                </button>
                            )}
                            {frenchMode && <button className="french-validate-btn" onClick={saveFrenchExpression} disabled={frenchSaving || !frenchExpression.trim()}>{frenchSaving ? '…' : 'VALIDER'}</button>}
                        </div>
                    </div>
                    {frenchMode && <div className="french-mode-hint">🇫🇷 Clique un élève dans le plan, puis écris ou dicte le mot / l’expression à ajouter à sa liste personnelle.</div>}
                    {renderFrenchAssignmentPanel()}
                    {placementStudent && (
                        <div className="placement-hint">
                            Placement actif pour <strong>{placementStudent.lastName} {getDisplayName(placementStudent)}</strong>. Clique ensuite sur une case vide du plan.
                        </div>
                    )}
                    {renderPlanMatchesList()}
                    <div className="cm-toolbar hidden md:flex">
                        <button className="cm-btn purple" onClick={() => setImportPanelOpen((open) => !open)}>📥 IMPORTER UN PLAN</button>
                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                        <span className="text-[10px] font-bold text-slate-400">COLS:</span><button className="cm-btn slate" onClick={() => changeGrid(-1, 0)}>-</button><span className="font-bold">{gridSize.cols}</span><button className="cm-btn slate" onClick={() => changeGrid(1, 0)}>+</button>
                        <span className="text-[10px] font-bold text-slate-400 ml-2">ROWS:</span><button className="cm-btn slate" onClick={() => changeGrid(0, -1)}>-</button><span className="font-bold">{gridSize.rows}</span><button className="cm-btn slate" onClick={() => changeGrid(0, 1)}>+</button>
                    </div>
                    {importPanelOpen && (
                        <div className="plan-import-panel">
                            <div>
                                <strong>Image ou fichier</strong>
                                <span>Photo/capture analysée par l’IA, ou grille CSV/TSV exportée depuis Sheets.</span>
                                <button type="button" onClick={() => fileInputRef.current?.click()}>Choisir un fichier</button>
                            </div>
                            <div>
                                <strong>Google Sheets</strong>
                                <span>Le document doit être partagé en lecture avec le lien.</span>
                                <div className="plan-sheet-row">
                                    <input value={sheetUrl} onChange={(event) => setSheetUrl(event.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" />
                                    <button type="button" onClick={handleSheetImport} disabled={iaLoading || !sheetUrl.trim()}>Importer</button>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    <div className="grid-container custom-scrollbar">
                        <div className="grid-header-row" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))` }}>{renderHeaders()}</div>
                        <div className="interactive-grid" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))`, gridTemplateRows: `repeat(${effectivePlanRows}, var(--cell-size, 100px))` }}>{renderGrid()}</div>
                    </div>
                </>
            ) : renderList()}
            
            <div className={`action-drawer ${selectedStudent && !frenchMode ? 'open' : ''} ${actionFlash ? `flash-${actionFlash}` : ''}`}>
                {selectedStudent && !frenchMode && (
                    <>
                        <div className="drawer-header">
                            {isEditingNickname ? (
                                <input
                                    className="drawer-name-input"
                                    value={currentNickname}
                                    onChange={(e) => setCurrentNickname(e.target.value)}
                                    onBlur={saveNicknameInline}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            saveNicknameInline();
                                        }
                                        if (e.key === 'Escape') {
                                            setCurrentNickname(selectedStudent.nickname || "");
                                            setIsEditingNickname(false);
                                        }
                                    }}
                                    placeholder={selectedStudent.firstName || "Prénom"}
                                    autoFocus
                                />
                            ) : (
                                <span className={`drawer-name ${getMyStats(selectedStudent).workIncomplete ? 'work-incomplete' : ''}`}>{getDisplayName(selectedStudent)} {selectedStudent.lastName}</span>
                            )}
                            <div className="drawer-header-actions">
                                <button className="act-btn btn-pen" onClick={() => setIsEditingNickname(true)} title="Modifier surnom">✏️</button>
                                <button className="drawer-close" onClick={() => setSelectedStudent(null)}>✕</button>
                            </div>
                        </div>
                        <div className="drawer-grid-complex">
                            <div className="drawer-grade-list">
                                {getStudentGrades(selectedStudent).map(g => <button key={g.id} className={`drawer-grade-chip ${String(getSelectedGrade(selectedStudent)?.id) === String(g.id) ? 'selected' : ''} ${hasScoreDebt(selectedStudent) && String(g.id) === String(getMyStats(selectedStudent).forcedSixScoreId || getSelectedGrade(selectedStudent)?.id) ? 'debt' : ''}`} onClick={() => addBehavior(selectedStudent._id, 'SELECT_SCORE', {scoreId:g.id}, {keepDrawerOpen:true})}>{formatScore(g.value)}</button>)}
                            </div>
                            <button className="act-btn btn-note" onClick={() => addBehavior(selectedStudent._id, 'ADD_SCORE', null, {keepDrawerOpen:true})}>+ AJOUTER NOTE</button>
                            <button
                                className="act-btn btn-note"
                                disabled={getStudentGrades(selectedStudent).length <= 1}
                                onClick={() => addBehavior(selectedStudent._id, 'DELETE_SCORE', {scoreId:getSelectedGrade(selectedStudent)?.id}, {keepDrawerOpen:true})}
                            >SUPPRIMER NOTE</button>
                            {[-0.5,0.5].map(delta => <button key={delta} className={`act-btn ${delta < 0 ? 'btn-cross' : 'btn-bonus'}`} {...scoreHoldProps(selectedStudent, delta)}>{delta > 0 ? '+' : ''}{delta}</button>)}
                            <div className="forced-six-actions">
                                <button className="act-btn grade-toggle" disabled={hasScoreDebt(selectedStudent)} onClick={() => addBehavior(selectedStudent._id, 'ADD_FORCED_SIX', {scoreId:getSelectedGrade(selectedStudent)?.id}, {keepDrawerOpen:true})}>METTRE 6/20 · −9</button>
                                <button className="act-btn grade-toggle remove" disabled={!hasScoreDebt(selectedStudent)} onClick={() => addBehavior(selectedStudent._id, 'REMOVE_FORCED_SIX', null, {keepDrawerOpen:true})}>DETTE RÉGLÉE · +9</button>
                            </div>
                            <div className="student-alert-actions">
                                <button className={`act-btn ${getMyStats(selectedStudent).workIncomplete ? 'grade-toggle active' : 'grade-toggle'}`} onClick={() => addBehavior(selectedStudent._id, 'TOGGLE_INCOMPLETE', null, {keepDrawerOpen:true})}>{getMyStats(selectedStudent).workIncomplete ? 'TRAVAIL COMPLET' : 'TRAVAIL INCOMPLET'}</button>
                                <button className={`act-btn punishment-toggle ${selectedStudent.punishmentStatus !== 'NONE' ? 'active' : ''}`} onClick={() => addBehavior(selectedStudent._id, selectedStudent.punishmentStatus !== 'NONE' ? 'REMOVE_PUNISHMENT' : 'ADD_PUNISHMENT', null, {keepDrawerOpen:true})}>
                                    {selectedStudent.punishmentStatus !== 'NONE' ? '⚖️ LEVER PUNITION' : '⚖️ PUNITION'}
                                </button>
                            </div>
                            <button className="act-btn btn-note" onClick={() => setShowNoteInput(!showNoteInput)}>📝 NOTES PERSONNELLES {showNoteInput ? '▲' : '▼'}</button>
                        </div>
                        {showNoteInput && (
                            <div className="note-area-wrapper">
                                <textarea className="note-textarea" value={currentNote} onChange={e => setCurrentNote(e.target.value)} placeholder="Note invisible pour l'élève..." />
                                <button className="btn-save-note" onClick={() => addBehavior(selectedStudent._id, 'SAVE_NOTE', currentNote)}>ENREGISTRER LA NOTE</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
