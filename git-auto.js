const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function start() {
    const chokidar = await import('chokidar');
    const versionPath = path.join(__dirname, 'server', 'version.json');
    
    // ⚠️ METS TON URL RENDER ICI (SANS LE / À LA FIN)
    const LIVE_URL = "https://condatrainer.onrender.com"; 

    console.log("🚀 [GIT-AUTO] Build System V5 (Anti-Crash) actif.");

    let isWaitingForDeploy = false;

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist', 'package-lock.json'],
        persistent: true,
        ignoreInitial: true
    });

    function checkLiveSite(targetBuild) {
        console.log(`\n⏳ Build #${targetBuild} envoyé. En attente de Render...`);
        
        const interval = setInterval(() => {
            const options = {
                timeout: 3000,
                headers: { 'Cache-Control': 'no-cache' }
            };

            https.get(`${LIVE_URL}/api/deploy-check?t=${Date.now()}`, options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const onlineBuild = parseInt(json.build);

                        if (onlineBuild === targetBuild) {
                            clearInterval(interval);
                            console.log("\n" + "=".repeat(60));
                            console.log(`✨ [DÉPLOIEMENT RÉUSSI] Ton site est à jour (Version #${targetBuild}) !`);
                            console.log(`🌍 URL : ${LIVE_URL}`);
                            console.log("=".repeat(60) + "\n");
                            isWaitingForDeploy = false;
                        } else {
                            process.stdout.write(`\r📡 Vu : #${onlineBuild} (Attente #${targetBuild})... `);
                        }
                    } catch (e) {
                        process.stdout.write(`\r📡 Render prépare la nouvelle version... `);
                    }
                });
            }).on('error', () => {
                process.stdout.write(`\r📡 Redémarrage de Render en cours... `);
            });
        }, 4000);
    }

    function runGit() {
        if (isWaitingForDeploy) return;
        isWaitingForDeploy = true;

        let v = { build: 0 };
        try {
            v = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        } catch (e) { v = { build: 0 }; }
        
        v.build++;
        v.timestamp = new Date().toLocaleString('fr-FR');
        fs.writeFileSync(versionPath, JSON.stringify(v, null, 2));

        console.log(`\n📦 [GIT] Lancement du Build #${v.build}...`);
        const command = `git add . && git commit -m "Auto-Deploy #${v.build}" && git push`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                console.log("ℹ️ Rien à pousser sur GitHub.");
                isWaitingForDeploy = false;
                return;
            }
            console.log(`✅ Push réussi. Build #${v.build} en route.`);
            checkLiveSite(v.build);
        });
    }

    watcher.on('all', (event, filePath) => {
        const ignored = ['version.json', 'update.txt', 'history.txt', 'snapshot.txt'];
        if (ignored.some(f => filePath.includes(f)) || isWaitingForDeploy) return;
        
        setTimeout(runGit, 3000); 
    });
}

start().catch(err => console.error(err));