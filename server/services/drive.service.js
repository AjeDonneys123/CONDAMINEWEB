const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID, 
            process.env.GOOGLE_CLIENT_SECRET, 
            process.env.GOOGLE_REDIRECT_URI
        );
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        driveInstance = google.drive({ version: 'v3', auth });
        console.log("✅ Drive Service V16 : Suppression Récursive Activée");
    }
} catch (e) { console.error("❌ Drive Init Error:", e.message); }

const DriveService = {
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

    // Suppression radicale US #9
    deleteEntity: async (id) => { 
        if (!driveInstance || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ Drive permanent delete: ${id}`);
        } catch (e) { console.error("❌ Erreur suppression physique:", e.message); } 
    },

    listChildren: async (parentId) => {
        if (!driveInstance || !parentId) return [];
        try {
            const res = await driveInstance.files.list({ q: `'${parentId}' in parents and trashed = false`, fields: 'files(id, name)' });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    // Récupère l'ID du dossier "DEVOIRS" pour un prof et une classe donnée
    getSpecificDevoirsId: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        return await DriveService.getOrCreateFolder("DEVOIRS", classId);
    }
};

module.exports = DriveService;