const express = require('express');
const router = express.Router();
const AdminService = require('../../services/admin.service');
const DriveService = require('../../services/drive.service');

router.get('/players', async (req, res) => res.json(await AdminService.getAllPlayers()));
router.get('/drive-check', async (req, res) => res.json(await DriveService.testConnection()));

router.delete('/classroom/:name', async (req, res) => {
    await AdminService.deleteClassroom(req.params.name);
    res.json({ ok: true });
});

router.patch('/teacher/:id/sections', async (req, res) => {
    const updated = await AdminService.updateTeacherSections(req.params.id, req.body.sections);
    res.json(updated);
});

module.exports = router;