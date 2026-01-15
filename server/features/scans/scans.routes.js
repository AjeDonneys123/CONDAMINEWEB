const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ScanService = require('../../services/scan.service');

/**
 * 📸 ROUTER : SCANS (POROSITÉ ZÉRO)
 */

router.get('/sessions', async (req, res) => {
    try {
        const sessions = await mongoose.model('ScanSession').find({}).sort({ createdAt: -1 });
        res.json(sessions);
    } catch (e) { res.status(500).json([]); }
});

router.post('/sessions', async (req, res) => {
    try {
        const result = await ScanService.createSession(req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/upload', async (req, res) => {
    try {
        const { sessionId, type, imageBase64 } = req.body;
        // Simulé : L'upload Drive réel se ferait via drive.service
        const driveId = "DRIVE_ID_" + Date.now();
        const result = await ScanService.addCapture(sessionId, type, driveId);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await ScanService.deleteSession(req.params.id);
        res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;