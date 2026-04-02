import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const WEB5E_SESSION_KEY = 'web5eBridgeSession';
const WEB5E_LOCAL_CONTENT_KEY = 'web5eLocalContentV1';
const WEB5E_VERSION_NAME = 'Orion Slides';

const SECTION_CONFIG = {
  eau: {
    title: "L'eau",
    accent: 'water',
    subtitle: "Ressources, usages, préservation et circulation de l'eau dans notre environnement.",
    tabs: [
      { id: 'manquer-eau', title: "Manquer d'eau" },
      { id: 'quotidien', title: "L'eau au quotidien" },
      { id: 'recycler-eau', title: "Recycler l'eau" },
      { id: 'conflits-eau', title: "Conflits sur l'eau" }
    ]
  },
  energie: {
    title: "L'énergie",
    accent: 'energy',
    subtitle: "Sources d'énergie, transformations, consommation et défis pour demain.",
    tabs: [
      { id: 'fossiles', title: 'Énergies fossiles' },
      { id: 'renouvelables', title: 'Énergies renouvelables' }
    ]
  }
};

const DEFAULT_CONTENT = {
  eau: {
    'manquer-eau': [
      { type: 'text', value: "Pourquoi certaines régions du monde manquent-elles d'eau ? Cette rubrique pourra présenter la sécheresse, le climat, les besoins humains et les inégalités d'accès." }
    ],
    quotidien: [
      { type: 'text', value: "Ici, la classe décrira tous les usages de l'eau dans la vie de tous les jours: boire, cuisiner, se laver, nettoyer, arroser, produire." }
    ],
    'recycler-eau': [
      { type: 'text', value: "Cette partie montrera comment l'eau peut être traitée, réutilisée et économisée grâce aux stations d'épuration, aux récupérateurs et aux gestes du quotidien." }
    ],
    'conflits-eau': [
      { type: 'text', value: "Les élèves pourront expliquer comment l'eau peut provoquer des tensions entre pays, régions, habitants ou activités humaines." }
    ]
  },
  energie: {
    fossiles: [
      { type: 'text', value: "Cette partie servira à présenter le charbon, le pétrole et le gaz, leur formation, leurs usages et leurs effets sur l'environnement." }
    ],
    renouvelables: [
      { type: 'text', value: "Ici, les élèves présenteront les énergies renouvelables: solaire, éolienne, hydraulique, géothermie et biomasse." }
    ]
  }
};

const VOTE_NAME_CATEGORIES = [
  { key: 'site_name', label: 'Nom du site' },
  { key: 'water_mascot_name', label: "Mascotte de l'eau" },
  { key: 'energy_mascot_name', label: "Mascotte de l'energie" }
];

const VOTE_MASCOT_CATEGORIES = [
  { key: 'water_mascot_image', label: "Mascotte de l'eau" },
  { key: 'energy_mascot_image', label: "Mascotte de l'energie" }
];

function createDefaultVoteBoard() {
  return {
    names: {
      site_name: [],
      water_mascot_name: [],
      energy_mascot_name: []
    },
    mascots: {
      water_mascot_image: [],
      energy_mascot_image: []
    },
    votesByUser: {}
  };
}

function normalizeVoteBoard(raw = null) {
  const base = createDefaultVoteBoard();
  const board = raw && typeof raw === 'object' ? raw : {};
  return {
    names: {
      site_name: Array.isArray(board?.names?.site_name) ? board.names.site_name : base.names.site_name,
      water_mascot_name: Array.isArray(board?.names?.water_mascot_name) ? board.names.water_mascot_name : base.names.water_mascot_name,
      energy_mascot_name: Array.isArray(board?.names?.energy_mascot_name) ? board.names.energy_mascot_name : base.names.energy_mascot_name
    },
    mascots: {
      water_mascot_image: Array.isArray(board?.mascots?.water_mascot_image) ? board.mascots.water_mascot_image : base.mascots.water_mascot_image,
      energy_mascot_image: Array.isArray(board?.mascots?.energy_mascot_image) ? board.mascots.energy_mascot_image : base.mascots.energy_mascot_image
    },
    votesByUser: board?.votesByUser && typeof board.votesByUser === 'object' ? board.votesByUser : {}
  };
}

function countVotesForOption(voteBoard, categoryKey, optionId) {
  const votesByUser = voteBoard?.votesByUser && typeof voteBoard.votesByUser === 'object' ? voteBoard.votesByUser : {};
  return Object.values(votesByUser).filter((row) => String(row?.[categoryKey] || '') === String(optionId || '')).length;
}

const clean = (str) => (str || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function createBlock(type = 'text') {
  if (type === 'animation') {
    return {
      type,
      title: 'Nouvelle animation',
      actorName: 'Personnage',
      actorImageUrl: '',
      actorX: 120,
      actorY: 120,
      actorWidth: 140,
      actorHeight: 140,
      savedActions: [],
      actions: [
        {
          id: `action_${Date.now()}`,
          name: 'Parler',
          frames: [],
          frameUrlInput: '',
          soundUrl: '',
          spritesOpen: false,
          spriteUrlOpen: false,
          spriteEditorOpen: false,
          selectedFrameIndex: 0
        }
      ]
    };
  }
  return {
    type,
    value: type === 'text' ? '<h3>Nouveau slide</h3><p>Écris ici.</p>' : ''
  };
}

function createPresentationSlide(index = 0) {
  return {
    id: `slide_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    presenterName: '',
    html: DEFAULT_PRESENTATION_SLIDE_HTML,
    background: '#ffffff',
    animation: null,
    textBoxes: []
  };
}

const DEFAULT_PRESENTATION_SLIDE_HTML = '<h3>Nouveau slide</h3><p>Écris ici.</p>';

function createPresentationTextBox({ x = 40, y = 40, width = 220, height = 120, text = '', fontSize = 28 } = {}) {
  return {
    id: `textbox_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x,
    y,
    width,
    height,
    text,
    fontSize
  };
}

function createPresentationSlideHtmlFromImage(imageUrl = '') {
  const safeUrl = String(imageUrl || '').trim().replace(/"/g, '&quot;');
  if (!safeUrl) return DEFAULT_PRESENTATION_SLIDE_HTML;
  return `<img src="${safeUrl}" alt="" style="width:100%;height:100%;object-fit:contain;display:block;margin:0 auto;border-radius:18px;" />`;
}

function createPresentationSlideHtmlFromPdf(pdfUrl = '', fileName = 'Document PDF') {
  const safeUrl = String(pdfUrl || '').trim().replace(/"/g, '&quot;');
  const safeName = String(fileName || 'Document PDF').trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
  if (!safeUrl) return DEFAULT_PRESENTATION_SLIDE_HTML;
  return `
    <div style="display:flex;flex-direction:column;gap:12px;height:100%;">
      <div style="font-weight:800;font-size:18px;">${safeName}</div>
      <iframe
        src="${safeUrl}"
        title="${safeName}"
        style="width:100%;height:100%;min-height:420px;border:none;border-radius:18px;background:white;"
      ></iframe>
    </div>
  `;
}

function normalizeCanvaLiveUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.hostname.includes('canva.com')) {
      if (!url.searchParams.has('embed')) {
        url.searchParams.set('embed', '1');
      }
      return url.toString();
    }
  } catch (_) {}
  return value;
}

function syncPresentationSlidesWithCount(slides = [], requestedCount = 0) {
  const count = Math.max(0, Number(requestedCount || 0));
  const currentSlides = Array.isArray(slides) ? slides : [];
  if (count <= 0) return currentSlides;
  if (currentSlides.length === count) return currentSlides;
  if (currentSlides.length > count) return currentSlides.slice(0, count);
  const nextSlides = [...currentSlides];
  while (nextSlides.length < count) {
    nextSlides.push(createPresentationSlide(nextSlides.length));
  }
  return nextSlides;
}

function extractSlideNumberFromUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return null;
  const hashMatch = value.match(/#(\d+)\s*$/);
  if (hashMatch) {
    const parsed = Number(hashMatch[1]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
}

function injectSlideNumberIntoUrl(rawUrl = '', slideNumber = 1) {
  const value = String(rawUrl || '').trim();
  const safeSlide = Math.max(1, Number(slideNumber || 1));
  if (!value) return '';
  if (/#\d+\s*$/.test(value)) {
    return value.replace(/#\d+\s*$/, `#${safeSlide}`);
  }
  return `${value}#${safeSlide}`;
}

function formatPresenterLabel(name = '') {
  return String(name || '').trim().replace(/\s+/g, ' ');
}

function attachAnimationMetadata(animation = null, presentationNumber = 0, slideNumber = 0) {
  if (!animation || typeof animation !== 'object') return animation;
  return {
    ...animation,
    presentationNumber: Math.max(1, Number(presentationNumber || 1)),
    slideNumber: Math.max(1, Number(slideNumber || 1))
  };
}

function normalizePresentationBlock(block = {}) {
  const rawSlides = Array.isArray(block?.slides) && block.slides.length > 0
    ? block.slides
    : [{
        id: `slide_${Date.now()}`,
        html: String(block?.value || DEFAULT_PRESENTATION_SLIDE_HTML),
        background: '#ffffff',
        animation: null
      }];
  return {
    ...block,
    presentationName: String(block?.presentationName || block?.title || ''),
    canvaLiveUrl: normalizeCanvaLiveUrl(block?.canvaLiveUrl || ''),
    canvaSlideCount: Math.max(0, Number(block?.canvaSlideCount || 0)),
    groupMembers: Array.isArray(block?.groupMembers) ? block.groupMembers.map((name) => String(name || '').trim()).filter(Boolean) : [],
    groupMembersText: String(block?.groupMembersText || (Array.isArray(block?.groupMembers) ? block.groupMembers.join(', ') : '')),
    qcmQuestions: Array.isArray(block?.qcmQuestions) ? block.qcmQuestions : [],
    activeEditorTab: ['presentation', 'slides', 'qcm', 'animation'].includes(String(block?.activeEditorTab || 'slides'))
      ? String(block?.activeEditorTab || 'slides')
      : 'slides',
    presentationValidated: block?.presentationValidated === true,
    slides: syncPresentationSlidesWithCount(rawSlides.map((slide, index) => ({
      id: String(slide?.id || `slide_${Date.now()}_${index}`),
      presenterName: String(slide?.presenterName || ''),
      html: String(slide?.html || slide?.value || ''),
      background: String(slide?.background || '#ffffff'),
      animation: slide?.animation && typeof slide.animation === 'object' ? slide.animation : null,
      textBoxes: Array.isArray(slide?.textBoxes)
        ? slide.textBoxes.map((box, boxIndex) => ({
            id: String(box?.id || `textbox_${Date.now()}_${index}_${boxIndex}`),
            x: Number(box?.x || 40),
            y: Number(box?.y || 40),
            width: Number(box?.width || 220),
            height: Number(box?.height || 120),
            text: String(box?.text || ''),
            fontSize: Number(box?.fontSize || 28)
          }))
        : []
    })), Math.max(0, Number(block?.canvaSlideCount || 0))),
    activeSlideIndex: Math.max(0, Math.min(Number(block?.activeSlideIndex || 0), Math.max(0, syncPresentationSlidesWithCount(rawSlides, Math.max(0, Number(block?.canvaSlideCount || 0))).length - 1)))
  };
}

function createQcmQuestion(index = 0) {
  return {
    id: `qcm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    question: `Question ${index + 1}`,
    options: ['', '', '', ''],
    correctIndex: 0
  };
}

function createAnimationBlockFromDraft(draft = {}) {
  return {
    type: 'animation',
    title: String(draft.title || 'Nouvelle animation').trim() || 'Nouvelle animation',
    actorName: String(draft.actorName || 'Personnage').trim() || 'Personnage',
    actorImageUrl: String(draft.actorImageUrl || '').trim(),
    actorX: 120,
    actorY: 120,
    actorWidth: 140,
    actorHeight: 140,
    savedActions: [],
    actions: [
      {
        id: `action_${Date.now()}`,
        name: 'Parler',
        frames: [],
        frameUrlInput: '',
        soundUrl: String(draft.soundUrl || '').trim(),
        spritesOpen: false,
        spriteUrlOpen: false,
        spriteEditorOpen: false,
        selectedFrameIndex: 0
      }
    ]
  };
}

function createSpriteFrame(url = '') {
  return {
    id: `frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    url: String(url || '').trim(),
    width: 140,
    height: 140,
    scale: 1,
    offsetX: 0,
    offsetY: 0
  };
}

const ARTICLE_FONTS = [
  { value: 'Arial', label: 'Arial' },
  { value: 'Georgia', label: 'Georgia' },
  { value: 'Trebuchet MS', label: 'Trebuchet' },
  { value: 'Courier New', label: 'Courier' }
];

const ARTICLE_COLORS = ['#1d2942', '#0b3b91', '#0ea5e9', '#dc2626', '#eab308', '#ec4899', '#f97316', '#16a34a', '#7c3aed'];
const SLIDE_BACKGROUNDS = ['#ffffff', '#eff6ff', '#fef3c7', '#fee2e2', '#ecfccb', '#f5f3ff', '#1d2942'];
const WEB5E_EDITOR_PASSWORD = 'condamine';
const WEB5E_TEACHER_PASSWORD = 'a';
const WEB5E_DIRECT_STUDENT_PREFIX = 'web5e-direct-student';

function resolveWeb5eAssetUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('blob:') || raw.startsWith('data:')) return raw;
  if (raw.startsWith('/uploads/')) {
    if (typeof window !== 'undefined' && String(window.location.hostname || '').includes('vercel.app')) {
      return `https://hgeoentraineur.onrender.com${raw}`;
    }
  }
  return raw;
}

function normalizeBridgedUser(decoded) {
  if (!decoded || typeof decoded !== 'object') return null;
  return {
    id: decoded.id || decoded._id || '',
    _id: decoded._id || decoded.id || '',
    firstName: decoded.firstName || '',
    lastName: decoded.lastName || '',
    currentClass: decoded.currentClass || '',
    isTestAccount: decoded.isTestAccount === true,
    role: 'student'
  };
}

function readBridgeUserFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const hash = String(window.location.hash || '').replace(/^#/, '');
    const hashParams = new URLSearchParams(hash);
    const rawBridgeUser = String(params.get('bridgeUser') || hashParams.get('bridgeUser') || '').trim();
    if (!rawBridgeUser) return null;
    const decodedBase64 = decodeURIComponent(rawBridgeUser);
    return normalizeBridgedUser(JSON.parse(window.atob(decodedBase64)));
  } catch (_) {
    return null;
  }
}

function readBridgeUserFromWindowName() {
  try {
    const payload = JSON.parse(String(window.name || ''));
    return normalizeBridgedUser(payload?.web5eBridgeUser);
  } catch (_) {
    return null;
  }
}

function readStoredWeb5eSession() {
  try {
    const raw = window.localStorage.getItem(WEB5E_SESSION_KEY);
    if (!raw) return null;
    return normalizeBridgedUser(JSON.parse(raw));
  } catch (_) {
    return null;
  }
}

function isLocalWeb5eHost() {
  try {
    const host = String(window.location.hostname || '').trim().toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  } catch (_) {
    return false;
  }
}

function buildLocalTeacherSession() {
  return {
    id: 'web5e-local-teacher-jp-vuillet',
    _id: 'web5e-local-teacher-jp-vuillet',
    firstName: 'JP',
    lastName: 'Vuillet',
    currentClass: 'PROF',
    role: 'teacher',
    isTestAccount: true
  };
}

function readLocalWeb5eContent() {
  try {
    const raw = window.localStorage.getItem(WEB5E_LOCAL_CONTENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeLocalWeb5eContent(content) {
  try {
    window.localStorage.setItem(WEB5E_LOCAL_CONTENT_KEY, JSON.stringify(content || {}));
  } catch (_) {}
}

function sampleCornerColor(imageData, width) {
  const idx = ((0 * width) + Math.max(0, width - 1)) * 4;
  return {
    r: imageData.data[idx] || 255,
    g: imageData.data[idx + 1] || 255,
    b: imageData.data[idx + 2] || 255
  };
}

function colorDistance(a, b) {
  return Math.abs(a.r - b.r) + Math.abs(a.g - b.g) + Math.abs(a.b - b.b);
}

async function autoRemoveBgFromDataUrl(dataUrl) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      try {
        ctx.drawImage(image, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const target = sampleCornerColor(imageData, canvas.width);
        const tolerance = 70;
        for (let i = 0; i < imageData.data.length; i += 4) {
          const pixel = {
            r: imageData.data[i],
            g: imageData.data[i + 1],
            b: imageData.data[i + 2]
          };
          if (colorDistance(pixel, target) <= tolerance) {
            imageData.data[i + 3] = 0;
          }
        }
        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (_) {
        resolve(dataUrl);
      }
    };
    image.onerror = () => resolve(dataUrl);
    image.src = dataUrl;
  });
}

function buildDirectStudentProfile({ firstName = '', lastName = '', className = '' } = {}) {
  const safeFirst = String(firstName || '').trim();
  const safeLast = String(lastName || '').trim();
  const safeClass = String(className || '').trim();
  const slug = [safeClass, safeLast, safeFirst]
    .map((part) => clean(part).replace(/[^a-z0-9]+/g, '-'))
    .filter(Boolean)
    .join('-') || 'guest';
  return {
    id: `${WEB5E_DIRECT_STUDENT_PREFIX}-${slug}`,
    type: 'student',
    firstName: safeFirst,
    lastName: safeLast,
    className: safeClass
  };
}

function handleUrlOrImagePaste(event, onValue) {
  const clipboard = event.clipboardData;
  if (!clipboard) return;
  const items = Array.from(clipboard.items || []);
  const imageItem = items.find((item) => item.type && item.type.startsWith('image/'));
  if (imageItem) {
    event.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onValue?.(String(reader.result || ''));
    reader.readAsDataURL(file);
    return;
  }
  const pastedText = String(clipboard.getData('text/plain') || '').trim();
  if (pastedText) onValue?.(pastedText);
}

function buildMobileTokenQrUrl(token = '') {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('mobileAction');
    url.searchParams.delete('mobileActionToken');
    url.searchParams.delete('section');
    url.searchParams.delete('tab');
    url.searchParams.delete('block');
    url.searchParams.delete('action');
    url.searchParams.set('m', String(token || '').trim());
    return url.toString();
  } catch (_) {
    return '';
  }
}

