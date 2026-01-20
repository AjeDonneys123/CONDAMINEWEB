const { google } = require('googleapis');
const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

const ROOT_NAME = "CONDA PROJECT";

/**
 * 🛠️ EXPERT DRIVE STRUCTURE - VERSION 58
 * Synchro BDD ↔ Cloud + Création automatique des élèves de test manquants.
 */
const StructureDrive = {
    getDriveTree: async () => {
        try {
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            const rootRes = await drive.files.list({ q: `name = '${ROOT_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false` });
            if (!rootRes.data.files.length) return { name: ROOT_NAME, children: [], error: "Racine introuvable." };
            const rootId = rootRes.data.files[0].id;
            const scan = async (id, name, depth = 0) => {
                if (depth > 6) return { name, type: 'folder', children: [] };
                const res = await drive.files.list({ q: `'${id}' in parents and trashed = false`, fields: 'files(id, name, mimeType, webViewLink)', orderBy: 'folder,name' });
                const children = [];
                for (const f of res.data.files) {
                    if (f.name.startsWith('~$')) continue;
                    if (f.mimeType === 'application/vnd.google-apps.folder') children.push(await scan(f.id, f.name, depth + 1));
                    else children.push({ id: f.id, name: f.name, type: 'file', link: f.webViewLink });
                }
                return { id, name, type: 'folder', children };
            };
            return await scan(rootId, ROOT_NAME);
        } catch (e) { return { name: "Erreur Cloud", error: e.message }; }
    },

    /**
     * SYNCHRO V58 : RÉPARATION ET ALIGNEMENT TOTAL
     * 1. Création des dossiers racines.
     * 2. Provisionnement des élèves TEST pour TOUTES les classes.
     * 3. Création des dossiers profs/classes sur Drive.
     */
    syncBaseStructure: async () => {
        try {
            const rootId = await DriveEngine.getOrCreateFolder(ROOT_NAME);
            const teachersRootId = await DriveEngine.getOrCreateFolder("ENSEIGNANTS", rootId);
            const classesRootId = await DriveEngine.getOrCreateFolder("CLASSES", rootId);

            const Student = mongoose.model('Student');
            const Classroom = mongoose.model('Classroom');
            const Enrollment = mongoose.model('Enrollment');
            const AcademicYear = mongoose.model('AcademicYear');

            let year = await AcademicYear.findOne({ isCurrent: true });
            if (!year) year = await AcademicYear.create({ label: "2025-2026", isCurrent: true });

            // A. SYNC CLASSES & ÉLÈVES TEST
            const classrooms = await Classroom.find({});
            for (const cls of classrooms) {
                // 1. Dossier Drive pour la classe (si type CLASS)
                if (cls.type === 'CLASS') {
                    await DriveEngine.getOrCreateFolder(cls.name.toUpperCase(), classesRootId);
                }

                // 2. CRÉATION ÉLÈVE TEST SI MANQUANT (Logique V58)
                const testEmail = `test.${cls.name.toLowerCase().replace(/\s/g, '')}@condamine.local`;
                let testStudent = await Student.findOne({ email: testEmail });
                
                if (!testStudent) {
                    console.log(`👤 [REPAIR] Création élève test pour : ${cls.name}`);
                    testStudent = await Student.create({
                        firstName: "Eleve",
                        lastName: "Test",
                        fullName: `Eleve Test (${cls.name})`,
                        email: testEmail,
                        classId: cls._id,
                        currentClass: cls.name,
                        isTestAccount: true
                    });
                }

                // Inscription BDD
                await Enrollment.findOneAndUpdate(
                    { studentId: testStudent._id, classId: cls._id },
                    { studentId: testStudent._id, classId: cls._id, yearId: year._id },
                    { upsert: true }
                );
            }

            // B. SYNC PROFS
            const teachers = await mongoose.model('Teacher').find({});
            for (const t of teachers) {
                await DriveEngine.getOrCreateFolder(`${t.lastName.toUpperCase()} ${t.firstName.toUpperCase()}`, teachersRootId);
            }

            return { ok: true };
        } catch (e) { console.error("❌ Synchro V58 Fail:", e.message); throw e; }
    },

    deleteDriveItem: async (id) => {
        const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
        await drive.files.update({ fileId: id, resource: { trashed: true } });
        return { ok: true };
    }
};

module.exports = StructureDrive;