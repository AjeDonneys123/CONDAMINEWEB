import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import { resolveDriveAssetUrl } from '../../../utils/driveUrl';

const uid = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const isProbablyDirectVideo = (url = '') => {
    const u = String(url || '').toLowerCase();
    if (!u) return false;
    if (u.startsWith('blob:') || u.startsWith('data:')) return true;
    if (u.includes('/api/proxy/')) return true;
    if (/(\.mp4|\.webm|\.ogg|\.m3u8)(\?|#|$)/i.test(u)) return true;
    return false;
};
const toEmbedUrl = (rawUrl = '') => {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#?/]+)/i);
    if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/i);
    if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
};

const emptyStep = (type = 'sheet') => {
    if (type === 'video') return { id: uid(), type: 'video', title: 'Vidéo', videoUrl: '', thumbnailUrl: '', videoTranscript: '', startSec: 0, endSec: 0, mustWatchToEnd: true };
    if (type === 'question') return {
        id: uid(),
        type: 'question',
        title: 'Question IA',
        difficulty: 'easy',
        customQuestion: '',
        sourceSheetUrl: '',
        orangeHighlights: [],
        redHighlights: [],
        sheetAnnotations: [],
        keywords: [],
        minKeywordMatches: 1,
        aiPreviewQuestions: []
    };
    return { id: uid(), type: 'sheet', title: 'Fiche', sheetUrl: '', sheetText: '', minReadSeconds: 20 };
};

export default function LearningStudio({ initialData, chapters, user, targetSection, targetLevel, onClose, allStudents: propStudents, allClasses: propClasses }) {
    const [formData, setFormData] = useState(() => ({
        _id: initialData?._id,
        title: initialData?.title || 'APPRENTISSAGE',
        chapterId: initialData?.chapterId ? String(initialData.chapterId) : '',
        subject: initialData?.subject || targetSection || 'GÉNÉRAL',
        steps: Array.isArray(initialData?.steps) && initialData.steps.length > 0
            ? initialData.steps.map((s, i) => ({ id: s.id || `step_${i + 1}`, ...s }))
            : []
    }));
    const [activeStep, setActiveStep] = useState(0);
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [allGames, setAllGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAnnotModal, setShowAnnotModal] = useState(false);
    const [showKeywordModal, setShowKeywordModal] = useState(false);
    const [extractingSheetText, setExtractingSheetText] = useState(false);
    const [savingSheetText, setSavingSheetText] = useState(false);
    const [annotColor, setAnnotColor] = useState('orange');
    const [annotLabel, setAnnotLabel] = useState('');
    const [annotDraft, setAnnotDraft] = useState(null);
    const [aiTesting, setAiTesting] = useState(false);
    const [showVideoEditor, setShowVideoEditor] = useState(false);
    const [segmentStart, setSegmentStart] = useState(0);
    const [segmentEnd, setSegmentEnd] = useState(0);
    const [segmentLabel, setSegmentLabel] = useState('');
    const [segmentRate, setSegmentRate] = useState(1);
    const [knownSegments, setKnownSegments] = useState([]);
    const [selectedSegmentId, setSelectedSegmentId] = useState('');
    const [selectedSegmentLabel, setSelectedSegmentLabel] = useState('');
    const [selectedSegmentTranscript, setSelectedSegmentTranscript] = useState('');
    const [lastSavedSegmentLabel, setLastSavedSegmentLabel] = useState('');
    const [lastSavedSegmentTranscript, setLastSavedSegmentTranscript] = useState('');
    const [previewSegmentMode, setPreviewSegmentMode] = useState(false);
    const [keywordMaterialSource, setKeywordMaterialSource] = useState('manual');
    const [keywordMaterialText, setKeywordMaterialText] = useState('');
    const [keywordSelectedText, setKeywordSelectedText] = useState('');
    const [activeTarget, setActiveTarget] = useState('response'); // response | zone
    const [eraseMode, setEraseMode] = useState(false);
    const [autoHighlighting, setAutoHighlighting] = useState(false);
    const [keywordSelectionSpan, setKeywordSelectionSpan] = useState(null);
    const [keywordActiveZoneIdx, setKeywordActiveZoneIdx] = useState(null);
    const videoEditorRef = useRef(null);
    const keywordSelectionRef = useRef(null);
    const teacherId = String(user?._id || user?.id || '').trim();
    const step = formData.steps[activeStep] || null;

    useEffect(() => {
        const init = async () => {
            if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
                const [sts, cls] = await Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')]);
                setAllStudents(sts || []);
                setAllClasses(cls || []);
            }
            const games = await fetch('/api/games/all').then(r => r.ok ? r.json() : []);
            setAllGames(games || []);
        };
        init();
    }, [propStudents, propClasses]);

    useEffect(() => {
        if (!initialData?.targetClassrooms) return;
        const dist = {};
        initialData.targetClassrooms.forEach(clsName => {
            dist[clsName] = {
                chapterId: initialData.chapterId ? String(initialData.chapterId) : '',
                studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
            };
        });
        setDistribution(dist);
        if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
    }, [initialData]);

    const availableChapters = useMemo(() => {
        const section = String(targetSection || 'GÉNÉRAL').toUpperCase();
        const filtered = (chapters || []).filter(ch => !ch.isArchived && String(ch.section || 'GÉNÉRAL').toUpperCase() === section);
        return filtered.length > 0 ? filtered : (chapters || []).filter(ch => !ch.isArchived);
    }, [chapters, targetSection]);

    useEffect(() => {
        if (formData.chapterId || availableChapters.length === 0) return;
        const first = availableChapters[0];
        setFormData(prev => ({ ...prev, chapterId: String(first._id), subject: first.section || prev.subject }));
    }, [availableChapters, formData.chapterId]);

    const updateStep = (idx, patch) => {
        setFormData(prev => {
            const steps = [...(prev.steps || [])];
            if (!steps[idx]) return prev;
            steps[idx] = { ...steps[idx], ...patch };
            return { ...prev, steps };
        });
    };

    const getCandidateSheets = () => {
        const chapterId = String(formData.chapterId || '');
        const all = [];
        (formData.steps || []).forEach((s) => {
            if (s.type === 'sheet' && s.sheetUrl) all.push({ url: s.sheetUrl, source: 'Fiche module' });
        });
        (allGames || [])
            .filter(g => String(g.chapterId || '') === chapterId)
            .forEach((g) => {
                if (g?.globalIntro?.sheetUrl) all.push({ url: g.globalIntro.sheetUrl, source: `Jeu: ${g.title || 'Sans titre'} (intro)` });
                (g?.levels || []).forEach((lvl, idx) => {
                    if (lvl?.intro?.sheetUrl) all.push({ url: lvl.intro.sheetUrl, source: `Jeu: ${g.title || 'Sans titre'} (${lvl.name || `Niveau ${idx + 1}`})` });
                });
            });
        const unique = [];
        const seen = new Set();
        all.forEach((x) => {
            const key = String(x.url || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(x);
        });
        return unique;
    };

    const getQuestionTextSources = () => {
        const rows = [{ id: 'manual', label: 'Texte manuel', text: '' }];
        (formData.steps || []).forEach((s) => {
            if (!s || s.id === step?.id) return;
            if (s.type === 'video' && String(s.videoTranscript || '').trim()) {
                rows.push({
                    id: `video:${s.id}`,
                    label: `Vidéo: ${s.title || 'Sans titre'}`,
                    text: String(s.videoTranscript || '')
                });
            }
            if (s.type === 'sheet' && String(s.sheetText || '').trim()) {
                rows.push({
                    id: `sheet:${s.id}`,
                    label: `Fiche: ${s.title || 'Sans titre'}`,
                    text: String(s.sheetText || '')
                });
            }
        });
        return rows;
    };

    const rebuildHighlightsFromAnnotations = (annotations = []) => {
        const orange = [...new Set((annotations || []).filter(a => a.color === 'orange').map(a => String(a.label || '').trim()).filter(Boolean))];
        const red = [...new Set((annotations || []).filter(a => a.color === 'red').map(a => String(a.label || '').trim().toLowerCase()).filter(Boolean))];
        return { orangeHighlights: orange, redHighlights: red, keywords: red };
    };

    const pushAnnotation = () => {
        if (!step || step.type !== 'question' || !annotDraft) return;
        const label = String(annotLabel || '').trim();
        if (!label) return;
        const current = Array.isArray(step.sheetAnnotations) ? step.sheetAnnotations : [];
        const next = [...current, { ...annotDraft, color: annotColor, label }];
        updateStep(activeStep, { sheetAnnotations: next, ...rebuildHighlightsFromAnnotations(next) });
        setAnnotDraft(null);
        setAnnotLabel('');
    };

    const removeAnnotation = (idx) => {
        if (!step || step.type !== 'question') return;
        const current = Array.isArray(step.sheetAnnotations) ? step.sheetAnnotations : [];
        const next = current.filter((_, i) => i !== idx);
        updateStep(activeStep, { sheetAnnotations: next, ...rebuildHighlightsFromAnnotations(next) });
    };

    const handleAnnotMouseDown = (e) => {
        if (!showAnnotModal) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setAnnotDraft({ x, y, w: 0, h: 0 });
    };

    const handleAnnotMouseMove = (e) => {
        if (!annotDraft) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / rect.width) * 100;
        const cy = ((e.clientY - rect.top) / rect.height) * 100;
        const x = Math.min(annotDraft.x, cx);
        const y = Math.min(annotDraft.y, cy);
        const w = Math.abs(cx - annotDraft.x);
        const h = Math.abs(cy - annotDraft.y);
        setAnnotDraft({ x, y, w, h });
    };

    const handleAnnotMouseUp = () => {
        if (!annotDraft) return;
        if (annotDraft.w < 1 || annotDraft.h < 1) {
            setAnnotDraft(null);
            return;
        }
        if (!String(annotLabel || '').trim()) return;
        pushAnnotation();
    };

    const generateTestQuestions = async () => {
        if (!step || step.type !== 'question') return;
        const orange = Array.isArray(step.orangeHighlights) ? step.orangeHighlights : [];
        const red = Array.isArray(step.redHighlights) ? step.redHighlights : [];
        const topic = `Génère des questions sur: ${orange.join(', ')}. Réponses attendues: ${red.join(', ')}.`;
        setAiTesting(true);
        try {
            const fd = new FormData();
            fd.append('topic', topic || 'Question de compréhension');
            fd.append('count', '4');
            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const rows = await res.json();
            const clean = Array.isArray(rows) ? rows.slice(0, 6) : [];
            updateStep(activeStep, { aiPreviewQuestions: clean });
        } catch (e) {
            alert("Erreur génération questions test.");
        }
        setAiTesting(false);
    };

    const refreshKnownSegments = async (url) => {
        const safeUrl = String(url || '').trim();
        if (!teacherId || !safeUrl) {
            setKnownSegments([]);
            return [];
        }
        try {
            const res = await fetch(`/api/learning/video-segments?teacherId=${encodeURIComponent(teacherId)}&url=${encodeURIComponent(safeUrl)}`);
            const list = res.ok ? await res.json() : [];
            setKnownSegments(Array.isArray(list) ? list : []);
            return Array.isArray(list) ? list : [];
        } catch (_) {
            setKnownSegments([]);
            return [];
        }
    };

    const openVideoEditor = () => {
        if (!step || step.type !== 'video' || !step.videoUrl) return;
        setSegmentStart(Math.max(0, Number(step.startSec || 0)));
        setSegmentEnd(Math.max(0, Number(step.endSec || 0)));
        setSegmentLabel('');
        setSelectedSegmentTranscript('');
        setSegmentRate(1);
        setPreviewSegmentMode(false);
        refreshKnownSegments(step.videoUrl);
        setShowVideoEditor(true);
    };

    const markVideoTime = (kind) => {
        const t = Math.max(0, Math.floor(Number(videoEditorRef.current?.currentTime || 0)));
        if (kind === 'start') setSegmentStart(t);
        else setSegmentEnd(t);
    };

    const saveCurrentSegment = async () => {
        if (!step || step.type !== 'video' || !step.videoUrl) return;
        if (segmentEnd > 0 && segmentEnd <= segmentStart) {
            return alert("La fin doit être > début.");
        }
        const res = await fetch('/api/learning/video-segments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacherId,
                url: step.videoUrl,
                label: segmentLabel || `Segment ${segmentStart}-${segmentEnd || 'fin'}`,
                transcript: selectedSegmentTranscript || '',
                startSec: segmentStart,
                endSec: segmentEnd
            })
        });
        const saved = res.ok ? await res.json() : null;
        if (!saved) return;
        updateStep(activeStep, { startSec: saved.startSec, endSec: saved.endSec });
        const sid = String(saved._id || saved.id || '');
        const label = String(saved.label || '');
        const transcript = String(saved.transcript || '');
        setSelectedSegmentId(sid);
        setSelectedSegmentLabel(label);
        setSelectedSegmentTranscript(transcript);
        setLastSavedSegmentLabel(label);
        setLastSavedSegmentTranscript(transcript);
        await refreshKnownSegments(step.videoUrl);
    };

    const previewSegment = () => {
        if (!editorIsDirect || !videoEditorRef.current) return;
        const el = videoEditorRef.current;
        const start = Math.max(0, Number(segmentStart || 0));
        try { el.currentTime = start; } catch (_) {}
        setPreviewSegmentMode(true);
        el.play().catch(() => {});
    };

    const applyKnownSegment = (seg) => {
        if (!seg) return;
        updateStep(activeStep, { startSec: Number(seg.startSec || 0), endSec: Number(seg.endSec || 0) });
        setSegmentStart(Number(seg.startSec || 0));
        setSegmentEnd(Number(seg.endSec || 0));
        const sid = String(seg._id || seg.id || '');
        const label = String(seg.label || '');
        const transcript = String(seg.transcript || '');
        setSelectedSegmentId(sid);
        setSelectedSegmentLabel(label);
        setSelectedSegmentTranscript(transcript);
        setLastSavedSegmentLabel(label);
        setLastSavedSegmentTranscript(transcript);
    };
    const removeKnownSegment = async (seg) => {
        if (!seg || !step?.videoUrl) return;
        const sid = String(seg._id || seg.id || '').trim();
        if (!sid) return;
        const res = await fetch(`/api/learning/video-segments/${encodeURIComponent(sid)}?teacherId=${encodeURIComponent(teacherId)}`, { method: 'DELETE' });
        if (!res.ok) return;
        if (selectedSegmentId === sid) {
            setSelectedSegmentId('');
            setSelectedSegmentLabel('');
            setSelectedSegmentTranscript('');
            setLastSavedSegmentLabel('');
            setLastSavedSegmentTranscript('');
        }
        await refreshKnownSegments(step.videoUrl);
    };

    const saveSelectedSegmentLabel = async () => {
        if (!selectedSegmentId || !step?.videoUrl) return;
        const label = String(selectedSegmentLabel || '').trim();
        const res = await fetch(`/api/learning/video-segments/${encodeURIComponent(selectedSegmentId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId, label, transcript: selectedSegmentTranscript || '' })
        });
        if (!res.ok) return;
        const transcript = String(selectedSegmentTranscript || '');
        setLastSavedSegmentLabel(label);
        setLastSavedSegmentTranscript(transcript);
        setKnownSegments(prev => prev.map((seg) => {
            const sid = String(seg._id || seg.id || '');
            if (sid !== selectedSegmentId) return seg;
            return { ...seg, label, transcript };
        }));
        await refreshKnownSegments(step.videoUrl);
    };
    const selectedSegment = knownSegments.find((s) => String(s._id || s.id || '') === selectedSegmentId) || null;
    const questionTextSources = useMemo(() => getQuestionTextSources(), [formData.steps, step?.id]);

    const openKeywordModal = () => {
        if (!step) return;
        if (step.type === 'question') {
            const existingSource = String(step.materialSource || 'manual');
            const source = questionTextSources.find((s) => s.id === existingSource) || questionTextSources[0] || { id: 'manual', text: '' };
            setKeywordMaterialSource(source.id);
            setKeywordMaterialText(String(step.materialText || source.text || ''));
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
            return;
        }
        if (step.type === 'video') {
            const stepTranscript = String(step.videoTranscript || '').trim();
            let transcript = stepTranscript;
            if (!transcript) {
                const match = (knownSegments || []).find((seg) =>
                    Number(seg?.startSec || 0) === Number(step.startSec || 0)
                    && Number(seg?.endSec || 0) === Number(step.endSec || 0)
                );
                transcript = String(match?.transcript || '').trim();
            }
            setKeywordMaterialSource(`video:${step.id}`);
            setKeywordMaterialText(transcript);
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
            return;
        }
        if (step.type === 'sheet') {
            setKeywordMaterialSource(`sheet:${step.id}`);
            setKeywordMaterialText(String(step.sheetText || ''));
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
        }
    };

    const extractTextFromSheetForQuestion = async () => {
        if (!step || step.type !== 'question') return;
        const sheetUrl = String(step.sourceSheetUrl || '').trim();
        if (!sheetUrl) return alert("Choisis d'abord une fiche source.");
        setExtractingSheetText(true);
        try {
            const res = await fetch('/api/learning/extract-sheet-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetUrl })
            });
            const data = await res.json();
            if (!res.ok || !data?.text) throw new Error(data?.error || 'Extraction impossible');
            updateStep(activeStep, { materialSource: `sheet:${step.id}`, materialText: data.text });
            setKeywordMaterialSource(`sheet:${step.id}`);
            setKeywordMaterialText(data.text);
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
        } catch (e) {
            alert(`Extraction fiche impossible: ${e.message}`);
        }
        setExtractingSheetText(false);
    };

    const extractTextForSheetStep = async () => {
        if (!step || step.type !== 'sheet') return;
        const sheetUrl = String(step.sheetUrl || '').trim();
        if (!sheetUrl) return alert("Ajoute d'abord l'URL de la fiche.");
        setExtractingSheetText(true);
        try {
            const res = await fetch('/api/learning/extract-sheet-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetUrl })
            });
            const data = await res.json();
            if (!res.ok || !data?.text) throw new Error(data?.error || 'Extraction impossible');
            updateStep(activeStep, { sheetText: data.text });
        } catch (e) {
            alert(`Extraction fiche impossible: ${e.message}`);
        }
        setExtractingSheetText(false);
    };

    const saveExtractedSheetText = async () => {
        if (!step || step.type !== 'sheet') return;
        const text = String(step.sheetText || '').trim();
        if (!text) return alert("Aucun texte de fiche à sauvegarder.");
        if (!formData?._id) {
            return alert("Texte prêt: il sera sauvegardé lors de la publication de l'apprentissage.");
        }
        setSavingSheetText(true);
        try {
            const res = await fetch(`/api/learning/${encodeURIComponent(String(formData._id))}/step-text`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stepId: String(step.id || ''), kind: 'sheet', text })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur sauvegarde');
            alert("Texte extrait sauvegardé.");
        } catch (e) {
            alert(`Sauvegarde impossible: ${e.message}`);
        }
        setSavingSheetText(false);
    };

    const onKeywordSourceChange = (sourceId) => {
        const source = questionTextSources.find((s) => s.id === sourceId) || { id: 'manual', text: '' };
        setKeywordMaterialSource(source.id);
        setKeywordMaterialText(source.text || '');
        setKeywordSelectedText('');
        setKeywordSelectionSpan(null);
        setActiveTarget('response');
        setEraseMode(false);
    };

    const normalizeRanges = (ranges = [], textLen = 0) => {
        const clean = (ranges || [])
            .map((r) => ({
                start: Math.max(0, Math.min(textLen, Number(r?.start || 0))),
                end: Math.max(0, Math.min(textLen, Number(r?.end || 0)))
            }))
            .filter((r) => r.end > r.start)
            .sort((a, b) => a.start - b.start);
        const merged = [];
        clean.forEach((r) => {
            const last = merged[merged.length - 1];
            if (!last || r.start > last.end) merged.push({ ...r });
            else last.end = Math.max(last.end, r.end);
        });
        return merged;
    };
    const rangesToSnippets = (text = '', ranges = []) => {
        const source = String(text || '');
        return [...new Set(normalizeRanges(ranges, source.length)
            .map((r) => source.slice(r.start, r.end).replace(/\s+/g, ' ').trim())
            .filter(Boolean))];
    };
    const getCurrentResponseRanges = () => {
        if (!step) return [];
        if (step.type === 'question') return Array.isArray(step.questionPinkRanges) ? step.questionPinkRanges : [];
        if (step.type === 'video') return Array.isArray(step.videoPinkRanges) ? step.videoPinkRanges : [];
        if (step.type === 'sheet') return Array.isArray(step.sheetPinkRanges) ? step.sheetPinkRanges : [];
        return [];
    };
    const getCurrentZoneRanges = () => {
        if (!step) return [];
        if (step.type === 'question') return Array.isArray(step.questionZoneRanges) ? step.questionZoneRanges : [];
        if (step.type === 'video') return Array.isArray(step.videoZoneRanges) ? step.videoZoneRanges : [];
        if (step.type === 'sheet') return Array.isArray(step.sheetZoneRanges) ? step.sheetZoneRanges : [];
        return [];
    };
    const normalizeMarkers = (markers = [], textLen = 0) =>
        [...new Set((markers || [])
            .map((n) => Math.max(0, Math.min(textLen, Number(n))))
            .filter((n) => Number.isFinite(n) && n > 0 && n < textLen))]
            .sort((a, b) => a - b);
    const markersToRanges = (markers = [], textLen = 0) => {
        const cuts = [0, ...normalizeMarkers(markers, textLen), textLen];
        const ranges = [];
        for (let i = 0; i < cuts.length - 1; i += 1) {
            ranges.push({ start: cuts[i], end: cuts[i + 1] });
        }
        return normalizeRanges(ranges, textLen);
    };
    const getCurrentZoneMarkers = () => {
        if (!step) return [];
        const textLen = String(keywordMaterialText || '').length;
        if (step.type === 'question') {
            if (Array.isArray(step.questionZoneMarkers)) return normalizeMarkers(step.questionZoneMarkers, textLen);
            return normalizeMarkers((step.questionZoneRanges || []).map((r) => r?.end), textLen);
        }
        if (step.type === 'video') {
            if (Array.isArray(step.videoZoneMarkers)) return normalizeMarkers(step.videoZoneMarkers, textLen);
            return normalizeMarkers((step.videoZoneRanges || []).map((r) => r?.end), textLen);
        }
        if (step.type === 'sheet') {
            if (Array.isArray(step.sheetZoneMarkers)) return normalizeMarkers(step.sheetZoneMarkers, textLen);
            return normalizeMarkers((step.sheetZoneRanges || []).map((r) => r?.end), textLen);
        }
        return [];
    };
    const applyRangesToStep = ({ responseRanges = null, zoneRanges = null, zoneMarkers = null } = {}) => {
        if (!step) return;
        const source = String(keywordMaterialText || '');
        const finalResponseRanges = normalizeRanges(responseRanges ?? getCurrentResponseRanges(), source.length);
        const finalZoneMarkers = normalizeMarkers(zoneMarkers ?? getCurrentZoneMarkers(), source.length);
        const finalZoneRanges = normalizeRanges(zoneRanges ?? markersToRanges(finalZoneMarkers, source.length), source.length);
        const snippets = rangesToSnippets(source, finalResponseRanges);
        const zoneSnippets = rangesToSnippets(source, finalZoneRanges);
        const words = snippets
            .flatMap((snippet) => snippet.toLowerCase().split(/[^a-z0-9àâäéèêëîïôöùûüÿçœæ'-]+/i))
            .map((w) => w.trim())
            .filter((w) => w.length >= 3);
        if (step.type === 'question') {
            const keywordSet = new Set((Array.isArray(step.keywords) ? step.keywords : []).map((w) => String(w || '').toLowerCase()).filter(Boolean));
            words.forEach((w) => keywordSet.add(w));
            updateStep(activeStep, {
                questionPinkRanges: finalResponseRanges,
                questionZoneMarkers: finalZoneMarkers,
                questionZoneRanges: finalZoneRanges,
                redHighlights: snippets,
                zoneHighlights: zoneSnippets,
                keywords: [...keywordSet],
                materialSource: keywordMaterialSource,
                materialText: keywordMaterialText
            });
            return;
        }
        if (step.type === 'video') {
            const keywordSet = new Set((Array.isArray(step.videoKeywords) ? step.videoKeywords : []).map((w) => String(w || '').toLowerCase()).filter(Boolean));
            words.forEach((w) => keywordSet.add(w));
            updateStep(activeStep, {
                videoPinkRanges: finalResponseRanges,
                videoZoneMarkers: finalZoneMarkers,
                videoZoneRanges: finalZoneRanges,
                videoPinkHighlights: snippets,
                videoZoneHighlights: zoneSnippets,
                videoKeywords: [...keywordSet],
                videoTranscript: keywordMaterialText
            });
            return;
        }
        if (step.type === 'sheet') {
            const keywordSet = new Set((Array.isArray(step.sheetKeywords) ? step.sheetKeywords : []).map((w) => String(w || '').toLowerCase()).filter(Boolean));
            words.forEach((w) => keywordSet.add(w));
            updateStep(activeStep, {
                sheetPinkRanges: finalResponseRanges,
                sheetZoneMarkers: finalZoneMarkers,
                sheetZoneRanges: finalZoneRanges,
                sheetPinkHighlights: snippets,
                sheetZoneHighlights: zoneSnippets,
                sheetKeywords: [...keywordSet],
                sheetText: keywordMaterialText
            });
        }
    };
    const subtractRange = (ranges = [], cut = null, textLen = 0) => {
        const normalized = normalizeRanges(ranges, textLen);
        if (!cut) return normalized;
        const span = { start: Math.max(0, cut.start || 0), end: Math.max(0, cut.end || 0) };
        if (span.end <= span.start) return normalized;
        const next = [];
        normalized.forEach((r) => {
            if (span.end <= r.start || span.start >= r.end) {
                next.push(r);
                return;
            }
            if (span.start > r.start) next.push({ start: r.start, end: span.start });
            if (span.end < r.end) next.push({ start: span.end, end: r.end });
        });
        return normalizeRanges(next, textLen);
    };
    const getZoneBounds = (zoneIdx = 0, markers = [], textLen = 0) => {
        const points = [0, ...normalizeMarkers(markers, textLen), textLen];
        const idx = Math.max(0, Math.min(points.length - 2, Number(zoneIdx || 0)));
        return { start: points[idx], end: points[idx + 1] };
    };
    const highlightTextWithPink = (text = '', responseRanges = [], zoneMarkers = [], activeZoneIdx = null) => {
        const source = String(text || '');
        const pink = normalizeRanges(responseRanges, source.length);
        const markers = normalizeMarkers(zoneMarkers, source.length);
        const zone = Number.isFinite(activeZoneIdx) ? getZoneBounds(activeZoneIdx, markers, source.length) : null;
        if (!source || (pink.length === 0 && markers.length === 0 && !zone)) return source;
        const points = [0, source.length];
        pink.forEach((r) => { points.push(r.start, r.end); });
        markers.forEach((m) => { points.push(m); });
        if (zone) points.push(zone.start, zone.end);
        const cuts = [...new Set(points)].sort((a, b) => a - b);
        const out = [];
        const markerSet = new Set(markers);
        for (let i = 0; i < cuts.length - 1; i += 1) {
            const start = cuts[i];
            const end = cuts[i + 1];
            if (markerSet.has(start)) {
                out.push(<span key={`mk_${start}`} className="inline-block h-[1.1em] align-middle border-l-4 border-red-600 mx-[2px]" />);
            }
            if (end <= start) continue;
            const chunk = source.slice(start, end);
            const inPink = pink.some((r) => start >= r.start && end <= r.end);
            const inZone = !!zone && start >= zone.start && end <= zone.end;
            if (!inPink && !inZone) {
                out.push(<React.Fragment key={`txt_${start}`}>{chunk}</React.Fragment>);
            } else if (inPink && inZone) {
                out.push(<mark key={`both_${start}`} className="bg-fuchsia-200 text-fuchsia-900 rounded px-[2px] border border-indigo-300">{chunk}</mark>);
            } else if (inPink) {
                out.push(<mark key={`pink_${start}`} className="bg-pink-200 text-pink-900 rounded px-[2px]">{chunk}</mark>);
            } else {
                out.push(<mark key={`zone_${start}`} className="bg-slate-200 text-slate-900 rounded px-[2px] border border-slate-300">{chunk}</mark>);
            }
        }
        if (markerSet.has(source.length)) out.push(<span key="mk_end" className="inline-block h-[1.1em] align-middle border-l-4 border-red-600 mx-[2px]" />);
        return out;
    };

    const applyPinkSnippets = (incoming = []) => {
        const source = String(keywordMaterialText || '');
        if (!source || !step) return;
        const snippets = [...new Set((incoming || []).map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
        if (!snippets.length) return;
        const baseRanges = normalizeRanges(getCurrentResponseRanges(), source.length);
        const next = [...baseRanges];
        snippets.forEach((snippet) => {
            const needle = snippet.toLowerCase();
            let from = 0;
            while (from < source.length) {
                const idx = source.toLowerCase().indexOf(needle, from);
                if (idx === -1) break;
                next.push({ start: idx, end: idx + snippet.length });
                from = idx + Math.max(1, snippet.length);
            }
        });
        applyRangesToStep({ responseRanges: next });
    };

    const loose = (value = '') =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const removePinkSnippet = (snippetRaw = '', fallbackLast = false, target = 'response') => {
        if (!step) return;
        const source = String(keywordMaterialText || '');
        const ranges = normalizeRanges(target === 'zone' ? getCurrentZoneRanges() : getCurrentResponseRanges(), source.length);
        const snippet = loose(snippetRaw);
        if (!ranges.length) return;
        if (!snippet && fallbackLast) {
            if (target === 'zone') applyRangesToStep({ zoneRanges: ranges.slice(0, -1) });
            else applyRangesToStep({ responseRanges: ranges.slice(0, -1) });
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            return;
        }
        if (!snippet) return;
        const next = [];
        ranges.forEach((r) => {
            const chunk = source.slice(r.start, r.end);
            const lowChunk = loose(chunk);
            const pos = lowChunk.indexOf(snippet);
            if (pos === -1) {
                next.push(r);
                return;
            }
            const rawPos = chunk.toLowerCase().indexOf(String(snippetRaw || '').toLowerCase());
            const splitAt = rawPos >= 0 ? rawPos : pos;
            const cutStart = r.start + splitAt;
            const cutEnd = Math.min(r.end, cutStart + String(snippetRaw || '').length);
            if (cutStart > r.start) next.push({ start: r.start, end: cutStart });
            if (cutEnd < r.end) next.push({ start: cutEnd, end: r.end });
        });
        if (target === 'zone') applyRangesToStep({ zoneRanges: next });
        else applyRangesToStep({ responseRanges: next });
        setKeywordSelectedText('');
        setKeywordSelectionSpan(null);
    };

    const runAutoHighlight = async () => {
        if (!step) return;
        const text = String(keywordMaterialText || '').trim();
        if (!text) return alert("Ajoute d'abord du texte source.");
        setAutoHighlighting(true);
        try {
            const res = await fetch('/api/learning/auto-highlight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, max: 10 })
            });
            const data = await res.json();
            if (!res.ok || !Array.isArray(data?.snippets)) throw new Error(data?.error || 'Auto impossible');
            applyPinkSnippets(data.snippets);
        } catch (e) {
            alert(`Auto impossible: ${e.message}`);
        }
        setAutoHighlighting(false);
    };

    const captureKeywordSelection = () => {
        const root = keywordSelectionRef.current;
        const sel = window.getSelection ? window.getSelection() : null;
        if (!root || !sel || sel.rangeCount === 0) {
            setKeywordSelectedText('');
            return;
        }
        const range = sel.getRangeAt(0);
        const inRoot = root.contains(range.commonAncestorContainer);
        const txt = inRoot ? String(sel.toString() || '') : '';
        const cleaned = txt.replace(/\s+/g, ' ').trim();
        setKeywordSelectedText(cleaned);
        if (!cleaned) return;
        const pre = range.cloneRange();
        pre.selectNodeContents(root);
        pre.setEnd(range.startContainer, range.startOffset);
        const start = pre.toString().length;
        const end = start + txt.length;
        const span = { start, end };
        setKeywordSelectionSpan(span);
    };

    const getLiveSelectionInKeywordBox = () => {
        const root = keywordSelectionRef.current;
        const sel = window.getSelection ? window.getSelection() : null;
        if (!root || !sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return null;
        const txt = String(sel.toString() || '');
        const cleaned = txt.replace(/\s+/g, ' ').trim();
        if (!cleaned) return null;
        const pre = range.cloneRange();
        pre.selectNodeContents(root);
        pre.setEnd(range.startContainer, range.startOffset);
        const start = pre.toString().length;
        const end = start + txt.length;
        if (end <= start) return null;
        return { text: cleaned, span: { start, end } };
    };
    const getLiveCursorPosInKeywordBox = () => {
        const root = keywordSelectionRef.current;
        const sel = window.getSelection ? window.getSelection() : null;
        if (!root || !sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return null;
        const pre = range.cloneRange();
        pre.selectNodeContents(root);
        pre.setEnd(range.startContainer, range.startOffset);
        const sourceLen = String(keywordMaterialText || '').length;
        const pos = pre.toString().length;
        return Math.max(0, Math.min(sourceLen, pos));
    };

    const applyCurrentSelectionForMode = (target = activeTarget, remove = eraseMode) => {
        const live = getLiveSelectionInKeywordBox();
        const selectionSpan = live?.span || keywordSelectionSpan;
        if (!selectionSpan) return;
        const selectionText = live?.text || String(keywordSelectedText || '').trim();
        if (selectionText) setKeywordSelectedText(selectionText);
        setKeywordSelectionSpan(selectionSpan);
        const sourceLen = String(keywordMaterialText || '').length;
        if (remove) {
            if (target === 'zone') {
                const nextZone = subtractRange(getCurrentZoneRanges(), selectionSpan, sourceLen);
                applyRangesToStep({ zoneRanges: nextZone });
            } else {
                const nextResp = subtractRange(getCurrentResponseRanges(), selectionSpan, sourceLen);
                applyRangesToStep({ responseRanges: nextResp });
            }
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            return;
        }
        if (target === 'zone') {
            const currentZone = normalizeRanges(getCurrentZoneRanges(), sourceLen);
            applyRangesToStep({ zoneRanges: [...currentZone, selectionSpan] });
        } else {
            const currentResp = normalizeRanges(getCurrentResponseRanges(), sourceLen);
            applyRangesToStep({ responseRanges: [...currentResp, selectionSpan] });
        }
    };
    const onCutAction = () => {
        const sourceLen = String(keywordMaterialText || '').length;
        const pos = getLiveCursorPosInKeywordBox();
        if (!Number.isFinite(pos) || pos <= 0 || pos >= sourceLen) return;
        const markers = normalizeMarkers(getCurrentZoneMarkers(), sourceLen);
        if (markers.includes(pos)) return;
        applyRangesToStep({ zoneMarkers: [...markers, pos] });
    };
    const onNextAction = () => {
        const sourceLen = String(keywordMaterialText || '').length;
        const markers = normalizeMarkers(getCurrentZoneMarkers(), sourceLen);
        const zoneCount = markers.length + 1;
        if (zoneCount <= 0) return;
        setKeywordActiveZoneIdx((prev) => Number.isFinite(prev) ? ((prev + 1) % zoneCount) : 0);
    };

    const addSelectedPinkKeyword = (forcedSnippet = '') => {
        if (!step) return;
        const snippet = String(forcedSnippet || keywordSelectedText || '').replace(/\s+/g, ' ').trim();
        if (!snippet) return;
        if (activeTarget === 'zone') {
            if (keywordSelectionSpan && Number.isFinite(keywordSelectionSpan.start) && Number.isFinite(keywordSelectionSpan.end)) {
                const sourceLen = String(keywordMaterialText || '').length;
                const currentZone = normalizeRanges(getCurrentZoneRanges(), sourceLen);
                applyRangesToStep({ zoneRanges: [...currentZone, keywordSelectionSpan] });
            }
            setKeywordSelectedText(snippet);
            return;
        }
        if (keywordSelectionSpan && Number.isFinite(keywordSelectionSpan.start) && Number.isFinite(keywordSelectionSpan.end)) {
            const sourceLen = String(keywordMaterialText || '').length;
            const currentResp = normalizeRanges(getCurrentResponseRanges(), sourceLen);
            applyRangesToStep({ responseRanges: [...currentResp, keywordSelectionSpan] });
        } else {
            applyPinkSnippets([snippet]);
        }
        setKeywordSelectedText(snippet);
    };

    useEffect(() => {
        if (step?.type === 'video' && step?.videoUrl) {
            refreshKnownSegments(step.videoUrl);
        } else {
            setKnownSegments([]);
            setSelectedSegmentId('');
            setSelectedSegmentLabel('');
            setSelectedSegmentTranscript('');
            setLastSavedSegmentLabel('');
            setLastSavedSegmentTranscript('');
        }
    }, [step?.type, step?.videoUrl, teacherId]);

    useEffect(() => {
        if (!selectedSegmentId) return;
        const label = String(selectedSegmentLabel || '').trim();
        const transcript = String(selectedSegmentTranscript || '');
        const sameAsSaved = label === String(lastSavedSegmentLabel || '').trim()
            && transcript === String(lastSavedSegmentTranscript || '');
        if (sameAsSaved) return;
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/learning/video-segments/${encodeURIComponent(selectedSegmentId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherId, label, transcript })
                });
                if (!res.ok) return;
                setLastSavedSegmentLabel(label);
                setLastSavedSegmentTranscript(transcript);
                setKnownSegments(prev => prev.map((seg) => {
                    const sid = String(seg._id || seg.id || '');
                    if (sid !== selectedSegmentId) return seg;
                    return { ...seg, label, transcript };
                }));
            } catch (_) {}
        }, 700);
        return () => clearTimeout(t);
    }, [selectedSegmentId, selectedSegmentLabel, selectedSegmentTranscript, lastSavedSegmentLabel, lastSavedSegmentTranscript, teacherId]);

    const addStep = (type) => {
        setFormData(prev => ({ ...prev, steps: [...(prev.steps || []), emptyStep(type)] }));
        setActiveStep((formData.steps || []).length);
    };

    const moveStep = (idx, dir) => {
        const to = idx + dir;
        if (to < 0 || to >= formData.steps.length) return;
        const next = [...formData.steps];
        const tmp = next[idx];
        next[idx] = next[to];
        next[to] = tmp;
        setFormData(prev => ({ ...prev, steps: next }));
        setActiveStep(to);
    };

    const removeStep = (idx) => {
        if (!window.confirm('Supprimer cette étape ?')) return;
        const next = formData.steps.filter((_, i) => i !== idx);
        setFormData(prev => ({ ...prev, steps: next }));
        setActiveStep(Math.max(0, Math.min(activeStep, next.length - 1)));
    };

    const loadDefaultsFromGame = () => {
        const chapterId = String(formData.chapterId || '');
        if (!chapterId) return;
        const sameChapter = (allGames || []).filter(g => String(g.chapterId || '') === chapterId);
        if (sameChapter.length === 0) return alert("Aucun jeu trouvé dans ce chapitre.");
        const game = sameChapter[0];
        const newSteps = [];
        if (game?.globalIntro?.sheetUrl) {
            newSteps.push({ id: uid(), type: 'sheet', title: 'Fiche du chapitre', sheetUrl: game.globalIntro.sheetUrl, minReadSeconds: 25 });
        }
        if (game?.globalIntro?.videoUrl) {
            newSteps.push({ id: uid(), type: 'video', title: 'Vidéo du chapitre', videoUrl: game.globalIntro.videoUrl, thumbnailUrl: '', mustWatchToEnd: true });
        }
        if (newSteps.length === 0) return alert("Le jeu du chapitre n'a pas encore de fiche/vidéo globale.");
        setFormData(prev => ({ ...prev, steps: [...(prev.steps || []), ...newSteps] }));
    };

    const handleSave = async () => {
        const chapterId = String(formData.chapterId || '');
        if (!formData.title.trim()) return alert("Titre requis.");
        if (!chapterId) return alert("Choisissez un chapitre.");
        if (!Array.isArray(formData.steps) || formData.steps.length === 0) return alert("Ajoutez au moins une étape.");
        const targets = Object.keys(distribution || {});
        if (targets.length === 0) return alert("Choisissez au moins une classe.");

        const chapter = (chapters || []).find(ch => String(ch._id) === chapterId);

        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls] || { studentIds: [] };
                const isAllClass = !Array.isArray(cfg.studentIds) || cfg.studentIds.length === 0;
                const key = isAllClass ? 'ALL' : `SUBSET_${[...cfg.studentIds].sort().join('-')}`;
                if (!groups[key]) groups[key] = { classrooms: [], studentIds: cfg.studentIds || [], isAllClass };
                groups[key].classrooms.push(cls);
            });

            const groupKeys = Object.keys(groups);
            for (let i = 0; i < groupKeys.length; i += 1) {
                const grp = groups[groupKeys[i]];
                const payload = {
                    ...(formData._id && i === 0 ? { _id: formData._id } : {}),
                    title: formData.title.trim(),
                    subject: chapter?.section || formData.subject || targetSection || 'GÉNÉRAL',
                    chapterId,
                    teacherId: user.id || user._id,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.studentIds,
                    isAllClass: grp.isAllClass,
                    isEnabled: true,
                    steps: formData.steps
                };
                await api.post('/learning', payload);
            }
            onClose();
        } catch (e) {
            alert(`Erreur sauvegarde apprentissage: ${e.message}`);
        }
        setLoading(false);
    };

    const editorVideoUrl = step?.type === 'video' ? resolveDriveAssetUrl(step.videoUrl || '') : '';
    const editorIsDirect = isProbablyDirectVideo(editorVideoUrl);
    const editorEmbedUrl = toEmbedUrl(editorVideoUrl);

    return (
        <div className="v84-game-container">
            <div className="v84-game-header">
                <div className="flex items-center gap-4">
                    <input
                        className="v84-game-title-input"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="TITRE APPRENTISSAGE..."
                    />
                    <select
                        className="v84-res-input min-w-[260px]"
                        value={formData.chapterId}
                        onChange={(e) => {
                            const ch = (chapters || []).find(x => String(x._id) === String(e.target.value));
                            setFormData(prev => ({ ...prev, chapterId: e.target.value, subject: ch?.section || prev.subject }));
                        }}
                    >
                        <option value="">Choisir chapitre</option>
                        {availableChapters.map(ch => <option key={ch._id} value={ch._id}>{ch.title}</option>)}
                    </select>
                    <button className="v84-res-btn upload" onClick={loadDefaultsFromGame}>Charger Fiche/Vidéo du Jeu</button>
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            <div className="v84-game-body">
                <div className="v84-q-list-sidebar custom-scrollbar">
                    {(formData.steps || []).map((s, idx) => (
                        <div
                            key={s.id || idx}
                            className={`v84-level-header ${activeStep === idx ? 'active-lvl' : ''}`}
                            onClick={() => setActiveStep(idx)}
                        >
                            {s.type === 'sheet' ? '📄' : s.type === 'video' ? '🎬' : '🎤'} {s.title || `Étape ${idx + 1}`}
                            <div className="flex ml-auto gap-1">
                                <button className="v84-del-btn" onClick={(e) => { e.stopPropagation(); moveStep(idx, -1); }}>↑</button>
                                <button className="v84-del-btn" onClick={(e) => { e.stopPropagation(); moveStep(idx, 1); }}>↓</button>
                                <button className="v84-del-btn" onClick={(e) => { e.stopPropagation(); removeStep(idx); }}>✕</button>
                            </div>
                        </div>
                    ))}
                    <div className="grid grid-cols-1 gap-2 mt-4">
                        <button className="v84-add-q-btn" onClick={() => addStep('sheet')}>+ FICHE</button>
                        <button className="v84-add-q-btn" onClick={() => addStep('video')}>+ VIDÉO</button>
                        <button className="v84-add-q-btn" onClick={() => addStep('question')}>+ QUESTION IA</button>
                    </div>
                </div>

                <div className="v84-game-editor custom-scrollbar">
                    {!step && (
                        <div className="flex items-center justify-center h-full text-slate-300 font-bold uppercase">
                            Ajoutez puis sélectionnez une étape
                        </div>
                    )}
                    {step && (
                        <div className="v84-q-card">
                            <div className="hw-section-title">Nom de l'étape</div>
                            <input
                                className="v84-ans-input"
                                value={step.title || ''}
                                onChange={(e) => updateStep(activeStep, { title: e.target.value })}
                            />

                            {step.type === 'sheet' && (
                                <>
                                    <div className="hw-section-title mt-4">URL fiche</div>
                                    <input
                                        className="v84-ans-input"
                                        value={step.sheetUrl || ''}
                                        onChange={(e) => updateStep(activeStep, { sheetUrl: e.target.value })}
                                        placeholder="/api/structure/proxy/..."
                                    />
                                    <div className="hw-section-title mt-4">Lecture minimale (secondes)</div>
                                    <input
                                        type="number"
                                        min="5"
                                        max="600"
                                        className="v84-ans-input"
                                        value={step.minReadSeconds || 20}
                                        onChange={(e) => updateStep(activeStep, { minReadSeconds: Number(e.target.value || 20) })}
                                    />
                                    <div className="hw-section-title mt-4">Texte de la fiche (source IA)</div>
                                    <textarea
                                        rows={5}
                                        className="v84-q-input"
                                        value={step.sheetText || ''}
                                        onChange={(e) => updateStep(activeStep, { sheetText: e.target.value })}
                                        placeholder="Colle ici le texte/résumé de la fiche pour les futures questions IA."
                                    />
                                    <div className="mt-2">
                                        <button type="button" className="v84-res-btn upload" onClick={extractTextForSheetStep} disabled={extractingSheetText || !step.sheetUrl}>
                                            {extractingSheetText ? 'Extraction...' : 'IA extraire texte de la fiche'}
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload ml-2 bg-violet-600 text-white"
                                            onClick={saveExtractedSheetText}
                                            disabled={savingSheetText || !String(step.sheetText || '').trim()}
                                        >
                                            {savingSheetText ? 'Sauvegarde...' : 'Sauver texte extrait'}
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload ml-2 bg-pink-600 text-white border-pink-700"
                                            onClick={openKeywordModal}
                                        >
                                            Éditer texte / zones réponses
                                        </button>
                                    </div>
                                </>
                            )}

                            {step.type === 'video' && (
                                <>
                                    <div className="hw-section-title mt-4">URL vidéo</div>
                                    <input
                                        className="v84-ans-input"
                                        value={step.videoUrl || ''}
                                        onChange={(e) => updateStep(activeStep, { videoUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    <div className="hw-section-title mt-4">Image preview (thumbnail)</div>
                                    <input
                                        className="v84-ans-input"
                                        value={step.thumbnailUrl || ''}
                                        onChange={(e) => updateStep(activeStep, { thumbnailUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div>
                                            <div className="hw-section-title">Début segment (sec)</div>
                                            <input
                                                type="number"
                                                min="0"
                                                className="v84-ans-input"
                                                value={Number(step.startSec || 0)}
                                                onChange={(e) => updateStep(activeStep, { startSec: Math.max(0, Number(e.target.value || 0)) })}
                                                placeholder="ex: 80"
                                            />
                                        </div>
                                        <div>
                                            <div className="hw-section-title">Fin segment (sec, 0 = fin vidéo)</div>
                                            <input
                                                type="number"
                                                min="0"
                                                className="v84-ans-input"
                                                value={Number(step.endSec || 0)}
                                                onChange={(e) => updateStep(activeStep, { endSec: Math.max(0, Number(e.target.value || 0)) })}
                                                placeholder="ex: 170"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 p-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-500">
                                        Le texte vidéo vient des segments sauvegardés dans l’éditeur de séquences.
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <button type="button" className="v84-res-btn upload" onClick={openVideoEditor} disabled={!step.videoUrl}>
                                            Éditeur Séquences
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-pink-600 text-white border-pink-700"
                                            onClick={openKeywordModal}
                                        >
                                            Éditer texte / zones réponses
                                        </button>
                                        {knownSegments.length > 0 && (
                                            <div className="flex-1 max-w-[340px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                                                <div className="text-[9px] font-black uppercase text-slate-400 mb-1">Séquence enregistrée</div>
                                                <select
                                                    className="w-full bg-transparent font-black text-[12px] text-slate-700 outline-none"
                                                    value={selectedSegmentId}
                                                    onChange={(e) => {
                                                        const sid = String(e.target.value || '');
                                                        const seg = knownSegments.find((s) => String(s._id || s.id || '') === sid);
                                                        if (seg) applyKnownSegment(seg);
                                                    }}
                                                >
                                                    <option value="">Choisir une séquence</option>
                                                    {knownSegments.map((seg, i) => {
                                                        const sid = String(seg._id || seg.id || '');
                                                        const label = String(seg.label || `Séquence ${i + 1}`);
                                                        return <option key={sid || i} value={sid}>{label}</option>;
                                                    })}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}

                            {step.type === 'question' && (
                                <>
                                    <div className="hw-section-title mt-4">Difficulté</div>
                                    <select
                                        className="v84-ans-input"
                                        value={step.difficulty || 'easy'}
                                        onChange={(e) => updateStep(activeStep, { difficulty: e.target.value })}
                                    >
                                        <option value="easy">Très facile</option>
                                        <option value="medium">Moyen</option>
                                        <option value="hard">Difficile</option>
                                    </select>
                                    <div className="hw-section-title mt-4">Question personnalisée (optionnel)</div>
                                    <textarea
                                        rows={3}
                                        className="v84-q-input"
                                        value={step.customQuestion || ''}
                                        onChange={(e) => updateStep(activeStep, { customQuestion: e.target.value })}
                                        placeholder="Si vide, une question aléatoire sera générée."
                                    />
                                    <div className="hw-section-title mt-4">Fiche source de la question</div>
                                    <div className="flex gap-2 items-center">
                                        <select
                                            className="v84-ans-input"
                                            value={step.sourceSheetUrl || ''}
                                            onChange={(e) => updateStep(activeStep, { sourceSheetUrl: e.target.value })}
                                        >
                                            <option value="">Choisir une fiche</option>
                                            {getCandidateSheets().map((item) => (
                                                <option key={item.url} value={item.url}>{item.source} - {item.url.slice(0, 40)}...</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload whitespace-nowrap"
                                            onClick={() => setShowAnnotModal(true)}
                                            disabled={!step.sourceSheetUrl}
                                        >
                                            Annoter la fiche
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload whitespace-nowrap"
                                            onClick={openKeywordModal}
                                        >
                                            Sélection mots-clés (rose)
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload whitespace-nowrap bg-pink-600 text-white border-pink-700"
                                            onClick={extractTextFromSheetForQuestion}
                                            disabled={extractingSheetText || !step.sourceSheetUrl}
                                        >
                                            {extractingSheetText ? 'Extraction...' : 'Extraire texte et ouvrir div'}
                                        </button>
                                    </div>

                                    <div className="hw-section-title mt-4">🟧 Surlignage ORANGE (points à questionner)</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(step.orangeHighlights || []).map((tag, i) => (
                                            <span key={`${tag}_${i}`} className="px-3 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700 border border-orange-300">{tag}</span>
                                        ))}
                                    </div>

                                    <div className="hw-section-title mt-4">🟥 Surlignage ROUGE (réponses attendues)</div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(step.redHighlights || []).map((tag, i) => (
                                            <span key={`${tag}_${i}`} className="px-3 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-700 border border-red-300">{tag}</span>
                                        ))}
                                    </div>
                                    <div className="mt-4 flex items-center gap-2">
                                        <button type="button" className="v84-res-btn upload" onClick={generateTestQuestions} disabled={aiTesting || !step.sourceSheetUrl}>
                                            {aiTesting ? 'Génération...' : 'Produire questions test'}
                                        </button>
                                        <span className="text-[11px] font-bold text-slate-400">pour vérifier la compréhension IA</span>
                                    </div>
                                    {(step.aiPreviewQuestions || []).length > 0 && (
                                        <div className="mt-3 p-3 rounded-xl border border-indigo-100 bg-indigo-50/40">
                                            <div className="text-[11px] font-black uppercase text-indigo-600 mb-2">Aperçu questions générées</div>
                                            <div className="space-y-2">
                                                {step.aiPreviewQuestions.map((q, idx) => (
                                                    <div key={idx} className="text-[12px] font-bold text-slate-700">
                                                        {idx + 1}. {q.q || q.question || 'Question'}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div className="hw-section-title mt-4">Mots-clés attendus (virgules)</div>
                                    <input
                                        className="v84-ans-input"
                                        value={Array.isArray(step.keywords) ? step.keywords.join(', ') : (step.keywords || '')}
                                        onChange={(e) => updateStep(activeStep, { keywords: e.target.value.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) })}
                                        placeholder="ex: natalité, mortalité, santé"
                                    />
                                    <div className="hw-section-title mt-4">Nombre min de mots-clés</div>
                                    <input
                                        type="number"
                                        min="1"
                                        max="10"
                                        className="v84-ans-input"
                                        value={step.minKeywordMatches || 1}
                                        onChange={(e) => updateStep(activeStep, { minKeywordMatches: Number(e.target.value || 1) })}
                                    />
                                </>
                            )}
                        </div>
                    )}
                </div>

                <StudioDistributionSidebar
                    user={user}
                    allClasses={allClasses}
                    allStudents={allStudents}
                    chapters={chapters}
                    distribution={distribution}
                    setDistribution={setDistribution}
                    viewingClass={viewingClass}
                    setViewingClass={setViewingClass}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    targetSection={targetSection}
                    targetLevel={targetLevel}
                    loading={loading}
                    saveLabel="PUBLIER APPRENTISSAGE 🚀"
                    onSave={handleSave}
                />
            </div>

            {showAnnotModal && step?.type === 'question' && (
                <div className="fixed inset-0 z-[50000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="text-sm font-black uppercase text-slate-700">Annotation fiche</div>
                            <select className="v84-ans-input max-w-[240px]" value={step.sourceSheetUrl || ''} onChange={(e) => updateStep(activeStep, { sourceSheetUrl: e.target.value })}>
                                <option value="">Choisir une fiche</option>
                                {getCandidateSheets().map((item) => (
                                    <option key={item.url} value={item.url}>{item.source} - {item.url.slice(0, 30)}...</option>
                                ))}
                            </select>
                            <select className="v84-ans-input max-w-[160px]" value={annotColor} onChange={(e) => setAnnotColor(e.target.value)}>
                                <option value="orange">Orange (points question)</option>
                                <option value="red">Rouge (réponses attendues)</option>
                            </select>
                            <input
                                className="v84-ans-input"
                                value={annotLabel}
                                onChange={(e) => setAnnotLabel(e.target.value)}
                                placeholder="Texte du surlignage"
                            />
                            <button className="v84-res-btn upload" onClick={pushAnnotation} disabled={!annotDraft || !annotLabel.trim()}>Valider zone</button>
                            <button className="ml-auto v84-close-btn" onClick={() => { setShowAnnotModal(false); setAnnotDraft(null); }}>✕</button>
                        </div>
                        <div className="flex-1 grid grid-cols-[1fr_280px] gap-0 min-h-0">
                            <div className="relative bg-slate-100 overflow-auto">
                                {step.sourceSheetUrl ? (
                                    <div
                                        className="relative w-full h-full min-h-[400px] cursor-crosshair"
                                        onMouseDown={handleAnnotMouseDown}
                                        onMouseMove={handleAnnotMouseMove}
                                        onMouseUp={handleAnnotMouseUp}
                                    >
                                        <img src={step.sourceSheetUrl} alt="fiche source" className="w-full h-full object-contain select-none pointer-events-none" />
                                        {(step.sheetAnnotations || []).map((a, idx) => (
                                            <button
                                                key={`${idx}_${a.label}`}
                                                type="button"
                                                onClick={() => removeAnnotation(idx)}
                                                title="Supprimer cette zone"
                                                className="absolute border-2 text-[10px] font-black px-1 py-0.5 rounded"
                                                style={{
                                                    left: `${a.x}%`,
                                                    top: `${a.y}%`,
                                                    width: `${a.w}%`,
                                                    height: `${a.h}%`,
                                                    borderColor: a.color === 'orange' ? '#f59e0b' : '#ef4444',
                                                    background: a.color === 'orange' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)',
                                                    color: a.color === 'orange' ? '#b45309' : '#b91c1c'
                                                }}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                        {annotDraft && (
                                            <div
                                                className="absolute border-2 border-dashed"
                                                style={{
                                                    left: `${annotDraft.x}%`,
                                                    top: `${annotDraft.y}%`,
                                                    width: `${annotDraft.w}%`,
                                                    height: `${annotDraft.h}%`,
                                                    borderColor: annotColor === 'orange' ? '#f59e0b' : '#ef4444',
                                                    background: annotColor === 'orange' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
                                                }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-black">Choisis une fiche pour annoter.</div>
                                )}
                            </div>
                            <div className="border-l border-slate-200 p-3 overflow-auto">
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Zones orange</div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(step.orangeHighlights || []).map((x, i) => <span key={`${x}_${i}`} className="px-2 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">{x}</span>)}
                                </div>
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Zones rouges</div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(step.redHighlights || []).map((x, i) => <span key={`${x}_${i}`} className="px-2 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-700">{x}</span>)}
                                </div>
                                <button className="v84-res-btn upload w-full" onClick={generateTestQuestions} disabled={aiTesting}>
                                    {aiTesting ? 'Génération...' : 'Produire questions test'}
                                </button>
                                {(step.aiPreviewQuestions || []).length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {(step.aiPreviewQuestions || []).map((q, i) => (
                                            <div key={i} className="text-[12px] font-bold text-slate-700 p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                {i + 1}. {q.q || q.question || 'Question'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showVideoEditor && step?.type === 'video' && (
                <div className="fixed inset-0 z-[50000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                            <div className="text-sm font-black uppercase text-slate-700">Éditeur séquences vidéo</div>
                            <select className="v84-ans-input max-w-[120px]" value={segmentRate} onChange={(e) => setSegmentRate(Number(e.target.value || 1))}>
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>x{r}</option>)}
                            </select>
                            <button className="v84-res-btn upload bg-violet-600 text-white" onClick={() => markVideoTime('start')} disabled={!editorIsDirect}>Marquer Début</button>
                            <button className="v84-res-btn upload bg-violet-600 text-white" onClick={() => markVideoTime('end')} disabled={!editorIsDirect}>Marquer Fin</button>
                            <button className="v84-res-btn upload bg-violet-600 text-white" onClick={previewSegment} disabled={!editorIsDirect || (segmentEnd > 0 && segmentEnd <= segmentStart)}>
                                Prévisualiser segment
                            </button>
                            <input className="v84-ans-input max-w-[170px]" value={segmentStart} onChange={(e) => setSegmentStart(Math.max(0, Number(e.target.value || 0)))} />
                            <input className="v84-ans-input max-w-[170px]" value={segmentEnd} onChange={(e) => setSegmentEnd(Math.max(0, Number(e.target.value || 0)))} />
                            <button className="v84-close-btn ml-auto" onClick={() => setShowVideoEditor(false)}>✕</button>
                        </div>
                        <div className="flex-1 grid grid-cols-[1fr_290px] min-h-0">
                            <div className="p-4 bg-slate-100">
                                {editorVideoUrl ? (
                                    editorIsDirect ? (
                                        <video
                                            ref={videoEditorRef}
                                            src={editorVideoUrl}
                                            controls
                                            className="w-full h-full rounded-xl bg-black"
                                            onLoadedMetadata={() => {
                                                if (!videoEditorRef.current) return;
                                                videoEditorRef.current.playbackRate = segmentRate;
                                                if (segmentStart > 0) {
                                                    try { videoEditorRef.current.currentTime = segmentStart; } catch (_) {}
                                                }
                                            }}
                                            onTimeUpdate={() => {
                                                if (!videoEditorRef.current) return;
                                                videoEditorRef.current.playbackRate = segmentRate;
                                                if (previewSegmentMode && segmentEnd > 0 && videoEditorRef.current.currentTime >= segmentEnd) {
                                                    videoEditorRef.current.pause();
                                                    setPreviewSegmentMode(false);
                                                }
                                            }}
                                            onPause={() => setPreviewSegmentMode(false)}
                                        />
                                    ) : (
                                        <iframe
                                            title="video-segment-editor"
                                            src={editorEmbedUrl}
                                            className="w-full h-full rounded-xl bg-black border-0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        />
                                    )
                                ) : (
                                    <div className="w-full h-full rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-black">
                                        URL vidéo invalide.
                                    </div>
                                )}
                            </div>
                            <div className="p-4 border-l border-slate-200 overflow-auto">
                                {!editorIsDirect && (
                                    <div className="text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                                        URL embed détectée: marque début/fin manuellement via les champs.
                                    </div>
                                )}
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Enregistrer séquence</div>
                                <input
                                    className="v84-ans-input"
                                    value={segmentLabel}
                                    onChange={(e) => setSegmentLabel(e.target.value)}
                                    placeholder="Nom segment (optionnel)"
                                />
                                <button className="v84-res-btn upload bg-violet-600 text-white w-full mt-2" onClick={saveCurrentSegment}>Sauver ce segment</button>

                                <div className="text-[11px] font-black uppercase text-slate-400 mt-4 mb-2">Segments existants</div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Section vidéo</div>
                                    <div className="flex items-center gap-2">
                                        <select
                                            className="v84-ans-input !h-[42px]"
                                            value={selectedSegmentId}
                                            onChange={(e) => {
                                                const sid = String(e.target.value || '');
                                                const seg = knownSegments.find((s) => String(s._id || s.id || '') === sid);
                                                if (seg) applyKnownSegment(seg);
                                            }}
                                        >
                                            <option value="">Choisir une section</option>
                                            {knownSegments.map((seg, i) => {
                                                const sid = String(seg._id || seg.id || '');
                                                const label = String(seg.label || `Séquence ${i + 1}`);
                                                return (
                                                    <option key={sid || i} value={sid}>
                                                        {label} ({seg.startSec}-{seg.endSec || 'fin'})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <button
                                            type="button"
                                            className="w-10 h-10 rounded-xl bg-red-100 text-red-600 border border-red-300 font-black text-[14px] disabled:opacity-40"
                                            title="Supprimer segment"
                                            disabled={!selectedSegment}
                                            onClick={() => selectedSegment && removeKnownSegment(selectedSegment)}
                                        >
                                            ✕
                                        </button>
                                    </div>
                                    {knownSegments.length === 0 && <span className="text-[11px] text-slate-400 mt-2 block">Aucun segment sauvegardé.</span>}
                                </div>
                                {selectedSegmentId && (
                                    <div className="mt-3 border-t border-slate-200 pt-3">
                                        <div className="text-[11px] font-black uppercase text-slate-400 mb-1">Nom du segment</div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="v84-ans-input"
                                                value={selectedSegmentLabel}
                                                onChange={(e) => setSelectedSegmentLabel(e.target.value)}
                                                placeholder="Nom segment..."
                                            />
                                            <button className="v84-res-btn upload bg-violet-600 text-white whitespace-nowrap" onClick={saveSelectedSegmentLabel}>
                                                Sauver Nom
                                            </button>
                                        </div>
                                        <div className="text-[11px] font-black uppercase text-slate-400 mt-3 mb-1">Texte de la section vidéo</div>
                                        <textarea
                                            rows={6}
                                            className="v84-q-input"
                                            value={selectedSegmentTranscript}
                                            onChange={(e) => setSelectedSegmentTranscript(e.target.value)}
                                            placeholder="Colle ici la transcription / résumé de cette section..."
                                        />
                                    </div>
                                )}

                                <div className="mt-4 pt-3 border-t border-slate-200">
                                    <button
                                        className="v84-res-btn upload bg-violet-600 text-white w-full"
                                        disabled={!selectedSegment}
                                        onClick={() => {
                                            if (!selectedSegment) return;
                                            applyKnownSegment(selectedSegment);
                                            updateStep(activeStep, { videoTranscript: String(selectedSegment.transcript || '') });
                                        }}
                                    >
                                        Appliquer à l'étape
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showKeywordModal && step && (
                <div className="fixed inset-0 z-[50010] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] w-full max-w-5xl h-[84vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="text-sm font-black uppercase text-slate-700">Sélection zones réponses (rose)</div>
                            <select
                                className="v84-ans-input max-w-[340px] ml-auto"
                                value={keywordMaterialSource}
                                onChange={(e) => onKeywordSourceChange(e.target.value)}
                            >
                                {questionTextSources.map((src) => (
                                    <option key={src.id} value={src.id}>{src.label}</option>
                                ))}
                            </select>
                            <button type="button" className="v84-close-btn" onClick={() => { setActiveTarget('response'); setEraseMode(false); setKeywordSelectionSpan(null); setKeywordActiveZoneIdx(null); setShowKeywordModal(false); }}>✕</button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 p-4 min-h-0 flex-1">
                            <div className="min-h-0 flex flex-col">
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Texte source (vidéo ou fiche)</div>
                                <textarea
                                    rows={10}
                                    className="v84-q-input flex-1"
                                    value={keywordMaterialText}
                                    onChange={(e) => setKeywordMaterialText(e.target.value)}
                                    placeholder="Texte support de la question IA."
                                />
                                {step?.type === 'video' && !String(keywordMaterialText || '').trim() && (
                                    <div className="mt-2 p-3 rounded-xl border border-amber-200 bg-amber-50 text-[12px] font-bold text-amber-700">
                                        Aucun texte vidéo trouvé. Ouvre l’éditeur de séquences, ajoute une transcription au segment puis applique ce segment à l’étape.
                                    </div>
                                )}
                            </div>
                            <div className="min-h-0 flex flex-col">
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Sélectionne puis clique “Réponses”. Clique “Cut” pour insérer une barre, “Next” pour naviguer entre sections.</div>
                                <div
                                    ref={keywordSelectionRef}
                                    onMouseUp={captureKeywordSelection}
                                    onClick={(e) => e.currentTarget.focus()}
                                    contentEditable
                                    suppressContentEditableWarning
                                    onBeforeInput={(e) => e.preventDefault()}
                                    onInput={(e) => e.preventDefault()}
                                    tabIndex={0}
                                    style={{ caretColor: '#0f172a' }}
                                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-6 text-slate-700 overflow-auto whitespace-pre-wrap select-text focus:outline-none focus:ring-2 focus:ring-blue-300"
                                >
                                    {keywordMaterialText
                                        ? highlightTextWithPink(keywordMaterialText, getCurrentResponseRanges(), getCurrentZoneMarkers(), keywordActiveZoneIdx)
                                        : 'Aucun texte pour le moment.'}
                                </div>
                                <div className="mt-3 p-3 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-[12px] font-bold min-h-[44px]">
                                    {keywordSelectedText || 'Sélection actuelle: vide'}
                                </div>
                                <div className="mt-3 flex items-center gap-2">
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={activeTarget === 'response'
                                            ? { border: '2px solid #ec4899', background: '#fff', color: '#be185d' }
                                            : { border: '2px solid transparent' }}
                                        onMouseDown={(e) => { captureKeywordSelection(); e.preventDefault(); }}
                                        onClick={() => {
                                            setActiveTarget('response');
                                            setEraseMode(false);
                                            setKeywordActiveZoneIdx(null);
                                            applyCurrentSelectionForMode('response', false);
                                        }}
                                    >
                                        Réponses
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={{ border: '2px solid #dc2626', background: '#fff', color: '#dc2626' }}
                                        onMouseDown={(e) => { captureKeywordSelection(); e.preventDefault(); }}
                                        onClick={onCutAction}
                                    >
                                        Cut
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={{ border: '2px solid #111827', background: '#fff', color: '#111827' }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={onNextAction}
                                    >
                                        Next
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={eraseMode
                                            ? { border: '2px solid #3b82f6', background: '#fff', color: '#1d4ed8' }
                                            : { border: '2px solid transparent' }}
                                        onMouseDown={(e) => { captureKeywordSelection(); e.preventDefault(); }}
                                        onClick={() => {
                                            const next = !eraseMode;
                                            setEraseMode(next);
                                            if (next) applyCurrentSelectionForMode(activeTarget, true);
                                        }}
                                    >
                                        ✕
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload bg-violet-600 text-white"
                                        onClick={runAutoHighlight}
                                        disabled={autoHighlighting || !keywordMaterialText.trim()}
                                    >
                                        {autoHighlighting ? 'Auto...' : 'Auto'}
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        onClick={() => {
                                            if (step.type === 'question') {
                                                updateStep(activeStep, { materialSource: keywordMaterialSource, materialText: keywordMaterialText });
                                            } else if (step.type === 'video') {
                                                updateStep(activeStep, { videoTranscript: keywordMaterialText });
                                            } else if (step.type === 'sheet') {
                                                updateStep(activeStep, { sheetText: keywordMaterialText });
                                            }
                                            setActiveTarget('response');
                                            setEraseMode(false);
                                            setKeywordSelectionSpan(null);
                                            setKeywordActiveZoneIdx(null);
                                            setShowKeywordModal(false);
                                        }}
                                    >
                                        Sauver texte
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
