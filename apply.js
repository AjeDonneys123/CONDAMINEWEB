const fs = require('fs');
const path = require('path');

/**
 * 🛠️ APPLY.JS V12.0 - MODE OBSERVATEUR & GREFFEUR
 * - Lit 'update.txt' et applique les changements sur le disque.
 * - NE VIDE JAMAIS le fichier lui-même (Laisse l'Agent le faire après vérification).
 * - Utilise un hash/comparaison pour ne pas ré-écrire en boucle le même code.
 */

const inputFile = 'update.txt';
const statusFile = 'apply_status.json';
let lastProcessedContent = "";

function writeStatus(type, message) {
    const data = { status: type, message, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function applyUpdates() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const content = fs.readFileSync(inputFile, 'utf8').trim();
        
        // Si le fichier est vide ou si c'est le même contenu que la dernière fois, on ne fait rien
        if (content.length < 10 || content === lastProcessedContent) return;

        console.log("🚀 [APPLY] Nouveau code détecté. Application de la greffe...");
        const fileBlocks = content.split('[[[£ FILE:');
        fileBlocks.shift(); 

        for (const block of fileBlocks) {
            const parts = block.split('£]]]');
            if (parts.length < 2) continue;

            const filePath = parts[0].trim();
            const fileContent = parts.slice(1).join('£]]]').split('[[[£ END:')[0].trim();

            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);

            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            
            fs.writeFileSync(fullPath, fileContent);
            console.log(`✅ [DISK WRITE] ${filePath}`);
        }

        lastProcessedContent = content; // Mémorise pour ne pas boucler
        writeStatus('VERIFICATION_REQUIRED', 'Fichiers écrits. En attente de vérification par l\'agent.');
        console.log("✨ Greffe terminée. En attente de nettoyage par l'Agent.");

    } catch (e) {
        console.log(`💥 [ERROR] ${e.message}`);
        writeStatus('ERROR', e.message);
    }
}

// Vérification toutes les 2 secondes
setInterval(applyUpdates, 2000);
console.log("🛡️ APPLY V12.0 : MODE PERSISTANT ACTIVÉ.");
console.log("Les fichiers seront écrits, mais 'update.txt' restera plein pour vérification.");