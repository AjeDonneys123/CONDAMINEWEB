import React, { useEffect, useRef } from 'react';
import { initZombieGame } from './zombie_core';
import './zombie_style.css';

export default function ZombieWrapper({ user, level, onClose }) {
    const boxRef = useRef(null);
    
    // Fonction générique pour sauvegarder
    const saveProgress = async (score, lvl) => {
        if (!user || !level) return;
        try {
            await fetch('/api/games/save-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    studentId: user._id || user.id,
                    gameId: level._id,
                    score: score,
                    levelReached: lvl
                })
            });
        } catch (e) { console.error("Save fail", e); }
    };

    // Callback Fin de jeu (Win/Lose)
    const handleGameFinish = (score, success) => {
        saveProgress(score, success ? 1 : 0); // 1 = Violet, 0 = Bleu
        onClose();
    };

    useEffect(() => {
        if (!level || !boxRef.current) return;

        // 1. SIGNAL DE DÉPART : On marque "Bleu" (0) dès l'ouverture
        // Comme ça, même si l'élève quitte avec la croix, c'est marqué "Vu/Essayé"
        saveProgress(0, 0);

        // 2. Lancement du jeu
        const engine = initZombieGame(boxRef.current, { level, user, onFinish: handleGameFinish }, onClose);
        
        return () => engine.destroy();
    }, [level]);

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col">
            <div id="zombie-root" ref={boxRef} className="w-full h-full"></div>
        </div>
    );
}