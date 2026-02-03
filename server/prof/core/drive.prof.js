// @signatures: ProfDrive, getAuth, getOrCreateFolder, uploadFile, getFileStream, getAuthUrl, getTokenFromCode
const { google } = require('googleapis');
const fs = require('fs');

let oauth2Client = null;

const ProfDrive = {
    init: () => {
        const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim();
        const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim();
        const redirectUri = "http://localhost:3000/api/auth/google/callback";

        if (!clientId || !clientSecret) {
            console.error("❌ [DRIVE-CORE] Client ID ou Secret manquant dans .env");
            return;
        }

        oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        
        if (process.env.GOOGLE_REFRESH_TOKEN) {
            oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim() });
            console.log("✅ [DRIVE-CORE] Client initialisé avec Refresh Token.");
        }
    },

    getAuthUrl: () => {
        if (!oauth2Client) throw new Error("Client OAuth non initialisé. Vérifiez votre .env.");
        
        const url = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            // Utilisation d'un scope plus large pour tester la compatibilité
            scope: [
                'https://www.googleapis.com/auth/drive.file',
                'https://www.googleapis.com/auth/drive.readonly'
            ],
            prompt: 'consent'
        });

        console.log("================================================");
        console.log("🔗 URL DE CONNEXION GÉNÉRÉE :");
        console.log(url);
        console.log("------------------------------------------------");
        console.log("👉 Vérifiez que 'redirect_uri' dans l'URL ci-dessus");
        console.log("   est EXACTEMENT celui déclaré dans Google Cloud.");
        console.log("================================================");
        
        return url;
    },

    getTokenFromCode: async (code) => {
        console.log("⏳ [DRIVE-CORE] Échange du code contre token...");
        const { tokens } = await oauth2Client.getToken(code);
        return tokens;
    },

    getOrCreateFolder: async (name, parentId = null) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const cleanName = name.toUpperCase().trim();
        let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
        if (parentId) q += ` and '${parentId}' in parents`;
        const res = await drive.files.list({ q, fields: 'files(id)' });
        if (res.data.files?.length > 0) return res.data.files[0].id;
        const folder = await drive.files.create({
            resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
            fields: 'id'
        });
        return folder.data.id;
    },

    uploadFile: async (fileName, localPath, parentFolderId) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const media = { body: fs.createReadStream(localPath) };
        const file = await drive.files.create({
            resource: { name: fileName, parents: [parentFolderId] },
            media: media,
            fields: 'id'
        });
        await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
        return { id: file.data.id };
    },

    getFileStream: async (fileId) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
        return res.data;
    }
};

// Auto-init au chargement
ProfDrive.init();
module.exports = ProfDrive;
