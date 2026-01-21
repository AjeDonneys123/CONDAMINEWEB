const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const AdminExpert = require('./experts/admin.expert');
const StructureDrive = require('../structure/experts/structure.drive');

const upload = multer({ dest: 'uploads/temp/' });
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// --- IMPORT CSV AVEC NIVEAU GROUPES (V157) ---
router.post('/import-csv', upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Aucun fichier reçu" });
    const ClassModel = mongoose.model('Classroom');
    const StudentModel = mongoose.model('Student');
    const EnrollmentModel = mongoose.model('Enrollment');
    const AcademicYearModel = mongoose.model('AcademicYear');

    try {
        const fileName = req.file.originalname;
        const className = fileName.split('.')[0].toUpperCase().trim();
        const guessLevel = (name) => {
            const match = name.match(/^(\d+|TERM|CP|CE1|CE2|CM1|CM2|GS|MS|PS)/);
            return match ? match[0] : "AUTRE";
        };
        const level = guessLevel(className);

        let mainClass = await ClassModel.findOneAndUpdate(
            { name: className },
            { name: className, type: 'CLASS', level: level },
            { upsert: true, new: true }
        );

        const content = fs.readFileSync(req.file.path, 'latin1');
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        let year = await AcademicYearModel.findOne({ isCurrent: true });
        if (!year) year = await AcademicYearModel.create({ label: "2025-2026", isCurrent: true });

        let createdCount = 0;
        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(';');
            if (cols.length < 5) continue;
            const rawName = cols[0].replace(/"/g, '').trim(); 
            const email = cols[4].replace(/"/g, '').trim();
            const genreStr = cols[3] || "";
            if (!rawName) continue;

            let lName = "", fName = "";
            if (rawName.includes(',')) { const parts = rawName.split(','); lName = parts[0].trim(); fName = parts[1].trim(); } 
            else { const parts = rawName.split(' '); if (parts.length >= 2) { lName = `${parts[0]} ${parts[1]}`; fName = parts.slice(2).join(' '); } else { lName = parts[0]; fName = "."; } }
            if(!fName) fName = ".";

            let rawOptions = [cols[12], cols[13], cols[14], cols[15]].join(','); 
            const optionNames = rawOptions.replace(/"/g, '').split(',').map(o => o.trim().toUpperCase()).filter(o => o && o.length > 2 && !o.startsWith('DNL'));
            const assignedGroupIds = [];

            for (const optName of optionNames) {
                if (optName.length > 25 && !optName.startsWith('SPE')) continue; 
                const scopedGroupName = `${className} ${optName}`;
                // V157 : On ajoute level: level ici aussi !
                const group = await ClassModel.findOneAndUpdate(
                    { name: scopedGroupName, type: 'GROUP' },
                    { name: scopedGroupName, type: 'GROUP', level: level, associatedClasses: [mainClass._id] },
                    { upsert: true, new: true }
                );
                assignedGroupIds.push(group._id);
            }

            const query = (email && email.includes('@')) ? { email: email } : { firstName: fName, lastName: lName };
            const student = await StudentModel.findOneAndUpdate(query,
                { firstName: fName, lastName: lName, fullName: `${fName} ${lName}`, email: email, currentClass: className, classId: mainClass._id, level: level, currentLevel: level, assignedGroups: assignedGroupIds, gender: genreStr.includes('Féminin') ? 'F' : 'M', isTestAccount: false },
                { upsert: true, new: true }
            );
            await StudentModel.updateOne({ _id: student._id }, { $unset: { birthDate: 1, isTestAccount: 1 } });
            await EnrollmentModel.deleteMany({ studentId: student._id });
            await EnrollmentModel.create({ studentId: student._id, classId: mainClass._id, yearId: year._id });
            createdCount++;
        }
        try { fs.unlinkSync(req.file.path); } catch(e) {}
        await StructureDrive.syncBaseStructure();
        res.json({ ok: true, message: `${createdCount} élèves importés.` });
    } catch (e) { res.status(500).json({ error: e.message }); }
}));

