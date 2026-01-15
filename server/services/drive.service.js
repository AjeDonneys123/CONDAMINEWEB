const { google } = require('googleapis');
const { Readable } = require('stream');

let drive = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        drive = google.drive({ version: 'v3', auth });
        console.log("✅ Drive Service V10 : Logique de Reconstruction Totale active");
    }
} catch (e) { console.error("❌ Drive Init Error:", e.message); }

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        const cleanName = DriveService.normalize(name);
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;
            const folder = await drive.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // Déplace un dossier/fichier vers un nouveau parent
    moveEntity: async (fileId, newParentId) => {
        if (!drive || !fileId || !newParentId) return;
        try {
            const file = await drive.files.get({ fileId, fields: 'parents' });
            const previousParents = (file.data.parents || []).join(',');
            await drive.files.update({
                fileId,
                addParents: newParentId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
        } catch (e) { console.error("❌ Move Error:", e.message); }
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return;
        try { await drive.files.delete({ fileId: id }); } catch (e) {} 
    }
};

module.exports = DriveService;