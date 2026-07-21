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
    
    // UI STATES
    const [viewMode, setViewMode] = useState('PLAN');
    const [searchTerm, setSearchTerm] = useState("");
    const [planFinder, setPlanFinder] = useState("");
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
    const [hourWarnings, setHourWarnings] = useState([]);
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
    const behaviorRepeatIntervalRef = useRef(null);
    const behaviorRepeatStudentRef = useRef(null);
    
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
                setStudents(Array.isArray(data) ? data : []);
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
            if (currentViewModeRef.current === 'PLAN') {
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
    }, []);

    const toggleVoiceFinder = () => {
        if (!voiceSupported || !speechRecognitionRef.current) return;
        if (voiceListening) {
            keepListeningRef.current = false;
            try { speechRecognitionRef.current.stop(); } catch (_) {}
            if (currentViewModeRef.current === 'PLAN') {
                setPlanFinder('');
                lastVoiceValueRef.current.PLAN = '';
            } else {
                setSearchTerm('');
                lastVoiceValueRef.current.LIST = '';
            }
            setVoiceListening(false);
            return;
        }
        if (currentViewModeRef.current === 'PLAN') {
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
    const handleFileSelect = async (e) => { const file = e.target.files[0]; if (!file) return; if(!confirm(`📸 Analyser ${file.name} ?`)) return; setIaLoading(true); const formData = new FormData(); formData.append('file', file); formData.append('classId', globalClassId); try { await fetch('/api/classroom/import-plan', { method: 'POST', body: formData }); await loadData(); } catch(e) { alert("Erreur IA"); } setIaLoading(false); e.target.value = null; };
    const getMyStats = (stu) => { if (!stu.behaviorRecords) return { crosses: 0, bonuses: 0, weeksToRedemption: 3 }; return stu.behaviorRecords.find(r => r.teacherId === myId) || { crosses: 0, bonuses: 0, weeksToRedemption: 3 }; };
    const getStudentScore = (stu) => {
        const stats = getMyStats(stu);
        return (Number(stats.bonuses || 0) * 0.5) - Number(stats.crosses || 0);
    };
    const formatScore = (value) => {
        const n = Number(value || 0);
        if (n > 0) return `+${Number.isInteger(n) ? n : n.toFixed(1)}`;
        if (Number.isInteger(n)) return String(n);
        return n.toFixed(1);
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
    const trackPenaltyWarning = (studentId, student) => {
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;
        const rows = (penaltyLogRef.current[studentId] || []).filter((ts) => now - ts <= hourMs);
        rows.push(now);
        penaltyLogRef.current[studentId] = rows;
        if (rows.length < 2) return;
        setHourWarnings((current) => {
            const expiry = now + hourMs;
            const warning = {
                studentId,
                name: `${getDisplayName(student)} ${String(student?.lastName || '').slice(0, 1)}.`.trim(),
                expiresAt: expiry
            };
            return [warning, ...current.filter((row) => String(row.studentId) !== String(studentId) && Number(row.expiresAt || 0) > now)].slice(0, 6);
        });
    };
    const addClassScorePoint = async () => {
        const visibleStudents = students.filter((s) => s?._id);
        for (const student of visibleStudents) {
            await addBehavior(student._id, 'BONUS', { suppressLiveAlert: true }, { keepDrawerOpen: true, silentReload: true, skipFlash: true });
            await addBehavior(student._id, 'BONUS', { suppressLiveAlert: true }, { keepDrawerOpen: true, silentReload: true, skipFlash: true });
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
    const getStudentGptCode = (stu) => {
        const raw = String(stu?._id || stu?.id || '').replace(/[^a-f0-9]/gi, '').slice(-8);
        if (!raw) return '';
        return String((parseInt(raw, 16) % 900000) + 100000);
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

    const handleOpenStudent = (stu) => {
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
        setCurrentNote(stu.myNote || "");
        setCurrentNickname(stu.nickname || "");
        setShowNoteInput(false);
        setIsEditingNickname(false);
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

    const stopBehaviorRepeat = (closeDrawer = true) => {
        if (behaviorRepeatIntervalRef.current) {
            clearInterval(behaviorRepeatIntervalRef.current);
            behaviorRepeatIntervalRef.current = null;
        }
        behaviorRepeatStudentRef.current = null;
        if (closeDrawer) setSelectedStudent(null);
    };

    const startBehaviorRepeat = (studentId, type) => {
        if (!studentId) return;
        stopBehaviorRepeat(false);
        behaviorRepeatStudentRef.current = studentId;
        addBehavior(studentId, type, null, { keepDrawerOpen: true });
        behaviorRepeatIntervalRef.current = setInterval(() => {
            if (!behaviorRepeatStudentRef.current) return;
            addBehavior(studentId, type, null, { keepDrawerOpen: true });
        }, 1000);
    };

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

    useEffect(() => {
        const timer = setInterval(() => {
            const now = Date.now();
            setHourWarnings((current) => current.filter((row) => Number(row.expiresAt || 0) > now));
        }, 30000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => () => stopBehaviorRepeat(false), []);
    
    // --- GESTION DES ACTIONS ---
    const addBehavior = async (sid, type, extra = null, options = {}) => { 
        if (!myId) return alert("Erreur: ID Professeur introuvable.");
        const keepDrawerOpen = Boolean(options.keepDrawerOpen);
        const skipFlash = Boolean(options.skipFlash);
        const silentReload = Boolean(options.silentReload);
        const targetStudent = students.find((s) => String(s._id) === String(sid));
        if (!skipFlash && targetStudent && ['CROSS', 'BONUS', 'REMOVE_CROSS', 'REMOVE_BONUS'].includes(type)) {
            const deltaByType = { CROSS: -1, BONUS: 0.5, REMOVE_CROSS: 1, REMOVE_BONUS: -0.5 };
            showScoreEvolutionOnBoard(targetStudent, deltaByType[type] || 0);
            if (type === 'CROSS') trackPenaltyWarning(sid, targetStudent);
        }

        // Optimistic UI Update
        setStudents(prev => prev.map(s => {
            if (s._id !== sid) return s;
            const newS = { ...s, behaviorRecords: [...(s.behaviorRecords || [])] };
            let rIdx = newS.behaviorRecords.findIndex(r => r.teacherId === myId);
            if(rIdx === -1) { newS.behaviorRecords.push({ teacherId: myId, crosses: 0, bonuses: 0, weeksToRedemption: 3 }); rIdx = newS.behaviorRecords.length - 1; }
            
            const r = { ...newS.behaviorRecords[rIdx] };
            if (type === 'CROSS') r.crosses++;
            if (type === 'BONUS') r.bonuses++;
            if (type === 'REMOVE_CROSS') r.crosses = Math.max(0, r.crosses - 1);
            if (type === 'REMOVE_BONUS') r.bonuses = Math.max(0, r.bonuses - 1);
            if (type === 'SAVE_NICKNAME') newS.nickname = String(extra || '').trim();
            
            // Mise à jour visuelle immédiate pour la punition supprimée
            if (type === 'REMOVE_PUNISHMENT') {
                newS.punishmentStatus = 'NONE';
            }

            newS.behaviorRecords[rIdx] = r;
            return newS;
        }));
        if (type === 'SAVE_NICKNAME') {
            setSelectedStudent(prev => prev && String(prev._id) === String(sid)
                ? { ...prev, nickname: String(extra || '').trim() }
                : prev
            );
        }
        if (selectedStudent && String(selectedStudent._id) === String(sid)) {
            if (type === 'CROSS') setActionFlash('cross');
            if (type === 'BONUS') setActionFlash('bonus');
        }

        try {
            const res = await fetch('/api/classroom/behavior', { 
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify({ studentId: sid, type, teacherId: myId, extraData: extra }) 
            });

            if (res.ok) {
                if (!silentReload) await loadData();
                const shouldCloseDrawer = ['SAVE_NOTE', 'REMOVE_PUNISHMENT', 'CROSS', 'BONUS', 'REMOVE_CROSS', 'REMOVE_BONUS'].includes(type) && !keepDrawerOpen;
                if (shouldCloseDrawer) setSelectedStudent(null);
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
        const cells = [];
        for (let y = 0; y < gridSize.rows; y++) {
            for (let x = 0; x < gridSize.cols; x++) {
                const student = students.find(s => s.seatX === x && s.seatY === y);
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
                            <div className={`student-card-drag ${draggingId === student._id ? 'dragging' : ''} ${getMyStats(student).crosses >= 3 ? 'punished' : ''} ${student.myNote ? 'has-note' : ''} ${isSwapMode && String(swapSource?._id) === String(student._id) ? 'swap-source' : ''} ${isPlanFinderMatch(student) ? 'finder-hit' : ''}`} draggable="true" onDragStart={(e) => handleDragStart(e, student._id)} onClick={(e) => { e.stopPropagation(); handleOpenStudent(student); }}>
                                {student.myNote && <div className="sc-note-badge">N</div>}
                                {student.punishmentStatus && student.punishmentStatus !== 'NONE' && (<div className={`sc-punishment-badge ${isPunishmentLate(student) ? 'late' : 'pending'}`}>P</div>)}
                                <div className="sc-realizations sc-realizations-inline">
                                    {getActivityTotals(student).homework > 0 && <span className="alpha-mini-stat hw" title="Devoir">{getActivityStats(student).homework}</span>}
                                    {getActivityTotals(student).game > 0 && <span className="alpha-mini-stat game" title="Jeu">{getActivityStats(student).game}</span>}
                                    {getActivityTotals(student).learning > 0 && <span className="alpha-mini-stat learning" title="Apprentissage">{getActivityStats(student).learning}</span>}
                                </div>
                                <div className="sc-avatar-row">
                                    <div className="sc-avatar">{student.gender === 'F' ? '👧' : '👦'}</div>
                                    {getMyStats(student).crosses > 0 && <div className="sc-badge sc-badge-inline">⏳ {getCrossCountdownLabel(student)}</div>}
                                </div>
                                <div className="sc-name">{getDisplayName(student)}<br/>{student.lastName.slice(0,1)}.</div>
                                <div className={`sc-score ${getStudentScore(student) >= 0 ? 'positive' : 'negative'}`}>{formatScore(getStudentScore(student))}</div>
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
                    <input className="plan-finder-input" placeholder="🔎 Trouver un élève de la classe..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <div className="plan-finder-count-wrap">
                        <span className="plan-finder-count" title={searchTerm.trim() ? 'Élèves trouvés dans la classe' : 'Élèves de la classe'}>
                            {searchTerm.trim() ? listFinderCount : students.length}
                        </span>
                        {searchTerm.trim() && (
                            <button
                                className="finder-clear-btn"
                                onClick={() => setSearchTerm('')}
                                title="Effacer la recherche"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                </div>
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
                                        className={`student-card-drag alpha-grid-card ${student.myNote ? 'has-note' : ''} ${stats.crosses >= 3 ? 'punished' : ''} ${isSwapMode && String(swapSource?._id) === String(student._id) ? 'swap-source' : ''} ${isListFinderMatch(student) && searchTerm.trim() ? 'finder-hit' : ''}`}
                                        onClick={() => handleOpenStudent(student)}
                                    >
                                        <div className="alpha-grid-topline">
                                            {aTotals.homework > 0 && <span className="alpha-mini-stat hw">{aStats.homework}</span>}
                                            {aTotals.game > 0 && <span className="alpha-mini-stat game">{aStats.game}</span>}
                                            {aTotals.learning > 0 && <span className="alpha-mini-stat learning">{aStats.learning}</span>}
                                        </div>
                                        <div className="sc-avatar">{student.gender === 'F' ? '👧' : '👦'}</div>
                                        <div className="sc-name">{getDisplayName(student)}<br />{String(student.lastName || '').slice(0, 1)}.</div>
                                        <div className={`sc-score ${getStudentScore(student) >= 0 ? 'positive' : 'negative'}`}>{formatScore(getStudentScore(student))}</div>
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
                                        {aTotals.learning > 0 && <span className="sc-real-badge learning">{aStats.learning}</span>}
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
                                <button className="btn-list-action btn-x" onClick={() => addBehavior(s._id, 'CROSS')}>-1</button>
                                <button className="btn-list-action btn-v" onClick={() => addBehavior(s._id, 'BONUS')}>+0.5</button>
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
            <input type="file" ref={fileInputRef} style={{display:'none'}} accept="image/*" onChange={handleFileSelect} />
            {iaLoading && <div className="ia-loader"><div className="spinner-ia"></div><span>IA ACTIVE...</span></div>}
            {hourWarnings.length > 0 && (
                <div className="hour-warning-panel">
                    <div className="hour-warning-title">Avertis cette heure</div>
                    {hourWarnings.map((row) => (
                        <div key={row.studentId} className="hour-warning-name">{row.name}</div>
                    ))}
                </div>
            )}
            
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
                        title={voiceSupported ? 'Recherche vocale élève' : 'Reconnaissance vocale non disponible'}
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
                            placeholder="🔎 Trouver un élève de la classe..."
                            value={planFinder}
                            onChange={(e) => setPlanFinder(e.target.value)}
                        />
                        <div className="plan-finder-count-wrap">
                            <span className="plan-finder-count" title={planFinder.trim() ? 'Élèves trouvés dans la classe' : 'Élèves de la classe'}>
                                {planFinder.trim() ? planFinderCount : students.length}
                            </span>
                            {planFinder.trim() && (
                                <button
                                    className="finder-clear-btn"
                                    onClick={() => setPlanFinder('')}
                                    title="Effacer la recherche"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    {placementStudent && (
                        <div className="placement-hint">
                            Placement actif pour <strong>{placementStudent.lastName} {getDisplayName(placementStudent)}</strong>. Clique ensuite sur une case vide du plan.
                        </div>
                    )}
                    {renderPlanMatchesList()}
                    <div className="cm-toolbar hidden md:flex">
                        <button className="cm-btn purple" onClick={() => fileInputRef.current.click()}>🔮 IMPORT IA</button>
                        <div className="w-px h-6 bg-slate-200 mx-2"></div>
                        <span className="text-[10px] font-bold text-slate-400">COLS:</span><button className="cm-btn slate" onClick={() => changeGrid(-1, 0)}>-</button><span className="font-bold">{gridSize.cols}</span><button className="cm-btn slate" onClick={() => changeGrid(1, 0)}>+</button>
                        <span className="text-[10px] font-bold text-slate-400 ml-2">ROWS:</span><button className="cm-btn slate" onClick={() => changeGrid(0, -1)}>-</button><span className="font-bold">{gridSize.rows}</span><button className="cm-btn slate" onClick={() => changeGrid(0, 1)}>+</button>
                    </div>
                    
                    <div className="grid-container custom-scrollbar">
                        <div className="grid-header-row" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))` }}>{renderHeaders()}</div>
                        <div className="interactive-grid" style={{ gridTemplateColumns: `repeat(${gridSize.cols}, var(--cell-size, 100px))`, gridTemplateRows: `repeat(${gridSize.rows}, var(--cell-size, 100px))` }}>{renderGrid()}</div>
                    </div>
                </>
            ) : renderList()}
            
            <div className={`action-drawer ${selectedStudent ? 'open' : ''} ${actionFlash ? `flash-${actionFlash}` : ''}`}>
                {selectedStudent && (
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
                                <span className="drawer-name">{getDisplayName(selectedStudent)} {selectedStudent.lastName}</span>
                            )}
                            <div className="drawer-header-actions">
                                <button className="act-btn btn-pen" onClick={() => setIsEditingNickname(true)} title="Modifier surnom">✏️</button>
                                <button className="drawer-close" onClick={() => setSelectedStudent(null)}>✕</button>
                            </div>
                        </div>
                        <div className="gpt-code-banner">
                            <span>Code CondaTuteur</span>
                            <strong>{getStudentGptCode(selectedStudent)}</strong>
                        </div>
                        <div className="drawer-grid-complex">
                            <button
                                className="act-btn btn-cross"
                                onPointerDown={() => startBehaviorRepeat(selectedStudent._id, 'CROSS')}
                                onPointerUp={() => stopBehaviorRepeat(true)}
                                onPointerLeave={() => stopBehaviorRepeat(true)}
                                onPointerCancel={() => stopBehaviorRepeat(true)}
                                onClick={(e) => e.preventDefault()}
                            >
                                -1
                            </button>
                            <button
                                className="act-btn btn-bonus"
                                onPointerDown={() => startBehaviorRepeat(selectedStudent._id, 'BONUS')}
                                onPointerUp={() => stopBehaviorRepeat(true)}
                                onPointerLeave={() => stopBehaviorRepeat(true)}
                                onPointerCancel={() => stopBehaviorRepeat(true)}
                                onClick={(e) => e.preventDefault()}
                            >
                                +0.5
                            </button>
                            <button
                                className="act-btn btn-rem-cross"
                                onPointerDown={() => startBehaviorRepeat(selectedStudent._id, 'REMOVE_CROSS')}
                                onPointerUp={() => stopBehaviorRepeat(true)}
                                onPointerLeave={() => stopBehaviorRepeat(true)}
                                onPointerCancel={() => stopBehaviorRepeat(true)}
                                onClick={(e) => e.preventDefault()}
                            >
                                ANNULER -1
                            </button>
                            <button
                                className="act-btn btn-rem-bonus"
                                onPointerDown={() => startBehaviorRepeat(selectedStudent._id, 'REMOVE_BONUS')}
                                onPointerUp={() => stopBehaviorRepeat(true)}
                                onPointerLeave={() => stopBehaviorRepeat(true)}
                                onPointerCancel={() => stopBehaviorRepeat(true)}
                                onClick={(e) => e.preventDefault()}
                            >
                                ANNULER +0.5
                            </button>
                            <button className="act-btn btn-note" onClick={() => setShowNoteInput(!showNoteInput)}>📝 NOTES PERSONNELLES {showNoteInput ? '▲' : '▼'}</button>
                            
                            {/* BOUTON REMPLACÉ : SUPPRIMER PUNITION */}
                            <button className="act-btn btn-cancel-punish" onClick={() => addBehavior(selectedStudent._id, 'REMOVE_PUNISHMENT')}>
                                ⚖️ LEVER PUNITION
                            </button>

                            {/* NOUVELLE SECTION INTERACTION TABLEAU */}
                            <div className="drawer-section-title" style={{ gridColumn: 'span 2', fontSize: '0.8rem', fontWeight: 900, color: '#64748b', marginTop: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>
                                🖥️ ÉCRAN DE LA CLASSE (TABLEAU)
                            </div>
                            <button
                                className="act-btn btn-highlight"
                                onClick={() => highlightStudentOnBoard(selectedStudent)}
                                style={{ gridColumn: 'span 2', background: '#ffe4e6', color: '#be123c', border: '2px solid #fecdd3', flexDirection: 'row', justifyContent: 'center', gap: '8px' }}
                            >
                                🔴 SIGNALER AU TABLEAU
                            </button>
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