function ActionQrCode({ actionId, actionName, sectionKey, tabKey, blockIndex, tabId, entryId, onPendingMedia }) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = null;
    const run = async () => {
      const safeActionId = String(actionId || '').trim();
      const safeEntryId = String(entryId || '').trim();
      if (!safeActionId) {
        setToken('');
        setLoading(false);
        return;
      }
      if (!safeEntryId && String(sectionKey || '').trim() !== 'welcome') {
        setToken('');
        setLoading(false);
        timeoutId = window.setTimeout(run, 1500);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch('/api/web5e/mobile-action-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actionId: safeActionId,
            actionName: String(actionName || '').trim(),
            sectionKey: String(sectionKey || '').trim(),
            tabKey: String(tabKey || '').trim(),
            blockIndex: Number(blockIndex || 0),
            tabId: String(tabId || '').trim(),
            entryId: safeEntryId
          })
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && data?.ok && data?.token) {
          setToken(String(data.token || ''));
          setLoading(false);
        } else if (!cancelled) {
          setToken('');
          setLoading(false);
          timeoutId = window.setTimeout(run, 4000);
        }
      } catch (_) {
        if (!cancelled) {
          setToken('');
          setLoading(false);
          timeoutId = window.setTimeout(run, 4000);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [actionId, actionName, sectionKey, tabKey, blockIndex, tabId, entryId]);

  useEffect(() => {
    let cancelled = false;
    let intervalId = null;
    const poll = async () => {
      const safeToken = String(token || '').trim();
      if (!safeToken) return;
      try {
        const res = await fetch(`/api/web5e/mobile-action-session/${encodeURIComponent(safeToken)}`);
        const data = await res.json().catch(() => ({}));
        const pendingFrames = Array.isArray(data?.pendingFrames) ? data.pendingFrames : [];
        const pendingSoundUrl = String(data?.pendingSoundUrl || '').trim();
        if (!cancelled && (pendingFrames.length > 0 || pendingSoundUrl)) {
          const consumed = await onPendingMedia?.({
            token: safeToken,
            actionId: String(actionId || '').trim(),
            pendingFrames,
            pendingSoundUrl
          });
          if (consumed) {
            await fetch(`/api/web5e/mobile-action-consume/${encodeURIComponent(safeToken)}`, { method: 'POST' });
          }
        }
      } catch (_) {}
    };
    if (token) {
      poll();
      intervalId = window.setInterval(poll, 4000);
    }
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [token, actionId, onPendingMedia]);

  if (!token) {
    return <div className="animation-action-qr animation-action-qr-placeholder">{loading ? 'QR...' : ((entryId || sectionKey === 'welcome') ? 'QR' : 'Sauvegarde...')}</div>;
  }
  const qrUrl = buildMobileTokenQrUrl(token);
  if (!qrUrl) {
    return <div className="animation-action-qr animation-action-qr-placeholder">QR</div>;
  }

  return (
    <div className="animation-action-qr">
      <img
        src={`https://api.qrserver.com/v1/create-qr-code/?size=116x116&ecc=M&qzone=2&data=${encodeURIComponent(qrUrl)}`}
        alt="QR action"
      />
    </div>
  );
}

function MobileActionRemote({
  token
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [recordError, setRecordError] = useState('');
  const [micStatus, setMicStatus] = useState('unknown');
  const [audioPreviewUrl, setAudioPreviewUrl] = useState('');
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const audioCaptureInputRef = useRef(null);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const readPermission = async () => {
      try {
        if (!navigator.permissions?.query) return;
        const result = await navigator.permissions.query({ name: 'microphone' });
        if (!cancelled) {
          setMicStatus(result.state || 'unknown');
          result.onchange = () => setMicStatus(result.state || 'unknown');
        }
      } catch (_) {}
    };
    readPermission();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => {
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
  }, [audioPreviewUrl]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const safeToken = String(token || '').trim();
      if (!safeToken) {
        setSessionData(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/web5e/mobile-action-session/${encodeURIComponent(safeToken)}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (res.ok && data?.ok) {
            setSessionData(data);
          } else {
            setSessionData(null);
          }
        }
      } catch (_) {
        if (!cancelled) setSessionData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const blocks = Array.isArray(sessionData?.blocks) ? sessionData.blocks : [];
  const resolvedBlockIndex = Number(sessionData?.blockIndex || 0);
  const actionId = String(sessionData?.actionId || '').trim();
  const resolvedBlock = blocks?.[resolvedBlockIndex] || null;
  const resolvedAction = Array.isArray(resolvedBlock?.actions)
    ? resolvedBlock.actions.find((item) => String(item?.id || '') === actionId)
    : null;
  const actionTitle = String(resolvedAction?.name || sessionData?.actionName || 'Action').trim();

  const fileToUpload = async (file) => {
    if (file.type.startsWith('image/')) return file;
    if (!file.type.startsWith('video/')) return null;
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const objectUrl = URL.createObjectURL(file);
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.src = objectUrl;
      video.onloadeddata = () => {
        try {
          video.currentTime = Math.min(0.15, Number(video.duration || 0));
        } catch (_) {}
      };
      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, video.videoWidth || 1);
          canvas.height = Math.max(1, video.videoHeight || 1);
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
            return;
          }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              resolve(null);
              return;
            }
            resolve(new File([blob], `${file.name || 'capture'}.png`, { type: 'image/png' }));
          }, 'image/png');
        } catch (_) {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };
    });
  };

  const appendMedia = async (fileList) => {
    const sourceFiles = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (sourceFiles.length === 0) return;
    const files = (await Promise.all(sourceFiles.map(fileToUpload))).filter(Boolean);
    if (files.length === 0) {
      setMessage('Capture impossible');
      window.setTimeout(() => setMessage(''), 1600);
      return;
    }
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    setSaving(true);
    try {
      const res = await fetch(`/api/web5e/mobile-action-upload/${encodeURIComponent(String(token || ''))}`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Envoi impossible');
      const refresh = await fetch(`/api/web5e/mobile-action-session/${encodeURIComponent(String(token || ''))}`);
      const refreshData = await refresh.json().catch(() => ({}));
      if (refresh.ok && refreshData?.ok) setSessionData(refreshData);
      setMessage('Envoye');
      window.setTimeout(() => setMessage(''), 1600);
    } catch (_) {
      setMessage('Envoi impossible');
      window.setTimeout(() => setMessage(''), 1600);
    } finally {
      setSaving(false);
    }
  };

  const sendSoundDataUrl = async (soundUrl) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/web5e/mobile-action-audio/${encodeURIComponent(String(token || ''))}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundUrl: String(soundUrl || '') })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Envoi impossible');
      const refresh = await fetch(`/api/web5e/mobile-action-session/${encodeURIComponent(String(token || ''))}`);
      const refreshData = await refresh.json().catch(() => ({}));
      if (refresh.ok && refreshData?.ok) setSessionData(refreshData);
      setMessage('Envoye');
      window.setTimeout(() => setMessage(''), 1600);
    } catch (_) {
      setMessage('Envoi impossible');
      window.setTimeout(() => setMessage(''), 1600);
    } finally {
      setSaving(false);
    }
  };

  const handleCapturedAudio = async (fileList) => {
    const file = Array.from(fileList || []).find((item) => item.type.startsWith('audio/'));
    if (!file) return;
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = async () => {
      await sendSoundDataUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const toggleRecord = async () => {
    if (recording && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    try {
      setRecordError('');
      setMessage('');
      setMicStatus('prompt');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStatus('granted');
      const recorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : undefined);
      recorderChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: 'audio/webm' });
        if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.onload = async () => {
          await sendSoundDataUrl(String(reader.result || ''));
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderChunksRef.current = [];
        setRecording(false);
      };
      recorderRef.current = recorder;
      setRecording(true);
      recorder.start();
    } catch (error) {
      setMicStatus('denied');
      setRecordError(String(error?.message || 'Micro direct inaccessible'));
      audioCaptureInputRef.current?.click?.();
    }
  };

  if (loading) {
    return <div className="mobile-action-shell"><div className="mobile-action-card">Chargement...</div></div>;
  }

  return (
    <div className="mobile-action-shell">
      <div className="mobile-action-card">
        <div className="eyebrow">Action mobile</div>
        <h1>{actionTitle || 'Action'}</h1>
        <p>{sessionData?.resolved === false ? "L'action se prepare encore. Tu peux deja envoyer le son ou les captures." : 'Ajoute du son ou des captures de sprites depuis le telephone.'}</p>
        <div className="mobile-action-buttons">
          <button type="button" className={recording ? 'mobile-rec active' : 'mobile-rec'} onClick={() => void toggleRecord()}>
            {recording ? 'Arreter micro' : 'Enregistrer micro'}
          </button>
          <label className="mobile-upload-btn">
            Scanner / photo
            <input type="file" accept="image/*" capture="environment" multiple className="hidden-file-input" onChange={(e) => void appendMedia(e.target.files)} />
          </label>
        </div>
        <div className="mobile-action-status">
          {micStatus === 'granted' ? 'Micro autorise' : micStatus === 'denied' ? 'Micro refuse par le navigateur' : 'Appuie sur Enregistrer micro pour demander l’autorisation'}
        </div>
        <input ref={audioCaptureInputRef} type="file" accept="audio/*" capture className="hidden-file-input" onChange={(e) => void handleCapturedAudio(e.target.files)} />
        {audioPreviewUrl ? (
          <audio controls className="mobile-audio-preview" src={audioPreviewUrl}>
            <track kind="captions" />
          </audio>
        ) : null}
        {recordError ? <div className="mobile-action-status">{recordError}</div> : null}
        {saving ? <div className="mobile-action-status">Envoi...</div> : null}
        {message ? <div className="mobile-action-status">{message}</div> : null}
      </div>
    </div>
  );
}

