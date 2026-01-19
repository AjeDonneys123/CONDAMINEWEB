const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const HomeworkAI = require('./ai/homework.ai');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- CONFIG MULTER V6 : NOMMAGE ULTRA-SIMPLIFIÉ ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'public', 'uploads');
        if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // On évite les caractères spéciaux qui cassent les URLs
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `hw-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
    }
});
const upload = multer({ storage });

router.post('/upload', upload.array('files'), (req, res) => {
    // On renvoie le chemin relatif complet pour le proxy
    const urls = req.files.map(f => `/uploads/${f.filename}`);
    res.json({ urls });
});

router.get('/all', asyncHandler(async (req, res) => {
    const items = await mongoose.model('Homework').find({}).sort({ date: -1 }).lean();
    res.json(items);
}));

router.post('/', asyncHandler(async (req, res) => {
    const Homework = mongoose.model('Homework');
    const data = req.body;
    let result;
    if (data._id) {
        result = await Homework.findByIdAndUpdate(data._id, data, { new: true });
    } else {
        result = await Homework.create(data);
    }
    res.json(result);
}));

router.post('/analyze-homework', asyncHandler(async (req, res) => {
    const { userText, homeworkId, levelIndex, playerId } = req.body;
    const homework = await mongoose.model('Homework').findById(homeworkId);
    const lvl = homework.levels[levelIndex];
    const analysis = await HomeworkAI.analyze(userText, lvl.instruction, lvl.aiHints || "");
    
    await mongoose.model('Submission').create({ 
        studentId: playerId, homeworkId, levelIndex, 
        content: userText, feedback: analysis.feedback_fond, grade: analysis.grade 
    });
    res.json(analysis);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
    await mongoose.model('Homework').findByIdAndDelete(req.params.id);
    res.json({ ok: true });
}));

module.exports = router;