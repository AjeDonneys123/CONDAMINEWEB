// @signatures: GamePlayer
import React from 'react';
import UnifiedMoteur from './UnifiedMoteur';

/**
 * 🎒 SHELL ÉLÈVE V.2.70
 * Rôle : Coquille vide qui appelle le moteur maître.
 */
export default function GamePlayer({ user, gameData, onExit }) {
    return (
        <UnifiedMoteur 
            gameData={gameData} 
            onExit={onExit} 
            isStudioTest={false} 
            user={user}
        />
    );
}
