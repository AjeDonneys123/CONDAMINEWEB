import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const WEB5E_SESSION_KEY = 'web5eBridgeSession';
const WEB5E_LOCAL_CONTENT_KEY = 'web5eLocalContentV1';

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
    value: type === 'text' ? '<h3>Nouveau bloc</h3><p>Écris ici.</p>' : ''
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

const ARTICLE_COLORS = ['#1d2942', '#0ea5e9', '#ec4899', '#f97316', '#16a34a', '#7c3aed'];
const WEB5E_EDITOR_PASSWORD = 'condamine';
const WEB5E_TEACHER_PASSWORD = 'a';
const WEB5E_DIRECT_STUDENT_PREFIX = 'web5e-direct-student';

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

function buildActionQrUrl({ sectionKey = '', tabKey = '', blockIndex = 0, actionId = '' } = {}) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mobileAction', '1');
    url.searchParams.set('section', String(sectionKey || '').trim());
    url.searchParams.set('tab', String(tabKey || '').trim());
    url.searchParams.set('block', String(blockIndex));
    url.searchParams.set('action', String(actionId || '').trim());
    return url.toString();
  } catch (_) {
    return '';
  }
}

function MobileActionRemote({
  sectionKey,
  tabKey,
  blockIndex,
  actionId,
  blocks,
  entryDoc,
  tabDoc,
  onPersist
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const [recording, setRecording] = useState(false);

  const block = blocks?.[blockIndex] || null;
  const action = Array.isArray(block?.actions) ? block.actions.find((item) => item.id === actionId) : null;

  const persistNextBlocks = async (nextBlocks) => {
    if (!entryDoc?._id || !tabDoc?._id) return;
    setSaving(true);
    try {
      await onPersist?.(nextBlocks);
      setMessage('Envoye');
      window.setTimeout(() => setMessage(''), 1600);
    } finally {
      setSaving(false);
    }
  };

  const appendPhotos = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file.type.startsWith('image/'));
    if (files.length === 0 || !block || !action) return;
    const urls = await Promise.all(files.map((file) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    })));
    const nextBlocks = blocks.map((row, rowIndex) => (
      rowIndex === blockIndex
        ? {
            ...row,
            actions: (row.actions || []).map((item) => (
              item.id === actionId
                ? { ...item, frames: [...(item.frames || []), ...urls.map((url) => createSpriteFrame(url))] }
                : item
            ))
          }
        : row
    ));
    await persistNextBlocks(nextBlocks);
  };

  const toggleRecord = async () => {
    if (recording && recorderRef.current) {
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
      recorder.onstop = async () => {
        const blob = new Blob(recorderChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = async () => {
          const nextBlocks = blocks.map((row, rowIndex) => (
            rowIndex === blockIndex
              ? {
                  ...row,
                  actions: (row.actions || []).map((item) => (
                    item.id === actionId ? { ...item, soundUrl: String(reader.result || '') } : item
                  ))
                }
              : row
          ));
          await persistNextBlocks(nextBlocks);
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
    } catch (_) {}
  };

  if (!block || !action) {
    return <div className="mobile-action-shell"><div className="mobile-action-card">Action introuvable.</div></div>;
  }

  return (
    <div className="mobile-action-shell">
      <div className="mobile-action-card">
        <div className="eyebrow">Action mobile</div>
        <h1>{action.name || 'Action'}</h1>
        <p>Ajoute du son ou des photos de sprites depuis le telephone.</p>
        <div className="mobile-action-buttons">
          <button type="button" className={recording ? 'mobile-rec active' : 'mobile-rec'} onClick={() => void toggleRecord()}>
            {recording ? 'Arreter micro' : 'Enregistrer micro'}
          </button>
          <label className="mobile-upload-btn">
            Envoyer des photos
            <input type="file" accept="image/*" capture="environment" multiple className="hidden-file-input" onChange={(e) => void appendPhotos(e.target.files)} />
          </label>
        </div>
        {saving ? <div className="mobile-action-status">Envoi...</div> : null}
        {message ? <div className="mobile-action-status">{message}</div> : null}
      </div>
    </div>
  );
}

function ArticleEditor({ value, onChange, readOnly }) {
  const [fontFamily, setFontFamily] = useState('Arial');
  const [selectedColor, setSelectedColor] = useState('#1d2942');
  const editorRef = useRef(null);
  const lastHtmlRef = useRef(String(value || ''));

  useEffect(() => {
    const nextHtml = String(value || '');
    const editor = editorRef.current;
    lastHtmlRef.current = nextHtml;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [value]);

  const exec = (command, commandValue = null) => {
    document.execCommand(command, false, commandValue);
  };

  const applyColor = (color) => {
    setSelectedColor(color);
    exec('styleWithCSS', true);
    exec('foreColor', color);
  };

  const handleImageInsert = () => {
    const imageUrl = window.prompt("Colle l'URL de l'image à insérer");
    if (!imageUrl) return;
    const safeUrl = String(imageUrl).trim();
    if (!safeUrl) return;
    const html = `<img src="${safeUrl.replace(/"/g, '&quot;')}" alt="" style="max-width:320px;width:100%;height:auto;border-radius:18px;display:block;margin:18px auto;" />`;
    exec('insertHTML', html);
    const nextHtml = editorRef.current?.innerHTML || '';
    lastHtmlRef.current = nextHtml;
    onChange?.(nextHtml);
  };

  if (readOnly) {
    return <div className="public-text article-render" dangerouslySetInnerHTML={{ __html: value || '' }} />;
  }

  return (
    <div className="article-editor-shell">
      <div className="article-toolbar">
        <select
          value={fontFamily}
          onChange={(e) => {
            setFontFamily(e.target.value);
            exec('fontName', e.target.value);
          }}
        >
          {ARTICLE_FONTS.map((font) => (
            <option key={font.value} value={font.value}>{font.label}</option>
          ))}
        </select>
        <button type="button" onClick={() => exec('bold')}><strong>Gras</strong></button>
        <button type="button" onClick={() => exec('italic')}><em>Italique</em></button>
        <button type="button" onClick={() => exec('underline')}><u>Souligné</u></button>
        <button type="button" onClick={() => exec('insertUnorderedList')}>Liste</button>
        <button type="button" onClick={handleImageInsert}>Image</button>
        <div className="article-colors">
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
      </div>
      <div
        ref={editorRef}
        className="article-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => {
          const nextHtml = e.currentTarget.innerHTML;
          lastHtmlRef.current = nextHtml;
          onChange?.(nextHtml);
        }}
      />
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

function AnimationBlockEditor({ block, onChange, onRemove, readOnly, sectionKey = '', tabKey = '', blockIndex = 0 }) {
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
  const currentActorFrame = actorState.frameUrl || block?.actorImageUrl || (typeof actions[0]?.frames?.[0] === 'string' ? actions[0]?.frames?.[0] : actions[0]?.frames?.[0]?.url) || '';
  const actorRenderWidth = Number(normalizedSelectedFrame?.width || actorState.width || block?.actorWidth || 140);
  const actorRenderHeight = Number(normalizedSelectedFrame?.height || actorState.height || block?.actorHeight || 140);
  const actorRenderFrame = String((isPlaying || playingActionId) ? currentActorFrame : (normalizedSelectedFrame?.url || currentActorFrame || ''));

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
          <div className="animation-actor-name top">{block?.actorName || 'Personnage'}</div>
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
                <div className="animation-action-qr">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=92x92&data=${encodeURIComponent(buildActionQrUrl({ sectionKey, tabKey, blockIndex, actionId: action.id }))}`}
                    alt="QR action"
                  />
                </div>
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
                        <img src={block.actorImageUrl} alt="" />
                      </div>
                    ) : null}
                    {(action.frames || []).map((frame, frameIndex) => (
                      <div key={`${action.id}_${frameIndex}`} className={`animation-frame-thumb ${frameIndex === (action.selectedFrameIndex || 0) ? 'selected' : ''}`} onClick={() => selectFrame(action.id, frameIndex)}>
                        <img src={typeof frame === 'string' ? frame : frame?.url} alt="" />
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
  const [activeSection, setActiveSection] = useState('eau');
  const [activeTabBySection, setActiveTabBySection] = useState({ eau: 'manquer-eau', energie: 'fossiles' });
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT);
  const [siteData, setSiteData] = useState(null);
  const [tabDocsByKey, setTabDocsByKey] = useState({});
  const [entryDocsByKey, setEntryDocsByKey] = useState({});
  const [saveNotice, setSaveNotice] = useState('');
  const pageParams = useMemo(() => {
    try {
      return new URLSearchParams(window.location.search);
    } catch (_) {
      return new URLSearchParams();
    }
  }, []);
  const isMobileActionMode = pageParams.get('mobileAction') === '1';
  const mobileSectionKey = String(pageParams.get('section') || '').trim().toLowerCase();
  const mobileTabKey = String(pageParams.get('tab') || '').trim().toLowerCase();
  const mobileBlockIndex = Number(pageParams.get('block') || 0);
  const mobileActionId = String(pageParams.get('action') || '').trim();
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
      setSaveNotice('Sauvegarde automatique effectuee');
      window.setTimeout(() => setSaveNotice(''), 1800);
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

  const updateBlock = (index, value) => {
    const nextBlocks = blocks.map((block, i) => i === index ? { ...block, value } : block);
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const removeBlock = (index) => {
    if (blocks.length <= 1) return;
    const nextBlocks = blocks.filter((_, i) => i !== index);
    updateBlocks(nextBlocks);
    queueAutosave(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const isTeacher = clean(user?.lastName) === 'vuillet' && (clean(user?.firstName) === 'jp' || clean(user?.firstName) === 'jean');
  const currentEntry = entryDocsByKey[`${activeSection}:${currentTabId}`];
  const contributionSignature = formatContributionName(currentEntry?.authorName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim());

  const persistSpecificBlocks = async ({ sectionKey, tabKey, nextBlocks }) => {
    const docKey = `${sectionKey}:${tabKey}`;
    const tabDoc = tabDocsByKey[docKey];
    const existingEntry = entryDocsByKey[docKey];
    if (!tabDoc?._id) return;
    try {
      const res = await fetch('/api/web5e/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          _id: existingEntry?._id || '',
          tabId: tabDoc._id,
          studentId: user?.id || user?._id || '',
          authorName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
          title: tabDoc.title || '',
          blocks: nextBlocks,
          isPublished: true
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.entry) {
        setEntryDocsByKey((prev) => ({ ...prev, [docKey]: data.entry }));
        setContentMap((prev) => ({
          ...prev,
          [sectionKey]: {
            ...(prev[sectionKey] || {}),
            [tabKey]: nextBlocks
          }
        }));
      }
    } catch (_) {}
  };

  if (isMobileActionMode) {
    const remoteBlocks = contentMap[mobileSectionKey]?.[mobileTabKey] || [];
    return (
      <MobileActionRemote
        sectionKey={mobileSectionKey}
        tabKey={mobileTabKey}
        blockIndex={mobileBlockIndex}
        actionId={mobileActionId}
        blocks={remoteBlocks}
        entryDoc={entryDocsByKey[`${mobileSectionKey}:${mobileTabKey}`]}
        tabDoc={tabDocsByKey[`${mobileSectionKey}:${mobileTabKey}`]}
        onPersist={(nextBlocks) => persistSpecificBlocks({ sectionKey: mobileSectionKey, tabKey: mobileTabKey, nextBlocks })}
      />
    );
  }

  return (
    <div className="web5e-shell">
      <button className="login-toggle" onClick={() => setLoginOpen((prev) => !prev)}>
        {user ? `${user.firstName} ${user.lastName}` : 'Connexion élève'}
      </button>
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
          <div className="eyebrow">Projet 5e</div>
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
              <button onClick={() => addBlock('text')}>Article</button>
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

        <div className="blocks-area public article-stage">
          {articleBlocks.map(({ block, index }) => (
            <article key={`${activeSection}-${currentTabId}-${index}`} className={`block-card ${block.type === 'animation' ? 'block-card-animation' : ''}`}>
              <div className="block-head">
                <span>
                  {block.type === 'text'
                    ? 'Article'
                    : block.type === 'image'
                      ? 'Image'
                      : block.type === 'animation'
                        ? 'Animation'
                        : 'Iframe / Jeu'}
                </span>
                {user && <button onClick={() => removeBlock(index)}>Supprimer</button>}
              </div>

              {block.type === 'text' && (
                <ArticleEditor
                  value={block.value}
                  onChange={(nextValue) => updateBlock(index, nextValue)}
                  readOnly={!user}
                />
              )}

              {block.type === 'image' && (
                <>
                  {user && (
                    <input
                      value={block.value}
                      onChange={(e) => updateBlock(index, e.target.value)}
                      placeholder="Colle l'URL de l'image"
                    />
                  )}
                  {block.value ? <img src={block.value} alt="" className="preview-image" /> : <div className="preview-placeholder">Aucune image ajoutée</div>}
                </>
              )}

              {block.type === 'embed' && (
                <>
                  {user && (
                    <input
                      value={block.value}
                      onChange={(e) => updateBlock(index, e.target.value)}
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
