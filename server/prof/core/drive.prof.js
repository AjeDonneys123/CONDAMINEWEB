// @signatures: ProfDrive, getAuth, getOrCreateFolder, uploadFile, getFileStream
const { google } = require('googleapis');
const fs = require('fs');

let oauth2Client = null;

const ProfDrive = {
    init: () => {
        if (!process.env.GOOGLE_CLIENT_ID) return;
        oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID, 
            process.env.GOOGLE_CLIENT_SECRET, 
            "http://localhost:3000/api/auth/google/callback"
        );
        if (process.env.GOOGLE_REFRESH_TOKEN) {
            oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const cleanName = name.toUpperCase().trim();
        let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) q += ` and '${parentId}' in parents`;
        const res = await drive.files.list({ q, fields: 'files(id)' });
        if (res.data.files?.length > 0) return res.data.files[0].id;
        const folder = await drive.files.create({
            resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
            fields: 'id'
        });
        return folder.data.id;
    },

    uploadFile: async (fileName, localPath, parentFolderId) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const media = { body: fs.createReadStream(localPath) };
        const file = await drive.files.create({
            resource: { name: fileName, parents: [parentFolderId] },
            media: media,
            fields: 'id'
        });
        await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
        return { id: file.data.id };
    },

    getFileStream: async (fileId) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        return res.data;
    }
};

ProfDrive.init();
module.exports = ProfDrive;
