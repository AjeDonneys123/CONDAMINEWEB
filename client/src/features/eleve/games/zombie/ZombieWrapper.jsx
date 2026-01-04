import React, { useEffect, useRef, useState } from 'react';
import { ZombieGame } from './ZombieGame';
import './ZombieGame.css';
import { api } from '../../../../services/api';

export default function ZombieWrapper({ user, onClose }) {
    const containerRef = useRef(null);
    const gameInstance = useRef(null);
    const [levels, setLevels] = useState([]);
    const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
    const [qIdx, setQIdx] = useState(0);
    const [loading, setLoading] = useState(true);

    // 1. Chargement des niveaux depuis la BDD
    useEffect(() => {
        api.get('/game-levels/all').then(data => {
            if(data && data.length > 0) {
                // On ne garde que les niveaux Zombie
                const zLevels = data.filter(l => l.chapterId === 'ch1-zombie');
                setLevels(zLevels);
            }
            setLoading(false);
        });
    }, []);

    // 2. Démarrage du moteur de jeu
    useEffect(() => {
        if (!loading && levels.length > 0 && containerRef.current) {
            // Création du Controller (Le pont entre Vanilla JS et React)
            const controller = {
                onCorrect: () => {
                    // Question suivante après délai animation
                    setTimeout(() => nextQuestion(), 1000);
                },
                onWrong: () => {
                    // Game Over ou Pénalité (ici on recommence la question pour simplifier)
                    console.log("Raté !");
                },
                checkAnswerWithAI: async (question, answer) => {
                    // Appel serveur via l'API existante
                    // On triche un peu en utilisant la route analyze-homework pour corriger une phrase
                    const res = await api.post('/analyze-homework', {
                        userText: answer,
                        homeworkInstruction: "Analyse grammaticale et orthographique de cette phrase : " + question,
                        playerId: user._id
                    });
                    return res; 
                },
                playSound: (name) => {
                    console.log("🎵 Sound:", name);
                }
            };

            gameInstance.current = new ZombieGame(containerRef.current, controller);
            startGame();
        }
    }, [loading, levels]);

    const startGame = () => {
        if(!gameInstance.current) return;
        const lvl = levels[currentLevelIdx];
        if(lvl && lvl.questions.length > 0) {
            gameInstance.current.loadQuestion(lvl.questions[0]);
        }
    };

    const nextQuestion = () => {
        const lvl = levels[currentLevelIdx];
        const nextQIdx = qIdx + 1;

        if (nextQIdx < lvl.questions.length) {
            setQIdx(nextQIdx);
            gameInstance.current.loadQuestion(lvl.questions[nextQIdx]);
        } else {
            alert("Niveau terminé ! Bravo !");
            onClose(); // Retour au menu
        }
    };

    if (loading) return <div className="text-center p-10 font-bold text-white">Chargement du jeu...</div>;
    if (levels.length === 0) return <div className="text-center p-10 font-bold text-white">Aucun niveau Zombie disponible. Demande à ton prof d'en créer ! <br/><button onClick={onClose} className="mt-4 bg-white text-black px-4 py-2 rounded">Retour</button></div>;

    return (
        <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center p-4">
            <div ref={containerRef} className="z-container">
                
                {/* ARENE */}
                <div id="zombie-arena">
                    <div id="z-hero">👮</div>
                    <div id="z-zombie">🧟</div>
                    <div id="z-projectile">🔥</div>
                    <div id="feedback-bubble"></div>
                </div>

                {/* INTERFACE */}
                <div className="z-interface">
                    <div className="flex justify-between mb-4 text-xs font-bold text-slate-400 uppercase">
                        <span>Niveau : {levels[currentLevelIdx].title}</span>
                        <button onClick={onClose} className="text-red-400 hover:text-red-600">Quitter</button>
                    </div>

                    <div id="z-question">Chargement...</div>

                    {/* MODE QCM */}
                    <div id="options-grid">
                        <button className="option-btn">A</button>
                        <button className="option-btn">B</button>
                        <button className="option-btn">C</button>
                        <button className="option-btn">D</button>
                    </div>

                    {/* MODE IA */}
                    <div id="ai-input-zone" style={{display:'none'}}>
                        <input id="z-answer" type="text" placeholder="Ta réponse..." autoComplete="off" />
                        <button id="z-submit">FEU !</button>
                    </div>
                </div>
            </div>
        </div>
    );
}