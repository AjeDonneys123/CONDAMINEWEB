const path = require('path');
const fs = require('fs');
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

if (!global.fetch) global.fetch = require('node-fetch');
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

console.log("🚀 [SYSTEM] Initialisation Condamine REBOOT...");
const modelsDir = path.join(__dirname, 'models');
const models = ['AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 'Enrollment', 'Chapter', 'Homework', 'Game', 'GameLevel', 'Submission', 'GameProgress', 'MistakesBook', 'AccessLog', 'ProjectDoc', 'BugReport', 'Player'];

models.forEach(m => {
    try {
        const p = path.join(modelsDir, `${m}.js`);
        if (fs.existsSync(p)) require(p);
    } catch (e) {}
});

app.use(express.json({ limit: '100mb' }));

try {
    app.use('/api/auth', require('./domains/auth/auth.routes'));
    app.use('/api/admin', require('./domains/admin/admin.routes'));
    app.use('/api/structure', require('./domains/structure/structure.routes'));
    app.use('/api/games', require('./domains/games/games.routes'));
    app.use('/api/homework', require('./domains/homework/homework.routes')); 
} catch (e) { console.error("❌ Route Error:", e); }

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID, status: "OK" }));
app.get('/panic', (req, res) => res.redirect('/api/admin/panic-ui'));

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ BDD OK'));

const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        if (req.path.startsWith('/api')) return res.status(404).json({ error: "API Not Found" });
        res.sendFile(path.join(distPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send("<h1>Backend OK</h1>"));
}

app.listen(port, '0.0.0.0', () => console.log(`🚀 UP | PORT ${port}`));