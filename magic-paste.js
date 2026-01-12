const fs = require('fs');
const path = require('path');

// Fonction pour importer clipboardy dynamiquement (car c'est un module ESM)
async function startMagicWatcher() {
    let clipboard;
    try {
        const module = await import('clipboardy');
        clipboard = module.default;
    } catch (e) {
        console.error("❌ Erreur: Lance 'npm install clipboardy' d'abord !");
        process.exit(1);
    }

    let lastContent = '';
    const updateFile = 'update.txt';

    console.log("------------------------------------------------");
    console.log("✨ [MAGIC PASTE] Surveillance du Presse-Papier active");
    console.log("📋 Copiez simplement le code de l'IA (Ctrl+C)...");
    console.log("🚀 Je l'injecte automatiquement dans update.txt !");
    console.log("------------------------------------------------");

    setInterval(async () => {
        try {
            // Lecture du presse-papier
            const text = await clipboard.read();

            // Est-ce du texte nouveau ?
            if (text && text !== lastContent) {
                
                // Est-ce que ça ressemble à notre format sécurisé ?
                // On cherche la balise d'ouverture OU de suppression avec le £
                if (text.includes('[[[£ FILE:') || text.includes('[[[£ DELETE:')) {
                    
                    console.log("⚡ Code détecté dans le presse-papier !");
                    
                    // Injection directe
                    fs.writeFileSync(updateFile, text, 'utf8');
                    
                    console.log(`✅ update.txt mis à jour (${text.length} caractères).`);
                    console.log("⏳ En attente de apply.js...\n");

                    // On mémorise pour ne pas le recoller en boucle
                    lastContent = text;
                }
            }
        } catch (err) {
            // On ignore les erreurs (ex: presse-papier vide ou image)
        }
    }, 1000); // Vérification chaque seconde
}

startMagicWatcher();