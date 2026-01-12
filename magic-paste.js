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
    console.log("✨ [MAGIC PASTE] Surveillance active (Format £)");
    console.log("🛡️  Sécurité : Rejette les copies incomplètes.");
    console.log("------------------------------------------------");

    setInterval(async () => {
        try {
            const text = await clipboard.read();

            if (text && text !== lastContent) {
                // 1. Détection des balises d'ouverture
                const hasStart = text.includes('[[[£ FILE:') || text.includes('[[[£ DELETE:');
                
                if (hasStart) {
                    // 2. SÉCURITÉ RENFORCÉE : Vérifie la présence d'au moins une balise de fin
                    // Cela évite d'envoyer un fichier tronqué qui bloquerait apply.js
                    if (!text.includes('£]]]')) {
                        if (text !== lastContent) { // Log une seule fois
                            console.log("⚠️  Copie détectée mais INCOMPLÈTE (Pas de '£]]]'). Ignorée.");
                            lastContent = text; 
                        }
                        return;
                    }

                    console.log("⚡ Code valide détecté ! Injection...");
                    
                    fs.writeFileSync(updateFile, text, 'utf8');
                    
                    console.log(`✅ update.txt mis à jour.`);
                    lastContent = text;
                }
            }
        } catch (err) {}
    }, 1000);
}

startMagicWatcher();