function PresentationEditor({ block, onChange, readOnly, sectionKey = '', tabKey = '', blockIndex = 0, tabId = '', entryId = '', siblingPresentationNames = [], presentationNumber = 0 }) {
  const presentation = useMemo(() => normalizePresentationBlock(block), [block]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupName, setSetupName] = useState(String(presentation.presentationName || ''));
  const [setupSlideCount, setSetupSlideCount] = useState(1);
  const [setupPresenters, setSetupPresenters] = useState(['']);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [selectedColor, setSelectedColor] = useState('#1d2942');
  const [validatedFlash, setValidatedFlash] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [canvaLiveUrlInput, setCanvaLiveUrlInput] = useState(String(presentation.canvaLiveUrl || ''));
  const [editorCanvaStep, setEditorCanvaStep] = useState(1);
  const [activeMiniMenu, setActiveMiniMenu] = useState('');
  const [fontSize, setFontSize] = useState(28);
  const [drawTextMode, setDrawTextMode] = useState(false);
  const [draftTextBox, setDraftTextBox] = useState(null);
  const [activeTextBoxId, setActiveTextBoxId] = useState('');
  const editorRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const slidesImportInputRef = useRef(null);
  const canvasRef = useRef(null);
  const drawStateRef = useRef(null);
  const activeSlide = presentation.slides[presentation.activeSlideIndex] || presentation.slides[0];
  const lastHtmlRef = useRef(String(activeSlide?.html || ''));
  const isPresenterValid = Boolean(String(activeSlide?.presenterName || '').trim());
  const slideHasContent = Boolean(String(activeSlide?.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  const isActiveSlideValid = isPresenterValid && slideHasContent;
  const slidesValidCount = presentation.slides.filter((slide) => {
    const validPresenter = Boolean(String(slide?.presenterName || '').trim());
    const hasContent = Boolean(String(slide?.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    return validPresenter && hasContent;
  }).length;
  const qcmQuestions = Array.isArray(presentation.qcmQuestions) ? presentation.qcmQuestions : [];
  const hasQcmTab = qcmQuestions.length > 0 || presentation.activeEditorTab === 'qcm';
  const qcmValidCount = qcmQuestions.filter((row) => {
    const options = Array.isArray(row?.options) ? row.options : [];
    return String(row?.question || '').trim() && options.every((option) => String(option || '').trim());
  }).length;
  const normalizedPresentationName = clean(presentation.presentationName || '');
  const presentationNameAlreadyUsed = Boolean(
    normalizedPresentationName
    && siblingPresentationNames.some((name) => clean(name) === normalizedPresentationName)
  );
  const canValidatePresentation = !presentationNameAlreadyUsed
    && normalizedPresentationName
    && presentation.slides.length > 0
    && slidesValidCount === presentation.slides.length
    && qcmValidCount >= presentation.slides.length;
  const currentEditorCanvaSlide = presentation.slides[Math.max(0, Math.min(editorCanvaStep - 1, presentation.slides.length - 1))] || null;
  const currentEditorCanvaSlideIndex = Math.max(0, Math.min(editorCanvaStep - 1, presentation.slides.length - 1));
  const isPresentationUnconfigured = !String(presentation.presentationName || '').trim()
    && Math.max(0, Number(presentation.canvaSlideCount || 0)) === 0;

  useEffect(() => {
    if (!isPresentationUnconfigured) return;
    setSetupName('');
    setSetupSlideCount(1);
    setSetupPresenters(['']);
  }, [isPresentationUnconfigured]);

  useEffect(() => {
    const nextHtml = String(activeSlide?.html || '');
    const editor = editorRef.current;
    lastHtmlRef.current = nextHtml;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [activeSlide?.id, activeSlide?.html]);

  useEffect(() => {
    setCanvaLiveUrlInput(String(presentation.canvaLiveUrl || ''));
  }, [presentation.canvaLiveUrl]);

  useEffect(() => {
    setEditorCanvaStep(1);
  }, [presentation.canvaLiveUrl, presentation.canvaSlideCount]);
  const detectedEditorCanvaStep = extractSlideNumberFromUrl(presentation.canvaLiveUrl);

  useEffect(() => {
    if (detectedEditorCanvaStep) {
      setEditorCanvaStep(detectedEditorCanvaStep);
    }
  }, [detectedEditorCanvaStep]);

  const patchPresentation = (patch) => onChange?.({ ...presentation, ...patch });
  const patchSlide = (slideIndex, patch) => {
    const nextSlides = presentation.slides.map((slide, index) => index === slideIndex ? { ...slide, ...patch } : slide);
    patchPresentation({ slides: nextSlides });
  };
  const patchTextBoxes = (nextTextBoxes) => {
    patchSlide(presentation.activeSlideIndex, { textBoxes: nextTextBoxes });
  };
  const removeActiveTextBox = () => {
    if (!activeTextBoxId) return false;
    const nextTextBoxes = (activeSlide?.textBoxes || []).filter((box) => box.id !== activeTextBoxId);
    if (nextTextBoxes.length === (activeSlide?.textBoxes || []).length) return false;
    patchTextBoxes(nextTextBoxes);
    setActiveTextBoxId('');
    return true;
  };

  const exec = (command, commandValue = null) => {
    document.execCommand(command, false, commandValue);
  };

  const applyColor = (color) => {
    setSelectedColor(color);
    exec('styleWithCSS', true);
    exec('foreColor', color);
  };

  const applyFontSize = (size) => {
    const safeSize = Math.max(8, Math.min(120, Number(size) || 28));
    setFontSize(safeSize);
    if (activeTextBoxId) {
      patchTextBoxes((activeSlide?.textBoxes || []).map((box) => box.id === activeTextBoxId ? { ...box, fontSize: safeSize } : box));
      return;
    }
    exec('styleWithCSS', true);
    exec('fontSize', 7);
    const editor = editorRef.current;
    if (!editor) return;
    editor.querySelectorAll('font[size="7"]').forEach((node) => {
      const span = document.createElement('span');
      span.style.fontSize = `${safeSize}px`;
      span.innerHTML = node.innerHTML;
      node.replaceWith(span);
    });
    const nextHtml = editor.innerHTML || '';
    lastHtmlRef.current = nextHtml;
    patchSlide(presentation.activeSlideIndex, { html: nextHtml });
  };

  const insertImageFromUrl = (imageUrl) => {
    const safeUrl = String(imageUrl || '').trim();
    if (!safeUrl) return;
    const html = `<img src="${safeUrl.replace(/"/g, '&quot;')}" alt="" style="max-width:320px;width:100%;height:auto;border-radius:18px;display:block;margin:18px auto;" />`;
    exec('insertHTML', html);
    const nextHtml = editorRef.current?.innerHTML || '';
    lastHtmlRef.current = nextHtml;
    patchSlide(presentation.activeSlideIndex, { html: nextHtml });
    setImageUrlInput('');
  };

  const handleImageFileImport = async (fileList) => {
    const file = Array.from(fileList || []).find((row) => row.type.startsWith('image/'));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      insertImageFromUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };

  const handleSlidesImport = async (fileList) => {
    const files = Array.from(fileList || []).filter((row) => row.type.startsWith('image/') || row.type === 'application/pdf' || /\.pdf$/i.test(row.name || ''));
    if (files.length === 0) return;
    const importedSlides = await Promise.all(files.map((file, index) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        if (!result) {
          resolve(null);
          return;
        }
        const html = file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '')
          ? createPresentationSlideHtmlFromPdf(result, file.name || `PDF ${index + 1}`)
          : createPresentationSlideHtmlFromImage(result);
        resolve({
          ...createPresentationSlide(presentation.slides.length + index),
          html
        });
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    })));
    const normalizedImportedSlides = importedSlides.filter(Boolean);
    if (normalizedImportedSlides.length === 0) return;
    const currentSlideIsDefault = presentation.slides.length === 1
      && !String(activeSlide?.presenterName || '').trim()
      && String(activeSlide?.html || '').trim() === DEFAULT_PRESENTATION_SLIDE_HTML;
    const nextSlides = currentSlideIsDefault
      ? normalizedImportedSlides
      : [...presentation.slides, ...normalizedImportedSlides];
    patchPresentation({
      slides: nextSlides,
      activeSlideIndex: currentSlideIsDefault ? 0 : presentation.slides.length,
      activeEditorTab: 'slides',
      presentationValidated: false
    });
    if (slidesImportInputRef.current) {
      slidesImportInputRef.current.value = '';
    }
  };

  const updateTextBox = (textBoxId, patch) => {
    patchTextBoxes((activeSlide?.textBoxes || []).map((box) => box.id === textBoxId ? { ...box, ...patch } : box));
  };

  const updateSetupCount = (nextCountRaw) => {
    const nextCount = Math.max(1, Number(nextCountRaw || 1));
    setSetupSlideCount(nextCount);
    setSetupPresenters((prev) => Array.from({ length: nextCount }, (_, index) => String(prev[index] || '')));
  };

  const createPresentationFromSetup = () => {
    const nextSlides = syncPresentationSlidesWithCount([], setupSlideCount).map((slide, index) => ({
      ...slide,
      presenterName: String(setupPresenters[index] || '').trim()
    }));
    patchPresentation({
      presentationName: String(setupName || '').trim(),
      canvaSlideCount: setupSlideCount,
      slides: nextSlides,
      activeSlideIndex: 0,
      activeEditorTab: 'slides',
      presentationValidated: false
    });
    setSetupOpen(false);
  };

  useEffect(() => {
    if (!drawTextMode) {
      drawStateRef.current = null;
      setDraftTextBox(null);
    }
  }, [drawTextMode, activeSlide?.id]);

  useEffect(() => {
    const onMouseMove = (event) => {
      const drawState = drawStateRef.current;
      if (!drawState || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
      const currentY = Math.max(0, Math.min(event.clientY - rect.top, rect.height));
      const x = Math.min(drawState.startX, currentX);
      const y = Math.min(drawState.startY, currentY);
      const width = Math.max(80, Math.abs(currentX - drawState.startX));
      const height = Math.max(48, Math.abs(currentY - drawState.startY));
      setDraftTextBox({ x, y, width, height });
    };
    const onMouseUp = () => {
      const drawState = drawStateRef.current;
      if (!drawState) return;
      drawStateRef.current = null;
      const nextBox = createPresentationTextBox({
        x: Math.round(draftTextBox?.x ?? drawState.startX),
        y: Math.round(draftTextBox?.y ?? drawState.startY),
        width: Math.round(draftTextBox?.width ?? 220),
        height: Math.round(draftTextBox?.height ?? 120),
        fontSize
      });
      patchTextBoxes([...(activeSlide?.textBoxes || []), nextBox]);
      setActiveTextBoxId(nextBox.id);
      setDraftTextBox(null);
      setDrawTextMode(false);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [activeSlide?.id, activeSlide?.textBoxes, draftTextBox, fontSize]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!activeTextBoxId) return;
      const tagName = String(event.target?.tagName || '').toLowerCase();
      const isEditable = event.target?.isContentEditable || tagName === 'input' || tagName === 'textarea';
      if (isEditable) return;
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        removeActiveTextBox();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTextBoxId, activeSlide?.textBoxes]);

  if (readOnly) {
    return (
      <div className="presentation-shell readonly">
        <div className="public-presentation-head">
          <div className="eyebrow">Presentation</div>
          <h3>{presentation.presentationName || 'Presentation'}</h3>
        </div>
        <div className="presentation-slide-tabs">
          {presentation.slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`presentation-slide-tab ${index === presentation.activeSlideIndex ? 'active' : ''}`}
            onClick={() => patchPresentation({ activeSlideIndex: index })}
            >
            {`Slide ${index + 1}`}
          </button>
        ))}
          {hasQcmTab ? (
            <button
              type="button"
              className={`presentation-slide-tab ${presentation.activeEditorTab === 'qcm' ? 'active' : ''}`}
              onClick={() => patchPresentation({ activeEditorTab: 'qcm' })}
            >
              QCM
            </button>
          ) : null}
        </div>
        {presentation.activeEditorTab === 'qcm' ? (
          <div className="presentation-qcm-panel">
            {qcmQuestions.map((question, questionIndex) => (
              <div key={question.id} className="presentation-qcm-card">
                <input value={question.question} readOnly placeholder={`Question ${questionIndex + 1}`} />
                <div className="presentation-qcm-options">
                  {(question.options || ['', '', '', '']).map((option, optionIndex) => (
                    <div key={`${question.id}_${optionIndex}`} className="presentation-qcm-option">
                      <input value={option} readOnly placeholder={`Reponse ${optionIndex + 1}`} />
                      <button
                        type="button"
                        className={Number(question.correctIndex || 0) === optionIndex ? 'presentation-qcm-correct active' : 'presentation-qcm-correct'}
                      >
                        Bonne
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="presentation-canvas" style={{ background: activeSlide?.background || '#ffffff', color: activeSlide?.background === '#1d2942' ? '#ffffff' : '#1d2942' }}>
            <div className="public-text article-render" dangerouslySetInnerHTML={{ __html: activeSlide?.html || '' }} />
            {activeSlide?.animation ? (
              <AnimationBlockEditor
                block={attachAnimationMetadata(activeSlide.animation, presentationNumber, presentation.activeSlideIndex + 1)}
                onChange={() => {}}
                onRemove={() => {}}
                readOnly
                sectionKey={sectionKey}
                tabKey={tabKey}
                blockIndex={blockIndex}
                tabId={tabId}
                entryId={entryId}
                presentationNumber={presentationNumber}
                slideNumber={presentation.activeSlideIndex + 1}
              />
            ) : null}
            {activeSlide?.presenterName ? (
              <div className="presentation-slide-signature">Presentateur: {formatPresenterLabel(activeSlide.presenterName)}</div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (isPresentationUnconfigured) {
    return (
      <div className="presentation-shell">
        {!setupOpen ? (
          <button type="button" className="presentation-create-card" onClick={() => setSetupOpen(true)}>
            Nouvelle presentation
          </button>
        ) : (
          <div className="presentation-setup-card">
            <input
              className="presentation-slide-title"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="Nom de la presentation"
            />
            <label className="presentation-setup-label">
              <span>Nombre de slides:</span>
              <input
                className="presentation-size-input"
                type="number"
                min="1"
                max="300"
                value={setupSlideCount}
                onChange={(e) => updateSetupCount(e.target.value)}
              />
            </label>
            <div className="presentation-setup-list">
              {setupPresenters.map((value, index) => (
                <input
                  key={`setup-presenter-${index}`}
                  className="presentation-presenter-short-input"
                  value={value}
                  onChange={(e) => setSetupPresenters((prev) => prev.map((entry, entryIndex) => entryIndex === index ? e.target.value : entry))}
                  placeholder={`Nom presentateur slide ${index + 1}`}
                />
              ))}
            </div>
            <div className="presentation-setup-actions">
              <button type="button" className="presentation-slide-add" onClick={() => setSetupOpen(false)}>Annuler</button>
              <button type="button" className="presentation-slide-add presentation-slide-add-blue" disabled={!String(setupName || '').trim()} onClick={createPresentationFromSetup}>
                Creer
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="presentation-shell">
      <div className="presentation-slide-tabs">
        <button
          type="button"
          className={`presentation-slide-tab ${presentation.activeEditorTab === 'slides' ? 'active' : ''}`}
          onClick={() => patchPresentation({ activeEditorTab: 'slides' })}
        >
          Slides
        </button>
        <button
          type="button"
          className={`presentation-slide-tab ${presentation.activeEditorTab === 'qcm' ? 'active' : ''}`}
          onClick={() => patchPresentation({ activeEditorTab: 'qcm' })}
        >
          Quizz
        </button>
        <button
          type="button"
          className={`presentation-slide-tab ${presentation.activeEditorTab === 'animation' ? 'active' : ''}`}
          onClick={() => patchPresentation({ activeEditorTab: 'animation' })}
        >
          Animation
        </button>
        <button
          type="button"
          className="presentation-slide-add presentation-slide-add-red"
          onClick={() => {
            if (!window.confirm('Supprimer cette presentation ?')) return;
            onChange?.(createBlock('text'));
          }}
        >
          Supprimer
        </button>
      </div>
      <div className="presentation-canva-row">
        <input
          className="presentation-slide-title"
          value={presentation.presentationName || ''}
          onChange={(e) => patchPresentation({ presentationName: e.target.value, presentationValidated: false })}
          placeholder="Nom de la presentation"
        />
      </div>
      {presentation.activeEditorTab === 'slides' || presentation.activeEditorTab === 'animation' ? (
      <div className="presentation-canva-row">
        <input
          className="presentation-slide-title"
          value={canvaLiveUrlInput}
          onChange={(e) => setCanvaLiveUrlInput(e.target.value)}
          placeholder="Lien Canva live (optionnel)"
        />
        <label className="presentation-setup-label">
          <span>Nombre de slides:</span>
          <input
            className="presentation-size-input"
            type="number"
            min="0"
            max="300"
            value={presentation.canvaSlideCount || 0}
            onChange={(e) => {
              const nextCount = Math.max(0, Number(e.target.value || 0));
              const nextSlides = syncPresentationSlidesWithCount(presentation.slides, nextCount);
              patchPresentation({
                canvaSlideCount: nextCount,
                slides: nextSlides,
                activeSlideIndex: Math.min(presentation.activeSlideIndex, Math.max(0, nextSlides.length - 1)),
                presentationValidated: false
              });
            }}
            title="Nombre de slides Canva"
          />
        </label>
      </div>
      ) : null}
      {(presentation.activeEditorTab === 'slides' || presentation.activeEditorTab === 'animation') && presentation.canvaLiveUrl ? (
        <div className="canva-live-shell">
          {presentation.activeEditorTab === 'animation' && !currentEditorCanvaSlide?.animation ? (
            <div className="presentation-setup-actions">
              <button
                type="button"
                className="presentation-slide-add presentation-slide-add-violet"
                onClick={() => patchSlide(currentEditorCanvaSlideIndex, {
                  animation: attachAnimationMetadata(
                    createAnimationBlockFromDraft({ title: `Animation slide ${editorCanvaStep}` }),
                    presentationNumber,
                    editorCanvaStep
                  )
                })}
              >
                Creer animation pour la slide {editorCanvaStep}
              </button>
            </div>
          ) : null}
          <div className="slideshow-nav">
            <button
              type="button"
              className="presentation-slide-add"
              onClick={() => {
                const nextStep = Math.max(1, editorCanvaStep - 1);
                const nextUrl = injectSlideNumberIntoUrl(presentation.canvaLiveUrl, nextStep);
                setEditorCanvaStep(nextStep);
                setCanvaLiveUrlInput(nextUrl);
                patchPresentation({
                  canvaLiveUrl: nextUrl,
                  presentationValidated: false
                });
              }}
              disabled={editorCanvaStep <= 1}
            >
              Diapo precedente
            </button>
            <div className="slideshow-progress">
              {presentation.canvaSlideCount > 0 ? `Canva live ${editorCanvaStep}/${presentation.canvaSlideCount}` : `Canva live ${editorCanvaStep}`}
            </div>
            <button
              type="button"
              className="presentation-slide-add"
              onClick={() => {
                const nextStep = presentation.canvaSlideCount > 0
                  ? Math.min(presentation.canvaSlideCount, editorCanvaStep + 1)
                  : editorCanvaStep + 1;
                const nextUrl = injectSlideNumberIntoUrl(presentation.canvaLiveUrl, nextStep);
                setEditorCanvaStep(nextStep);
                setCanvaLiveUrlInput(nextUrl);
                patchPresentation({
                  canvaLiveUrl: nextUrl,
                  presentationValidated: false
                });
              }}
              disabled={presentation.canvaSlideCount > 0 && editorCanvaStep >= presentation.canvaSlideCount}
            >
              Diapo suivante
            </button>
          </div>
          <div className="canva-live-note">
            {`Canva live ${editorCanvaStep}/${presentation.canvaSlideCount || editorCanvaStep}.`}
            {` Presentation ${Math.max(1, Number(presentationNumber || 1))} • Slide ${editorCanvaStep}.`}
            {currentEditorCanvaSlide?.presenterName ? ` Exposant: ${currentEditorCanvaSlide.presenterName}.` : ''}
          </div>
          <div className="canva-live-frame-shell">
            <iframe
              src={presentation.canvaLiveUrl}
              title={`canva-live-editor-${presentation.presentationName || 'presentation'}`}
              className="canva-live-frame"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
            <div className="canva-live-lock-overlay" aria-hidden="true" />
            {currentEditorCanvaSlide?.presenterName ? (
              <div className="canva-live-presenter-badge">
                {formatPresenterLabel(currentEditorCanvaSlide.presenterName)}
              </div>
            ) : null}
            {presentation.activeEditorTab === 'animation' && currentEditorCanvaSlide?.animation ? (
              <div className="canva-live-animation-layer">
                <AnimationBlockEditor
                  block={attachAnimationMetadata(currentEditorCanvaSlide.animation, presentationNumber, editorCanvaStep)}
                  onChange={(nextAnimation) => patchSlide(currentEditorCanvaSlideIndex, { animation: attachAnimationMetadata(nextAnimation, presentationNumber, editorCanvaStep) })}
                  onRemove={() => patchSlide(currentEditorCanvaSlideIndex, { animation: null })}
                  readOnly={false}
                  sectionKey={sectionKey}
                  tabKey={tabKey}
                  blockIndex={blockIndex}
                  tabId={tabId}
                  entryId={entryId}
                  presentationNumber={presentationNumber}
                  slideNumber={editorCanvaStep}
                />
              </div>
            ) : null}
          </div>
          <a className="presentation-slide-add" href={presentation.canvaLiveUrl} target="_blank" rel="noreferrer">
            Ouvrir Canva dans un nouvel onglet
          </a>
        </div>
      ) : null}
      {presentation.activeEditorTab === 'slides' && presentation.canvaSlideCount > 0 ? (
        <div className="presentation-qcm-panel">
          {presentation.slides.slice(0, presentation.canvaSlideCount).map((slide, slideIndex) => (
            <div key={slide.id} className="presentation-qcm-card">
              <input
                className="presentation-presenter-short-input"
                value={slide.presenterName || ''}
                onChange={(e) => patchSlide(slideIndex, { presenterName: e.target.value })}
                placeholder={`Nom presentateur slide ${slideIndex + 1}`}
              />
            </div>
          ))}
        </div>
      ) : null}
      {presentation.activeEditorTab === 'qcm' ? (
        <div className="presentation-qcm-panel">
          {qcmQuestions.map((question, questionIndex) => (
            <div key={question.id} className="presentation-qcm-card">
              <input
                value={question.question}
                onChange={(e) => patchPresentation({
                  qcmQuestions: qcmQuestions.map((row, index) => index === questionIndex ? { ...row, question: e.target.value } : row)
                })}
                placeholder={`Question ${questionIndex + 1}`}
              />
              <div className="presentation-qcm-options">
                {(question.options || ['', '', '', '']).map((option, optionIndex) => (
                  <div key={`${question.id}_${optionIndex}`} className="presentation-qcm-option">
                    <input
                      value={option}
                      onChange={(e) => patchPresentation({
                        qcmQuestions: qcmQuestions.map((row, index) => (
                          index === questionIndex
                            ? {
                                ...row,
                                options: (row.options || ['', '', '', '']).map((entry, idx) => idx === optionIndex ? e.target.value : entry)
                              }
                            : row
                        ))
                      })}
                      placeholder={`Reponse ${optionIndex + 1}`}
                    />
                    <button
                      type="button"
                      className={Number(question.correctIndex || 0) === optionIndex ? 'presentation-qcm-correct active' : 'presentation-qcm-correct'}
                      onClick={() => patchPresentation({
                        qcmQuestions: qcmQuestions.map((row, index) => index === questionIndex ? { ...row, correctIndex: optionIndex } : row)
                      })}
                    >
                      Bonne
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="presentation-slide-add"
            onClick={() => patchPresentation({ qcmQuestions: [...qcmQuestions, createQcmQuestion(qcmQuestions.length)] })}
          >
            + Question QCM
          </button>
        </div>
      ) : presentation.activeEditorTab === 'slides' ? (
        <>
      <div className="presentation-setup-actions">
        <button
          type="button"
          className="presentation-slide-add presentation-slide-add-violet"
          onClick={() => patchPresentation({
            canvaLiveUrl: normalizeCanvaLiveUrl(canvaLiveUrlInput),
            presentationValidated: false
          })}
        >
          Enregistrer Canva
        </button>
      </div>
      {activeMiniMenu === 'color' ? (
        <div className="presentation-pop-panel">
          {ARTICLE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`article-color-dot ${selectedColor === color ? 'active' : ''}`}
              style={{ background: color }}
              onClick={() => applyColor(color)}
            />
          ))}
        </div>
      ) : null}
      {activeMiniMenu === 'background' ? (
        <div className="presentation-pop-panel">
          {SLIDE_BACKGROUNDS.map((color) => (
            <button
              key={color}
              type="button"
              className="article-color-dot"
              style={{ background: color, borderColor: color === '#ffffff' ? '#cbd5e1' : '#ffffff' }}
              onClick={() => patchSlide(presentation.activeSlideIndex, { background: color })}
            />
          ))}
        </div>
      ) : null}
      {activeMiniMenu === 'image' ? (
        <div className="presentation-pop-panel">
          <input
            className="presentation-slide-title presentation-image-url-input"
            value={imageUrlInput}
            onChange={(e) => setImageUrlInput(e.target.value)}
            placeholder="URL de l'image"
          />
          <button type="button" onClick={() => insertImageFromUrl(imageUrlInput)}>URL image</button>
          <button type="button" onClick={() => imageFileInputRef.current?.click()}>Importer image</button>
        </div>
      ) : null}
      <div
        ref={canvasRef}
        className={`presentation-canvas ${drawTextMode ? 'draw-text-mode' : ''}`}
        style={{ background: activeSlide?.background || '#ffffff', color: activeSlide?.background === '#1d2942' ? '#ffffff' : '#1d2942' }}
        onClick={() => setActiveTextBoxId('')}
        onMouseDown={(e) => {
          if (!drawTextMode || !canvasRef.current || e.target !== canvasRef.current) return;
          const rect = canvasRef.current.getBoundingClientRect();
          const startX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
          const startY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
          drawStateRef.current = { startX, startY };
          setDraftTextBox({ x: startX, y: startY, width: 80, height: 48 });
        }}
      >
        <div
          ref={editorRef}
          className="article-editor presentation-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => {
            const nextHtml = e.currentTarget.innerHTML;
            lastHtmlRef.current = nextHtml;
            patchSlide(presentation.activeSlideIndex, { html: nextHtml });
          }}
        />
        {(activeSlide?.textBoxes || []).map((box) => (
          <div
            key={box.id}
            className={`presentation-text-box ${activeTextBoxId === box.id ? 'active' : ''}`}
            style={{ left: box.x, top: box.y, width: box.width, height: box.height, fontSize: `${box.fontSize || 28}px` }}
            onMouseDown={(e) => {
              e.stopPropagation();
              setActiveTextBoxId(box.id);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTextBoxId(box.id);
            }}
          >
            <div
              className="presentation-text-box-editor"
              contentEditable
              suppressContentEditableWarning
              onFocus={() => setActiveTextBoxId(box.id)}
              onInput={(e) => updateTextBox(box.id, { text: e.currentTarget.innerHTML })}
              dangerouslySetInnerHTML={{ __html: box.text || '' }}
            />
          </div>
        ))}
        {draftTextBox ? (
          <div
            className="presentation-text-box draft"
            style={{ left: draftTextBox.x, top: draftTextBox.y, width: draftTextBox.width, height: draftTextBox.height, fontSize: `${fontSize}px` }}
          />
        ) : null}
        {activeSlide?.animation ? (
          <AnimationBlockEditor
            block={activeSlide.animation}
            onChange={(nextAnimation) => patchSlide(presentation.activeSlideIndex, { animation: nextAnimation })}
            onRemove={() => patchSlide(presentation.activeSlideIndex, { animation: null })}
            readOnly={false}
            sectionKey={sectionKey}
            tabKey={tabKey}
            blockIndex={blockIndex}
            tabId={tabId}
            entryId={entryId}
          />
        ) : null}
        {activeSlide?.presenterName ? (
          <div className="presentation-slide-signature">Presentateur: {formatPresenterLabel(activeSlide.presenterName)}</div>
        ) : null}
      </div>
      </>
      ) : null}
      <div className="presentation-validation-bar">
        <div className="presentation-validation-status">
          {slidesValidCount}/{presentation.slides.length || 0} slides valides • {qcmValidCount} questions QCM valides
        </div>
        {presentationNameAlreadyUsed ? <div className="presentation-validation-warning">Ce nom de presentation existe deja dans cet onglet.</div> : null}
        {validatedFlash ? <div className="presentation-validated-flash">Presentation validee</div> : null}
        <button
          type="button"
          className={`primary-btn ${canValidatePresentation ? '' : 'disabled-btn'}`}
          disabled={!canValidatePresentation}
          onClick={() => {
            patchPresentation({ presentationValidated: true });
            setValidatedFlash(true);
            window.setTimeout(() => setValidatedFlash(false), 1000);
          }}
        >
          Valider ma presentation
        </button>
      </div>
    </div>
  );
}

function PublicPresentationViewer({ presentation, sectionKey = '', tabKey = '', blockIndex = 0, tabId = '', entryId = '', mode = 'browse', presentationNumber = 0 }) {
  const normalized = useMemo(() => normalizePresentationBlock(presentation), [presentation]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState('slides');
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [slideshowStep, setSlideshowStep] = useState(0);
  const [canvaStep, setCanvaStep] = useState(1);
  const [canvaRuntimeUrl, setCanvaRuntimeUrl] = useState(normalized.canvaLiveUrl || '');
  const [canvaPlaying, setCanvaPlaying] = useState(mode === 'canva');
  const activeSlide = normalized.slides[activeIndex] || normalized.slides[0];
  const qcmQuestions = Array.isArray(normalized.qcmQuestions) ? normalized.qcmQuestions : [];
  const hasQcmTab = qcmQuestions.length > 0;
  const isSlideshow = mode === 'slideshow';
  const isCanvaLive = mode === 'canva';
  const hasCanvaLive = Boolean(normalized.canvaLiveUrl);
  const detectedCanvaStep = extractSlideNumberFromUrl(normalized.canvaLiveUrl);
  const canvaBaseStep = detectedCanvaStep || 1;
  const currentCanvaSlide = normalized.slides[Math.max(0, Math.min(canvaStep - 1, normalized.slides.length - 1))] || null;
  const totalSteps = normalized.slides.length + (hasQcmTab ? 1 : 0);
  const showingQcm = isSlideshow ? (hasQcmTab && slideshowStep === normalized.slides.length) : activeTab === 'qcm';
  const slideshowSlide = normalized.slides[Math.min(slideshowStep, Math.max(0, normalized.slides.length - 1))] || normalized.slides[0];
  const visibleSlide = isSlideshow ? slideshowSlide : activeSlide;
  const quizQuestion = qcmQuestions[quizIndex] || null;
  const quizScore = quizAnswers.filter((entry) => entry?.isCorrect).length;
  const quizPassed = quizCompleted && quizScore === qcmQuestions.length && qcmQuestions.length > 0;

  useEffect(() => {
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuizCompleted(false);
  }, [normalized.presentationName, qcmQuestions.length]);

  useEffect(() => {
    setSlideshowStep(0);
    setActiveIndex(0);
    setActiveTab('slides');
  }, [normalized.presentationName, normalized.slides.length, isSlideshow]);

  useEffect(() => {
    setCanvaStep(1);
  }, [normalized.presentationName, normalized.canvaLiveUrl, normalized.canvaSlideCount]);

  useEffect(() => {
    if (detectedCanvaStep) {
      setCanvaStep(detectedCanvaStep);
    }
  }, [detectedCanvaStep]);

  useEffect(() => {
    const baseStep = detectedCanvaStep || 1;
    setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, baseStep));
  }, [normalized.canvaLiveUrl, detectedCanvaStep]);

  useEffect(() => {
    setCanvaPlaying(mode === 'canva');
  }, [mode, normalized.presentationName]);

  const restartQuiz = () => {
    setQuizIndex(0);
    setQuizAnswers([]);
    setQuizCompleted(false);
  };

  const submitQuizAnswer = (optionIndex) => {
    if (!quizQuestion || quizCompleted) return;
    const correctIndex = Number(quizQuestion.correctIndex || 0);
    const chosenAnswer = String((quizQuestion.options || [])[optionIndex] || '').trim();
    const correctAnswer = String((quizQuestion.options || [])[correctIndex] || '').trim();
    const isCorrect = optionIndex === correctIndex;
    const nextAnswers = [
      ...quizAnswers,
      {
        questionId: quizQuestion.id,
        isCorrect,
        chosenAnswer,
        correctAnswer
      }
    ];
    setQuizAnswers(nextAnswers);
    if (quizIndex >= qcmQuestions.length - 1) {
      setQuizCompleted(true);
      return;
    }
    setQuizIndex((prev) => prev + 1);
  };

  return (
    <div className="public-presentation-viewer">
      <div className="public-presentation-head">
        <div className="eyebrow">Presentation validee</div>
        <h3>{normalized.presentationName || 'Presentation'}</h3>
      </div>
      {isCanvaLive ? (
        <div className="slideshow-nav">
          <button
            type="button"
            className={`presentation-slide-add ${canvaPlaying ? 'presentation-slide-add-red' : ''}`}
            onClick={() => {
              if (canvaPlaying) {
                setCanvaPlaying(false);
                setCanvaStep(canvaBaseStep);
                setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, canvaBaseStep));
                return;
              }
              setCanvaPlaying(true);
              setCanvaStep(1);
              setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, 1));
            }}
          >
            {canvaPlaying ? 'Stop' : 'Play'}
          </button>
          <button
            type="button"
            className="presentation-slide-add"
            onClick={() => {
              const nextStep = Math.max(1, canvaStep - 1);
              setCanvaStep(nextStep);
              setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, nextStep));
            }}
            disabled={!canvaPlaying || canvaStep <= 1}
          >
            Diapo precedente
          </button>
          <div className="slideshow-progress">
            {normalized.canvaSlideCount > 0 ? `Canva live ${canvaStep}/${normalized.canvaSlideCount}` : `Canva live ${canvaStep}`}
            {currentCanvaSlide?.presenterName ? ` • ${currentCanvaSlide.presenterName}` : ''}
          </div>
          <button
            type="button"
            className="presentation-slide-add"
            onClick={() => {
              const nextStep = normalized.canvaSlideCount > 0
                ? Math.min(normalized.canvaSlideCount, canvaStep + 1)
                : canvaStep + 1;
              setCanvaStep(nextStep);
              setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, nextStep));
            }}
            disabled={!canvaPlaying || (normalized.canvaSlideCount > 0 && canvaStep >= normalized.canvaSlideCount)}
          >
            Diapo suivante
          </button>
        </div>
      ) : isSlideshow ? (
        <div className="slideshow-nav">
          <button
            type="button"
            className="presentation-slide-add"
            onClick={() => setSlideshowStep((prev) => Math.max(0, prev - 1))}
            disabled={slideshowStep <= 0}
          >
            Diapo precedente
          </button>
          <div className="slideshow-progress">
            {showingQcm ? `Etape ${totalSteps}/${totalSteps} : QCM` : `Diapo ${slideshowStep + 1}/${totalSteps}`}
          </div>
          <button
            type="button"
            className="presentation-slide-add"
            onClick={() => setSlideshowStep((prev) => Math.min(totalSteps - 1, prev + 1))}
            disabled={showingQcm || slideshowStep >= totalSteps - 1}
          >
            Diapo suivante
          </button>
        </div>
      ) : (
        <div className="presentation-slide-tabs">
          {normalized.slides.map((slide, index) => (
            <button
              key={slide.id}
              type="button"
              className={`presentation-slide-tab ${activeTab === 'slides' && index === activeIndex ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('slides');
                setActiveIndex(index);
              }}
            >
              {`Slide ${index + 1}`}
            </button>
          ))}
          {hasQcmTab ? (
            <button
              type="button"
              className={`presentation-slide-tab ${activeTab === 'qcm' ? 'active' : ''}`}
              onClick={() => setActiveTab('qcm')}
            >
              QCM
            </button>
          ) : null}
        </div>
      )}
      {isCanvaLive ? (
        <div className="canva-live-shell">
          <div className="canva-live-note">
            Slide detectee depuis l URL : {detectedCanvaStep || '?'}.
            URL runtime : {canvaRuntimeUrl || normalized.canvaLiveUrl || 'aucune'}.
            {currentCanvaSlide?.presenterName ? ` Exposant: ${currentCanvaSlide.presenterName}.` : ''}
          </div>
          <div className="canva-live-frame-shell">
            <iframe
              src={canvaRuntimeUrl || normalized.canvaLiveUrl}
              title={`canva-live-${normalized.presentationName || 'presentation'}`}
              className="canva-live-frame"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
            />
            <div className="canva-live-lock-overlay" aria-hidden="true" />
            {currentCanvaSlide?.presenterName ? (
              <div className="canva-live-presenter-badge">
                {formatPresenterLabel(currentCanvaSlide.presenterName)}
              </div>
            ) : null}
          </div>
          <a className="presentation-slide-add" href={canvaRuntimeUrl || normalized.canvaLiveUrl} target="_blank" rel="noreferrer">
            Ouvrir Canva dans un nouvel onglet
          </a>
        </div>
      ) : showingQcm ? (
        <div className="public-quiz-shell">
          {quizCompleted ? (
            <div className={`public-quiz-result ${quizPassed ? 'success' : 'failure'}`}>
              <div className="public-quiz-kicker">Quiz termine</div>
              <h4>{quizPassed ? 'Tu as reussi le quiz' : 'Tu n as pas reussi le quiz'}</h4>
              <p>
                Score: {quizScore}/{qcmQuestions.length}
              </p>
              {quizPassed ? null : (
                <div className="public-quiz-corrections">
                  {quizAnswers.filter((entry) => !entry.isCorrect).map((entry, index) => (
                    <div key={`${entry.questionId}_${index}`} className="public-quiz-correction">
                      La reponse etait : {entry.correctAnswer || 'Aucune reponse definie'}
                    </div>
                  ))}
                </div>
              )}
              <button type="button" className="public-quiz-restart" onClick={restartQuiz}>
                Retour au debut du quiz
              </button>
            </div>
          ) : quizQuestion ? (
            <div className="public-quiz-card">
              <div className="public-quiz-progress">Question {quizIndex + 1} / {qcmQuestions.length}</div>
              <h4>{quizQuestion.question || `Question ${quizIndex + 1}`}</h4>
              <div className="public-quiz-options">
                {(quizQuestion.options || ['', '', '', '']).map((option, optionIndex) => (
                  <button
                    key={`${quizQuestion.id}_${optionIndex}`}
                    type="button"
                    className="public-quiz-option"
                    onClick={() => submitQuizAnswer(optionIndex)}
                  >
                    <span className="public-quiz-option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{option || `Reponse ${optionIndex + 1}`}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="public-quiz-result failure">
              <div className="public-quiz-kicker">Quiz indisponible</div>
              <h4>Aucune question QCM disponible</h4>
            </div>
          )}
        </div>
      ) : (
        <div className="presentation-canvas" style={{ background: visibleSlide?.background || '#ffffff', color: visibleSlide?.background === '#1d2942' ? '#ffffff' : '#1d2942' }}>
          <div className="public-text article-render" dangerouslySetInnerHTML={{ __html: visibleSlide?.html || '' }} />
          {(visibleSlide?.textBoxes || []).map((box) => (
            <div
              key={box.id}
              className="presentation-text-box readonly"
              style={{ left: box.x, top: box.y, width: box.width, height: box.height, fontSize: `${box.fontSize || 28}px` }}
              dangerouslySetInnerHTML={{ __html: box.text || '' }}
            />
          ))}
          {visibleSlide?.animation ? (
            <AnimationBlockEditor
              block={attachAnimationMetadata(visibleSlide.animation, presentationNumber, (isSlideshow ? slideshowStep : activeIndex) + 1)}
              onChange={() => {}}
              onRemove={() => {}}
              readOnly
              sectionKey={sectionKey}
              tabKey={tabKey}
              blockIndex={blockIndex}
              tabId={tabId}
              entryId={entryId}
              presentationNumber={presentationNumber}
              slideNumber={(isSlideshow ? slideshowStep : activeIndex) + 1}
            />
          ) : null}
          {visibleSlide?.presenterName ? (
            <div className="presentation-slide-signature">Presentateur: {formatPresenterLabel(visibleSlide.presenterName)}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function formatContributionName(name = '') {
  const raw = String(name || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const parts = raw.split(' ');
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  if (!lastName) return firstName;
  return `${firstName} ${lastName.slice(0, 3)}`;
}

function AnimationBlockEditor({ block, onChange, onRemove, readOnly, sectionKey = '', tabKey = '', blockIndex = 0, tabId = '', entryId = '', presentationNumber = 0, slideNumber = 0 }) {
  const overlayRef = useRef(null);
  const actionFileInputRefs = useRef({});
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const actorDragStateRef = useRef(null);
  const actorResizeStateRef = useRef(null);
  const spriteResizeStateRef = useRef(null);
  const actionLoopStopRef = useRef({ stop: false, actionId: '' });
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingActionId, setPlayingActionId] = useState('');
  const [recordingActionId, setRecordingActionId] = useState('');
  const [importNotice, setImportNotice] = useState('');
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const [actionNameDrafts, setActionNameDrafts] = useState({});
  const [actorState, setActorState] = useState({
    x: Number(block?.actorX || 120),
    y: Number(block?.actorY || 120),
    width: Number(block?.actorWidth || 140),
    height: Number(block?.actorHeight || 140),
    frameUrl: String(block?.actorImageUrl || ''),
    actionName: ''
  });

  const actions = Array.isArray(block?.actions) && block.actions.length > 0
    ? block.actions
    : [{ id: `action_${Date.now()}`, name: 'Parler', frames: [], frameUrlInput: '', soundUrl: '', spritesOpen: false, spriteUrlOpen: false, spriteEditorOpen: false, selectedFrameIndex: 0 }];

  useEffect(() => {
    setActionNameDrafts((prev) => {
      const next = {};
      actions.forEach((action) => {
        next[action.id] = Object.prototype.hasOwnProperty.call(prev, action.id)
          ? prev[action.id]
          : String(action.name || '');
      });
      return next;
    });
  }, [actions.map((action) => action.id).join('|')]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const hasDiff = actions.some((action) => String(action.name || '') !== String(actionNameDrafts[action.id] ?? ''));
      if (!hasDiff) return;
      updateActions(actions.map((action) => ({
        ...action,
        name: String(actionNameDrafts[action.id] ?? action.name ?? '')
      })));
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [actionNameDrafts]);

  useEffect(() => {
    const selectedAction = actions.find((action) => Number(action?.selectedFrameIndex) >= -1);
    const selectedFrameIndex = Number(selectedAction?.selectedFrameIndex);
    const selectedFrame = selectedFrameIndex === -1
      ? {
          url: String(block?.actorImageUrl || ''),
          width: Number(block?.actorWidth || 140),
          height: Number(block?.actorHeight || 140),
          scale: Number(block?.actorScale || 1),
          offsetX: Number(block?.actorOffsetX || 0),
          offsetY: Number(block?.actorOffsetY || 0)
        }
      : (selectedFrameIndex >= 0 ? selectedAction?.frames?.[selectedFrameIndex] : null);
    const normalizedSelectedFrame = typeof selectedFrame === 'string' ? createSpriteFrame(selectedFrame) : selectedFrame;
    setActorState({
      x: Number(block?.actorX || 120),
      y: Number(block?.actorY || 120),
      width: Number(normalizedSelectedFrame?.width || block?.actorWidth || 140),
      height: Number(normalizedSelectedFrame?.height || block?.actorHeight || 140),
      frameUrl: String(
        normalizedSelectedFrame?.url
        || block?.actorImageUrl
        || (typeof actions[0]?.frames?.[0] === 'string' ? actions[0]?.frames?.[0] : actions[0]?.frames?.[0]?.url)
        || ''
      ),
      actionName: ''
    });
    setIsPlaying(false);
  }, [block, actions]);

  useEffect(() => {
    const onMouseMove = (event) => {
      const shellRect = overlayRef.current?.getBoundingClientRect();
      if (!shellRect) return;
      const dragState = actorDragStateRef.current;
      if (dragState) {
        const nextX = Math.max(0, event.clientX - shellRect.left - dragState.x);
        const nextY = Math.max(0, event.clientY - shellRect.top - dragState.y);
        setActorState((prev) => ({ ...prev, x: nextX, y: nextY }));
      }
      const resizeState = actorResizeStateRef.current;
      if (resizeState) {
        const deltaX = event.clientX - resizeState.startX;
        const deltaY = event.clientY - resizeState.startY;
        const signX = resizeState.corner.includes('w') ? -1 : 1;
        const signY = resizeState.corner.includes('n') ? -1 : 1;
        const nextWidth = Math.max(48, Math.round(resizeState.startWidth + (deltaX * signX)));
        const nextHeight = Math.max(48, Math.round(resizeState.startHeight + (deltaY * signY)));
        const widthDelta = nextWidth - resizeState.startWidth;
        const heightDelta = nextHeight - resizeState.startHeight;
        setActorState((prev) => ({
          ...prev,
          width: nextWidth,
          height: nextHeight,
          x: resizeState.corner.includes('w') ? resizeState.startLeft - widthDelta : resizeState.startLeft,
          y: resizeState.corner.includes('n') ? resizeState.startTop - heightDelta : resizeState.startTop
        }));
      }
      const spriteResizeState = spriteResizeStateRef.current;
      if (spriteResizeState) {
        const deltaX = event.clientX - spriteResizeState.startX;
        const deltaY = event.clientY - spriteResizeState.startY;
        const signX = spriteResizeState.corner.includes('w') ? -1 : 1;
        const signY = spriteResizeState.corner.includes('n') ? -1 : 1;
        const nextWidth = Math.max(40, Math.round(spriteResizeState.startWidth + (deltaX * signX)));
        const nextHeight = Math.max(40, Math.round(spriteResizeState.startHeight + (deltaY * signY)));
        if (spriteResizeState.frameIndex === -1) {
          updateRoot({ actorWidth: nextWidth, actorHeight: nextHeight });
          setActorState((prev) => ({ ...prev, width: nextWidth, height: nextHeight }));
        } else {
          updateFrame(spriteResizeState.actionId, spriteResizeState.frameIndex, {
            width: nextWidth,
            height: nextHeight
          });
        }
      }
    };
    const onMouseUp = () => {
      const dragState = actorDragStateRef.current;
      if (dragState) {
        actorDragStateRef.current = null;
        updateRoot({ actorX: Math.round(actorState.x), actorY: Math.round(actorState.y) });
      }
      const resizeState = actorResizeStateRef.current;
      if (resizeState) {
        actorResizeStateRef.current = null;
        updateRoot({
          actorWidth: Math.round(actorState.width),
          actorHeight: Math.round(actorState.height),
          actorX: Math.round(actorState.x),
          actorY: Math.round(actorState.y)
        });
      }
      if (spriteResizeStateRef.current) {
        spriteResizeStateRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [actorState.x, actorState.y, actorState.width, actorState.height, actions]);

  const savedActions = Array.isArray(block?.savedActions) ? block.savedActions : [];
  const updateRoot = (patch) => onChange?.({ ...block, ...patch, actions, savedActions });
  const updateActions = (nextActions) => onChange?.({ ...block, actions: nextActions });
  const updateSavedActions = (nextSavedActions) => onChange?.({ ...block, actions, savedActions: nextSavedActions });

  const flashNotice = (message) => {
    setImportNotice(message);
    window.setTimeout(() => setImportNotice(''), 1800);
  };

  const readFilesAsDataUrls = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    return Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    })));
  };

  const appendFrames = async (actionId, fileList) => {
    const urls = (await readFilesAsDataUrls(fileList)).filter(Boolean);
    if (urls.length === 0) {
      flashNotice("Import sprite impossible");
      return;
    }
    updateActions(actions.map((action) => action.id === actionId ? { ...action, frames: [...(action.frames || []), ...urls.map(createSpriteFrame)] } : action));
    flashNotice("Sprite importé");
  };

  const updateAction = (actionId, patch) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, ...patch } : action));
  };

  const addAction = () => {
    updateActions([
      ...actions,
      { id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `Action ${actions.length + 1}`, frames: [], frameUrlInput: '', soundUrl: '', spritesOpen: false, spriteUrlOpen: false, spriteEditorOpen: false, selectedFrameIndex: 0 }
    ]);
  };

  const saveActionPreset = (action) => {
    if (!action?.id) return;
    const nextPreset = {
      id: `saved_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: String(action.name || 'Action').trim() || 'Action',
      frames: Array.isArray(action.frames) ? action.frames.map((frame) => ({
        id: `saved_frame_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        url: typeof frame === 'string' ? frame : String(frame?.url || ''),
        width: Number(frame?.width || 140),
        height: Number(frame?.height || 140),
        scale: Number(frame?.scale || 1),
        offsetX: Number(frame?.offsetX || 0),
        offsetY: Number(frame?.offsetY || 0)
      })).filter((frame) => frame.url) : []
    };
    const withoutSameName = savedActions.filter((item) => clean(item.name) !== clean(nextPreset.name));
    updateSavedActions([...withoutSameName, nextPreset]);
    flashNotice('Action chargeable ajoutée');
  };

  const loadSavedAction = (presetId) => {
    const preset = savedActions.find((item) => item.id === presetId);
    if (!preset) return;
    const targetActionId = actions[0]?.id;
    if (!targetActionId) return;
    updateActions(actions.map((action) => (
      action.id === targetActionId
        ? {
            ...action,
            name: preset.name,
            frames: Array.isArray(preset.frames) ? [...preset.frames] : [],
            frameUrlInput: '',
            soundUrl: '',
            spritesOpen: false,
            spriteUrlOpen: false,
            spriteEditorOpen: false,
            selectedFrameIndex: 0
          }
        : action
    )));
    setLoadMenuOpen(false);
    flashNotice('Action chargée');
  };

  const removeAction = (actionId) => {
    if (actions.length <= 1) return;
    updateActions(actions.filter((action) => action.id !== actionId));
  };

  const removeFrame = (actionId, frameIndex) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, frames: (action.frames || []).filter((_, index) => index !== frameIndex), selectedFrameIndex: Math.max(0, Math.min((action.selectedFrameIndex || 0), (action.frames || []).length - 2)) } : action));
  };

  const toggleSpritesOpen = (actionId) => {
    updateActions(actions.map((action) => (
      action.id === actionId
        ? {
            ...action,
            spritesOpen: !action.spritesOpen,
            spriteEditorOpen: action.spritesOpen ? false : action.spriteEditorOpen,
            spriteUrlOpen: action.spritesOpen ? false : action.spriteUrlOpen
          }
        : action
    )));
  };

  const toggleSpriteUrlOpen = (actionId) => {
    updateActions(actions.map((action) => (
      action.id === actionId
        ? { ...action, spriteUrlOpen: !action.spriteUrlOpen }
        : action
    )));
  };

  const toggleSpriteEditorOpen = (actionId) => {
    updateActions(actions.map((action) => (
      action.id === actionId ? { ...action, spriteEditorOpen: !action.spriteEditorOpen } : action
    )));
  };

  const selectFrame = (actionId, frameIndex) => {
    const action = actions.find((item) => item.id === actionId);
    const frame = action?.frames?.[frameIndex];
    const normalizedFrame = typeof frame === 'string' ? createSpriteFrame(frame) : frame;
    if (normalizedFrame?.url) {
      setActorState((prev) => ({
        ...prev,
        frameUrl: normalizedFrame.url,
        width: Number(normalizedFrame.width || prev.width || 140),
        height: Number(normalizedFrame.height || prev.height || 140)
      }));
    }
    updateActions(actions.map((actionItem) => (
      actionItem.id === actionId ? { ...actionItem, selectedFrameIndex: frameIndex } : actionItem
    )));
  };

  const selectOriginalActor = (actionId) => {
    setActorState((prev) => ({
      ...prev,
      frameUrl: String(block?.actorImageUrl || ''),
      width: Number(block?.actorWidth || prev.width || 140),
      height: Number(block?.actorHeight || prev.height || 140)
    }));
    updateActions(actions.map((actionItem) => (
      actionItem.id === actionId ? { ...actionItem, selectedFrameIndex: -1 } : actionItem
    )));
  };

  const updateFrame = (actionId, frameIndex, patch) => {
    const action = actions.find((item) => item.id === actionId);
    if (action?.selectedFrameIndex === frameIndex) {
      if (patch.url || patch.width || patch.height) {
        setActorState((prev) => ({
          ...prev,
          frameUrl: patch.url || prev.frameUrl,
          width: Number(patch.width || prev.width || 140),
          height: Number(patch.height || prev.height || 140)
        }));
      }
    }
    updateActions(actions.map((action) => (
      action.id === actionId
        ? {
            ...action,
            frames: (action.frames || []).map((frame, index) => (
              index === frameIndex
                ? { ...(typeof frame === 'string' ? createSpriteFrame(frame) : frame), ...patch }
                : (typeof frame === 'string' ? createSpriteFrame(frame) : frame)
            ))
          }
        : action
    )));
  };

  const applyPendingMedia = async ({ token, actionId, pendingFrames, pendingSoundUrl }) => {
    const action = actions.find((item) => item.id === actionId);
    if (!action) return false;
    const existingUrls = new Set((Array.isArray(action.frames) ? action.frames : []).map((frame) => String((typeof frame === 'string' ? frame : frame?.url) || '')));
    const incomingFrames = (Array.isArray(pendingFrames) ? pendingFrames : []).filter((frame) => {
      const url = String(frame?.url || '');
      return url && !existingUrls.has(url);
    });
    const nextSoundUrl = String(pendingSoundUrl || '').trim();
    const shouldMerge = incomingFrames.length > 0 || (nextSoundUrl && nextSoundUrl !== String(action.soundUrl || '').trim());
    if (!shouldMerge) {
      await fetch(`/api/web5e/mobile-action-consume/${encodeURIComponent(String(token || ''))}`, { method: 'POST' }).catch(() => {});
      return false;
    }
    const nextActions = actions.map((item) => (
      item.id === actionId
        ? {
            ...item,
            soundUrl: nextSoundUrl || item.soundUrl || '',
            frames: [...(Array.isArray(item.frames) ? item.frames : []), ...incomingFrames]
          }
        : item
    ));
    updateActions(nextActions);
    return true;
  };

  const nudgeFrame = (actionId, frameIndex, deltaX, deltaY) => {
    const action = actions.find((item) => item.id === actionId);
    const frame = action?.frames?.[frameIndex];
    const normalizedFrame = typeof frame === 'string' ? createSpriteFrame(frame) : frame;
    updateFrame(actionId, frameIndex, {
      offsetX: Number(normalizedFrame?.offsetX || 0) + deltaX,
      offsetY: Number(normalizedFrame?.offsetY || 0) + deltaY
    });
  };

  const adjustFrameScale = (actionId, frameIndex, delta) => {
    const action = actions.find((item) => item.id === actionId);
    const frame = action?.frames?.[frameIndex];
    const normalizedFrame = typeof frame === 'string' ? createSpriteFrame(frame) : frame;
    updateFrame(actionId, frameIndex, {
      scale: Math.max(0.2, Math.min(4, Number(normalizedFrame?.scale || 1) + delta))
    });
  };

  const autoCutoutActionSprites = async (actionId) => {
    const action = actions.find((item) => item.id === actionId);
    if (!action) return;
    const nextFrames = await Promise.all((action.frames || []).map(async (frame) => {
      const normalizedFrame = typeof frame === 'string' ? createSpriteFrame(frame) : frame;
      const nextUrl = await autoRemoveBgFromDataUrl(String(normalizedFrame?.url || ''));
      return { ...normalizedFrame, url: nextUrl };
    }));
    const nextActorUrl = block?.actorImageUrl ? await autoRemoveBgFromDataUrl(String(block.actorImageUrl || '')) : block?.actorImageUrl;
    onChange?.({
      ...block,
      actorImageUrl: nextActorUrl || '',
      actions: actions.map((item) => (
        item.id === actionId ? { ...item, frames: nextFrames } : item
      ))
    });
    if (Number(action.selectedFrameIndex) === -1 && nextActorUrl) {
      setActorState((prev) => ({ ...prev, frameUrl: nextActorUrl }));
    }
    flashNotice('Detourage applique');
  };

  const startSpriteResize = (event, actionId, frameIndex, corner) => {
    const action = actions.find((item) => item.id === actionId);
    const frame = frameIndex === -1
      ? { url: String(block?.actorImageUrl || ''), width: Number(block?.actorWidth || actorState.width || 140), height: Number(block?.actorHeight || actorState.height || 140) }
      : action?.frames?.[frameIndex];
    const normalizedFrame = typeof frame === 'string' ? createSpriteFrame(frame) : frame;
    if (!normalizedFrame) return;
    spriteResizeStateRef.current = {
      actionId,
      frameIndex,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: Number(normalizedFrame.width || 140),
      startHeight: Number(normalizedFrame.height || 140)
    };
    event.preventDefault();
    event.stopPropagation();
  };

  const handleEditorImageMouseDown = (event, actionId, frameIndex) => {
    startSpriteResize(event, actionId, frameIndex, 'se');
  };

  const startDragActor = (event) => {
    if (readOnly) return;
    if (event.target.closest('.animation-actor-resizer')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    actorDragStateRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
    event.preventDefault();
  };

  const startResizeActor = (event, corner) => {
    if (readOnly) return;
    actorResizeStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startWidth: Number(actorState.width || 140),
      startHeight: Number(actorState.height || 140),
      startLeft: Number(actorState.x || 0),
      startTop: Number(actorState.y || 0),
      corner
    };
    event.preventDefault();
    event.stopPropagation();
  };

  const handleActorFile = async (fileList) => {
    const urls = await readFilesAsDataUrls(fileList);
    if (!urls[0]) {
      flashNotice("Import sprite impossible");
      return;
    }
    updateRoot({ actorImageUrl: urls[0] });
    flashNotice("Sprite principal importé");
  };

  const importActorFromValue = (value) => {
    const safeValue = String(value || '').trim();
    if (!safeValue) {
      flashNotice("Aucune image détectée");
      return;
    }
    updateRoot({ actorImageUrl: safeValue });
    flashNotice("Sprite principal importé");
  };

  const importActionFrameFromValue = (actionId, value) => {
    const safeValue = String(value || '').trim();
    if (!safeValue) {
      flashNotice("Aucune image détectée");
      return;
    }
    updateActions(actions.map((item) => item.id === actionId ? { ...item, frames: [...(item.frames || []), createSpriteFrame(safeValue)], frameUrlInput: '' } : item));
    flashNotice("Sprite importé");
  };

  const toggleRecord = async (actionId) => {
    if (recordingActionId === actionId && recorderRef.current) {
      recorderRef.current.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recorderChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => updateAction(actionId, { soundUrl: String(reader.result || '') });
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderChunksRef.current = [];
        setRecordingActionId('');
      };
      recorderRef.current = recorder;
      setRecordingActionId(actionId);
      recorder.start();
    } catch (_) {}
  };

  const playAnimation = async (customActions = null) => {
    if (isPlaying) return;
    setIsPlaying(true);
    const sequence = Array.isArray(customActions) && customActions.length > 0 ? customActions : actions;
    for (const action of sequence) {
      const frames = Array.isArray(action.frames) && action.frames.length > 0
        ? action.frames.map((frame) => (typeof frame === 'string' ? frame : frame?.url)).filter(Boolean)
        : [block?.actorImageUrl].filter(Boolean);
      let frameIndex = 0;
      setActorState((prev) => ({
        ...prev,
        frameUrl: String(frames[0] || block?.actorImageUrl || ''),
        actionName: action.name || 'Action'
      }));
      let frameTimer = null;
      if (frames.length > 1) {
        frameTimer = window.setInterval(() => {
          frameIndex = (frameIndex + 1) % frames.length;
          setActorState((prev) => ({ ...prev, frameUrl: String(frames[frameIndex] || '') }));
        }, 180);
      }
      let audio = null;
      if (action.soundUrl) {
        try {
          audio = new Audio(action.soundUrl);
          audio.playbackRate = 1.12;
          audio.play().catch(() => {});
        } catch (_) {}
      }
      if (audio) {
        await new Promise((resolve) => {
          const onEnded = () => resolve(0);
          audio.addEventListener('ended', onEnded, { once: true });
          audio.addEventListener('error', onEnded, { once: true });
          const fallback = window.setTimeout(() => resolve(0), 10000);
          audio.addEventListener('ended', () => window.clearTimeout(fallback), { once: true });
          audio.addEventListener('error', () => window.clearTimeout(fallback), { once: true });
        });
      } else {
        await new Promise((resolve) => window.setTimeout(resolve, Math.max(800, frames.length * 220)));
      }
      if (frameTimer) window.clearInterval(frameTimer);
      if (audio) {
        try {
          audio.pause();
          audio.currentTime = 0;
        } catch (_) {}
      }
    }
    setActorState((prev) => ({ ...prev, actionName: '' }));
    setIsPlaying(false);
  };

  const toggleActionLoop = async (action) => {
    if (!action?.id) return;
    if (playingActionId === action.id) {
      actionLoopStopRef.current = { stop: true, actionId: action.id };
      setPlayingActionId('');
      return;
    }
    if (isPlaying) return;
    actionLoopStopRef.current = { stop: false, actionId: action.id };
    setPlayingActionId(action.id);
    while (!actionLoopStopRef.current.stop && actionLoopStopRef.current.actionId === action.id) {
      // eslint-disable-next-line no-await-in-loop
      await playAnimation([action]);
    }
    setPlayingActionId('');
    actionLoopStopRef.current = { stop: false, actionId: '' };
  };

  const selectedAction = actions.find((action) => Number(action?.selectedFrameIndex) >= -1) || null;
  const selectedFrameIndex = Number(selectedAction?.selectedFrameIndex);
  const selectedFrameData = selectedFrameIndex === -1
    ? {
        url: String(block?.actorImageUrl || ''),
        width: Number(block?.actorWidth || actorState.width || 140),
        height: Number(block?.actorHeight || actorState.height || 140),
        scale: Number(block?.actorScale || 1),
        offsetX: Number(block?.actorOffsetX || 0),
        offsetY: Number(block?.actorOffsetY || 0)
      }
    : (selectedFrameIndex >= 0 ? selectedAction?.frames?.[selectedFrameIndex] : null);
  const normalizedSelectedFrame = typeof selectedFrameData === 'string' ? createSpriteFrame(selectedFrameData) : selectedFrameData;
  const currentActorFrame = resolveWeb5eAssetUrl(actorState.frameUrl || block?.actorImageUrl || (typeof actions[0]?.frames?.[0] === 'string' ? actions[0]?.frames?.[0] : actions[0]?.frames?.[0]?.url) || '');
  const actorRenderWidth = Number(normalizedSelectedFrame?.width || actorState.width || block?.actorWidth || 140);
  const actorRenderHeight = Number(normalizedSelectedFrame?.height || actorState.height || block?.actorHeight || 140);
  const actorRenderFrame = resolveWeb5eAssetUrl(String((isPlaying || playingActionId) ? currentActorFrame : (normalizedSelectedFrame?.url || currentActorFrame || '')));
  const safePresentationNumber = Math.max(1, Number(block?.presentationNumber || presentationNumber || 1));
  const safeSlideNumber = Math.max(1, Number(block?.slideNumber || slideNumber || 1));
  const animationCode = `${safePresentationNumber}${safeSlideNumber}`;

  return (
    <div className="animation-block-shell">
      <div ref={overlayRef} className="animation-page-overlay visible">
        <div
          className={`animation-page-actor ${readOnly ? 'readonly' : 'draggable'}`}
          style={{
            transform: `translate(${Number(actorState.x || 0)}px, ${Number(actorState.y || 0)}px)`
          }}
          onMouseDown={startDragActor}
        >
          <div className="animation-actor-name top">{animationCode}</div>
          <div
            className="animation-page-actor-figure"
            style={{ width: actorRenderWidth, height: actorRenderHeight }}
          >
            {actorRenderFrame ? (
              <img
                src={actorRenderFrame}
                alt={block?.actorName || 'Personnage'}
                style={{
                  transform: `translate(${Number(normalizedSelectedFrame?.offsetX || 0)}px, ${Number(normalizedSelectedFrame?.offsetY || 0)}px) scale(${Number(normalizedSelectedFrame?.scale || 1)})`
                }}
              />
            ) : <div className="animation-actor-placeholder">{(block?.actorName || 'P').slice(0, 1)}</div>}
            {!readOnly ? (
              <>
                <button type="button" className="animation-actor-resizer nw" onMouseDown={(e) => startResizeActor(e, 'nw')} aria-label="Redimensionner le sprite en haut a gauche" />
                <button type="button" className="animation-actor-resizer ne" onMouseDown={(e) => startResizeActor(e, 'ne')} aria-label="Redimensionner le sprite en haut a droite" />
                <button type="button" className="animation-actor-resizer sw" onMouseDown={(e) => startResizeActor(e, 'sw')} aria-label="Redimensionner le sprite en bas a gauche" />
                <button type="button" className="animation-actor-resizer se" onMouseDown={(e) => startResizeActor(e, 'se')} aria-label="Redimensionner le sprite en bas a droite" />
              </>
            ) : null}
          </div>
        </div>
        <div className="animation-editor compact-floating" style={{ transform: `translate(${Number(actorState.x + actorState.width + 12)}px, ${Number(actorState.y)}px)` }}>
          {!readOnly && (
            <div className="animation-sprite-toolbar" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void handleActorFile(e.dataTransfer.files); }}>
              <button type="button" className={`animation-sprite-play ${isPlaying ? 'active' : ''}`} onClick={playAnimation}>{isPlaying ? '■' : '▶'}</button>
              <button type="button" className="animation-add-action-btn" onClick={addAction}>+</button>
              <div className={`animation-load-menu-shell ${loadMenuOpen ? 'open' : ''}`}>
                <button type="button" onClick={() => setLoadMenuOpen((prev) => !prev)}>Charger</button>
                {loadMenuOpen ? (
                  <div className="animation-load-menu">
                    {savedActions.length === 0 ? (
                      <div className="animation-load-empty">Aucune action</div>
                    ) : (
                      savedActions.map((item) => (
                        <button key={item.id} type="button" className="animation-load-item" onClick={() => loadSavedAction(item.id)}>
                          {item.name}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
              {!readOnly ? <button type="button" className="animation-action-remove" onClick={onRemove}>×</button> : null}
            </div>
          )}
          {importNotice ? <div className="animation-import-notice">{importNotice}</div> : null}

          <div className="animation-action-stack compact">
          {actions.map((action, index) => (
            <div key={action.id} className="animation-action-card compact">
              {!readOnly ? (
                <ActionQrCode actionId={action.id} actionName={action.name} sectionKey={sectionKey} tabKey={tabKey} blockIndex={blockIndex} tabId={tabId} entryId={entryId} onPendingMedia={applyPendingMedia} />
              ) : null}
              <div className="animation-action-head">
                <input
                  value={actionNameDrafts[action.id] ?? action.name ?? ''}
                  onChange={(e) => setActionNameDrafts((prev) => ({ ...prev, [action.id]: e.target.value }))}
                  onBlur={() => {
                    if (String(action.name || '') !== String(actionNameDrafts[action.id] ?? '')) {
                      updateAction(action.id, { name: String(actionNameDrafts[action.id] ?? '') });
                    }
                  }}
                  placeholder={`Action ${index + 1}`}
                />
              </div>
              <div className="animation-action-toolbar-row">
                <div className="animation-compact-actions">
                  <button type="button" className="icon-btn" onClick={() => saveActionPreset(action)}>+</button>
                  <button type="button" className="icon-btn" onClick={() => toggleSpritesOpen(action.id)} aria-label="Afficher les sprites">👤</button>
                  <button type="button" className={recordingActionId === action.id ? 'recording active icon-btn' : 'icon-btn'} onClick={() => void toggleRecord(action.id)}>●</button>
                  <button type="button" className={playingActionId === action.id ? 'playing active icon-btn' : 'icon-btn'} onClick={() => void toggleActionLoop(action)}>{playingActionId === action.id ? '■' : '▶'}</button>
                </div>
                {!readOnly && actions.length > 1 ? <button type="button" className="animation-action-remove small" onClick={(e) => { e.stopPropagation(); removeAction(action.id); }}>×</button> : null}
              </div>
              {action.spritesOpen && !readOnly && (
                <div
                  className="animation-sprite-space"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void appendFrames(action.id, e.dataTransfer.files); }}
                  onPaste={(e) => handleUrlOrImagePaste(e, (nextValue) => importActionFrameFromValue(action.id, nextValue))}
                >
                  <div className="animation-sprite-space-head">
                    <div className="animation-sprite-space-title">Sprites</div>
                    <div className="animation-sprite-space-actions">
                      <button type="button" onClick={() => void autoCutoutActionSprites(action.id)}>Detourer</button>
                      <button type="button" onClick={() => toggleSpriteEditorOpen(action.id)}>Edition</button>
                      <button type="button" className="icon-btn" onClick={() => actionFileInputRefs.current[action.id]?.click()}>+</button>
                    </div>
                  </div>
                  {action.spriteUrlOpen ? (
                    <div className="animation-sprite-url-row">
                      <input
                        value={action.frameUrlInput || ''}
                        onChange={(e) => updateAction(action.id, { frameUrlInput: e.target.value })}
                        placeholder="URL d'un sprite"
                      />
                      <button type="button" onClick={() => importActionFrameFromValue(action.id, action.frameUrlInput || '')}>Injecter</button>
                    </div>
                  ) : null}
                  <div className="animation-sprite-drop-hint">Colle, glisse, ou ajoute des sprites ici.</div>
                  <div className="animation-frame-strip in-space">
                    {block?.actorImageUrl ? (
                      <div
                        className={`animation-frame-thumb origin ${Number(action.selectedFrameIndex) === -1 ? 'selected' : ''}`}
                        onClick={() => selectOriginalActor(action.id)}
                      >
                        <img src={resolveWeb5eAssetUrl(block.actorImageUrl)} alt="" />
                      </div>
                    ) : null}
                    {(action.frames || []).map((frame, frameIndex) => (
                      <div key={`${action.id}_${frameIndex}`} className={`animation-frame-thumb ${frameIndex === (action.selectedFrameIndex || 0) ? 'selected' : ''}`} onClick={() => selectFrame(action.id, frameIndex)}>
                        <img src={resolveWeb5eAssetUrl(typeof frame === 'string' ? frame : frame?.url)} alt="" />
                        {!readOnly ? <button type="button" onClick={(e) => { e.stopPropagation(); removeFrame(action.id, frameIndex); }}>×</button> : null}
                      </div>
                    ))}
                    {(!action.frames || action.frames.length === 0) && <div className="animation-frame-empty">Aucun sprite</div>}
                  </div>
                  <input ref={(node) => { actionFileInputRefs.current[action.id] = node; }} type="file" accept="image/*" multiple className="hidden-file-input" onChange={(e) => void appendFrames(action.id, e.target.files)} />
                </div>
              )}
              {action.spriteEditorOpen && !readOnly ? (() => {
                const isOriginalSelected = Number(action.selectedFrameIndex) === -1;
                const selectedFrame = isOriginalSelected ? null : action.frames?.[action.selectedFrameIndex || 0];
                const normalizedFrame = isOriginalSelected
                  ? {
                      ...createSpriteFrame(block?.actorImageUrl || ''),
                      width: Number(block?.actorWidth || 140),
                      height: Number(block?.actorHeight || 140),
                      scale: Number(block?.actorScale || 1),
                      offsetX: Number(block?.actorOffsetX || 0),
                      offsetY: Number(block?.actorOffsetY || 0)
                    }
                  : (typeof selectedFrame === 'string' ? createSpriteFrame(selectedFrame) : selectedFrame);
                return (
                  <div className="animation-sprite-editor-panel">
                    {normalizedFrame?.url ? (
                      <>
                        <div className="animation-sprite-editor-preview">
                          <div
                            className="animation-sprite-editor-target"
                            style={{ width: Number(normalizedFrame.width || 140), height: Number(normalizedFrame.height || 140) }}
                          >
                            <img
                              src={normalizedFrame.url}
                              alt=""
                              style={{
                                width: Number(normalizedFrame.width || 140),
                                height: Number(normalizedFrame.height || 140),
                                transform: `translate(${Number(normalizedFrame.offsetX || 0)}px, ${Number(normalizedFrame.offsetY || 0)}px) scale(${Number(normalizedFrame.scale || 1)})`
                              }}
                              onMouseDown={(e) => handleEditorImageMouseDown(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0))}
                            />
                            <button type="button" className="animation-editor-resizer nw" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'nw')} />
                            <button type="button" className="animation-editor-resizer ne" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'ne')} />
                            <button type="button" className="animation-editor-resizer sw" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'sw')} />
                            <button type="button" className="animation-editor-resizer se" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'se')} />
                          </div>
                        </div>
                        <div className="animation-sprite-editor-controls">
                          <div className="animation-sprite-editor-size-readout">
                            {Number(normalizedFrame.width || 140)} x {Number(normalizedFrame.height || 140)} px
                          </div>
                          {!isOriginalSelected ? (
                            <div className="animation-sprite-adjust-row">
                              <button type="button" className="icon-btn" onClick={() => adjustFrameScale(action.id, action.selectedFrameIndex || 0, -0.1)}>-</button>
                              <span>Zoom {Number(normalizedFrame.scale || 1).toFixed(2)}</span>
                              <button type="button" className="icon-btn" onClick={() => adjustFrameScale(action.id, action.selectedFrameIndex || 0, 0.1)}>+</button>
                            </div>
                          ) : null}
                          {!isOriginalSelected ? (
                            <div className="animation-sprite-adjust-grid">
                              <div />
                              <button type="button" className="icon-btn" onClick={() => nudgeFrame(action.id, action.selectedFrameIndex || 0, 0, -4)}>↑</button>
                              <div />
                              <button type="button" className="icon-btn" onClick={() => nudgeFrame(action.id, action.selectedFrameIndex || 0, -4, 0)}>←</button>
                              <div />
                              <button type="button" className="icon-btn" onClick={() => nudgeFrame(action.id, action.selectedFrameIndex || 0, 4, 0)}>→</button>
                              <div />
                              <button type="button" className="icon-btn" onClick={() => nudgeFrame(action.id, action.selectedFrameIndex || 0, 0, 4)}>↓</button>
                              <div />
                            </div>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="animation-frame-empty">Choisis un sprite.</div>
                    )}
                  </div>
                );
              })() : null}
            </div>
          ))}
          </div>
        </div>
      </div>
      <div className="animation-meta-line">
        {`Presentation ${safePresentationNumber} • Slide ${safeSlideNumber}`}
      </div>
    </div>
  );
}

export default function App() {
  const animationCreateFileInputRef = useRef(null);
  const pendingSaveRef = useRef(null);
  const autosaveIntervalRef = useRef(null);
  const isLocalSessionMode = isLocalWeb5eHost();
  const initialBridgedUser = readBridgeUserFromUrl();
  const initialWindowNamedUser = readBridgeUserFromWindowName();
  const initialStoredUser = readStoredWeb5eSession();
  const initialLocalUser = !initialBridgedUser && !initialWindowNamedUser && !initialStoredUser && isLocalSessionMode
    ? buildLocalTeacherSession()
    : null;
  const initialUser = initialBridgedUser || initialWindowNamedUser || initialStoredUser || initialLocalUser;
  const [bridgeDebug, setBridgeDebug] = useState({
    fromUrl: Boolean(initialBridgedUser?.id),
    fromWindowName: Boolean(initialWindowNamedUser?.id),
    fromStorage: Boolean(initialStoredUser?.id || initialLocalUser?.id),
    userId: initialUser?.id || ''
  });
  const [allUsersData, setAllUsersData] = useState([]);
  const [inputClass, setInputClass] = useState('');
  const [inputLast, setInputLast] = useState('');
  const [inputFirst, setInputFirst] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(initialUser ? {
    id: initialUser.id,
    type: 'student',
    firstName: initialUser.firstName || '',
    lastName: initialUser.lastName || '',
    className: initialUser.currentClass || ''
  } : null);
  const [user, setUser] = useState(initialUser);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animationCreateOpen, setAnimationCreateOpen] = useState(false);
  const [animationDraft, setAnimationDraft] = useState({
    title: '',
    actorImageUrl: ''
  });
  const [welcomeAnimationOpen, setWelcomeAnimationOpen] = useState(false);
  const [welcomeAnimationDraft, setWelcomeAnimationDraft] = useState({
    title: '',
    actorImageUrl: ''
  });
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteTab, setVoteTab] = useState('names');
  const [voteDrafts, setVoteDrafts] = useState({
    site_name: '',
    water_mascot_name: '',
    energy_mascot_name: ''
  });
  const [activeSection, setActiveSection] = useState('eau');
  const [activeTabBySection, setActiveTabBySection] = useState({ eau: 'manquer-eau', energie: 'fossiles' });
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT);
  const [siteData, setSiteData] = useState(null);
  const [tabDocsByKey, setTabDocsByKey] = useState({});
  const [entryDocsByKey, setEntryDocsByKey] = useState({});
  const pageParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch (_) {
      return new URLSearchParams();
    }
  }, []);
  const mobileActionToken = String(pageParams.get('m') || pageParams.get('mobileActionToken') || '').trim();
  const isMobileActionMode = Boolean(mobileActionToken);
  const [localContentReady, setLocalContentReady] = useState(!isLocalSessionMode);

  useEffect(() => {
    if (initialLocalUser?.id) {
      window.localStorage.setItem(WEB5E_SESSION_KEY, JSON.stringify(initialLocalUser));
    }
  }, [initialLocalUser]);

  useEffect(() => {
    fetch('/api/auth/finder-data')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setAllUsersData(Array.isArray(data) ? data : []))
      .catch(() => setAllUsersData([]));
  }, []);

  useEffect(() => {
    const loadWeb5e = async () => {
      const localContent = isLocalSessionMode ? readLocalWeb5eContent() : null;
      if (localContent && typeof localContent === 'object') {
        setContentMap((prev) => ({ ...prev, ...localContent }));
      }
      try {
        const res = await fetch('/api/web5e/public');
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Chargement impossible');

        const tabs = Array.isArray(data.tabs) ? data.tabs : [];
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const nextTabDocs = {};
        const nextEntryDocs = {};
        const nextContentMap = { eau: {}, energie: {} };

        tabs.forEach((tab) => {
          const sectionKey = String(tab.sectionKey || '').trim().toLowerCase();
          const tabKey = String(tab.tabKey || '').trim().toLowerCase();
          if (!sectionKey || !tabKey) return;
          nextTabDocs[`${sectionKey}:${tabKey}`] = tab;
          if (!nextContentMap[sectionKey]) nextContentMap[sectionKey] = {};
          const entry = entries.find((row) => String(row.tabId || '') === String(tab._id || ''));
          nextEntryDocs[`${sectionKey}:${tabKey}`] = entry || null;
          nextContentMap[sectionKey][tabKey] = Array.isArray(entry?.blocks) && entry.blocks.length > 0
            ? entry.blocks
            : (DEFAULT_CONTENT[sectionKey]?.[tabKey] || []);
        });

        Object.keys(DEFAULT_CONTENT).forEach((sectionKey) => {
          nextContentMap[sectionKey] = { ...(DEFAULT_CONTENT[sectionKey] || {}), ...(nextContentMap[sectionKey] || {}) };
        });

        setSiteData(data.site || null);
        setTabDocsByKey(nextTabDocs);
        setEntryDocsByKey(nextEntryDocs);
        setContentMap(localContent && isLocalSessionMode ? { ...nextContentMap, ...localContent } : nextContentMap);
      } catch (_) {
      } finally {
        if (isLocalSessionMode) setLocalContentReady(true);
      }
    };
    loadWeb5e();
  }, [isLocalSessionMode]);

  useEffect(() => {
    if (!isLocalSessionMode || !localContentReady) return;
    writeLocalWeb5eContent(contentMap);
  }, [contentMap, isLocalSessionMode, localContentReady]);

  useEffect(() => {
    const bridgedUser = readBridgeUserFromUrl() || readBridgeUserFromWindowName();
    if (!bridgedUser?.id) return;
    window.localStorage.setItem(WEB5E_SESSION_KEY, JSON.stringify(bridgedUser));
    setBridgeDebug({
      fromUrl: Boolean(readBridgeUserFromUrl()?.id),
      fromWindowName: Boolean(readBridgeUserFromWindowName()?.id),
      fromStorage: true,
      userId: bridgedUser.id
    });
    setUser(bridgedUser);
    setSelectedProfile({
      id: bridgedUser.id,
      type: 'student',
      firstName: bridgedUser.firstName || '',
      lastName: bridgedUser.lastName || '',
      className: bridgedUser.currentClass || ''
    });
    setLoginOpen(false);
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('bridgeUser');
    cleanUrl.hash = '';
    window.history.replaceState({}, '', cleanUrl.toString());
    try {
      window.name = '';
    } catch (_) {}
  }, []);

  const suggestions = useMemo(() => {
    const typedClass = clean(inputClass);
    const typedLast = clean(inputLast);
    const typedFirst = clean(inputFirst);
    if (!typedLast && !typedFirst && !typedClass) return [];
    return allUsersData
      .filter((p) => p.type === 'student')
      .filter((p) => {
        const classOk = typedClass ? clean(p.className).includes(typedClass) : true;
        const lastOk = typedLast ? clean(p.lastName).includes(typedLast) : true;
        const firstOk = typedFirst ? clean(p.firstName).includes(typedFirst) : true;
        return classOk && lastOk && firstOk;
      })
      .slice(0, 6);
  }, [allUsersData, inputClass, inputLast, inputFirst]);

  const currentSection = SECTION_CONFIG[activeSection];
  const currentTabId = activeTabBySection[activeSection];
  const blocks = contentMap[activeSection]?.[currentTabId] || [];
  const articleBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type !== 'animation');
  const animationBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'animation');

  const resolveProfile = () => {
    if (selectedProfile) return selectedProfile;
    const typedClass = clean(inputClass);
    const typedLast = clean(inputLast);
    const typedFirst = clean(inputFirst);
    const matchedProfile = allUsersData.find((p) =>
      p.type === 'student' &&
      clean(p.lastName) === typedLast &&
      clean(p.firstName) === typedFirst &&
      (!typedClass || clean(p.className) === typedClass)
    ) || null;
    if (matchedProfile) return matchedProfile;
    if (/^5/.test(String(inputClass || '').trim()) && typedLast && typedFirst) {
      return buildDirectStudentProfile({
        firstName: String(inputFirst || '').trim(),
        lastName: String(inputLast || '').trim(),
        className: String(inputClass || '').trim()
      });
    }
    return null;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const typedLast = clean(inputLast);
    const typedFirst = clean(inputFirst);
    if (
      typedLast === 'vuillet' &&
      (typedFirst === 'jp' || typedFirst === 'jean')
    ) {
      const teacherUser = {
        id: 'web5e-teacher-jp-vuillet',
        _id: 'web5e-teacher-jp-vuillet',
        firstName: 'JP',
        lastName: 'Vuillet',
        currentClass: 'PROF',
        role: 'teacher'
      };
      setSelectedProfile({
        id: teacherUser.id,
        type: 'teacher',
        firstName: teacherUser.firstName,
        lastName: teacherUser.lastName,
        className: teacherUser.currentClass
      });
      setUser(teacherUser);
      window.localStorage.setItem(WEB5E_SESSION_KEY, JSON.stringify(teacherUser));
      setLoginOpen(false);
      return;
    }
    const profile = resolveProfile();
    if (!profile) {
      alert('Profil élève introuvable.');
      return;
    }
    const is5eProfile = /^5/.test(String(profile.className || '').trim().toUpperCase());
    if (!is5eProfile) {
      alert("Seuls les élèves de 5e peuvent éditer ce site.");
      return;
    }
    setLoading(true);
    try {
      const data = {
        user: {
          id: profile.id,
          _id: profile.id,
          firstName: profile.firstName || '',
          lastName: profile.lastName || '',
          currentClass: profile.className || '',
          role: 'student'
        }
      };
      setSelectedProfile(profile);
      setUser(data.user);
      window.localStorage.setItem(WEB5E_SESSION_KEY, JSON.stringify(normalizeBridgedUser(data.user)));
      setLoginOpen(false);
    } catch (e) {
      alert(e.message || 'Connexion impossible.');
    }
    setLoading(false);
  };

  const handleLogout = () => {
    window.localStorage.removeItem(WEB5E_SESSION_KEY);
    setUser(null);
    setSelectedProfile(null);
    setInputClass('');
    setInputLast('');
    setInputFirst('');
    setLoginOpen(false);
    setBridgeDebug({
      fromUrl: false,
      fromWindowName: false,
      fromStorage: false,
      userId: ''
    });
  };

  const updateBlocks = (nextBlocks) => {
    setContentMap((prev) => ({
      ...prev,
      [activeSection]: {
        ...(prev[activeSection] || {}),
        [currentTabId]: nextBlocks
      }
    }));
  };

  const persistBlocks = async (nextBlocks) => {
    const docKey = `${activeSection}:${currentTabId}`;
    if (isLocalSessionMode) {
      const nextContent = {
        ...contentMap,
        [activeSection]: {
          ...(contentMap[activeSection] || {}),
          [currentTabId]: nextBlocks
        }
      };
      writeLocalWeb5eContent(nextContent);
    }
    const tabDoc = tabDocsByKey[docKey];
    if (!tabDoc?._id || !user?.id) return;
    const existingEntry = entryDocsByKey[docKey];
    try {
      const res = await fetch('/api/web5e/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: existingEntry?._id || '',
          tabId: tabDoc._id,
          studentId: user.id || user._id || '',
          authorName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          title: tabDoc.title || '',
          blocks: nextBlocks,
          isPublished: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.entry) {
        setEntryDocsByKey((prev) => ({ ...prev, [docKey]: data.entry }));
      }
    } catch (_) {}
  };

  const queueAutosave = (nextBlocks) => {
    pendingSaveRef.current = {
      section: activeSection,
      tabId: currentTabId,
      blocks: nextBlocks
    };
  };

  useEffect(() => {
    autosaveIntervalRef.current = window.setInterval(() => {
      const pending = pendingSaveRef.current;
      if (!pending?.blocks) return;
      if (pending.section !== activeSection || pending.tabId !== currentTabId) return;
      void persistBlocks(pending.blocks);
      pendingSaveRef.current = null;
    }, 4000);
    return () => {
      if (autosaveIntervalRef.current) window.clearInterval(autosaveIntervalRef.current);
    };
  }, [activeSection, currentTabId, user, tabDocsByKey, entryDocsByKey]);

  const addBlock = (type) => {
    if (type === 'animation') {
      setAnimationCreateOpen(true);
      return;
    }
    const nextBlocks = [...blocks, createBlock(type)];
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const createAnimationFromMiniPanel = () => {
    const nextBlocks = [...blocks, createAnimationBlockFromDraft(animationDraft)];
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
    setAnimationCreateOpen(false);
    setAnimationDraft({ title: '', actorImageUrl: '' });
  };

  const persistSiteWelcomeAnimation = async (nextAnimation) => {
    try {
      const res = await fetch('/api/web5e/site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: siteData?.title || 'Projet 5e',
          subtitle: siteData?.subtitle || '',
          sectionOrder: siteData?.sectionOrder || ['eau', 'energie'],
          isPublic: siteData?.isPublic !== false,
          welcomeAnimation: nextAnimation || null
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.site) setSiteData(data.site);
    } catch (_) {}
  };

  const createWelcomeAnimation = () => {
    const nextAnimation = createAnimationBlockFromDraft(welcomeAnimationDraft);
    setSiteData((prev) => ({ ...(prev || {}), welcomeAnimation: nextAnimation }));
    void persistSiteWelcomeAnimation(nextAnimation);
    setWelcomeAnimationOpen(false);
    setWelcomeAnimationDraft({ title: '', actorImageUrl: '' });
  };

  const handleWelcomeAnimationFile = async (fileList) => {
    const file = Array.from(fileList || []).find((row) => row.type.startsWith('image/'));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setWelcomeAnimationDraft((prev) => ({ ...prev, actorImageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleAnimationCreateFile = async (fileList) => {
    const file = Array.from(fileList || []).find((row) => row.type.startsWith('image/'));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setAnimationDraft((prev) => ({ ...prev, actorImageUrl: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const replaceBlock = (index, nextBlock) => {
    const nextBlocks = blocks.map((block, i) => i === index ? nextBlock : block);
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const removeBlock = (index) => {
    if (blocks[index]?.type === 'text') {
      if (!window.confirm('Reinitialiser cette presentation ?')) return;
      const nextBlocks = blocks.map((block, i) => i === index ? createBlock('text') : block);
      updateBlocks(nextBlocks);
      queueAutosave(nextBlocks);
      void persistBlocks(nextBlocks);
      return;
    }
    if (blocks.length <= 1) return;
    const nextBlocks = blocks.filter((_, i) => i !== index);
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const deleteValidatedPresentationCard = (index) => {
    if (!isLocalSessionMode) return;
    if (!window.confirm('Supprimer cette carte de presentation en local ?')) return;
    const nextBlocks = blocks.filter((_, i) => i !== index);
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
    setOpenedValidatedPresentationIndex((prev) => {
      if (prev === index) return -1;
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const isTeacher = clean(user?.lastName) === 'vuillet' && (clean(user?.firstName) === 'jp' || clean(user?.firstName) === 'jean');
  const currentEntry = entryDocsByKey[`${activeSection}:${currentTabId}`];
  const contributionSignature = formatContributionName(currentEntry?.authorName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim());
  const voteBoard = normalizeVoteBoard(siteData?.voteBoard || null);
  const currentUserVoteKey = String(user?.id || user?._id || '').trim();
  const currentUserVotes = currentUserVoteKey ? (voteBoard.votesByUser[currentUserVoteKey] || {}) : {};
  const validatedPresentations = articleBlocks
    .filter(({ block }) => block.type === 'text' && normalizePresentationBlock(block).presentationValidated)
    .map(({ block, index }) => ({ index, presentation: normalizePresentationBlock(block) }));
  const studentHasValidatedPresentation = !isTeacher && validatedPresentations.length > 0;
  const [openedValidatedPresentationIndex, setOpenedValidatedPresentationIndex] = useState(-1);
  const [openedValidatedPresentationMode, setOpenedValidatedPresentationMode] = useState('browse');
  const [editingPresentationBlockIndex, setEditingPresentationBlockIndex] = useState(-1);
  const presentationBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'text')
    .map(({ block, index }) => ({ index, presentation: normalizePresentationBlock(block) }));
  const hasEmptyPresentationName = presentationBlocks.some(({ presentation }) => !String(presentation.presentationName || '').trim());
  const visibleArticleBlocks = user
    ? articleBlocks.filter(({ block, index }) => {
        if (block.type !== 'text') return true;
        if (isTeacher) return true;
        if (!studentHasValidatedPresentation) return true;
        return index === editingPresentationBlockIndex;
      })
    : articleBlocks.filter(({ block }) => block.type !== 'text');

  const persistVoteBoard = async (nextVoteBoard) => {
    const res = await fetch('/api/web5e/votes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voteBoard: nextVoteBoard })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'Erreur vote');
    setSiteData((prev) => ({ ...(prev || {}), voteBoard: data.voteBoard || nextVoteBoard }));
  };

  const saveVoteSelection = async (categoryKey, optionId) => {
    if (!currentUserVoteKey) return;
    const nextVoteBoard = normalizeVoteBoard(siteData?.voteBoard || null);
    nextVoteBoard.votesByUser[currentUserVoteKey] = {
      ...(nextVoteBoard.votesByUser[currentUserVoteKey] || {}),
      [categoryKey]: String(optionId || '')
    };
    await persistVoteBoard(nextVoteBoard);
  };

  const addVoteNameProposal = async (categoryKey) => {
    if (!currentUserVoteKey) return;
    const value = String(voteDrafts[categoryKey] || '').trim();
    if (!value) return;
    const nextVoteBoard = normalizeVoteBoard(siteData?.voteBoard || null);
    const existingProposal = (nextVoteBoard.names[categoryKey] || []).find((row) => String(row?.proposedBy || '') === currentUserVoteKey);
    if (existingProposal) return;
    nextVoteBoard.names[categoryKey] = [
      ...(nextVoteBoard.names[categoryKey] || []),
      { id: `vote_${categoryKey}_${Date.now()}`, label: value, proposedBy: currentUserVoteKey }
    ];
    await persistVoteBoard(nextVoteBoard);
    setVoteDrafts((prev) => ({ ...prev, [categoryKey]: '' }));
  };

  const addVoteMascotProposal = async (categoryKey, fileList) => {
    if (!currentUserVoteKey) return;
    const nextVoteBoard = normalizeVoteBoard(siteData?.voteBoard || null);
    const existingProposal = (nextVoteBoard.mascots[categoryKey] || []).find((row) => String(row?.proposedBy || '') === currentUserVoteKey);
    if (existingProposal) return;
    const file = Array.from(fileList || []).find((row) => row.type.startsWith('image/'));
    if (!file) return;
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
    if (!dataUrl) return;
    nextVoteBoard.mascots[categoryKey] = [
      ...(nextVoteBoard.mascots[categoryKey] || []),
      { id: `vote_${categoryKey}_${Date.now()}`, imageUrl: dataUrl, proposedBy: currentUserVoteKey }
    ];
    await persistVoteBoard(nextVoteBoard);
  };

  if (isMobileActionMode) {
    return <MobileActionRemote token={mobileActionToken} />;
  }

  return (
    <div className="web5e-shell">
      <button className="login-toggle" onClick={() => setLoginOpen((prev) => !prev)}>
        {user ? `${user.firstName} ${user.lastName}` : 'Connexion élève'}
      </button>
      {user && !isTeacher ? (
        <button className="creator-toggle" onClick={() => setVoteOpen((prev) => !prev)}>
          Vote
        </button>
      ) : null}
      <aside className={`login-panel ${loginOpen ? 'open' : ''}`}>
        <div className="login-panel-head">
          <div>
            <div className="eyebrow">Accès édition</div>
            <strong>{user ? 'Session active' : 'Connexion'}</strong>
          </div>
          <button onClick={() => setLoginOpen(false)}>×</button>
        </div>
        {!user ? (
          <form className="corner-login-form" onSubmit={handleLogin}>
            <input value={inputClass} onChange={(e) => setInputClass(e.target.value)} placeholder="Classe" />
            <div className="name-row">
              <input value={inputLast} onChange={(e) => { setInputLast(e.target.value); setSelectedProfile(null); }} placeholder="Nom" />
              <input value={inputFirst} onChange={(e) => { setInputFirst(e.target.value); setSelectedProfile(null); }} placeholder="Prénom" />
            </div>
            {suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    className={`suggestion ${selectedProfile?.id === profile.id ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedProfile(profile);
                      setInputClass(profile.className || '');
                      setInputLast(profile.lastName || '');
                      setInputFirst(profile.firstName || '');
                    }}
                  >
                    <span>{profile.firstName} <strong>{profile.lastName}</strong></span>
                    <span>{profile.className || ''}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="submit" className="primary-btn" disabled={loading}>{loading ? 'Connexion...' : 'Entrer'}</button>
          </form>
        ) : (
          <div className="session-card">
            <div className="session-name">{user.firstName} {user.lastName}</div>
            <div className="session-meta">{user.currentClass || ''}</div>
            <p>
              {isTeacher
                ? "Tu définis ici le contenu visible de chaque sous-onglet."
                : "Tu peux enrichir les sous-onglets définis par le professeur avec du texte, des images et des iframes."
              }
            </p>
            <button type="button" className="secondary-btn" onClick={handleLogout}>
              Déconnexion
            </button>
          </div>
        )}
      </aside>

      <header className="hero hero-simple">
        <div className="hero-simple-top">
          <div>
            <div className="eyebrow">Projet 5e</div>
            <div className="site-version-tag">Version {WEB5E_VERSION_NAME}</div>
          </div>
          {user ? (
            <div className="hero-editor-actions">
              <button onClick={() => setWelcomeAnimationOpen((prev) => !prev)}>Animation welcome</button>
            </div>
          ) : null}
        </div>
        <h1 className="hero-simple-title">{siteData?.title || 'Projet 5e'}</h1>
        {user && welcomeAnimationOpen ? (
          <div className="mini-animation-panel header-welcome-panel">
            <input
              value={welcomeAnimationDraft.title}
              onChange={(e) => setWelcomeAnimationDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Nom de l'animation welcome"
            />
            <div className="mini-animation-row">
              <input
                value={welcomeAnimationDraft.actorImageUrl}
                onChange={(e) => setWelcomeAnimationDraft((prev) => ({ ...prev, actorImageUrl: e.target.value }))}
                onPaste={(e) => handleUrlOrImagePaste(e, (nextValue) => setWelcomeAnimationDraft((prev) => ({ ...prev, actorImageUrl: nextValue })))}
                placeholder="Image ou URL"
              />
              <button type="button" onClick={() => animationCreateFileInputRef.current?.click()}>Importer</button>
              <input
                ref={animationCreateFileInputRef}
                type="file"
                accept="image/*"
                className="hidden-file-input"
                onChange={(e) => void handleWelcomeAnimationFile(e.target.files)}
              />
            </div>
            <div className="mini-animation-actions">
              <button type="button" onClick={() => setWelcomeAnimationOpen(false)}>Annuler</button>
              <button type="button" className="primary-btn" onClick={createWelcomeAnimation}>Creer</button>
            </div>
          </div>
        ) : null}
      </header>
      {voteOpen && user && !isTeacher ? (
        <section className="vote-panel">
          <div className="vote-panel-head">
            <div>
              <div className="eyebrow">Vote eleve</div>
              <strong>Choisis tes noms et mascottes</strong>
            </div>
            <button type="button" onClick={() => setVoteOpen(false)}>×</button>
          </div>
          <div className="presentation-slide-tabs">
            <button type="button" className={`presentation-slide-tab ${voteTab === 'names' ? 'active' : ''}`} onClick={() => setVoteTab('names')}>Noms</button>
            <button type="button" className={`presentation-slide-tab ${voteTab === 'mascots' ? 'active' : ''}`} onClick={() => setVoteTab('mascots')}>Mascotes</button>
          </div>
          {voteTab === 'names' ? (
            <div className="vote-grid names">
              {VOTE_NAME_CATEGORIES.map((category) => {
                const options = voteBoard.names[category.key] || [];
                const alreadyProposed = options.some((row) => String(row?.proposedBy || '') === currentUserVoteKey);
                return (
                  <div key={category.key} className="vote-column">
                    <h4>{category.label}</h4>
                    <div className="vote-options">
                      {options.map((option) => (
                        <button key={option.id} type="button" className={`vote-option ${currentUserVotes[category.key] === option.id ? 'active' : ''}`} onClick={() => void saveVoteSelection(category.key, option.id)}>
                          <span>{option.label}</span>
                          <strong>{countVotesForOption(voteBoard, category.key, option.id)}</strong>
                        </button>
                      ))}
                    </div>
                    <div className="vote-proposal-row">
                      <input value={voteDrafts[category.key] || ''} onChange={(e) => setVoteDrafts((prev) => ({ ...prev, [category.key]: e.target.value }))} placeholder={`Proposer ${category.label}`} />
                      <button type="button" disabled={alreadyProposed} onClick={() => void addVoteNameProposal(category.key)}>Ajouter</button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="vote-grid mascots">
              {VOTE_MASCOT_CATEGORIES.map((category) => {
                const options = voteBoard.mascots[category.key] || [];
                const alreadyProposed = options.some((row) => String(row?.proposedBy || '') === currentUserVoteKey);
                return (
                  <div key={category.key} className="vote-column">
                    <h4>{category.label}</h4>
                    <div className="vote-image-grid">
                      {options.map((option) => (
                        <button key={option.id} type="button" className={`vote-image-option ${currentUserVotes[category.key] === option.id ? 'active' : ''}`} onClick={() => void saveVoteSelection(category.key, option.id)}>
                          <img src={option.imageUrl} alt="" />
                          <strong>{countVotesForOption(voteBoard, category.key, option.id)}</strong>
                        </button>
                      ))}
                    </div>
                    <label className="presentation-slide-add">
                      Ajouter image
                      <input type="file" accept="image/*" className="hidden-file-input" disabled={alreadyProposed} onChange={(e) => void addVoteMascotProposal(category.key, e.target.files)} />
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {siteData?.welcomeAnimation ? (
        <div className="page-welcome-stage">
          <AnimationBlockEditor
            block={siteData.welcomeAnimation}
            onChange={(nextBlock) => {
              setSiteData((prev) => ({ ...(prev || {}), welcomeAnimation: nextBlock }));
              void persistSiteWelcomeAnimation(nextBlock);
            }}
            onRemove={() => {
              setSiteData((prev) => ({ ...(prev || {}), welcomeAnimation: null }));
              void persistSiteWelcomeAnimation(null);
            }}
            sectionKey="welcome"
            tabKey="header"
            blockIndex={0}
            readOnly={!isTeacher}
          />
        </div>
      ) : null}

      <nav className="section-tabs section-tabs-large">
        {Object.entries(SECTION_CONFIG).map(([sectionId, section]) => (
          <button
            key={sectionId}
            className={`section-tab ${activeSection === sectionId ? `active ${section.accent}` : ''}`}
            onClick={() => setActiveSection(sectionId)}
          >
            <span className="section-tab-title">{section.title}</span>
            <span className="section-tab-subtitle">{section.subtitle}</span>
          </button>
        ))}
      </nav>

      <section className={`section-panel ${currentSection.accent}`}>
        <div className="section-head">
          <div>
            <div className="section-kicker">{currentSection.title}</div>
            <h2>{currentSection.subtitle}</h2>
          </div>
          {user && (
            <div className="toolbar">
              <button onClick={() => {
                if (hasEmptyPresentationName) {
                  window.alert('Donne d’abord un vrai nom a la presentation existante avant d’en creer une nouvelle.');
                  return;
                }
                if (studentHasValidatedPresentation) {
                  window.alert('Tu as deja valide une presentation ici. Tu peux modifier celle que tu as terminee, mais pas en creer une deuxieme.');
                  return;
                }
                addBlock('text');
              }}>Présentation</button>
              <button onClick={() => addBlock('image')}>Image</button>
              <button onClick={() => addBlock('embed')}>Iframe</button>
              <button onClick={() => addBlock('animation')}>Animation</button>
            </div>
          )}
        </div>
        {isTeacher && animationCreateOpen ? (
          <div className="mini-animation-panel">
            <input
              value={animationDraft.title}
              onChange={(e) => setAnimationDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Nom de l'animation"
            />
            <div className="mini-animation-row">
              <input
                value={animationDraft.actorImageUrl}
                onChange={(e) => setAnimationDraft((prev) => ({ ...prev, actorImageUrl: e.target.value }))}
                onPaste={(e) => handleUrlOrImagePaste(e, (nextValue) => setAnimationDraft((prev) => ({ ...prev, actorImageUrl: nextValue })))}
                placeholder="Image ou URL"
              />
              <button type="button" onClick={() => animationCreateFileInputRef.current?.click()}>Importer</button>
              <input
                ref={animationCreateFileInputRef}
                type="file"
                accept="image/*"
                className="hidden-file-input"
                onChange={(e) => void handleAnimationCreateFile(e.target.files)}
              />
            </div>
            <div className="mini-animation-actions">
              <button type="button" onClick={() => setAnimationCreateOpen(false)}>Annuler</button>
              <button type="button" className="primary-btn" onClick={createAnimationFromMiniPanel}>Creer</button>
            </div>
          </div>
        ) : null}

        <div className="subtabs">
          {currentSection.tabs.map((tab) => (
            <button
              key={tab.id}
              className={`subtab ${currentTabId === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTabBySection((prev) => ({ ...prev, [activeSection]: tab.id }))}
            >
              {tab.title}
            </button>
          ))}
        </div>

        {validatedPresentations.length > 0 ? (
          <div className="validated-presentations-grid">
            {validatedPresentations.map(({ presentation, index }) => (
              <article key={`validated-presentation-${index}`} className="validated-presentation-card">
                <div className="validated-presentation-eyebrow">Presentation validee</div>
                <h3>{presentation.presentationName || `Presentation ${index + 1}`}</h3>
                <div className="validated-presentation-meta">
                  <span>{presentation.slides.length} slides</span>
                  <span>{Array.isArray(presentation.qcmQuestions) ? presentation.qcmQuestions.length : 0} questions QCM</span>
                </div>
                <div className="validated-presentation-actions">
                  <button
                    type="button"
                    className="presentation-slide-add"
                    onClick={() => {
                      setOpenedValidatedPresentationMode('browse');
                      setOpenedValidatedPresentationIndex(index);
                    }}
                  >
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    className="presentation-slide-add"
                    onClick={() => {
                      setOpenedValidatedPresentationMode('slideshow');
                      setOpenedValidatedPresentationIndex(index);
                    }}
                  >
                    Diapo
                  </button>
                  {presentation.canvaLiveUrl ? (
                    <button
                      type="button"
                      className="presentation-slide-add"
                      onClick={() => {
                        setOpenedValidatedPresentationMode('canva');
                        setOpenedValidatedPresentationIndex(index);
                      }}
                    >
                      Play
                    </button>
                  ) : null}
                  {user ? (
                    <button
                      type="button"
                      className="presentation-slide-add"
                      onClick={() => {
                        const targetBlockIndex = validatedPresentations[index].index;
                        const targetBlock = blocks[targetBlockIndex];
                        if (targetBlock?.type === 'text') {
                          replaceBlock(targetBlockIndex, {
                            ...normalizePresentationBlock(targetBlock),
                            presentationValidated: false
                          });
                        }
                        setEditingPresentationBlockIndex(targetBlockIndex);
                        setOpenedValidatedPresentationMode('browse');
                        setOpenedValidatedPresentationIndex(-1);
                      }}
                    >
                      Modifie
                    </button>
                  ) : null}
                  {isLocalSessionMode ? (
                    <button type="button" className="presentation-slide-add danger" onClick={() => deleteValidatedPresentationCard(index)}>Supprimer</button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : null}

        {openedValidatedPresentationIndex >= 0 && validatedPresentations[openedValidatedPresentationIndex] ? (
          <div className="validated-presentation-opened">
            <PublicPresentationViewer
              presentation={validatedPresentations[openedValidatedPresentationIndex].presentation}
              sectionKey={activeSection}
              tabKey={currentTabId}
              blockIndex={validatedPresentations[openedValidatedPresentationIndex].index}
              tabId={tabDocsByKey[`${activeSection}:${currentTabId}`]?._id || ''}
              entryId={entryDocsByKey[`${activeSection}:${currentTabId}`]?._id || ''}
              mode={openedValidatedPresentationMode}
              presentationNumber={openedValidatedPresentationIndex + 1}
            />
          </div>
        ) : null}

        <div className="blocks-area public article-stage">
          {visibleArticleBlocks.map(({ block, index }) => (
            <article key={`${activeSection}-${currentTabId}-${index}`} className={`block-card ${block.type === 'animation' ? 'block-card-animation' : ''}`}>
              <div className="block-head">
                {block.type === 'text' ? (
                  <>
                    <span>Présentation</span>
                    {user ? (
                      <div className="block-head-presentation-tools">
                        <input
                          className="presentation-name-head-input"
                          value={normalizePresentationBlock(block).presentationName || ''}
                          onChange={(e) => replaceBlock(index, { ...normalizePresentationBlock(block), presentationName: e.target.value, presentationValidated: false })}
                          placeholder="Nom de la presentation"
                        />
                        <button onClick={() => removeBlock(index)}>Supprimer</button>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span>
                      {block.type === 'image'
                        ? 'Image'
                        : block.type === 'animation'
                          ? 'Animation'
                          : 'Iframe / Jeu'}
                    </span>
                    {user && <button onClick={() => removeBlock(index)}>Supprimer</button>}
                  </>
                )}
              </div>

              {block.type === 'text' && (
                <PresentationEditor
                  block={block}
                  onChange={(nextBlock) => replaceBlock(index, nextBlock)}
                  readOnly={!user}
                  sectionKey={activeSection}
                  tabKey={currentTabId}
                  blockIndex={index}
                  tabId={tabDocsByKey[`${activeSection}:${currentTabId}`]?._id || ''}
                  entryId={entryDocsByKey[`${activeSection}:${currentTabId}`]?._id || ''}
                  siblingPresentationNames={presentationBlocks.filter((row) => row.index !== index).map((row) => row.presentation.presentationName)}
                  presentationNumber={Math.max(1, presentationBlocks.findIndex((row) => row.index === index) + 1)}
                />
              )}

              {block.type === 'image' && (
                <>
                  {user && (
                    <input
                      value={block.value}
                      onChange={(e) => replaceBlock(index, { ...block, value: e.target.value })}
                      placeholder="Colle l'URL de l'image"
                    />
                  )}
                  {block.value ? <img src={resolveWeb5eAssetUrl(block.value)} alt="" className="preview-image" /> : <div className="preview-placeholder">Aucune image ajoutée</div>}
                </>
              )}

              {block.type === 'embed' && (
                <>
                  {user && (
                    <input
                      value={block.value}
                      onChange={(e) => replaceBlock(index, { ...block, value: e.target.value })}
                      placeholder="Colle l'URL d'un site, jeu ou Google Sites"
                    />
                  )}
                  {block.value ? (
                    <div className="embed-frame-shell">
                      <iframe
                        src={block.value}
                        title={`embed-${activeSection}-${currentTabId}-${index}`}
                        className="embed-frame"
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        allow="fullscreen"
                      />
                    </div>
                  ) : (
                    <div className="preview-placeholder">Aucun iframe intégré</div>
                  )}
                </>
              )}

              <div className="block-signature">
                Apport de {formatContributionName(currentEntry?.authorName || contributionSignature || '') || 'élève'}
              </div>
            </article>
          ))}
          {animationBlocks.length > 0 && (
            <div className="article-animation-layer">
              {animationBlocks.map(({ block, index }) => (
                <div key={`${activeSection}-${currentTabId}-animation-${index}`} className="article-animation-instance">
                  {user && (
                    <button type="button" className="article-animation-remove" onClick={() => removeBlock(index)}>
                      Supprimer animation
                    </button>
                  )}
                  <AnimationBlockEditor
                    block={block}
                    onChange={(nextBlock) => {
                      const nextBlocks = blocks.map((row, rowIndex) => rowIndex === index ? nextBlock : row);
                      updateBlocks(nextBlocks);
                      queueAutosave(nextBlocks);
                      void persistBlocks(nextBlocks);
                    }}
                    onRemove={() => removeBlock(index)}
                    sectionKey={activeSection}
                    tabKey={currentTabId}
                    blockIndex={index}
                    tabId={tabDocsByKey[`${activeSection}:${currentTabId}`]?._id || ''}
                    entryId={entryDocsByKey[`${activeSection}:${currentTabId}`]?._id || ''}
                    readOnly={!isTeacher}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
