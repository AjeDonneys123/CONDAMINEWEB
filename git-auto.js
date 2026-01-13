const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const VERSION_FILE = path.join(__dirname, 'server', 'version.json');
const DEBOUNCE_TIME = 3000; 
let timeout = null;

function run(cmd) {
    return new Promise((resolve) => {
        exec(cmd, (err, stdout, stderr) => {
            if (err) console.log(`[GIT-ERR] ${stderr}`);
            resolve(stdout);
        });
    });
}

async function doPush() {
    console.log("📦 [GIT-AUTO] Préparation du push...");
    
    // 1. Verif changements
    const status = await run('git status --porcelain');
    if (!status.trim()) return console.log("ℹ️ Aucun changement.");

    // 2. Incremente Build
    let v = { version: "1.1.0", build: 100 };
    try { v = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); } catch(e) {}
    v.build++;
    v.timestamp = new Date().toISOString();
    fs.writeFileSync(VERSION_FILE, JSON.stringify(v, null, 2));

    // 3. Push direct
    console.log(`🚀 Push Build #${v.build}...`);
    await run('git add .');
    await run(`git commit -m "Build #${v.build}"`);
    await run('git push');
    console.log(`✅ Envoyé à Render ! Build #${v.build} en cours de déploiement.`);
}

async function start() {
    const chokidar = await import('chokidar');
    console.log("🤖 Robot Git-Auto prêt.");

    chokidar.watch('.', {
        ignored: ['node_modules', '.git', 'client/dist', 'update.txt', 'apply_status.json', 'server/version.json'],
        persistent: true, ignoreInitial: true
    }).on('all', () => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(doPush, DEBOUNCE_TIME);
    });
}
start();