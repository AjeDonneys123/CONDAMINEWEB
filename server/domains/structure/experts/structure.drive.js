const { google } = require('googleapis');
const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

/**
 * 🛠️ EXPERT DRIVE STRUCTURE - VERSION 17
 * Ajout des capacités de suppression Cloud.
 */
const StructureDrive = {
    /**
     * MOUCHARD : Explore récursivement le Drive
     */
    getDriveTree: async () => {
        try {
            if (!DriveEngine.oauth2Client) throw new Error("Drive non authentifié");
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });

            const rootRes = await drive.files.list({
                q: "name = 'CONDA CLASSE' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
                fields: 'files(id, name)'
            });

            if (!rootRes.data.files.length) return { name: "CONDA CLASSE", children: [], error: "Racine introuvable" };
            const rootId = rootRes.data.files[0].id;

            const scanFolder = async (folderId, folderName, depth = 0) => {
                if (depth > 5) return { name: folderName, type: 'folder', children: [] };
                const res = await drive.files.list({
                    q: `'${folderId}' in parents and trashed = false`,
                    fields: 'files(id, name, mimeType, webViewLink, thumbnailLink)',
                    orderBy: 'folder,name'
                });

                const children = [];
                for (const file of res.data.files) {
                    if (file.name.startsWith('~$')) continue;
                    if (file.mimeType === 'application/vnd.google-apps.folder') {
                        children.push(await scanFolder(file.id, file.name, depth + 1));
                    } else {
                        children.push({
                            id: file.id,
                            name: file.name,
                            type: 'file',
                            link: file.webViewLink,
                            thumb: file.thumbnailLink
                        });
                    }
                }
                return { id: folderId, name: folderName, type: 'folder', children };
            };

            return await scanFolder(rootId, "CONDA CLASSE");
        } catch (e) {
            console.error("❌ [DRIVE-SPY] Error:", e.message);
            throw e;
        }
    },

    /**
     * SUPPRESSION : Supprime un fichier ou un dossier sur Drive
     */
    deleteDriveItem: async (fileId) => {
        try {
            if (!DriveEngine.oauth2Client) throw new Error("Drive non authentifié");
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            
            console.log(`🗑️ [DRIVE] Suppression de l'élément : ${fileId}`);
            await drive.files.delete({ fileId: fileId });
            return { ok: true };
        } catch (e) {
            console.error("❌ [DRIVE-DELETE] Error:", e.message);
            throw e;
        }
    },

    /**
     * Hiérarchie Master/Ponts (V13 logic)
     */
    createHomeworkHierarchy: async (homeworkId) => {
        try {
            const Homework = mongoose.model('Homework');
            const Chapter = mongoose.model('Chapter');
            const hw = await Homework.findById(homeworkId).populate('teacherId');
            if (!hw) return null;
            const chap = await Chapter.findById(hw.chapterId);
            const profName = hw.teacherId ? `${hw.teacherId.lastName} ${hw.teacherId.firstName}`.toUpperCase() : "PROF_INCONNU";
            const className = hw.classroom ? hw.classroom.toUpperCase() : "CLASSE_INCONNUE";
            const subjectName = (chap?.section || "GENERAL").toUpperCase();
            const homeworkName = `DEVOIR - ${hw.title.toUpperCase()}`;
            const rootId = await DriveEngine.getOrCreateFolder("CONDA CLASSE");
            const tRoot = await DriveEngine.getOrCreateFolder("ENSEIGNANTS", rootId);
            const pFold = await DriveEngine.getOrCreateFolder(profName, tRoot);
            const cFold = await DriveEngine.getOrCreateFolder(className, pFold);
            const sFold = await DriveEngine.getOrCreateFolder(subjectName, cFold);
            const masterHw = await DriveEngine.getOrCreateFolder(homeworkName, sFold);
            await DriveEngine.getOrCreateFolder("1-DOCUMENTS_SUPPORTS", masterHw);
            await DriveEngine.getOrCreateFolder("2-CONSIGNE_ORIGINALE", masterHw);
            const clRoot = await DriveEngine.getOrCreateFolder("CLASSES", rootId);
            const clFold = await DriveEngine.getOrCreateFolder(className, clRoot);
            if (hw.assignedStudents?.length > 0) {
                for (const sId of hw.assignedStudents) {
                    const s = await mongoose.model('Student').findById(sId);
                    if (s) {
                        const sName = `${s.lastName.toUpperCase()} ${s.firstName.toUpperCase()}`;
                        const sRoot = await DriveEngine.getOrCreateFolder(sName, clFold);
                        const sSubj = await DriveEngine.getOrCreateFolder(subjectName, sRoot);
                        await DriveEngine.getOrCreateFolder(homeworkName, sSubj);
                    }
                }
            }
            return { master: masterHw };
        } catch (e) { return null; }
    }
};

module.exports = StructureDrive;