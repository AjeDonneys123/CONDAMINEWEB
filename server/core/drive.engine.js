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
            // On permet une redirection dynamique ou fixe
            const redirect = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
            
            if (clientID && clientSecret) {
                oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirect);
                DriveEngine.oauth2Client = oauth2Client; // Stockage public pour les routes Auth

                const refresh = process.env.GOOGLE_REFRESH_TOKEN;
                if (refresh) {
                    oauth2Client.setCredentials({ refresh_token: refresh });
                    driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
                    console.log("✅ Drive Engine Initialisé.");
                } else {
                    console.warn("⚠️ Drive Engine : Pas de Refresh Token dans .env");
                }
            } else {
                console.error("❌ Drive Engine : Client ID/Secret manquants.");
            }
        } catch (e) { console.error("Drive Init Error", e.message); }
    },

    // --- MÉTHODES OAUTH (Pour regénérer le token) ---
    getAuthUrl: () => {
        if (!DriveEngine.oauth2Client) throw new Error("OAuth Client non initialisé");
        return DriveEngine.oauth2Client.generateAuthUrl({
            access_type: 'offline', // CRUCIAL pour avoir le Refresh Token
            scope: ['https://www.googleapis.com/auth/drive.file'],
            prompt: 'consent' // Force la génération du refresh token
        });
    },

    getTokenFromCode: async (code) => {
        if (!DriveEngine.oauth2Client) throw new Error("OAuth Client non initialisé");
        const { tokens } = await DriveEngine.oauth2Client.getToken(code);
        return tokens;
    },

    // --- MÉTHODES MÉTIER ---
    testAuth: async () => {
        if (!driveInstance) return { ok: false, error: "Non configuré (Token manquant)" };
        try {
            const res = await driveInstance.about.get({ fields: 'user(emailAddress)' });
            return { ok: true, email: res.data.user.emailAddress };
        } catch (e) { 
            console.error("Test Auth Fail:", e.message);
            return { ok: false, error: "Session expirée ou invalide. Regénérez le token." }; 
        }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        if (!driveInstance) throw new Error("Drive non connecté. Vérifiez le token.");
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

    uploadFile: async (fileName, localPath, parentFolderId) => {
        if (!driveInstance) throw new Error("Drive non connecté.");
        try {
            const fileMetadata = { name: fileName, parents: [parentFolderId] };
            const media = { body: fs.createReadStream(localPath) };
            
            const file = await driveInstance.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });

            const fileId = file.data.id;
            await driveInstance.permissions.create({
                fileId: fileId,
                resource: { role: 'reader', type: 'anyone' }
            });

            return { id: fileId, link: `https://drive.google.com/uc?export=view&id=${fileId}` };

        } catch (e) {
            console.error("❌ Drive Upload Fail:", e.message);
            throw e;
        }
    },

    getFileStream: async (fileId) => {
        try {
            // On recrée une instance légère pour le stream si besoin, ou on utilise l'existante
            const drive = google.drive({ version: 'v3', auth: DriveEngine.oauth2Client });
            const res = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
            );
            return res.data;
        } catch (e) {
            throw e;
        }
    }
};

DriveEngine.init();
module.exports = DriveEngine;