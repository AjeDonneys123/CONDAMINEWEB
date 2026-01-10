const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function start() {
    const chokidar = await import('chokidar');
    const versionPath = path.join(__dirname, 'server', 'version.json');
    
    // ⚠️ REMPLACE PAR TON URL RENDER RÉELLE ICI
    const LIVE_URL = "https://condatrainer.onrender.com"; 

    console.log("🚀 [GIT-AUTO] Système de Build Numéroté actif. En attente de changements...");

    let timeout = null;
    let isWaitingForDeploy = false;

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist', 'package-lock.json'],
        persistent: true,
        ignoreInitial: true
    });

    function checkLiveSite(targetBuild) {
        process.stdout.write(`\r⏳ Build #${targetBuild} : Déploiement en cours sur Render... `);
        
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
                            console.log(`✨ [DÉPLOIEMENT RÉUSSI] La version #${targetBuild} est en ligne !`);
                            console.log(`🌍 URL : ${LIVE_URL}`);
                            console.log(`⏰ Heure : ${new Date().toLocaleTimeString()}`);
                            console.log("=".repeat(60) + "\n");
                            isWaitingForDeploy = false;
                        } else {
                            process.stdout.write(".");
                        }
                    } catch (e) {
                        process.stdout.write("x"); 
                    }
                });
            }).on('error', () => {
                process.stdout.write("x");
            });
        }, 4000); // Polling toutes les 4 secondes
    }

    function runGit() {
        if (isWaitingForDeploy) return;
        isWaitingForDeploy = true;

        let v = { build: 0 };
        try {
            const content = fs.readFileSync(versionPath, 'utf8');
            v = JSON.parse(content);
        } catch (e) {
            v = { build: 0 };
        }
        
        v.build++;
        v.timestamp = new Date().toLocaleString('fr-FR');
        fs.writeFileSync(versionPath, JSON.stringify(v, null, 2));

        const commitMessage = `Auto-Deploy #${v.build} - ${v.timestamp}`;
        console.log(`\n📦 [GIT] Création du commit #${v.build}...`);

        const command = `git add . && git commit -m "${commitMessage}" && git push`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.log("ℹ️ [GIT] Aucun changement à pousser.");
                isWaitingForDeploy = false;
                return;
            }
            console.log(`✅ Push réussi vers GitHub. Build #${v.build} lancé.`);
            checkLiveSite(v.build);
        });
    }

    watcher.on('all', (event, filePath) => {
        const ignoredFiles = ['version.json', 'update.txt', 'history.txt', 'snapshot.txt'];
        if (ignoredFiles.some(f => filePath.includes(f)) || isWaitingForDeploy) return;
        
        clearTimeout(timeout);
        timeout = setTimeout(runGit, 5000); 
    });
}

start().catch(err => console.error("Erreur lancement git-auto:", err));