const express = require('express');
const mongoose = require('mongoose');
require('../../prof/models/prof.models');

const router = express.Router();

const normalizeClassKey = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

const academicLevel = (value = '') => {
    const match = normalizeClassKey(value).match(/^(6|5|4|3|2|1)/);
    return match ? match[1] : '';
};

router.get('/list/:studentId', async (req, res) => {
    try {
        const Student = mongoose.model('Student');
        const Classroom = mongoose.model('Classroom');
        const Course = mongoose.model('Course');

        const isVisitor = req.query?.visitor === '1';
        const visitorLevel = academicLevel(req.query?.level);
        const student = isVisitor
            ? { currentClass: req.query?.level || '', assignedGroups: [] }
            : await Student.findById(req.params.studentId, 'currentClass classId assignedGroups').lean();
        if (!student) return res.status(404).json({ error: 'Élève introuvable' });

        const classIds = new Set();
        const classKeys = new Set();
        const addClassId = (value) => {
            const id = String(value || '').trim();
            if (id) classIds.add(id);
        };
        const addClassKey = (value) => {
            const key = normalizeClassKey(value);
            if (key) classKeys.add(key);
        };

        addClassKey(student.currentClass);
        addClassId(student.classId);
        const studentLevel = academicLevel(student.currentClass);

        const lookupIds = [];
        if (student.classId && mongoose.Types.ObjectId.isValid(String(student.classId))) {
            lookupIds.push(student.classId);
        }
        (Array.isArray(student.assignedGroups) ? student.assignedGroups : []).forEach((group) => {
            const id = String(group?._id || group || '').trim();
            if (id) addClassId(id);
            if (mongoose.Types.ObjectId.isValid(id)) lookupIds.push(id);
            else addClassKey(id);
        });

        if (lookupIds.length > 0) {
            const classrooms = await Classroom.find({ _id: { $in: lookupIds } }, 'name').lean();
            classrooms.forEach((cls) => addClassKey(cls?.name));
        }

        // Certains anciens élèves n'ont pas classId, alors que currentClass est correct.
        // On rattache aussi les identifiants des classes portant le même nom.
        const allClasses = await Classroom.find({}, '_id name').lean();
        const classNameById = new Map(allClasses.map((cls) => [String(cls._id), String(cls.name || '')]));
        if (classKeys.size > 0) {
            allClasses.forEach((cls) => {
                if (classKeys.has(normalizeClassKey(cls?.name))) addClassId(cls?._id);
            });
        }

        const courses = await Course.find({ isEnabled: { $ne: false } }).sort({ date: -1, createdAt: -1 }).lean();
        const visible = courses
            .filter((course) => {
                const targetId = String(course?.targetClassroomId || '').trim();
                const targetName = course?.targetClassroomName || classNameById.get(targetId) || '';
                if (isVisitor) return Boolean(visitorLevel) && academicLevel(targetName) === visitorLevel;
                const exactClassMatch = classIds.has(targetId) || classKeys.has(normalizeClassKey(targetName));
                const sameAcademicLevel = Boolean(studentLevel) && academicLevel(targetName) === studentLevel;
                return exactClassMatch || sameAcademicLevel;
            })
            .map((course) => ({
                _id: String(course._id),
                title: course.title || 'Cours',
                description: course.description || '',
                presentationId: course.presentationId || '',
                slidesUrl: course.slidesUrl || '',
                embedUrl: course.embedUrl || (course.presentationId ? `https://docs.google.com/presentation/d/${course.presentationId}/embed?start=false&loop=false&delayms=3000` : ''),
                publishedUntilSlide: Math.max(0, Math.floor(Number(course.publishedUntilSlide || 0))),
                updatedAt: course.updatedAt || course.date || course.createdAt || null
            }))
            .filter((course) => course.presentationId && course.embedUrl)
            .sort((a, b) => String(a.title || '').localeCompare(String(b.title || ''), 'fr', { numeric: true, sensitivity: 'base' }));

        res.json(visible);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
