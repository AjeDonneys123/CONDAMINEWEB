const fs = require('fs');
let lastContent = "";

console.log("------------------------------------------------");
console.log("🔮 MAGIC PASTE ACTIF : En attente de code...");
console.log("------------------------------------------------");

setInterval(async () => {
    try {
        const module = await import('clipboardy');
        const text = await module.default.read();
        
        // On vérifie si le presse-papier contient notre tag spécial et a changé
        if (text.includes('[[[£ FILE:') && text !== lastContent) {
            const timestamp = new Date().toLocaleTimeString();
            console.log("\n"); 
            console.log("================================================");
            console.log(`⚡ [${timestamp}] MAGIC PASTE DÉTECTÉ !`);
            console.log(`📋 Capture de ${text.length} caractères.`);
            console.log(`📝 Écriture dans update.txt...`);
            console.log("================================================");
            
            fs.writeFileSync('update.txt', text);
            lastContent = text;
        }
    } catch (e) {
        // On ignore les erreurs de lecture (verrouillage presse-papier momentané)
    }
}, 2000);
