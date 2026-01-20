const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

let oauth2Client = null;
let driveInstance = null;

const DriveEngine = {
    oauth2Client: null,
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
                    DriveEngine.oauth2Client = oauth2Client;
                    console.log("✅ Drive Engine Ready V100.");
                }
            }
        } catch (e) { console.error("Drive Init Error", e.message); }
    },
    testAuth: async () => {
        if (!driveInstance) return { ok: false, error: "Non configuré" };
        try {
            const res = await driveInstance.about.get({ fields: 'user(emailAddress)' });
            return { ok: true, email: res.data.user.emailAddress };
        } catch (e) { return { ok: false, error: "Session expirée" }; }
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
    },
    /**
     * V100 : UPLOAD AVEC GÉNÉRATION DE LIEN DIRECT "UC"
     * Format : https://drive.google.com/uc?export=view&id={FILE_ID}
     */
    uploadFile: async (fileName, localPath, parentFolderId) => {
        if (!driveInstance) throw new Error("Drive Instance missing");
        try {
            const fileMetadata = { name: fileName, parents: [parentFolderId] };
            const media = { body: fs.createReadStream(localPath) };
            
            // 1. Upload du fichier
            const file = await driveInstance.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            const fileId = file.data.id;

            // 2. RENDRE LE FICHIER LISIBLE (Indispensable pour l'affichage élève)
            await driveInstance.permissions.create({
                fileId: fileId,
                resource: { role: 'reader', type: 'anyone' }
            });

            // 3. RETOURNER L'URL DE VUE DIRECTE
            const directUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
            return { id: fileId, link: directUrl };

        } catch (e) {
            console.error("❌ Drive Upload Fail V100:", e.message);
            throw e;
        }
    }
};
DriveEngine.init();
module.exports = DriveEngine;