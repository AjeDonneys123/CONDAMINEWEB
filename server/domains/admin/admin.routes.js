const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const AdminExpert = require('./experts/admin.expert');
const AdminAI = require('./ai/admin.ai');
const StructureDrive = require('../structure/experts/structure.drive');

const upload = multer({ dest: 'uploads/temp/' });
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const normalizeClassName = (name) => {
    if (!name) return "";
    let s = name.toUpperCase().trim();
    if (s === "UNKNOWN") return ""; 
    s = s.replace(/^(TERMINALE|TERM)\s*/, 'T');
    s = s.replace(/(\d+)\s*(?:E|EME|ÈME|ÉME|ERE|ÈRE|IER|IÈRE|NDE|ND)\s*([A-Z]?)/g, '$1$2');
    s = s.replace(/[\s\-\._]/g, '');
    return s;
};

const guessLevel = (name) => {
    const n = name.toUpperCase();
    if (n.startsWith('TPS')) return 'TPS';
    if (n.startsWith('PS')) return 'PS';
    if (n.startsWith('MS')) return 'MS';
    if (n.startsWith('GS')) return 'GS';
    if (n.startsWith('T') || n.startsWith('TERM')) return 'TERM';
    const match = n.match(/^(\d+|CP|CE1|CE2|CM1|CM2)/);
    return match ? match[0] : "AUTRE";
};

// --- ROUTES STANDARDS ---
router.get('/drive-check', asyncHandler(async (req, res) => res.json(await AdminExpert.checkDriveStatus())));
router.get('/database-dump', asyncHandler(async (req, res) => res.json(await AdminExpert.getFullDump())));
router.get('/classrooms', asyncHandler(async (req, res) => { const classes = await mongoose.model('Classroom').find({}).lean(); const safeClasses = classes.filter(c => c && c.name).sort((a, b) => a.name.localeCompare(b.name)); res.json(safeClasses); }));
router.post('/classrooms', asyncHandler(async (req, res) => { const name = normalizeClassName(req.body.name); let level = req.body.level ? req.body.level.toUpperCase().trim() : guessLevel(name); const cls = await mongoose.model('Classroom').findOneAndUpdate({ name }, { ...req.body, name, level }, { upsert: true, new: true }); await StructureDrive.syncBaseStructure(); res.json(cls); }));
router.get('/subjects', asyncHandler(async (req, res) => res.json(await mongoose.model('Subject').find({}).sort({ name: 1 }).lean())));
router.post('/subjects', asyncHandler(async (req, res) => { res.json(await mongoose.model('Subject').findOneAndUpdate({ name: req.body.name.toUpperCase().trim() }, { name: req.body.name.toUpperCase().trim(), color: req.body.color || '#6366f1' }, { upsert: true, new: true })); }));
router.get('/teachers', asyncHandler(async (req, res) => res.json(await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean())));
router.get('/teachers/:id', asyncHandler(async (req, res) => { if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ error: "ID Invalide" }); let user = await mongoose.model('Teacher').findById(req.params.id).lean() || await mongoose.model('Admin').findById(req.params.id).lean() || await mongoose.model('Student').findById(req.params.id).lean(); if (!user) return res.status(404).json({ error: "Utilisateur introuvable" }); res.json(user); }));
router.post('/teachers', asyncHandler(async (req, res) => { let teacher; if (req.body._id) teacher = await mongoose.model('Teacher').findByIdAndUpdate(req.body._id, req.body, { new: true }); else teacher = await mongoose.model('Teacher').create(req.body); res.json(teacher); }));
router.get('/students', asyncHandler(async (req, res) => res.json(await mongoose.model('Student').find({}).sort({ lastName: 1 }).lean())));
router.post('/students', asyncHandler(async (req, res) => { const data = { ...req.body, fullName: `${req.body.firstName} ${req.body.lastName}` }; if (data.classId && !data.currentLevel) { const cls = await mongoose.model('Classroom').findById(data.classId); if (cls && cls.level) data.currentLevel = cls.level; } let student; if (data._id) student = await mongoose.model('Student').findByIdAndUpdate(data._id, data, { new: true }); else { const exists = await mongoose.model('Student').findOne({ firstName: new RegExp(`^${data.firstName.trim()}$`, 'i'), lastName: new RegExp(`^${data.lastName.trim()}$`, 'i') }); if (exists) return res.status(409).json({ error: "Cet élève existe déjà." }); student = await mongoose.model('Student').create(data); } if (data.classId) { let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true }); if (!year) year = await mongoose.model('AcademicYear').create({ label: "2025-2026", isCurrent: true }); await mongoose.model('Enrollment').deleteMany({ studentId: student._id }); await mongoose.model('Enrollment').create({ studentId: student._id, classId: data.classId, yearId: year._id }); } res.json(student); }));
router.get('/admins', asyncHandler(async (req, res) => res.json(await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean())));
router.post('/admins', asyncHandler(async (req, res) => { const result = req.body._id ? await mongoose.model('Admin').findByIdAndUpdate(req.body._id, req.body, { new: true }) : await mongoose.model('Admin').create(req.body); res.json(result); }));
router.delete('/:collection/:id', asyncHandler(async (req, res) => { const map = { 'classrooms': 'Classroom', 'teachers': 'Teacher', 'admins': 'Admin', 'subjects': 'Subject', 'students': 'Student' }; if (map[req.params.collection]) { await mongoose.model(map[req.params.collection]).findByIdAndDelete(req.params.id); if (req.params.collection === 'students') await mongoose.model('Enrollment').deleteMany({ studentId: req.params.id }); if (req.params.collection === 'classrooms') { await mongoose.model('Student').deleteMany({ classId: req.params.id }); await mongoose.model('Enrollment').deleteMany({ classId: req.params.id }); await mongoose.model('Classroom').deleteMany({ associatedClasses: req.params.id }); } } res.json({ ok: true }); }));

