const fs = require('fs'); const path = require('path');
const IGNORE = ['node_modules', '.git', 'dist', 'update.txt', '.env'];
function capture(dir) {
    let content = "";
    const items = fs.readdirSync(dir).filter(i => !IGNORE.includes(i));
    for (const item of items) {
        const p = path.join(dir, item);
        if (fs.statSync(p).isDirectory()) content += capture(p);
        else if (['.js', '.jsx', '.css', '.json', '.html'].includes(path.extname(item))) {
            content += `\n### FILE: ${item}\n${fs.readFileSync(p, 'utf8')}\n`;
        }
    }
    return content;
}