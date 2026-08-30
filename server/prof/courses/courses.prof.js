const express = require('express');
const router = express.Router();
const { Course, CourseSection } = require('../models/prof.models');

const normalizeClassKey = (value = '') => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const academicLevel = (value = '') => normalizeClassKey(value).match(/^(6|5|4|3|2|1)/)?.[1] || '';

const logicalSectionId = ({ level = '', classId = '', name = '' } = {}) => {
    const sectionKey = normalizeClassKey(name) || 'SECTION';
    return level
        ? `level:${level}:${sectionKey}`
        : `class:${String(classId || '')}:${sectionKey}`;
};

const classroomsForLevel = async (Classroom, selectedClass) => {
    const level = academicLevel(selectedClass?.level || selectedClass?.name);
    if (!level) return { level: '', classroomIds: [String(selectedClass?._id || '')].filter(Boolean) };
    const classrooms = await Classroom.find({}, '_id name level').lean();
    return {
        level,
        classroomIds: classrooms
            .filter((row) => academicLevel(row.level || row.name) === level)
            .map((row) => String(row._id))
    };
};

const extractPresentationId = (value = '') => {
    const text = String(value || '').trim();
    if (!text) return '';
    const pathMatch = text.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
    if (pathMatch?.[1]) return pathMatch[1];
    const idMatch = text.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
    return idMatch?.[1] || '';
};

const normalizeCourse = (body = {}) => {
    const slidesUrl = String(body.slidesUrl || '').trim();
    const presentationId = extractPresentationId(slidesUrl);
    if (!presentationId) {
        const error = new Error('Lien Google Slides invalide');
        error.statusCode = 400;
        throw error;
    }

    const title = String(body.title || '').trim();
    const targetClassroomId = String(body.targetClassroomId || '').trim();
    if (!title) {
        const error = new Error('Le titre du cours est requis');
        error.statusCode = 400;
        throw error;
    }
    if (!targetClassroomId) {
        const error = new Error('La classe est requise');
        error.statusCode = 400;
        throw error;
    }

    return {
        title,
        description: String(body.description || '').trim(),
        slidesUrl,
        presentationId,
        embedUrl: `https://docs.google.com/presentation/d/${presentationId}/embed?start=false&loop=false&delayms=3000`,
        teacherId: body.teacherId || null,
        targetClassroomId,
        targetClassroomName: String(body.targetClassroomName || '').trim(),
        targetScope: String(body.targetScope || 'LEVEL').toUpperCase() === 'CLASS' ? 'CLASS' : 'LEVEL',
        targetLevel: String(body.targetLevel || '').trim(),
        isEnabled: body.isEnabled !== false,
        courseSectionId: String(body.courseSectionId || '').trim(),
        order: Math.max(0, Number(body.order || 0)),
        publishedUntilSlide: Math.max(0, Math.floor(Number(body.publishedUntilSlide || 0))),
        overlays: Array.isArray(body.overlays) ? body.overlays : []
    };
};

