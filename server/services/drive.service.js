const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;
let oauth2Client = null;

const initDrive = () => {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectURI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";

    if (clientID && clientSecret) {
        try {
            oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
                console.log("✅ Drive Service V30 : Connecté");
            }
            return true;
        } catch (e) { return false; }
    }
    return false;
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

    // Trouve ou crée un dossier avec recherche stricte
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

    // US #9 : Suppression radicale par ID
    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth() || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ [DRIVE] Pulvérisation de l'objet : ${id}`);
        } catch (e) { console.error("❌ [DRIVE] Erreur suppression :", e.message); } 
    },

    // US #8 : Localise le dossier DEVOIRS pour un prof et une classe
    getDevoirsContext: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        
        // Recherche du dossier DEVOIRS existant
        const res = await driveInstance.files.list({
            q: `name = 'DEVOIRS' and '${classId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
            fields: 'files(id)'
        });
        
        return {
            classFolderId: classId,
            devoirsFolderId: res.data.files[0]?.id || null
        };
    },

    getAuthUrl: () => {
        if (!oauth2Client) initDrive();
        if (!oauth2Client) return null;
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', prompt: 'consent',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/login",
            scope: ['https://www.googleapis.com/auth/drive.file']
        });
    },

    setTokenFromCode: async (code) => {
        if (!oauth2Client) return null;
        const { tokens } = await oauth2Client.getToken(code);
        return tokens.refresh_token;
    }
};

module.exports = DriveService;