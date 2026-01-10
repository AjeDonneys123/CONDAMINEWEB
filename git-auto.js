const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

async function start() {
    const chokidar = await import('chokidar');
    const versionPath = path.join(__dirname, 'server', 'version.json');
    
    // ⚠️ REMPLACE PAR TON URL RÉELLE (Vercel ou Render)
    const LIVE_URL = "https://ton-site-condamine.com"; 

    console.log("🚀 [GIT-AUTO] Système de Build Numéroté actif.");

    let timeout = null;
    let isWaitingForDeploy = false;

    const watcher = chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'update.txt', 'history.txt', 'client/dist', 'package-lock.json'],
        persistent: true,
        ignoreInitial: true
    });

    // Fonction de vérification du site en ligne (toutes les 4s)
    function checkLiveSite(targetBuild) {
        process.stdout.write(`\r⏳ Build #${targetBuild} : Déploiement en cours... `);
        
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
                            console.log(`✨ [DÉPLOIEMENT TERMINÉ] La version #${targetBuild} est en ligne !`);
                            console.log(`🌍 URL : ${LIVE_URL}`);
                            console.log(`⏰ Heure : ${new Date().toLocaleTimeString()}`);
                            console.log("=".repeat(60) + "\n");
                            isWaitingForDeploy = false;
                        } else {
                            process.stdout.write(".");
                        }
                    } catch (e) {
                        process.stdout.write("x"); // Reboot serveur
                    }
                });
            }).on('error', () => {
                process.stdout.write("x"); // Connexion perdue
            });
        }, 4000);
    }

    function runGit() {
        if (isWaitingForDeploy) return;
        isWaitingForDeploy = true;

        // 1. Incrémentation du build
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

        // 2. Détection de la branche et Push
        // On utilise 'git push' sans arguments pour utiliser la branche actuelle
        const command = `git add . && git commit -m "${commitMessage}" && git push`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                if (stderr.includes("nothing to commit")) {
                    console.log("ℹ️ [GIT] Aucun changement détecté.");
                    isWaitingForDeploy = false;
                } else {
                    console.error("❌ [GIT ERROR]:", stderr);
                    isWaitingForDeploy = false;
                }
                return;
            }
            console.log(`✅ Push réussi. Build #${v.build} en route vers le cloud.`);
            
            // 3. Lancer la surveillance
            checkLiveSite(v.build);
        });
    }

    watcher.on('all', (event, filePath) => {
        // Sécurité critique : on ignore absolument ces fichiers pour éviter les boucles infinies
        const ignoredFiles = ['version.json', 'update.txt', 'history.txt', 'snapshot.txt'];
        if (ignoredFiles.some(f => filePath.includes(f)) || isWaitingForDeploy) return;
        
        clearTimeout(timeout);
        timeout = setTimeout(runGit, 5000); 
    });
}

start().catch(err => console.error("Erreur lancement git-auto:", err));