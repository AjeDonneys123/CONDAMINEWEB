import React, { useEffect, useMemo, useRef, useState } from 'react';
import './CondaGame.css';
import ProtectedGameSurface from '../ProtectedGameSurface';

const PIPE_COLORS = ['#00e5ff', '#ffea00', '#39ff14', '#ff2bd6'];

export default function CondaGame({ onExit, learningContext = {} }) {
  const iframeRef = useRef(null);
  const chooseRef = useRef(null);
  const quizIndexRef = useRef(0);
  const lessons = useMemo(() => (learningContext.lessons || []).map((lesson) => ({
    id: lesson.id || lesson._id || lesson.title,
    title: lesson.title || lesson.name || 'Leçon',
    questions: (lesson.quiz || []).filter((q) => Array.isArray(q.choices) && q.choices.length >= 2).map((q) => {
      const originalIndex = Math.min(q.choices.length - 1, Math.max(0, Number(q.correctIndex) || 0));
      const choices = q.choices.slice(0, 4);
      let correctIndex = Math.min(originalIndex, choices.length - 1);
      if (originalIndex >= 4) { choices[3] = q.choices[originalIndex]; correctIndex = 3; }
      while (choices.length < 4) choices.push(`Autre réponse ${choices.length + 1}`);
      return { question: q.question, choices, correctIndex };
    }),
  })).filter((lesson) => lesson.questions.length), [learningContext]);
  const progressKey = `condagame:lesson-progress:${lessons.map((lesson) => lesson.id).join('|') || 'empty'}`;
  const [lessonIndex, setLessonIndex] = useState(0);
  const [progressReady, setProgressReady] = useState(false);
  const runIdRef = useRef(0);
  const completedRunRef = useRef(-1);
  const lesson = lessons[lessonIndex] || null;
  const questions = lesson?.questions || [];
  const [quiz, setQuiz] = useState(null);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const savedIndex = Number(window.localStorage.getItem(progressKey));
    const nextIndex = lessons.length ? (Number.isFinite(savedIndex) && savedIndex >= 0 ? savedIndex : 0) % lessons.length : 0;
    setLessonIndex(nextIndex);
    quizIndexRef.current = 0;
    setProgressReady(true);
  }, [progressKey, lessons.length]);

  const sendLessonConfig = (index = lessonIndex) => {
    const selectedLesson = lessons[index];
    iframeRef.current?.contentWindow?.postMessage({
      type: 'condagame:configure-lesson',
      goal: selectedLesson?.questions.length || 0,
      lessonTitle: selectedLesson?.title || '',
    }, '*');
  };

  useEffect(() => {
    if (progressReady) sendLessonConfig();
  }, [lessonIndex, progressReady, progressKey]);

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'condagame:level-start') {
        runIdRef.current += 1;
        quizIndexRef.current = 0;
        return;
      }
      if (event.data?.type === 'condagame:keyboard-answer') chooseRef.current?.(event.data.index);
      if (event.data?.type === 'condagame:question-box') {
        if (!questions.length) {
          setFeedback('Ajoute des QCM à cette leçon pour jouer aux tableaux question.');
          iframeRef.current?.contentWindow?.postMessage({ type: 'condagame:question-answer', correct: false, noQuestion: true }, '*');
          window.setTimeout(() => setFeedback(''), 2600);
          return;
        }
        const index = quizIndexRef.current;
        if (index >= questions.length) {
          iframeRef.current?.contentWindow?.postMessage({ type: 'condagame:question-answer', correct: false, noQuestion: true }, '*');
          return;
        }
        setQuiz(questions[index]);
      }
      if (event.data?.type === 'condagame:wrong-answer') setFeedback(`Raté : −1 gemme. Mario recule de deux tableaux (${event.data.gems}/${event.data.goal}).`);
      if (event.data?.type === 'condagame:need-gems') setFeedback(`Il te faut ${event.data.goal} gemmes pour finir ce niveau (${event.data.gems}/${event.data.goal}).`);
      if (event.data?.type === 'condagame:level-won') {
        setFeedback(`Niveau réussi avec la leçon « ${lesson?.title || 'terminée'} » ! 💎`);
        window.setTimeout(() => setFeedback(''), 2200);
        if (completedRunRef.current === runIdRef.current) return;
        completedRunRef.current = runIdRef.current;
        if (lessons.length) {
          const nextIndex = (lessonIndex + 1) % lessons.length;
          window.localStorage.setItem(progressKey, String(nextIndex));
          setLessonIndex(nextIndex);
          quizIndexRef.current = 0;
          sendLessonConfig(nextIndex);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [questions, lesson, lessons, lessonIndex, progressKey]);

  const choose = (index) => {
    if (!quiz) return;
    const correct = index === quiz.correctIndex;
    if (correct) quizIndexRef.current += 1;
    setFeedback(correct ? 'Bonne réponse ! +1 gemme' : 'Raté : Mario recule de deux tableaux.');
    iframeRef.current?.contentWindow?.postMessage({ type: 'condagame:question-answer', correct, optionIndex: index }, '*');
    setQuiz((value) => ({ ...value, selectedIndex: index }));
    window.setTimeout(() => { setQuiz(null); setFeedback(''); }, 750);
    window.setTimeout(() => {
      const frame = iframeRef.current;
      frame?.focus();
      frame?.contentWindow?.focus();
      frame?.contentDocument?.getElementById('canvas')?.focus();
    }, 850);
  };
  chooseRef.current = choose;

  return <ProtectedGameSurface><main className="conda-game"><style>{`.conda-game-jump{position:absolute;z-index:5;left:var(--jump-x);bottom:10%;font-size:clamp(2rem,5vw,4rem);filter:drop-shadow(0 5px 3px #0007);animation:conda-auto-jump .68s cubic-bezier(.2,.75,.3,1) both}.conda-game-pipes{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));align-items:end}.conda-game-pipes button{width:100%}.conda-game-pipes button.selected i{transform:translateY(-9px);filter:brightness(1.25)}.conda-game-pipes button:disabled{cursor:default}@keyframes conda-auto-jump{0%{transform:translate(-50%,0) scale(.8)}45%{transform:translate(-50%,-105px) scale(1.08)}100%{transform:translate(-50%,-35px) scale(.72);opacity:.2}}`}</style>
    <header className="conda-game-header"><div><small>CONDAGAME · BLOCS BONUS À GEMMES</small><h1>Le saut des savoirs</h1></div><button onClick={onExit}>Quitter</button></header>
    <section className="conda-game-stage"><iframe ref={iframeRef} title="Jeu de plateforme CondaGame" src="/condagame/infinite-mario/main.html?v=quiz-contact-1" onLoad={() => { if (progressReady) sendLessonConfig(); }} />
      {quiz && <div className="conda-game-quiz"><div className="conda-game-question"><small>BLOC BONUS · CHOISIS LA BONNE RÉPONSE (1–4)</small><strong>{quiz.question}</strong></div><div className="conda-game-pipes">{[0, 1, 2, 3].map((index) => <button key={index} disabled={quiz.selectedIndex !== undefined} className={quiz.selectedIndex === index ? 'selected' : ''} style={{ '--pipe-color': PIPE_COLORS[index] }} onClick={() => choose(index)}><i /><span>{quiz.choices[index] || '—'}</span></button>)}</div>{quiz.selectedIndex !== undefined && <div className="conda-game-jump" style={{ '--jump-x': `${10 + quiz.selectedIndex * 27}%` }}>👨🏻‍🔧</div>}</div>}
      {!questions.length && <div className="conda-game-hint">Sélectionne une leçon avec des QCM pour pouvoir gagner des gemmes.</div>}
      {feedback && !quiz && <div className="conda-game-feedback">{feedback}</div>}
    </section>
    <footer>Leçon « {lesson?.title || '—'} » · touche les blocs gems pour répondre · une mauvaise réponse permet de réessayer.</footer>
  </main></ProtectedGameSurface>;
}
