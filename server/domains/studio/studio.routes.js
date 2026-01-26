const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const StudioExpert = require('./experts/studio.expert');
const GameGeneratorAI = require('./ai/game-generator.ai'); // Import direct pour le fix

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const uploadDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir });

router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    const publicUrl = `/uploads/${req.file.filename}`;
    res.json({ url: publicUrl });
});

router.post('/generate-asset', asyncHandler(async (req, res) => {
    const { prompt, type } = req.body;
    const result = await StudioExpert.generateAsset(prompt, type);
    res.json({ ok: true, ...result });
}));

router.post('/remix-asset', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Image requise" });
    const result = await StudioExpert.remixAsset(req.file);
    try { fs.unlinkSync(req.file.path); } catch(e){}
    res.json({ ok: true, ...result });
}));

router.post('/generate-code', asyncHandler(async (req, res) => {
    const { projectId, gameIdea } = req.body;
    const code = await StudioExpert.generateGame(projectId, gameIdea);
    res.json({ ok: true, code });
}));

// --- NOUVELLE ROUTE : FIX CODE ---
router.post('/fix-code', asyncHandler(async (req, res) => {
    const { code, error, instruction } = req.body;
    const fixedCode = await GameGeneratorAI.fixGameCode(code, error, instruction);
    res.json({ ok: true, code: fixedCode });
}));

router.post('/projects', asyncHandler(async (req, res) => {
    const project = await StudioExpert.saveProject(req.body);
    res.json(project);
}));

router.get('/projects/:userId', asyncHandler(async (req, res) => {
    const projects = await StudioExpert.getUserProjects(req.params.userId);
    res.json(projects);
}));

module.exports = router;