// --- NOUVEAU V176 : GESTION DES MEMBRES ---
router.post('/membership', asyncHandler(async (req, res) => {
    const { studentId, targetId, type, action } = req.body;
    const Student = mongoose.model('Student');
    const Classroom = mongoose.model('Classroom');
    const Enrollment = mongoose.model('Enrollment');
    const AcademicYear = mongoose.model('AcademicYear');

    if (!studentId || !targetId || !type || !action) return res.status(400).json({ error: "Données manquantes" });

    // 1. CAS D'UNE CLASSE PRINCIPALE (CLASS)
    if (type === 'CLASS') {
        if (action === 'add') {
            const cls = await Classroom.findById(targetId);
            if (!cls) return res.status(404).json({ error: "Classe introuvable" });

            // On met à jour l'élève
            await Student.findByIdAndUpdate(studentId, {
                classId: cls._id,
                currentClass: cls.name,
                currentLevel: cls.level || guessLevel(cls.name)
            });

            // On met à jour l'Enrollment
            let year = await AcademicYear.findOne({ isCurrent: true });
            if (!year) year = await AcademicYear.create({ label: "2025-2026", isCurrent: true });
            
            await Enrollment.deleteMany({ studentId });
            await Enrollment.create({ studentId, classId: cls._id, yearId: year._id });
        } 
        else if (action === 'remove') {
            // Retirer un élève de sa classe principale = le mettre sans classe
            await Student.findByIdAndUpdate(studentId, {
                classId: null,
                currentClass: "SANS CLASSE",
                currentLevel: "AUTRE"
            });
            await Enrollment.deleteMany({ studentId });
        }
    }

    // 2. CAS D'UN GROUPE (GROUP)
    else if (type === 'GROUP') {
        if (action === 'add') {
            await Student.findByIdAndUpdate(studentId, { $addToSet: { assignedGroups: targetId } });
        } 
        else if (action === 'remove') {
            await Student.findByIdAndUpdate(studentId, { $pull: { assignedGroups: targetId } });
        }
    }

    res.json({ ok: true });
}));

