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
                console.log("✅ [DRIVE] Connexion établie avec le nouveau Refresh Token");
            } else {
                console.warn("⚠️ [DRIVE] Refresh Token manquant dans le .env");
            }
            return true;
        } catch (e) {
            console.error("❌ [DRIVE] Erreur initialisation:", e.message);
            return false;
        }
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
            if (!driveInstance) return false;
            // Test réel de validité du token
            await oauth2Client.getAccessToken();
            return true;
        } catch (e) {
            console.error("🚨 [DRIVE] Token invalide ou expiré :", e.message);
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
        if (!await DriveService.checkAuth() || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ [DRIVE] ${id} supprimé.`);
        } catch (e) { console.error("❌ [DRIVE] Erreur suppression:", e.message); } 
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
            const previousParents = (file.data.parents || []).join(',');
            await driveInstance.files.update({
                fileId,
                addParents: newParentId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
        } catch (e) { console.error("❌ [DRIVE] Erreur déplacement:", e.message); }
    },

    getSpecificDevoirsFolder: async (teacherName, classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        if (!rootId) return { classFolderId: null };
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        return { classFolderId: classId, devoirsFolderId: devoirsId };
    },

    getAuthUrl: () => {
        if (!oauth2Client) initDrive();
        if (!oauth2Client) return null;
        return oauth2Client.generateAuthUrl({
            access_type: 'offline', prompt: 'consent',
            redirect_uri: process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback",
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