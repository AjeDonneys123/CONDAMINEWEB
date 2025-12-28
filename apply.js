const fs = require('fs');
const path = require('path');
const inputFile = 'update.txt';

console.log("▶️ DÉMARRAGE DU SCRIPT DE DEBUG...");

function applyUpdate() {
    // 1. Vérifier où le script cherche le fichier
    const absolutePath = path.resolve(inputFile);
    console.log(`🔎 Je cherche le fichier ici : ${absolutePath}`);

    // 2. Vérifier si le fichier existe
    if (!fs.existsSync(inputFile)) {
        console.error("❌ ERREUR FATALE : Le fichier update.txt est INTROUVABLE !");
        console.error("👉 Vérifie qu'il n'est pas dans un sous-dossier ou nommé 'update.txt.txt'");
        return;
    }

    // 3. Lire le contenu
    const content = fs.readFileSync(inputFile, 'utf8');
    console.log(`📄 Fichier trouvé ! Taille : ${content.length} caractères.`);
    console.log(`👀 Aperçu du début : "${content.substring(0, 50).replace(/\n/g, ' ')}..."`);

    // 4. Vérifier la longueur
    if (!content || content.trim().length < 5) {
        console.error("⚠️  STOP : Le fichier est considéré comme VIDE ou trop court.");
        return;
    }

    console.log("---------------------------------------------");
    console.log("📥 TRAITEMENT EN COURS...");

    const parts = content.split(/\/\/\s*FILE:\s*/);
    let count = 0;

    parts.forEach(part => {
        if (!part.trim()) return;
        const firstLineEnd = part.indexOf('\n');
        if (firstLineEnd === -1) return;

        let filePath = part.substring(0, firstLineEnd).trim();
        let fileContent = part.substring(firstLineEnd).trim();
        
        filePath = filePath.replace(/\r/g, '');

        if (filePath) {
            const fullPath = path.join(__dirname, filePath);
            const dir = path.dirname(fullPath);
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                fs.writeFileSync(fullPath, fileContent);
                console.log(`✅ ÉCRIT : ${filePath}`);
                count++;
            } catch (e) { console.error(`❌ Erreur : ${e.message}`); }
        }
    });

    if (count > 0) {
        fs.writeFileSync(inputFile, '');
        console.log(`✨ SUCCÈS : ${count} fichiers générés.`);
        console.log(`🗑  update.txt a été vidé.`);
    } else {
        console.log("⚠️  Aucune balise '// FILE:' trouvée dans le texte.");
    }
    console.log("---------------------------------------------");
}

applyUpdate();