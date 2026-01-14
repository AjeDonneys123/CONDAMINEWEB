const { google } = require('googleapis');
const { Readable } = require('stream');

let drive = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID, 
            process.env.GOOGLE_CLIENT_SECRET, 
            process.env.GOOGLE_REDIRECT_URI
        );
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        drive = google.drive({ version: 'v3', auth });
        console.log("✅ Drive API V3 : Navigation par Arborescence Activée");
    }
} catch (e) {
    console.error("❌ Erreur Init Drive:", e.message);
}

const DriveService = {
    // Cherche ou crée un dossier dans un parent spécifique
    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        try {
            const cleanName = name.replace(/'/g, "\\'"); // Protection caractères spéciaux
            let q = `name = '${cleanName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            else q += ` and 'root' in parents`;
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await drive.files.create({
                resource: { 
                    name: name, 
                    mimeType: 'application/vnd.google-apps.folder', 
                    parents: parentId ? [parentId] : [] 
                },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { 
            console.error(`[Drive] Erreur dossier ${name}:`, e.message);
            return null; 
        }
    },

    // Méthode surpuissante pour synchroniser un chemin complet
    // pathArray = ["CONDACLASSE", "6D", "HISTOIRE", "CHAPITRE 1"]
    syncPath: async (pathArray) => {
        let lastId = null;
        for (const folderName of pathArray) {
            lastId = await DriveService.getOrCreateFolder(folderName, lastId);
        }
        return lastId;
    },

    uploadFile: async (folderId, fileName, buffer, mimeType) => {
        if (!drive || !folderId) return null;
        try {
            const media = { mimeType, body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media,
                fields: 'id, webViewLink'
            });
            await drive.permissions.create({
                fileId: file.data.id,
                resource: { role: 'reader', type: 'anyone' }
            });
            return { id: file.data.id, url: `https://drive.google.com/thumbnail?id=${file.data.id}&sz=w1200` };
        } catch (e) { return null; }
    },

    createShortcut: async (targetId, parentFolderId, shortcutName) => {
        if (!drive || !targetId || !parentFolderId) return null;
        try {
            await drive.files.create({
                resource: {
                    name: `🔗 ${shortcutName}`,
                    mimeType: 'application/vnd.google-apps.shortcut',
                    parents: [parentFolderId],
                    shortcutDetails: { targetId: targetId }
                }
            });
            return true;
        } catch (e) { return null; }
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    }
};

module.exports = DriveService;