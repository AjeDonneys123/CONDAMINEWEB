// @signatures: GamePlayer
import React from 'react';
// ✅ IMPORT MIS À JOUR : On pointe vers le dossier SHARED
import UnifiedMoteur from '../../shared/games/UnifiedMoteur';

/**
 * 🎒 SHELL ÉLÈVE V.3.1 (WIRING SHARED)
 * Rôle : Coquille vide qui appelle le moteur maître situé dans shared/games.
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
