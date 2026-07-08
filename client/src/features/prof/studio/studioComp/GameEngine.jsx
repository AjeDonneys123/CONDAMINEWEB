// @signatures: GameEngine
import React from 'react';
// ✅ IMPORT MIS À JOUR : On pointe vers le dossier SHARED
import UnifiedMoteur from '../../../shared/games/UnifiedMoteur';

/**
 * 🎓 SHELL STUDIO V.3.1 (WIRING SHARED)
 * Rôle : Coquille vide qui appelle le moteur maître situé dans shared/games.
 */
export default function GameEngine({ code, project, testGame, quickTest = false, activeSceneIdx, onStop, resolveUrl }) {
    const isPokedeck = /pokedeck|poke deck/i.test(String(project?.title || ''));
    const testProject = isPokedeck
        ? {
            ...project,
            scenes: (project?.scenes || []).map((scene) => ({
                ...scene,
                actors: (scene?.actors || []).map((actor) => ({
                    ...actor,
                    // Les sprites vue du dessus contiennent déjà leurs orientations
                    // dans les frames : il ne faut pas faire pivoter l'image entière.
                    rotationStyle: 'none'
                }))
            }))
        }
        : project;
    const playableProject = {
        ...(testGame || {}),
        ...testProject,
        levels: Array.isArray(testGame?.levels) && testGame.levels.length > 0
            ? testGame.levels
            : (testProject?.levels || []),
        globalIntro: testGame?.globalIntro || testProject?.globalIntro || {},
        generatedCode: code
    };

    return (
        <UnifiedMoteur 
            gameData={playableProject}
            onExit={onStop} 
            isStudioTest={true} 
            quickTest={quickTest}
            user={{ firstName: "Prof", lastName: "Test" }}
        />
    );
}
