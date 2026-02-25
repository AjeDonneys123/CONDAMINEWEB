const fs = require('fs');
let lastContent = "";

console.log("------------------------------------------------");
console.log("🔮 MAGIC PASTE ACTIF : En attente de code...");
console.log("------------------------------------------------");

setInterval(async () => {
    try {
        const module = await import('clipboardy');
        const text = await module.default.read();
        
        // Vérifie si le fichier d'entrée a été vidé par apply.js
        const inputIsEmpty = !fs.existsSync('update.txt') || fs.readFileSync('update.txt', 'utf8').length === 0;

        // On copie SI le tag est présent ET (le contenu a changé OU le fichier cible est vide)
        if (text.includes('