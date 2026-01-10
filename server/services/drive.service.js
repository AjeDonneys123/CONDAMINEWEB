const { google } = require('googleapis');
const { Readable } = require('stream');

const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

const DriveService = {
    getOrCreateFolder: async (name, parentId = null) => {
        try {
            let q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            q += parentId ? ` and '${parentId}' in parents` : ` and 'root' in parents`;
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files?.length > 0) return res.data.files[0].id;

            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            // Rendre public
            await drive.permissions.create({ fileId: folder.data.id, resource: { role: 'reader', type: 'anyone' } });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // Nouvelle logique de chemin : CondaClasse / Nom Prof / Classe / ...
    getTeacherPath: async (teacherName, classroom = null) => {
        const rootId = await DriveService.getOrCreateFolder("CondaClasse");
        const teacherId = await DriveService.getOrCreateFolder(teacherName, rootId);
        if (!classroom) return { rootId, teacherId };

        const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
        const worksId = await DriveService.getOrCreateFolder("1Travaux", classId);
        const prodId = await DriveService.getOrCreateFolder("PRODUCTIONS", classId);
        return { rootId, teacherId, classId, worksId, prodId };
    },

    deleteFile: async (id) => { try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return true; } },
    moveFile: async (fileId, newParentId) => {
        const file = await drive.files.get({ fileId, fields: 'parents' });
        const previous = file.data.parents?.join(',') || "";
        return drive.files.update({ fileId, addParents: newParentId, removeParents: previous });
    },
    uploadImage: async (folderId, fileName, base64Data) => {
        const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
        const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };
        const file = await drive.files.create({ resource: { name: fileName, parents: [folderId] }, media, fields: 'id, webViewLink' });
        await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
        return { id: file.data.id, link: file.data.webViewLink };
    },
    listFilesInFolder: async (id) => {
        const res = await drive.files.list({ q: `'${id}' in parents and trashed = false`, fields: 'files(id, name, webViewLink, thumbnailLink)' });
        return res.data.files || [];
    }
};

module.exports = DriveService;