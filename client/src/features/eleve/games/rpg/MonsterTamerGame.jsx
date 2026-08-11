import React, { useRef, useState } from 'react';
import './MonsterTamerGame.css';

export default function MonsterTamerGame({ onExit }) {
  const frameRef = useRef(null);
  const [started, setStarted] = useState(false);

  const focusGame = () => {
    setStarted(true);
    window.setTimeout(() => frameRef.current?.focus(), 30);
  };

  return (
    <div className="monster-tamer-shell">
      <header className="monster-tamer-header">
        <div>
          <div className="monster-tamer-kicker">Prototype importé · Monster Tamer</div>
          <h1>Le monde des créatures</h1>
        </div>
        <div className="monster-tamer-actions">
          <button type="button" onClick={focusGame}>Reprendre le jeu</button>
          <button type="button" className="is-exit" onClick={onExit}>✕ Quitter</button>
        </div>
      </header>

      <div className="monster-tamer-help">
        <span><b>Flèches</b> : se déplacer et choisir</span>
        <span><b>Espace</b> : interagir et valider</span>
        <span><b>Maj</b> : revenir en arrière</span>
      </div>

      <main className="monster-tamer-stage" onClick={focusGame}>
        <iframe
          ref={frameRef}
          title="Monster Tamer"
          src="/games/monster-tamer/index.html"
          allow="autoplay; fullscreen"
          tabIndex="0"
        />
        {!started && (
          <button type="button" className="monster-tamer-start" onClick={focusGame}>
            <span>🔴</span>
            Cliquez pour jouer
            <small>Le clavier contrôlera ensuite le personnage.</small>
          </button>
        )}
      </main>

      <footer className="monster-tamer-credit">
        « Monster Tamer » par Dev Share Academy — code MIT, ressources créditées par leurs auteurs.
      </footer>
    </div>
  );
}
