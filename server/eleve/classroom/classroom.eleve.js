// @signatures: EleveClassroom, status
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

router.get('/status/:studentId', async (req, res) => {
    res.json(await mongoose.model('Student').findById(req.params.studentId, 'behaviorRecords currentClass seatX seatY').lean());
});

module.exports = router;
