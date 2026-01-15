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
            console.log("✅ Drive Service V18 : Connecté");
        } else {
            console.warn("⚠️ Drive non configuré : Variables d'environnement manquantes.");
        }
    } catch (e) {
        console.error("❌ Drive Init Error:", e.message);
    }
};

initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    // Vérifie si le token est valide avant toute opération lourde
    checkAuth: async () => {
        if (!driveInstance) return false;
        try {
            await oauth2Client.getAccessToken();
            return true;
        } catch (e) {
            console.error("🚨 AUTH ERROR (invalid_grant?) :", e.message);
            return false;
        }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!await DriveService.checkAuth()) return null;
        const cleanName = DriveService.normalize(name);
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            
            const res = await driveInstance.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth()) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
        } catch (e) { console.error("❌ Erreur suppression:", e.message); } 
    },

    listChildren: async (parentId) => {
        if (!await DriveService.checkAuth()) return [];
        try {
            const res = await driveInstance.files.list({ q: `'${parentId}' in parents and trashed = false`, fields: 'files(id, name)' });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    getSpecificDevoirsFolder: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        return { classFolderId: classId, devoirsFolderId: devoirsId };
    },

    // Méthode pour générer l'URL d'autorisation (utile pour réparer le token)
    getAuthUrl: () => {
        if (!oauth2Client) return null;
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            scope: ['https://www.googleapis.com/auth/drive.file']
        });
    },

    // Méthode pour échanger le code contre un token
    setTokenFromCode: async (code) => {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens.refresh_token;
    }
};

module.exports = DriveService;