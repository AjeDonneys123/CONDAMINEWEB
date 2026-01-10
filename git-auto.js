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
    
    // Définition stricte du modèle de signal
    const SignalSchema = new mongoose.Schema({ build: Number, status: String, updatedAt: Date });
    const DeploySignal = mongoose.models.DeploySignal || mongoose.model('DeploySignal', SignalSchema, 'deploysignals');

    console.log("🚀 [GIT-AUTO] Système Build V7.1 (Signal MongoDB) prêt.");

    let isLocked = false;
    let timeout = null;

    function checkDatabaseSignal(targetBuild) {
        console.log(`\n⏳ Build #${targetBuild} envoyé. Attente du signal LIVE depuis Render...`);
        
        const interval = setInterval(async () => {
            try {
                const signal = await DeploySignal.findOne({});
                if (signal && signal.build === targetBuild && signal.status === 'live') {
                    clearInterval(interval);
                    console.log("\n" + "=".repeat(60));
                    console.log(`✨ [DÉPLOIEMENT RÉUSSI] Ton site est officiellement EN LIGNE !`);
                    console.log(`🌍 Version validée par Render : #${targetBuild}`);
                    console.log(`⏰ Heure : ${new Date().toLocaleTimeString()}`);
                    console.log("=".repeat(60) + "\n");
                    isLocked = false;
                } else {
                    process.stdout.write(`.`); 
                }
            } catch (e) {
                process.stdout.write(`?`);
            }
        }, 5000); // On interroge toutes les 5 secondes
    }

    function runGit() {
        if (isLocked) return;
        isLocked = true;

        let v = { build: 0 };
        try { v = JSON.parse(fs.readFileSync(versionPath, 'utf8')); } catch (e) { v = { build: 0 }; }
        
        v.build++;
        v.timestamp = new Date().toLocaleString('fr-FR');
        fs.writeFileSync(versionPath, JSON.stringify(v, null, 2));

        console.log(`\n📦 [GIT] Création du commit pour le Build #${v.build}...`);

        const command = `git add . && git commit -m "Auto-Deploy #${v.build}" && git push`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.log("ℹ️ Rien à pousser sur GitHub.");
                isLocked = false;
                return;
            }
            console.log(`✅ GitHub synchronisé. Render va commencer la compilation...`);
            
            // On prépare le signal en mode "attente"
            DeploySignal.findOneAndUpdate({}, { status: 'deploying', build: v.build, updatedAt: new Date() }, { upsert: true })
                .then(() => checkDatabaseSignal(v.build));
        });
    }

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist', 'package-lock.json', 'snapshot.txt', 'server/version.json'],
        persistent: true,
        ignoreInitial: true
    });

    watcher.on('all', (event, filePath) => {
        if (isLocked) return;
        clearTimeout(timeout);
        // On attend 15 secondes de silence complet (IA) avant de déclencher
        timeout = setTimeout(runGit, 15000); 
    });
}

start().catch(err => console.error("❌ Erreur Git-Auto:", err));