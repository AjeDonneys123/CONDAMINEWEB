// @signatures: GamePlayer
import React from 'react';
// ✅ IMPORT MIS À JOUR : On pointe vers le dossier SHARED
import UnifiedMoteur from '../../shared/games/UnifiedMoteur';
import LearningArcadeGame from './LearningArcadeGame';

/**
 * 🎒 SHELL ÉLÈVE V.3.1 (WIRING SHARED)
 * Rôle : Coquille vide qui appelle le moteur maître situé dans shared/games.
 */
export default function GamePlayer({ user, gameData, onExit }) {
    if (gameData?.isLearningGame && ['zombie', 'starship'].includes(String(gameData?.type || '').toLowerCase())) {
        return <LearningArcadeGame user={user} gameData={gameData} onExit={onExit} />;
    }
    return (
        <UnifiedMoteur 
            gameData={gameData} 
            onExit={onExit} 
            isStudioTest={false} 
            user={user}
        />
    );
}
