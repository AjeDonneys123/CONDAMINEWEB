const { google } = require('googleapis');

let driveInstance = null;
let oauth2Client = null;

const initDrive = () => {
    try {
        const clientID = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectURI = process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/auth/google/callback";
        if (clientID && clientSecret) {
            oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectURI);
            if (process.env.GOOGLE_REFRESH_TOKEN) {
                oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
                driveInstance = google.drive({ version: 'v3', auth: oauth2Client });
                console.log("✅ Drive Service Ready: condamine.edu.ec");
            }
        }
    } catch (e) { console.error("❌ Drive Init Error:", e.message); }
};
initDrive();

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",
    
    checkAuth: async () => {
        if (!oauth2Client || !driveInstance) return false;
        try { return !!(await oauth2Client.getAccessToken()); } catch (e) { return false; }
    },

    deleteEntity: async (id) => { 
        if (!await DriveService.checkAuth() || !id) return;
        try { 
            await driveInstance.files.delete({ fileId: id }); 
            console.log(`🗑️ Drive: Dossier/Fichier ${id} supprimé.`);
        } catch (e) { console.error("❌ Drive Delete Error:", e.message); } 
    }
};

module.exports = DriveService;