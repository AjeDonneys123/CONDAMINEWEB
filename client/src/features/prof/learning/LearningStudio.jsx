import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const uid = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const emptyStep = (type = 'sheet') => {
    if (type === 'video') return { id: uid(), type: 'video', title: 'Vidéo', videoUrl: '', thumbnailUrl: '', mustWatchToEnd: true };
    if (type === 'question') return {
        id: uid(),
        type: 'question',
        title: 'Question IA',
        difficulty: 'easy',
        customQuestion: '',
        sourceSheetUrl: '',
        orangeHighlights: [],
        pinkHighlights: [],
        keywords: [],
        minKeywordMatches: 1
    };
    return { id: uid(), type: 'sheet', title: 'Fiche', sheetUrl: '', minReadSeconds: 20 };
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
    const [orangeInput, setOrangeInput] = useState('');
    const [pinkInput, setPinkInput] = useState('');

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
        const list = [];
        (formData.steps || []).forEach((s) => {
            if (s.type === 'sheet' && s.sheetUrl) list.push(s.sheetUrl);
        });
        if (list.length === 0) {
            const chapterId = String(formData.chapterId || '');
            const sameChapter = (allGames || []).filter(g => String(g.chapterId || '') === chapterId);
            const game = sameChapter[0];
            if (game?.globalIntro?.sheetUrl) list.push(game.globalIntro.sheetUrl);
        }
        return [...new Set(list)];
    };

    const addHighlight = (kind) => {
        const raw = kind === 'orange' ? orangeInput : pinkInput;
        const token = String(raw || '').trim();
        if (!token || !step || step.type !== 'question') return;
        const key = kind === 'orange' ? 'orangeHighlights' : 'pinkHighlights';
        const existing = Array.isArray(step[key]) ? step[key] : [];
        const next = [...new Set([...existing, token])];
        updateStep(activeStep, { [key]: next });
        if (kind === 'orange') setOrangeInput('');
        else setPinkInput('');
    };

    const removeHighlight = (kind, idx) => {
        if (!step || step.type !== 'question') return;
        const key = kind === 'orange' ? 'orangeHighlights' : 'pinkHighlights';
        const existing = Array.isArray(step[key]) ? step[key] : [];
        updateStep(activeStep, { [key]: existing.filter((_, i) => i !== idx) });
    };

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

    const step = formData.steps[activeStep] || null;

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
                                            {getCandidateSheets().map((url) => (
                                                <option key={url} value={url}>{url.slice(0, 70)}...</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload whitespace-nowrap"
                                            onClick={() => step.sourceSheetUrl && window.open(step.sourceSheetUrl, '_blank')}
                                            disabled={!step.sourceSheetUrl}
                                        >
                                            Ouvrir Fiche
                                        </button>
                                    </div>

                                    <div className="hw-section-title mt-4">🟧 Surlignage ORANGE (points à questionner)</div>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            className="v84-ans-input"
                                            value={orangeInput}
                                            onChange={(e) => setOrangeInput(e.target.value)}
                                            placeholder="mot / expression"
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHighlight('orange'); } }}
                                        />
                                        <button type="button" className="v84-res-btn upload" onClick={() => addHighlight('orange')}>+ ORANGE</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(step.orangeHighlights || []).map((tag, i) => (
                                            <button key={`${tag}_${i}`} type="button" onClick={() => removeHighlight('orange', i)} className="px-3 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700 border border-orange-300">
                                                {tag} ✕
                                            </button>
                                        ))}
                                    </div>

                                    <div className="hw-section-title mt-4">🩷 Surlignage ROSE (réponses attendues)</div>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            className="v84-ans-input"
                                            value={pinkInput}
                                            onChange={(e) => setPinkInput(e.target.value)}
                                            placeholder="mot clé attendu"
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHighlight('pink'); } }}
                                        />
                                        <button type="button" className="v84-res-btn upload" onClick={() => addHighlight('pink')}>+ ROSE</button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {(step.pinkHighlights || []).map((tag, i) => (
                                            <button key={`${tag}_${i}`} type="button" onClick={() => removeHighlight('pink', i)} className="px-3 py-1 rounded-full text-[11px] font-black bg-pink-100 text-pink-700 border border-pink-300">
                                                {tag} ✕
                                            </button>
                                        ))}
                                    </div>
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
        </div>
    );
}
