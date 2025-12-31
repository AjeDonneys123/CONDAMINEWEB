const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';

console.log("▶️ DÉMARRAGE DU DÉPLOIEMENT...");

function applyUpdate() {
    if (!fs.existsSync(inputFile)) {
        console.log("❌ update.txt introuvable.");
        return;
    }

    const content = fs.readFileSync(inputFile, 'utf8');
    if (!content || content.trim().length < 10) {
        console.log("⚠️ Le fichier update.txt est vide.");
        return;
    }

    // Regex robuste : cherche // FILE:nom, puis capture tout jusqu'au prochain // FILE: ou la fin
    const regex = /\/\/\s*FILE:([^\n\r]+)[\r\n]{1,6}([\s\S]*?)(?=\/\/\s*FILE:|$)/g;
    let match;
    let count = 0;

    console.log("---------------------------------------------");
    while ((match = regex.exec(content)) !== null) {
        const filePath = match[1].trim();
        const fileContent = match[2];

        if (filePath) {
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(`✅ ÉCRIT : ${filePath} (${fileContent.length} octets)`);
                count++;
            } catch (e) {
                console.error(`❌ Erreur sur ${filePath}: ${e.message}`);
            }
        }
    }

    if (count > 0) {
        fs.writeFileSync(inputFile, '');
        console.log(`✨ SUCCÈS : ${count} fichiers mis à jour.`);
    } else {
        console.log("⚠️ Aucune balise // FILE: valide trouvée. Vérifie ton format.");
    }
    console.log("---------------------------------------------");
}

applyUpdate();