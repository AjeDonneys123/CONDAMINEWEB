const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'gameEngine_FULL.txt';

// LISTE COMPLÈTE : CRÉATION (PROF) + MOTEUR (SHARED) + JEU (ÉLÈVE)
const TARGET_FILES = [
    // 1. LE MOTEUR COMMUN (Cœur du système)
    'client/src/services/gameCore.js',
    'client/src/services/SoundExpert.js',

    // 2. COTÉ PROF : L'OUTIL DE CRÉATION DE JEU (Questions, Niveaux...)
    'client/src/features/prof/games/GameStudio.jsx',

    // 3. COTÉ PROF : L'ATELIER VISUEL (Sprites, Code, Preview)
    'client/src/features/prof/studio/StudioDashboard.jsx',
    'client/src/features/prof/studio/studioComp/GameEngine.jsx', // Le moteur utilisé dans le Studio
    'client/src/features/prof/studio/panels/StudioCenterPanel.jsx',
    'client/src/features/prof/studio/panels/StudioLeftPanel.jsx',

    // 4. COTÉ ÉLÈVE : LE LECTEUR DE JEU (Ce que voit l'enfant)
    'client/src/features/eleve/games/GamePlayer.jsx',
    'client/src/features/eleve/games/zombie/ZombieWrapper.jsx', // Le conteneur spécifique

    // 5. UTILITAIRES AUDIO
    'client/src/features/prof/studio/studioComp/SoundModal.jsx'
];

function captureFiles() {
    console.log("------------------------------------------------");
    console.log("📸 SNAPSHOT COMPLET : ENGINE + PROF + ÉLÈVE");
    console.log("------------------------------------------------");

    let content = "";
    let count = 0;

    TARGET_FILES.forEach(relPath => {
        const fullPath = path.join(__dirname, relPath);
        
        if (fs.existsSync(fullPath)) {
            const fileContent = fs.readFileSync(fullPath, 'utf8');
            content += `\n[[[£ FILE: ${relPath} £]]]\n${fileContent}\n[[[£ END: ${relPath} £]]]\n`;
            console.log(`✅ Capturé : ${relPath}`);
            count++;
        } else {
            console.warn(`⚠️  MANQUANT : ${relPath}`);
        }
    });

    const header = `
================================================================================
🎮 SNAPSHOT GLOBAL MOTEUR (V2)
📅 Date : ${new Date().toLocaleString()}
📂 Fichiers : ${count}
================================================================================
Ce fichier contient toute la chaîne de production du jeu :
1. Services Partagés (Core)
2. Interface Prof (Studio & GameStudio)
3. Interface Élève (Player & Wrapper)
================================================================================
`;

    fs.writeFileSync(OUTPUT_FILE, header + content);
    console.log("------------------------------------------------");
    console.log(`💾 Fichier généré : ${OUTPUT_FILE}`);
    console.log(`🚀 Vous avez maintenant une image complète du système de jeu.`);
}

captureFiles();
