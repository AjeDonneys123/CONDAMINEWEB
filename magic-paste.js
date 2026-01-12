const fs = require('fs');
const path = require('path');

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
    console.log("✨ [MAGIC PASTE] Surveillance active (Mode Pass-Through)");
    console.log("👉 Si tu copies un fichier coupé, le site t'avertira.");
    console.log("------------------------------------------------");

    setInterval(async () => {
        try {
            const text = await clipboard.read();

            if (text && text !== lastContent) {
                // On détecte juste le début. Si la fin manque, on envoie quand même
                // pour que apply.js puisse lever l'alerte côté Front.
                if (text.includes('[[[£ FILE:') || text.includes('[[[£ DELETE:')) {
                    
                    console.log("⚡ Code détecté. Injection dans update.txt...");
                    fs.writeFileSync(updateFile, text, 'utf8');
                    lastContent = text;
                }
            }
        } catch (err) {}
    }, 1000);
}

startMagicWatcher();