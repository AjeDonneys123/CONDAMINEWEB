import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

const DEFAULT_TABS = [
  {
    id: 'accueil',
    title: 'Accueil',
    blocks: [
      { type: 'text', value: 'Bienvenue dans ton espace de publication. Tu pourras ici ajouter des articles, des images, des liens de jeux et des embeds de sites.' }
    ]
  },
  {
    id: 'journal',
    title: 'Journal',
    blocks: [
      { type: 'text', value: 'Raconte un événement, une sortie, une leçon ou un travail de classe.' }
    ]
  }
];

const clean = (str) => (str || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

function newTab(title = 'Nouvel onglet') {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    blocks: [
      { type: 'text', value: '' }
    ]
  };
}

function createEmptyBlock(type = 'text') {
  return { type, value: '' };
}

export default function App() {
  const [allUsersData, setAllUsersData] = useState([]);
  const [inputClass, setInputClass] = useState('');
  const [inputLast, setInputLast] = useState('');
  const [inputFirst, setInputFirst] = useState('');
  const [password, setPassword] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [user, setUser] = useState(null);
  const [tabs, setTabs] = useState(DEFAULT_TABS);
  const [activeTabId, setActiveTabId] = useState(DEFAULT_TABS[0].id);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/finder-data')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => setAllUsersData(Array.isArray(data) ? data : []))
      .catch(() => setAllUsersData([]));
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const key = `web5e-tabs:${user.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setTabs(parsed);
        setActiveTabId(parsed[0].id);
      }
    } catch (_) {}
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    localStorage.setItem(`web5e-tabs:${user.id}`, JSON.stringify(tabs));
  }, [tabs, user?.id]);

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
      .slice(0, 8);
  }, [allUsersData, inputClass, inputLast, inputFirst]);

  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];

  const resolveProfile = () => {
    if (selectedProfile) return selectedProfile;
    const typedClass = clean(inputClass);
    const typedLast = clean(inputLast);
    const typedFirst = clean(inputFirst);
    return allUsersData.find((p) =>
      p.type === 'student' &&
      clean(p.lastName) === typedLast &&
      clean(p.firstName) === typedFirst &&
      (!typedClass || clean(p.className) === typedClass)
    ) || null;
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    const profile = resolveProfile();
    if (!profile) {
      alert('Profil élève introuvable.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/eleve/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: profile.id, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Connexion impossible.');
      setSelectedProfile(profile);
      setUser(data.user);
    } catch (e) {
      alert(e.message || 'Connexion impossible.');
    }
    setLoading(false);
  };

  const updateTabTitle = (tabId, title) => {
    setTabs((prev) => prev.map((tab) => tab.id === tabId ? { ...tab, title } : tab));
  };

  const addTab = () => {
    const tab = newTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
  };

  const removeTab = (tabId) => {
    setTabs((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((tab) => tab.id !== tabId);
      if (activeTabId === tabId) setActiveTabId(next[0].id);
      return next;
    });
  };

  const addBlock = (type) => {
    setTabs((prev) => prev.map((tab) => (
      tab.id === activeTab.id
        ? { ...tab, blocks: [...tab.blocks, createEmptyBlock(type)] }
        : tab
    )));
  };

  const updateBlock = (index, value) => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== activeTab.id) return tab;
      return {
        ...tab,
        blocks: tab.blocks.map((block, blockIndex) => blockIndex === index ? { ...block, value } : block)
      };
    }));
  };

  const removeBlock = (index) => {
    setTabs((prev) => prev.map((tab) => {
      if (tab.id !== activeTab.id) return tab;
      if (tab.blocks.length <= 1) return tab;
      return {
        ...tab,
        blocks: tab.blocks.filter((_, blockIndex) => blockIndex !== index)
      };
    }));
  };

  if (!user) {
    return (
      <div className="web5e-shell">
        <div className="web5e-login-card">
          <div className="eyebrow">Nouveau site élève</div>
          <h1>CondaWeb Pages</h1>
          <p>Connexion sur la BDD actuelle, puis création d’onglets libres pour construire le site de classe.</p>
          <form className="web5e-login-form" onSubmit={handleLogin}>
            <input value={inputClass} onChange={(e) => setInputClass(e.target.value)} placeholder="Classe" />
            <div className="name-row">
              <input value={inputLast} onChange={(e) => { setInputLast(e.target.value); setSelectedProfile(null); }} placeholder="Nom" />
              <input value={inputFirst} onChange={(e) => { setInputFirst(e.target.value); setSelectedProfile(null); }} placeholder="Prénom" />
            </div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mot de passe élève" />
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
            <button type="submit" disabled={loading}>{loading ? 'Connexion...' : 'Entrer'}</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="web5e-shell">
      <div className="web5e-app">
        <aside className="web5e-sidebar">
          <div className="brand">CONDAWEB PAGES</div>
          <div className="profile-card">
            <div className="profile-name">{user.firstName} {user.lastName}</div>
            <div className="profile-meta">{user.currentClass || selectedProfile?.className || ''}</div>
          </div>
          <button className="primary-btn" onClick={addTab}>+ Ajouter un onglet</button>
          <div className="tabs-list">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`tab-chip ${tab.id === activeTab.id ? 'active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
              >
                <span>{tab.title}</span>
                {tabs.length > 1 && (
                  <span
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeTab(tab.id);
                    }}
                  >
                    ×
                  </span>
                )}
              </button>
            ))}
          </div>
        </aside>

        <main className="web5e-main">
          <header className="page-header">
            <input
              className="tab-title-input"
              value={activeTab?.title || ''}
              onChange={(e) => updateTabTitle(activeTab.id, e.target.value)}
            />
            <div className="toolbar">
              <button onClick={() => addBlock('text')}>Article</button>
              <button onClick={() => addBlock('image')}>Image</button>
              <button onClick={() => addBlock('embed')}>Site / Jeu</button>
            </div>
          </header>

          <section className="blocks-area">
            {activeTab?.blocks.map((block, index) => (
              <article key={`${activeTab.id}-${index}`} className="block-card">
                <div className="block-head">
                  <span>{block.type === 'text' ? 'Article' : block.type === 'image' ? 'Image' : 'Embed / Jeu'}</span>
                  <button onClick={() => removeBlock(index)}>Supprimer</button>
                </div>
                {block.type === 'text' && (
                  <textarea
                    value={block.value}
                    onChange={(e) => updateBlock(index, e.target.value)}
                    placeholder="Écris ton article, ton résumé ou ton texte."
                  />
                )}
                {block.type === 'image' && (
                  <>
                    <input
                      value={block.value}
                      onChange={(e) => updateBlock(index, e.target.value)}
                      placeholder="Colle l'URL de l'image"
                    />
                    {block.value ? <img src={block.value} alt="" className="preview-image" /> : <div className="preview-placeholder">Aperçu image</div>}
                  </>
                )}
                {block.type === 'embed' && (
                  <>
                    <input
                      value={block.value}
                      onChange={(e) => updateBlock(index, e.target.value)}
                      placeholder="Colle l'URL d'un site, jeu ou Google Sites"
                    />
                    {block.value ? (
                      <div className="embed-frame-shell">
                        <iframe
                          src={block.value}
                          title={`embed-${activeTab.id}-${index}`}
                          className="embed-frame"
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          allow="fullscreen"
                        />
                      </div>
                    ) : (
                      <div className="preview-placeholder">Colle un lien iframe pour l’afficher ici</div>
                    )}
                  </>
                )}
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}
