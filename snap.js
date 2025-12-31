const fs = require('fs');
const path = require('path');

// 1. LISTE "TOTALE" (Pour sauvegarde complète)
const fullFiles = [
    'package.json',
    'package-lock.json',
    '.gitignore',
    'apply.js',
    'snap.js',
    'src/server.js',
    'src/check-models.js',
    'src/init-db.js',
    'public/index.html',
    'public/style.css',
    'public/js/main.js',
    'public/js/api.js',
    'public/js/state.js',
    'public/js/app.js',
    'public/js/eleve.js',
    'public/js/prof.js',
    'public/js/games/ZombieGame.js',
    'public/js/games/HomeworkGame.js',
    'public/js/games/RedactionGame.js',
    'public/js/games/StarshipGame.js',
    'public/js/games/JumperGame.js'
];

// 2. LISTE "CODE IMPORTANT" (Pour session IA)
const coreFiles = [
    'package.json',
    'src/server.js',
    'public/index.html',
    'public/style.css',
    'public/js/main.js',
    'public/js/eleve.js',
    'public/js/prof.js',
    'public/js/games/ZombieGame.js',
    'public/js/games/HomeworkGame.js',
    'public/js/games/RedactionGame.js',
    'public/js/games/StarshipGame.js',
    'public/js/games/JumperGame.js'
];

function createSnapshot(filename, fileList, description) {
    console.log(`📸 Création de ${filename} (${description})...`);
    let content = `// SNAPSHOT: ${filename}\n`;
    content += `// DATE: ${new Date().toLocaleString()}\n`;
    content += `// DESCRIPTION: ${description}\n\n`;

    let count = 0;
    fileList.forEach(file => {
        const p = path.join(__dirname, file);
        if (fs.existsSync(p)) {
            const fileContent = fs.readFileSync(p, 'utf8');
            content += `// ==================================================\n`;
            // RUSE ICI : On coupe le mot FILE pour ne pas tromper apply.js
            const marker = "// " + "FILE: "; 
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
createSnapshot('SNAPSHOT_FULL.txt', fullFiles, "SAUVEGARDE TOTALE");
createSnapshot('SNAPSHOT_CODE.txt', coreFiles, "CODE ESSENTIEL");
console.log("---------------------------------------------");