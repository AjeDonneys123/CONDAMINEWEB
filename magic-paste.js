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
    const statusFile = 'apply_status.json';

    console.log("------------------------------------------------");
    console.log("✨ [MAGIC PASTE v3] Surveillance Haute Sécurité");
    console.log("👉 Tag de sécurité pour acquitter : ⚡_FIX_REQ_⚡");
    console.log("------------------------------------------------");

    setInterval(async () => {
        try {
            const text = await clipboard.read();

            if (text && text !== lastContent) {
                
                // CAS 1 : ACQUITTEMENT SÉCURISÉ
                // On ne déclenche QUE si ce tag très précis est présent
                if (text.includes("⚡_FIX_REQ_⚡")) {
                    console.log("✅ Acquittement sécurisé détecté.");
                    
                    // Reset du statut
                    try {
                        fs.writeFileSync(statusFile, JSON.stringify({ status: 'OK', timestamp: Date.now() }, null, 2));
                        console.log("   -> Alerte effacée.");
                    } catch (e) {}
                    
                    lastContent = text;
                    return;
                }

                // CAS 2 : INJECTION DE CODE
                if (text.includes('[[[£ FILE:') || text.includes('[[[£ DELETE:')) {
                    console.log("⚡ Code détecté. Injection...");
                    fs.writeFileSync(updateFile, text, 'utf8');
                    lastContent = text;
                }
            }
        } catch (err) {}
    }, 1000);
}

startMagicWatcher();