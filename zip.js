const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

/**
 * SCRIPT : zip.js
 * Commande : node zip
 */

const OUTPUT_FILENAME = 'PROJET_BACKUP.zip';

const filesToInclude = [
    'package.json',
    '.env',
    'apply.js',
    'zip.js',
    'IAReadMe.md',
    'src/server.js',
    'public/index.html',
    'public/style.css',
    'public/js/app.js',
    'public/js/prof/prof.js',
    'public/js/prof/dashboard.js',
    'public/js/eleve/eleve.js',
    'public/js/eleve/devoirs.js',
    'public/js/eleve/jeux.js',
    'public/js/games/ZombieGame.js'
];

async function createZip() {
    console.log(`📦 Compression du projet...`);
    
    if (fs.existsSync(OUTPUT_FILENAME)) {
        fs.unlinkSync(OUTPUT_FILENAME);
    }

    const zip = new AdmZip();
    let count = 0;

    filesToInclude.forEach(file => {
        const filePath = path.join(__dirname, file);
        if (fs.existsSync(filePath)) {
            const zipPath = path.dirname(file);
            const targetFolder = zipPath === '.' ? "" : zipPath;
            zip.addLocalFile(filePath, targetFolder);
            console.log(`✅ ${file}`);
            count++;
        }
    });

    try {
        zip.writeZip(OUTPUT_FILENAME);
        console.log(`\n🚀 Terminé ! ${count} fichiers dans -> ${OUTPUT_FILENAME}\n`);
    } catch (err) {
        console.error(`❌ Erreur :`, err);
    }
}

createZip();


