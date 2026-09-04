const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { Course, CourseSection } = require('../models/prof.models');
const ProfDrive = require('../core/drive.prof');

const SOURCE_SECTION_ID = 'sources';
const slideAnchor = (slide = {}, originalSlideNumber = 0) => {
    const text = String(slide?.text || '').replace(/\s+/g, ' ').trim();
    return {
        objectId: String(slide?.objectId || ''),
        textFingerprint: text ? crypto.createHash('sha256').update(text.toLocaleLowerCase('fr')).digest('hex') : '',
        textExcerpt: text.slice(0, 240),
        originalSlideNumber
    };
};

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
        const visibleRows = rows.filter((course) => {
            if (String(course.targetClassroomId || '') === classId) return true;
            if (String(course.targetScope || 'LEVEL').toUpperCase() !== 'LEVEL') return false;
            return Boolean(selectedLevel) && academicLevel(course.targetLevel || course.targetClassroomName) === selectedLevel;
        });
        const childrenBySource = new Map();
        visibleRows.forEach((course) => {
            const sourceId = String(course.sourceCourseId || '');
            if (!sourceId) return;
            if (!childrenBySource.has(sourceId)) childrenBySource.set(sourceId, []);
            childrenBySource.get(sourceId).push(course);
        });
        const visible = visibleRows.map((course) => {
            const storedSectionId = String(course.courseSectionId || '');
            let mapped = course;
            if (!storedSectionId) mapped = { ...course, courseSectionId: '' };
            else if (storedSectionId === SOURCE_SECTION_ID || storedSectionId.startsWith('level:') || storedSectionId.startsWith('class:')) {
                mapped = { ...course, courseSectionId: storedSectionId };
            } else {
                const legacySection = sectionById.get(storedSectionId);
                mapped = {
                    ...course,
                    courseSectionId: legacySection
                        ? logicalSectionId({ level: selectedLevel, classId, name: legacySection.name })
                        : ''
                };
            }
            if (!course.isSourcePresentation) return mapped;
            const covered = new Set();
            (childrenBySource.get(String(course._id)) || []).forEach((child) => {
                const start = Number(child.sourceStartAnchor?.originalSlideNumber || 0);
                const end = Number(child.sourceEndAnchor?.originalSlideNumber || 0);
                for (let slide = start; slide > 0 && slide <= end; slide += 1) covered.add(slide);
            });
            const total = Number(course.sourceSlideCount || 0);
            return { ...mapped, uncoveredSlideCount: total > 0 ? Math.max(0, total - covered.size) : 0 };
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

router.post('/:id/editor-access', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id).lean();
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const mongoose = require('mongoose');
        let teacher = null;
        if (course.teacherId && mongoose.Types.ObjectId.isValid(String(course.teacherId))) {
            teacher = await mongoose.model('Teacher').findById(course.teacherId, 'email mail').lean()
                || await mongoose.model('Admin').findById(course.teacherId, 'email mail').lean();
        }
        const teacherEmail = String(teacher?.email || teacher?.mail || req.body?.teacherEmail || '').trim().toLowerCase();
        const access = await ProfDrive.grantFileWriterAccess(course.presentationId || course.slidesUrl);
        res.json({ ...access, editUrl: `https://docs.google.com/presentation/d/${access.fileId}/edit?usp=sharing` });
    } catch (error) {
        res.status(Number(error?.response?.status || 500)).json({ error: error.message });
    }
});

