// @signatures: GameEngine
import React from 'react';
import GamePlayer from '../../../eleve/games/GamePlayer';

/**
 * 🎓 TESTEUR STUDIO UNIFIÉ V140
 * RÔLE : Ce fichier n'est plus un clône, mais une simple porte vers GamePlayer.jsx.
 * Toute modification dans GamePlayer sera répercutée ici automatiquement.
 */
export default function GameEngine({ code, project, activeSceneIdx, onStop, resolveUrl }) {
    // On passe le flag isStudioTest pour désactiver l'intro et forcer le démarrage direct
    return (
        <GamePlayer 
            gameData={{ ...project, generatedCode: code }} 
            onExit={onStop} 
            isStudioTest={true} 
            user={{ firstName: "Prof", lastName: "Test" }}
        />
    );
}
