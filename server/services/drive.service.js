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
                console.log("✅ [DRIVE] Initialisé. Token détecté.");
            }
        } catch (e) { console.error("❌ [DRIVE] Init Error:", e.message); }
    }
};

initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    // US #12 : Test de connexion avec détection forcée du domaine condamine
    testConnection: async () => {
        if (!oauth2Client || !driveInstance) return { ok: false, error: "Configuration manquante" };
        try {
            const res = await driveInstance.about.get({ fields: 'user(emailAddress,displayName)' });
            const email = res.data.user.emailAddress;
            // Vérification stricte du compte scolaire
            const isCondamine = email.endsWith('@condamine.edu.ec');
            return { 
                ok: true, 
                email, 
                name: res.data.user.displayName, 
                isPro: isCondamine 
            };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    },

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

    getClassFolderId: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        return await DriveService.getOrCreateFolder(classroom, profId);
    },

    getAuthUrl: () => {
        if (!oauth2Client) initDrive();
        if (!oauth2Client) return null;
        return oauth2Client.generateAuthUrl({
            access_type: 'offline',
            prompt: 'select_account', // FORCE l'utilisateur à choisir son compte
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