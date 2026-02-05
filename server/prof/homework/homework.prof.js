// @signatures: ProfHomeworkRouter, listAll, upload, save
const express = require('express');
const router = express.Router();
const { Homework, Chapter } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: path.join(process.cwd(), 'public', 'uploads', 'temp') });
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/all', asyncHandler(async (req, res) => {
    const list = await Homework.find({}).sort({ date: -1 }).lean();
    res.json(list);
}));

router.post('/upload', upload.array('files'), asyncHandler(async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: "Fichier manquant" });
    const urls = [];
    try {
        const folderId = await ProfDrive.getOrCreateFolder("CONDA_HOMEWORK_ASSETS");
        for (const file of req.files) {
            const driveFile = await ProfDrive.uploadFile(file.originalname, file.path, folderId);
            const proxyUrl = `/api/structure/proxy/${driveFile.id}`;
            urls.push(proxyUrl);
            try { fs.unlinkSync(file.path); } catch(e) {}
        }
        res.json({ urls });
    } catch (e) { res.status(500).json({ error: "Erreur Drive." }); }
}));

// --- SAUVEGARDE ATOMIQUE (1 DOC = 1 CLASSE) ---
router.post('/', asyncHandler(async (req, res) => {
    console.log("------------------------------------------------");
    console.log("📥 [SERVER] SAUVEGARDE ATOMIQUE");
    
    const data = { ...req.body };
    const teacherId = data.teacherId;

    // 1. Nettoyage ID pour Create/Update
    if (!data._id || data._id === "" || data._id === "null") delete data._id;

    // 2. Fallback Chapitre
    if (!data.chapterId || !mongoose.Types.ObjectId.isValid(data.chapterId)) {
        let fallback = await Chapter.findOne({ teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        if (!fallback && teacherId) fallback = await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId });
        data.chapterId = fallback._id;
    }

    // 3. LOGIQUE CRITIQUE : IS_ALL_CLASS VS INDIVIDUEL
    // Si isAllClass est true, on GARANTIT que le tableau est vide.
    if (data.isAllClass === true || (Array.isArray(data.assignedStudents) && data.assignedStudents.length === 0)) {
        data.isAllClass = true;
        data.assignedStudents = [];
        console.log(`   🏫 CLASSE [${data.targetClassrooms[0]}] : MODE GÉNÉRAL`);
    } else {
        data.isAllClass = false;
        console.log(`   👤 CLASSE [${data.targetClassrooms[0]}] : MODE GROUPE (${data.assignedStudents.length} élèves)`);
    }

    try {
        let result;
        if (data._id) {
            // Update avec écrasement complet des champs d'assignation
            result = await Homework.findByIdAndUpdate(data._id, { 
                $set: {
                    title: data.title,
                    isPunishment: data.isPunishment,
                    targetClassrooms: data.targetClassrooms,
                    assignedStudents: data.assignedStudents,
                    isAllClass: data.isAllClass,
                    chapterId: data.chapterId,
                    levels: data.levels,
                    subject: data.subject || "GÉNÉRAL"
                }
            }, { new: true, runValidators: true });
        } else {
            result = await Homework.create(data);
        }
        res.json(result);
    } catch (e) {
        console.error("   💥 CRASH:", e.message);
        res.status(500).json({ error: "Erreur DB", details: e.message });
    }
}));

module.exports = router;
