



const { google } = require('googleapis');
let oauth2Client = null;
let driveInstance = null;

const DriveEngine = {
    init: () => {
        try {
            const clientID = process.env.GOOGLE_CLIENT_ID;
            const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
            const refresh = process.env.GOOGLE_REFRESH_TOKEN;
            const redirect = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
            if (clientID && clientSecret) {
                oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirect);
                if (refresh) {
                    oauth2Client.setCredentials({ refresh_token: refresh });
                    driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
                    console.log("✅ Drive Engine Ready.");
                }
            }
        } catch (e) { console.error("Drive Init Error"); }
    },
    testAuth: async () => {
        if (!driveInstance) return { ok: false, error: "Non configuré" };
        try {
            const res = await driveInstance.about.get({ fields: 'user(emailAddress)' });
            return { ok: true, email: res.data.user.emailAddress };
        } catch (e) { return { ok: false, error: "Session expirée" }; }
    },
    getAuthUrl: () => oauth2Client?.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/drive.file', 'email'], prompt: 'consent' }) || "#",
    exchangeCode: async (code) => {
        const { tokens } = await oauth2Client.getToken(code);
        return tokens.refresh_token;
    },
    getOrCreateFolder: async (name, parentId = null) => {
        if (!driveInstance) throw new Error("Drive non prêt");
        const cleanName = name.toUpperCase().trim();
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            const res = await driveInstance.files.list({ q, fields: 'files(id)' });
            if (res.data.files?.length > 0) return res.data.files[0].id;
            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { throw e; }
    }
};
DriveEngine.init();
module.exports = DriveEngine;



