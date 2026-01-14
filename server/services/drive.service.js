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
        console.log("✅ Drive API V4 : Système de Validation de Présence Activé");
    }
} catch (e) { console.error("❌ Erreur Init Drive:", e.message); }

const DriveService = {
    // Vérifie si un ID existe réellement sur le Drive
    verifyId: async (fileId) => {
        if (!drive || !fileId) return false;
        try {
            const res = await drive.files.get({ fileId: fileId, fields: 'id, trashed' });
            return res.data && !res.data.trashed;
        } catch (e) { return false; }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        try {
            const cleanName = name.replace(/'/g, "\\'");
            let q = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            else q += ` and 'root' in parents`;
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await drive.files.create({
                resource: { name: name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // Synchronise un chemin en incluant systématiquement le sur-dossier Enseignant
    syncPath: async (classroom, subFolders = []) => {
        let lastId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
        lastId = await DriveService.getOrCreateFolder("JEAN VUILLET", lastId);
        lastId = await DriveService.getOrCreateFolder(classroom.toUpperCase(), lastId);
        
        for (const folderName of subFolders) {
            lastId = await DriveService.getOrCreateFolder(folderName, lastId);
        }
        return lastId;
    },

    uploadFile: async (folderId, fileName, buffer, mimeType) => {
        if (!drive || !folderId) return null;
        try {
            const media = { mimeType, body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media, fields: 'id'
            });
            await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
            return { id: file.data.id, url: `https://drive.google.com/thumbnail?id=${file.data.id}&sz=w1200` };
        } catch (e) { return null; }
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    }
};

module.exports = DriveService;