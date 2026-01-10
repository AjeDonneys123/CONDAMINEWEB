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
    
    // On utilise le même modèle que le serveur
    const SignalSchema = new mongoose.Schema({ build: Number, status: String, updatedAt: Date });
    const DeploySignal = mongoose.model('DeploySignal', SignalSchema, 'deploysignals');

    console.log("🚀 [GIT-AUTO] Build System V7.2 (Radar MongoDB) actif.");

    let isLocked = false;
    let timeout = null;

    function checkDatabaseSignal(targetBuild) {
        console.log(`\n⏳ Build #${targetBuild} envoyé. Surveillance du signal secret...`);
        
        const interval = setInterval(async () => {
            try {
                const signal = await DeploySignal.findOne({});
                if (signal) {
                    if (signal.build === targetBuild && signal.status === 'live') {
                        clearInterval(interval);
                        console.log("\n" + "=".repeat(60));
                        console.log(`✨ [DÉPLOIEMENT TERMINÉ] Build #${targetBuild} est LIVE !`);
                        console.log(`⏰ Heure : ${new Date().toLocaleTimeString()}`);
                        console.log("=".repeat(60) + "\n");
                        isLocked = false;
                    } else {
                        // RADAR : Affiche la version vue en temps réel
                        process.stdout.write(`\r📡 MongoDB : Vu #${signal.build} (${signal.status}) | Attente #${targetBuild}... `);
                    }
                }
            } catch (e) {
                process.stdout.write(`\r📡 MongoDB : En attente de connexion... `);
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

        console.log(`\n📦 [GIT] Commit Build #${v.build}...`);

        exec(`git add . && git commit -m "Auto-Deploy #${v.build}" && git push`, (err) => {
            if (err) { console.log("ℹ️ Rien à pousser."); isLocked = false; return; }
            console.log(`✅ GitHub OK. Render va déployer le Build #${v.build}.`);
            
            // On prévient la DB qu'on attend le nouveau build
            DeploySignal.findOneAndUpdate({}, { status: 'deploying', build: v.build - 1 }, { upsert: true })
                .then(() => checkDatabaseSignal(v.build));
        });
    }

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist', 'package-lock.json', 'snapshot.txt', 'server/version.json'],
        persistent: true, ignoreInitial: true
    });

    watcher.on('all', (event, filePath) => {
        if (isLocked) return;
        clearTimeout(timeout);
        timeout = setTimeout(runGit, 10000); 
    });
}

start().catch(err => console.error("❌ Erreur Git-Auto:", err));