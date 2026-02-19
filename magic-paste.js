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
        if (text.includes('[[[£ FILE:') && (text !== lastContent || inputIsEmpty)) {
            const timestamp = new Date().toLocaleTimeString();
            console.log(`⚡ [${timestamp}] CAPTURE -> update.txt`);
            
            fs.writeFileSync('update.txt', text);
            lastContent = text;
        }
    } catch (e) {
        // Erreur silencieuse pour les verrous du presse-papier
    }
}, 1000); // On descend à 1s pour plus de réactivité
