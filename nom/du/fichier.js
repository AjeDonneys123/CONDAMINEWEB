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