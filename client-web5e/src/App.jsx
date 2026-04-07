import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const WEB5E_SESSION_KEY = 'web5eBridgeSession';
const WEB5E_LOCAL_CONTENT_KEY = 'web5eLocalContentV1';
const WEB5E_PUBLIC_CACHE_KEY = 'web5ePublicEntriesV1';
const WEB5E_REMOTE_API_ORIGIN = 'https://hgeoentraineur.onrender.com';
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
      actorDocked: true,
      actions: [
        {
          id: `action_${Date.now()}`,
          name: 'Parler',
          frames: [],
          frameUrlInput: '',
          soundUrl: '',
          soundPitch: 1,
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
    value: type === 'text' ? '<h3>Nouveau slide</h3><p>Écris ici.</p>' : '',
    canvaLiveUrl: type === 'text'
      ? 'https://www.canva.com/design/DAHC1EUAfKs/t_9dfR28nNBZnkW2CysANQ/view?utm_content=DAHC1EUAfKs&utm_campaign=designshare&utm_medium=link2&utm_source=uniquelinks&embed=1#2'
      : '',
    canvaSlideCount: type === 'text' ? 3 : 0
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

const DEFAULT_PRESENTATION_SLIDE_HTML = '';

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

function slideHasImportedFallbackContent(slide = null) {
  const html = String(slide?.html || '').trim();
  if (!html) return false;
  if (html === DEFAULT_PRESENTATION_SLIDE_HTML) return false;
  return /<img[\s>]|<iframe[\s>]/i.test(html);
}

function presentationHasUploadedFallbackSlides(presentation = {}) {
  const slides = Array.isArray(presentation?.slides) ? presentation.slides : [];
  return slides.some((slide) => slideHasImportedFallbackContent(slide));
}

function normalizeCanvaLiveUrl(rawUrl = '') {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.hostname.includes('canva.com')) {
      const parts = String(url.pathname || '').split('/').filter(Boolean);
      if (parts[0] === 'design' && parts.length >= 2) {
        const designId = parts[1];
        const accessToken = parts[2] || '';
        const mode = String(parts[3] || '').toLowerCase();
        const tail = accessToken ? `/${accessToken}` : '';
        if (mode === 'edit' || mode === 'preview' || mode === '') {
          url.pathname = `/design/${designId}${tail}/view`;
        }
      }
      if (!url.searchParams.has('embed')) {
        url.searchParams.set('embed', '1');
      }
      if (!extractSlideNumberFromUrl(url.toString())) {
        url.hash = '#1';
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

function splitPresenterName(name = '') {
  const normalized = formatPresenterLabel(name);
  if (!normalized) return { firstName: '', lastName: '' };
  const parts = normalized.split(' ');
  return {
    firstName: parts[0] || '',
    lastName: parts.slice(1).join(' ') || ''
  };
}

function attachAnimationMetadata(animation = null, presentationNumber = 0, slideNumber = 0, presentationName = '', presenterName = '') {
  if (!animation || typeof animation !== 'object') return animation;
  return {
    ...animation,
    presentationNumber: Math.max(1, Number(presentationNumber || 1)),
    slideNumber: Math.max(1, Number(slideNumber || 1)),
    presentationName: String(presentationName || '').trim(),
    presenterName: String(presenterName || '').trim()
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

function isPresentationReadyForPublication(block = {}) {
  const presentation = normalizePresentationBlock(block);
  if (presentation.presentationValidated === true) return true;
  const slides = Array.isArray(presentation.slides) ? presentation.slides : [];
  const qcmQuestions = Array.isArray(presentation.qcmQuestions) ? presentation.qcmQuestions : [];
  if (!slides.length) return false;
  const hasAllPresenters = slides.every((slide) => Boolean(String(slide?.presenterName || '').trim()));
  const hasPresentationIdentity = Boolean(
    String(presentation.presentationName || '').trim()
    || String(presentation.canvaLiveUrl || '').trim()
  );
  const hasCanvaPresentation = Boolean(String(presentation.canvaLiveUrl || '').trim()) && hasAllPresenters;
  const hasOneValidQcm = qcmQuestions.some((row) => {
    const options = Array.isArray(row?.options) ? row.options : [];
    return Boolean(String(row?.question || '').trim()) && options.every((option) => Boolean(String(option || '').trim()));
  });
  return hasAllPresenters && hasPresentationIdentity && (hasOneValidQcm || hasCanvaPresentation);
}

function buildPresentationPublicationKey(presentation = {}) {
  const normalized = normalizePresentationBlock(presentation);
  const presenters = (Array.isArray(normalized.slides) ? normalized.slides : [])
    .map((slide) => String(slide?.presenterName || '').trim())
    .join('|');
  return [
    clean(normalized.presentationName || ''),
    String(normalized.canvaLiveUrl || '').trim(),
    String(normalized.canvaSlideCount || 0),
    presenters
  ].join('::');
}

function dedupePublishedPresentations(rows = []) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = buildPresentationPublicationKey(row?.presentation || {});
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    actorDocked: true,
    actions: [
      {
        id: `action_${Date.now()}`,
        name: 'Parler',
        frames: [],
        frameUrlInput: '',
        soundUrl: String(draft.soundUrl || '').trim(),
        soundPitch: Math.max(0.5, Math.min(2, Number(draft.soundPitch || 1))),
        startSec: 0,
        durationSec: Math.max(0.5, Number(draft.durationSec || 2)),
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

function normalizeTimelineActions(rawActions = []) {
  let cursor = 0;
  return (Array.isArray(rawActions) ? rawActions : []).map((action) => {
    const durationSec = Math.max(0.5, Number(action?.durationSec || 2));
    const frameDurationSec = Math.max(0.05, Math.min(1.5, Number(action?.frameDurationSec || 0.18)));
    const startSec = Number.isFinite(Number(action?.startSec))
      ? Math.max(0, Number(action.startSec))
      : cursor;
    cursor = Math.max(cursor, startSec + durationSec);
    return {
      ...action,
      soundPitch: Math.max(0.5, Math.min(2, Number(action?.soundPitch || 1))),
      frameDurationSec,
      startSec,
      durationSec
    };
  });
}

function constrainTimelineActions(rawActions = []) {
  const actions = normalizeTimelineActions(rawActions);
  if (!actions.length) return actions;
  const next = actions.map((action) => ({ ...action }));
  next[0].startSec = Math.max(0, Number(next[0].startSec || 0));
  for (let index = 1; index < next.length; index += 1) {
    const previous = next[index - 1];
    const minStart = Number(previous.startSec || 0) + Number(previous.durationSec || 0);
    next[index].startSec = Math.max(minStart, Number(next[index].startSec || 0));
  }
  return next;
}

function snapTimelineSeconds(value = 0, step = 0.1) {
  const safeStep = Math.max(0.01, Number(step || 0.1));
  return Math.round(Number(value || 0) / safeStep) * safeStep;
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

function resolveWeb5eApiUrl(path = '') {
  const raw = String(path || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window !== 'undefined' && String(window.location.hostname || '').includes('vercel.app')) {
    return `${WEB5E_REMOTE_API_ORIGIN}${raw.startsWith('/') ? raw : `/${raw}`}`;
  }
  return raw;
}

function extractSharedAudioMeta(animationBlock = null) {
  const actions = Array.isArray(animationBlock?.actions) ? animationBlock.actions : [];
  const sourceAction = actions.find((action) => String(action?.soundUrl || '').trim()) || null;
  return {
    soundUrl: String(sourceAction?.soundUrl || '').trim(),
    soundPitch: Math.max(0.5, Math.min(2, Number(sourceAction?.soundPitch || 1)))
  };
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

function readPublicEntriesCache() {
  try {
    const raw = window.localStorage.getItem(WEB5E_PUBLIC_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writePublicEntriesCache(entriesByKey) {
  try {
    window.localStorage.setItem(WEB5E_PUBLIC_CACHE_KEY, JSON.stringify(entriesByKey || {}));
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

function PresentationEditor({ block, onChange, readOnly, sectionKey = '', tabKey = '', blockIndex = 0, tabId = '', entryId = '', siblingPresentationNames = [], presentationNumber = 0, allUsersData = [], currentUserName = '' }) {
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
  const [presenterSearchTarget, setPresenterSearchTarget] = useState(null);
  const [animationImportMenuOpen, setAnimationImportMenuOpen] = useState(false);
  const [pendingAnimationSpriteUrlInput, setPendingAnimationSpriteUrlInput] = useState('');
  const [pendingAnimationSpriteOptions, setPendingAnimationSpriteOptions] = useState([]);
  const [editorCanvaLoaded, setEditorCanvaLoaded] = useState(false);
  const pendingAnimationSpriteInputRef = useRef(null);
  const pendingAnimationSpriteTargetRef = useRef({ slideIndex: -1, slideNumber: 0 });
  const editorRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const slidesImportInputRef = useRef(null);
  const canvasRef = useRef(null);
  const drawStateRef = useRef(null);
  const activeSlide = presentation.slides[presentation.activeSlideIndex] || presentation.slides[0];
  const lastHtmlRef = useRef(String(activeSlide?.html || ''));
  const slideHasContent = Boolean(String(activeSlide?.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
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
  const currentEditorCanvaSlide = presentation.slides[Math.max(0, Math.min(editorCanvaStep - 1, presentation.slides.length - 1))] || null;
  const currentEditorCanvaSlideIndex = Math.max(0, Math.min(editorCanvaStep - 1, presentation.slides.length - 1));
  const hasUploadedFallbackSlides = presentationHasUploadedFallbackSlides(presentation);
  const currentEditorPresenterName = String(
    currentEditorCanvaSlide?.presenterName
    || currentEditorCanvaSlide?.animation?.presenterName
    || presentation.presenterName
    || block?.presenterName
    || currentUserName
    || ''
  ).trim();
  const isPresentationUnconfigured = !String(presentation.presentationName || '').trim()
    && Math.max(0, Number(presentation.canvaSlideCount || 0)) === 0;
  const presenterSuggestions = useMemo(() => {
    const seen = new Set();
    return (Array.isArray(allUsersData) ? allUsersData : [])
      .filter((row) => row?.type === 'student')
      .filter((row) => /^5/.test(String(row?.className || '').trim()))
      .map((row) => {
        const firstName = String(row?.firstName || '').trim();
        const lastName = String(row?.lastName || '').trim();
        const label = formatPresenterLabel(`${firstName} ${lastName}`);
        return {
          label,
          firstName,
          lastName,
          searchValue: clean(`${firstName} ${lastName}`),
          firstNameValue: clean(firstName),
          lastNameValue: clean(lastName)
        };
      })
      .filter((entry) => Boolean(entry.label))
      .filter((entry) => {
        const key = clean(entry.label);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' }));
  }, [allUsersData]);
  const isValidPresenterSelection = (value = '') => {
    const normalized = clean(value);
    return Boolean(normalized) && presenterSuggestions.some((entry) => clean(entry.label) === normalized);
  };
  const isPresenterValid = isValidPresenterSelection(activeSlide?.presenterName || '');
  const isActiveSlideValid = isPresenterValid;
  const slidesValidCount = presentation.slides.filter((slide) => {
    return isValidPresenterSelection(slide?.presenterName || '');
  }).length;
  const canValidatePresentation = !presentationNameAlreadyUsed
    && normalizedPresentationName
    && presentation.slides.length > 0
    && slidesValidCount === presentation.slides.length
    && qcmValidCount >= 1;
  const filteredPresenterSuggestions = useMemo(() => {
    if (!presenterSearchTarget?.value) return [];
    const typed = clean(presenterSearchTarget.value);
    if (!typed) return [];
    return presenterSuggestions
      .filter((entry) => (
        entry.firstNameValue.startsWith(typed)
        || entry.lastNameValue.startsWith(typed)
        || entry.searchValue.includes(typed)
      ))
      .slice(0, 6);
  }, [presenterSuggestions, presenterSearchTarget]);

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
    const normalizedUrl = normalizeCanvaLiveUrl(canvaLiveUrlInput);
    if (normalizedUrl === String(presentation.canvaLiveUrl || '')) return;
    patchPresentation({
      canvaLiveUrl: normalizedUrl,
      presentationValidated: false
    });
  }, [canvaLiveUrlInput]);

  useEffect(() => {
    setEditorCanvaStep(1);
  }, [presentation.canvaLiveUrl, presentation.canvaSlideCount]);

  useEffect(() => {
    setEditorCanvaLoaded(false);
  }, [presentation.canvaLiveUrl, editorCanvaStep]);
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
  const renderPresenterSelector = (slide, slideIndex, compact = false) => (
    <div className={`presentation-presenter-field ${compact ? 'presentation-presenter-field-compact' : ''}`}>
      <input
        className="presentation-presenter-short-input"
        list="web5e-presenter-suggestions"
        value={slide?.presenterName || ''}
        onChange={(e) => {
          const nextValue = e.target.value;
          patchSlide(slideIndex, { presenterName: nextValue });
          setPresenterSearchTarget({ type: 'slide', index: slideIndex, value: nextValue });
        }}
        onFocus={(e) => setPresenterSearchTarget({ type: 'slide', index: slideIndex, value: e.target.value })}
        onBlur={() => window.setTimeout(() => setPresenterSearchTarget((prev) => (
          prev?.type === 'slide' && prev?.index === slideIndex ? null : prev
        )), 120)}
        placeholder="Choisir un eleve de 5e"
      />
      {presenterSearchTarget?.type === 'slide' && presenterSearchTarget?.index === slideIndex && filteredPresenterSuggestions.length > 0 ? (
        <div className="suggestions presenter-suggestions">
          {filteredPresenterSuggestions.map((entry) => {
            const parts = splitPresenterName(entry.label);
            return (
              <button
                key={`slide-${slideIndex}-${entry.label}`}
                type="button"
                className={`suggestion ${clean(slide?.presenterName || '') === clean(entry.label) ? 'selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyPresenterSuggestion(entry.label)}
              >
                <span>{parts.firstName} <strong>{parts.lastName || ''}</strong></span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
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

  const applyPresenterSuggestion = (nextName) => {
    const safeName = formatPresenterLabel(nextName);
    if (!safeName || !presenterSearchTarget) return;
    if (presenterSearchTarget.type === 'setup') {
      setSetupPresenters((prev) => prev.map((entry, entryIndex) => entryIndex === presenterSearchTarget.index ? safeName : entry));
    } else if (presenterSearchTarget.type === 'slide') {
      patchSlide(presenterSearchTarget.index, { presenterName: safeName });
    }
    setPresenterSearchTarget(null);
  };
  const ensureCurrentCanvaSlideAnimation = () => {
    if (presentation.activeEditorTab !== 'animation') return;
    if (!presentation.canvaLiveUrl) return;
    if (!currentEditorCanvaSlide || currentEditorCanvaSlide.animation) return;
    patchSlide(currentEditorCanvaSlideIndex, {
      animation: attachAnimationMetadata(
        createAnimationBlockFromDraft({ title: `Animation slide ${editorCanvaStep}` }),
        presentationNumber,
        editorCanvaStep,
        presentation.presentationName,
        currentEditorCanvaSlide?.presenterName
      )
    });
  };
  const openAnimationTab = () => {
    patchPresentation({ activeEditorTab: 'animation' });
    const slide = currentEditorCanvaSlide;
    const needsSprite = !String(slide?.animation?.actorImageUrl || '').trim();
    if (!needsSprite) {
      setAnimationImportMenuOpen(false);
      return;
    }
    pendingAnimationSpriteTargetRef.current = {
      slideIndex: currentEditorCanvaSlideIndex,
      slideNumber: editorCanvaStep
    };
    setPendingAnimationSpriteOptions([]);
    setAnimationImportMenuOpen(true);
  };
  const applyPendingAnimationSpriteUrl = (nextUrl) => {
    const safeUrl = String(nextUrl || '').trim();
    const { slideIndex, slideNumber } = pendingAnimationSpriteTargetRef.current;
    if (!safeUrl || slideIndex < 0) return;
    const baseAnimation = presentation.slides[slideIndex]?.animation
      ? attachAnimationMetadata(
          presentation.slides[slideIndex].animation,
          presentationNumber,
          slideNumber || (slideIndex + 1),
          presentation.presentationName,
          presentation.slides[slideIndex]?.presenterName
        )
      : attachAnimationMetadata(
          createAnimationBlockFromDraft({ title: `Animation slide ${slideNumber || (slideIndex + 1)}` }),
          presentationNumber,
          slideNumber || (slideIndex + 1),
          presentation.presentationName,
          presentation.slides[slideIndex]?.presenterName
        );
    patchSlide(slideIndex, {
      animation: {
        ...baseAnimation,
        actorImageUrl: safeUrl
      }
    });
    setPendingAnimationSpriteUrlInput('');
    setPendingAnimationSpriteOptions([]);
    setAnimationImportMenuOpen(false);
    pendingAnimationSpriteTargetRef.current = { slideIndex: -1, slideNumber: 0 };
    if (pendingAnimationSpriteInputRef.current) pendingAnimationSpriteInputRef.current.value = '';
  };
  const handlePendingAnimationSpriteImport = async (fileList) => {
    const file = Array.from(fileList || []).find((row) => row.type.startsWith('image/'));
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      applyPendingAnimationSpriteUrl(String(reader.result || ''));
    };
    reader.readAsDataURL(file);
  };
  const loadPendingAnimationSpritesFromPhone = async () => {
    const presenterName = currentEditorPresenterName;
    if (!presenterName) return;
    try {
      const backupRes = await fetch(`/api/exposes/presenter-backup?presenterName=${encodeURIComponent(presenterName)}`);
      const backupData = await backupRes.json().catch(() => ({}));
      if (!backupRes.ok || !backupData?.ok) {
        setPendingAnimationSpriteOptions([]);
        return;
      }
      const sourceRows = Array.isArray(backupData?.recordings) && backupData.recordings.length > 0
        ? backupData.recordings
        : [backupData];
      const seen = new Set();
      const nextOptions = sourceRows.flatMap((row, rowIndex) => {
        const urls = Array.isArray(row?.spriteImageUrls) ? row.spriteImageUrls : [];
        return urls
          .map((url, imageIndex) => ({
            id: `${String(row?.id || rowIndex)}_${imageIndex}`,
            url: String(url || '').trim(),
            slideNumber: Math.max(1, Number(row?.slideNumber || backupData?.slideNumber || 1))
          }))
          .filter((item) => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });
      });
      setPendingAnimationSpriteOptions(nextOptions);
    } catch (_) {
      setPendingAnimationSpriteOptions([]);
    }
  };

  useEffect(() => {
    if (!drawTextMode) {
      drawStateRef.current = null;
      setDraftTextBox(null);
    }
  }, [drawTextMode, activeSlide?.id]);

  useEffect(() => {
    ensureCurrentCanvaSlideAnimation();
  }, [presentation.activeEditorTab, presentation.canvaLiveUrl, currentEditorCanvaSlideIndex, editorCanvaStep]);

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
            onClick={() => {
              if (index > presentation.activeSlideIndex && !isPresenterValid) return;
              patchPresentation({ activeSlideIndex: index });
            }}
            disabled={index > presentation.activeSlideIndex && !isPresenterValid}
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
          <div
            className="presentation-canvas"
            data-mascot-docked={activeSlide?.animation?.actorDocked === false ? 'false' : 'true'}
            style={{
              background: activeSlide?.background || '#ffffff',
              color: activeSlide?.background === '#1d2942' ? '#ffffff' : '#1d2942',
              '--mascot-lane-width': activeSlide?.animation?.actorDocked === false ? '0px' : 'clamp(260px, 28%, 360px)'
            }}
          >
            <div className="presentation-slide-content-area">
              <div className="public-text article-render" dangerouslySetInnerHTML={{ __html: activeSlide?.html || '' }} />
            </div>
            {activeSlide?.animation ? (
              <AnimationBlockEditor
                block={attachAnimationMetadata(activeSlide.animation, presentationNumber, presentation.activeSlideIndex + 1, presentation.presentationName, activeSlide?.presenterName)}
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
                value={setupSlideCount > 0 ? setupSlideCount : ''}
                placeholder="0"
                onChange={(e) => updateSetupCount(e.target.value)}
              />
            </label>
            <div className="presentation-setup-list">
              {setupPresenters.map((value, index) => (
                <div key={`setup-presenter-${index}`} className="presentation-presenter-field">
                  <input
                    className="presentation-presenter-short-input"
                    list="web5e-presenter-suggestions"
                    value={value}
                    onChange={(e) => {
                      const nextValue = e.target.value;
                      setSetupPresenters((prev) => prev.map((entry, entryIndex) => entryIndex === index ? nextValue : entry));
                      setPresenterSearchTarget({ type: 'setup', index, value: nextValue });
                    }}
                    onFocus={(e) => setPresenterSearchTarget({ type: 'setup', index, value: e.target.value })}
                    onBlur={() => window.setTimeout(() => setPresenterSearchTarget((prev) => (
                      prev?.type === 'setup' && prev?.index === index ? null : prev
                    )), 120)}
                    placeholder={`Nom presentateur slide ${index + 1}`}
                  />
                  {presenterSearchTarget?.type === 'setup' && presenterSearchTarget?.index === index && filteredPresenterSuggestions.length > 0 ? (
                    <div className="suggestions presenter-suggestions">
                      {filteredPresenterSuggestions.map((entry) => {
                        const parts = splitPresenterName(entry.label);
                        return (
                          <button
                            key={`setup-${index}-${entry.label}`}
                            type="button"
                            className={`suggestion ${clean(value) === clean(entry.label) ? 'selected' : ''}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => applyPresenterSuggestion(entry.label)}
                          >
                            <span>{parts.firstName} <strong>{parts.lastName || ''}</strong></span>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
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
      <div className="presentation-editor-head">
        <datalist id="web5e-presenter-suggestions">
          {presenterSuggestions.map((entry) => (
            <option key={`presenter-option-${entry.label}`} value={entry.label} />
          ))}
        </datalist>
        <input
          ref={pendingAnimationSpriteInputRef}
          type="file"
          accept="image/*"
          className="hidden-file-input"
          onChange={(e) => void handlePendingAnimationSpriteImport(e.target.files)}
        />
        {(presentation.activeEditorTab === 'slides' || presentation.activeEditorTab === 'animation' || presentation.activeEditorTab === 'qcm') ? (
          <>
            <label className="presentation-editor-field">
              <span>Lien Canva :</span>
              <input
                className="presentation-slide-title"
                value={canvaLiveUrlInput}
                onChange={(e) => setCanvaLiveUrlInput(e.target.value)}
                placeholder="Coller le lien Canva"
              />
              <div className="presentation-editor-field-actions">
                <button
                  type="button"
                  className="presentation-slide-add"
                  onClick={() => slidesImportInputRef.current?.click()}
                >
                  Uploader presentation
                </button>
                <input
                  ref={slidesImportInputRef}
                  type="file"
                  accept="image/*,.png,.pdf,application/pdf"
                  multiple
                  className="hidden-file-input"
                  onChange={(e) => void handleSlidesImport(e.target.files)}
                />
              </div>
            </label>
            <label className="presentation-editor-field">
              <span>Nombre de slides :</span>
              <input
                className="presentation-size-input"
                type="number"
                min="0"
                max="300"
                value={presentation.canvaSlideCount > 0 ? presentation.canvaSlideCount : ''}
                placeholder="0"
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
          </>
        ) : null}
      </div>
      {presentation.canvaLiveUrl ? (
        <div className="canva-live-shell">
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
              onClick={openAnimationTab}
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
          {presentation.activeEditorTab === 'animation' && animationImportMenuOpen ? (
            <div
              className="animation-import-mini-menu"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void handlePendingAnimationSpriteImport(event.dataTransfer.files);
              }}
              onPaste={(event) => handleUrlOrImagePaste(event, (nextValue) => applyPendingAnimationSpriteUrl(nextValue))}
            >
              <div className="animation-import-mini-menu-title">Sprite de depart</div>
              <div className="animation-import-mini-menu-help">Glisse une image ici, colle une URL/image, ou importe un fichier.</div>
              <input
                className="presentation-slide-title"
                value={pendingAnimationSpriteUrlInput}
                onChange={(event) => setPendingAnimationSpriteUrlInput(event.target.value)}
                placeholder="Coller une URL d'image"
              />
              <div className="animation-import-mini-menu-actions">
                <button
                  type="button"
                  className="presentation-slide-add"
                  onClick={() => applyPendingAnimationSpriteUrl(pendingAnimationSpriteUrlInput)}
                >
                  Utiliser URL
                </button>
                <button
                  type="button"
                  className="presentation-slide-add"
                  onClick={() => pendingAnimationSpriteInputRef.current?.click()}
                >
                  Importer
                </button>
                <button
                  type="button"
                  className="presentation-slide-add"
                  onClick={() => void loadPendingAnimationSpritesFromPhone()}
                  disabled={!currentEditorPresenterName}
                >
                  Importer depuis tel
                </button>
              </div>
              {currentEditorPresenterName ? (
                <div className="animation-import-mini-menu-help">
                  {pendingAnimationSpriteOptions.length > 0
                    ? `${pendingAnimationSpriteOptions.length} image${pendingAnimationSpriteOptions.length > 1 ? 's' : ''} trouvée${pendingAnimationSpriteOptions.length > 1 ? 's' : ''} pour ${formatPresenterLabel(currentEditorPresenterName)}.`
                    : `Aucune image chargée pour ${formatPresenterLabel(currentEditorPresenterName)}.`}
                </div>
              ) : null}
              {pendingAnimationSpriteOptions.length > 0 ? (
                <div className="animation-frame-strip in-space">
                  {pendingAnimationSpriteOptions.map((option, optionIndex) => (
                    <button
                      key={String(option.id || `pending_phone_sprite_${optionIndex}`)}
                      type="button"
                      className="animation-frame-thumb from-mobile"
                      title={`Slide ${option.slideNumber}`}
                      onClick={() => applyPendingAnimationSpriteUrl(option.url)}
                    >
                      <img src={resolveWeb5eAssetUrl(option.url)} alt="" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {presentation.activeEditorTab !== 'qcm' ? (
            <>
              {hasUploadedFallbackSlides && !editorCanvaLoaded ? (
                <iframe
                  src={presentation.canvaLiveUrl}
                  title={`canva-live-editor-loader-${presentation.presentationName || 'presentation'}`}
                  className="canva-live-loader-frame"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allow="fullscreen"
                  onLoad={() => {
                    setEditorCanvaLoaded(true);
                  }}
                />
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
                <div className="slideshow-progress slideshow-progress-editor">
                  <span>
                    {presentation.canvaSlideCount > 0 ? `Canva live ${editorCanvaStep}/${presentation.canvaSlideCount}` : `Canva live ${editorCanvaStep}`}
                  </span>
                  <span className="slideshow-progress-presenter-label">Exposant de ce slide :</span>
                  <div className="slideshow-progress-presenter-field">
                    {renderPresenterSelector(currentEditorCanvaSlide, currentEditorCanvaSlideIndex, true)}
                  </div>
                </div>
                <button
                  type="button"
                  className="presentation-slide-add"
                  onClick={() => {
                    if (!isValidPresenterSelection(currentEditorCanvaSlide?.presenterName || '')) return;
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
                  disabled={!isValidPresenterSelection(currentEditorCanvaSlide?.presenterName || '') || (presentation.canvaSlideCount > 0 && editorCanvaStep >= presentation.canvaSlideCount)}
                >
                  Diapo suivante
                </button>
              </div>
              <div
                className="canva-live-frame-shell"
                data-mascot-docked={currentEditorCanvaSlide?.animation?.actorDocked === false ? 'false' : 'true'}
                style={{
                  '--mascot-lane-width': currentEditorCanvaSlide?.animation?.actorDocked === false ? '0px' : 'clamp(260px, 28%, 360px)',
                  display: hasUploadedFallbackSlides && !editorCanvaLoaded ? 'none' : undefined
                }}
              >
                <iframe
                  src={presentation.canvaLiveUrl}
                  title={`canva-live-editor-${presentation.presentationName || 'presentation'}`}
                  className="canva-live-frame"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allow="fullscreen"
                  onLoad={() => {
                    setEditorCanvaLoaded(true);
                  }}
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
                      block={attachAnimationMetadata(currentEditorCanvaSlide.animation, presentationNumber, editorCanvaStep, presentation.presentationName, currentEditorCanvaSlide?.presenterName)}
                      onChange={(nextAnimation) => patchSlide(currentEditorCanvaSlideIndex, { animation: attachAnimationMetadata(nextAnimation, presentationNumber, editorCanvaStep, presentation.presentationName, currentEditorCanvaSlide?.presenterName) })}
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
            </>
          ) : null}
          {presentation.activeEditorTab !== 'qcm' && hasUploadedFallbackSlides && !editorCanvaLoaded ? (
            <div className="presentation-import-fallback-note">
              Slides uploadées affichées en attendant Canva.
            </div>
          ) : null}
        </div>
      ) : null}
      {(presentation.activeEditorTab === 'qcm') ? (
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
      ) : (presentation.activeEditorTab === 'slides' || (hasUploadedFallbackSlides && !editorCanvaLoaded)) ? (
        <>
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
      {!presentation.canvaLiveUrl ? renderPresenterSelector(activeSlide, presentation.activeSlideIndex) : null}
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

function PublicPresentationViewer({ presentation, sectionKey = '', tabKey = '', blockIndex = 0, tabId = '', entryId = '', mode = 'browse', presentationNumber = 0, simpleMode = false }) {
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
  const [publicCanvaLoaded, setPublicCanvaLoaded] = useState(false);
  const activeSlide = normalized.slides[activeIndex] || normalized.slides[0];
  const qcmQuestions = Array.isArray(normalized.qcmQuestions) ? normalized.qcmQuestions : [];
  const hasQcmTab = qcmQuestions.length > 0;
  const isSlideshow = mode === 'slideshow';
  const isCanvaLive = mode === 'canva';
  const hasCanvaLive = Boolean(normalized.canvaLiveUrl);
  const hasUploadedFallbackSlides = presentationHasUploadedFallbackSlides(normalized);
  const canvaBaseStep = 1;
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
    setPublicCanvaLoaded(false);
  }, [normalized.presentationName, normalized.canvaLiveUrl, canvaStep]);

  useEffect(() => {
    setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, 1));
  }, [normalized.canvaLiveUrl]);

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
      {!simpleMode ? (
        <div className="public-presentation-head">
          <div className="eyebrow">Presentation validee</div>
          <h3>{normalized.presentationName || 'Presentation'}</h3>
        </div>
      ) : null}
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
          <div className="slideshow-progress">
            {normalized.canvaSlideCount > 0 ? `Canva live ${canvaStep}/${normalized.canvaSlideCount}` : `Canva live ${canvaStep}`}
            {!simpleMode && currentCanvaSlide?.presenterName ? ` • ${currentCanvaSlide.presenterName}` : ''}
          </div>
          {!simpleMode ? (
            <button
              type="button"
              className="presentation-slide-add"
              onClick={() => {
                const nextStep = Math.max(1, canvaStep - 1);
                setCanvaStep(nextStep);
                setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, nextStep));
              }}
              disabled={canvaStep <= 1}
            >
              Diapo precedente
            </button>
          ) : null}
          {!simpleMode ? (
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
              disabled={normalized.canvaSlideCount > 0 && canvaStep >= normalized.canvaSlideCount}
            >
              Diapo suivante
            </button>
          ) : null}
        </div>
      ) : isSlideshow ? (
        <div className="slideshow-nav">
          {!simpleMode ? (
            <button
              type="button"
              className="presentation-slide-add"
              onClick={() => setSlideshowStep((prev) => Math.max(0, prev - 1))}
              disabled={slideshowStep <= 0}
            >
              Diapo precedente
            </button>
          ) : null}
          <div className="slideshow-progress">
            {showingQcm ? `Etape ${totalSteps}/${totalSteps} : QCM` : `Diapo ${slideshowStep + 1}/${totalSteps}`}
          </div>
          {!simpleMode ? (
            <button
              type="button"
              className="presentation-slide-add"
              onClick={() => setSlideshowStep((prev) => Math.min(totalSteps - 1, prev + 1))}
              disabled={showingQcm || slideshowStep >= totalSteps - 1}
            >
              Diapo suivante
            </button>
          ) : null}
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
          {hasUploadedFallbackSlides && !publicCanvaLoaded ? (
            <iframe
              src={canvaRuntimeUrl || normalized.canvaLiveUrl}
              title={`canva-live-public-loader-${normalized.presentationName || 'presentation'}`}
              className="canva-live-loader-frame"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
              onLoad={() => {
                setPublicCanvaLoaded(true);
              }}
            />
          ) : null}
          {!simpleMode ? (
            <div className="canva-live-note">
              Slide detectee depuis l URL : {detectedCanvaStep || '?'}.
              URL runtime : {canvaRuntimeUrl || normalized.canvaLiveUrl || 'aucune'}.
              {currentCanvaSlide?.presenterName ? ` Exposant: ${currentCanvaSlide.presenterName}.` : ''}
            </div>
          ) : null}
          <div
            className="canva-live-frame-shell"
            data-mascot-docked={currentCanvaSlide?.animation?.actorDocked === false ? 'false' : 'true'}
            style={{
              '--mascot-lane-width': currentCanvaSlide?.animation?.actorDocked === false ? '0px' : 'clamp(260px, 28%, 360px)',
              display: hasUploadedFallbackSlides && !publicCanvaLoaded ? 'none' : undefined
            }}
          >
            <iframe
              src={canvaRuntimeUrl || normalized.canvaLiveUrl}
              title={`canva-live-${normalized.presentationName || 'presentation'}`}
              className="canva-live-frame"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allow="fullscreen"
              onLoad={() => {
                setPublicCanvaLoaded(true);
              }}
            />
            <div className="canva-live-lock-overlay" aria-hidden="true" />
            {currentCanvaSlide?.presenterName ? (
              <div className="canva-live-presenter-badge">
                {formatPresenterLabel(currentCanvaSlide.presenterName)}
              </div>
            ) : null}
            {currentCanvaSlide?.animation ? (
              <div className="canva-live-animation-layer">
                <AnimationBlockEditor
                  block={attachAnimationMetadata(
                    currentCanvaSlide.animation,
                    presentationNumber,
                    Math.max(1, canvaStep),
                    normalized.presentationName,
                    currentCanvaSlide?.presenterName
                  )}
                  onChange={() => {}}
                  onRemove={() => {}}
                  readOnly
                  sectionKey={sectionKey}
                  tabKey={tabKey}
                  blockIndex={blockIndex}
                  tabId={tabId}
                  entryId={entryId}
                  presentationNumber={presentationNumber}
                  slideNumber={Math.max(1, canvaStep)}
                  onPreviousSlide={() => {
                    const nextStep = Math.max(1, canvaStep - 1);
                    setCanvaStep(nextStep);
                    setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, nextStep));
                  }}
                  onNextSlide={() => {
                    const nextStep = normalized.canvaSlideCount > 0
                      ? Math.min(normalized.canvaSlideCount, canvaStep + 1)
                      : canvaStep + 1;
                    setCanvaStep(nextStep);
                    setCanvaRuntimeUrl(injectSlideNumberIntoUrl(normalized.canvaLiveUrl, nextStep));
                  }}
                  canGoPrevious={canvaStep > 1}
                  canGoNext={!(normalized.canvaSlideCount > 0 && canvaStep >= normalized.canvaSlideCount)}
                />
              </div>
            ) : null}
          </div>
          {!simpleMode ? (
            <a className="presentation-slide-add" href={canvaRuntimeUrl || normalized.canvaLiveUrl} target="_blank" rel="noreferrer">
              Ouvrir Canva dans un nouvel onglet
            </a>
          ) : null}
          {hasUploadedFallbackSlides && !publicCanvaLoaded ? (
            <div className="presentation-import-fallback-note">
              Slides uploadées affichées en attendant Canva.
            </div>
          ) : null}
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
        <div
          className="presentation-canvas"
          data-mascot-docked={visibleSlide?.animation?.actorDocked === false ? 'false' : 'true'}
          style={{
            background: visibleSlide?.background || '#ffffff',
            color: visibleSlide?.background === '#1d2942' ? '#ffffff' : '#1d2942',
            '--mascot-lane-width': visibleSlide?.animation?.actorDocked === false ? '0px' : 'clamp(260px, 28%, 360px)'
          }}
        >
          <div className="presentation-slide-content-area">
            <div className="public-text article-render" dangerouslySetInnerHTML={{ __html: visibleSlide?.html || '' }} />
          </div>
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
              block={attachAnimationMetadata(visibleSlide.animation, presentationNumber, (isSlideshow ? slideshowStep : activeIndex) + 1, normalized.presentationName, visibleSlide?.presenterName)}
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
              onPreviousSlide={simpleMode && isSlideshow ? () => setSlideshowStep((prev) => Math.max(0, prev - 1)) : null}
              onNextSlide={simpleMode && isSlideshow ? () => setSlideshowStep((prev) => Math.min(totalSteps - 1, prev + 1)) : null}
              canGoPrevious={simpleMode && isSlideshow ? slideshowStep > 0 : false}
              canGoNext={simpleMode && isSlideshow ? !showingQcm && slideshowStep < totalSteps - 1 : false}
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

function AnimationBlockEditor({
  block,
  onChange,
  onRemove,
  readOnly,
  sectionKey = '',
  tabKey = '',
  blockIndex = 0,
  tabId = '',
  entryId = '',
  presentationNumber = 0,
  slideNumber = 0,
  onPreviousSlide = null,
  onNextSlide = null,
  canGoPrevious = false,
  canGoNext = false
}) {
  const overlayRef = useRef(null);
  const actorRef = useRef(null);
  const actorFigureRef = useRef(null);
  const actionFileInputRefs = useRef({});
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const audioTimelineRef = useRef(null);
  const timelineDragRef = useRef(null);
  const actorDragStateRef = useRef(null);
  const actorResizeStateRef = useRef(null);
  const spriteResizeStateRef = useRef(null);
  const spriteDragStateRef = useRef({ actionId: '', frameIndex: -1 });
  const actionLoopStopRef = useRef({ stop: false, actionId: '' });
  const actionLoopIntervalRef = useRef(null);
  const playAnimationStopRef = useRef(false);
  const sequencePlaybackRef = useRef(false);
  const audioRecordManualStopRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingActionId, setPlayingActionId] = useState('');
  const [recordingAudio, setRecordingAudio] = useState(false);
  const [importNotice, setImportNotice] = useState('');
  const [importDebug, setImportDebug] = useState(null);
  const [importOptions, setImportOptions] = useState([]);
  const [selectedImportId, setSelectedImportId] = useState('');
  const [imageImportOptions, setImageImportOptions] = useState([]);
  const [actorImportOpen, setActorImportOpen] = useState(false);
  const [actorImportUrlInput, setActorImportUrlInput] = useState('');
  const [actorImportOptions, setActorImportOptions] = useState([]);
  const [audioMenuOpen, setAudioMenuOpen] = useState(false);
  const [audioMenuTab, setAudioMenuTab] = useState('charger');
  const audioMenuCloseTimerRef = useRef(null);
  const [editorPanelOpen, setEditorPanelOpen] = useState(true);
  const [eraserActive, setEraserActive] = useState(false);
  const [eraserSize, setEraserSize] = useState(24);
  const [eraserCursor, setEraserCursor] = useState({ visible: false, x: 0, y: 0 });
  const [sliceToolOpen, setSliceToolOpen] = useState(false);
  const [sliceBoxes, setSliceBoxes] = useState([]);
  const [sliceSource, setSliceSource] = useState(null);
  const [sliceSourceSize, setSliceSourceSize] = useState({ width: 0, height: 0 });
  const [sliceCreateMode, setSliceCreateMode] = useState(false);
  const [sliceDraftBox, setSliceDraftBox] = useState(null);
  const [selectedSliceBoxId, setSelectedSliceBoxId] = useState('');
  const sliceDragRef = useRef({ id: '', mode: '', offsetX: 0, offsetY: 0, active: false, handle: '' });
  const [actionNameDrafts, setActionNameDrafts] = useState({});
  const [audioDurationSec, setAudioDurationSec] = useState(0);
  const [audioCurrentTimeSec, setAudioCurrentTimeSec] = useState(0);
  const [selectedActionId, setSelectedActionId] = useState('');
  const [loopFrameState, setLoopFrameState] = useState({ actionId: '', frameIndex: -1 });
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });
  const actorDocked = block?.actorDocked !== false;
  const [actorState, setActorState] = useState({
    x: Number(block?.actorX || 120),
    y: Number(block?.actorY || 120),
    width: Number(block?.actorWidth || 140),
    height: Number(block?.actorHeight || 140),
    frameUrl: String(block?.actorImageUrl || ''),
    actionName: ''
  });
  const spriteEditorCanvasRef = useRef(null);
  const actorImportInputRef = useRef(null);
  const spriteEditorEraseStateRef = useRef(false);
  const spriteEditorDirtyRef = useRef(null);
  const slicePreviewRef = useRef(null);
  const openChatGptPopup = () => {
    if (typeof window === 'undefined') return;
    window.open('https://chatgpt.com/', 'web5e-chatgpt', 'popup=yes,width=1200,height=900,resizable=yes,scrollbars=yes');
  };
  const toggleActorDocked = () => {
    const nextDocked = !actorDocked;
    if (!nextDocked) {
      updateRoot({ actorDocked: false });
      return;
    }
    const shellRect = overlayRef.current?.getBoundingClientRect?.();
    const nextX = 16;
    const maxY = shellRect ? Math.max(0, shellRect.height - actorDragHeight - 12) : Math.max(0, Number(block?.actorY || 120));
    const nextY = Math.max(0, Math.min(Number(actorState.y || block?.actorY || 120), maxY));
    setActorState((prev) => ({ ...prev, x: nextX, y: nextY }));
    updateRoot({ actorDocked: true, actorX: Math.round(nextX), actorY: Math.round(nextY) });
  };
  const copySpriteUrlToClipboard = async (rawSpriteUrl = '') => {
    const spriteUrl = resolveWeb5eAssetUrl(String(rawSpriteUrl || ''));
    if (!spriteUrl) {
      flashNotice('Aucune image a copier');
      return;
    }
    try {
      const response = await fetch(spriteUrl);
      const blob = await response.blob();
      const pngBlob = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth || image.width || 1;
          canvas.height = image.naturalHeight || image.height || 1;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas'));
            return;
          }
          ctx.drawImage(image, 0, 0);
          canvas.toBlob((nextBlob) => {
            if (!nextBlob) {
              reject(new Error('blob'));
              return;
            }
            resolve(nextBlob);
          }, 'image/png');
        };
        image.onerror = () => reject(new Error('image'));
        image.src = URL.createObjectURL(blob);
      });
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngBlob })]);
        flashNotice('Sprite copie');
        return;
      }
    } catch (_) {}
    flashNotice('Copie image impossible sur ce navigateur');
  };

  const copyActiveActorToClipboard = async () => {
    await copySpriteUrlToClipboard(String(actorRenderFrame || block?.actorImageUrl || ''));
  };

  const copySelectedActionFrameToClipboard = async (actionId) => {
    const action = actions.find((item) => String(item?.id || '') === String(actionId || ''));
    if (!action) {
      flashNotice('Aucun sprite a copier');
      return;
    }
    const targetIndex = Number(action.selectedFrameIndex);
    const targetFrame = targetIndex === -1
      ? { url: String(block?.actorImageUrl || '') }
      : (targetIndex >= 0 ? action.frames?.[targetIndex] : null);
    const normalizedFrame = typeof targetFrame === 'string' ? createSpriteFrame(targetFrame) : targetFrame;
    await copySpriteUrlToClipboard(String(normalizedFrame?.url || ''));
  };

  const actions = Array.isArray(block?.actions) && block.actions.length > 0
    ? normalizeTimelineActions(block.actions)
    : [{ id: `action_${Date.now()}`, name: 'Parler', frames: [], frameUrlInput: '', soundUrl: '', soundPitch: 1, startSec: 0, durationSec: 2, spritesOpen: false, spriteUrlOpen: false, spriteEditorOpen: false, selectedFrameIndex: 0 }];
  const getOriginSpriteDimensions = () => ({
    width: Math.max(40, Number(block?.actorWidth || actorState.width || 140)),
    height: Math.max(40, Number(block?.actorHeight || actorState.height || 140))
  });
  const normalizeImportedFrame = (frameOrUrl) => {
    const sourceFrame = typeof frameOrUrl === 'string'
      ? createSpriteFrame(frameOrUrl)
      : { ...createSpriteFrame(frameOrUrl?.url || ''), ...(frameOrUrl || {}) };
    const origin = getOriginSpriteDimensions();
    return {
      ...sourceFrame,
      width: origin.width,
      height: origin.height
    };
  };
  const baseAudioUrl = String(actions.find((action) => String(action?.soundUrl || '').trim())?.soundUrl || '').trim();
  const totalTimelineSec = Math.max(
    1,
    Number(audioDurationSec || 0),
    ...actions.map((action) => Number(action?.startSec || 0) + Number(action?.durationSec || 0))
  );
  const activeTimelineAction = actions.find((action) => (
    audioCurrentTimeSec >= Number(action?.startSec || 0)
    && audioCurrentTimeSec <= Number(action?.startSec || 0) + Number(action?.durationSec || 0)
  )) || null;
  const toolbarAction = actions.find((action) => String(action.id || '') === String(selectedActionId || '')) || actions[0] || null;
  const isActorSelected = Boolean(toolbarAction && Number(toolbarAction.selectedFrameIndex) === -1);

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
    if (!actions.length) {
      setSelectedActionId('');
      return;
    }
    const exists = actions.some((action) => String(action.id || '') === String(selectedActionId || ''));
    if (!exists) {
      setSelectedActionId(String(actions[0]?.id || ''));
    }
  }, [actions.map((action) => action.id).join('|'), selectedActionId]);

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
    const node = overlayRef.current;
    if (!node || typeof window === 'undefined' || !window.ResizeObserver) return undefined;
    const syncSize = () => {
      const rect = node.getBoundingClientRect();
      setOverlaySize({ width: rect.width, height: rect.height });
    };
    syncSize();
    const observer = new window.ResizeObserver(() => syncSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isPlaying || playingActionId) return;
    if (actorDragStateRef.current || actorResizeStateRef.current || spriteResizeStateRef.current) return;
    const selectedAction = actions.find((action) => String(action.id || '') === String(selectedActionId || '')) || actions[0] || null;
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
    const nextWidth = Number(normalizedSelectedFrame?.width || block?.actorWidth || 140);
    const nextHeight = Number(normalizedSelectedFrame?.height || block?.actorHeight || 140);
    const rawX = Number(block?.actorX || 32);
    const rawY = Number(block?.actorY || 120);
    const nextX = actorDocked
      ? Math.min(Math.max(12, rawX), Math.max(12, Number(overlaySize.width || 0) - nextWidth - 12))
      : Math.max(0, rawX);
    const nextY = Math.min(Math.max(0, rawY), Math.max(0, Number(overlaySize.height || 0) - actorDragHeight - 12));
    const nextActorState = {
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
      frameUrl: String(
        normalizedSelectedFrame?.url
        || block?.actorImageUrl
        || (typeof actions[0]?.frames?.[0] === 'string' ? actions[0]?.frames?.[0] : actions[0]?.frames?.[0]?.url)
        || ''
      ),
      actionName: ''
    };
    setActorState((prev) => (
      prev.x === nextActorState.x
      && prev.y === nextActorState.y
      && prev.width === nextActorState.width
      && prev.height === nextActorState.height
      && prev.frameUrl === nextActorState.frameUrl
      && prev.actionName === nextActorState.actionName
        ? prev
        : nextActorState
    ));
  }, [block, actions, isPlaying, playingActionId, selectedActionId, actorDocked, overlaySize.width, overlaySize.height]);

  useEffect(() => {
    const audio = audioTimelineRef.current;
    if (!audio) return undefined;
    const syncAudioState = () => {
      setAudioDurationSec(Number.isFinite(audio.duration) ? audio.duration : 0);
      setAudioCurrentTimeSec(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
      setIsPlaying(!audio.paused && !audio.ended);
    };
    const onLoaded = () => syncAudioState();
    const onTimeUpdate = () => syncAudioState();
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setAudioCurrentTimeSec(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    syncAudioState();
    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, [baseAudioUrl]);

  useEffect(() => () => {
    if (actionLoopIntervalRef.current) {
      window.clearInterval(actionLoopIntervalRef.current);
      actionLoopIntervalRef.current = null;
    }
    if (audioMenuCloseTimerRef.current) {
      window.clearTimeout(audioMenuCloseTimerRef.current);
      audioMenuCloseTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const stopErasing = () => {
      if (spriteEditorDirtyRef.current) {
        const { actionId, frameIndex, isOriginalSelected } = spriteEditorDirtyRef.current;
        commitSpriteEditorCanvas(actionId, frameIndex, isOriginalSelected);
        spriteEditorDirtyRef.current = null;
      }
      spriteEditorEraseStateRef.current = false;
    };
    window.addEventListener('mouseup', stopErasing);
    return () => window.removeEventListener('mouseup', stopErasing);
  }, []);

  useEffect(() => {
    if (!sliceToolOpen) return;
    const onKeyDown = (event) => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedSliceBoxId) {
        event.preventDefault();
        setSliceBoxes((prev) => prev.filter((box) => box.id !== selectedSliceBoxId));
        setSelectedSliceBoxId('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sliceToolOpen, selectedSliceBoxId]);

  useEffect(() => {
    if (!sliceToolOpen) return;
    const onMouseMove = (event) => {
      updateSliceDrag(event.clientX, event.clientY);
    };
    const onMouseUp = () => {
      if (!sliceDragRef.current.active) return;
      if (sliceDragRef.current.mode === 'create' && sliceDraftBox) {
        setSliceBoxes((prev) => [...prev, sliceDraftBox]);
        setSelectedSliceBoxId(sliceDraftBox.id);
        setSliceDraftBox(null);
        if (sliceCreateMode) setSliceCreateMode(false);
      }
      sliceDragRef.current = { id: '', mode: '', offsetX: 0, offsetY: 0, active: false, handle: '' };
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [sliceToolOpen, sliceDraftBox, sliceCreateMode, sliceSourceSize.width, sliceSourceSize.height, sliceSource?.frame?.width, sliceSource?.frame?.height]);

  useEffect(() => {
    if (!isPlaying) return;
    if (sequencePlaybackRef.current) return;
    if (!activeTimelineAction) {
      setLoopFrameState({ actionId: '', frameIndex: -1 });
      setActorState((prev) => ({ ...prev, actionName: '' }));
      return;
    }
    const audio = audioTimelineRef.current;
    if (audio) {
      audio.playbackRate = Math.max(0.5, Math.min(2, Number(activeTimelineAction?.soundPitch || 1)));
    }
    const action = activeTimelineAction;
    const frames = Array.isArray(action.frames) && action.frames.length > 0
      ? action.frames.map((frame) => (typeof frame === 'string' ? frame : frame?.url)).filter(Boolean)
      : [block?.actorImageUrl].filter(Boolean);
    if (!frames.length) return;
    const startSec = Number(action.startSec || 0);
    const elapsedSec = Math.max(0, Number(audioCurrentTimeSec || 0) - startSec);
    const frameDurationSec = Math.max(0.05, Number(action?.frameDurationSec || 0.18));
    const frameIndex = frames.length <= 1 ? 0 : (Math.floor(elapsedSec / frameDurationSec) % frames.length);
    setLoopFrameState({ actionId: String(action.id || ''), frameIndex });
    setActorState((prev) => ({
      ...prev,
      frameUrl: String(frames[frameIndex] || block?.actorImageUrl || ''),
      actionName: action.name || 'Action'
    }));
  }, [isPlaying, audioCurrentTimeSec, activeTimelineAction?.id, block?.actorImageUrl]);

  useEffect(() => {
    const onMouseMove = (event) => {
      const shellRect = overlayRef.current?.getBoundingClientRect();
      if (!shellRect) return;
      const dragState = actorDragStateRef.current;
      if (dragState) {
        const minX = actorDocked ? 12 : 0;
        const nextX = Math.max(minX, Math.min(shellRect.width - actorState.width - 12, event.clientX - shellRect.left - dragState.x));
        const nextY = Math.max(0, Math.min(shellRect.height - actorDragHeight - 12, event.clientY - shellRect.top - dragState.y));
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
      const timelineDrag = timelineDragRef.current;
      if (timelineDrag) {
        const shellRect = timelineDrag.container?.getBoundingClientRect?.();
        if (!shellRect || shellRect.width <= 0) return;
        const ratio = Math.max(0, Math.min(1, (event.clientX - shellRect.left) / shellRect.width));
        const seconds = ratio * Math.max(1, Number(timelineDrag.totalSec || 1));
        if (timelineDrag.mode === 'seek') {
          const audio = audioTimelineRef.current;
          const snappedSeconds = snapTimelineSeconds(seconds);
          setAudioCurrentTimeSec(snappedSeconds);
          if (audio) audio.currentTime = snappedSeconds;
        } else if (timelineDrag.mode === 'move') {
          const targetIndex = actions.findIndex((action) => String(action.id || '') === String(timelineDrag.actionId || ''));
          if (targetIndex < 0) return;
          const previousEnd = targetIndex > 0
            ? Number(actions[targetIndex - 1]?.startSec || 0) + Number(actions[targetIndex - 1]?.durationSec || 0)
            : 0;
          const nextStartSec = snapTimelineSeconds(Math.max(previousEnd, seconds - Number(timelineDrag.offsetSec || 0)));
          const nextActions = actions.map((action, index) => (
            index === targetIndex ? { ...action, startSec: nextStartSec } : action
          ));
          updateActions(nextActions);
        } else if (timelineDrag.mode === 'resize') {
          const targetIndex = actions.findIndex((action) => String(action.id || '') === String(timelineDrag.actionId || ''));
          if (targetIndex < 0) return;
          const current = actions[targetIndex];
          const nextNeighbor = actions[targetIndex + 1] || null;
          const minDuration = 0.5;
          const maxDuration = nextNeighbor
            ? Math.max(minDuration, (Number(nextNeighbor.startSec || 0) + Number(nextNeighbor.durationSec || 0)) - Number(current.startSec || 0) - minDuration)
            : Math.max(minDuration, totalTimelineSec - Number(current.startSec || 0));
          const nextDuration = snapTimelineSeconds(Math.max(minDuration, Math.min(maxDuration, seconds - Number(timelineDrag.startSec || 0))));
          const nextActions = actions.map((action, index) => {
            if (index === targetIndex) return { ...action, durationSec: nextDuration };
            if (index === targetIndex + 1) {
              const nextStart = snapTimelineSeconds(Number(current.startSec || 0) + nextDuration);
              const nextEnd = Number(action.startSec || 0) + Number(action.durationSec || 0);
              return {
                ...action,
                startSec: nextStart,
                durationSec: Math.max(minDuration, nextEnd - nextStart)
              };
            }
            return action;
          });
          updateActions(nextActions);
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
      if (timelineDragRef.current) {
        timelineDragRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [actorState.x, actorState.y, actorState.width, actorState.height, actions, totalTimelineSec]);

  const updateRoot = (patch) => onChange?.({ ...block, ...patch, actions });
  const updateActions = (nextActions) => onChange?.({ ...block, actions: constrainTimelineActions(nextActions) });

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
    updateActions(actions.map((action) => action.id === actionId ? { ...action, frames: [...(action.frames || []), ...urls.map((url) => normalizeImportedFrame(url))] } : action));
    flashNotice("Sprite importé");
  };

  const updateAction = (actionId, patch) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, ...patch } : action));
  };

  const adjustSpriteSpeed = (actionId, delta) => {
    const action = actions.find((item) => item.id === actionId);
    if (!action) return;
    updateAction(actionId, {
      frameDurationSec: Math.max(0.05, Math.min(1.5, Number(action.frameDurationSec || 0.18) + delta))
    });
  };

  const updateSharedAudio = (soundUrl, soundPitch = null) => {
    const safeUrl = String(soundUrl || '').trim();
    updateActions(actions.map((action) => ({
      ...action,
      soundUrl: safeUrl,
      soundPitch: soundPitch == null ? Math.max(0.5, Math.min(2, Number(action.soundPitch || 1))) : Math.max(0.5, Math.min(2, Number(soundPitch || 1)))
    })));
  };

  const addAction = () => {
    const lastAction = actions[actions.length - 1];
    const nextStartSec = Math.max(0, Number(lastAction?.startSec || 0) + Number(lastAction?.durationSec || 0));
    updateActions([
      ...actions,
      { id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `Action ${actions.length + 1}`, frames: [], frameUrlInput: '', soundUrl: baseAudioUrl || '', soundPitch: 1, frameDurationSec: 0.18, startSec: nextStartSec, durationSec: 2, spritesOpen: false, spriteUrlOpen: false, spriteEditorOpen: false, selectedFrameIndex: 0 }
    ]);
  };

  const removeAction = (actionId) => {
    if (actions.length <= 1) return;
    updateActions(actions.filter((action) => action.id !== actionId));
    if (String(selectedActionId || '') === String(actionId || '')) {
      const fallback = actions.find((action) => String(action.id || '') !== String(actionId || ''));
      setSelectedActionId(String(fallback?.id || ''));
    }
  };

  const removeFrame = (actionId, frameIndex) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, frames: (action.frames || []).filter((_, index) => index !== frameIndex), selectedFrameIndex: Math.max(0, Math.min((action.selectedFrameIndex || 0), (action.frames || []).length - 2)) } : action));
  };

  const reorderFrames = (actionId, fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    updateActions(actions.map((action) => {
      if (action.id !== actionId) return action;
      const frames = Array.isArray(action.frames) ? [...action.frames] : [];
      if (fromIndex >= frames.length || toIndex >= frames.length) return action;
      const [moved] = frames.splice(fromIndex, 1);
      frames.splice(toIndex, 0, moved);
      let nextSelected = Number(action.selectedFrameIndex || 0);
      if (nextSelected === fromIndex) {
        nextSelected = toIndex;
      } else if (fromIndex < toIndex && nextSelected > fromIndex && nextSelected <= toIndex) {
        nextSelected -= 1;
      } else if (toIndex < fromIndex && nextSelected >= toIndex && nextSelected < fromIndex) {
        nextSelected += 1;
      }
      return { ...action, frames, selectedFrameIndex: nextSelected };
    }));
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
            soundPitch: Math.max(0.5, Math.min(2, Number(item.soundPitch || 1))),
            frames: [...(Array.isArray(item.frames) ? item.frames : []), ...incomingFrames.map((frame) => normalizeImportedFrame(frame))]
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

  const autoCutoutSelectedSprite = async (actionId) => {
    const action = actions.find((item) => item.id === actionId);
    if (!action) return;
    const selectedIndex = Number(action.selectedFrameIndex);
    if (selectedIndex === -1) {
      const nextActorUrl = block?.actorImageUrl ? await autoRemoveBgFromDataUrl(String(block.actorImageUrl || '')) : '';
      if (!nextActorUrl) return;
      updateRoot({ actorImageUrl: nextActorUrl });
      setActorState((prev) => ({ ...prev, frameUrl: nextActorUrl }));
      flashNotice('Sprite principal detoure');
      return;
    }
    const frame = action?.frames?.[selectedIndex];
    const normalizedFrame = typeof frame === 'string' ? createSpriteFrame(frame) : frame;
    const nextUrl = await autoRemoveBgFromDataUrl(String(normalizedFrame?.url || ''));
    if (!nextUrl) return;
    updateFrame(actionId, selectedIndex, { url: nextUrl });
    flashNotice('Sprite detoure');
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

  const commitSpriteEditorCanvas = (actionId, frameIndex, isOriginalSelected) => {
    const canvas = spriteEditorCanvasRef.current;
    if (!canvas) return;
    const nextUrl = canvas.toDataURL('image/png');
    if (isOriginalSelected) {
      updateRoot({ actorImageUrl: nextUrl });
      setActorState((prev) => ({ ...prev, frameUrl: nextUrl }));
      return;
    }
    updateFrame(actionId, frameIndex, { url: nextUrl });
  };

  const openSliceTool = (actionId, frameIndex, frame) => {
    if (!frame?.url) return;
    setSliceSource({
      actionId,
      frameIndex,
      frame
    });
    setSliceSourceSize({ width: 0, height: 0 });
    setSliceBoxes([]);
    setSliceCreateMode(false);
    setSliceDraftBox(null);
    setSelectedSliceBoxId('');
    setSliceToolOpen(true);
  };

  const createSliceBox = (x, y, width, height, maxWidth, maxHeight) => ({
    id: `slice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    x: Math.max(0, Math.min(Number(x || 0), maxWidth)),
    y: Math.max(0, Math.min(Number(y || 0), maxHeight)),
    width: Math.max(12, Math.min(Number(width || 0), maxWidth)),
    height: Math.max(12, Math.min(Number(height || 0), maxHeight))
  });

  const normalizeSliceBox = (box, sourceWidth, sourceHeight) => {
    const x = Math.max(0, Math.min(Number(box.x || 0), sourceWidth));
    const y = Math.max(0, Math.min(Number(box.y || 0), sourceHeight));
    const width = Math.max(12, Math.min(Number(box.width || 0), sourceWidth - x));
    const height = Math.max(12, Math.min(Number(box.height || 0), sourceHeight - y));
    return {
      ...box,
      x,
      y,
      width,
      height
    };
  };

  const getSlicePreviewMetrics = (element) => {
    const sourceWidth = Number(sliceSourceSize.width || sliceSource?.frame?.width || 1);
    const sourceHeight = Number(sliceSourceSize.height || sliceSource?.frame?.height || 1);
    const rect = element?.getBoundingClientRect?.();
    const displayWidth = Math.max(1, Number(rect?.width || sourceWidth || 1));
    const displayHeight = Math.max(1, Number(rect?.height || sourceHeight || 1));
    return {
      sourceWidth,
      sourceHeight,
      displayWidth,
      displayHeight
    };
  };

  const updateSliceDrag = (clientX, clientY) => {
    if (!sliceDragRef.current.active || !slicePreviewRef.current) return;
    const rect = slicePreviewRef.current.getBoundingClientRect();
    const sourceWidth = Number(sliceSourceSize.width || sliceSource?.frame?.width || rect.width || 1);
    const sourceHeight = Number(sliceSourceSize.height || sliceSource?.frame?.height || rect.height || 1);
    const displayWidth = Math.max(1, rect.width);
    const displayHeight = Math.max(1, rect.height);
    const pointerX = ((clientX - rect.left) / displayWidth) * sourceWidth;
    const pointerY = ((clientY - rect.top) / displayHeight) * sourceHeight;
    if (sliceDragRef.current.mode === 'move') {
      setSliceBoxes((prev) => prev.map((box) => (
        box.id === sliceDragRef.current.id
          ? normalizeSliceBox({
              ...box,
              x: pointerX - sliceDragRef.current.offsetX,
              y: pointerY - sliceDragRef.current.offsetY
            }, sourceWidth, sourceHeight)
          : box
      )));
      return;
    }
    if (sliceDragRef.current.mode === 'resize') {
      setSliceBoxes((prev) => prev.map((box) => {
        if (box.id !== sliceDragRef.current.id) return box;
        const handle = String(sliceDragRef.current.handle || '');
        const right = Number(box.x || 0) + Number(box.width || 0);
        const bottom = Number(box.y || 0) + Number(box.height || 0);
        const nextBox = { ...box };
        if (handle.includes('n')) {
          nextBox.y = Math.min(pointerY, bottom - 12);
          nextBox.height = bottom - nextBox.y;
        }
        if (handle.includes('s')) {
          nextBox.height = Math.max(12, pointerY - Number(nextBox.y || 0));
        }
        if (handle.includes('w')) {
          nextBox.x = Math.min(pointerX, right - 12);
          nextBox.width = right - nextBox.x;
        }
        if (handle.includes('e')) {
          nextBox.width = Math.max(12, pointerX - Number(nextBox.x || 0));
        }
        return normalizeSliceBox(nextBox, sourceWidth, sourceHeight);
      }));
      return;
    }
    if (sliceDragRef.current.mode === 'create' && sliceDraftBox) {
      const startX = sliceDragRef.current.offsetX;
      const startY = sliceDragRef.current.offsetY;
      setSliceDraftBox(normalizeSliceBox({
        ...sliceDraftBox,
        x: Math.min(startX, pointerX),
        y: Math.min(startY, pointerY),
        width: Math.abs(pointerX - startX),
        height: Math.abs(pointerY - startY)
      }, sourceWidth, sourceHeight));
    }
  };

  const applySliceTool = async () => {
    if (!sliceSource?.frame?.url) return;
    const targetActionId = String(sliceSource.actionId || '');
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const sourceWidth = Number(sliceSourceSize.width || image.width || sliceSource.frame.width || 140);
      const sourceHeight = Number(sliceSourceSize.height || image.height || sliceSource.frame.height || 140);
      const nextSlices = sliceBoxes
        .map((box) => normalizeSliceBox(box, sourceWidth, sourceHeight))
        .filter((box) => box.width >= 8 && box.height >= 8)
        .map((rect) => {
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(rect.width);
          canvas.height = Math.round(rect.height);
          const ctx = canvas.getContext('2d');
          if (!ctx) return null;
          ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
          return createSpriteFrame(canvas.toDataURL('image/png'));
        })
        .filter(Boolean);
      if (!nextSlices.length) {
        setSliceToolOpen(false);
        return;
      }
      const latestActions = normalizeTimelineActions(Array.isArray(block?.actions) ? block.actions : actions);
      updateActions(latestActions.map((action) => (
        String(action.id || '') === targetActionId
          ? {
              ...action,
              frames: (() => {
                const existingFrames = Array.isArray(action.frames) ? action.frames : [];
                const insertAfterIndex = Number(sliceSource?.frameIndex);
                if (insertAfterIndex >= 0 && insertAfterIndex < existingFrames.length) {
                  return [
                    ...existingFrames.slice(0, insertAfterIndex + 1),
                    ...nextSlices,
                    ...existingFrames.slice(insertAfterIndex + 1)
                  ];
                }
                return [...existingFrames, ...nextSlices];
              })(),
              spritesOpen: true,
              selectedFrameIndex: (() => {
                const existingCount = Array.isArray(action.frames) ? action.frames.length : 0;
                const insertAfterIndex = Number(sliceSource?.frameIndex);
                if (insertAfterIndex >= 0 && insertAfterIndex < existingCount) {
                  return insertAfterIndex + 1;
                }
                return Math.max(0, existingCount);
              })()
            }
          : action
      )));
      setSelectedActionId(targetActionId);
      setSliceToolOpen(false);
      setSliceSource(null);
      setSliceSourceSize({ width: 0, height: 0 });
      setSliceBoxes([]);
      setSliceCreateMode(false);
      setSliceDraftBox(null);
      setSelectedSliceBoxId('');
      flashNotice(`${nextSlices.length} sprites ajoutes`);
    };
    image.src = resolveWeb5eAssetUrl(String(sliceSource.frame.url || ''));
  };

  const eraseOnSpriteCanvas = (event, actionId, frameIndex, isOriginalSelected) => {
    const canvas = spriteEditorCanvasRef.current;
    if (!canvas || !eraserActive) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(rect.width, 1);
    const scaleY = canvas.height / Math.max(rect.height, 1);
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const radius = Math.max(2, Number(eraserSize || 24) / 2) * ((scaleX + scaleY) / 2);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    spriteEditorDirtyRef.current = { actionId, frameIndex, isOriginalSelected };
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
    updateActions(actions.map((item) => item.id === actionId ? { ...item, frames: [...(item.frames || []), normalizeImportedFrame(safeValue)], frameUrlInput: '' } : item));
    flashNotice("Sprite importé");
  };

  const pasteActionFrameFromClipboard = async (actionId) => {
    try {
      if (navigator.clipboard?.read) {
        const clipboardItems = await navigator.clipboard.read();
        for (const clipboardItem of clipboardItems) {
          const imageType = clipboardItem.types.find((type) => type.startsWith('image/'));
          if (!imageType) continue;
          const blob = await clipboardItem.getType(imageType);
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('reader'));
            reader.readAsDataURL(blob);
          });
          importActionFrameFromValue(actionId, dataUrl);
          return;
        }
      }
      if (navigator.clipboard?.readText) {
        const text = String(await navigator.clipboard.readText()).trim();
        if (text) {
          importActionFrameFromValue(actionId, text);
          return;
        }
      }
    } catch (_) {}
    flashNotice("Collage impossible");
  };

  const toggleAudioRecord = async () => {
    if (recordingAudio) {
      audioRecordManualStopRef.current = true;
      if (recorderRef.current) {
        recorderRef.current.stop();
      } else {
        setRecordingAudio(false);
      }
      return;
    }
    setRecordingAudio(true);
    try {
      audioRecordManualStopRef.current = false;
      if (typeof window === 'undefined' || !window.MediaRecorder) {
        throw new Error('MediaRecorder indisponible');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderOptions = window.MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : (window.MediaRecorder.isTypeSupported?.('audio/mp4')
          ? { mimeType: 'audio/mp4' }
          : undefined);
      const recorder = new window.MediaRecorder(stream, recorderOptions);
      recorderChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data?.size) recorderChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blobType = String(recorder.mimeType || recorderOptions?.mimeType || 'audio/webm');
        const blob = new Blob(recorderChunksRef.current, { type: blobType });
        if (blob.size > 0) {
          const reader = new FileReader();
          reader.onload = () => updateSharedAudio(String(reader.result || ''));
          reader.readAsDataURL(blob);
        }
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderChunksRef.current = [];
        if (audioRecordManualStopRef.current) {
          setRecordingAudio(false);
          audioRecordManualStopRef.current = false;
        } else {
          flashNotice('Rec interrompu');
        }
      };
      recorder.onerror = () => {
        stream.getTracks().forEach((track) => track.stop());
        recorderRef.current = null;
        recorderChunksRef.current = [];
        if (audioRecordManualStopRef.current) {
          setRecordingAudio(false);
          audioRecordManualStopRef.current = false;
        }
        flashNotice('Erreur micro');
      };
      recorderRef.current = recorder;
      recorder.start();
    } catch (error) {
      audioRecordManualStopRef.current = false;
      setRecordingAudio(false);
      flashNotice(String(error?.message || 'Micro inaccessible'));
    }
  };

  const importRecordedAudio = async () => {
    const currentAudio = extractSharedAudioMeta(block);
    let availableAudios = [];
    let debugPayload = null;
    try {
      const presentationTitle = String(block?.presentationName || '').trim();
      const presenterName = String(block?.presenterName || '').trim();
      debugPayload = {
        presentationTitle,
        presenterName,
        slideNumber: Math.max(1, Number(slideNumber || 1)),
        currentAudioUrl: String(currentAudio.soundUrl || '').trim(),
        backupAudioUrl: ''
      };
      if (presenterName) {
        const backupRes = await fetch(
          `/api/exposes/presenter-backup?presenterName=${encodeURIComponent(presenterName)}`
        );
        const backupData = await backupRes.json().catch(() => ({}));
        if (backupRes.ok && backupData?.ok) {
          const rows = Array.isArray(backupData?.recordings) && backupData.recordings.length > 0
            ? backupData.recordings
            : (backupData?.recordingUrl ? [backupData] : []);
          availableAudios = rows
            .map((row, index) => ({
              id: String(row?.id || `audio_${index}`),
              soundUrl: String(row?.recordingUrl || '').trim(),
              soundPitch: Math.max(0.5, Math.min(2, Number(row?.recordingPitch || 1))),
              slideNumber: Math.max(1, Number(row?.slideNumber || 1)),
              durationSec: Math.max(0, Number(row?.durationSec || 0)),
              selected: row?.selected === true
            }))
            .filter((row) => row.soundUrl);
          const firstAudio = availableAudios[0] || null;
          debugPayload = {
            ...debugPayload,
            backupAudioUrl: String(firstAudio?.soundUrl || ''),
            backupPitch: Math.max(0.5, Math.min(2, Number(firstAudio?.soundPitch || 1))),
            backupSlideNumber: Math.max(1, Number(firstAudio?.slideNumber || 1)),
            backupCount: availableAudios.length
          };
        }
      }
    } catch (_) {}
    setImportDebug(debugPayload);
    setImportOptions(availableAudios);
    setSelectedImportId(String(availableAudios[0]?.id || ''));
    if (!availableAudios.length) {
      flashNotice("Aucun audio CondaWeb");
      return;
    }
    flashNotice(`${availableAudios.length} audio${availableAudios.length > 1 ? 's' : ''} trouvé${availableAudios.length > 1 ? 's' : ''}`);
  };

  const openAudioMenuTab = async (tab) => {
    const nextTab = String(tab || 'charger') === 'rec' ? 'rec' : 'charger';
    setAudioMenuTab(nextTab);
    if (nextTab === 'charger') {
      await importRecordedAudio();
    }
  };

  const loadPresenterSprites = async (actionId) => {
    const presenterName = String(block?.presenterName || '').trim();
    if (!presenterName) {
      flashNotice("Choisis d'abord l'exposant");
      return;
    }
    try {
      const backupRes = await fetch(`/api/exposes/presenter-backup?presenterName=${encodeURIComponent(presenterName)}`);
      const backupData = await backupRes.json().catch(() => ({}));
      if (!backupRes.ok || !backupData?.ok) {
        setImageImportOptions([]);
        updateAction(actionId, { mobileImportOpen: true });
        flashNotice("Aucune image CondaWeb");
        return;
      }
      const sourceRows = Array.isArray(backupData?.recordings) && backupData.recordings.length > 0
        ? backupData.recordings
        : [backupData];
      const seen = new Set();
      const nextOptions = sourceRows.flatMap((row, rowIndex) => {
        const urls = Array.isArray(row?.spriteImageUrls) ? row.spriteImageUrls : [];
        return urls
          .map((url, imageIndex) => ({
            id: `${String(row?.id || rowIndex)}_${imageIndex}`,
            url: String(url || '').trim(),
            slideNumber: Math.max(1, Number(row?.slideNumber || backupData?.slideNumber || 1)),
            selected: row?.selected === true
          }))
          .filter((item) => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });
      });
      setImageImportOptions(nextOptions);
      updateAction(actionId, { mobileImportOpen: true });
      flashNotice(nextOptions.length ? `${nextOptions.length} image${nextOptions.length > 1 ? 's' : ''} CondaWeb` : 'Aucune image CondaWeb');
    } catch (_) {
      flashNotice("Import images impossible");
    }
  };

  const importPresenterSprite = (actionId, spriteUrl) => {
    const safeValue = String(spriteUrl || '').trim();
    if (!safeValue) {
      flashNotice("Aucune image détectée");
      return;
    }
    updateActions(actions.map((item) => item.id === actionId
      ? {
          ...item,
          frames: [...(item.frames || []), normalizeImportedFrame(safeValue)],
          frameUrlInput: '',
          mobileImportOpen: false
        }
      : item));
    setImageImportOptions([]);
    flashNotice("Sprite importé");
  };

  const applyImportedAudio = async (audioId = '') => {
    const currentAudio = extractSharedAudioMeta(block);
    const targetId = String(audioId || selectedImportId || '');
    const nextAudio = importOptions.find((row) => String(row.id || '') === targetId) || importOptions[0] || null;
    if (!nextAudio?.soundUrl) {
      flashNotice("Aucun audio selectionne");
      return;
    }
    if (String(currentAudio.soundUrl || '').trim() === String(nextAudio.soundUrl || '').trim()
      && Math.abs(Number(currentAudio.soundPitch || 1) - Number(nextAudio.soundPitch || 1)) < 0.001) {
      flashNotice("Backup deja charge");
      return;
    }
    try {
      const probe = await fetch(nextAudio.soundUrl, { method: 'HEAD' });
      if (!probe.ok) {
        flashNotice("Backup audio introuvable");
        return;
      }
    } catch (_) {
      flashNotice("Backup audio inaccessible");
      return;
    }
    const audio = audioTimelineRef.current;
    if (audio) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch (_) {}
    }
    setIsPlaying(false);
    setAudioCurrentTimeSec(0);
    updateSharedAudio('', nextAudio.soundPitch);
    window.setTimeout(() => {
      updateSharedAudio(nextAudio.soundUrl, nextAudio.soundPitch);
    }, 0);
    setSelectedImportId(String(nextAudio.id || ''));
    if (audioMenuCloseTimerRef.current) {
      window.clearTimeout(audioMenuCloseTimerRef.current);
    }
    audioMenuCloseTimerRef.current = window.setTimeout(() => {
      setAudioMenuOpen(false);
      audioMenuCloseTimerRef.current = null;
    }, 500);
    flashNotice("Audio CondaWeb importé");
  };

  const toggleTimelinePlayback = async () => {
    const audio = audioTimelineRef.current;
    if (!audio || !baseAudioUrl) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      if (audio.currentTime >= Math.max(0, Number(audio.duration || totalTimelineSec || 0)) - 0.05) {
        audio.currentTime = 0;
        setAudioCurrentTimeSec(0);
      }
      audio.playbackRate = Math.max(0.5, Math.min(2, Number(activeTimelineAction?.soundPitch || actions[0]?.soundPitch || 1)));
      await audio.play();
    } catch (_) {}
  };

  const seekTimeline = (nextTime) => {
    const audio = audioTimelineRef.current;
    const safeTime = Math.max(0, Math.min(totalTimelineSec, Number(nextTime || 0)));
    setAudioCurrentTimeSec(safeTime);
    if (audio) audio.currentTime = safeTime;
  };

  const playAnimation = async (customActions = null, options = {}) => {
    if (isPlaying) {
      playAnimationStopRef.current = true;
      const audio = audioTimelineRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
      setIsPlaying(false);
      sequencePlaybackRef.current = false;
      return;
    }
    const withAudio = options.withAudio !== false;
    const sequence = Array.isArray(customActions) && customActions.length > 0 ? customActions : actions;
    playAnimationStopRef.current = false;
    sequencePlaybackRef.current = true;
    setIsPlaying(true);
    for (const action of sequence) {
      if (playAnimationStopRef.current) break;
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
          if (playAnimationStopRef.current) return;
          frameIndex = (frameIndex + 1) % frames.length;
          setActorState((prev) => ({ ...prev, frameUrl: String(frames[frameIndex] || '') }));
        }, Math.max(50, Number(action.frameDurationSec || 0.18) * 1000));
      }
      let audio = null;
      if (withAudio && action.soundUrl) {
        try {
          audio = new Audio(action.soundUrl);
          audio.playbackRate = Math.max(0.5, Math.min(2, Number(action.soundPitch || 1)));
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
    playAnimationStopRef.current = false;
    sequencePlaybackRef.current = false;
  };

  const toggleActionLoop = async (action) => {
    if (!action?.id) return;
    if (playingActionId === action.id) {
      if (actionLoopIntervalRef.current) {
        window.clearInterval(actionLoopIntervalRef.current);
        actionLoopIntervalRef.current = null;
      }
      actionLoopStopRef.current = { stop: true, actionId: action.id };
      setPlayingActionId('');
      setLoopFrameState({ actionId: '', frameIndex: -1 });
      return;
    }
    if (actionLoopIntervalRef.current) {
      window.clearInterval(actionLoopIntervalRef.current);
      actionLoopIntervalRef.current = null;
    }
    actionLoopStopRef.current = { stop: false, actionId: action.id };
    setPlayingActionId(action.id);
    setSelectedActionId(String(action.id || ''));
    const frames = Array.isArray(action.frames) && action.frames.length > 0
      ? action.frames.map((frame) => (typeof frame === 'string' ? frame : frame?.url)).filter(Boolean)
      : [block?.actorImageUrl].filter(Boolean);
    if (!frames.length) return;
    let frameIndex = 0;
    setLoopFrameState({ actionId: String(action.id || ''), frameIndex: 0 });
    setActorState((prev) => ({
      ...prev,
      frameUrl: String(frames[0] || block?.actorImageUrl || ''),
      actionName: action.name || 'Action'
    }));
    if (frames.length === 1) {
      actionLoopIntervalRef.current = window.setInterval(() => {
        setLoopFrameState({ actionId: String(action.id || ''), frameIndex: 0 });
        setActorState((prev) => ({ ...prev, frameUrl: String(frames[0] || ''), actionName: action.name || 'Action' }));
      }, 240);
      return;
    }
    actionLoopIntervalRef.current = window.setInterval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      setLoopFrameState({ actionId: String(action.id || ''), frameIndex });
      setActorState((prev) => ({
        ...prev,
        frameUrl: String(frames[frameIndex] || ''),
        actionName: action.name || 'Action'
      }));
    }, Math.max(50, Number(action.frameDurationSec || 0.18) * 1000));
  };

  const showActionFrame = (action) => {
    if (!action) return;
    const frames = Array.isArray(action.frames) && action.frames.length > 0
      ? action.frames.map((frame) => (typeof frame === 'string' ? frame : frame?.url)).filter(Boolean)
      : [block?.actorImageUrl].filter(Boolean);
    setSelectedActionId(String(action.id || ''));
    setLoopFrameState({ actionId: '', frameIndex: -1 });
    setActorState((prev) => ({
      ...prev,
      frameUrl: String(frames[0] || block?.actorImageUrl || ''),
      actionName: action.name || 'Action'
    }));
  };

  const showNextAction = () => {
    if (!actions.length) return;
    const currentIndex = actions.findIndex((action) => String(action.id || '') === String(selectedActionId || ''));
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % actions.length : 0;
    showActionFrame(actions[nextIndex]);
  };

  const selectedAction = actions.find((action) => String(action.id || '') === String(selectedActionId || '')) || actions[0] || null;
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
  const playingLoopAction = actions.find((action) => String(action.id || '') === String(playingActionId || '')) || null;
  const loopStateAction = actions.find((action) => String(action.id || '') === String(loopFrameState.actionId || '')) || null;
  const playingLoopFrame = loopStateAction && Number(loopFrameState.frameIndex) >= 0
    ? loopStateAction.frames?.[loopFrameState.frameIndex]
    : null;
  const normalizedPlayingLoopFrame = typeof playingLoopFrame === 'string' ? createSpriteFrame(playingLoopFrame) : playingLoopFrame;
  const actorRenderWidth = Number(normalizedSelectedFrame?.width || actorState.width || block?.actorWidth || 140);
  const actorRenderHeight = Number(normalizedSelectedFrame?.height || actorState.height || block?.actorHeight || 140);
  const actorRenderFrame = resolveWeb5eAssetUrl(String(
    String(loopFrameState.actionId || '')
      ? (normalizedPlayingLoopFrame?.url || currentActorFrame || '')
      : ((isPlaying ? currentActorFrame : (normalizedSelectedFrame?.url || currentActorFrame || '')) || '')
  ));
  const actorDragHeight = Math.max(
    actorRenderHeight,
    Number(actorFigureRef.current?.offsetHeight || 0)
  );
  const actorOuterHeight = actorRef.current?.offsetHeight || actorRenderHeight;
  const editorPanelTop = Number(actorState.y || 0) + actorOuterHeight + 12;
  const editorPanelLeft = actorDocked ? 12 : Math.max(0, Number(actorState.x || 0));
  const safePresentationNumber = Math.max(1, Number(block?.presentationNumber || presentationNumber || 1));
  const safeSlideNumber = Math.max(1, Number(block?.slideNumber || slideNumber || 1));
  const animationCode = `${safePresentationNumber}${safeSlideNumber}`;

  return (
    <div className="animation-block-shell">
      <div ref={overlayRef} className="animation-page-overlay visible">
        {!readOnly ? (
          <button
            type="button"
            className="animation-dock-toggle"
            onClick={toggleActorDocked}
          >
            {actorDocked ? 'Fermer espace mascotte' : 'Ouvrir espace mascotte'}
          </button>
        ) : null}
        <div
          ref={actorRef}
          className={`animation-page-actor ${readOnly ? 'readonly' : 'draggable'} ${isActorSelected ? 'selected' : ''}`}
          style={{
            transform: `translate(${Number(actorState.x || 0)}px, ${Number(actorState.y || 0)}px)`
          }}
          onMouseDown={startDragActor}
          onClick={() => {
            if (readOnly) return;
            if (!toolbarAction?.id) return;
            selectOriginalActor(toolbarAction.id);
          }}
        >
          <div className="animation-actor-name top">{animationCode}</div>
          <div
            ref={actorFigureRef}
            className="animation-page-actor-figure"
            style={{ width: actorRenderWidth, height: actorRenderHeight }}
            draggable={Boolean(block?.actorImageUrl)}
            onDragStart={(event) => {
              const spriteUrl = resolveWeb5eAssetUrl(String(block?.actorImageUrl || ''));
              if (!spriteUrl) return;
              event.dataTransfer.setData('text/plain', spriteUrl);
              event.dataTransfer.setData('text/uri-list', spriteUrl);
              event.dataTransfer.effectAllowed = 'copy';
            }}
          >
            {actorRenderFrame ? (
              <img
                src={actorRenderFrame}
                alt={block?.actorName || 'Personnage'}
                draggable={false}
                onDragStart={(event) => event.preventDefault()}
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
          {!readOnly ? (
            <div className="animation-actor-floating-actions">
              <button
                type="button"
                className="animation-actor-copy-btn"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  void copyActiveActorToClipboard();
                }}
              >
                Copier
              </button>
              <button
                type="button"
                className="animation-actor-copy-btn"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  setEditorPanelOpen((prev) => !prev);
                }}
              >
                {editorPanelOpen ? 'Fermer' : 'Ouvrir'}
              </button>
            </div>
          ) : null}
        </div>
        {!readOnly && editorPanelOpen ? (
        <div
          className="animation-editor compact-floating"
          style={{
            top: `${editorPanelTop}px`,
            left: `${editorPanelLeft}px`
          }}
        >
          {baseAudioUrl ? <audio ref={audioTimelineRef} src={baseAudioUrl} preload="metadata" /> : null}
          {!readOnly && (
            <div className="animation-sprite-toolbar" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void handleActorFile(e.dataTransfer.files); }}>
              <button type="button" className={`animation-sprite-play ${isPlaying ? 'active' : ''}`} onClick={toggleTimelinePlayback}>{isPlaying ? 'Pause' : 'Play'}</button>
              <button type="button" className="animation-add-action-btn" onClick={addAction}>+</button>
              <div className="animation-audio-menu-shell">
                <button
                  type="button"
                  className={`animation-rec-btn ${recordingAudio || audioMenuOpen ? 'active' : ''}`}
                  onClick={() => {
                    setAudioMenuOpen((prev) => {
                      const nextOpen = !prev;
                      if (nextOpen) {
                        setAudioMenuTab('charger');
                        void importRecordedAudio();
                      }
                      return nextOpen;
                    });
                  }}
                >
                  Audio
                </button>
                {audioMenuOpen ? (
                  <div className="animation-audio-menu">
                    <div className="animation-audio-menu-actions">
                      <button
                        type="button"
                        className={audioMenuTab === 'rec' ? 'active' : ''}
                        onClick={() => void openAudioMenuTab('rec')}
                      >
                        Rec
                      </button>
                      <button
                        type="button"
                        className={audioMenuTab === 'charger' ? 'active' : ''}
                        onClick={() => void openAudioMenuTab('charger')}
                      >
                        Charger
                      </button>
                    </div>
                    {audioMenuTab === 'rec' ? (
                      <div className="animation-audio-rec-panel">
                        <button
                          type="button"
                          className={`animation-audio-rec-toggle ${recordingAudio ? 'is-recording' : ''}`}
                          onClick={() => void toggleAudioRecord()}
                        >
                          <span className="animation-audio-rec-dot" />
                          {recordingAudio ? 'Rec allumé' : 'Rec éteint'}
                        </button>
                      </div>
                    ) : importOptions.length > 0 ? (
                      <div className="animation-audio-option-list">
                        {importOptions.map((option, index) => {
                          const isSelected = String(selectedImportId || '') === String(option.id || '');
                          return (
                            <button
                              key={String(option.id || `import_option_${index}`)}
                              type="button"
                              className={`animation-audio-option ${isSelected ? 'active' : ''}`}
                              onClick={() => void applyImportedAudio(String(option.id || ''))}
                            >
                              slide {option.slideNumber} • {option.durationSec}s {option.selected ? '• choisi prof' : ''}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="animation-audio-empty">Aucun audio à charger.</div>
                    )}
                  </div>
                ) : null}
              </div>
              <button type="button" className="animation-gemini-btn" onClick={openChatGptPopup}>ChatGPT</button>
              {!readOnly ? <button type="button" className="animation-action-remove" onClick={onRemove}>×</button> : null}
            </div>
          )}
          {importNotice ? <div className="animation-import-notice">{importNotice}</div> : null}
          <div className="animation-timeline-shell">
            <div className="animation-timeline-topline">
              <span>Audio</span>
              <span>{audioCurrentTimeSec.toFixed(1)}s / {totalTimelineSec.toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max={Math.max(0.1, totalTimelineSec)}
              step="0.01"
              value={Math.min(totalTimelineSec, audioCurrentTimeSec)}
              onChange={(e) => seekTimeline(e.target.value)}
              className="animation-audio-scrubber"
            />
            <div
              className="animation-sequence-track"
              onMouseDown={(event) => {
                timelineDragRef.current = {
                  mode: 'seek',
                  container: event.currentTarget,
                  totalSec: totalTimelineSec
                };
              }}
            >
              <div
                className="animation-sequence-playhead"
                style={{ left: `${(Math.min(totalTimelineSec, audioCurrentTimeSec) / Math.max(totalTimelineSec, 0.1)) * 100}%` }}
              />
              {actions.map((action, index) => {
                const left = (Number(action.startSec || 0) / Math.max(totalTimelineSec, 0.1)) * 100;
                const width = (Number(action.durationSec || 0.5) / Math.max(totalTimelineSec, 0.1)) * 100;
                const isActive = String(selectedActionId || activeTimelineAction?.id || '') === String(action.id || '');
                const colorHue = (index * 67) % 360;
                return (
                  <div
                    key={`timeline_${action.id}`}
                    className={`animation-sequence-segment ${isActive ? 'active' : ''}`}
                    style={{
                      left: `${left}%`,
                      width: `${Math.max(width, 4)}%`,
                      background: `hsl(${colorHue} 62% 34%)`
                    }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setSelectedActionId(String(action.id || ''));
                      timelineDragRef.current = {
                        mode: 'move',
                        actionId: action.id,
                        container: event.currentTarget.parentElement,
                        totalSec: totalTimelineSec,
                        offsetSec: ((event.clientX - event.currentTarget.getBoundingClientRect().left) / Math.max(event.currentTarget.getBoundingClientRect().width, 1)) * Number(action.durationSec || 0.5),
                        durationSec: Number(action.durationSec || 0.5)
                      };
                    }}
                  >
                    <span>{action.name || `Action ${index + 1}`}</span>
                    <button
                      type="button"
                      className="animation-sequence-resize"
                      onMouseDown={(event) => {
                        event.stopPropagation();
                        timelineDragRef.current = {
                          mode: 'resize',
                          actionId: action.id,
                          container: event.currentTarget.parentElement.parentElement,
                          totalSec: totalTimelineSec,
                          startSec: Number(action.startSec || 0)
                        };
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="animation-action-stack compact">
          {actions.filter((action) => String(action.id || '') === String(selectedActionId || '')).map((action) => {
            const index = actions.findIndex((row) => String(row.id || '') === String(action.id || ''));
            return (
            <div key={action.id} className="animation-action-card compact">
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
                  <button type="button" className="icon-btn" onClick={() => toggleSpritesOpen(action.id)} aria-label="Afficher les sprites">👤</button>
                  <button type="button" className={playingActionId === action.id ? 'playing active icon-btn' : 'icon-btn'} onClick={() => void toggleActionLoop(action)}>{playingActionId === action.id ? '■' : '▶'}</button>
                </div>
                <div className="animation-speed-controls animation-speed-controls-inline">
                  <button type="button" onClick={() => adjustSpriteSpeed(action.id, 0.05)}>-</button>
                  <span>{`${Number(action.frameDurationSec || 0.18).toFixed(2)}s`}</span>
                  <button type="button" onClick={() => adjustSpriteSpeed(action.id, -0.05)}>+</button>
                </div>
                {!readOnly && actions.length > 1 ? <button type="button" className="animation-action-remove small" onClick={(e) => { e.stopPropagation(); removeAction(action.id); }}>×</button> : null}
              </div>
              {action.spritesOpen && !readOnly && (
                <div
                  className="animation-sprite-space"
                  tabIndex={0}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void appendFrames(action.id, e.dataTransfer.files); }}
                  onPaste={(e) => handleUrlOrImagePaste(e, (nextValue) => importActionFrameFromValue(action.id, nextValue))}
                >
                  <div className="animation-sprite-space-head">
                    <div className="animation-sprite-space-title">Sprites</div>
                    <div className="animation-sprite-space-actions">
                      <button type="button" onClick={() => actionFileInputRefs.current[action.id]?.click()}>+ordi</button>
                      <div className="animation-mobile-import-shell">
                        <button
                          type="button"
                          onClick={() => {
                            if (action.mobileImportOpen) {
                              setImageImportOptions([]);
                              updateAction(action.id, { mobileImportOpen: false });
                              return;
                            }
                            void loadPresenterSprites(action.id);
                          }}
                        >
                          +tel
                        </button>
                        {action.mobileImportOpen ? (
                          <div className="animation-mobile-import-popover">
                            {imageImportOptions.length > 0 ? (
                              <div className="animation-frame-strip in-space">
                                {imageImportOptions.map((option, optionIndex) => (
                                  <button
                                    key={String(option.id || `mobile_sprite_${optionIndex}`)}
                                    type="button"
                                    className="animation-frame-thumb from-mobile"
                                    onClick={() => importPresenterSprite(action.id, option.url)}
                                    title={`Slide ${option.slideNumber}${option.selected ? ' • choisi prof' : ''}`}
                                  >
                                    <img src={resolveWeb5eAssetUrl(option.url)} alt="" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="animation-frame-empty">Aucune image prof</div>
                            )}
                            <div className="animation-mobile-import-help">Choisis un sprite pour l’ajouter puis fermer ce menu.</div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
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
                      <div
                        key={`${action.id}_${frameIndex}`}
                        className={`animation-frame-thumb ${
                          String(playingActionId || '') === String(action.id || '')
                            ? (String(loopFrameState.actionId || '') === String(action.id || '') && Number(loopFrameState.frameIndex) === frameIndex ? 'selected' : '')
                            : (frameIndex === (action.selectedFrameIndex || 0) ? 'selected' : '')
                        }`}
                        draggable
                        onDragStart={() => {
                          spriteDragStateRef.current = { actionId: action.id, frameIndex };
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={() => {
                          const dragState = spriteDragStateRef.current;
                          if (dragState.actionId !== action.id) return;
                          reorderFrames(action.id, Number(dragState.frameIndex), frameIndex);
                          spriteDragStateRef.current = { actionId: '', frameIndex: -1 };
                        }}
                        onDragEnd={() => {
                          spriteDragStateRef.current = { actionId: '', frameIndex: -1 };
                        }}
                        onClick={() => selectFrame(action.id, frameIndex)}
                      >
                        <img src={resolveWeb5eAssetUrl(typeof frame === 'string' ? frame : frame?.url)} alt="" />
                        {!readOnly ? <button type="button" onClick={(e) => { e.stopPropagation(); removeFrame(action.id, frameIndex); }}>×</button> : null}
                      </div>
                    ))}
                    {(!action.frames || action.frames.length === 0) && <div className="animation-frame-empty">Aucun sprite</div>}
                  </div>
                  <div className="animation-sprite-space-footer">
                    <button type="button" onClick={() => void copySelectedActionFrameToClipboard(action.id)}>Copier</button>
                    <button type="button" onClick={() => void pasteActionFrameFromClipboard(action.id)}>Coller</button>
                    <button
                      type="button"
                      onClick={() => {
                        const footerFrameIndex = Number(action.selectedFrameIndex) === -1 ? -1 : Number(action.selectedFrameIndex || 0);
                        const footerFrame = footerFrameIndex === -1
                          ? {
                              url: String(block?.actorImageUrl || ''),
                              width: Number(block?.actorWidth || 140),
                              height: Number(block?.actorHeight || 140)
                            }
                          : action.frames?.[footerFrameIndex];
                        const normalizedFooterFrame = typeof footerFrame === 'string' ? createSpriteFrame(footerFrame) : footerFrame;
                        if (!normalizedFooterFrame?.url) return;
                        openSliceTool(action.id, footerFrameIndex, normalizedFooterFrame);
                      }}
                    >
                      Ciseaux
                    </button>
                    <button type="button" onClick={() => toggleSpriteEditorOpen(action.id)}>Edition</button>
                    <button type="button" onClick={() => void autoCutoutSelectedSprite(action.id)}>Detourer</button>
                  </div>
                  <input ref={(node) => { actionFileInputRefs.current[action.id] = node; }} type="file" accept="image/*" multiple className="hidden-file-input" onChange={(e) => void appendFrames(action.id, e.target.files)} />
                </div>
              )}
              {!readOnly && action.spriteEditorOpen ? (
                <div className="animation-editor-detached-shell">
                  {(() => {
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
                const editorFrameIndex = isOriginalSelected ? -1 : (action.selectedFrameIndex || 0);
                return (
                  <div className="animation-sprite-editor-panel">
                    {normalizedFrame?.url ? (
                      <>
                        <div className="animation-sprite-editor-preview">
                          <div
                            className="animation-sprite-editor-target"
                            style={{ width: Number(normalizedFrame.width || 140), height: Number(normalizedFrame.height || 140) }}
                          >
                            <canvas
                              key={`${action.id}-${editorFrameIndex}-${normalizedFrame.url}`}
                              ref={(node) => {
                                spriteEditorCanvasRef.current = node;
                                if (!node) return;
                                const nextWidth = Math.max(1, Number(normalizedFrame.width || 140));
                                const nextHeight = Math.max(1, Number(normalizedFrame.height || 140));
                                const sourceKey = `${normalizedFrame.url}|${nextWidth}|${nextHeight}`;
                                if (node.dataset.sourceKey === sourceKey) return;
                                const image = new Image();
                                image.onload = () => {
                                  node.width = nextWidth;
                                  node.height = nextHeight;
                                  const ctx = node.getContext('2d');
                                  if (!ctx) return;
                                  ctx.clearRect(0, 0, node.width, node.height);
                                  ctx.drawImage(image, 0, 0, node.width, node.height);
                                  node.dataset.sourceKey = sourceKey;
                                };
                                image.src = normalizedFrame.url;
                              }}
                              className={`animation-sprite-editor-canvas ${eraserActive ? 'eraser-active' : ''}`}
                              style={{
                                width: Number(normalizedFrame.width || 140),
                                height: Number(normalizedFrame.height || 140),
                                transform: `translate(${Number(normalizedFrame.offsetX || 0)}px, ${Number(normalizedFrame.offsetY || 0)}px) scale(${Number(normalizedFrame.scale || 1)})`
                              }}
                              onMouseDown={(e) => {
                                if (eraserActive) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  spriteEditorEraseStateRef.current = true;
                                  eraseOnSpriteCanvas(e, action.id, editorFrameIndex, isOriginalSelected);
                                  return;
                                }
                                handleEditorImageMouseDown(e, action.id, editorFrameIndex);
                              }}
                              onMouseMove={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setEraserCursor({
                                  visible: eraserActive,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                });
                                if (eraserActive && spriteEditorEraseStateRef.current) {
                                  eraseOnSpriteCanvas(e, action.id, editorFrameIndex, isOriginalSelected);
                                }
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setEraserCursor({
                                  visible: eraserActive,
                                  x: e.clientX - rect.left,
                                  y: e.clientY - rect.top
                                });
                              }}
                              onMouseLeave={() => setEraserCursor({ visible: false, x: 0, y: 0 })}
                              onMouseUp={(e) => {
                                if (eraserActive) {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }
                                spriteEditorEraseStateRef.current = false;
                              }}
                            />
                            {eraserActive && eraserCursor.visible ? (
                              <div
                                className="animation-eraser-cursor"
                                style={{
                                  width: eraserSize,
                                  height: eraserSize,
                                  left: eraserCursor.x,
                                  top: eraserCursor.y
                                }}
                              />
                            ) : null}
                            <button type="button" className="animation-editor-resizer nw" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'nw')} />
                            <button type="button" className="animation-editor-resizer ne" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'ne')} />
                            <button type="button" className="animation-editor-resizer sw" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'sw')} />
                            <button type="button" className="animation-editor-resizer se" onMouseDown={(e) => startSpriteResize(e, action.id, isOriginalSelected ? -1 : (action.selectedFrameIndex || 0), 'se')} />
                          </div>
                        </div>
                        <div
                          className="animation-sprite-editor-controls"
                          tabIndex={0}
                          onPaste={(e) => handleUrlOrImagePaste(e, (nextValue) => importActionFrameFromValue(action.id, nextValue))}
                        >
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
                          <div className="animation-sprite-adjust-row">
                            <button
                              type="button"
                              className={eraserActive ? 'icon-btn animation-eraser-toggle active' : 'icon-btn animation-eraser-toggle'}
                              onClick={() => setEraserActive((prev) => !prev)}
                              aria-label="Activer la gomme"
                              title="Gomme"
                            >
                              G
                            </button>
                            <button type="button" className="icon-btn animation-eraser-size-btn" onClick={() => setEraserSize((prev) => Math.max(6, prev - 4))}>-</button>
                            <span className="animation-eraser-size-readout">{eraserSize}</span>
                            <button type="button" className="icon-btn animation-eraser-size-btn" onClick={() => setEraserSize((prev) => Math.min(80, prev + 4))}>+</button>
                            <button
                              type="button"
                              className="icon-btn animation-scissors-btn"
                              onClick={() => openSliceTool(action.id, editorFrameIndex, normalizedFrame)}
                              title="Decouper en sprites"
                            >
                              ✂
                            </button>
                          </div>
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
                  })()}
                </div>
              ) : null}
            </div>
          )})}
          </div>
        </div>
        ) : (
          <div className="animation-readonly-controls">
            {typeof onPreviousSlide === 'function' ? (
              <button
                type="button"
                className="animation-add-action-btn"
                onClick={onPreviousSlide}
                disabled={!canGoPrevious}
              >
                Precedent
              </button>
            ) : null}
            <button type="button" className={`animation-sprite-play ${isPlaying ? 'active' : ''}`} onClick={() => void playAnimation()}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            {typeof onNextSlide === 'function' ? (
              <button
                type="button"
                className="animation-add-action-btn"
                onClick={onNextSlide}
                disabled={!canGoNext}
              >
                Suivant
              </button>
            ) : (
              <button type="button" className="animation-add-action-btn" onClick={showNextAction}>
                Suivant
              </button>
            )}
          </div>
        )}
      </div>
      {sliceToolOpen && sliceSource?.frame?.url ? (
        <div className="animation-slice-overlay" onClick={() => setSliceToolOpen(false)}>
          <div className="animation-slice-window" onClick={(event) => event.stopPropagation()}>
            <div className="animation-slice-head">
              <strong>Selectionner les sprites</strong>
              <button type="button" className="animation-action-remove small" onClick={() => setSliceToolOpen(false)}>×</button>
            </div>
            <div className="animation-slice-help">Ajoute un cadre, place-le autour d'un sprite, puis applique. Chaque cadre deviendra un sprite.</div>
            <div className="animation-slice-mode-row">
              <button
                type="button"
                className={sliceCreateMode ? 'active' : ''}
                onClick={() => {
                  setSliceCreateMode((prev) => !prev);
                }}
              >
                Selectionner un sprite
              </button>
              <button
                type="button"
                className="animation-slice-delete-btn"
                disabled={!selectedSliceBoxId}
                onClick={() => {
                  setSliceBoxes((prev) => prev.filter((box) => box.id !== selectedSliceBoxId));
                  setSelectedSliceBoxId('');
                }}
              >
                Effacer
              </button>
            </div>
            <div
              className="animation-slice-preview"
              ref={slicePreviewRef}
              onMouseDown={(event) => {
                const handleTarget = event.target?.closest?.('[data-resize-handle]');
                const boxTarget = event.target?.closest?.('[data-box-id]');
                const targetBoxId = String(handleTarget?.dataset?.boxId || boxTarget?.dataset?.boxId || '');
                const resizeHandle = String(handleTarget?.dataset?.resizeHandle || '');
                const { sourceWidth, sourceHeight, displayWidth, displayHeight } = getSlicePreviewMetrics(event.currentTarget);
                const rect = event.currentTarget.getBoundingClientRect();
                const pointerX = ((event.clientX - rect.left) / Math.max(displayWidth, 1)) * sourceWidth;
                const pointerY = ((event.clientY - rect.top) / Math.max(displayHeight, 1)) * sourceHeight;
                if (targetBoxId) {
                  const targetBox = sliceBoxes.find((box) => box.id === targetBoxId);
                  if (!targetBox) return;
                  sliceDragRef.current = {
                    id: targetBoxId,
                    mode: resizeHandle ? 'resize' : 'move',
                    offsetX: resizeHandle ? pointerX : pointerX - Number(targetBox.x || 0),
                    offsetY: resizeHandle ? pointerY : pointerY - Number(targetBox.y || 0),
                    active: true,
                    handle: resizeHandle
                  };
                  setSelectedSliceBoxId(targetBoxId);
                  event.preventDefault();
                  return;
                }
                setSelectedSliceBoxId('');
                const nextBox = createSliceBox(pointerX, pointerY, sourceWidth * 0.16, sourceHeight * 0.2, sourceWidth, sourceHeight);
                setSliceDraftBox(nextBox);
                setSelectedSliceBoxId(nextBox.id);
                sliceDragRef.current = {
                  id: nextBox.id,
                  mode: 'create',
                  offsetX: pointerX,
                  offsetY: pointerY,
                  active: true,
                  handle: ''
                };
              }}
              onMouseMove={(event) => {
                if (sliceDragRef.current.active) {
                  updateSliceDrag(event.clientX, event.clientY);
                  return;
                }
              }}
              onMouseLeave={() => {
                if (!sliceDragRef.current.active) {
                  sliceDragRef.current = { id: '', mode: '', offsetX: 0, offsetY: 0, active: false, handle: '' };
                }
              }}
            >
              <img
                src={resolveWeb5eAssetUrl(sliceSource.frame.url)}
                alt=""
                draggable={false}
                onLoad={(event) => {
                  const nextWidth = Number(event.currentTarget.naturalWidth || 0);
                  const nextHeight = Number(event.currentTarget.naturalHeight || 0);
                  if (nextWidth > 0 && nextHeight > 0) {
                    setSliceSourceSize((prev) => (
                      prev.width === nextWidth && prev.height === nextHeight
                        ? prev
                        : { width: nextWidth, height: nextHeight }
                    ));
                  }
                }}
                onDragStart={(event) => event.preventDefault()}
              />
              {sliceBoxes.map((box, index) => {
                const sourceWidth = Number(sliceSourceSize.width || sliceSource?.frame?.width || 1);
                const sourceHeight = Number(sliceSourceSize.height || sliceSource?.frame?.height || 1);
                return (
                  <button
                    key={box.id || `slice-box-${index}`}
                    type="button"
                    data-box-id={box.id}
                    className={`animation-slice-box ${selectedSliceBoxId === box.id ? 'selected' : ''}`}
                    style={{
                      left: `${(Number(box.x || 0) / Math.max(sourceWidth, 1)) * 100}%`,
                      top: `${(Number(box.y || 0) / Math.max(sourceHeight, 1)) * 100}%`,
                      width: `${(Number(box.width || 0) / Math.max(sourceWidth, 1)) * 100}%`,
                      height: `${(Number(box.height || 0) / Math.max(sourceHeight, 1)) * 100}%`
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedSliceBoxId(box.id);
                    }}
                    title="Selection de sprite"
                  >
                    {selectedSliceBoxId === box.id ? (
                      <>
                        <span className="animation-slice-box-handle nw" data-box-id={box.id} data-resize-handle="nw" />
                        <span className="animation-slice-box-handle n" data-box-id={box.id} data-resize-handle="n" />
                        <span className="animation-slice-box-handle ne" data-box-id={box.id} data-resize-handle="ne" />
                        <span className="animation-slice-box-handle e" data-box-id={box.id} data-resize-handle="e" />
                        <span className="animation-slice-box-handle sw" data-box-id={box.id} data-resize-handle="sw" />
                        <span className="animation-slice-box-handle s" data-box-id={box.id} data-resize-handle="s" />
                        <span className="animation-slice-box-handle se" data-box-id={box.id} data-resize-handle="se" />
                        <span className="animation-slice-box-handle w" data-box-id={box.id} data-resize-handle="w" />
                      </>
                    ) : null}
                  </button>
                );
              })}
              {sliceDraftBox ? (
                <div
                  className="animation-slice-box draft"
                  style={{
                    left: `${(Number(sliceDraftBox.x || 0) / Math.max(Number(sliceSourceSize.width || sliceSource?.frame?.width || 1), 1)) * 100}%`,
                    top: `${(Number(sliceDraftBox.y || 0) / Math.max(Number(sliceSourceSize.height || sliceSource?.frame?.height || 1), 1)) * 100}%`,
                    width: `${(Number(sliceDraftBox.width || 0) / Math.max(Number(sliceSourceSize.width || sliceSource?.frame?.width || 1), 1)) * 100}%`,
                    height: `${(Number(sliceDraftBox.height || 0) / Math.max(Number(sliceSourceSize.height || sliceSource?.frame?.height || 1), 1)) * 100}%`
                  }}
                />
              ) : null}
            </div>
            <div className="animation-slice-actions">
              <button type="button" onClick={() => { setSliceBoxes([]); setSliceDraftBox(null); setSelectedSliceBoxId(''); }}>Reinitialiser</button>
              <button type="button" className="primary-btn" onClick={applySliceTool}>Appliquer</button>
            </div>
          </div>
        </div>
      ) : null}
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
  const [voteMascotImportOptions, setVoteMascotImportOptions] = useState([]);
  const [voteMascotImportOpen, setVoteMascotImportOpen] = useState('');
  const [activeSection, setActiveSection] = useState('eau');
  const [activeTabBySection, setActiveTabBySection] = useState({ eau: 'manquer-eau', energie: 'fossiles' });
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT);
  const [siteData, setSiteData] = useState(null);
  const [tabDocsByKey, setTabDocsByKey] = useState({});
  const [entryDocsByKey, setEntryDocsByKey] = useState({});
  const [publicEntriesByKey, setPublicEntriesByKey] = useState({});
  const [saveErrorMessage, setSaveErrorMessage] = useState('');
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
      const cachedPublicEntries = readPublicEntriesCache();
      if (localContent && typeof localContent === 'object') {
        setContentMap((prev) => ({ ...prev, ...localContent }));
      }
      try {
        const res = await fetch(resolveWeb5eApiUrl('/api/web5e/public'), { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'Chargement impossible');

        const tabs = Array.isArray(data.tabs) ? data.tabs : [];
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const nextTabDocs = {};
        const nextEntryDocs = {};
        const nextPublicEntriesByKey = {};
        const nextContentMap = { eau: {}, energie: {} };

        tabs.forEach((tab) => {
          const sectionKey = String(tab.sectionKey || '').trim().toLowerCase();
          const tabKey = String(tab.tabKey || '').trim().toLowerCase();
          if (!sectionKey || !tabKey) return;
          nextTabDocs[`${sectionKey}:${tabKey}`] = tab;
          if (!nextContentMap[sectionKey]) nextContentMap[sectionKey] = {};
          const matchingEntries = entries.filter((row) => String(row.tabId || '') === String(tab._id || ''));
          nextPublicEntriesByKey[`${sectionKey}:${tabKey}`] = matchingEntries;
          const entry = matchingEntries[0];
          nextEntryDocs[`${sectionKey}:${tabKey}`] = entry || null;
          nextContentMap[sectionKey][tabKey] = Array.isArray(entry?.blocks) && entry.blocks.length > 0
            ? entry.blocks
            : (DEFAULT_CONTENT[sectionKey]?.[tabKey] || []);
        });

        Object.keys(DEFAULT_CONTENT).forEach((sectionKey) => {
          nextContentMap[sectionKey] = { ...(DEFAULT_CONTENT[sectionKey] || {}), ...(nextContentMap[sectionKey] || {}) };
        });

        const mergedPublicEntriesByKey = { ...cachedPublicEntries };
        Object.entries(nextPublicEntriesByKey).forEach(([key, rows]) => {
          const nextRows = Array.isArray(rows) ? rows : [];
          const cachedRows = Array.isArray(mergedPublicEntriesByKey[key]) ? mergedPublicEntriesByKey[key] : [];
          const seen = new Set();
          mergedPublicEntriesByKey[key] = [...nextRows, ...cachedRows].filter((row) => {
            const rowId = String(row?._id || '');
            if (rowId && seen.has(rowId)) return false;
            if (rowId) seen.add(rowId);
            return true;
          });
        });

        setSiteData(data.site || null);
        setTabDocsByKey(nextTabDocs);
        setEntryDocsByKey(nextEntryDocs);
        setPublicEntriesByKey(mergedPublicEntriesByKey);
        writePublicEntriesCache(mergedPublicEntriesByKey);
        setContentMap(localContent && isLocalSessionMode ? { ...nextContentMap, ...localContent } : nextContentMap);
      } catch (_) {
        if (Object.keys(cachedPublicEntries).length > 0) {
          setPublicEntriesByKey(cachedPublicEntries);
        }
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
    setSaveErrorMessage('');
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
      const res = await fetch(resolveWeb5eApiUrl('/api/web5e/entries'), {
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
      if (!res.ok || !data?.entry) {
        throw new Error(data?.error || `Sauvegarde publique impossible (${res.status})`);
      }
      setEntryDocsByKey((prev) => ({ ...prev, [docKey]: data.entry }));
      setPublicEntriesByKey((prev) => {
        const currentRows = Array.isArray(prev[docKey]) ? prev[docKey] : [];
        const nextRows = [...currentRows];
        const existingIndex = nextRows.findIndex((row) => String(row?._id || '') === String(data.entry?._id || ''));
        if (existingIndex >= 0) nextRows[existingIndex] = data.entry;
        else nextRows.unshift(data.entry);
        const nextState = { ...prev, [docKey]: nextRows };
        writePublicEntriesCache(nextState);
        return nextState;
      });
    } catch (error) {
      console.error('WEB5E save failed', error);
      setSaveErrorMessage(String(error?.message || 'Sauvegarde publique impossible'));
    }
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
      const res = await fetch(resolveWeb5eApiUrl('/api/web5e/site'), {
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
  const currentPublicEntries = Array.isArray(publicEntriesByKey[`${activeSection}:${currentTabId}`])
    ? publicEntriesByKey[`${activeSection}:${currentTabId}`]
    : [];
  const allPublicEntries = Object.values(publicEntriesByKey)
    .flatMap((rows) => Array.isArray(rows) ? rows : []);
  const validatedPresentationsFromCurrentBlocks = articleBlocks
    .filter(({ block }) => block.type === 'text' && isPresentationReadyForPublication(block))
    .map(({ block, index }) => ({ index, presentation: normalizePresentationBlock(block) }));
  const contributionSignature = formatContributionName(currentEntry?.authorName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim());
  const voteBoard = normalizeVoteBoard(siteData?.voteBoard || null);
  const currentUserVoteKey = String(user?.id || user?._id || '').trim();
  const currentUserVotes = currentUserVoteKey ? (voteBoard.votesByUser[currentUserVoteKey] || {}) : {};
  const validatedPresentations = user
    ? validatedPresentationsFromCurrentBlocks
    : (() => {
      const sourceEntries = allPublicEntries.length > 0 ? allPublicEntries : currentPublicEntries;
      const fromPublicEntries = sourceEntries.flatMap((entry, entryIndex) => (
        (Array.isArray(entry?.blocks) ? entry.blocks : [])
          .map((block, blockIndex) => ({ block, blockIndex, entryIndex }))
          .filter(({ block }) => block?.type === 'text' && isPresentationReadyForPublication(block))
          .map(({ block, blockIndex, entryIndex: publicEntryIndex }) => ({
            index: blockIndex,
            presentation: normalizePresentationBlock(block),
            publicEntryIndex
          }))
      ));
      return dedupePublishedPresentations(fromPublicEntries.length > 0 ? fromPublicEntries : validatedPresentationsFromCurrentBlocks);
    })();
  const studentHasValidatedPresentation = !isTeacher && validatedPresentations.length > 0;
  const [openedValidatedPresentationIndex, setOpenedValidatedPresentationIndex] = useState(-1);
  const [openedValidatedPresentationMode, setOpenedValidatedPresentationMode] = useState('browse');
  const [editingPresentationBlockIndex, setEditingPresentationBlockIndex] = useState(-1);
  const hasLockedPresentationEditing = Boolean(user) && editingPresentationBlockIndex >= 0;
  const presentationBlocks = blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'text')
    .map(({ block, index }) => ({ index, presentation: normalizePresentationBlock(block) }));
  const preferredStudentPresentationIndex = editingPresentationBlockIndex >= 0
    ? editingPresentationBlockIndex
    : (validatedPresentations[0]?.index ?? presentationBlocks[0]?.index ?? -1);
  const hasEmptyPresentationName = presentationBlocks.some(({ presentation }) => !String(presentation.presentationName || '').trim());
  const visibleArticleBlocks = user
    ? articleBlocks.filter(({ block, index }) => {
        if (block.type !== 'text') return true;
        if (isTeacher) return true;
        if (studentHasValidatedPresentation && !hasLockedPresentationEditing) return false;
        return index === preferredStudentPresentationIndex;
      })
    : articleBlocks.filter(({ block }) => block.type !== 'text');

  const persistVoteBoard = async (nextVoteBoard) => {
    const res = await fetch(resolveWeb5eApiUrl('/api/web5e/votes'), {
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

  const addVoteMascotProposalFromUrl = async (categoryKey, imageUrl) => {
    if (!currentUserVoteKey) return;
    const safeUrl = String(imageUrl || '').trim();
    if (!safeUrl) return;
    const nextVoteBoard = normalizeVoteBoard(siteData?.voteBoard || null);
    const existingProposal = (nextVoteBoard.mascots[categoryKey] || []).find((row) => String(row?.proposedBy || '') === currentUserVoteKey);
    if (existingProposal) return;
    nextVoteBoard.mascots[categoryKey] = [
      ...(nextVoteBoard.mascots[categoryKey] || []),
      { id: `vote_${categoryKey}_${Date.now()}`, imageUrl: safeUrl, proposedBy: currentUserVoteKey }
    ];
    await persistVoteBoard(nextVoteBoard);
    setVoteMascotImportOptions([]);
    setVoteMascotImportOpen('');
  };

  const loadVoteMascotImports = async (categoryKey) => {
    if (!user || !currentUserVoteKey) return;
    const presenterName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    if (!presenterName) return;
    try {
      const backupRes = await fetch(`/api/exposes/presenter-backup?presenterName=${encodeURIComponent(presenterName)}`);
      const backupData = await backupRes.json().catch(() => ({}));
      if (!backupRes.ok || !backupData?.ok) {
        setVoteMascotImportOptions([]);
        setVoteMascotImportOpen(categoryKey);
        return;
      }
      const sourceRows = Array.isArray(backupData?.recordings) && backupData.recordings.length > 0
        ? backupData.recordings
        : [backupData];
      const seen = new Set();
      const nextOptions = sourceRows.flatMap((row, rowIndex) => {
        const urls = Array.isArray(row?.spriteImageUrls) ? row.spriteImageUrls : [];
        return urls
          .map((url, imageIndex) => ({
            id: `${String(row?.id || rowIndex)}_${imageIndex}`,
            url: String(url || '').trim()
          }))
          .filter((item) => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
          });
      });
      setVoteMascotImportOptions(nextOptions);
      setVoteMascotImportOpen(categoryKey);
    } catch (_) {
      setVoteMascotImportOptions([]);
      setVoteMascotImportOpen(categoryKey);
    }
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
                          <img src={resolveWeb5eAssetUrl(option.imageUrl) || option.imageUrl} alt="" />
                          <strong>{countVotesForOption(voteBoard, category.key, option.id)}</strong>
                        </button>
                      ))}
                    </div>
                    <div className="vote-proposal-row vote-mascot-actions">
                      <label className="presentation-slide-add">
                        +ordi
                        <input type="file" accept="image/*" className="hidden-file-input" disabled={alreadyProposed} onChange={(e) => void addVoteMascotProposal(category.key, e.target.files)} />
                      </label>
                      <div className="vote-mascot-import-shell">
                        <button
                          type="button"
                          className="presentation-slide-add"
                          disabled={alreadyProposed}
                          onClick={() => {
                            if (voteMascotImportOpen === category.key) {
                              setVoteMascotImportOpen('');
                              setVoteMascotImportOptions([]);
                              return;
                            }
                            void loadVoteMascotImports(category.key);
                          }}
                        >
                          +tel
                        </button>
                        {voteMascotImportOpen === category.key ? (
                          <div className="vote-mascot-import-popover">
                            {voteMascotImportOptions.length > 0 ? (
                              <div className="vote-mascot-import-grid">
                                {voteMascotImportOptions.map((option) => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className="vote-mascot-import-option"
                                    onClick={() => void addVoteMascotProposalFromUrl(category.key, option.url)}
                                  >
                                    <img src={resolveWeb5eAssetUrl(option.url)} alt="" />
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="vote-mascot-import-empty">Aucune image CondaWeb.</div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>
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
          {isTeacher && (
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

        {saveErrorMessage ? (
          <div className="web5e-save-error-banner">
            {saveErrorMessage}
          </div>
        ) : null}

        {validatedPresentations.length > 0 && (!user || !hasLockedPresentationEditing) ? (
          <div className="validated-presentations-grid">
            {validatedPresentations.map(({ presentation, index }) => (
              <article
                key={`validated-presentation-${index}`}
                className={`validated-presentation-card ${!user ? 'public-only-card' : ''}`}
                onClick={() => {
                  if (user) return;
                  setOpenedValidatedPresentationMode(presentation.canvaLiveUrl ? 'canva' : 'slideshow');
                  setOpenedValidatedPresentationIndex(index);
                }}
              >
                {user ? <div className="validated-presentation-eyebrow">Presentation validee</div> : null}
                <h3>{presentation.presentationName || `Presentation ${index + 1}`}</h3>
                {user ? (
                  <>
                    <div className="validated-presentation-meta">
                      <span>{presentation.slides.length} slides</span>
                      <span>{Array.isArray(presentation.qcmQuestions) ? presentation.qcmQuestions.length : 0} questions QCM</span>
                    </div>
                    <div className="validated-presentation-actions">
                      {isTeacher ? (
                        <>
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
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="presentation-slide-add"
                        onClick={() => {
                          const targetBlockIndex = validatedPresentations[index].index;
                          const targetBlock = blocks[targetBlockIndex];
                          if (targetBlock?.type === 'text') {
                            const normalizedTargetBlock = normalizePresentationBlock(targetBlock);
                            replaceBlock(targetBlockIndex, {
                              ...normalizedTargetBlock,
                              activeEditorTab: 'slides'
                            });
                          }
                          setEditingPresentationBlockIndex(targetBlockIndex);
                          setOpenedValidatedPresentationMode('browse');
                          setOpenedValidatedPresentationIndex(-1);
                        }}
                      >
                        Modifier
                      </button>
                      {isTeacher && isLocalSessionMode ? (
                        <button type="button" className="presentation-slide-add danger" onClick={() => deleteValidatedPresentationCard(index)}>Supprimer</button>
                      ) : null}
                    </div>
                  </>
                ) : null}
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
              simpleMode={!user}
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
                  allUsersData={allUsersData}
                  currentUserName={`${user?.firstName || ''} ${user?.lastName || ''}`.trim()}
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
