import React, { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const WEB5E_SESSION_KEY = 'web5eBridgeSession';

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
      actions: [
        {
          id: `action_${Date.now()}`,
          name: 'Parler',
          frames: [],
          frameUrlInput: '',
          soundUrl: '',
          spritesOpen: false
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
    actions: [
      {
        id: `action_${Date.now()}`,
        name: 'Parler',
        frames: [],
        frameUrlInput: '',
        soundUrl: String(draft.soundUrl || '').trim(),
        spritesOpen: false
      }
    ]
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

function AnimationBlockEditor({ block, onChange, readOnly }) {
  const actorFileInputRef = useRef(null);
  const actionFileInputRefs = useRef({});
  const recorderRef = useRef(null);
  const recorderChunksRef = useRef([]);
  const actorDragOffsetRef = useRef({ x: 0, y: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingActionId, setRecordingActionId] = useState('');
  const [actorState, setActorState] = useState({
    x: Number(block?.actorX || 120),
    y: Number(block?.actorY || 120),
    frameUrl: String(block?.actorImageUrl || ''),
    actionName: ''
  });

  const actions = Array.isArray(block?.actions) && block.actions.length > 0
    ? block.actions
    : [{ id: `action_${Date.now()}`, name: 'Parler', frames: [], frameUrlInput: '', soundUrl: '', spritesOpen: false }];

  useEffect(() => {
    setActorState({
      x: Number(block?.actorX || 120),
      y: Number(block?.actorY || 120),
      frameUrl: String(block?.actorImageUrl || actions[0]?.frames?.[0] || ''),
      actionName: ''
    });
    setIsPlaying(false);
  }, [block]);

  const updateRoot = (patch) => onChange?.({ ...block, ...patch, actions });
  const updateActions = (nextActions) => onChange?.({ ...block, actions: nextActions });

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
    if (urls.length === 0) return;
    updateActions(actions.map((action) => action.id === actionId ? { ...action, frames: [...(action.frames || []), ...urls] } : action));
  };

  const updateAction = (actionId, patch) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, ...patch } : action));
  };

  const addAction = () => {
    updateActions([
      ...actions,
      { id: `action_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, name: `Action ${actions.length + 1}`, frames: [], frameUrlInput: '', soundUrl: '', spritesOpen: false }
    ]);
  };

  const removeAction = (actionId) => {
    if (actions.length <= 1) return;
    updateActions(actions.filter((action) => action.id !== actionId));
  };

  const addFrameFromUrl = (actionId) => {
    const action = actions.find((item) => item.id === actionId);
    const safeUrl = String(action?.frameUrlInput || '').trim();
    if (!safeUrl) return;
    updateActions(actions.map((item) => item.id === actionId ? { ...item, frames: [...(item.frames || []), safeUrl], frameUrlInput: '' } : item));
  };

  const removeFrame = (actionId, frameIndex) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, frames: (action.frames || []).filter((_, index) => index !== frameIndex) } : action));
  };

  const toggleSpritesOpen = (actionId) => {
    updateActions(actions.map((action) => action.id === actionId ? { ...action, spritesOpen: !action.spritesOpen } : action));
  };

  const startDragActor = (event) => {
    if (readOnly) return;
    const rect = event.currentTarget.getBoundingClientRect();
    actorDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  };

  const dropActor = (event) => {
    if (readOnly) return;
    const shellRect = event.currentTarget.getBoundingClientRect();
    const nextX = Math.max(0, event.clientX - shellRect.left - actorDragOffsetRef.current.x);
    const nextY = Math.max(0, event.clientY - shellRect.top - actorDragOffsetRef.current.y);
    setActorState((prev) => ({ ...prev, x: nextX, y: nextY }));
    updateRoot({ actorX: Math.round(nextX), actorY: Math.round(nextY) });
  };

  const handleActorFile = async (fileList) => {
    const urls = await readFilesAsDataUrls(fileList);
    if (urls[0]) updateRoot({ actorImageUrl: urls[0] });
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
      const frames = Array.isArray(action.frames) && action.frames.length > 0 ? action.frames : [block?.actorImageUrl].filter(Boolean);
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

  const currentActorFrame = actorState.frameUrl || block?.actorImageUrl || actions[0]?.frames?.[0] || '';

  return (
    <div className="animation-block-shell">
      <div className="animation-page-overlay visible" onDragOver={(e) => e.preventDefault()} onDrop={dropActor}>
        <div
          className={`animation-page-actor ${readOnly ? 'readonly' : 'draggable'}`}
          style={{ transform: `translate(${Number(actorState.x || 0)}px, ${Number(actorState.y || 0)}px)` }}
          draggable={!readOnly}
          onDragStart={startDragActor}
        >
          {currentActorFrame ? <img src={currentActorFrame} alt={block?.actorName || 'Personnage'} /> : <div className="animation-actor-placeholder">{(block?.actorName || 'P').slice(0, 1)}</div>}
          <button type="button" className="animation-sprite-play" onClick={playAnimation} disabled={isPlaying}>{isPlaying ? '...' : 'Play'}</button>
          <div className="animation-actor-name">{actorState.actionName || block?.actorName || 'Personnage'}</div>
        </div>
      </div>

      <div className="animation-editor">
          <div className="animation-editor-top">
            <div className="animation-editor-grid">
              <input value={block?.title || ''} onChange={(e) => updateRoot({ title: e.target.value })} placeholder="Titre de l'animation" />
              <input value={block?.actorName || ''} onChange={(e) => updateRoot({ actorName: e.target.value })} placeholder="Nom du personnage" />
            </div>
            {!readOnly && (
              <div className="animation-inline-row" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void handleActorFile(e.dataTransfer.files); }}>
                <input value={block?.actorImageUrl || ''} onChange={(e) => updateRoot({ actorImageUrl: e.target.value })} placeholder="URL du sprite principal" />
                <button type="button" onClick={() => updateRoot({ actorImageUrl: String(block?.actorImageUrl || '').trim() })}>Importer URL</button>
                <button type="button" onClick={() => actorFileInputRef.current?.click()}>Importer depuis l'ordi</button>
                <input ref={actorFileInputRef} type="file" accept="image/*" className="hidden-file-input" onChange={(e) => void handleActorFile(e.target.files)} />
              </div>
            )}
          <div className="animation-stage-actions">
            {!readOnly && <button type="button" className="animation-add-action-btn" onClick={addAction}>+ Nouvelle action</button>}
          </div>
        </div>

        <div className="animation-action-stack">
          {actions.map((action, index) => (
            <div key={action.id} className="animation-action-card compact">
              <div className="animation-action-head">
                <input value={action.name || ''} onChange={(e) => updateAction(action.id, { name: e.target.value })} placeholder={`Action ${index + 1}`} />
                <div className="animation-compact-actions">
                  <button type="button" onClick={() => toggleSpritesOpen(action.id)}>Sprites</button>
                  <button type="button" className={recordingActionId === action.id ? 'recording' : ''} onClick={() => void toggleRecord(action.id)}>REC</button>
                  <button type="button" onClick={() => void playAnimation([action])}>Play</button>
                </div>
                {!readOnly && actions.length > 1 ? <button type="button" onClick={() => removeAction(action.id)}>Supprimer</button> : null}
              </div>
              {action.spritesOpen && !readOnly && (
                <div className="animation-upload-card action" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void appendFrames(action.id, e.dataTransfer.files); }}>
                  <div className="animation-inline-row">
                    <input value={action.frameUrlInput || ''} onChange={(e) => updateAction(action.id, { frameUrlInput: e.target.value })} placeholder="URL d'un sprite à ajouter" />
                    <button type="button" onClick={() => addFrameFromUrl(action.id)}>Importer URL</button>
                    <button type="button" onClick={() => actionFileInputRefs.current[action.id]?.click()}>Importer depuis l'ordi</button>
                  </div>
                  <input value={action.soundUrl || ''} onChange={(e) => updateAction(action.id, { soundUrl: e.target.value })} placeholder="URL du son si besoin" />
                  <input ref={(node) => { actionFileInputRefs.current[action.id] = node; }} type="file" accept="image/*" multiple className="hidden-file-input" onChange={(e) => void appendFrames(action.id, e.target.files)} />
                </div>
              )}
              {action.spritesOpen && <div className="animation-frame-strip">
                {(action.frames || []).map((frame, frameIndex) => (
                  <div key={`${action.id}_${frameIndex}`} className="animation-frame-thumb">
                    <img src={frame} alt="" />
                    {!readOnly ? <button type="button" onClick={() => removeFrame(action.id, frameIndex)}>×</button> : null}
                  </div>
                ))}
                {(!action.frames || action.frames.length === 0) && <div className="animation-frame-empty">Aucun sprite dans cette action</div>}
              </div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const initialBridgedUser = readBridgeUserFromUrl();
  const initialWindowNamedUser = readBridgeUserFromWindowName();
  const initialStoredUser = readStoredWeb5eSession();
  const initialUser = initialBridgedUser || initialWindowNamedUser || initialStoredUser;
  const [bridgeDebug, setBridgeDebug] = useState({
    fromUrl: Boolean(initialBridgedUser?.id),
    fromWindowName: Boolean(initialWindowNamedUser?.id),
    fromStorage: Boolean(initialStoredUser?.id),
    userId: initialUser?.id || ''
  });
  const [allUsersData, setAllUsersData] = useState([]);
  const [inputClass, setInputClass] = useState('');
  const [inputLast, setInputLast] = useState('');
  const [inputFirst, setInputFirst] = useState('');
  const [password, setPassword] = useState('');
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
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [animationDraft, setAnimationDraft] = useState({
    title: '',
    actorName: '',
    actorImageUrl: '',
    soundName: '',
    soundUrl: ''
  });
  const [activeSection, setActiveSection] = useState('eau');
  const [activeTabBySection, setActiveTabBySection] = useState({ eau: 'manquer-eau', energie: 'fossiles' });
  const [contentMap, setContentMap] = useState(DEFAULT_CONTENT);
  const [siteData, setSiteData] = useState(null);
  const [tabDocsByKey, setTabDocsByKey] = useState({});
  const [entryDocsByKey, setEntryDocsByKey] = useState({});

  useEffect(() => {
    fetch('/api/auth/finder-data')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setAllUsersData(Array.isArray(data) ? data : []))
      .catch(() => setAllUsersData([]));
  }, []);

  useEffect(() => {
    const loadWeb5e = async () => {
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
        setContentMap(nextContentMap);
      } catch (_) {}
    };
    loadWeb5e();
  }, []);

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
    const cleanPassword = clean(password);
    if (
      typedLast === 'vuillet' &&
      (typedFirst === 'jp' || typedFirst === 'jean') &&
      (cleanPassword === WEB5E_TEACHER_PASSWORD || cleanPassword === WEB5E_EDITOR_PASSWORD)
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
    if (cleanPassword !== WEB5E_EDITOR_PASSWORD) {
      alert("Mot de passe édition invalide.");
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
    setPassword('');
    setCreatorOpen(false);
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

  const addBlock = (type) => {
    const nextBlocks = [...blocks, createBlock(type)];
    updateBlocks(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const createAnimationFromDrawer = () => {
    const nextBlocks = [...blocks, createAnimationBlockFromDraft(animationDraft)];
    updateBlocks(nextBlocks);
    void persistBlocks(nextBlocks);
    setCreatorOpen(false);
    setAnimationDraft({
      title: '',
      actorName: '',
      actorImageUrl: '',
      soundName: '',
      soundUrl: ''
    });
  };

  const updateBlock = (index, value) => {
    const nextBlocks = blocks.map((block, i) => i === index ? { ...block, value } : block);
    updateBlocks(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const removeBlock = (index) => {
    if (blocks.length <= 1) return;
    const nextBlocks = blocks.filter((_, i) => i !== index);
    updateBlocks(nextBlocks);
    void persistBlocks(nextBlocks);
  };

  const isTeacher = clean(user?.lastName) === 'vuillet' && (clean(user?.firstName) === 'jp' || clean(user?.firstName) === 'jean');
  const currentEntry = entryDocsByKey[`${activeSection}:${currentTabId}`];
  const contributionSignature = formatContributionName(currentEntry?.authorName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim());

  return (
    <div className="web5e-shell">
      {!user && (
        <div className="bridge-debug-banner">
          Session bridge absente. Le site n'a reçu aucun élève depuis CondaWeb.
        </div>
      )}
      {user && bridgeDebug.userId && (
        <div className="bridge-debug-banner success">
          Session reçue pour {user.firstName} {user.lastName} ({user.currentClass || 'sans classe'}).
        </div>
      )}
      <button className="login-toggle" onClick={() => setLoginOpen((prev) => !prev)}>
        {user ? `${user.firstName} ${user.lastName}` : 'Connexion élève'}
      </button>
      {isTeacher && (
        <button className="creator-toggle" onClick={() => setCreatorOpen((prev) => !prev)}>
          Créateur animation
        </button>
      )}

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
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe" />
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

      <aside className={`creator-panel ${creatorOpen ? 'open' : ''}`}>
        <div className="creator-panel-head">
          <div>
            <div className="eyebrow">Sprites & son</div>
            <strong>Créateur d'animation</strong>
          </div>
          <button onClick={() => setCreatorOpen(false)}>×</button>
        </div>
        <div className="creator-panel-body">
          <input
            value={animationDraft.title}
            onChange={(e) => setAnimationDraft((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Titre de l'animation"
          />
          <input
            value={animationDraft.actorName}
            onChange={(e) => setAnimationDraft((prev) => ({ ...prev, actorName: e.target.value }))}
            placeholder="Nom du sprite"
          />
          <input
            value={animationDraft.actorImageUrl}
            onChange={(e) => setAnimationDraft((prev) => ({ ...prev, actorImageUrl: e.target.value }))}
            placeholder="URL de l'image du sprite"
          />
          <input
            value={animationDraft.soundName}
            onChange={(e) => setAnimationDraft((prev) => ({ ...prev, soundName: e.target.value }))}
            placeholder="Nom du son"
          />
          <input
            value={animationDraft.soundUrl}
            onChange={(e) => setAnimationDraft((prev) => ({ ...prev, soundUrl: e.target.value }))}
            placeholder="URL du son"
          />
          <div className="creator-panel-note">
            Ce créateur prépare un bloc animation avec sprite, déplacement, affichage et son.
          </div>
          <button className="primary-btn" type="button" onClick={createAnimationFromDrawer}>
            Créer l'animation
          </button>
        </div>
      </aside>

      <header className="hero">
        <div className="hero-copy">
          <div className="eyebrow">Projet 5e</div>
          <h1>{siteData?.title || 'Projet 5e'}</h1>
          <p>
            {siteData?.subtitle
              ? `${siteData.subtitle}.`
              : "Un site public de classe sur deux grands thèmes: l’eau et l’énergie."
            } Les visiteurs consultent le contenu, et les élèves connectés enrichissent les sous-rubriques.
          </p>
        </div>
        <div className="hero-card">
          <div className="hero-card-title">Organisation</div>
          <ul>
            <li>2 sections principales définies par le professeur</li>
            <li>Des sous-onglets édités ensuite par les élèves</li>
            <li>Texte, images et iframe intégrables dans chaque rubrique</li>
          </ul>
        </div>
      </header>

      <nav className="section-tabs">
        {Object.entries(SECTION_CONFIG).map(([sectionId, section]) => (
          <button
            key={sectionId}
            className={`section-tab ${activeSection === sectionId ? `active ${section.accent}` : ''}`}
            onClick={() => setActiveSection(sectionId)}
          >
            {section.title}
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
              {isTeacher && <button onClick={() => addBlock('animation')}>Animation</button>}
            </div>
          )}
        </div>

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

        <div className="blocks-area public">
          {blocks.map((block, index) => (
            <article key={`${activeSection}-${currentTabId}-${index}`} className="block-card">
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

              {block.type === 'animation' && (
                <AnimationBlockEditor
                  block={block}
                  onChange={(nextBlock) => {
                    const nextBlocks = blocks.map((row, rowIndex) => rowIndex === index ? nextBlock : row);
                    updateBlocks(nextBlocks);
                    void persistBlocks(nextBlocks);
                  }}
                  readOnly={!isTeacher}
                />
              )}

              <div className="block-signature">
                Apport de {formatContributionName(currentEntry?.authorName || contributionSignature || '') || 'élève'}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