router.get('/', async (req, res) => {
    try {
        const classId = String(req.query.classId || '').trim();
        if (!classId) {
            return res.json(await Course.find({}).sort({ date: -1, createdAt: -1 }).lean());
        }
        const Classroom = require('mongoose').model('Classroom');
        const selectedClass = await Classroom.findById(classId, 'name level').lean();
        if (!selectedClass) return res.status(404).json({ error: 'Classe introuvable' });
        const selectedLevel = academicLevel(selectedClass.level || selectedClass.name);
        const [rows, sections] = await Promise.all([
            Course.find({}).sort({ date: -1, createdAt: -1 }).lean(),
            CourseSection.find({}).lean()
        ]);
        const sectionById = new Map(sections.map((section) => [String(section._id), section]));
        const visible = rows.filter((course) => {
            if (String(course.targetClassroomId || '') === classId) return true;
            if (String(course.targetScope || 'LEVEL').toUpperCase() !== 'LEVEL') return false;
            return Boolean(selectedLevel) && academicLevel(course.targetLevel || course.targetClassroomName) === selectedLevel;
        }).map((course) => {
            const storedSectionId = String(course.courseSectionId || '');
            if (!storedSectionId) return { ...course, courseSectionId: '' };
            if (storedSectionId.startsWith('level:') || storedSectionId.startsWith('class:')) {
                return { ...course, courseSectionId: storedSectionId };
            }
            const legacySection = sectionById.get(storedSectionId);
            return {
                ...course,
                courseSectionId: legacySection
                    ? logicalSectionId({ level: selectedLevel, classId, name: legacySection.name })
                    : ''
            };
        });
        res.json(visible);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/sections/list', async (req, res) => {
    try {
        const classId = String(req.query.classId || '').trim();
        if (!classId) {
            return res.json(await CourseSection.find({}).sort({ order: 1, createdAt: 1 }).lean());
        }
        const Classroom = require('mongoose').model('Classroom');
        const selectedClass = await Classroom.findById(classId, 'name level').lean();
        if (!selectedClass) return res.status(404).json({ error: 'Classe introuvable' });
        const { level, classroomIds } = await classroomsForLevel(Classroom, selectedClass);
        const rows = await CourseSection.find({ targetClassroomId: { $in: classroomIds } }).sort({ order: 1, createdAt: 1 }).lean();
        const sectionsByKey = new Map();
        rows.forEach((row) => {
            const key = normalizeClassKey(row.name);
            if (!key || sectionsByKey.has(key)) return;
            sectionsByKey.set(key, {
                ...row,
                _id: logicalSectionId({ level, classId, name: row.name }),
                sourceSectionId: String(row._id),
                sharedLevel: level
            });
        });
        res.json([...sectionsByKey.values()]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/sections', async (req, res) => {
    try {
        const name = String(req.body?.name || '').trim();
        const targetClassroomId = String(req.body?.targetClassroomId || '').trim();
        if (!name || !targetClassroomId) return res.status(400).json({ error: 'Nom et classe requis' });
        const Classroom = require('mongoose').model('Classroom');
        const selectedClass = await Classroom.findById(targetClassroomId, 'name level').lean();
        if (!selectedClass) return res.status(404).json({ error: 'Classe introuvable' });
        const { level, classroomIds } = await classroomsForLevel(Classroom, selectedClass);
        const levelSections = await CourseSection.find({ targetClassroomId: { $in: classroomIds } }).lean();
        const existing = levelSections.find((row) => normalizeClassKey(row.name) === normalizeClassKey(name));
        if (existing) {
            return res.json({
                ...existing,
                _id: logicalSectionId({ level, classId: targetClassroomId, name: existing.name }),
                sourceSectionId: String(existing._id),
                sharedLevel: level
            });
        }
        const count = await CourseSection.countDocuments({ targetClassroomId });
        const row = await CourseSection.create({ name, targetClassroomId, order: count });
        const plainRow = row.toObject();
        res.status(201).json({
            ...plainRow,
            _id: logicalSectionId({ level, classId: targetClassroomId, name }),
            sourceSectionId: String(plainRow._id),
            sharedLevel: level
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/placement', async (req, res) => {
    try {
        const row = await Course.findByIdAndUpdate(req.params.id, { $set: { courseSectionId: String(req.body?.courseSectionId || ''), order: Math.max(0, Number(req.body?.order || 0)) } }, { new: true }).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', async (req, res) => {
    try {
        const row = await Course.create(normalizeCourse(req.body));
        res.status(201).json(row);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: normalizeCourse(req.body) },
            { new: true, runValidators: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
});

router.patch('/:id/enabled', async (req, res) => {
    try {
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: { isEnabled: req.body?.isEnabled !== false } },
            { new: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/progress', async (req, res) => {
    try {
        const publishedUntilSlide = Math.max(0, Math.floor(Number(req.body?.publishedUntilSlide || 0)));
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: { publishedUntilSlide } },
            { new: true, runValidators: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const row = await Course.findByIdAndDelete(req.params.id).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
