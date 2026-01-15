const fs = require('fs');
setInterval(async () => {
    try {
        const module = await import('clipboardy');
        const text = await module.default.read();
        if (text.includes('[[[£ FILE:')) fs.writeFileSync('update.txt', text);
    } catch (e) {}
}, 2000);