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
        console.log("✅ Drive API V4 : Système de Synchronisation Directe");
    }
} catch (e) { console.error("❌ Erreur Init Drive:", e.message); }

const DriveService = {
    // Vérifie l'existence ou crée
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

    // Synchronisation forcée du chemin enseignant
    syncPath: async (classroom, sectionName) => {
        try {
            const rootId = await DriveService.getOrCreateFolder("CONDACLASSE", null);
            const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
            const classId = await DriveService.getOrCreateFolder(classroom.toUpperCase(), teacherId);
            const sectionId = await DriveService.getOrCreateFolder(sectionName.toUpperCase(), classId);
            return sectionId;
        } catch (e) {
            console.error("❌ Erreur syncPath:", e.message);
            return null;
        }
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    }
};

module.exports = DriveService;