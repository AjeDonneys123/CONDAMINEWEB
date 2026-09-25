// @signatures: HomeworkStudio, handleSave
import React, { useState, useEffect, useRef } from 'react';
import './HomeworkStudio.css';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';

const DEFAULT_HW_DATA = { 
    title: '', content: '', date: '', teacherId: null, 
    levels: [{ instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '', aiHintUrls: [], dnbSection: 'docs', dnbSubject: 'histoire' }],
    isPunishment: false,
    assessmentKind: '',
    mode: 'docs',
    promptTopic: '',
    minTimeMinutes: 25,
    didakbotUrl: '',
    didakbotBotId: '',
    didakbotClassBots: [],
    didakbotAssignments: []
};

const DNB_SECTION_OPTIONS = [
    { value: 'docs', label: 'Docs' },
    { value: 'paragraphe', label: 'Paragraphe' },
    { value: 'reperes', label: 'Repères' },
    { value: 'emc', label: 'EMC' }
];

const DNB_SUBJECT_OPTIONS = [
    { value: 'histoire', label: 'Histoire' },
    { value: 'geo', label: 'Géo' }
];

const normalizeClassName = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const isTroisiemeClass = (value = '') => /^3/.test(normalizeClassName(value));
const isSecondeClass = (value = '') => /^(2|2DE|SECONDE)/.test(normalizeClassName(value));

