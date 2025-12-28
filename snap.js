
const fs = require('fs');
const path = require('path');
const filesToInclude = ['package.json','apply.js','snap.js','src/server.js','public/index.html','public/style.css','public/js/app.js','public/js/eleve.js','public/js/prof.js','public/js/games/ZombieGame.js','public/js/games/HomeworkGame.js'];
const outputFile = 'PROJET_SNAPSHOT.txt';
function generateSnapshot() {
    let combined = `// SNAPSHOT - ${new Date().toLocaleString()}\n\n`;
    filesToInclude.forEach(file => {
        const p = path.join(__dirname, file);
        if (fs.existsSync(p)) combined += `\n// FILE: ${file}\n${fs.readFileSync(p, 'utf8')}\n`;
    });
    fs.writeFileSync(outputFile, combined);
    console.log("📸 Snapshot généré.");
}
generateSnapshot();
