// @signatures: ProfDrive, getAuthUrl, getFileStream, getOrCreateFolder, getTokenFromCode, init, uploadFile
const { google } = require('googleapis');
const fs = require('fs');

console.log("☁️ [DRIVE-CORE] Initialisation...");

let oauth2Client = null;

const ProfDrive = {
    init: () => {
        try {
            const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
            const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
            const redirectUri = (process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback").trim();

            if (!clientId || !clientSecret) {
                console.error("❌ [DRIVE] CREDENTIALS MANQUANTS");
                return;
            }

            oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
            
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim() });
                console.log("✅ Drive Auth Ready.");
            }
        } catch (e) {
            console.error("❌ CRASH INIT DRIVE:", e.message);
        }
    },

    getAuthUrl: () => {
        if (!oauth2Client) throw new Error("Client OAuth non initialisé.");
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.readonly'],
            prompt: 'consent'
        });
    },

    getTokenFromCode: async (code) => {
        if (!oauth2Client) throw new Error("Client OAuth non initialisé.");
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    },

    getFileStream: async (fileId) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            const res = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            return res.data;
        } catch (e) {
            console.error(`❌ Drive Stream Error [${fileId}]:`, e.message);
            throw e;
        }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        try {
            const drive = google.drive({ version: 'v3', auth: oauth2Client });
            const q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false ${parentId ? `and '${parentId}' in parents` : ''}`;
            const res = await drive.files.list({ q, fields: 'files(id)' });
            if (res.data.files.length > 0) return res.data.files[0].id;
            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { throw e; }
    },

    uploadFile: async (fileName, localPath, parentFolderId) => {
        if (!oauth2Client) throw new Error("Drive non connecté");
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const file = await drive.files.create({
            resource: { name: fileName, parents: [parentFolderId] },
            media: { body: fs.createReadStream(localPath) },
            fields: 'id'
        });
        await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
        return { id: file.data.id };
    }
};

ProfDrive.init();
module.exports = ProfDrive;
