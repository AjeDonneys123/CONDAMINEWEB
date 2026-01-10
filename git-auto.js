const { exec } = require('child_process');

async function start() {
    // Import dynamique pour éviter l'erreur ERR_REQUIRE_ESM avec chokidar 4
    const chokidar = await import('chokidar');
    
    const IGNORED_PATHS = [
        'node_modules', '.git', 'update.txt', 'history.txt',
        'client/dist', '.DS_Store', 'snapshot.txt'
    ];

    console.log("🚀 [GIT-AUTO] Système de déploiement automatique actif...");

    let timeout = null;

    const watcher = chokidar.watch('.', {
        ignored: IGNORED_PATHS,
        persistent: true,
        ignoreInitial: true
    });

    function runGit() {
        const timestamp = new Date().toLocaleString();
        console.log(`📦 [${timestamp}] Changements détectés, synchronisation Git...`);

        // La commande fait l'ajout, le commit et le push
        const command = `git add . && git commit -m "Auto-sync : ${timestamp}" && git push`;

        exec(command, (err, stdout, stderr) => {
            if (err) {
                if (stderr.includes("nothing to commit")) {
                    console.log("ℹ️ Rien à sauvegarder.");
                } else {
                    console.error("❌ Erreur Git:", stderr);
                }
                return;
            }
            console.log("==================================================");
            console.log("✨ [DÉPLOIEMENT] Changements envoyés sur GitHub !");
            console.log("==================================================");
        });
    }

    watcher.on('all', () => {
        clearTimeout(timeout);
        timeout = setTimeout(runGit, 3000); // Sauvegarde 3 secondes après la modif
    });
}

start().catch(err => console.error("Erreur lancement git-auto:", err));