const fs = require('fs');
const path = require('path');

console.log("⚙️  RÉPARATION DU SYSTÈME AUTOMATIQUE...");

// 1. LE SCRIPT APPLY.JS (Version Ultime - Gère les espaces et sauts de ligne)
const applyCode = `
const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';

function applyUpdate() {
    if (!fs.existsSync(inputFile)) return;
    const content = fs.readFileSync(inputFile, 'utf8');
    
    // Sécurité anti-boucle
    if (!content || content.trim().length < 5) return;

    console.log("---------------------------------------------");
    console.log("📥 DÉTECTION DE CODE DANS UPDATE.TXT...");

    // Regex robuste pour couper le fichier
    const parts = content.split(/\\/\\/\\s*FILE:\\s*/);
    let count = 0;

    parts.forEach(part => {
        if (!part.trim()) return;
        const firstLineEnd = part.indexOf('\\n');
        if (firstLineEnd === -1) return;

        let filePath = part.substring(0, firstLineEnd).trim();
        let fileContent = part.substring(firstLineEnd).trim();
        
        // Nettoyage windows/mac
        filePath = filePath.replace(/\\r/g, '');

        if (filePath) {
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(\`✅ ÉCRIT : \${filePath}\`);
                count++;
            } catch (e) { console.error(\`❌ Erreur : \${e.message}\`); }
        }
    });

    if (count > 0) {
        fs.writeFileSync(inputFile, '');
        console.log(\`✨ SUCCÈS : \${count} fichiers mis à jour.\`);
    }
    console.log("---------------------------------------------");
}
applyUpdate();
`;

// 2. LE SCRIPT SNAP.JS
const snapCode = `
const fs = require('fs');
const path = require('path');
const filesToInclude = ['package.json','apply.js','snap.js','src/server.js','public/index.html','public/style.css','public/js/app.js','public/js/eleve.js','public/js/prof.js','public/js/games/ZombieGame.js','public/js/games/HomeworkGame.js'];
const outputFile = 'PROJET_SNAPSHOT.txt';
function generateSnapshot() {
    let combined = \`// SNAPSHOT - \${new Date().toLocaleString()}\\n\\n\`;
    filesToInclude.forEach(file => {
        const p = path.join(__dirname, file);
        if (fs.existsSync(p)) combined += \`\\n// FILE: \${file}\\n\${fs.readFileSync(p, 'utf8')}\\n\`;
    });
    fs.writeFileSync(outputFile, combined);
    console.log("📸 Snapshot généré.");
}
generateSnapshot();
`;

// 3. LE PACKAGE.JSON (Optimisé Mac)
const packageJson = {
  "name": "5e-entraineur",
  "version": "1.0.0",
  "description": "Plateforme Condamine",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon --ext js,html,css,txt --watch src --watch public --watch update.txt --ignore PROJET_SNAPSHOT.txt --exec \"(lsof -t -i:3000 | xargs kill -9 2>/dev/null || true) && node apply.js && node snap.js && node src/server.js\""
  },
  "dependencies": {
    "@google/generative-ai": "^0.1.0",
    "cloudinary": "^1.41.0",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "mongoose": "^7.6.3",
    "multer": "^1.4.5-lts.1",
    "multer-storage-cloudinary": "^4.0.0",
    "node-fetch": "^2.7.0"
  },
  "devDependencies": { "nodemon": "^3.0.1" }
};

// ECRITURE DES FICHIERS
fs.writeFileSync('apply.js', applyCode);
fs.writeFileSync('snap.js', snapCode);
fs.writeFileSync('package.json', JSON.stringify(packageJson, null, 2));
if (!fs.existsSync('update.txt')) fs.writeFileSync('update.txt', '');

console.log("🚀 OUTILS INSTALLÉS AVEC SUCCÈS !");
