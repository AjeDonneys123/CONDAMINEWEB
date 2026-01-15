const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;
let oauth2Client = null;

// US #4 & #8 : Initialisation robuste du client OAuth
const initDrive = () => {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectURI = process.env.GOOGLE_REDIRECT_URI;

    if (clientID && clientSecret && redirectURI) {
        try {
            oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);
            
            // On ne met le token que s'il existe
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
                console.log("✅ Drive Service V23 : Client configuré");
            } else {
                console.log("ℹ️ Drive Service : En attente de Refresh Token (Allez sur /api/auth/google/login)");
            }
        } catch (e) {
            console.error("❌ Drive Init Error:", e.message);
        }
    } else {
        console.warn("⚠️ Configuration Google incomplète dans le .env (ID, Secret ou Redirect URI manquant)");
    }
};

initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    checkAuth: async () => {
        if (!oauth2Client) return false;
        try {
            // Force l'initialisation si le token vient d'être ajouté au .env sans restart (optionnel)
            if (!oauth2Client.credentials.refresh_token && process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
            }
            if (!driveInstance) return false;
            await oauth2Client.getAccessToken();
            return true;
        } catch (e) {
            return false;
        }
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

    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth() || !id) return;
        try { await driveInstance.files.delete({ fileId: id }); } catch (e) {} 
    },

    listChildren: async (parentId) => {
        if (!await DriveService.checkAuth() || !parentId) return [];
        try {
            const res = await driveInstance.files.list({ q: `'${parentId}' in parents and trashed = false`, fields: 'files(id, name)' });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    getSpecificDevoirsFolder: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        if (!rootId) return { classFolderId: null, devoirsFolderId: null };
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        return { classFolderId: classId, devoirsFolderId: devoirsId };
    },

    // REPARATION : On force l'inclusion de redirect_uri
    getAuthUrl: () => {
        if (!oauth2Client) return null;
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'consent',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI, // Forçage du paramètre
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