const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const getModels = () => ({
    Student: mongoose.model('Student'),
    Classroom: mongoose.model('Classroom'),
    Chapter: mongoose.model('Chapter'),
    Teacher: mongoose.model('Teacher'),
});

// ─────────────────────────────────────────────────────────────
// 1. Infos élèves de la classe (inchangé)
// ─────────────────────────────────────────────────────────────
router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        if (!classId) return res.status(400).json({ error: 'ID de classe manquant' });
        const { Student } = getModels();
        const students = await Student.find({ currentClass: classId })
            .select('firstName lastName nickname email trainingStars')
            .lean();
        res.json({ classId, studentsCount: students.length, students });
    } catch (error) {
        console.error('Error in GET /api/prof/training/class/:classId:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

// ─────────────────────────────────────────────────────────────
// 2. Récupérer l'entraînement actif d'une classe
// ─────────────────────────────────────────────────────────────
router.get('/class/:classId/assignment', async (req, res) => {
    try {
        const { Classroom } = getModels();
        const classroom = await Classroom.findById(req.params.classId).lean();
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        res.json({ assignment: classroom.activeTrainingAssignment || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 3. Définir / mettre à jour l'entraînement d'une classe
// ─────────────────────────────────────────────────────────────
router.put('/class/:classId/assignment', async (req, res) => {
    try {
        const { Classroom } = getModels();
        const classroom = await Classroom.findById(req.params.classId);
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });

        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        // Valider chaque item minimalement
        const cleanItems = items
            .filter(item => item && String(item.id || '').trim())
            .map(item => ({
                id: String(item.id).trim(),
                type: String(item.type || 'local').trim(),      // 'chapter' | 'local' | 'repere'
                title: String(item.title || '').trim(),
                section: String(item.section || '').trim(),     // 'HISTOIRE' | 'GEO' | 'EMC'
                subject: String(item.subject || '').trim(),
            }));

        if (cleanItems.length === 0) {
            // Effacer l'entraînement
            classroom.activeTrainingAssignment = null;
        } else {
            classroom.activeTrainingAssignment = {
                items: cleanItems,
                assignedAt: new Date(),
                teacherId: req.body?.teacherId || null,
            };
        }
        await classroom.save();
        console.info('[CondaWeb training] entraînement défini', {
            classId: String(classroom._id),
            items: cleanItems.length,
        });
        res.json({ ok: true, assignment: classroom.activeTrainingAssignment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 4. Récupérer les chapitres disponibles pour un prof + niveau
//    (utilisé par l'UI prof pour construire la liste d'exos)
// ─────────────────────────────────────────────────────────────
router.get('/chapters', async (req, res) => {
    try {
        const { Chapter, Teacher, Classroom } = getModels();
        const teacherId = String(req.query.teacherId || '').trim();
        const classId   = String(req.query.classId || '').trim();

        if (!teacherId && !classId) return res.json([]);

        let resolvedTeacherId = teacherId;
        let className = String(req.query.className || '').trim();

        if (classId && !className) {
            const cls = await Classroom.findById(classId).lean();
            className = String(cls?.name || '').trim();
        }

        const query = { isArchived: false };
        if (resolvedTeacherId) query.teacherId = resolvedTeacherId;

        const chapters = await Chapter.find(query)
            .select('title section classroom sharedLevel teacherId')
            .lean();

        // Normalise le niveau de la classe (ex: "3E AB DNL" → "3")
        const normalizeLevel = (cls) => String(cls || '').trim().replace(/^(\d).*/, '$1').toUpperCase();
        const classLevel = normalizeLevel(className);

        const filtered = chapters.filter(c => {
            if (String(c.title || '').toUpperCase() === 'GÉNÉRAL') return false;
            if (String(c.section || '').toUpperCase() === 'GÉNÉRAL') return false;
            const chapClass = String(c.classroom || '').trim().toUpperCase();
            const chapLevel = normalizeLevel(c.sharedLevel || '');
            if (chapClass && className) {
                return chapClass === className.toUpperCase() || chapLevel === classLevel;
            }
            if (chapLevel && classLevel) return chapLevel === classLevel;
            return true;
        });

        res.json(filtered.map(c => ({
            _id: String(c._id),
            title: c.title,
            section: c.section,
            classroom: c.classroom,
            sharedLevel: c.sharedLevel,
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 5. Route publique (élève) : lire l'entraînement actif de sa classe
// ─────────────────────────────────────────────────────────────
router.get('/active/:classId', async (req, res) => {
    try {
        const { Classroom } = getModels();
        const classroom = await Classroom.findById(req.params.classId)
            .select('activeTrainingAssignment name')
            .lean();
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        res.json({
            classId: String(classroom._id),
            className: classroom.name || '',
            assignment: classroom.activeTrainingAssignment || null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
