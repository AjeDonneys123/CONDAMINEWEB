const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'gameEngine_FULL.txt';

// 📸 LISTE DES FICHIERS IMPLIQUÉS DANS LA CHAÎNE "STUDIO -> MOTEUR -> ÉLÈVE"
const TARGET_FILES = [
    // 1. LE CŒUR DU SYSTÈME (Shared Services)
    'client/src/services/gameCore.js',
    'client/src/services/SoundExpert.js',

    // 2. LE STUDIO (L'origine des sprites et des sons)
    'client/src/features/prof/studio/StudioDashboard.jsx',
    'client/src/features/prof/studio/panels/StudioLeftPanel.jsx',   // Séquenceur & Sons
    'client/src/features/prof/studio/panels/StudioCenterPanel.jsx', // Scène & Config
    'client/src/features/prof/studio/studioComp/GameEngine.jsx',   // Pont vers le Player

    // 3. LA DISTRIBUTION (Le passage vers Julian)
    'client/src/features/prof/games/GameStudio.jsx',
    'server/eleve/games/games.eleve.js', // Route Mirror

    // 4. L'APPLICATEUR ÉLÈVE (Le lecteur de Julian)
    'client/src/features/eleve/games/GamePlayer.jsx',
    'client/src/features/eleve/games/GamesGrid.jsx'
];

function captureEngine() {
    console.log("------------------------------------------------");
    console.log("📸 SNAPSHOT DU MOTEUR UNIFIÉ (V165)");
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
🎮 RÉFÉRENTIEL TECHNIQUE DU MOTEUR CONDAMINE
📅 Date : ${new Date().toLocaleString()}
📂 Fichiers capturés : ${count}
================================================================================
Ce snapshot contient toute l'infrastructure permettant au Prof de créer dans 
le Studio (Sprites/Sons) et à l'Élève de jouer en miroir exact.
================================================================================
`;

    fs.writeFileSync(OUTPUT_FILE, header + content);
    console.log("------------------------------------------------");
    console.log(`💾 Photographie terminée : ${OUTPUT_FILE}`);
}

captureEngine();
