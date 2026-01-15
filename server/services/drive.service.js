const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        driveInstance = google.drive({ version: 'v3', auth });
        console.log("✅ Drive Service V14 : Nettoyage Radical & Miroir Stricte");
    }
} catch (e) { console.error("❌ Drive Init Error:", e.message); }

const DriveService = {
    // US #5 : Normalisation sans compromis
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getOrCreateFolder: async (name, parentId = null) => {
        if (!driveInstance) return null;
        const cleanName = DriveService.normalize(name);
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            else q += ` and 'root' in parents`;
            
            const res = await driveInstance.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // US #9 : Suppression physique réelle
    deleteFile: async (id) => { 
        if (!driveInstance || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ Drive: Objet ${id} supprimé.`);
        } catch (e) { console.error("❌ Erreur Delete Drive:", e.message); } 
    },

    // Lister les enfants pour le nettoyage
    listChildren: async (parentId) => {
        if (!driveInstance || !parentId) return [];
        try {
            const res = await driveInstance.files.list({ q: `'${parentId}' in parents and trashed = false`, fields: 'files(id, name)' });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    // Chemin Maître : CONDA CLASSE > PROF > CLASSE > DEVOIRS
    getDevoirsRootId: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        return await DriveService.getOrCreateFolder("DEVOIRS", classId);
    }
};

module.exports = DriveService;