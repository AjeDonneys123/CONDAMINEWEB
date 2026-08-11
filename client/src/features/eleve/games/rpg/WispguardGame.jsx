import React, { useEffect, useRef, useState } from 'react';
import './WispguardGame.css';
import { gameUrl } from './gameHosting';

const createQuestion = () => {
  const left = 2 + Math.floor(Math.random() * 10);
  const right = 2 + Math.floor(Math.random() * 10);
  return { left, right, expected: left * right };
};

const MAGE_POSE_LABELS = [
  'Bas · préparation', 'Bas · énergie', 'Bas · tir',
  'Haut · préparation', 'Haut · énergie', 'Haut · tir',
  'Droite · préparation', 'Droite · énergie', 'Droite · tir',
  'Gauche · préparation', 'Gauche · énergie', 'Gauche · tir',
];

export default function WispguardGame({ onExit }) {
  const frameRef = useRef(null);
  const spriteInputRef = useRef(null);
  const spriteSheetInputRef = useRef(null);
  const spriteImportPendingRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [placingSprite, setPlacingSprite] = useState(false);
  const [spriteNotice, setSpriteNotice] = useState('');
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [questionState, setQuestionState] = useState('answer');
  const [sheetCalibration, setSheetCalibration] = useState(null);
  const [draftSelection, setDraftSelection] = useState(null);

  useEffect(() => {
    const handleGameMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow || event.data?.source !== 'condamine-game') return;
      if (event.data.type === 'request-bonus-question') openBonusQuestion();
      if (event.data.type === 'sprite-ready') {
        spriteImportPendingRef.current = false;
        setSpriteNotice('Les poses sont prêtes : clique dans le donjon pour placer le mage, puis utilise « Devenir le mage ».');
      }
      if (event.data.type === 'sprite-placed') {
        spriteImportPendingRef.current = false;
        setPlacingSprite(false);
        setSpriteNotice('Sprite placé : son corps physique bloque maintenant le passage.');
        window.setTimeout(() => setSpriteNotice(''), 3500);
      }
      if (event.data.type === 'sprite-error') {
        spriteImportPendingRef.current = false;
        setPlacingSprite(false);
        setSpriteNotice('Une pose de la fiche n’a pas pu être chargée. Réimporte l’image après avoir rechargé le jeu.');
      }
    };
    window.condamineOpenBonusQuestion = openBonusQuestion;
    window.addEventListener('message', handleGameMessage);
    return () => {
      delete window.condamineOpenBonusQuestion;
      window.removeEventListener('message', handleGameMessage);
    };
  });

  // L'iframe peut perdre le focus quand l'élève utilise les commandes situées
  // autour du jeu. La barre d'espace doit néanmoins toujours ouvrir l'aide.
  useEffect(() => {
    const handleSpace = (event) => {
      if (event.code !== 'Space' || event.repeat || question) return;
      const tag = String(event.target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      event.preventDefault();
      openBonusQuestion();
    };
    window.addEventListener('keydown', handleSpace);
    return () => window.removeEventListener('keydown', handleSpace);
  }, [question]);

  const focusGame = () => {
    setStarted(true);
    window.setTimeout(() => frameRef.current?.focus(), 30);
  };

  const sendToGame = (type, payload = {}) => {
    frameRef.current?.contentWindow?.postMessage({ source: 'condamine', type, ...payload }, '*');
  };

  const openBonusQuestion = () => {
    setQuestion(createQuestion());
    setAnswer('');
    setQuestionState('answer');
    sendToGame('quiz-open');
  };

  const closeBonusQuestion = () => {
    setQuestion(null);
    setAnswer('');
    sendToGame('quiz-close');
    focusGame();
  };

  const checkAnswer = (event) => {
    event.preventDefault();
    if (Number(answer) === question?.expected) {
      setQuestionState('choose');
      return;
    }
    setQuestionState('wrong');
  };

  const grantBonus = (bonus) => {
    sendToGame('grant-bonus', { bonus });
    closeBonusQuestion();
  };

  const importBlockingSprite = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const image = new Image();
    const reader = new FileReader();
    reader.onload = () => { image.src = String(reader.result || ''); };
    image.onload = () => {
      const maxSize = 128;
      const ratio = Math.min(1, maxSize / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext('2d');
      context.imageSmoothingEnabled = false;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      frameRef.current?.contentWindow?.postMessage({ source: 'condamine', type: 'place-blocking-sprite', dataUrl }, '*');
      setPlacingSprite(true);
      setSpriteNotice('Préparation du sprite…');
      focusGame();
    };
    reader.readAsDataURL(file);
  };

  const importAnimatedSpriteSheet = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSheetCalibration({ src: String(reader.result || ''), selections: [] });
      setDraftSelection(null);
    };
    reader.readAsDataURL(file);
  };

  const selectionCoordinates = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const beginMageSelection = (event) => {
    if (!sheetCalibration || sheetCalibration.selections.length >= MAGE_POSE_LABELS.length) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = selectionCoordinates(event);
    setDraftSelection({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
  };

  const moveMageSelection = (event) => {
    if (!draftSelection) return;
    const point = selectionCoordinates(event);
    setDraftSelection((current) => ({ ...current, endX: point.x, endY: point.y }));
  };

  const finishMageSelection = (event) => {
    if (!draftSelection || !sheetCalibration) return;
    const point = selectionCoordinates(event);
    const rectangle = {
      x: Math.min(draftSelection.startX, point.x),
      y: Math.min(draftSelection.startY, point.y),
      width: Math.abs(point.x - draftSelection.startX),
      height: Math.abs(point.y - draftSelection.startY),
    };
    setDraftSelection(null);
    if (rectangle.width < 0.01 || rectangle.height < 0.01) return;
    setSheetCalibration((current) => ({
      ...current,
      selections: [...current.selections, rectangle],
    }));
  };

  const normalizedDraftSelection = draftSelection && {
    x: Math.min(draftSelection.startX, draftSelection.endX),
    y: Math.min(draftSelection.startY, draftSelection.endY),
    width: Math.abs(draftSelection.endX - draftSelection.startX),
    height: Math.abs(draftSelection.endY - draftSelection.startY),
  };

  const validateMageSelections = () => {
    if (!sheetCalibration || sheetCalibration.selections.length !== MAGE_POSE_LABELS.length) return;
    const image = new Image();
    image.onload = () => {
      const frames = sheetCalibration.selections.map((selection) => {
        const sourceX = Math.round(selection.x * image.naturalWidth);
        const sourceY = Math.round(selection.y * image.naturalHeight);
        const sourceWidth = Math.max(1, Math.round(selection.width * image.naturalWidth));
        const sourceHeight = Math.max(1, Math.round(selection.height * image.naturalHeight));
        const work = document.createElement('canvas');
        work.width = sourceWidth;
        work.height = sourceHeight;
        const workContext = work.getContext('2d', { willReadFrequently: true });
        workContext.imageSmoothingEnabled = false;
        workContext.drawImage(
          image,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          0,
          0,
          work.width,
          work.height,
        );
        const pixels = workContext.getImageData(0, 0, work.width, work.height);
        let minX = work.width;
        let minY = work.height;
        let maxX = 0;
        let maxY = 0;
        for (let pixel = 0; pixel < pixels.data.length; pixel += 4) {
          const red = pixels.data[pixel];
          const green = pixels.data[pixel + 1];
          const blue = pixels.data[pixel + 2];
          const nearWhite = red > 232 && green > 232 && blue > 232;
          const chromaRed = red > 175 && red > green * 1.7 && red > blue * 1.7;
          if (nearWhite || chromaRed) {
            pixels.data[pixel + 3] = 0;
            continue;
          }
          const point = pixel / 4;
          const x = point % work.width;
          const y = Math.floor(point / work.width);
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        workContext.putImageData(pixels, 0, 0);
        const output = document.createElement('canvas');
        output.width = 96;
        output.height = 96;
        const outputContext = output.getContext('2d');
        outputContext.imageSmoothingEnabled = false;
        const detectedWidth = Math.max(1, maxX - minX + 1);
        const detectedHeight = Math.max(1, maxY - minY + 1);
        const scale = Math.min(84 / detectedWidth, 84 / detectedHeight);
        const drawWidth = Math.max(1, Math.round(detectedWidth * scale));
        const drawHeight = Math.max(1, Math.round(detectedHeight * scale));
        outputContext.drawImage(
          work,
          minX,
          minY,
          detectedWidth,
          detectedHeight,
          Math.round((96 - drawWidth) / 2),
          96 - drawHeight - 4,
          drawWidth,
          drawHeight,
        );
        return output.toDataURL('image/png');
      });

      frameRef.current?.contentWindow?.postMessage({ source: 'condamine', type: 'place-animated-sprite', frames }, '*');
      setPlacingSprite(true);
      spriteImportPendingRef.current = true;
      setSpriteNotice('Chargement des 12 poses sélectionnées…');
      setSheetCalibration(null);
      window.setTimeout(() => {
        if (!spriteImportPendingRef.current) return;
        spriteImportPendingRef.current = false;
        setPlacingSprite(false);
        setSpriteNotice('Le chargement a échoué. Recharge le jeu puis importe de nouveau la fiche animée.');
      }, 8000);
      focusGame();
    };
    image.src = sheetCalibration.src;
  };

  return (
    <div className="wispguard-shell">
      <header className="wispguard-header">
        <div>
          <div className="wispguard-kicker">Aventure éducative · version test</div>
          <h1>La légende du Gardien</h1>
        </div>
        <div className="wispguard-actions">
          <input
            ref={spriteInputRef}
            className="wispguard-sprite-input"
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={importBlockingSprite}
          />
          <input
            ref={spriteSheetInputRef}
            className="wispguard-sprite-input"
            type="file"
            accept="image/png,image/webp,image/jpeg"
            onChange={importAnimatedSpriteSheet}
          />
          <button
            type="button"
            className="wispguard-sprite-button"
            onClick={() => spriteInputRef.current?.click()}
          >{placingSprite ? '📍 Clique pour placer' : '🧱 Importer un sprite'}</button>
          <button
            type="button"
            className="wispguard-sheet-button"
            onClick={() => spriteSheetInputRef.current?.click()}
          >🧙 Importer une fiche animée</button>
          <button
            type="button"
            className="wispguard-mage-button"
            onClick={() => {
              sendToGame('grant-bonus', { bonus: 'mage-form' });
              focusGame();
            }}
          >🧙 Devenir le mage</button>
          <button
            type="button"
            className="wispguard-bonus-button"
            onClick={() => {
              sendToGame('grant-bonus', { bonus: 'invincible' });
              focusGame();
            }}
          >🛡️ Mode invincible</button>
          <button type="button" className="wispguard-resume-button" onClick={focusGame}>Reprendre le jeu</button>
          <button type="button" className="wispguard-exit" onClick={onExit}>✕ Quitter</button>
        </div>
      </header>

      <div className="wispguard-help">
        <span><b>Flèches</b> : se déplacer</span>
        <span><b>Z</b> : attaquer à l’épée</span>
        <span><b>X</b> : soulever / lancer</span>
        <span><b>Espace</b> : demander un bonus / tirer</span>
        <span><b>Entrée</b> : choisir dans un menu</span>
      </div>

      <main className="wispguard-stage" onClick={focusGame}>
        {spriteNotice && <div className="wispguard-sprite-notice">{spriteNotice}</div>}
        <iframe
          ref={frameRef}
          title="La légende du Gardien"
          src={gameUrl('wispguard/?v=bridge-2')}
          allow="autoplay; fullscreen"
          tabIndex="0"
        />
        {!started && (
          <button type="button" className="wispguard-start" onClick={focusGame}>
            <span>⚔️</span>
            Cliquez pour jouer
            <small>Le clavier contrôlera ensuite le héros.</small>
          </button>
        )}
      </main>

      <footer className="wispguard-credit">
        Base libre MIT « Legend of the Wispguard » — intégration de test avant ajout des pouvoirs pédagogiques.
      </footer>

      {sheetCalibration && (
        <div className="wispguard-calibration-backdrop">
          <section className="wispguard-calibration" aria-modal="true" role="dialog">
            <header>
              <div>
                <div className="wispguard-calibration-kicker">Calibrage manuel de la fiche</div>
                <h2>Entoure chaque pose du mage</h2>
                <p>Trace un rectangle serré autour du personnage et de son projectile. Respecte l’ordre indiqué.</p>
              </div>
              <button
                type="button"
                className="wispguard-calibration-close"
                onClick={() => {
                  setSheetCalibration(null);
                  setDraftSelection(null);
                }}
                aria-label="Fermer le calibrage"
              >✕</button>
            </header>

            <div className="wispguard-calibration-body">
              <div className="wispguard-calibration-canvas">
                <div className="wispguard-calibration-image-frame">
                  <img src={sheetCalibration.src} alt="Fiche de sprites à calibrer" draggable="false" />
                  <div
                    className="wispguard-selection-layer"
                    onPointerDown={beginMageSelection}
                    onPointerMove={moveMageSelection}
                    onPointerUp={finishMageSelection}
                    onPointerCancel={() => setDraftSelection(null)}
                  >
                    {sheetCalibration.selections.map((selection, index) => (
                      <div
                        key={`${selection.x}-${selection.y}-${index}`}
                        className="wispguard-selection-box is-complete"
                        style={{
                          left: `${selection.x * 100}%`,
                          top: `${selection.y * 100}%`,
                          width: `${selection.width * 100}%`,
                          height: `${selection.height * 100}%`,
                        }}
                      ><span>{index + 1}</span></div>
                    ))}
                    {normalizedDraftSelection && (
                      <div
                        className="wispguard-selection-box is-draft"
                        style={{
                          left: `${normalizedDraftSelection.x * 100}%`,
                          top: `${normalizedDraftSelection.y * 100}%`,
                          width: `${normalizedDraftSelection.width * 100}%`,
                          height: `${normalizedDraftSelection.height * 100}%`,
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <aside className="wispguard-calibration-sidebar">
                <div className="wispguard-calibration-progress">
                  <strong>{sheetCalibration.selections.length} / {MAGE_POSE_LABELS.length}</strong>
                  <span>poses sélectionnées</span>
                </div>
                {sheetCalibration.selections.length < MAGE_POSE_LABELS.length ? (
                  <div className="wispguard-next-pose">
                    <small>Rectangle à tracer maintenant</small>
                    <b>{sheetCalibration.selections.length + 1}. {MAGE_POSE_LABELS[sheetCalibration.selections.length]}</b>
                  </div>
                ) : (
                  <div className="wispguard-next-pose is-ready">✓ Les 12 poses sont prêtes</div>
                )}
                <ol className="wispguard-pose-list">
                  {MAGE_POSE_LABELS.map((label, index) => (
                    <li key={label} className={index < sheetCalibration.selections.length ? 'is-done' : ''}>
                      <span>{index + 1}</span>{label}
                    </li>
                  ))}
                </ol>
                <div className="wispguard-calibration-buttons">
                  <button
                    type="button"
                    disabled={!sheetCalibration.selections.length}
                    onClick={() => setSheetCalibration((current) => ({
                      ...current,
                      selections: current.selections.slice(0, -1),
                    }))}
                  >↶ Annuler la dernière</button>
                  <button
                    type="button"
                    disabled={!sheetCalibration.selections.length}
                    onClick={() => setSheetCalibration((current) => ({ ...current, selections: [] }))}
                  >Tout recommencer</button>
                  <button
                    type="button"
                    className="wispguard-calibration-validate"
                    disabled={sheetCalibration.selections.length !== MAGE_POSE_LABELS.length}
                    onClick={validateMageSelections}
                  >✓ Utiliser ces 12 poses</button>
                </div>
              </aside>
            </div>
          </section>
        </div>
      )}

      {question && (
        <div className="wispguard-quiz-backdrop">
          <section className="wispguard-quiz" aria-modal="true" role="dialog">
            <button type="button" className="wispguard-quiz-close" onClick={closeBonusQuestion}>✕</button>
            {questionState === 'answer' && (
              <form onSubmit={checkAnswer}>
                <div className="wispguard-quiz-icon">🧙‍♂️</div>
                <div className="wispguard-quiz-kicker">Le sage peut t’aider</div>
                <h2>{question.left} × {question.right} = ?</h2>
                <input
                  autoFocus
                  inputMode="numeric"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value.replace(/[^0-9-]/g, ''))}
                  aria-label="Ta réponse"
                />
                <button type="submit" disabled={!answer}>Valider</button>
              </form>
            )}
            {questionState === 'wrong' && (
              <div className="wispguard-quiz-result">
                <div className="wispguard-quiz-icon">🕸️</div>
                <h2>Pas de bonus cette fois</h2>
                <p>La réponse était {question.expected}. Tu pourras redemander de l’aide.</p>
                <button type="button" onClick={closeBonusQuestion}>Retour au donjon</button>
              </div>
            )}
            {questionState === 'choose' && (
              <div className="wispguard-quiz-result">
                <div className="wispguard-quiz-icon">🎉</div>
                <h2>Bonne réponse !</h2>
                <p>Choisis le pouvoir dont tu as besoin maintenant.</p>
                <div className="wispguard-bonus-choices">
                  <button type="button" onClick={() => grantBonus('hearts')}>❤️ Soins complets<small>Récupère tous tes cœurs</small></button>
                  <button type="button" onClick={() => grantBonus('shield')}>🛡️ Bouclier<small>Invincible pendant 15 secondes</small></button>
                  <button type="button" className="wispguard-mage-form" onClick={() => grantBonus('mage-form')}>🧙 Forme de mage<small>Utilise la dernière fiche animée importée</small></button>
                  <button type="button" className="wispguard-super-weapon" onClick={() => grantBonus('super-weapon')}>💥 Mitrailleuse lance-grenades<small>ESPACE : rafales explosives pendant 20 secondes</small></button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
