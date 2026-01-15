const fs = require('fs');
const path = require('path');

const IGNORE = ['.git', 'node_modules', 'client'];

function cleanEmptyDirs(dir) {
    if (!fs.existsSync(dir)) return;
    const items = fs.readdirSync(dir);
    items.forEach(item => {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory() && !IGNORE.includes(item)) {
            cleanEmptyDirs(fullPath);
        }
    });
    if (dir !== '.' && fs.readdirSync(dir).length === 0) {
        try { fs.rmdirSync(dir); } catch (e) {}
    }
}
cleanEmptyDirs('.');