// (Les autres routes restent inchangées, je les inclus pour le bloc complet)
router.get('/drive-check', asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));
router.get('/database-dump', asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump())));
router.get('/classrooms', asyncHandler(async (req, res) => res.json(await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean())));
const guessLevel = (name) => { const match = name.match(/^(\d+|TERM|CP|CE1|CE2|CM1|CM2|GS|MS|PS)/); return match ? match[0] : "AUTRE"; };
router.post('/classrooms', asyncHandler(async (req, res) => { const name = req.body.name.toUpperCase().trim(); let level = req.body.level ? req.body.level.toUpperCase().trim() : guessLevel(name); const cls = await mongoose.model('Classroom').findOneAndUpdate({ name }, { ...req.body, name, level }, { upsert: true, new: true }); await StructureDrive.syncBaseStructure(); res.json(cls); }));
router.get('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean())));
router.post('/subjects', asyncHandler(async (req, res) => { res.json(await mongoose.model('Subject').findOneAndUpdate({ name: req.body.name.toUpperCase().trim() }, { name: req.body.name.toUpperCase().trim(), color: req.body.color || '#6366f1' }, { upsert: true, new: true })); }));
router.get('/teachers', asyncHandler(async (req, res) => res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean())));
router.get('/teachers/:id', asyncHandler(async (req, res) => { if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: "ID Invalide" }); let user = await mongoose.model('Teacher').findById(req.params.id).lean() || await mongoose.model('Admin').findById(req.params.id).lean() || await mongoose.model('Student').findById(req.params.id).lean(); if (!user) return res.status(404).json({ error: "Utilisateur introuvable" }); res.json(user); }));
router.post('/teachers', asyncHandler(async (req, res) => { let teacher; if (req.body._id) teacher = await mongoose.model('Teacher').findByIdAndUpdate(req.body._id, req.body, { new: true }); else teacher = await mongoose.model('Teacher').create(req.body); res.json(teacher); }));
router.get('/students', asyncHandler(async (req, res) => res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean())));
router.post('/students', asyncHandler(async (req, res) => { const data = { ...req.body, fullName: `${req.body.firstName} ${req.body.lastName}` }; if (data.classId && !data.currentLevel) { const cls = await mongoose.model('Classroom').findById(data.classId); if (cls && cls.level) data.currentLevel = cls.level; } let student; if (data._id) student = await mongoose.model('Student').findByIdAndUpdate(data._id, data, { new: true }); else { const exists = await mongoose.model('Student').findOne({ firstName: new RegExp(`^${data.firstName.trim()}$`, 'i'), lastName: new RegExp(`^${data.lastName.trim()}$`, 'i') }); if (exists) return res.status(409).json({ error: "Cet élève existe déjà." }); student = await mongoose.model('Student').create(data); } if (data.classId) { let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true }); if (!year) year = await mongoose.model('AcademicYear').create({ label: "2025-2026", isCurrent: true }); await mongoose.model('Enrollment').deleteMany({ studentId: student._id }); await mongoose.model('Enrollment').create({ studentId: student._id, classId: data.classId, yearId: year._id }); } res.json(student); }));
router.get('/admins', asyncHandler(async (req, res) => res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean())));
router.post('/admins', asyncHandler(async (req, res) => { const result = req.body._id ? await mongoose.model('Admin').findByIdAndUpdate(req.body._id, req.body, { new: true }) : await mongoose.model('Admin').create(req.body); res.json(result); }));
router.post('/maintenance/migrate-students', asyncHandler(async (req, res) => { const students = await mongoose.model('Student').find({}); let count = 0; for (const s of students) { let lvl = s.currentLevel || s.level; if (!lvl && s.currentClass) lvl = guessLevel(s.currentClass); await mongoose.model('Student').updateOne({ _id: s._id }, { $set: { currentLevel: lvl || "AUTRE", level: lvl || "AUTRE", parentEmail: s.parentEmail || "" }, $unset: { birthDate: 1, isTestAccount: 1, spellingMistakes: 1 } }); count++; } res.json({ ok: true, message: `Base nettoyée : ${count} élèves mis à jour.` }); }));
router.delete('/:collection/:id', asyncHandler(async (req, res) => { const map = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'admins': 'Admin', 'subjects': 'Subject', 'students': 'Student' }; if (map[req.params.collection]) { await mongoose.model(map[req.params.collection]).findByIdAndDelete(req.params.id); if (req.params.collection === 'students') await mongoose.model('Enrollment').deleteMany({ studentId: req.params.id }); if (req.params.collection === 'classrooms') { await mongoose.model('Student').deleteMany({ classId: req.params.id }); await mongoose.model('Enrollment').deleteMany({ classId: req.params.id }); await mongoose.model('Classroom').deleteMany({ associatedClasses: req.params.id }); } } res.json({ ok: true }); }));

module.exports = router;