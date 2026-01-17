const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const AIEngine = require('../../../core/ai.engine');
const AdminDB = require('../db/admin.db');
const AdminAI = require('../ai/admin.ai');

const AdminExpert = {
    // --- LECTURE ET VISUALISATION ---
    getProjectTree: async () => {
        const ProjectDoc = mongoose.model('ProjectDoc');
        const dbDocs = await ProjectDoc.find({}).lean();
        const dbMap = dbDocs.reduce((acc, d) => ({ ...acc, [d.fileName]: d }), {});
        const buildVisual = (currentDir) => {
            if (!fs.existsSync(currentDir)) return null;
            const name = path.basename(currentDir);
            const stats = fs.statSync(currentDir);
            const isDir = stats.isDirectory();
            return { name, type: isDir ? 'folder' : 'file', children: isDir ? fs.readdirSync(currentDir).map(c => buildVisual(path.join(currentDir, c))).filter(Boolean) : null };
        };
        return buildVisual(process.cwd());
    },
    initTreeFromStaticFile: async () => { return {count:0}; },
    generateFix: async (logs) => { return {ok:false}; },
    getCurrentCode: () => "", 
    systemReset: () => {},
    
    // --- LOGIQUE MÉTIER ---
    createAdminSafe: async (data) => await AdminDB.createItem('Admin', data),
    
    analyzeImportData: async (dataPayload) => {
        // Délègue l'intelligence au fichier IA dédié
        return await AdminAI.extractStudentsFromInput(dataPayload);
    },

    executeImport: async (classId, studentsList) => {
        const results = { added: 0, updated: 0, failed: 0 };
        
        // 1. Année Scolaire
        let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
        if (!year) {
            const now = new Date();
            const startYear = now.getMonth() < 7 ? now.getFullYear() - 1 : now.getFullYear(); 
            year = await mongoose.model('AcademicYear').create({ label: `${startYear}-${startYear + 1}`, isCurrent: true });
        }

        // 2. Identification du Groupe/Classe cible
        const targetClassroom = await mongoose.model('Classroom').findById(classId);
        const targetGroupName = targetClassroom ? targetClassroom.name : "GROUPE_INCONNU";

        for (const s of studentsList) {
            try {
                // Nettoyage
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
                    // Fusion options sans doublons
                    options: s.options ? [...new Set([...(student?.options || []), ...s.options])] : (student?.options || []),
                    healthInfo: s.healthInfo || student?.healthInfo || ""
                };

                if (!student) {
                    // NOUVEAU
                    studentUpdate.currentClass = targetGroupName;
                    studentUpdate.groups = []; 
                    student = await AdminDB.createItem('Student', studentUpdate);
                } else {
                    // EXISTANT : Gestion Multi-Groupes
                    const existingGroups = student.groups || [];
                    if (student.currentClass !== targetGroupName && !existingGroups.includes(targetGroupName)) {
                        studentUpdate.groups = [...existingGroups, targetGroupName];
                    }
                    if (!student.currentClass) studentUpdate.currentClass = targetGroupName;
                    
                    await mongoose.model('Student').findByIdAndUpdate(student._id, studentUpdate);
                    results.updated++;
                }

                const exists = await mongoose.model('Enrollment').findOne({
                    studentId: student._id,
                    classId: classId,
                    yearId: year._id
                });

                if (!exists) {
                    await AdminDB.createItem('Enrollment', {
                        studentId: student._id,
                        classId: classId,
                        yearId: year._id
                    });
                    results.added++;
                }
            } catch (e) { results.failed++; }
        }
        return results;
    },

    // v.32 : TERMINATOR V2 (PURGE INTELLIGENTE)
    totalSyncAndKill: async () => {
        const report = { deleted: 0, kept: 0 };
        const validClassrooms = await mongoose.model('Classroom').find({}).select('name').lean();
        const validNames = validClassrooms.map(c => c.name.toUpperCase().replace(/"/g, '').trim());
        const students = await mongoose.model('Student').find({}).lean();

        for (const s of students) {
            let shouldDelete = false;
            if (!s.currentClass) {
                shouldDelete = true;
            } else {
                const studentClass = s.currentClass.toUpperCase().replace(/"/g, '').trim();
                if (!validNames.includes(studentClass)) shouldDelete = true;
            }

            if (shouldDelete) {
                await mongoose.model('Student').findByIdAndDelete(s._id);
                await mongoose.model('Enrollment').deleteMany({ studentId: s._id });
                report.deleted++;
            } else {
                report.kept++;
            }
        }
        return report;
    },

    resyncEnrollments: async () => { return {}; },
    purgeOrphans: async () => { 
        const result = await mongoose.model('Student').deleteMany({ currentClass: { $exists: false } });
        return { deleted: result.deletedCount };
    }
};

module.exports = AdminExpert;