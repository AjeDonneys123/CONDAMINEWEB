const fs = require('fs');
const path = require('path');

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'build', 'uploads', 'public', '.vscode', 'tests'];
const IGNORE_FILES = ['snapshot.txt', 'structure.txt', 'studio.txt', 'games.txt', 'update.txt', 'history.txt', 'zz.txt', 'tree.txt', 'projectMap.txt', 'package-lock.json', '.DS_Store', '.env'];

function buildTree(dir, prefix = '') {
    let structure = '';
    try {
        const rawItems = fs.readdirSync(dir);
        console.log(`Scanning ${dir}, raw count: ${rawItems.length}`);
        const items = rawItems.filter(i => !IGNORE_DIRS.includes(i) && !IGNORE_FILES.includes(i));
        console.log(`Filtered count for ${dir}: ${items.length}`);
        items.sort();
        items.forEach((item, index) => {
            const isLast = index === items.length - 1;
            const fullPath = path.join(dir, item);
            const isDir = fs.statSync(fullPath).isDirectory();
            structure += prefix + (isLast ? '└── ' : '├── ') + item + (isDir ? '/' : '') + '\n';
            if (isDir) structure += buildTree(fullPath, prefix + (isLast ? '    ' : '│   '));
        });
    } catch (e) { console.error(`Error in ${dir}:`, e.message); }
    return structure;
}

console.log("DEBUG TREE:");
const tree = buildTree(__dirname);
console.log("PRODUCED TREE LENGTH:", tree.length);
console.log(tree.substring(0, 500));
