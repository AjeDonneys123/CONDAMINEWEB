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
            let q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) {
                return res.data.files[0].id;
            }
            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            await DriveService.makePublic(folder.data.id);
            return folder.data.id;
        } catch (e) { return null; }
    },

    uploadImage: async (folderId, fileName, base64Data) => {
        try {
            const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
            const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media: media, 
                fields: 'id, webViewLink'
            });
            await DriveService.makePublic(file.data.id);
            return { id: file.data.id, link: file.data.webViewLink };
        } catch (e) { return null; }
    },

    renameFolder: async (id, name) => {
        return drive.files.update({ fileId: id, resource: { name } });
    },

    deleteFolder: async (id) => {
        return drive.files.delete({ fileId: id });
    },

    listFilesInFolder: async (id) => {
        try {
            const res = await drive.files.list({ 
                q: `'${id}' in parents and trashed = false`, 
                fields: 'files(id, name, webViewLink, thumbnailLink)' 
            });
            return res.data.files;
        } catch (e) { return []; }
    }
};

module.exports = DriveService;