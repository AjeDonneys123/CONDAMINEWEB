const mongoose = require('mongoose');
const AdminDB = require('../db/admin.db');
const AdminAI = require('../ai/admin.ai');
const DriveEngine = require('../../../core/drive.engine');
const fs = require('fs');
const path = require('path');

const AdminExpert = {
    // --- IMPORTATION ---
    analyzeImportData: async (payload) => {
        if (payload.type === 'classes') {
            return await AdminAI.extractClassesFromInput(payload);
        }
        return await AdminAI.extractStudentsFromInput(payload);
    },

    executeImport: async (classId, data, type) => {
        const results = { added: 0, updated: 0, failed: 0 };
        
        // CAS IMPORT CLASSES
        if (type === 'classes') {
            let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
            if (!year) year = await mongoose.model('AcademicYear').create({ label: "2024-2025", isCurrent: true });
            
            for (const cls of data) {
                try {
                    const name = cls.name.toUpperCase().trim();
                    let existing = await mongoose.model('Classroom').findOne({ name });
                    if (!existing) {
                        await AdminDB.createItem('Classroom', { name, type: cls.type || 'CLASS', yearId: year._id });
                        results.added++;
                    } else {
                        results.updated++;
                    }
                } catch(e) { results.failed++; }
            }
            return results;
        }

        // CAS IMPORT ÉLÈVES
        const targetClassroom = await mongoose.model('Classroom').findById(classId);
        const targetGroupName = targetClassroom ? targetClassroom.name : "GROUPE_INCONNU";
        let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
        
        for (const s of data) {
            try {
                const cleanEmail = s.email ? s.email.replace(/"/g, '').toLowerCase().trim() : undefined;
                const cleanFirst = s.firstName.replace(/"/g, '').trim();
                const cleanLast = s.lastName.replace(/"/g, '').toUpperCase().trim();

                let query = cleanEmail ? { email: cleanEmail } : { firstName: new RegExp(`^${cleanFirst}$`, 'i'), lastName: new RegExp(`^${cleanLast}$`, 'i') };
                let student = await mongoose.model('Student').findOne(query);
                
                const studentUpdate = {
                    firstName: cleanFirst, lastName: cleanLast, email: cleanEmail, gender: s.gender,
                    options: s.options || [], healthInfo: s.healthInfo || "",
                    fullName: `${cleanFirst} ${cleanLast}`
                };

                if (!student) {
                    studentUpdate.currentClass = targetGroupName;
                    student = await AdminDB.createItem('Student', studentUpdate);
                } else {
                    if (!student.currentClass) studentUpdate.currentClass = targetGroupName;
                    await mongoose.model('Student').findByIdAndUpdate(student._id, studentUpdate);
                    results.updated++;
                }

                const exists = await mongoose.model('Enrollment').findOne({ studentId: student._id, classId: classId, yearId: year._id });
                if (!exists) {
                    await AdminDB.createItem('Enrollment', { studentId: student._id, classId: classId, yearId: year._id });
                    results.added++;
                }
            } catch (e) { results.failed++; }
        }
        return results;
    },
    
    // --- SYSTEM & DRIVE ---
    getProjectTree: async () => {
        const root = process.cwd();
        const ignore = ['node_modules', '.git', 'dist', 'build', '.env', 'package-lock.json', '.DS_Store', 'update.txt', 'apply_status.json'];
        
        const scan = (dir) => {
            const name = path.basename(dir);
            let stats;
            try { stats = fs.statSync(dir); } catch(e) { return null; }
            
            const node = { 
                name, 
                type: stats.isDirectory() ? 'folder' : 'file', 
                path: path.relative(root, dir).replace(/\\/g, '/'),
                size: stats.size,
                desc: "" 
            };
            
            if (stats.isDirectory()) {
                try {
                    const items = fs.readdirSync(dir).filter(x => !ignore.includes(x));
                    node.children = items.map(i => scan(path.join(dir, i))).filter(x => x !== null);
                    node.children.sort((a, b) => {
                         if (a.type === b.type) return a.name.localeCompare(b.name);
                         return a.type === 'folder' ? -1 : 1;
                    });
                } catch(e) { node.children = []; }
            }
            return node;
        };
        
        return scan(root);
    },

    checkDriveStatus: async () => {
        return await DriveEngine.testAuth();
    },

    // VERSION ROBUSTE QUI NE CRASH JAMAIS
    getFullDump: async () => {
        const TARGET_MODELS = [
            'AcademicYear', 'Admin', 'Classroom', 'Subject', 'Teacher', 'Student', 
            'Enrollment', 'Chapter', 'Homework', 'Submission', 'GameLevel', 
            'GameProgress', 'MistakesBook', 'AccessLog', 'BugReport', 'ProjectDoc', 'Player'
        ];
        
        const dump = {};
        
        for (const modelName of TARGET_MODELS) {
            try {
                // On vérifie si le modèle existe dans Mongoose
                if (mongoose.models[modelName]) {
                    const model = mongoose.model(modelName);
                    const collectionName = model.collection.name; // ex: 'students'
                    
                    // On limite à 500 entrées pour éviter le timeout HTTP sur les grosses tables (logs)
                    dump[collectionName] = await model.find({}).limit(500).sort({_id: -1}).lean();
                }
            } catch(e) {
                console.error(`⚠️ Skip dump ${modelName}:`, e.message);
                dump[`ERROR_${modelName}`] = [{ error: e.message }];
            }
        }
        return dump;
    },

    // --- MAINTENANCE ---
    migrateLegacy: async () => {
        const Player = mongoose.model('Player');
        const Student = mongoose.model('Student');
        const players = await Player.find({});
        let count = 0;
        
        for(const p of players) {
            const exists = await Student.findOne({ firstName: p.firstName, lastName: p.lastName });
            if(!exists) {
                await Student.create({
                    firstName: p.firstName,
                    lastName: p.lastName,
                    fullName: `${p.firstName} ${p.lastName}`,
                    currentClass: p.classroom
                });
                count++;
            }
        }
        return { migrated: count };
    },

    resyncEnrollments: async () => {
        const Enroll = mongoose.model('Enrollment');
        const Student = mongoose.model('Student');
        const Class = mongoose.model('Classroom');
        const students = await Student.find({});
        let count = 0;
        let year = await mongoose.model('AcademicYear').findOne({ isCurrent: true });
        
        for(const s of students) {
            if(s.currentClass) {
                const cls = await Class.findOne({ name: s.currentClass });
                if(cls) {
                    const exists = await Enroll.findOne({ studentId: s._id, classId: cls._id });
                    if(!exists) {
                        await Enroll.create({ studentId: s._id, classId: cls._id, yearId: year._id });
                        count++;
                    }
                }
            }
        }
        return { created: count };
    },

    purgeOrphans: async () => {
        const Enroll = mongoose.model('Enrollment');
        const allEnrolls = await Enroll.find({});
        let deleted = 0;
        for(const e of allEnrolls) {
            const s = await mongoose.model('Student').findById(e.studentId);
            const c = await mongoose.model('Classroom').findById(e.classId);
            if(!s || !c) {
                await Enroll.findByIdAndDelete(e._id);
                deleted++;
            }
        }
        return { deleted };
    }
};

module.exports = AdminExpert;