router.post('/placements/reorder', async (req, res) => {
    try {
        const placements = (Array.isArray(req.body?.placements) ? req.body.placements : [])
            .map((item, index) => ({
                id: String(item?.id || '').trim(),
                courseSectionId: String(item?.courseSectionId || ''),
                order: Math.max(0, Number.isFinite(Number(item?.order)) ? Number(item.order) : index)
            }))
            .filter((item) => item.id);
        if (!placements.length || placements.length > 500) return res.status(400).json({ error: 'Ordre invalide' });
        await Course.bulkWrite(placements.map((item) => ({
            updateOne: {
                filter: { _id: item.id },
                update: { $set: { courseSectionId: item.courseSectionId, order: item.order } }
            }
        })));
        res.json({ ok: true, placements });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/:id/split', async (req, res) => {
    const createdPresentationIds = [];
    const createdCourseIds = [];
    try {
        const source = await Course.findById(req.params.id).lean();
        if (!source) return res.status(404).json({ error: 'Présentation introuvable' });
        const requestedSourceUrl = String(req.body?.presentationUrl || source.slidesUrl || '').trim();
        if (!extractPresentationId(requestedSourceUrl)) return res.status(400).json({ error: 'Source Google Slides invalide' });
        const preparedSource = await ProfDrive.ensureNativeGoogleSlides(requestedSourceUrl);
        const splitSourceUrl = preparedSource.editUrl;
        const outline = await ProfDrive.getGoogleSlidesOutline(splitSourceUrl);
        const chapters = (Array.isArray(req.body?.chapters) ? req.body.chapters : [])
            .map((chapter, index) => ({
                title: String(chapter?.title || `Chapitre ${index + 1}`).trim().slice(0, 180),
                startSlide: Number(chapter?.startSlide),
                endSlide: Number(chapter?.endSlide)
            }))
            .filter((chapter) => chapter.title);
        if (chapters.length < 1 || chapters.length > 30) {
            return res.status(400).json({ error: 'Crée entre 1 et 30 chapitres.' });
        }
        const ordered = [...chapters].sort((a, b) => a.startSlide - b.startSlide);
        for (let index = 0; index < ordered.length; index += 1) {
            const chapter = ordered[index];
            if (!Number.isInteger(chapter.startSlide) || !Number.isInteger(chapter.endSlide) || chapter.startSlide < 1 || chapter.endSlide < chapter.startSlide) {
                return res.status(400).json({ error: `Plage invalide pour « ${chapter.title} ».` });
            }
            if (index > 0 && chapter.startSlide <= ordered[index - 1].endSlide) {
                return res.status(400).json({ error: 'Deux chapitres ne peuvent pas contenir les mêmes slides.' });
            }
            if (chapter.endSlide > outline.slides.length) return res.status(400).json({ error: `La présentation contient ${outline.slides.length} slides.` });
        }

        const createdRanges = [];
        for (const chapter of ordered) {
            const created = await ProfDrive.createGoogleSlidesRange(
                splitSourceUrl,
                chapter.startSlide,
                chapter.endSlide,
                chapter.title,
                { nameSuffix: '' }
            );
            createdPresentationIds.push(String(created.presentationId || ''));
            createdRanges.push({ chapter, created });
        }

        const sourceId = String(source._id);
        const previousChildren = await Course.find({ sourceCourseId: sourceId }).lean();
        const destinationSectionId = source.isSourcePresentation
            ? String(source.sourceDestinationSectionId || '')
            : String(source.courseSectionId || '');
        const replacements = await Course.insertMany(createdRanges.map(({ chapter, created }, index) => ({
            ...source,
            _id: undefined,
            title: chapter.title,
            description: '',
            slidesUrl: created.editUrl,
            presentationId: created.presentationId,
            embedUrl: `https://docs.google.com/presentation/d/${created.presentationId}/embed?start=false&loop=false&delayms=3000`,
            courseSectionId: destinationSectionId,
            order: Number(source.order || 0) + index,
            publishedUntilSlide: 0,
            overlays: [],
            isSourcePresentation: false,
            sourceCourseId: sourceId,
            sourceDestinationSectionId: '',
            sourceSlideCount: 0,
            sourceStartAnchor: slideAnchor(outline.slides[chapter.startSlide - 1], chapter.startSlide),
            sourceEndAnchor: slideAnchor(outline.slides[chapter.endSlide - 1], chapter.endSlide),
            date: new Date()
        })));
        createdCourseIds.push(...replacements.map((course) => String(course._id)));
        const updatedSource = await Course.findByIdAndUpdate(source._id, { $set: {
            slidesUrl: splitSourceUrl,
            presentationId: String(outline.presentationId || preparedSource.presentationId || ''),
            embedUrl: `https://docs.google.com/presentation/d/${outline.presentationId}/embed?start=false&loop=false&delayms=3000`,
            isSourcePresentation: true,
            isEnabled: false,
            courseSectionId: SOURCE_SECTION_ID,
            sourceDestinationSectionId: destinationSectionId,
            sourceSlideCount: outline.slides.length
        } }, { new: true }).lean();
        await Course.deleteMany({ sourceCourseId: sourceId, _id: { $nin: createdCourseIds } });
        const protectedPresentationIds = new Set([
            String(outline.presentationId || ''),
            ...createdPresentationIds.map(String)
        ].filter(Boolean));
        const obsoletePresentationIds = [...new Set(previousChildren
            .map((course) => String(course.presentationId || extractPresentationId(course.slidesUrl) || ''))
            .filter((id) => id && !protectedPresentationIds.has(id)))];
        const cleanupResults = await Promise.allSettled(obsoletePresentationIds.map((id) => ProfDrive.deleteFile(id)));
        const cleanupFailures = cleanupResults.filter((result) => result.status === 'rejected').length;
        res.status(201).json({
            ok: true,
            source: updatedSource,
            courses: replacements,
            replacedPresentations: obsoletePresentationIds.length - cleanupFailures,
            cleanupFailures
        });
    } catch (error) {
        await Promise.allSettled([
            ...createdPresentationIds.filter(Boolean).map((id) => ProfDrive.deleteFile(id)),
            ...(createdCourseIds.length ? [Course.deleteMany({ _id: { $in: createdCourseIds } })] : [])
        ]);
        const status = Number(error?.status || error?.response?.status || 500);
        res.status(status >= 400 && status < 600 ? status : 500).json({ error: String(error?.message || 'Découpage impossible') });
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

router.patch('/:id/animation', async (req, res) => {
    try {
        const slideNumber = Math.max(1, Math.floor(Number(req.body?.slideNumber || 1)));
        const animationBlock = req.body?.animationBlock && typeof req.body.animationBlock === 'object'
            ? req.body.animationBlock
            : null;
        if (!animationBlock) return res.status(400).json({ error: 'Animation invalide' });
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const animations = Array.isArray(course.presentationAnimations) ? course.presentationAnimations.map((row) => row?.toObject ? row.toObject() : row) : [];
        const next = { slideNumber, animationBlock, updatedAt: new Date() };
        const index = animations.findIndex((row) => Number(row?.slideNumber) === slideNumber);
        if (index >= 0) animations[index] = next;
        else animations.push(next);
        course.presentationAnimations = animations.sort((a, b) => Number(a.slideNumber) - Number(b.slideNumber));
        await course.save();
        res.json(course.toObject());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.patch('/:id/video-sequences', async (req, res) => {
    try {
        const normalizeSequences = (value = []) => (Array.isArray(value) ? value : [])
            .map((item, index) => ({
                id: String(item?.id || `video_${Date.now()}_${index}`),
                name: String(item?.name || `Vidéo ${index + 1}`).trim().slice(0, 160),
                url: String(item?.url || '').trim(),
                driveFileId: String(item?.driveFileId || '').trim(),
                sourceType: ['youtube', 'audio'].includes(String(item?.sourceType || '').trim().toLowerCase())
                    ? String(item.sourceType).trim().toLowerCase()
                    : 'mp4',
                mimeType: String(item?.mimeType || '').trim().slice(0, 100),
                mergeWithNext: false,
                closeAfterSequence: item?.closeAfterSequence === true,
                startSec: Math.max(0, Number(item?.startSec || 0)),
                endSec: Math.max(0, Number(item?.endSec || 0))
            }))
            .filter((item) => item.url);
        const sequences = normalizeSequences(req.body?.sequences);
        const scenes = (Array.isArray(req.body?.scenes) ? req.body.scenes : [])
            .map((scene, sceneIndex) => ({
                id: String(scene?.id || `scene_${Date.now()}_${sceneIndex}`),
                name: String(scene?.name || `Scène ${sceneIndex + 1}`).trim().slice(0, 160),
                sequences: normalizeSequences(scene?.sequences)
            }));
        const normalizeScenes = (value = []) => (Array.isArray(value) ? value : []).map((scene, sceneIndex) => ({
            id: String(scene?.id || `scene_${Date.now()}_${sceneIndex}`),
            name: String(scene?.name || `Scène ${sceneIndex + 1}`).trim().slice(0, 160),
            sequences: normalizeSequences(scene?.sequences)
        }));
        const slides = (Array.isArray(req.body?.slides) ? req.body.slides : []).map((slide, index) => ({
            slideNumber: Math.max(1, Number(slide?.slideNumber || index + 1)),
            scenes: normalizeScenes(slide?.scenes)
        }));
        const row = await Course.findByIdAndUpdate(
            req.params.id,
            { $set: { presentationVideoSequences: sequences, presentationVideoScenes: scenes, presentationVideoSlides: slides } },
            { new: true, runValidators: true }
        ).lean();
        if (!row) return res.status(404).json({ error: 'Cours introuvable' });
        return res.json(row);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/presentation-remote/active', async (req, res) => {
    try {
        const classId = String(req.query.classId || '').trim();
        let course = null;
        if (classId) {
            course = await Course.findOne({ 'presentationRemote.classId': classId, 'presentationRemote.active': true })
                .sort({ 'presentationRemote.updatedAt': -1 }).lean();
        }
        if (!course) {
            course = await Course.findOne({ 'presentationRemote.active': true })
                .sort({ 'presentationRemote.updatedAt': -1 }).lean();
        }
        if (!course) return res.json({ ok: true, active: false });
        const legacySequences = Array.isArray(course.presentationVideoSequences) ? course.presentationVideoSequences : [];
        const legacyScenes = Array.isArray(course.presentationVideoScenes) && course.presentationVideoScenes.length
            ? course.presentationVideoScenes
            : [{ id: 'scene_1', name: 'Scène 1', sequences: legacySequences }];
        const videoSlides = Array.isArray(course.presentationVideoSlides) && course.presentationVideoSlides.length
            ? course.presentationVideoSlides
            : [{ slideNumber: 1, scenes: legacyScenes }];
        return res.json({ ok: true, active: true, courseId: String(course._id), title: course.title, videoSlides, scenes: legacyScenes, sequences: legacySequences, remote: course.presentationRemote || {} });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/presentation-remote/toggle-plan', async (req, res) => {
    try {
        const classId = String(req.body?.classId || '').trim();
        let course = null;
        if (classId) {
            course = await Course.findOne({ 'presentationRemote.classId': classId, 'presentationRemote.active': true })
                .sort({ 'presentationRemote.updatedAt': -1 });
        }
        if (!course) {
            course = await Course.findOne({ 'presentationRemote.active': true })
                .sort({ 'presentationRemote.updatedAt': -1 });
        }
        if (!course && classId) {
            course = await Course.findOne({ targetClassroomId: classId }).sort({ updatedAt: -1 });
        }
        if (!course) {
            course = await Course.findOne({}).sort({ updatedAt: -1 });
        }
        if (!course) return res.status(404).json({ error: 'Aucun cours disponible' });

        const targetClassId = classId || course.presentationRemote?.classId || course.targetClassroomId || '';
        const remote = {
            active: true,
            classId: targetClassId,
            slideIndex: 0,
            sceneIndex: 0,
            sequenceIndex: 0,
            animationVisible: false,
            classPlanVisible: false,
            playVersion: 0,
            ...(course.presentationRemote || {})
        };
        remote.classPlanVisible = !remote.classPlanVisible;
        if (remote.classPlanVisible) remote.animationVisible = false;
        remote.version = Date.now();
        remote.updatedAt = new Date();
        course.presentationRemote = remote;
        course.markModified('presentationRemote');
        await course.save();
        return res.json({ ok: true, active: true, courseId: String(course._id), remote });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/presentation-remote/hide-plan', async (req, res) => {
    try {
        const classId = String(req.body?.classId || '').trim();
        let course = null;
        if (classId) {
            course = await Course.findOne({ 'presentationRemote.classId': classId, 'presentationRemote.active': true })
                .sort({ 'presentationRemote.updatedAt': -1 });
        }
        if (!course) {
            course = await Course.findOne({ 'presentationRemote.active': true })
                .sort({ 'presentationRemote.updatedAt': -1 });
        }
        if (!course) return res.json({ ok: true, active: false });
        if (course.presentationRemote) {
            course.presentationRemote.classPlanVisible = false;
            course.presentationRemote.updatedAt = new Date();
            course.markModified('presentationRemote');
            await course.save();
        }
        const legacySequences = Array.isArray(course.presentationVideoSequences) ? course.presentationVideoSequences : [];
        const legacyScenes = Array.isArray(course.presentationVideoScenes) && course.presentationVideoScenes.length
            ? course.presentationVideoScenes
            : [{ id: 'scene_1', name: 'Scène 1', sequences: legacySequences }];
        const videoSlides = Array.isArray(course.presentationVideoSlides) && course.presentationVideoSlides.length
            ? course.presentationVideoSlides
            : [{ slideNumber: 1, scenes: legacyScenes }];
        return res.json({ ok: true, remote: course.presentationRemote, videoSlides, scenes: legacyScenes, sequences: legacySequences });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/presentation-remote/start', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const classId = String(req.body?.classId || course.targetClassroomId || '').trim();
        await Course.updateMany({ 'presentationRemote.classId': classId, _id: { $ne: course._id } }, { $set: { 'presentationRemote.active': false } });
        const existingRemote = (course.presentationRemote && typeof course.presentationRemote === 'object') ? course.presentationRemote : {};
        const isContinuing = existingRemote.active && String(existingRemote.classId || '') === classId;
        course.presentationRemote = {
            active: true,
            classId,
            slideIndex: isContinuing ? Number(existingRemote.slideIndex || 0) : 0,
            sceneIndex: isContinuing ? Number(existingRemote.sceneIndex || 0) : 0,
            sequenceIndex: isContinuing ? Number(existingRemote.sequenceIndex || 0) : 0,
            sequenceCompleted: isContinuing ? existingRemote.sequenceCompleted === true : false,
            animationVisible: false,
            classPlanVisible: Boolean(existingRemote.classPlanVisible),
            playVersion: Number(existingRemote.playVersion || 0),
            sequenceBuffers: existingRemote.sequenceBuffers || {},
            playerMode: String(req.body?.playerMode || existingRemote.playerMode || 'presentation'),
            version: Date.now(),
            updatedAt: new Date()
        };
        course.markModified('presentationRemote');
        await course.save();
        const legacySequences = Array.isArray(course.presentationVideoSequences) ? course.presentationVideoSequences : [];
        const legacyScenes = Array.isArray(course.presentationVideoScenes) && course.presentationVideoScenes.length
            ? course.presentationVideoScenes
            : [{ id: 'scene_1', name: 'Scène 1', sequences: legacySequences }];
        const videoSlides = Array.isArray(course.presentationVideoSlides) && course.presentationVideoSlides.length
            ? course.presentationVideoSlides
            : [{ slideNumber: 1, scenes: legacyScenes }];
        return res.json({ ok: true, remote: course.presentationRemote, videoSlides, scenes: legacyScenes, sequences: legacySequences });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/presentation-remote/sync', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const remote = course.presentationRemote || { active: true };
        remote.updatedAt = new Date();
        remote.version = Date.now();
        if (req.body?.playerMode) remote.playerMode = String(req.body.playerMode);
        if (Number.isInteger(req.body?.slideIndex)) remote.slideIndex = Math.max(0, Number(req.body.slideIndex));
        if (Number.isInteger(req.body?.sceneIndex)) remote.sceneIndex = Math.max(0, Number(req.body.sceneIndex));
        if (Number.isInteger(req.body?.sequenceIndex)) remote.sequenceIndex = Math.max(0, Number(req.body.sequenceIndex));
        course.presentationRemote = remote;
        course.markModified('presentationRemote');
        await course.save();
        return res.json({ ok: true, remote });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/presentation-remote/stop', async (req, res) => {
    try {
        await Course.findByIdAndUpdate(req.params.id, { $set: { 'presentationRemote.active': false, 'presentationRemote.updatedAt': new Date() } });
        return res.json({ ok: true });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/presentation-remote/buffer-status', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const remote = course.presentationRemote || { active: true };
        const slideIndex = Math.max(0, Number(req.body?.slideIndex ?? remote.slideIndex ?? 0));
        const sceneIndex = Math.max(0, Number(req.body?.sceneIndex ?? remote.sceneIndex ?? 0));
        const sequenceIndex = Math.max(0, Number(req.body?.sequenceIndex ?? remote.sequenceIndex ?? 0));
        const bufferPct = Math.min(100, Math.max(0, Math.round(Number(req.body?.bufferPct || 0))));
        const isReady = req.body?.isReady === true || bufferPct >= 65;
        const currentBuffers = (remote.sequenceBuffers && typeof remote.sequenceBuffers === 'object') ? { ...remote.sequenceBuffers } : {};
        currentBuffers[`${slideIndex}_${sceneIndex}_${sequenceIndex}`] = bufferPct;
        remote.sequenceBuffers = currentBuffers;
        if (Number(remote.slideIndex) === slideIndex && Number(remote.sceneIndex) === sceneIndex && Number(remote.sequenceIndex) === sequenceIndex) {
            remote.isReady = isReady;
            remote.currentBufferPct = bufferPct;
        }
        remote.updatedAt = new Date();
        course.presentationRemote = remote;
        course.markModified('presentationRemote');
        await course.save();
        return res.json({ ok: true, remote });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
});

router.post('/:id/presentation-remote/command', async (req, res) => {
    try {
        const course = await Course.findById(req.params.id);
        if (!course) return res.status(404).json({ error: 'Cours introuvable' });
        const remote = { active: true, slideIndex: 0, sceneIndex: 0, sequenceIndex: 0, animationVisible: false, animationPlaying: false, classPlanVisible: false, playVersion: 0, pauseVersion: 0, googleAnimationVersion: 0, ...(course.presentationRemote || {}) };
        const action = String(req.body?.action || '');
        const slideTotal = Math.max(1, Number(req.body?.slideTotal || 1));
        const storedSlides = Array.isArray(course.presentationVideoSlides) && course.presentationVideoSlides.length
            ? course.presentationVideoSlides
            : [{ slideNumber: 1, scenes: Array.isArray(course.presentationVideoScenes) && course.presentationVideoScenes.length
                ? course.presentationVideoScenes
                : [{ id: 'scene_1', name: 'Scène 1', sequences: Array.isArray(course.presentationVideoSequences) ? course.presentationVideoSequences : [] }] }];
        let currentSlide = storedSlides
            .find((slide) => Number(slide?.slideNumber) === Number(remote.slideIndex || 0) + 1);
        const currentSlideHasSequences = Array.isArray(currentSlide?.scenes)
            && currentSlide.scenes.some((scene) => Array.isArray(scene?.sequences) && scene.sequences.length > 0);
        if (!currentSlideHasSequences) {
            const configuredSlides = storedSlides.filter((slide) => Array.isArray(slide?.scenes)
                && slide.scenes.some((scene) => Array.isArray(scene?.sequences) && scene.sequences.length > 0));
            if (configuredSlides.length === 1 && Number(configuredSlides[0]?.slideNumber) === 1) currentSlide = configuredSlides[0];
        }
        const currentScenes = Array.isArray(currentSlide?.scenes) ? currentSlide.scenes : [];
        const sceneTotal = Math.max(1, currentScenes.length || Number(req.body?.sceneTotal || 1));
        const currentScene = currentScenes[Math.max(0, Math.min(currentScenes.length - 1, Number(remote.sceneIndex || 0)))];
        const currentVideos = Array.isArray(currentScene?.sequences) ? currentScene.sequences : [];
        const storedSequenceTotal = currentVideos.length;
        const sequenceTotal = Math.max(1, storedSequenceTotal || Number(req.body?.sequenceTotal || 1));
        if (action === 'slide_previous') { remote.slideIndex = Math.max(0, Number(remote.slideIndex || 0) - 1); remote.sceneIndex = 0; remote.sequenceIndex = 0; remote.sequenceCompleted = false; remote.animationVisible = false; remote.animationPlaying = false; }
        if (action === 'slide_next') { remote.slideIndex = Math.min(slideTotal - 1, Number(remote.slideIndex || 0) + 1); remote.sceneIndex = 0; remote.sequenceIndex = 0; remote.sequenceCompleted = false; remote.animationVisible = false; remote.animationPlaying = false; }
        if (action === 'animation_toggle') {
            remote.animationVisible = !remote.animationVisible;
            if (!remote.animationVisible) { remote.animationPlaying = false; remote.pauseVersion = Number(remote.pauseVersion || 0) + 1; }
        }
        if (action === 'animation_hide') {
            remote.animationVisible = false;
            remote.animationPlaying = false;
            remote.pauseVersion = Number(remote.pauseVersion || 0) + 1;
        }
        if (action === 'animation_show') remote.animationVisible = true;
        if (action === 'play_pause') {
            if (remote.animationPlaying === true) {
                remote.animationPlaying = false;
                remote.pauseVersion = Number(remote.pauseVersion || 0) + 1;
            } else {
                if (remote.sequenceCompleted === true) {
                    if (Number(remote.sequenceIndex || 0) < sequenceTotal - 1) remote.sequenceIndex = Number(remote.sequenceIndex || 0) + 1;
                    else if (Number(remote.sceneIndex || 0) < sceneTotal - 1) { remote.sceneIndex = Number(remote.sceneIndex || 0) + 1; remote.sequenceIndex = 0; }
                }
                remote.sequenceCompleted = false;
                remote.animationVisible = true;
                remote.animationPlaying = true;
                remote.playVersion = Number(remote.playVersion || 0) + 1;
            }
        }
        if (action === 'google_animation_next' || action === 'google_animation_previous') {
            remote.googleAnimationDirection = action === 'google_animation_previous' ? 'previous' : 'next';
            remote.googleAnimationVersion = Number(remote.googleAnimationVersion || 0) + 1;
        }
        if (action === 'class_plan_toggle') {
            remote.classPlanVisible = !remote.classPlanVisible;
            if (remote.classPlanVisible) remote.animationVisible = false;
        }
        if (action === 'class_plan_hide') remote.classPlanVisible = false;
        if (action === 'play') {
            if (remote.sequenceCompleted === true) {
                if (Number(remote.sequenceIndex || 0) < sequenceTotal - 1) remote.sequenceIndex = Number(remote.sequenceIndex || 0) + 1;
                else if (Number(remote.sceneIndex || 0) < sceneTotal - 1) { remote.sceneIndex = Number(remote.sceneIndex || 0) + 1; remote.sequenceIndex = 0; }
            }
            remote.sequenceCompleted = false;
            remote.playVersion = Number(remote.playVersion || 0) + 1;
            remote.animationVisible = true;
            remote.animationPlaying = true;
        }
        if (action === 'sequence_previous') { remote.sequenceIndex = Math.max(0, Number(remote.sequenceIndex || 0) - 1); remote.sequenceCompleted = false; }
        if (action === 'sequence_next') { remote.sequenceIndex = Math.min(sequenceTotal - 1, Number(remote.sequenceIndex || 0) + 1); remote.sequenceCompleted = false; }
        if (action === 'sequence_select') { remote.sequenceIndex = Math.min(sequenceTotal - 1, Math.max(0, Number(req.body?.sequenceIndex || 0))); remote.sequenceCompleted = false; remote.animationVisible = false; }
        if (action === 'sequence_finished') {
            remote.sequenceCompleted = true;
            remote.animationPlaying = false;
            if (req.body?.closeAfterSequence === true) remote.animationVisible = false;
        }
        if (action === 'scene_select') { remote.sceneIndex = Math.min(sceneTotal - 1, Math.max(0, Number(req.body?.sceneIndex || 0))); remote.sequenceIndex = 0; remote.sequenceCompleted = false; remote.animationVisible = false; }
        if (action === 'scene_previous') { remote.sceneIndex = Math.max(0, Number(remote.sceneIndex || 0) - 1); remote.sequenceIndex = 0; remote.sequenceCompleted = false; remote.animationVisible = false; }
        if (action === 'scene_next') { remote.sceneIndex = Math.min(sceneTotal - 1, Number(remote.sceneIndex || 0) + 1); remote.sequenceIndex = 0; remote.sequenceCompleted = false; remote.animationVisible = false; }
        if (action === 'mode_change') {
            remote.playerMode = String(req.body?.playerMode || 'presentation');
            if (Number.isInteger(req.body?.slideIndex)) remote.slideIndex = Math.max(0, Number(req.body.slideIndex));
            if (Number.isInteger(req.body?.sceneIndex)) remote.sceneIndex = Math.max(0, Number(req.body.sceneIndex));
            if (Number.isInteger(req.body?.sequenceIndex)) remote.sequenceIndex = Math.max(0, Number(req.body.sequenceIndex));
        }
        if (action === 'sync') {
            if (Number.isInteger(req.body?.slideIndex)) remote.slideIndex = Math.max(0, Number(req.body.slideIndex));
            if (Number.isInteger(req.body?.sceneIndex)) remote.sceneIndex = Math.max(0, Number(req.body.sceneIndex));
            if (Number.isInteger(req.body?.sequenceIndex)) remote.sequenceIndex = Math.max(0, Number(req.body.sequenceIndex));
            if (req.body?.playerMode) remote.playerMode = String(req.body.playerMode);
        }
        const activeBufferKey = `${Math.max(0, Number(remote.slideIndex || 0))}_${Math.max(0, Number(remote.sceneIndex || 0))}_${Math.max(0, Number(remote.sequenceIndex || 0))}`;
        remote.currentBufferPct = Math.min(100, Math.max(0, Number(remote.sequenceBuffers?.[activeBufferKey] || 0)));
        remote.isReady = remote.currentBufferPct >= 65;
        remote.version = Date.now();
        remote.updatedAt = new Date();
        course.presentationRemote = remote;
        course.markModified('presentationRemote');
        await course.save();
        return res.json({ ok: true, remote });
    } catch (error) {
        return res.status(500).json({ error: error.message });
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
