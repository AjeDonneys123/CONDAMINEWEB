// @signatures: GamePlayer, handleGameMessage, initGame, nextRound
import React, { useEffect, useRef, useState } from 'react';
import './GamePlayer.css';

/**
 * 🎮 LECTEUR DE JEU UNIVERSEL
 * Charge n'importe quel jeu du Studio et lui injecte les questions du Quiz.
 */
export default function GamePlayer({ user, gameData, onExit }) {
    const canvasRef = useRef(null);
    const gameInstance = useRef(null);
    const [currentQIdx, setCurrentQIdx] = useState(0);
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [gameOver, setGameOver] = useState(false);
    
    // Extraction des niveaux/questions
    // On aplatit la structure pour avoir une liste simple de questions
    const allQuestions = gameData.levels?.flatMap(l => l.questions) || [];

    useEffect(() => {
        if (canvasRef.current && !gameInstance.current) {
            initGame();
        }
        return () => {
            if (gameInstance.current && gameInstance.current.destroy) {
                gameInstance.current.destroy();
            }
        };
    }, []);

    useEffect(() => {
        // Si le jeu est prêt, on lance le round
        if (gameInstance.current && !gameOver) {
            const q = allQuestions[currentQIdx];
            if (q) {
                // 📡 ENVOI AU JEU : "Affiche cette question"
                if (gameInstance.current.startRound) {
                    gameInstance.current.startRound(q.q, q.options);
                }
            } else {
                // Plus de questions = VICTOIRE
                handleWin();
            }
        }
    }, [currentQIdx, gameOver]);

    const initGame = async () => {
        try {
            // 1. Préparation des Assets
            const assets = {};
            const scene = gameData.scenes?.[0]; // On prend la scène principale
            if (scene) {
                const resources = (scene.actors || []).flatMap(a => 
                    (a.actions || []).flatMap(act => (act.frames || []).map(f => f.url))
                ).concat((scene.backdrops || []).map(b => b.url));

                await Promise.all([...new Set(resources)].filter(Boolean).map(url => new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = url.startsWith('/api/proxy') ? url : `/api/proxy/${url.split('/').pop()}`;
                    img.onload = () => { assets[url] = img; resolve(); };
                    img.onerror = resolve;
                })));
            }

            // 2. Injection du Code Studio
            const code = gameData.generatedCode;
            
            // On encapsule le code dans une factory
            const GameClass = new Function('canvas', 'assets', 'callbacks', `
                ${code}
                return MiniGame;
            `);

            // 3. Définition des Callbacks (Le Jeu parle à React)
            const callbacks = {
                submitAnswer: (index) => handleAnswer(index),
                playerDied: () => handleLifeLost(),
                playSound: (name) => console.log("🎵 Sound:", name)
            };

            // 4. Instanciation
            gameInstance.current = new GameClass(canvasRef.current, assets, callbacks);
            
            // 5. Démarrage
            if (gameInstance.current.start) gameInstance.current.start();
            
            // Premier round
            const firstQ = allQuestions[0];
            if (firstQ && gameInstance.current.startRound) {
                gameInstance.current.startRound(firstQ.q, firstQ.options);
            }

        } catch (e) {
            console.error("❌ Erreur démarrage jeu :", e);
            alert("Ce jeu contient une erreur de code. Retour au menu.");
            onExit();
        }
    };

    // --- LOGIQUE MÉTIER (L'ARBITRE) ---

    const handleAnswer = (selectedIndex) => {
        if (gameOver) return;
        
        const correctIndex = allQuestions[currentQIdx].a;
        const isCorrect = parseInt(selectedIndex) === parseInt(correctIndex);

        // 📡 ENVOI AU JEU : "C'est juste/faux"
        if (gameInstance.current.showResult) {
            gameInstance.current.showResult(isCorrect);
        }

        if (isCorrect) {
            setScore(s => s + 100);
            setTimeout(() => {
                if (currentQIdx + 1 < allQuestions.length) {
                    setCurrentQIdx(prev => prev + 1);
                } else {
                    handleWin();
                }
            }, 1000); // Petit délai pour voir l'anim de réussite
        } else {
            handleLifeLost();
        }
    };

    const handleLifeLost = () => {
        const newLives = lives - 1;
        setLives(newLives);
        
        // 📡 ENVOI AU JEU : "Mets à jour le HUD"
        if (gameInstance.current.updateHUD) {
            gameInstance.current.updateHUD(newLives, score);
        }

        if (newLives <= 0) {
            setGameOver(true);
            saveResult(0); // Échec
        } else {
            // On reste sur la même question ou on passe ?
            // Choix pédagogique : On laisse la question pour qu'il réessaie ou on passe.
            // Ici : On réessaie la même.
        }
    };

    const handleWin = () => {
        setGameOver(true);
        saveResult(1); // Succès
        alert(`VICTOIRE ! Score: ${score}`);
        onExit();
    };

    const saveResult = async (successLvl) => {
        // Sauvegarde BDD
        await fetch('/api/eleve/games/score', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ 
                studentId: user._id || user.id, 
                gameId: gameData._id, 
                score: score,
                levelReached: successLvl 
            })
        });
        if(successLvl === 0) alert("GAME OVER...");
        onExit();
    };

    return (
        <div className="game-player-fullscreen">
            <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight} className="game-canvas" />
            
            {/* UI DE SECOURS (Si le jeu ne gère pas l'affichage) */}
            <div className="game-hud-overlay">
                <div className="hud-lives">❤️ {lives}</div>
                <div className="hud-score">🏆 {score}</div>
                <button onClick={onExit} className="hud-quit-btn">QUITTER</button>
            </div>
        </div>
    );
}
