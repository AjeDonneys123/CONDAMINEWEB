const { google } = require('googleapis');
const { Readable } = require('stream');

let drive = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID, 
            process.env.GOOGLE_CLIENT_SECRET, 
            process.env.GOOGLE_REDIRECT_URI
        );
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        drive = google.drive({ version: 'v3', auth });
        console.log("✅ Drive API : Prêt pour la synchronisation.");
    }
} catch (e) {
    console.error("❌ Erreur Init Drive:", e.message);
}

const DriveService = {
    // Version améliorée : cherche par nom si parentId est fourni
    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        try {
            // On cherche le dossier avec le nom exact
            let q = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) {
                return res.data.files[0].id;
            }

            // Sinon, création
            const folder = await drive.files.create({
                resource: { 
                    name: name, 
                    mimeType: 'application/vnd.google-apps.folder', 
                    parents: parentId ? [parentId] : [] 
                },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { 
            console.error(`Erreur Drive (Folder ${name}):`, e.message);
            return null; 
        }
    },

    uploadFile: async (folderId, fileName, buffer, mimeType) => {
        if (!drive || !folderId) return null;
        try {
            const media = { mimeType, body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media,
                fields: 'id, webViewLink'
            });
            await drive.permissions.create({
                fileId: file.data.id,
                resource: { role: 'reader', type: 'anyone' }
            });
            return { id: file.data.id, url: `https://drive.google.com/thumbnail?id=${file.data.id}&sz=w1200` };
        } catch (e) { return null; }
    },

    createShortcut: async (targetId, parentFolderId, shortcutName) => {
        if (!drive || !targetId || !parentFolderId) return null;
        try {
            const res = await drive.files.create({
                resource: {
                    name: `🔗 ${shortcutName}`,
                    mimeType: 'application/vnd.google-apps.shortcut',
                    parents: [parentFolderId],
                    shortcutDetails: { targetId: targetId }
                },
                fields: 'id'
            });
            return res.data.id;
        } catch (e) { return null; }
    }
};

module.exports = DriveService;