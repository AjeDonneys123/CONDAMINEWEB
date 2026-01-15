const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;
let oauth2Client = null;

const initDrive = () => {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectURI = process.env.GOOGLE_REDIRECT_URI;

    // DIAGNOSTIC (S'affichera dans ta console node)
    if (!clientID) console.error("❌ Erreur Config: GOOGLE_CLIENT_ID manquant");
    if (!clientSecret) console.error("❌ Erreur Config: GOOGLE_CLIENT_SECRET manquant");
    if (!redirectURI) console.error("❌ Erreur Config: GOOGLE_REDIRECT_URI manquant");

    if (clientID && clientSecret && redirectURI) {
        try {
            oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
                console.log("✅ Drive Service V24 : Connecté");
            }
        } catch (e) {
            console.error("❌ Drive Init Error:", e.message);
        }
    }
};

// On appelle l'init immédiatement
initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    checkAuth: async () => {
        // Tentative de ré-init si oauth2Client est nul (au cas où le .env a été chargé tard)
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
            const res = await driveInstance.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;
            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    getSpecificDevoirsFolder: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        if (!rootId) return { classFolderId: null };
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        return { classFolderId: classId, devoirsFolderId: devoirsId };
    },

    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth()) return;
        try { await driveInstance.files.delete({ fileId: id }); } catch (e) {} 
    },

    listChildren: async (parentId) => {
        if (!await DriveService.checkAuth() || !parentId) return [];
        try {
            const res = await driveInstance.files.list({ q: `'${parentId}' in parents and trashed = false`, fields: 'files(id, name)' });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    moveEntity: async (fileId, newParentId) => {
        if (!await DriveService.checkAuth() || !fileId || !newParentId) return;
        try {
            const file = await driveInstance.files.get({ fileId, fields: 'parents' });
            const prev = (file.data.parents || []).join(',');
            await driveInstance.files.update({ fileId, addParents: newParentId, removeParents: prev });
        } catch (e) {}
    },

    getAuthUrl: () => {
        if (!oauth2Client) initDrive(); // Tentative de secours
        if (!oauth2Client) return null;
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', prompt: 'consent',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI,
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