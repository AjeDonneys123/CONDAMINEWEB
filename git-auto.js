// @signatures: doPush
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const VERSION_FILE = path.join(__dirname, 'server', 'version.json');

async function doPush() {
    let v = { build: 195 };
    try { v = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8')); } catch(e) {}
    
    // INCREMENTATION SIMPLE
    v.build++;
    
    fs.writeFileSync(VERSION_FILE, JSON.stringify(v, null, 2));
    exec('git add . && git commit -m "Auto-Save Build #' + v.build + '" && git push');
}
setInterval(doPush, 600000);
