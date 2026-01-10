const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function start() {
    const chokidar = await import('chokidar');
    const versionPath = path.join(__dirname, 'server', 'version.json');
    
    // ⚠️ METS TON URL RÉELLE ICI
    const LIVE_URL = "https://ton-site-condamine.com"; 

    console.log("🚀 [GIT-AUTO] Surveillance active. Prêt pour le build...");

    let timeout = null;
    let isWaitingForDeploy = false;

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist'],
        persistent: true,
        ignoreInitial: true
    });

    function checkLiveSite(targetBuild) {
        process.stdout.write(`\r⏳ Build #${targetBuild} : Déploiement en cours sur le cloud... `);
        
        const interval = setInterval(() => {
            https.get(`${LIVE_URL}/api/deploy-check`, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (json.build === targetBuild) {
                            clearInterval(interval);
                            console.log("\n" + "=".repeat(60));
                            console.log(`✨ [DÉPLOIEMENT RÉUSSI] La version #${targetBuild} est officiellement en ligne !`);
                            console.log(`🌍 URL : ${LIVE_URL}`);
                            console.log(`⏰ Heure : ${new Date().toLocaleTimeString()}`);
                            console.log("=".repeat(60) + "\n");
                            isWaitingForDeploy = false;
                        } else {
                            process.stdout.write("."); // Point de progression
                        }
                    } catch (e) {
                        process.stdout.write("x"); // Serveur en reboot
                    }
                });
            }).on('error', () => {
                process.stdout.write("x"); // Connexion perdue temporairement
            });
        }, 4000); // Polling toutes les 4 secondes
    }

    function runGit() {
        if (isWaitingForDeploy) return;
        isWaitingForDeploy = true;

        // 1. Incrémenter Build
        let v = { build: 0 };
        try { v = JSON.parse(fs.readFileSync(versionPath, 'utf8')); } catch (e) {}
        v.build++;
        v.timestamp = new Date().toLocaleString('fr-FR');
        fs.writeFileSync(versionPath, JSON.stringify(v, null, 2));

        const commitMessage = `Auto-Deploy #${v.build} - ${v.timestamp}`;
        console.log(`\n📦 [GIT] Création du commit #${v.build}...`);

        const command = `git add . && git commit -m "${commitMessage}" && git push`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.log("ℹ️ Rien à pousser sur GitHub.");
                isWaitingForDeploy = false;
                return;
            }
            console.log(`✅ Push réussi. Build #${v.build} envoyé.`);
            checkLiveSite(v.build);
        });
    }

    watcher.on('all', (event, filePath) => {
        // Sécurité : on ignore les fichiers système et de logs
        if (filePath.includes('version.json') || filePath.includes('update.txt') || filePath.includes('history.txt') || isWaitingForDeploy) return;
        
        clearTimeout(timeout);
        timeout = setTimeout(runGit, 5000); // Déclenche après 5s de calme
    });
}

start().catch(err => console.error("Erreur lancement git-auto:", err));