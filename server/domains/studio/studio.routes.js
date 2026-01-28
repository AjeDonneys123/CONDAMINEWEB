// @signatures: DELETE /:id, GET /:id, GET /projects/:userId, POST /, POST /fix-code, POST /generate-asset, POST /generate-game, POST /remix-asset
const express = require('express');
const router = express.Router();
const StudioExpert = require('./experts/studio.expert');
const StudioDB = require('./db/studio.db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const tempDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
const upload = multer({ dest: tempDir });

router.get('/projects/:userId', asyncHandler(async (req, res) => {
    res.json(await StudioExpert.getUserProjects(req.params.userId));
}));

router.get('/:id', asyncHandler(async (req, res) => {
    const project = await StudioDB.findProjectById(req.params.id);
    if (!project) return res.status(404).json({ error: "Project not found" });
    res.json(project);
}));

router.post('/', asyncHandler(async (req, res) => {
    res.json(await StudioExpert.saveProject(req.body));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await StudioDB.deleteProject(req.params.id);
    res.json({ ok: true });
}));

// ASSETS & IA
router.post('/generate-asset', asyncHandler(async (req, res) => {
    const { prompt, type } = req.body;
    const result = await StudioExpert.generateAsset(prompt, type || 'character');
    res.json(result);
}));

router.post('/remix-asset', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Fichier manquant" });
    const result = await StudioExpert.remixAsset(req.file);
    try { fs.unlinkSync(req.file.path); } catch(e) {}
    res.json(result);
}));

router.post('/generate-game', asyncHandler(async (req, res) => {
    const { projectId, gameIdea } = req.body;
    const result = await StudioExpert.generateGame(projectId, gameIdea);
    res.json(result);
}));

router.post('/fix-code', asyncHandler(async (req, res) => {
    const { code, errorLog, userInstruction } = req.body;
    const result = await StudioExpert.fixCode(code, errorLog, userInstruction);
    res.json(result);
}));

module.exports = router;
