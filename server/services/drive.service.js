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
        console.log("✅ Drive Service V5 : Hiérarchie Stricte Activée");
    }
} catch (e) { console.error("❌ Erreur Init Drive:", e.message); }

const DriveService = {
    normalizeName: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        const cleanName = DriveService.normalizeName(name);
        try {
            // Recherche exacte par nom et parent
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            else q += ` and 'root' in parents`;
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            // Création si inexistant
            const folder = await drive.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // Garantit l'existence de la racine d'une classe
    getClassRoot: async (classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
        return await DriveService.getOrCreateFolder(classroom, teacherId);
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
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
    }
};

module.exports = DriveService;