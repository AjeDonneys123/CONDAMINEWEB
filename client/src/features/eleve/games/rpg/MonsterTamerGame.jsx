import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './MonsterTamerGame.css';
import { gameUrl } from './gameHosting';
import GameLearningGuide from './GameLearningGuide';
import ProtectedGameSurface from '../ProtectedGameSurface';

export default function MonsterTamerGame({ onExit, learningContext = { lessons: [] } }) {
  const frameRef = useRef(null);
  const touchRepeatRef = useRef(null);
  const [started, setStarted] = useState(false);
  const [activeChapterId, setActiveChapterId] = useState('');
  const [quizQuestion, setQuizQuestion] = useState(null);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [isAnswerCorrect, setIsAnswerCorrect] = useState(null);

  const lessons = useMemo(() => {
    return Array.isArray(learningContext?.lessons) ? learningContext.lessons : [];
  }, [learningContext]);

  const chapters = useMemo(() => {
    if (Array.isArray(learningContext?.chapters)) return learningContext.chapters;
    return lessons.map((lesson) => ({
      id: lesson.chapterId || lesson.id,
      title: lesson.chapterTitle || lesson.title,
      lessons: [lesson]
    }));
  }, [learningContext, lessons]);

  // Set default active chapter.
  useEffect(() => {
    if (chapters.length > 0 && !chapters.some((chapter) => chapter.id === activeChapterId)) {
      setActiveChapterId(chapters[0].id);
    }
  }, [chapters, activeChapterId]);

  // Build the learning context to send.
  // The selected lesson is put at index 0 so the Phaser game easily finds it as the primary lesson.
  const activeContext = useMemo(() => {
    if (!activeChapterId || !chapters.length) return learningContext;
    const selectedChapter = chapters.find((chapter) => chapter.id === activeChapterId);
    if (!selectedChapter) return learningContext;
    const selectedLessons = Array.isArray(selectedChapter.lessons) ? selectedChapter.lessons : [];
    return {
      ...learningContext,
      activeChapterId,
      activeChapterTitle: selectedChapter.title,
      lessons: selectedLessons,
    };
  }, [learningContext, lessons, chapters, activeChapterId]);

  const sendLearningContext = useCallback(() => {
    frameRef.current?.contentWindow?.postMessage({
      source: 'condamine',
      type: 'game-context',
      context: activeContext
    }, '*');
  }, [activeContext]);

  // Handle messages from the iframe game
  useEffect(() => {
    const onMessage = (event) => {
      if (event.source !== frameRef.current?.contentWindow) return;
      
      if (event.data?.source === 'condamine-game') {
        if (event.data.type === 'game-ready') {
          sendLearningContext();
        } else if (event.data.type === 'request-qcm') {
          const requestedLessonId = String(event.data?.lessonId || '');
          const currentLesson = activeContext.lessons?.find((lesson) => lesson.id === requestedLessonId)
            || activeContext.lessons?.[0];
          if (currentLesson && currentLesson.quiz && currentLesson.quiz.length > 0) {
            const randomQ = currentLesson.quiz[Math.floor(Math.random() * currentLesson.quiz.length)];
            setQuizQuestion({
              ...randomQ,
              lessonTitle: currentLesson.title,
            });
          } else {
            // No quiz available for this lesson, bypass the gating
            frameRef.current?.contentWindow?.postMessage({
              source: 'condamine',
              type: 'qcm-result',
              success: true
            }, '*');
          }
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [sendLearningContext, activeContext]);

  // Send context updates immediately in real-time when the active lesson changes
  useEffect(() => {
    if (started) {
      sendLearningContext();
    }
  }, [activeContext, started, sendLearningContext]);

  const focusGame = () => {
    setStarted(true);
    window.setTimeout(() => {
      frameRef.current?.focus();
      frameRef.current?.contentWindow?.postMessage({
        source: 'condamine',
        type: 'simulate-key',
        code: 'Space',
        key: ' '
      }, '*');
    }, 80);
  };

  const sendGameKey = useCallback((code, key) => {
    frameRef.current?.focus({ preventScroll: true });
    frameRef.current?.contentWindow?.postMessage({
      source: 'condamine', type: 'mobile-activate'
    }, '*');
    frameRef.current?.contentWindow?.postMessage({
      source: 'condamine', type: 'simulate-key', code, key
    }, '*');
    setStarted(true);
  }, []);

  const stopTouchKey = useCallback((event) => {
    event?.preventDefault();
    if (touchRepeatRef.current) window.clearInterval(touchRepeatRef.current);
    touchRepeatRef.current = null;
    frameRef.current?.contentWindow?.postMessage({ source: 'condamine', type: 'mobile-activate' }, '*');
    frameRef.current?.focus({ preventScroll: true });
  }, []);

  const startTouchKey = (event, code, key, repeat = false) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    stopTouchKey();
    sendGameKey(code, key);
    if (repeat) {
      touchRepeatRef.current = window.setInterval(() => sendGameKey(code, key), 125);
    }
  };

  useEffect(() => () => stopTouchKey(), [stopTouchKey]);

  // Keyboard controls key forwarding
  useEffect(() => {
    const forwardKey = (event) => {
      // Do not forward keyboard keys to the game when QCM overlay is active
      if (quizQuestion) return;
      if (!started || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter', 'ShiftLeft', 'ShiftRight'].includes(event.code)) return;
      event.preventDefault();
      frameRef.current?.contentWindow?.postMessage({
        source: 'condamine', type: 'simulate-key', code: event.code, key: event.key
      }, '*');
    };
    window.addEventListener('keydown', forwardKey);
    return () => window.removeEventListener('keydown', forwardKey);
  }, [started, quizQuestion]);

  const handleChapterChange = (chapterId) => {
    setActiveChapterId(chapterId);
  };

  const handleQuizAnswer = (index) => {
    setSelectedAnswerIndex(index);
    const correct = index === quizQuestion.correctIndex;
    setIsAnswerCorrect(correct);

    if (correct) {
      window.setTimeout(() => {
        setQuizQuestion(null);
        setSelectedAnswerIndex(null);
        setIsAnswerCorrect(null);
        frameRef.current?.contentWindow?.postMessage({
          source: 'condamine',
          type: 'qcm-result',
          success: true
        }, '*');
      }, 1200);
    } else {
      window.setTimeout(() => {
        setQuizQuestion(null);
        setSelectedAnswerIndex(null);
        setIsAnswerCorrect(null);
        frameRef.current?.contentWindow?.postMessage({
          source: 'condamine',
          type: 'qcm-result',
          success: false
        }, '*');
      }, 1200);
    }
  };

  return (
    <ProtectedGameSurface><div className="monster-tamer-shell">
      <header className="monster-tamer-header">
        <div>
          <div className="monster-tamer-kicker">Prototype importé · Monster Tamer</div>
          <h1>Le monde des créatures</h1>
        </div>

        {chapters.length > 0 && (
          <div className="monster-tamer-revision-select">
            <label htmlFor="active-chapter-select">Chapitre actif :</label>
            <select
              id="active-chapter-select"
              value={activeChapterId}
              onChange={(e) => handleChapterChange(e.target.value)}
            >
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="monster-tamer-actions">
          <button type="button" onClick={() => frameRef.current?.contentWindow?.postMessage({ source: 'condamine', type: 'save-game' }, '*')}>💾 Sauvegarder</button>
          <button type="button" onClick={focusGame}>Reprendre le jeu</button>
          <button type="button" className="is-exit" onClick={onExit}>✕ Quitter</button>
        </div>
      </header>

      <div className="monster-tamer-help">
        <span><b>Flèches</b> : se déplacer et choisir</span>
        <span><b>Espace</b> : interagir et valider</span>
        <span><b>Maj</b> : revenir en arrière</span>
      </div>

      <main className="monster-tamer-stage" onClick={focusGame} onContextMenu={(event) => event.preventDefault()}>
        <iframe
          ref={frameRef}
          title="Monster Tamer"
          src={gameUrl('monster-tamer/?v=bridge-2')}
          allow="autoplay; fullscreen"
          tabIndex="0"
          onLoad={sendLearningContext}
        />
        <GameLearningGuide frameRef={frameRef} learningContext={activeContext} />
        {!started && (
          <button type="button" className="monster-tamer-start" onClick={focusGame}>
            <span>🔴</span>
            Cliquez pour jouer
            <small>Le clavier contrôlera ensuite le personnage.</small>
          </button>
        )}

        {quizQuestion && (
          <div className="monster-tamer-quiz-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="monster-tamer-quiz-card">
              <span className="quiz-card-kicker">RÉVISION DE LEÇON</span>
              <h2>{quizQuestion.lessonTitle}</h2>
              <p className="quiz-question-prompt">{quizQuestion.question}</p>
              
              <div className="quiz-options-grid">
                {quizQuestion.choices.map((choice, index) => {
                  let btnClass = "";
                  if (selectedAnswerIndex === index) {
                    btnClass = isAnswerCorrect ? "is-correct" : "is-incorrect";
                  }
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleQuizAnswer(index)}
                      className={`quiz-option-btn ${btnClass}`}
                      disabled={selectedAnswerIndex !== null}
                    >
                      <span className="quiz-option-bullet">{String.fromCharCode(65 + index)}</span>
                      <span className="quiz-option-text">{choice}</span>
                    </button>
                  );
                })}
              </div>

              {selectedAnswerIndex !== null && (
                <div className={`quiz-feedback ${isAnswerCorrect ? 'correct' : 'incorrect'}`}>
                  {isAnswerCorrect ? (
                    <span>✓ Félicitations ! Combat débloqué...</span>
                  ) : (
                    <span>✗ Mauvaise réponse. Essaie encore !</span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="monster-tamer-credit">
        « Monster Tamer » par Dev Share Academy — code MIT, ressources créditées par leurs auteurs.
      </footer>
    </div></ProtectedGameSurface>
  );
}
