const express = require('express');
const router = express.Router();
const AdminService = require('../../services/admin.service');
const DriveService = require('../../services/drive.service');

/**
 * ⚙️ ROUTER : ADMINISTRATION (POROSITÉ ZÉRO)
 */

router.get('/players', async (req, res) => {
    try {
        const players = await AdminService.getAllPlayers();
        res.json(players);
    } catch (e) { res.status(500).json([]); }
});

router.get('/database-dump', async (req, res) => {
    try {
        const data = await AdminService.getFullDump();
        res.json(data);
    } catch (e) { res.status(500).json({ error: "Dump impossible" }); }
});

// US#12 : Diagnostic Drive Pro
router.get('/drive-check', async (req, res) => {
    try {
        const status = await DriveService.testConnection();
        res.json(status);
    } catch (e) { res.status(500).json({ ok: false, error: "Drive Inaccessible" }); }
});

router.delete('/classroom/:name', async (req, res) => {
    try {
        const result = await AdminService.deleteClassroom(req.params.name);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/teacher/:id/sections', async (req, res) => {
    try {
        const updated = await AdminService.updateTeacherSections(req.params.id, req.body.sections);
        res.json({ ok: true, user: updated });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;