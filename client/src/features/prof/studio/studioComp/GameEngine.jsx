// @signatures: GameEngine
import React from 'react';
// ✅ IMPORT MIS À JOUR : On pointe vers le dossier SHARED
import UnifiedMoteur from '../../../shared/games/UnifiedMoteur';

/**
 * 🎓 SHELL STUDIO V.3.1 (WIRING SHARED)
 * Rôle : Coquille vide qui appelle le moteur maître situé dans shared/games.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    return (
        <UnifiedMoteur 
            gameData={{ ...project, generatedCode: code }} 
            onExit={onStop} 
            isStudioTest={true} 
            user={{ firstName: "Prof", lastName: "Test" }}
        />
    );
}