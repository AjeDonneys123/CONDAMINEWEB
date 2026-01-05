/* HUB DE JEUX V2 - LISTE QUIZ PUIS CHOIX DU JEU */
import React, { useState, useEffect } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';
import StarshipWrapper from './starship/StarshipWrapper';
import { api } from '../../../services/api';
import './GamesGrid.css';

function normalizeClass(c) {
    if(!c) return "";
    return c.toString().toLowerCase().replace(/e/g, '').replace(/eme/g, '').trim();
}

export default function GamesGrid({ user }) {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // États de navigation
  const [selectedQuiz, setSelectedQuiz] = useState(null); // Le quiz choisi
  const [activeGame, setActiveGame] = useState(null);     // Le mode de jeu ('zombie' ou 'starship')

  // 1. Chargement des Quiz (ex-niveaux)
  useEffect(() => {
    api.get('/game-levels/all').then(data => {
        if(data && data.length > 0) {
            const userClass = normalizeClass(user.classroom);
            // On affiche TOUS les niveaux dispos pour la classe (peu importe le "chapterId" d'origine)
            const myQuizzes = data.filter(l => {
                const levelClass = normalizeClass(l.classroom || 'Toutes');
                return (levelClass === 'toutes' || levelClass === userClass);
            });
            setQuizzes(myQuizzes);
        }
        setLoading(false);
    });
  }, []);

  // 2. Lancement du jeu
  const launchGame = (mode) => {
      setActiveGame(mode);
  };

  const closeGame = () => {
      setActiveGame(null);
      setSelectedQuiz(null); // Retour liste
  };

  // --- RENDU JEU ACTIF ---
  if (activeGame === 'zombie' && selectedQuiz) return <ZombieWrapper user={user} level={selectedQuiz} onClose={closeGame} />;
  if (activeGame === 'starship' && selectedQuiz) return <StarshipWrapper user={user} level={selectedQuiz} onClose={closeGame} />;

  // --- RENDU SÉLECTEUR DE JEU (MODALE) ---
  if (selectedQuiz) {
      return (
          <div className="game-selector-overlay animate-in fade-in">
              <div className="selector-card">
                  <h2 className="text-2xl font-black text-slate-700 text-center mb-6">CHOISIS TON JEU 🕹️</h2>
                  <div className="selector-grid">
                      <button onClick={() => launchGame('zombie')} className="game-choice-btn zombie-btn">
                          <span className="text-5xl mb-2">🧟</span>
                          <span>ZOMBIE</span>
                      </button>
                      <button onClick={() => launchGame('starship')} className="game-choice-btn starship-btn">
                          <span className="text-5xl mb-2">🚀</span>
                          <span>STARSHIP</span>
                      </button>
                  </div>
                  <button onClick={() => setSelectedQuiz(null)} className="mt-6 text-slate-400 font-bold hover:text-red-500">Annuler</button>
              </div>
          </div>
      );
  }

  // --- RENDU LISTE DES QUIZ ---
  return (
    <div className="games-hub-container">
        {loading ? <p className="text-center">Chargement...</p> : (
            <div className="quizzes-grid">
                {quizzes.length > 0 ? quizzes.map(q => (
                    <div key={q._id} onClick={() => setSelectedQuiz(q)} className="quiz-card">
                        <div className="quiz-icon">🎓</div>
                        <div className="quiz-info">
                            <h3>{q.title}</h3>
                            <p>{q.questions.length} questions</p>
                        </div>
                        <div className="quiz-play">▶</div>
                    </div>
                )) : (
                    <div className="empty-state">Aucun quiz disponible pour ta classe.</div>
                )}
            </div>
        )}
    </div>
  );
}