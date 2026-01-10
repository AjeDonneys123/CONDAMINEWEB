const { google } = require('googleapis');
const { Readable } = require('stream');

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

const DriveService = {
    makePublic: async (fileId) => {
        try {
            await drive.permissions.create({
                fileId: fileId,
                resource: { role: 'reader', type: 'anyone' }
            });
            return true;
        } catch (e) { return false; }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        try {
            let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) query += ` and '${parentId}' in parents`;
            const res = await drive.files.list({ q: query, fields: 'files(id, name)' });
            
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            await DriveService.makePublic(folder.data.id);
            return folder.data.id;
        } catch (e) { return null; }
    },

    // DÉPLACER UN DOSSIER (ex: déplacer une production dans un chapitre)
    moveFile: async (fileId, newParentId) => {
        try {
            const file = await drive.files.get({ fileId: fileId, fields: 'parents' });
            const previousParents = file.data.parents.join(',');
            await drive.files.update({
                fileId: fileId,
                addParents: newParentId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
            return true;
        } catch (e) {
            console.error("❌ Erreur déplacement Drive:", e.message);
            return false;
        }
    },

    deleteFile: async (fileId) => {
        try {
            if (!fileId) return true;
            await drive.files.delete({ fileId: fileId });
            return true;
        } catch (e) { return false; }
    },

    renameFolder: async (fileId, newName) => {
        try {
            await drive.files.update({ fileId, resource: { name: newName } });
            return true;
        } catch (e) { return false; }
    },

    uploadImage: async (folderId, fileName, base64Data) => {
        try {
            const buffer = Buffer.from(base64Data.split(';base64,').pop(), 'base64');
            const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media: media, fields: 'id, webViewLink'
            });
            await DriveService.makePublic(file.data.id);
            return { id: file.data.id, link: file.data.webViewLink };
        } catch (e) { return null; }
    },

    listFilesInFolder: async (folderId) => {
        try {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, webViewLink, thumbnailLink)'
            });
            return res.data.files || [];
        } catch (e) { return []; }
    }
};

module.exports = DriveService;