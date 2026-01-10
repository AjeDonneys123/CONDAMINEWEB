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
    
    const SignalSchema = new mongoose.Schema({ build: Number, status: String, updatedAt: Date });
    const DeploySignal = mongoose.model('DeploySignal', SignalSchema, 'deploysignals');

    console.log("🚀 [GIT-AUTO] Build System V8 (Messages explicites) prêt.");

    let isLocked = false;

    function checkDatabaseSignal(targetBuild) {
        const interval = setInterval(async () => {
            try {
                const signal = await DeploySignal.findOne({});
                if (signal && signal.build === targetBuild && signal.status === 'live') {
                    clearInterval(interval);
                    console.log("\n" + "=".repeat(60));
                    console.log(`✨ [DÉPLOIEMENT RÉUSSI] Build #${targetBuild} est LIVE !`);
                    console.log("=".repeat(60) + "\n");
                    isLocked = false;
                } else if (signal) {
                    process.stdout.write(`\r📡 MongoDB : Vu #${signal.build} (live) | Attente #${targetBuild}... `);
                }
            } catch (e) { process.stdout.write(`\r📡 MongoDB : Connexion... `); }
        }, 4000);
    }

    function runGit() {
        if (isLocked) return;
        isLocked = true;

        let v = { build: 0, message: "Mise à jour automatique" };
        try { 
            v = JSON.parse(fs.readFileSync(versionPath, 'utf8')); 
        } catch (e) {}
        
        const commitMessage = `Build #${v.build} : ${v.message}`;
        console.log(`\n📦 [GIT] ${commitMessage}`);

        exec(`git add . && git commit -m "${commitMessage}" && git push`, (err) => {
            if (err) { console.log("ℹ️ Rien à pousser."); isLocked = false; return; }
            console.log(`✅ GitHub OK. Déploiement en cours...`);
            
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
        setTimeout(runGit, 10000); // 10s de silence avant commit
    });
}

start().catch(err => console.error("❌ Erreur Git-Auto:", err));