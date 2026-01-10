const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config();

async function start() {
    const chokidar = await import('chokidar');
    const versionPath = path.join(__dirname, 'server', 'version.json');
    
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
    }
    
    const DeploySignal = mongoose.model('DeploySignal', new mongoose.Schema({ build: Number, status: String, updatedAt: Date }), 'deploysignals');

    console.log("🚀 [GIT-AUTO] Build System V7 (Full Auto) actif.");

    let isLocked = false;
    let timeout = null;

    function checkDatabaseSignal(targetBuild) {
        console.log(`\n⏳ Build #${targetBuild} envoyé. En attente du signal LIVE de Render...`);
        
        const interval = setInterval(async () => {
            try {
                const signal = await DeploySignal.findOne({});
                if (signal && signal.build === targetBuild && signal.status === 'live') {
                    clearInterval(interval);
                    console.log("\n" + "=".repeat(60));
                    console.log(`✨ [DÉPLOIEMENT TERMINÉ] Ton site est en ligne !`);
                    console.log(`🌍 Version validée : #${targetBuild}`);
                    console.log("=".repeat(60) + "\n");
                    isLocked = false;
                } else {
                    process.stdout.write(`.`); 
                }
            } catch (e) {
                process.stdout.write(`?`);
            }
        }, 4000);
    }

    function runGit() {
        if (isLocked) return;
        isLocked = true;

        let v = { build: 0 };
        try { v = JSON.parse(fs.readFileSync(versionPath, 'utf8')); } catch (e) { v = { build: 0 }; }
        
        v.build++;
        v.timestamp = new Date().toLocaleString('fr-FR');
        fs.writeFileSync(versionPath, JSON.stringify(v, null, 2));

        console.log(`\n📦 [GIT] Auto-Commit Build #${v.build}...`);

        exec(`git add . && git commit -m "Auto-Deploy #${v.build}" && git push`, (err) => {
            if (err) {
                console.log("ℹ️ Rien à pousser.");
                isLocked = false;
                return;
            }
            console.log(`✅ GitHub synchronisé.`);
            DeploySignal.findOneAndUpdate({}, { status: 'deploying', build: v.build }, { upsert: true })
                .then(() => checkDatabaseSignal(v.build));
        });
    }

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist', 'package-lock.json', 'snapshot.txt'],
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('all', (event, filePath) => {
        if (isLocked || filePath.includes('version.json')) return;
        clearTimeout(timeout);
        // On attend 10 secondes de calme (IA qui finit d'écrire) avant de commit
        timeout = setTimeout(runGit, 10000); 
    });
}

start().catch(err => console.error("❌ Erreur Git-Auto:", err));