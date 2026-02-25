// @signatures: doPush
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const VERSION_FILE = path.join(__dirname, 'server', 'version.json');

async function doPush() {
    let v = { build: 1 }; // Valeur par défaut
    try { 
        v = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); 
    } catch(e) {
        console.warn("⚠️ [GIT-AUTO] Impossible de lire version.json. Utilisation de la version de base.");
    }
    
    // INCREMENTATION DU NUMÉRO DE BUILD
    v.build++;
    
    try {
        fs.writeFileSync(VERSION_FILE, JSON.stringify(v, null, 2));
        
        // Ajout du fichier de version au commit
        exec('git add . && git commit -m "Auto-Save Build #' + v.build + '" && git push', (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ [GIT-AUTO] Erreur d'exécution Git : ${error.message}`);
                return;
            }
            if (stderr) {
                // Ignore les messages d'avertissement non bloquants
                if (!stderr.includes('nothing to commit')) {
                    console.error(`⚠️ [GIT-AUTO] Avertissement Git : ${stderr}`);
                }
            }
            console.log(`✅ [GIT-AUTO] Push auto réussi (Build #${v.build}).`);
        });
    } catch (e) { 
        console.error(`❌ [GIT-AUTO] Erreur d'écriture/commit : ${e.message}`);
    }
}
// Lance toutes les 10 minutes (600 000 ms)
setInterval(doPush, 600000);