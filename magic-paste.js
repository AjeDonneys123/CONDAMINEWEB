const fs = require('fs');
let lastContent = "";
setInterval(async () => {
    try {
        const module = await import('clipboardy');
        const text = await module.default.read();
        if (text.includes('[[[£ FILE:') && text !== lastContent) {
            fs.writeFileSync('update.txt', text);
            lastContent = text;
            console.log("📋 Flux de code Condamine capturé.");
        }
    } catch (e) {}
}, 2000);