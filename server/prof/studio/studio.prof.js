// @signatures: ProfStudio, projects, save
const express = require('express');
const router = express.Router();
const { StudioProject } = require('../models/prof.models');

router.get('/projects/:userId', async (req, res) => {
    res.json(await StudioProject.find({ teacherId: req.params.userId }).sort({updatedAt:-1}).lean());
});

router.post('/', async (req, res) => {
    const data = req.body;
    if (data._id) return res.json(await StudioProject.findByIdAndUpdate(data._id, data, { new: true }));
    res.json(await StudioProject.create(data));
});

module.exports = router;
