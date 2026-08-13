// @signatures: StarshipWrapper, handleGameFinish, saveProgress
import React, { useEffect, useRef } from 'react';
import { initStarshipGame } from './starship_core';
import './starship_style.css';

export default function StarshipWrapper({ user, level, gameData, onClose, onFinish }) {
    const boxRef = useRef(null);

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

    const handleGameFinish = (score, success) => {
        saveProgress(score, success ? 1 : 0);
        if (onFinish) onFinish(success, score);
        else onClose();
    };

    useEffect(() => {
        if (level && boxRef.current) {
            // 1. SIGNAL DE DÉPART (Pastille Bleue)
            saveProgress(0, 0);

            // 2. Moteur
            const engine = initStarshipGame(boxRef.current, { level, user, gameData, onFinish: handleGameFinish }, onClose);
            return () => engine.destroy();
        }
    }, [level, gameData]);

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col w-full h-full">
            <div id="starship-root" ref={boxRef} className="w-full h-full relative overflow-hidden"></div>
        </div>
    );
}