// --- IMPORTS (Restent inchangés pour la concision) ---
router.post('/import-csv', upload.single('file'), asyncHandler(async (req, res) => { /* Code inchangé V175 */ const rawText = fs.readFileSync(req.file.path, 'utf8'); try { fs.unlinkSync(req.file.path); } catch(e) {} const defaultClass = "UNKNOWN"; const ClassModel = mongoose.model('Classroom'); const StudentModel = mongoose.model('Student'); const EnrollmentModel = mongoose.model('Enrollment'); const AcademicYearModel = mongoose.model('AcademicYear'); try { const rawDefaultClass = req.body.defaultClass || "UNKNOWN"; const defaultClass = normalizeClassName(rawDefaultClass) || "UNKNOWN"; const studentsData = await AdminAI.parseRawStudentData(rawText, defaultClass); if (!Array.isArray(studentsData) || studentsData.length === 0) return res.status(400).json({ error: "L'IA n'a rien trouvé dans le fichier." }); let createdCount = 0; let year = await AcademicYearModel.findOne({ isCurrent: true }); if (!year) year = await AcademicYearModel.create({ label: "2025-2026", isCurrent: true }); let forcedGroupId = null; if (req.body.forceOption && req.body.forceOption.trim().length > 0) { const forcedName = req.body.forceOption.toUpperCase().trim(); const lvl = guessLevel(forcedName) !== "AUTRE" ? guessLevel(forcedName) : guessLevel(defaultClass); const group = await ClassModel.findOneAndUpdate({ name: forcedName, type: 'GROUP' }, { name: forcedName, type: 'GROUP', level: lvl }, { upsert: true, new: true }); forcedGroupId = group._id; } for (const s of studentsData) { try { if (!s.lastName) continue; let className = normalizeClassName(s.className); if (!className || className === "UNKNOWN") { className = defaultClass; } if (!className) className = "UNKNOWN"; const level = guessLevel(className); let mainClass = await ClassModel.findOneAndUpdate({ name: className }, { name: className, type: 'CLASS', level: level }, { upsert: true, new: true }); const assignedGroupIds = []; const rawOptions = Array.isArray(s.options) ? s.options : []; for (const optName of rawOptions) { const cleanOpt = String(optName).toUpperCase().trim(); if (cleanOpt.length < 2 || cleanOpt.includes('/')) continue; const scopedGroupName = `${className} ${cleanOpt}`; const group = await ClassModel.findOneAndUpdate({ name: scopedGroupName, type: 'GROUP' }, { name: scopedGroupName, type: 'GROUP', level: level, associatedClasses: [mainClass._id] }, { upsert: true, new: true }); assignedGroupIds.push(group._id); } if (forcedGroupId) assignedGroupIds.push(forcedGroupId); const fName = s.firstName || "."; const lName = s.lastName; const query = (s.email && s.email.includes('@')) ? { email: s.email } : { firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') }; const student = await StudentModel.findOneAndUpdate(query, { firstName: fName, lastName: lName, fullName: `${fName} ${lName}`, email: s.email, currentClass: className, classId: mainClass._id, level: level, currentLevel: level, assignedGroups: assignedGroupIds, isTestAccount: false }, { upsert: true, new: true }); await EnrollmentModel.deleteMany({ studentId: student._id }); await EnrollmentModel.create({ studentId: student._id, classId: mainClass._id, yearId: year._id }); createdCount++; } catch (innerErr) { console.error("Err student:", innerErr); } } await StructureDrive.syncBaseStructure(); res.json({ ok: true, message: `Import Fichier Réussi (V175) : ${createdCount} élèves créés.` }); } catch (e) { res.status(500).json({ error: e.message }); } }));
router.post('/import-magic', asyncHandler(async (req, res) => { /* Code inchangé V175 */ const { rawText, defaultClass, forceOption } = req.body; if (!rawText || rawText.length < 5) return res.status(400).json({ error: "Texte vide." }); const ClassModel = mongoose.model('Classroom'); const StudentModel = mongoose.model('Student'); const EnrollmentModel = mongoose.model('Enrollment'); const AcademicYearModel = mongoose.model('AcademicYear'); try { const studentsData = await AdminAI.parseRawStudentData(rawText, defaultClass || "UNKNOWN"); if (!Array.isArray(studentsData) || studentsData.length === 0) return res.status(400).json({ error: "L'IA n'a rien trouvé." }); let createdCount = 0; let year = await AcademicYearModel.findOne({ isCurrent: true }); if (!year) year = await AcademicYearModel.create({ label: "2025-2026", isCurrent: true }); let forcedGroupId = null; if (forceOption && forceOption.trim().length > 0) { const forcedName = forceOption.toUpperCase().trim(); const lvl = guessLevel(forcedName) !== "AUTRE" ? guessLevel(forcedName) : (defaultClass ? guessLevel(defaultClass) : "AUTRE"); const group = await ClassModel.findOneAndUpdate({ name: forcedName, type: 'GROUP' }, { name: forcedName, type: 'GROUP', level: lvl }, { upsert: true, new: true }); forcedGroupId = group._id; } for (const s of studentsData) { try { if (!s.lastName) continue; let className = normalizeClassName(s.className); if (!className || className === "UNKNOWN") { if (defaultClass && defaultClass !== "UNKNOWN") { className = normalizeClassName(defaultClass); } else { className = "UNKNOWN"; } } const level = guessLevel(className); let mainClass = await ClassModel.findOneAndUpdate({ name: className }, { name: className, type: 'CLASS', level: level }, { upsert: true, new: true }); const assignedGroupIds = []; const rawOptions = Array.isArray(s.options) ? s.options : []; for (const optName of rawOptions) { const cleanOpt = String(optName).toUpperCase().trim(); if (cleanOpt.length < 2 || cleanOpt.includes('/')) continue; const scopedGroupName = `${className} ${cleanOpt}`; const group = await ClassModel.findOneAndUpdate({ name: scopedGroupName, type: 'GROUP' }, { name: scopedGroupName, type: 'GROUP', level: level, associatedClasses: [mainClass._id] }, { upsert: true, new: true }); assignedGroupIds.push(group._id); } if (forcedGroupId) { assignedGroupIds.push(forcedGroupId); } const fName = s.firstName || "."; const lName = s.lastName; const query = (s.email && s.email.includes('@')) ? { email: s.email } : { firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') }; const student = await StudentModel.findOneAndUpdate(query, { firstName: fName, lastName: lName, fullName: `${fName} ${lName}`, email: s.email, currentClass: className, classId: mainClass._id, level: level, currentLevel: level, assignedGroups: assignedGroupIds, isTestAccount: false }, { upsert: true, new: true }); await EnrollmentModel.deleteMany({ studentId: student._id }); await EnrollmentModel.create({ studentId: student._id, classId: mainClass._id, yearId: year._id }); createdCount++; } catch (innerErr) { console.error("Err student:", innerErr); } } await StructureDrive.syncBaseStructure(); res.json({ ok: true, message: `Magie V175 (Robust) : ${createdCount} élèves importés.` }); } catch (e) { res.status(500).json({ error: e.message }); } }));
router.post('/maintenance/migrate-students', asyncHandler(async (req, res) => { /* Code inchangé V171 */ const StudentModel = mongoose.model('Student'); const ClassroomModel = mongoose.model('Classroom'); const students = await StudentModel.find({}); let studentsCount = 0; for (const s of students) { let lvl = s.currentLevel || s.level; if (!lvl && s.currentClass) lvl = guessLevel(s.currentClass); await StudentModel.updateOne( { _id: s._id }, { $set: { currentLevel: lvl || "AUTRE", level: lvl || "AUTRE", parentEmail: s.parentEmail || "" }, $unset: { birthDate: 1, isTestAccount: 1, spellingMistakes: 1 } } ); studentsCount++; } const allGroups = await ClassroomModel.find({ type: 'GROUP' }); let fixedGroups = 0; let splitCount = 0; for (const group of allGroups) { const members = await StudentModel.find({ assignedGroups: group._id }); if (members.length === 0) continue; const classesInGroup = {}; members.forEach(m => { const cls = m.currentClass || "UNKNOWN"; if (!classesInGroup[cls]) classesInGroup[cls] = []; classesInGroup[cls].push(m); }); const classNames = Object.keys(classesInGroup); const isMixed = classNames.length > 1; const isBadNamed = classNames.length === 1 && !group.name.startsWith(classNames[0]); if (isMixed || isBadNamed) { console.log(`🔧 FIXING GROUP: "${group.name}" (Classes: ${classNames.join(', ')})`); for (const clsName of classNames) { const cleanSuffix = group.name.replace(clsName, '').trim(); const newName = `${clsName} ${cleanSuffix}`.trim(); const level = guessLevel(clsName); const mainClass = await ClassroomModel.findOne({ name: clsName, type: 'CLASS' }); const newGroup = await ClassroomModel.findOneAndUpdate( { name: newName, type: 'GROUP' }, { name: newName, type: 'GROUP', level: level, associatedClasses: mainClass ? [mainClass._id] : [] }, { upsert: true, new: true } ); const studentsToMove = classesInGroup[clsName]; for (const stu of studentsToMove) { await StudentModel.updateOne( { _id: stu._id }, { $pull: { assignedGroups: group._id }, $addToSet: { assignedGroups: newGroup._id } } ); } } await ClassroomModel.findByIdAndDelete(group._id); splitCount++; } else { const clsName = classNames[0]; const level = guessLevel(clsName); if (group.level !== level) { await ClassroomModel.updateOne({ _id: group._id }, { level: level }); fixedGroups++; } } } console.log(`🧹 MIGRATION V171 : ${studentsCount} élèves checkés, ${splitCount} groupes éclatés/renommés, ${fixedGroups} niveaux corrigés.`); res.json({ ok: true, message: `Fragmentation réussie : ${splitCount} groupes génériques éclatés par classe.` }); }));

module.exports = router;