export default function HomeworkStudio({ initialData, chapters, user, targetSection, targetLevel, onClose, allStudents: propStudents, allClasses: propClasses, globalClass }) {
    
    // 1. ÉTATS DU DEVOIR
    const [formData, setFormData] = useState(() => {
        let base = initialData ? JSON.parse(JSON.stringify(initialData)) : { ...DEFAULT_HW_DATA };
        if (!base.levels || base.levels.length === 0) base.levels = [{ instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '', dnbSection: 'docs', dnbSubject: 'histoire' }];
        base.levels = base.levels.map((lvl) => ({
            dnbSection: 'docs',
            dnbSubject: 'histoire',
            responseMode: 'text',
            instructionUrls: [],
            attachmentUrls: [],
            aiHintUrls: [],
            ...lvl
        }));
        base.mode = base.mode || 'docs';
        base.promptTopic = base.promptTopic || '';
        base.minTimeMinutes = Number(base.minTimeMinutes || 25);
        base.didakbotUrl = base.didakbotUrl || '';
        base.didakbotBotId = base.didakbotBotId || '';
        base.didakbotClassBots = Array.isArray(base.didakbotClassBots) ? base.didakbotClassBots : [];
        base.didakbotAssignments = Array.isArray(base.didakbotAssignments) ? base.didakbotAssignments : [];
        if (!base.date) {
            const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
            base.date = tomorrow.toISOString().split('T')[0];
        } else base.date = base.date.split('T')[0];
        return base;
    });

    const [activeLevelIdx, setActiveLevelIdx] = useState(0);

    // 2. DONNÉES CONTEXTUELLES (Robustesse)
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    
    // 3. ÉTATS DISTRIBUTION
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState(globalClass || "");
    const [studentSearch, setStudentSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [previewAsset, setPreviewAsset] = useState(null);
    const [previewAsImage, setPreviewAsImage] = useState(true);
    const [dragDocIndex, setDragDocIndex] = useState(null);
    const [dropDocIndex, setDropDocIndex] = useState(null);
    
    const fileInputRef = useRef(null);
    const uploadTypeRef = useRef(null);
    const [uploadType, setUploadType] = useState(null);

    const [creatorKey, setCreatorKey] = useState(() => {
        return user?.didakbotKey || (typeof window !== 'undefined' ? window.localStorage.getItem('conda_didakbot_key') : '') || '';
    });
    const [keySaved, setKeySaved] = useState(false);
    const [didakbotCreating, setDidakbotCreating] = useState(false);
    const [didakbotCreateError, setDidakbotCreateError] = useState('');
    const [didakbotCreateSuccess, setDidakbotCreateSuccess] = useState('');

    const handleSaveCreatorKey = async (val) => {
        const clean = String(val || '').trim().toUpperCase();
        setCreatorKey(clean);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem('conda_didakbot_key', clean);
        }
        const userId = user?.id || user?._id;
        if (userId) {
            try {
                await fetch(`/api/admin/teachers/${userId}/didakbot-key`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: clean })
                });
                if (user) user.didakbotKey = clean;
                setKeySaved(true);
                setTimeout(() => setKeySaved(false), 2500);
            } catch (_) {}
        }
    };

    const handleCreateDidakbot = async () => {
        const cleanKey = String(creatorKey || '').trim().toUpperCase();
        if (!cleanKey) {
            setDidakbotCreateError("Saisissez d'abord votre clé créateur Didak'bot.");
            return;
        }
        if (!selectedClassNames.length) {
            setDidakbotCreateError('Sélectionnez au moins une classe avant de créer les chatbots.');
            return;
        }

        setDidakbotCreating(true);
        setDidakbotCreateError('');
        setDidakbotCreateSuccess('');
        const selectedClassKeys = new Set(selectedClassNames.map(normalizeClassName));
        let createdBots = (formData.didakbotClassBots || [])
            .filter(bot => selectedClassKeys.has(normalizeClassName(bot.className)));
        try {
            const level = formData.levels?.[activeLevelIdx] || {};
            const instructions = [
                "Tu es un assistant pédagogique bienveillant. Guide l'élève par des questions et des indices, sans rédiger le devoir complet à sa place.",
                formData.title ? `Sujet du devoir : ${formData.title}` : '',
                formData.content ? `Consigne principale : ${formData.content}` : '',
                level.instruction ? `Consignes complémentaires : ${level.instruction}` : '',
                level.aiHints ? `Pistes pédagogiques : ${level.aiHints}` : ''
            ].filter(Boolean).join('\n\n');
            const normalizeName = (value) => normalizeClassName(value);
            for (const className of selectedClassNames) {
                const existing = createdBots.find(bot => normalizeName(bot.className) === normalizeName(className) && bot.chatbotId && bot.shareLink);
                if (existing) continue;

                const classDistribution = distribution[className] || {};
                const subsetIds = new Set((classDistribution.studentIds || []).map(String));
                const classStudentCount = allStudents.filter(student => {
                    const studentClass = normalizeName(student.currentClass || student.className || student.classroom || '');
                    if (studentClass !== normalizeName(className)) return false;
                    return subsetIds.size === 0 || subsetIds.has(String(student._id || student.id || ''));
                }).length;
                const effectiveStudentCount = Math.max(classStudentCount, subsetIds.size);
                const botName = `${String(formData.title || 'Assistant pédagogique').trim()} — ${className}`.slice(0, 80);
                const botConfig = {
                    user_key: cleanKey,
                    share_link: null,
                    name: botName,
                    welcome_message: `Bonjour ! Je suis le tuteur du devoir « ${formData.title || botName} » pour la classe ${className}. Comment puis-je t'aider à avancer ?`,
                    role: 'Assistant pédagogique',
                    image_url: '',
                    target_audience: className,
                    expertise_domain: String(formData.promptTopic || '').trim(),
                    system_prompt: `${instructions}\n\nClasse concernée : ${className}.`,
                    pedagogical_approach: 'Méthode socratique : guider par des questions et des indices, puis aider à vérifier les arguments.',
                    behavioral_rules: 'Être bienveillant, précis et rigoureux. Ne pas fournir directement un devoir complet à rendre.',
                    knowledge_limits: 'Rester dans le sujet et les consignes de ce devoir. Signaler les incertitudes.',
                    verbosity: 'normal',
                    max_lines: '10',
                    is_collaborative: false,
                    language: 'Français',
                    model: 'mistralai/Mistral-Small-3.2-24B-Instruct-2506',
                    track_conversations: true,
                    max_sessions: String(Math.max(30, effectiveStudentCount + 5)),
                    allow_student_files: false,
                    context_only: false,
                    accessibility_buttons: true
                };
                const response = await fetch('https://novapeda.eu/didakbot3.php?page=create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                    body: new URLSearchParams({ action: 'save_chatbot', data: JSON.stringify(botConfig) })
                });
                const result = await response.json();
                if (!response.ok || result?.success !== true || !result?.chatbot_id || !result?.share_link) {
                    throw new Error(result?.error || result?.message || `Didak'bot n'a pas confirmé la création pour ${className}.`);
                }
                const bot = {
                    className,
                    chatbotId: Number(result.chatbot_id),
                    shareLink: String(result.share_link),
                    url: `https://novapeda.eu/didakbot3.php?bot=${encodeURIComponent(result.share_link)}&iframe=1`
                };
                createdBots = [...createdBots.filter(item => normalizeName(item.className) !== normalizeName(className)), bot];
                setFormData(current => ({
                    ...current,
                    didakbotClassBots: createdBots,
                    didakbotUrl: createdBots[0]?.url || bot.url,
                    didakbotBotId: String(createdBots[0]?.chatbotId || bot.chatbotId)
                }));
            }
            setFormData(current => ({
                ...current,
                didakbotClassBots: createdBots,
                didakbotUrl: createdBots[0]?.url || current.didakbotUrl,
                didakbotBotId: String(createdBots[0]?.chatbotId || current.didakbotBotId || '')
            }));
            setDidakbotCreateSuccess(`${createdBots.length} chatbot(s), un par classe, prêts. Enregistrez le devoir pour attribuer les sessions aux élèves.`);
        } catch (error) {
            setDidakbotCreateError(error?.message || "Impossible de créer le chatbot Didak'bot.");
        } finally {
            setDidakbotCreating(false);
        }
    };

    // 4. CHARGEMENT DE SECOURS (Si les props sont vides)
    useEffect(() => {
        const initDistribution = () => {
            if (initialData && initialData.targetClassrooms) {
                const dist = {};
                initialData.targetClassrooms.forEach(clsName => {
                    dist[clsName] = {
                        chapterId: initialData.chapterId || "",
                        studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
                    };
                });
                setDistribution(dist);
                if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
            }
        };

        if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
            setLoading(true);
            Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')])
                .then(([sts, cls]) => {
                    setAllStudents(sts || []);
                    setAllClasses(cls || []);
                    initDistribution();
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        } else {
            initDistribution();
        }
    }, []);

    // 5. HANDLERS
    const handleInput = (f, v) => setFormData(p => ({ ...p, [f]: v }));
    const selectedClassNames = Object.keys(distribution || {});
    const canMarkDnb = selectedClassNames.some(isTroisiemeClass);
    const canMarkSecondeTraining = selectedClassNames.some(isSecondeClass);
    const assessmentLabel = formData.assessmentKind === 'dnb'
        ? 'DNB'
        : formData.assessmentKind === 'rqp'
            ? 'RQP'
            : formData.assessmentKind === 'commentaire'
                ? 'Commentaire'
                : 'Devoir classique';
    const handleLevelInput = (idx, f, v) => {
        const lvls = [...formData.levels];
        lvls[idx][f] = v;
        setFormData(p => ({ ...p, levels: lvls }));
    };
    const handleAddLevel = () => {
        setFormData(prev => ({ ...prev, levels: [...prev.levels, { instruction: '', instructionUrls: [], attachmentUrls: [], aiHints: '', aiHintUrls: [], responseMode: 'text', dnbSection: 'docs', dnbSubject: 'histoire' }] }));
        setActiveLevelIdx(formData.levels.length); 
    };
    const handleRemoveLevel = (e, idx) => {
        e.stopPropagation();
        if (formData.levels.length === 1) return alert("Il faut au moins une question.");
        if (!confirm("Supprimer cette question ?")) return;
        const newLevels = formData.levels.filter((_, i) => i !== idx);
        setFormData(prev => ({ ...prev, levels: newLevels }));
        setActiveLevelIdx(prev => Math.min(prev, newLevels.length - 1));
    };
    const updateCurrentLevel = (field, value) => {
        const newLevels = [...formData.levels];
        const nextLevel = { ...newLevels[activeLevelIdx], [field]: value };
        if (field === 'dnbSection' && value === 'emc') nextLevel.dnbSubject = 'emc';
        if (field === 'dnbSection' && value !== 'emc' && String(nextLevel.dnbSubject || '') === 'emc') nextLevel.dnbSubject = 'histoire';
        newLevels[activeLevelIdx] = nextLevel;
        setFormData(prev => ({ ...prev, levels: newLevels }));
    };
    const triggerUpload = (type) => {
        uploadTypeRef.current = type;
        setUploadType(type);
        if (fileInputRef.current) {
            fileInputRef.current.multiple = type === 'docs' || type === 'sheet';
            fileInputRef.current.click();
        }
    };
    const uploadHomeworkFiles = async (files, type) => {
        const list = Array.from(files || []).filter(Boolean);
        if (list.length === 0) return;
        const currentUploadType = type || uploadTypeRef.current || uploadType || 'docs';
        setLoading(true);
        const fd = new FormData();
        list.forEach((f, index) => {
            const file = f instanceof File
                ? f
                : new File([f], `image-collee-${Date.now()}-${index}.png`, { type: f.type || 'image/png' });
            fd.append('files', file);
        });
        try {
            const res = await fetch('/api/homework/upload', { method: 'POST', body: fd }).then(r => r.json());
            if (res.urls && res.urls.length > 0) {
                if (currentUploadType === 'sheet') updateCurrentLevel('instructionUrls', [...(formData.levels[activeLevelIdx].instructionUrls || []), ...res.urls]);
                else if (currentUploadType === 'correction') updateCurrentLevel('aiHintUrls', [...(formData.levels[activeLevelIdx].aiHintUrls || []), ...res.urls]);
                else updateCurrentLevel('attachmentUrls', [...(formData.levels[activeLevelIdx].attachmentUrls || []), ...res.urls]);
            }
        } catch(err) {
            alert("Erreur Upload");
        } finally {
            setLoading(false);
            uploadTypeRef.current = null;
        }
    };
    const handlePasteUpload = async (event, type = 'docs') => {
        const items = Array.from(event.clipboardData?.items || []);
        const files = items
            .filter((item) => String(item.type || '').startsWith('image/'))
            .map((item, index) => {
                const file = item.getAsFile();
                if (!file) return null;
                const ext = String(file.type || '').includes('jpeg') ? 'jpg' : 'png';
                return new File([file], `image-collee-${Date.now()}-${index}.${ext}`, { type: file.type || 'image/png' });
            })
            .filter(Boolean);
        if (files.length === 0) return;
        event.preventDefault();
        event.stopPropagation();
        await uploadHomeworkFiles(files, type);
    };
    const handleFileChange = async (e) => {
        const files = e.target.files; if (!files || files.length === 0) return;
        await uploadHomeworkFiles(files, uploadTypeRef.current || uploadType);
        e.target.value = "";
    };
    const removeAttachment = (type, urlIdx) => {
        if (type === 'sheet') {
            const current = formData.levels[activeLevelIdx].instructionUrls || [];
            updateCurrentLevel('instructionUrls', Number.isFinite(urlIdx) ? current.filter((_, i) => i !== urlIdx) : []);
        }
        else if (type === 'correction') {
            const current = formData.levels[activeLevelIdx].aiHintUrls || [];
            updateCurrentLevel('aiHintUrls', Number.isFinite(urlIdx) ? current.filter((_, i) => i !== urlIdx) : []);
        }
        else updateCurrentLevel('attachmentUrls', formData.levels[activeLevelIdx].attachmentUrls.filter((_, i) => i !== urlIdx));
    };
    const moveAttachment = (fromIndex, toIndex) => {
        const list = [...formData.levels[activeLevelIdx].attachmentUrls];
        if (toIndex < 0 || toIndex >= list.length) return;
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        updateCurrentLevel('attachmentUrls', list);
    };
    const handleDocDragStart = (e, index) => {
        setDragDocIndex(index);
        setDropDocIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(index));
    };
    const handleDocDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dropDocIndex !== index) setDropDocIndex(index);
    };
    const handleDocDrop = (e, index) => {
        e.preventDefault();
        if (dragDocIndex !== null && dragDocIndex !== index) {
            moveAttachment(dragDocIndex, index);
        }
        setDragDocIndex(null);
        setDropDocIndex(null);
    };
    const handleDocDragEnd = () => {
        setDragDocIndex(null);
        setDropDocIndex(null);
    };

    const openPreview = (url, label) => {
        setPreviewAsImage(true);
        setPreviewAsset({ url, label });
    };
    const closePreview = () => setPreviewAsset(null);

    // 6. SAUVEGARDE GROUPÉE
    const handleSave = async () => {
        const targets = Object.keys(distribution);
        if (!formData.title || targets.length === 0) return alert("❌ Titre et au moins une Classe requis !");
        if (formData.mode === 'redaction' && !String(formData.promptTopic || '').trim()) {
            return alert("❌ Veuillez saisir le sujet de la rédaction !");
        }
        
        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls];
                if (!cfg.chapterId) return; 
                
                const isAllClass = cfg.studentIds.length === 0;
                const key = `${cfg.chapterId}_${isAllClass ? 'ALL' : 'SUBSET_' + cfg.studentIds.sort().join('-')}`;
                
                if (!groups[key]) {
                    groups[key] = {
                        chapterId: cfg.chapterId,
                        classrooms: [],
                        assignedStudents: cfg.studentIds,
                        isAllClass: isAllClass
                    };
                }
                groups[key].classrooms.push(cls);
            });

            const classBots = Array.isArray(formData.didakbotClassBots) && formData.didakbotClassBots.length
                ? formData.didakbotClassBots
                : (formData.didakbotUrl && formData.didakbotBotId
                    ? [{ className: selectedClassNames[0] || '', chatbotId: Number(formData.didakbotBotId), url: formData.didakbotUrl }]
                    : []);
            const sessionsByBot = new Map();
            if (classBots.length && !formData.isPunishment) {
                if (!creatorKey) throw new Error("Pour attribuer un chat par élève, renseignez la clé créateur Didak'bot.");
                for (const bot of classBots) {
                    const botId = Number(bot.chatbotId);
                    if (!Number.isInteger(botId) || botId <= 0) throw new Error(`L'identifiant Didak'bot de ${bot.className || 'la classe'} est invalide.`);
                    const didakbotResponse = await fetch('https://novapeda.eu/didakbot3.php?page=manage', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({ action: 'get_conversations', chatbot_id: String(botId), user_key: creatorKey })
                    });
                    const didakbotData = await didakbotResponse.json();
                    if (!didakbotResponse.ok || didakbotData?.success !== true || !Array.isArray(didakbotData.sessions)) {
                        throw new Error(`Didak'bot n'a pas renvoyé les sessions pour ${bot.className || botId}. Vérifiez la clé et l'identifiant du bot.`);
                    }
                    const assignedCodes = new Set((formData.didakbotAssignments || [])
                        .filter(item => Number(item.chatbotId) === botId)
                        .map(item => String(item.sessionCode || '')));
                    sessionsByBot.set(botId, {
                        available: didakbotData.sessions.filter(session => Number(session.message_count || 0) === 0 && !session.last_activity && session.session_code && !assignedCodes.has(String(session.session_code))),
                        cursor: 0,
                        className: bot.className
                    });
                }
            }

            for (const key of Object.keys(groups)) {
                const grp = groups[key];
                const payload = {
                    ...formData,
                    chapterId: grp.chapterId,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.assignedStudents,
                    isAllClass: grp.isAllClass,
                    teacherId: user.id || user._id
                };
                if (classBots.length && !formData.isPunishment) {
                    const classNames = new Set(grp.classrooms.map(normalizeClassName));
                    const selectedIds = new Set((grp.assignedStudents || []).map(String));
                    const recipients = allStudents.filter(student => {
                        const id = String(student?._id || student?.id || '');
                        if (!id) return false;
                        if (!grp.isAllClass) return selectedIds.has(id);
                        const studentClass = normalizeClassName(student.currentClass || student.className || student.classroom || '');
                        return classNames.has(studentClass);
                    });
                    if (recipients.length === 0) {
                        throw new Error(`Aucun élève trouvé pour ${grp.classrooms.join(', ')}. Impossible d'attribuer les chats.`);
                    }
                    const existingByStudent = new Map((formData.didakbotAssignments || []).map(item => [String(item.studentId), item]));
                    payload.didakbotClassBots = classBots;
                    payload.didakbotBotId = Number(classBots[0].chatbotId);
                    payload.didakbotUrl = classBots[0].url || formData.didakbotUrl;
                    payload.didakbotAssignments = recipients.map(student => {
                        const studentId = String(student._id || student.id);
                        const studentClassName = normalizeClassName(student.currentClass || student.className || student.classroom || (grp.classrooms.length === 1 ? grp.classrooms[0] : ''));
                        const bot = classBots.find(item => normalizeClassName(item.className) === studentClassName)
                            || (classBots.length === 1 ? classBots[0] : null);
                        if (!bot) throw new Error(`Aucun chatbot n'est associé à la classe de ${student.fullName || student.name || studentId}.`);
                        const botId = Number(bot.chatbotId);
                        const existing = existingByStudent.get(studentId);
                        if (existing?.sessionCode && Number(existing.chatbotId) === botId) return existing;
                        const botSessions = sessionsByBot.get(botId);
                        const session = botSessions?.available?.[botSessions.cursor++];
                        if (!session) throw new Error(`Il n'y a pas assez de sessions vides sur le bot ${bot.className || botId} pour tous les élèves de cette classe.`);
                        const studentName = String(student.fullName || student.name || `${student.firstName || student.prenom || ''} ${student.lastName || student.nom || ''}`.trim() || 'Élève').trim();
                        return {
                            studentId,
                            studentName,
                            sessionId: Number(session.id),
                            sessionCode: String(session.session_code),
                            chatbotId: botId,
                            className: bot.className || studentClassName
                        };
                    });
                }
                if (payload.mode === 'redaction') {
                    payload.levels = [{
                        instruction: String(payload.promptTopic || '').trim(),
                        instructionUrls: [],
                        attachmentUrls: [],
                        aiHints: '',
                        aiHintUrls: [],
                        responseMode: 'text',
                        dnbSection: 'paragraphe',
                        dnbSubject: 'histoire'
                    }];
                }
                if (formData.isPunishment) {
                    // Une punition est un template ciblé par classe:
                    // elle ne doit jamais être publiée en "classe entière" classique.
                    payload.isAllClass = false;
                    payload.assignedStudents = [];
                }
                if (formData._id && key === Object.keys(groups)[0]) { /* update */ } else { delete payload._id; }
                await api.post('/homework', payload); 
            }
            onClose();
        } catch(e) { alert("Erreur sauvegarde: " + e.message); }
        setLoading(false);
    };

    const currentLvl = formData.levels[activeLevelIdx];

    return (
        <div className="v84-hw-container">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} />
            <div className="v84-hw-header">
                <div className="flex items-center gap-3"><span className="text-3xl">📝</span><input className="v84-hw-title-input" value={formData.title} onChange={e => handleInput('title', e.target.value)} placeholder="TITRE DU DEVOIR..." autoFocus /></div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{assessmentLabel}</span>
                    <label className="text-[10px] font-black uppercase text-red-500 flex items-center gap-2 cursor-pointer bg-red-50 px-3 py-1 rounded-lg border border-red-100"><input type="checkbox" checked={formData.isPunishment} onChange={e => handleInput('isPunishment', e.target.checked)} />Punition</label>
                    <input type="date" className="v84-hw-date-input" value={formData.date} onChange={e => handleInput('date', e.target.value)} />
                    <button onClick={onClose} className="v84-close-btn">✕</button>
                </div>
            </div>

            <div className="v84-hw-body">
                <div className="v84-hw-editor custom-scrollbar">
                    {/* SÉLECTEUR DE FORMAT : DOCS vs RÉDACTION */}
                    <div className="mb-4 p-3.5 rounded-2xl border border-indigo-200 bg-indigo-50/70 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <span className="text-2xl">🎛️</span>
                            <div>
                                <div className="text-xs font-black uppercase text-indigo-950 tracking-wider">Format du devoir</div>
                                <div className="text-[11px] font-medium text-slate-500">Choisissez entre l'analyse documentaire multi-questions ou la rédaction argumentée.</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                className={`px-4 py-2 rounded-xl text-xs font-black transition ${formData.mode !== 'redaction' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                                onClick={() => handleInput('mode', 'docs')}
                            >
                                📄 Documents & Questions (Docs)
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 rounded-xl text-xs font-black transition ${formData.mode === 'redaction' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'}`}
                                onClick={() => handleInput('mode', 'redaction')}
                            >
                                ✍️ Rédaction & Sujet Libre
                            </button>
                        </div>
                    </div>

                    {/* CONFIGURATION DIDAK'BOT (Tuteur IA sans coût API) */}
                    <div className="mb-4 p-4 rounded-3xl border border-cyan-200 bg-gradient-to-r from-cyan-50/70 via-sky-50/50 to-indigo-50/60 shadow-sm space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🤖</span>
                                <div>
                                    <div className="text-xs font-black uppercase text-cyan-950 tracking-wider flex items-center gap-2">
                                        <span>Assistant Tuteur Didak'bot 3</span>
                                        <span className="text-[10px] bg-cyan-100 text-cyan-800 font-bold px-2 py-0.5 rounded-full border border-cyan-300">0 € Coût API · NovaPéda</span>
                                    </div>
                                    <div className="text-[11px] font-medium text-slate-500">
                                        Proposez à vos élèves un chatbot tuteur calibré avec vos consignes pédagogiques.
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleCreateDidakbot}
                                    disabled={didakbotCreating || !creatorKey}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 disabled:opacity-50 text-white font-black text-xs shadow-sm transition"
                                >
                                    {didakbotCreating ? 'Création en cours…' : '✨ Créer le chatbot depuis ce devoir'}
                                </button>
                                <a
                                    href="https://novapeda.eu/didakbot3.php"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white hover:bg-cyan-50 border border-cyan-300 text-cyan-900 font-black text-xs shadow-sm transition"
                                >
                                    <span>Ouvrir Didak'bot 3</span>
                                    <span className="text-[10px]">↗</span>
                                </a>
                            </div>
                        </div>

                        {/* CLÉ CRÉATEUR ENSEIGNANT (MODIFIABLE & COLLABLE) */}
                        <div className="flex items-center justify-between flex-wrap gap-2.5 p-3 rounded-2xl bg-cyan-100/80 border border-cyan-300">
                            <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                                <span className="text-base">🔑</span>
                                <label className="text-xs font-black text-cyan-950 uppercase tracking-wider whitespace-nowrap">
                                    Votre clé créateur :
                                </label>
                                <input
                                    type="text"
                                    className="flex-1 max-w-xs px-3 py-1.5 rounded-xl border border-cyan-300 bg-white font-mono font-black text-cyan-900 text-xs tracking-wider uppercase focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                    placeholder="Collez votre clé (ex: K2L6SK8B)"
                                    value={creatorKey}
                                    onChange={(e) => {
                                        const val = e.target.value.toUpperCase();
                                        setCreatorKey(val);
                                        handleSaveCreatorKey(val);
                                    }}
                                    onPaste={(e) => {
                                        const pasted = e.clipboardData.getData('text');
                                        if (pasted) {
                                            e.preventDefault();
                                            const clean = pasted.trim().toUpperCase();
                                            setCreatorKey(clean);
                                            handleSaveCreatorKey(clean);
                                        }
                                    }}
                                />
                                {keySaved && <span className="text-[11px] font-bold text-emerald-700 animate-fadeIn">✓ Mémorisée !</span>}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        try {
                                            const text = await navigator.clipboard.readText();
                                            if (text) {
                                                const clean = text.trim().toUpperCase();
                                                setCreatorKey(clean);
                                                handleSaveCreatorKey(clean);
                                            }
                                        } catch (_) {
                                            const p = window.prompt("Collez votre clé Didak'bot ici :", creatorKey);
                                            if (p !== null) {
                                                const clean = p.trim().toUpperCase();
                                                setCreatorKey(clean);
                                                handleSaveCreatorKey(clean);
                                            }
                                        }
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-cyan-50 text-cyan-900 text-xs font-black border border-cyan-300 shadow-sm transition flex items-center gap-1"
                                    title="Coller depuis le presse-papier"
                                >
                                    <span>📋</span>
                                    <span>Coller</span>
                                </button>
                                {creatorKey && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            try {
                                                await navigator.clipboard.writeText(creatorKey);
                                                alert(`Clé ${creatorKey} copiée !`);
                                            } catch (_) {}
                                        }}
                                        className="px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-black shadow-sm transition"
                                        title="Copier la clé dans le presse-papier"
                                    >
                                        Copier
                                    </button>
                                )}
                            </div>
                        </div>

                        {(didakbotCreateError || didakbotCreateSuccess) && (
                            <div
                                role="status"
                                className={`rounded-xl border px-3 py-2 text-xs font-bold ${didakbotCreateError ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}
                            >
                                {didakbotCreateError || didakbotCreateSuccess}
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-black uppercase text-cyan-950 tracking-wider">
                                Lien de partage ou code d'intégration iframe du Didak'bot (Optionnel) :
                            </label>
                            <input
                                type="text"
                                className="w-full px-3.5 py-2 rounded-xl border border-cyan-200 bg-white font-medium text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition outline-none text-xs"
                                placeholder="Ex : https://novapeda.eu/... ou collez le code <iframe src='...'></iframe>"
                                value={formData.didakbotUrl || ''}
                                onChange={(e) => {
                                    let val = e.target.value.trim();
                                    const match = val.match(/src=["'](.*?)["']/);
                                    if (match && match[1]) val = match[1];
                                    handleInput('didakbotUrl', val);
                                }}
                            />
                            <label className="block text-[11px] font-black uppercase text-cyan-950 tracking-wider pt-2">
                                Identifiant numérique du bot Didak'bot
                                <input
                                    type="number"
                                    min="1"
                                    className="mt-1 w-full px-3.5 py-2 rounded-xl border border-cyan-200 bg-white font-mono font-bold text-slate-800 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition outline-none text-xs"
                                    placeholder="Ex. 4970"
                                    value={formData.didakbotBotId || ''}
                                    onChange={(e) => handleInput('didakbotBotId', e.target.value)}
                                />
                            </label>
                            <div className="flex items-center justify-between text-[11px] text-slate-500">
                                <span>💡 L'ID permet d'attribuer une session vide à chaque élève ; son chat s'ouvrira avec son pseudo CondaWeb.</span>
                                {formData.didakbotUrl && (
                                    <button
                                        type="button"
                                        onClick={() => handleInput('didakbotUrl', '')}
                                        className="text-red-500 hover:underline font-bold text-[10px]"
                                    >
                                        Retirer le chatbot ✕
                                    </button>
                                )}
                            </div>
                            {formData.didakbotClassBots.length > 0 && (
                                <div className="rounded-2xl border border-cyan-200 bg-white p-3 space-y-1.5">
                                    <div className="text-[11px] font-black uppercase tracking-wider text-cyan-950">Chatbots par classe</div>
                                    {formData.didakbotClassBots.map(bot => (
                                        <div key={`${bot.className}-${bot.chatbotId}`} className="flex items-center justify-between gap-2 text-xs">
                                            <span className="font-bold text-slate-700">{bot.className}</span>
                                            <span className="font-mono text-slate-500">ID {bot.chatbotId}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {formData.didakbotAssignments.length > 0 && (
                                <div className="mt-3 rounded-2xl border border-cyan-200 bg-white p-3 space-y-2">
                                    <div className="text-[11px] font-black uppercase tracking-wider text-cyan-950">
                                        Sessions élèves — accès prof
                                    </div>
                                    {formData.didakbotAssignments.map((assignment) => {
                                        const chatUrl = `https://novapeda.eu/didakbot3.php?session=${encodeURIComponent(assignment.sessionCode || '')}&pseudo=${encodeURIComponent(assignment.studentName || 'Élève')}`;
                                        return (
                                            <div key={`${assignment.studentId}-${assignment.sessionCode}`} className="flex items-center justify-between gap-3 rounded-xl bg-cyan-50 px-3 py-2">
                                                <div className="min-w-0">
                                                    <div className="truncate text-xs font-bold text-slate-800">{assignment.studentName || 'Élève'}</div>
                                                    <div className="font-mono text-[10px] text-slate-500">Session : {assignment.sessionCode}</div>
                                                </div>
                                                <a
                                                    href={chatUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shrink-0 rounded-lg bg-cyan-700 px-3 py-2 text-[10px] font-black text-white hover:bg-cyan-800"
                                                    title={`Ouvrir la session Didak'bot de ${assignment.studentName || 'cet élève'}`}
                                                >
                                                    Ouvrir le chat ↗
                                                </a>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {formData.mode === 'redaction' ? (
                        <div className="v84-hw-card bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                                    📌 Sujet de la Rédaction (Énoncé / Consigne principale)
                                </label>
                                <textarea
                                    className="w-full h-44 p-4 rounded-2xl border border-slate-200 bg-slate-50 font-medium text-slate-800 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition outline-none resize-y text-sm leading-relaxed"
                                    placeholder="Exemple : Dans un développement argumenté d'une vingtaine de lignes, expliquez le fonctionnement de la démocratie athénienne au Ve siècle av. J.-C. et ses limites..."
                                    value={formData.promptTopic || ''}
                                    onChange={(e) => handleInput('promptTopic', e.target.value)}
                                />
                            </div>

                            <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70">
                                <div className="flex items-start justify-between flex-wrap gap-4">
                                    <div className="flex items-start gap-2.5 max-w-lg">
                                        <span className="text-2xl mt-0.5">⏱️</span>
                                        <div>
                                            <div className="text-xs font-black uppercase text-amber-950 tracking-wider">
                                                Temps minimum indicatif attendu (anti-vitesse / anti-triche)
                                            </div>
                                            <p className="text-[11px] text-amber-900/80 mt-1 leading-relaxed">
                                                Si l'élève tente de valider avant ce seuil, un message lui indiquera son temps de travail (<em>« C'est un peu court... es-tu sûr(e) d'avoir terminé ? »</em>) et l'invitera à relire et enrichir ses arguments. Un rendu expédié sera également signalé dans votre correction.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {[15, 25, 40, 50].map((mins) => (
                                            <button
                                                key={mins}
                                                type="button"
                                                className={`px-3.5 py-2 rounded-xl text-xs font-black transition ${Number(formData.minTimeMinutes) === mins ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-950 border border-amber-200 hover:bg-amber-100/60'}`}
                                                onClick={() => handleInput('minTimeMinutes', mins)}
                                            >
                                                {mins} min
                                            </button>
                                        ))}
                                        <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-xl border border-amber-200">
                                            <input
                                                type="number"
                                                min="5"
                                                max="180"
                                                className="w-14 text-center text-xs font-black text-amber-950 outline-none"
                                                value={formData.minTimeMinutes || 25}
                                                onChange={(e) => handleInput('minTimeMinutes', Math.max(5, parseInt(e.target.value, 10) || 5))}
                                            />
                                            <span className="text-[11px] font-bold text-slate-400">min</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-[12px] text-slate-600 space-y-1.5">
                                <div className="font-black text-slate-800 uppercase tracking-wide text-[11px]">🛡️ Sécurité & IA en mode Rédaction</div>
                                <div>• <strong>Chronomètre actif :</strong> plus d'alerte anxiogène de perte de focus (adapté au volet <em>Demander à Gemini</em> dans Chrome).</div>
                                <div>• <strong>Anti copier-coller :</strong> collage externe désactivé sur la copie et le brouillon pour forcer la saisie manuelle.</div>
                                <div>• <strong>Brouillon persistant avec notes IA :</strong> l'élève copie son travail pour l'IA, reçoit les pistes et doit noter ses remarques dans son brouillon avant sa prochaine tentative.</div>
                                <div>• <strong>Audit final :</strong> à la validation, l'élève colle son historique d'échange avec l'IA pour transmission au correcteur.</div>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="mb-4 p-3 rounded-2xl border border-slate-200 bg-white flex flex-wrap items-center gap-2">
                                <div className="text-[11px] font-black uppercase text-slate-400 mr-2">Type d'entraînement</div>
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${formData.assessmentKind === '' ? 'bg-slate-900 text-white' : ''}`}
                                    onClick={() => handleInput('assessmentKind', '')}
                                >
                                    Devoir classique
                                </button>
                                {canMarkDnb && (
                                    <button
                                        type="button"
                                        className={`v84-res-btn upload ${formData.assessmentKind === 'dnb' ? 'bg-violet-600 text-white border-violet-700' : ''}`}
                                        onClick={() => handleInput('assessmentKind', 'dnb')}
                                    >
                                        Définir en DNB
                                    </button>
                                )}
                                {canMarkSecondeTraining && (
                                    <>
                                        <button
                                            type="button"
                                            className={`v84-res-btn upload ${formData.assessmentKind === 'rqp' ? 'bg-blue-600 text-white border-blue-700' : ''}`}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    assessmentKind: 'rqp',
                                                    mode: 'redaction',
                                                    promptTopic: prev.promptTopic || prev.levels?.[0]?.instruction || ''
                                                }));
                                            }}
                                        >
                                            Définir en RQP
                                        </button>
                                        <button
                                            type="button"
                                            className={`v84-res-btn upload ${formData.assessmentKind === 'commentaire' ? 'bg-emerald-600 text-white border-emerald-700' : ''}`}
                                            onClick={() => {
                                                setFormData(prev => ({
                                                    ...prev,
                                                    assessmentKind: 'commentaire',
                                                    mode: 'redaction',
                                                    promptTopic: prev.promptTopic || prev.levels?.[0]?.instruction || ''
                                                }));
                                            }}
                                        >
                                            Définir en commentaire
                                        </button>
                                    </>
                                )}
                                {!canMarkDnb && !canMarkSecondeTraining && (
                                    <span className="text-[11px] font-bold text-slate-400">Sélectionne une classe de 3e ou de 2de pour afficher les marquages spéciaux.</span>
                                )}
                            </div>
                    <div className="hw-level-tabs">
                        {formData.levels.map((lvl, idx) => (<div key={idx} onClick={() => setActiveLevelIdx(idx)} className={`hw-tab-btn ${activeLevelIdx === idx ? 'active' : ''}`}><span>Question {idx + 1}</span>{formData.levels.length > 1 && (<span className="hw-tab-delete" onClick={(e) => handleRemoveLevel(e, idx)}>✕</span>)}</div>))}
                        <button className="hw-tab-add" onClick={handleAddLevel}>+</button>
                    </div>
                    <div className="v84-hw-card">
                        {formData.assessmentKind === 'dnb' && (
                            <div className="rounded-2xl border border-violet-100 bg-violet-50 p-3">
                                <div className="hw-section-title">Classement brevet de cette partie</div>
                                <div className="flex flex-wrap gap-3 items-end">
                                    <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                        Exercice
                                        <select
                                            className="v84-hw-date-input bg-white"
                                            value={currentLvl.dnbSection || 'docs'}
                                            onChange={(e) => updateCurrentLevel('dnbSection', e.target.value)}
                                        >
                                            {DNB_SECTION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                    </label>
                                    {String(currentLvl.dnbSection || 'docs') === 'emc' ? (
                                        <div className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                            Matière
                                            <div className="v84-hw-date-input bg-white flex items-center">EMC</div>
                                        </div>
                                    ) : (
                                        <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                            Matière
                                            <select
                                                className="v84-hw-date-input bg-white"
                                                value={['histoire', 'geo'].includes(String(currentLvl.dnbSubject || '')) ? currentLvl.dnbSubject : 'histoire'}
                                                onChange={(e) => updateCurrentLevel('dnbSubject', e.target.value)}
                                            >
                                                {DNB_SUBJECT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                            </select>
                                        </label>
                                    )}
                                    <label className="flex flex-col gap-1 text-[10px] font-black uppercase text-violet-500">
                                        Total points
                                        <input
                                            type="number"
                                            min="1"
                                            step="0.5"
                                            className="v84-hw-date-input bg-white"
                                            value={currentLvl.maxPoints ?? ''}
                                            placeholder="ex: 8"
                                            onChange={(e) => updateCurrentLevel('maxPoints', e.target.value === '' ? '' : Number(e.target.value))}
                                        />
                                    </label>
                                    <div className="text-[11px] font-bold text-violet-500">
                                        Sert à ranger cette question dans l'onglet Brevet élève. Le total points est prioritaire pour la correction IA.
                                    </div>
                                </div>
                            </div>
                        )}
                        <div>
                            <div className="hw-section-title">Type de page</div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${String(currentLvl.responseMode || 'text') !== 'fill' ? 'bg-slate-900 text-white' : ''}`}
                                    onClick={() => updateCurrentLevel('responseMode', 'text')}
                                >
                                    Question classique
                                </button>
                                <button
                                    type="button"
                                    className={`v84-res-btn upload ${String(currentLvl.responseMode || '') === 'fill' ? 'bg-violet-600 text-white border-violet-700' : ''}`}
                                    onClick={() => updateCurrentLevel('responseMode', 'fill')}
                                >
                                    Page à remplir
                                </button>
                            </div>
                            {String(currentLvl.responseMode || '') === 'fill' && (
                                <div className="mt-2 text-[11px] font-bold text-violet-600 bg-violet-50 border border-violet-100 rounded-xl px-3 py-2">
                                    Pour une page DNB à compléter, dépose l'image de la page dans “Fiche Question”.
                                    L'élève pourra ajouter des carrés texte sur l'image.
                                </div>
                            )}
                        </div>
                        <div><div className="hw-section-title">Consigne textuelle</div><textarea className="v84-hw-textarea custom-scrollbar" placeholder="Écrivez votre question ou consigne ici..." value={currentLvl.instruction} onChange={e => updateCurrentLevel('instruction', e.target.value)} /></div>
                        <div>
                            <div className="hw-section-title">Fiche Question / Pages de l'exercice</div>
                            {formData.assessmentKind === 'dnb' && String(currentLvl.dnbSection || 'docs') === 'docs' && (
                                <div className="mb-2 text-[11px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                    Mode DNB documents : colle ou envoie toutes les captures de cette partie ici.
                                    L'élève verra les pages ensemble, avec miniatures et navigation.
                                </div>
                            )}
                            {currentLvl.instructionUrls && currentLvl.instructionUrls.length > 0 ? (
                                <div
                                    className="hw-sheet-zone hw-sheet-zone-preview hw-sheet-zone-gallery"
                                    style={{borderColor: '#22c55e', background: '#f0fdf4'}}
                                    onPaste={(e) => handlePasteUpload(e, 'sheet')}
                                    tabIndex={0}
                                    title="Clique ici puis colle avec Ctrl+V / Cmd+V. Utilise + QUESTION pour choisir un fichier."
                                >
                                    <div className="hw-sheet-gallery">
                                        {currentLvl.instructionUrls.map((url, i) => (
                                            <div key={`${url}-${i}`} className="hw-sheet-thumb" onClick={(e) => { e.stopPropagation(); openPreview(url, `Page ${i + 1}`); }}>
                                                <img src={url} alt={`Page ${i + 1}`} />
                                                <span>Page {i + 1}</span>
                                                <button onClick={(e) => { e.stopPropagation(); removeAttachment('sheet', i); }}>✕</button>
                                            </div>
                                        ))}
                                        <button type="button" className="hw-sheet-add-more" onClick={(e) => { e.stopPropagation(); triggerUpload('sheet'); }}>+ QUESTION</button>
                                    </div>
                                    <button className="hw-sheet-remove" onClick={(e) => { e.stopPropagation(); removeAttachment('sheet'); }}>Tout supprimer</button>
                                </div>
                            ) : (
                                <div
                                    className="hw-sheet-zone"
                                    onPaste={(e) => handlePasteUpload(e, 'sheet')}
                                    tabIndex={0}
                                    title="Clique ici puis colle une image avec Ctrl+V ou Cmd+V. Utilise + QUESTION pour choisir un fichier."
                                >
                                    <div className="hw-sheet-placeholder">
                                        <span style={{fontSize: '2rem'}}>🖼️</span>
                                        <span>Coller une fiche ici</span>
                                        <small>Ctrl/Cmd+V · ou bouton ci-dessous</small>
                                        <button type="button" className="hw-sheet-add-more" onClick={(e) => { e.stopPropagation(); triggerUpload('sheet'); }}>+ QUESTION</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div>
                            <div className="hw-section-title">Documents de travail (Aide)</div>
                            <div
                                className="v84-hw-attachments"
                                onPaste={(e) => handlePasteUpload(e, 'docs')}
                                tabIndex={0}
                                title="Clique dans cette zone puis colle une ou plusieurs images avec Ctrl+V ou Cmd+V"
                            >
                                {currentLvl.attachmentUrls.map((url, i) => (
                                    <div
                                        key={i}
                                        className={`v84-att-card${dragDocIndex === i ? ' is-dragging' : ''}${dropDocIndex === i && dragDocIndex !== i ? ' is-drop-target' : ''}`}
                                        draggable
                                        onDragStart={(e) => handleDocDragStart(e, i)}
                                        onDragOver={(e) => handleDocDragOver(e, i)}
                                        onDrop={(e) => handleDocDrop(e, i)}
                                        onDragEnd={handleDocDragEnd}
                                        onClick={() => openPreview(url, `Document ${i + 1}`)}
                                    >
                                        <img src={url} className="v84-att-thumb" alt={`Doc ${i + 1}`} />
                                        <div className="v84-att-meta">
                                            <span>📎 Doc {i + 1}</span>
                                            <button onClick={(e) => { e.stopPropagation(); removeAttachment('docs', i); }} className="v84-att-remove-btn">✕</button>
                                        </div>
                                    </div>
                                ))}
                                <button onClick={() => triggerUpload('docs')} className="v84-att-add-btn">+ DOC</button>
                                <div className="v84-att-paste-hint">Ctrl/Cmd+V pour coller une image</div>
                            </div>
                        </div>
                        <div>
                            <div className="hw-section-title" style={{color: '#7c3aed'}}>🧠 Indices Correction IA (Secret)</div>
                            <div
                                className="hw-ai-box"
                                onPaste={(e) => handlePasteUpload(e, 'correction')}
                                tabIndex={0}
                                title="Clique ici puis colle une image de corrigé avec Ctrl+V ou Cmd+V"
                            >
                                <textarea
                                    className="hw-ai-input custom-scrollbar"
                                    placeholder="Donnez ici les mots-clés ou les réponses attendues pour aider l'IA à corriger..."
                                    value={currentLvl.aiHints}
                                    onChange={e => updateCurrentLevel('aiHints', e.target.value)}
                                    onPaste={(e) => {
                                        const hasImage = Array.from(e.clipboardData?.items || []).some((item) => String(item.type || '').startsWith('image/'));
                                        if (hasImage) handlePasteUpload(e, 'correction');
                                    }}
                                />
                                <div className="hw-ai-docs">
                                    {(currentLvl.aiHintUrls || []).map((url, i) => (
                                        <div key={`${url}-${i}`} className="hw-ai-doc-card" onClick={() => openPreview(url, `Corrigé ${i + 1}`)}>
                                            <img src={url} alt={`Corrigé ${i + 1}`} />
                                            <span>Corrigé {i + 1}</span>
                                            <button onClick={(e) => { e.stopPropagation(); removeAttachment('correction', i); }}>✕</button>
                                        </div>
                                    ))}
                                    <button type="button" className="v84-att-add-btn" onClick={() => triggerUpload('correction')}>+ CORRIGÉ</button>
                                    <span className="v84-att-paste-hint">Ctrl/Cmd+V pour coller une image</span>
                                </div>
                            </div>
                        </div>
                        {formData.assessmentKind === 'dnb' && (
                            <div className="text-[11px] font-bold rounded-xl border border-violet-100 bg-violet-50 text-violet-700 px-3 py-2">
                                {currentLvl.compactCorrection ? (
                                    <>
                                        ✅ Fiche compacte DNB générée
                                        {currentLvl.compactCorrection?.total_points ? ` · total ${currentLvl.compactCorrection.total_points} pts` : ''}
                                        {Array.isArray(currentLvl.compactCorrection?.questions) ? ` · ${currentLvl.compactCorrection.questions.length} question(s)` : ''}
                                    </>
                                ) : currentLvl.compactCorrectionError ? (
                                    <>⚠️ Fiche compacte non générée : {currentLvl.compactCorrectionError}</>
                                ) : (
                                    <>ℹ️ À l’enregistrement, le corrigé/aide IA sera résumé en fiche compacte pour économiser les tokens.</>
                                )}
                            </div>
                        )}
                    </div>
                        </>
                    )}
                </div>

                <StudioDistributionSidebar defaultSelectAllClasses={!initialData?._id}
                    user={user}
                    allClasses={allClasses} // Données passées
                    allStudents={allStudents} // Données passées
                    chapters={chapters}
                    distribution={distribution}
                    setDistribution={setDistribution}
                    viewingClass={viewingClass}
                    setViewingClass={setViewingClass}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    targetSection={targetSection} 
                    targetLevel={targetLevel} 
                    punishmentMode={formData.isPunishment}
                    loading={loading}
                    onSave={handleSave}
                />
            </div>

            {previewAsset && (
                <div className="hw-preview-modal" onClick={closePreview}>
                    <div className="hw-preview-dialog" onClick={(e) => e.stopPropagation()}>
                        <div className="hw-preview-head">
                            <strong>{previewAsset.label}</strong>
                            <button className="hw-preview-close" onClick={closePreview}>✕</button>
                        </div>
                        <div className="hw-preview-body">
                            {previewAsImage ? (
                                <img src={previewAsset.url} alt={previewAsset.label} className="hw-preview-image" onError={() => setPreviewAsImage(false)} />
                            ) : (
                                <iframe src={previewAsset.url} title={previewAsset.label} className="hw-preview-frame" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
