const { google } = require('googleapis');

let oauth2Client = null;
let driveInstance = null;

const initDrive = () => {
    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectURI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
    
    if (clientID && clientSecret) {
        oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);
        if (process.env.GOOGLE_REFRESH_TOKEN) {
            oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
            driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
            console.log("✅ Drive Service Ready (Lycée Condamine)");
        }
    }
};
initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getAuthUrl: () => oauth2Client.generateAuthUrl({ 
        access_type: 'offline', 
        scope: ['https://www.googleapis.com/auth/drive.file', 'email'], 
        prompt: 'consent' 
    }),

    exchangeCode: async (code) => {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens.refresh_token;
    },

    testConnection: async () => {
        if (!driveInstance) return { ok: false, error: "Configuration manquante" };
        try {
            const res = await driveInstance.about.get({ fields: 'user(emailAddress)' });
            const email = res.data.user.emailAddress;
            const isCondamine = email.endsWith('@condamine.edu.ec') || email === 'vuillet.jean@gmail.com';
            return { ok: true, email, isCondamine };
        } catch (e) { 
            return { ok: false, error: "Session expirée" }; 
        }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        const cleanName = DriveService.normalize(name);
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            const list = await driveInstance.files.list({ q, fields: 'files(id)' });
            if (list.data.files.length > 0) return list.data.files[0].id;

            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { throw e; }
    },

    getMirrorPathId: async (teacherName, classroom, subject, chapterTitle) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        const subjectId = await DriveService.getOrCreateFolder(subject, devoirsId);
        const chapterId = await DriveService.getOrCreateFolder(chapterTitle, subjectId);
        return { rootId, profId, classId, devoirsId, subjectId, chapterId };
    }
};

module.exports = DriveService;