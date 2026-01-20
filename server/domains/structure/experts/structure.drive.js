const { google } = require('googleapis');
const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

const ROOT_NAME = "CONDA PROJECT";

/**
 * 🛠️ EXPERT DRIVE STRUCTURE - VERSION 51
 * Synchronisation dynamique des affectations profs.
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
        } catch (e) { return { name: "Erreur", error: e.message }; }
    },

    /**
     * SYNCHRO V51 : Provisionne les dossiers des classes/groupes dans l'espace de chaque prof.
     */
    syncBaseStructure: async () => {
        try {
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            const rootId = await DriveEngine.getOrCreateFolder(ROOT_NAME);
            const tRootId = await DriveEngine.getOrCreateFolder("ENSEIGNANTS", rootId);
            const cRootId = await DriveEngine.getOrCreateFolder("CLASSES", rootId);
            const aRootId = await DriveEngine.getOrCreateFolder("ADMINISTRATION", rootId);

            // 1. SYNC PROFS ET LEURS AFFECTATIONS
            const teachers = await mongoose.model('Teacher').find({}).populate('assignedClasses');
            for (const t of teachers) {
                const profName = `${t.lastName.toUpperCase()} ${t.firstName.toUpperCase()}`;
                const profFolderId = await DriveEngine.getOrCreateFolder(profName, tRootId);

                // On crée les dossiers pour chaque classe ou groupe assigné
                if (t.assignedClasses && t.assignedClasses.length > 0) {
                    for (const cls of t.assignedClasses) {
                        await DriveEngine.getOrCreateFolder(cls.name.toUpperCase(), profFolderId);
                    }
                }
            }

            // 2. SYNC ADMINS (Non-profs)
            const admins = await mongoose.model('Admin').find({});
            for (const a of admins) {
                const isProf = await mongoose.model('Teacher').findOne({ firstName: a.firstName, lastName: a.lastName });
                if (!isProf) {
                    await DriveEngine.getOrCreateFolder(`${a.lastName.toUpperCase()} ${a.firstName.toUpperCase()}`, aRootId);
                }
            }

            // 3. SYNC CLASSES (Structure administrative)
            const classrooms = await mongoose.model('Classroom').find({ type: 'CLASS' });
            for (const cls of classrooms) {
                await DriveEngine.getOrCreateFolder(cls.name.toUpperCase(), cRootId);
            }

            return { ok: true };
        } catch (e) { console.error("❌ Synchro V51 Fail:", e.message); throw e; }
    },

    createHomeworkHierarchy: async (homeworkId) => {
        try {
            const Homework = mongoose.model('Homework');
            const Chapter = mongoose.model('Chapter');
            const Student = mongoose.model('Student');
            const Classroom = mongoose.model('Classroom');
            
            const hw = await Homework.findById(homeworkId).populate('teacherId');
            const chap = await Chapter.findById(hw.chapterId);
            const profName = `${hw.teacherId.lastName.toUpperCase()} ${hw.teacherId.firstName.toUpperCase()}`;
            const subjectName = (chap?.section || "GENERAL").toUpperCase();
            const groupName = hw.classroom ? hw.classroom.toUpperCase() : "GROUPE";
            const homeworkName = `DEVOIR - ${hw.title.toUpperCase()}`;

            const rootId = await DriveEngine.getOrCreateFolder(ROOT_NAME);
            const tRootId = await DriveEngine.getOrCreateFolder("ENSEIGNANTS", rootId);
            const pFolderId = await DriveEngine.getOrCreateFolder(profName, tRootId);
            const pGroupId = await DriveEngine.getOrCreateFolder(groupName, pFolderId);
            const pSubjId = await DriveEngine.getOrCreateFolder(subjectName, pGroupId);
            const masterHwId = await DriveEngine.getOrCreateFolder(homeworkName, pSubjId);
            
            await DriveEngine.getOrCreateFolder("1-DOCUMENTS_SUPPORTS", masterHwId);
            await DriveEngine.getOrCreateFolder("2-CONSIGNE_ORIGINALE", masterHwId);
            const pCopiesRootId = await DriveEngine.getOrCreateFolder("3-COPIES_ELEVES", masterHwId);

            const cRootId = await DriveEngine.getOrCreateFolder("CLASSES", rootId);
            if (hw.assignedStudents?.length > 0) {
                for (const sId of hw.assignedStudents) {
                    const s = await Student.findById(sId);
                    if (s) {
                        const adminCls = await Classroom.findById(s.classId);
                        const adminClassName = adminCls ? adminCls.name.toUpperCase() : "EXTERNES";
                        const classFolderId = await DriveEngine.getOrCreateFolder(adminClassName, cRootId);
                        const studentRootId = await DriveEngine.getOrCreateFolder(`${s.lastName.toUpperCase()} ${s.firstName.toUpperCase()}`, classFolderId);
                        const studentSubjId = await DriveEngine.getOrCreateFolder(subjectName, studentRootId);
                        await DriveEngine.getOrCreateFolder(homeworkName, studentSubjId);
                        await DriveEngine.getOrCreateFolder(`${s.lastName.toUpperCase()} ${s.firstName.toUpperCase()}`, pCopiesRootId);
                    }
                }
            }
            return { master: masterHwId };
        } catch (e) { return null; }
    },

    deleteDriveItem: async (id) => {
        const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
        await drive.files.update({ fileId: id, resource: { trashed: true } });
        return { ok: true };
    }
};

module.exports = StructureDrive;