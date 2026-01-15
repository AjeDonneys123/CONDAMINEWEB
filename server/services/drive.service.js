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
            console.log("✅ Drive Service V23 : Mode Extermination activé");
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
            await oauth2Client.getAccessToken();
            return true;
        } catch (e) { return false; }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!await DriveService.checkAuth()) return null;
        const cleanName = DriveService.normalize(name);
        try {
            // On cherche s'il en existe déjà un
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            else q += ` and 'root' in parents`;
            
            const res = await driveInstance.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            // Sinon création
            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // US #9 : Suppression physique réelle par ID
    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth() || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ [DRIVE] Pulvérisé : ${id}`);
        } catch (e) { console.error(`❌ [DRIVE] Erreur sur ${id}:`, e.message); } 
    },

    // Lister ABSOLUMENT TOUT ce qui est dans un dossier parent
    listEverythingInside: async (parentId) => {
        if (!await DriveService.checkAuth() || !parentId) return [];
        try {
            const res = await driveInstance.files.list({
                q: `'${parentId}' in parents and trashed = false`,
                fields: 'files(id, name, mimeType)',
                pageSize: 1000
            });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    // Récupère l'ID du dossier de classe (CONDA CLASSE > PROF > CLASSE)
    getClassFolderId: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        return await DriveService.getOrCreateFolder(classroom, profId);
    }
};

module.exports = DriveService;