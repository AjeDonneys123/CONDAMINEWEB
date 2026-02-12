// @signatures: GameEngine
import React from 'react';
import UnifiedMoteur from '../../../eleve/games/UnifiedMoteur';

/**
 * 🎓 SHELL STUDIO V.2.71
 * Rôle : Coquille vide qui appelle le moteur maître.
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
