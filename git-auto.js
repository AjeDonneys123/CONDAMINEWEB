const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const VERSION_FILE = path.join(__dirname, 'server', 'version.json');

async function doPush() {
    let v = { version: "2.1.1", build: 311 };
    try { v = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); } catch(e) {}
    v.build++; v.timestamp = new Date().toISOString();
    fs.writeFileSync(VERSION_FILE, JSON.stringify(v, null, 2));
    exec('git add . && git commit -m "Build #' + v.build + '" && git push');
}
setInterval(doPush, 600000);