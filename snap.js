const fs = require('fs');
const path = require('path');

// ==================================================
// CONFIGURATION DE L'INTRODUCTION POUR L'IA
// ==================================================
const IA_GUIDE = `
// ============================================================================
// MESSAGE IMPORTANT POUR LA SESSION D'IA : GUIDE DE SURVIE DU PROJET
// ============================================================================
// Bienvenue sur le projet "Condamine". Avant de proposer du code, lis ceci :
//
// 1. ARCHITECTURE : Le projet est en VANILLA JS MODULAIRE (V26+).
//    - app.js est le routeur (Login/Aiguillage).
//    - eleve.js et prof.js sont des orchestrateurs.
//    - Les fonctionnalités sont isolées dans des sous-dossiers (ex: eleve/devoirs.js).
//
// 2. LA RÈGLE D'OR "WINDOW" : 
//    - Pour éviter les erreurs d'importation relatives (../../) et de SyntaxError,
//      tous les services sont globaux : window.api et window.state.
//    - NE JAMAIS ré-importer api.js ou state.js dans les sous-modules.
//
// 3. SYSTÈME DE MISE À JOUR (apply.js) :
//    - L'utilisateur utilise un script "apply.js" qui lit "update.txt".
//    - Tes réponses DOIVENT respecter ce format strict pour chaque fichier :
//.   -les réponses doivent etre dans un fichier txt
//      // FILE:nom/du/fichier.js
//      [SAUTER 3 LIGNES VIDES]
//      [CODE COMPLET DU FICHIER]
//
// 4. INTERDICTION DE TRONQUER :
//    - NE JAMAIS envoyer de code partiel ou utiliser "// ... reste du code".
//    - Envoie TOUJOURS le fichier dans son intégralité absolue.
//    - Si le fichier est trop long, sépare ta réponse en plusieurs snipettes.
//
// 5. POINTS TECHNIQUES CRITIQUES :
//    - Proportions Devoirs : 75% liseuse (Haut) / 25% Interaction (Bas).
//    - Centrage Liseuse : Utilise translate(-50%, -50%) pour l'image dans le canvas.
//    - IA Correction : Le prompt doit exiger un tableau HTML 3 colonnes avec "reason".
//    - Zombie Game : Le projectile doit être à bottom: 22px pour viser juste.
// ============================================================================
`;

// 1. LISTE "TOTALE" (Pour sauvegarde complète)
const fullFiles = [
    'package.json',
    '.env',
    'apply.js',
    'snap.js',
    'src/server.js',
    'public/index.html',
    'public/style.css',
    'public/js/app.js',
    'public/js/prof/prof.js',
    'public/js/prof/dashboard.js',
    'public/js/eleve/eleve.js',
    'public/js/eleve/devoirs.js',
    'public/js/eleve/jeux.js',
    'public/js/games/ZombieGame.js'
];

// 2. LISTE "CODE IMPORTANT" (Pour session IA)
const coreFiles = [
    'src/server.js',
    'public/index.html',
    'public/style.css',
    'public/js/app.js',
    'public/js/prof/prof.js',
    'public/js/prof/dashboard.js',
    'public/js/eleve/eleve.js',
    'public/js/eleve/devoirs.js',
    'public/js/eleve/jeux.js',
    'public/js/games/ZombieGame.js'
];

function createSnapshot(filename, fileList, description) {
    console.log(`📸 Création de ${filename} (${description})...`);
    let content = `// SNAPSHOT: ${filename}\n`;
    content += `// DATE: ${new Date().toLocaleString()}\n`;
    content += `// DESCRIPTION: ${description}\n`;
    
    // Insertion du guide pour l'IA
    content += IA_GUIDE + `\n\n`;

    let count = 0;
    fileList.forEach(file => {
        const p = path.join(__dirname, file);
        if (fs.existsSync(p)) {
            const fileContent = fs.readFileSync(p, 'utf8');
            content += `// ==================================================\n`;
            // Marqueur sécurisé pour apply.js
            const marker = "// " + "FILE:"; 
            content += `${marker}${file}\n`;
            content += `// ==================================================\n`;
            content += `${fileContent}\n\n`;
            count++;
        }
    });
    fs.writeFileSync(filename, content);
    console.log(`✅ ${filename} généré avec ${count} fichiers.`);
}

// Exécution
console.log("---------------------------------------------");
createSnapshot('PROJET_SNAPSHOT.txt', coreFiles, "CODE ESSENTIEL POUR SESSION IA");
console.log("---------------------------------------------");