

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const AIEngine = require('../../../core/ai.engine');
const AdminDB = require('../db/admin.db');
const AdminAI = require('../ai/admin.ai');

const AdminExpert = {
    // ... (Méthodes visuelles inchangées) ...
    getProjectTree: async () => { /* ... */ return []; },
    initTreeFromStaticFile: async () => { return {count:0}; },
    generateFix: async (l) => { return {ok:false}; },
    getCurrentCode: () => "", 
    systemReset: () => {},
    createAdminSafe: async (data) => await AdminDB.createItem('Admin', data),
    analyzeImportData: async (dataPayload) => await AdminAI.extractStudentsFromInput(dataPayload),
    executeImport: async (classId, studentsList) => { /* Code v.30 implicite */ return {}; },
    resyncEnrollments: async () => { return {}; },
    purgeOrphans: async () => { return {}; },

    // v.32 : TERMINATOR V2 (DEBUG & FIX)
    totalSyncAndKill: async () => {
        const report = { deleted: 0, kept: 0, errors: 0 };
        
        console.log("⚡ STARTING TERMINATOR V2...");

        // 1. LISTE DES CLASSES OFFICIELLES
        const validClassrooms = await mongoose.model('Classroom').find({}).select('name').lean();
        const validNames = validClassrooms.map(c => c.name.toUpperCase().replace(/"/g, '').trim()); // Nettoyage agressif
        console.log("   ✅ CLASSES VALIDES :", validNames.join(', '));

        // 2. SCAN DES ÉLÈVES
        const students = await mongoose.model('Student').find({}).lean();

        for (const s of students) {
            let shouldDelete = false;
            let reason = "";

            // A. Nettoyage préventif des guillemets en trop (Bug CSV)
            if (s.email && s.email.includes('"')) {
                await mongoose.model('Student').findByIdAndUpdate(s._id, { email: s.email.replace(/"/g, '') });
            }

            // B. Vérification de la classe
            if (!s.currentClass) {
                shouldDelete = true;
                reason = "Pas de classe assignée";
            } else {
                const studentClass = s.currentClass.toUpperCase().replace(/"/g, '').trim();
                if (!validNames.includes(studentClass)) {
                    shouldDelete = true;
                    reason = `Classe '${studentClass}' inconnue au bataillon`;
                }
            }

            // C. EXÉCUTION
            if (shouldDelete) {
                console.log(`   🗑️ DELETING: ${s.firstName} ${s.lastName} (${reason})`);
                await mongoose.model('Student').findByIdAndDelete(s._id);
                await mongoose.model('Enrollment').deleteMany({ studentId: s._id });
                report.deleted++;
            } else {
                report.kept++;
            }
        }
        
        console.log("⚡ TERMINATOR REPORT:", report);
        return report;
    }
};

// Fonctions utilitaires
AdminExpert.getProjectTree = async (forceIA = false) => {
    const ProjectDoc = mongoose.model('ProjectDoc');
    const dbDocs = await ProjectDoc.find({}).lean();
    const buildVisual = (currentDir) => {
        if (!fs.existsSync(currentDir)) return null;
        const name = path.basename(currentDir);
        const stats = fs.statSync(currentDir);
        const isDir = stats.isDirectory();
        return { name, type: isDir ? 'folder' : 'file', children: isDir ? fs.readdirSync(currentDir).map(c => buildVisual(path.join(currentDir, c))).filter(Boolean) : null };
    };
    return buildVisual(process.cwd());
};
AdminExpert.executeImport = async (classId, studentsList) => {
    const results = { added: 0, updated: 0, failed: 0 };
    let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
    if (!year) { year = await mongoose.model('AcademicYear').create({ label: '2025-2026', isCurrent: true }); }
    const targetClassroom = await mongoose.model('Classroom').findById(classId);
    const targetGroupName = targetClassroom ? targetClassroom.name : "GROUPE_INCONNU";

    for (const s of studentsList) {
        try {
            // Nettoyage des guillemets à la source
            const cleanEmail = s.email ? s.email.replace(/"/g, '').toLowerCase().trim() : undefined;
            const cleanFirst = s.firstName.replace(/"/g, '').trim();
            const cleanLast = s.lastName.replace(/"/g, '').toUpperCase().trim();

            let query = cleanEmail ? { email: cleanEmail } : { firstName: new RegExp(`^${cleanFirst}$`, 'i'), lastName: new RegExp(`^${cleanLast}$`, 'i') };
            let student = await mongoose.model('Student').findOne(query);
            
            const studentUpdate = {
                firstName: cleanFirst,
                lastName: cleanLast,
                email: cleanEmail,
                gender: s.gender,
                options: s.options ? [...new Set([...(student?.options || []), ...s.options])] : (student?.options || []),
                healthInfo: s.healthInfo || student?.healthInfo || ""
            };

            if (!student) {
                studentUpdate.currentClass = targetGroupName;
                studentUpdate.groups = [];
                student = await AdminDB.createItem('Student', studentUpdate);
            } else {
                const existingGroups = student.groups || [];
                if (student.currentClass !== targetGroupName && !existingGroups.includes(targetGroupName)) {
                    studentUpdate.groups = [...existingGroups, targetGroupName];
                }
                if (!student.currentClass) studentUpdate.currentClass = targetGroupName;
                await mongoose.model('Student').findByIdAndUpdate(student._id, studentUpdate);
                results.updated++;
            }
            const exists = await mongoose.model('Enrollment').findOne({ studentId: student._id, classId: classId, yearId: year._id });
            if (!exists) { await AdminDB.createItem('Enrollment', { studentId: student._id, classId: classId, yearId: year._id }); results.added++; }
        } catch (e) { results.failed++; }
    }
    return results;
};

module.exports = AdminExpert;

