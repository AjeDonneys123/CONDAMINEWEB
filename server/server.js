const path = require('path'); const express = require('express'); const mongoose = require('mongoose');
const fs = require('fs'); const dotenv = require('dotenv');
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
if (!global.fetch) global.fetch = require('node-fetch');

const app = express(); const port = process.env.PORT || 3000;
const SERVER_BOOT_ID = Date.now();

require('./models/Teacher'); require('./models/Player'); require('./models/Chapter');
require('./models/Homework'); require('./models/GameLevel'); require('./models/ScanSession');
require('./models/Submission'); require('./models/Bug'); require('./models/DeploySignal');
require('./models/TeacherStyle');

mongoose.connect(process.env.MONGODB_URI).then(() => console.log('✅ Connected.'));

app.use(express.json({ limit: '50mb' }));
app.use('/api/auth', require('./features/auth/auth.routes'));
app.use('/api/structure', require('./features/structure/structure.routes'));
app.use('/api/games', require('./features/games/games.routes'));
app.use('/api/homework', require('./features/homework/homework.routes'));
app.use('/api', require('./features/admin/admin.routes'));

app.get('/api/check-deploy', (req, res) => res.json({ bootId: SERVER_BOOT_ID }));
app.get('/api/deploy-status', (req, res) => res.json({ version: "2.1.2", build: 312, status: "live" }));

const distPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
}
app.listen(port, () => console.log(`🚀 Port ${port}`));