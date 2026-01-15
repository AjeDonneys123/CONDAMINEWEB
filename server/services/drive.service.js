const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;
let oauth2Client = null;

const initDrive = () => {
    try {
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
            oauth2Client = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID, 
                process.env.GOOGLE_CLIENT_SECRET, 
                process.env.GOOGLE_REDIRECT_URI
            );
            oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
            driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
            console.log("✅ Drive Service V22 : Mode Nettoyage Intégral activé");
        }
    } catch (e) {
        console.error("❌ Drive Init Error:", e.message);
    }
};

initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    checkAuth: async () => {
        if (!oauth2Client) initDrive();
        if (!oauth2Client) return false;
        try {
            if (!driveInstance && process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
            }
            await oauth2Client.getAccessToken();
            return true;
        } catch (e) { return false; }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!await DriveService.checkAuth()) return null;
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

    // US #9 : Suppression physique définitive
    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth() || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ [DRIVE] Suppression : ${id}`);
        } catch (e) { console.error("❌ [DRIVE] Erreur suppression :", e.message); } 
    },

    // Liste ABSOLUMENT TOUT dans un dossier (sans filtre de nom)
    listAllChildren: async (parentId) => {
        if (!await DriveService.checkAuth() || !parentId) return [];
        try {
            const res = await driveInstance.files.list({
                q: `'${parentId}' in parents and trashed = false`,
                fields: 'files(id, name)'
            });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    // Récupère l'ID du dossier de classe (CONDA CLASSE > PROF > CLASSE)
    getClassFolder: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        return classId;
    }
};

module.exports = DriveService;