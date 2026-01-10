const { google } = require('googleapis');
const { Readable } = require('stream');

const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);
auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
const drive = google.drive({ version: 'v3', auth });

const DriveService = {
    makePublic: async (fileId) => {
        try {
            await drive.permissions.create({
                fileId: fileId,
                resource: { role: 'reader', type: 'anyone' }
            });
            return true;
        } catch (e) { return false; }
    },

    getOrCreateFolder: async (name, parentId = null) => {
        try {
            // Recherche avec tolérance (nom exact ou dossier parent)
            let query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) query += ` and '${parentId}' in parents`;
            
            const res = await drive.files.list({ q: query, fields: 'files(id, name, webViewLink)' });
            
            if (res.data.files && res.data.files.length > 0) {
                console.log(`📂 [DRIVE] Dossier trouvé : "${name}" -> ${res.data.files[0].webViewLink}`);
                return res.data.files[0].id;
            }

            // Création si inexistant
            const fileMetadata = {
                name: name,
                mimeType: 'application/vnd.google-apps.folder',
                parents: parentId ? [parentId] : []
            };
            const folder = await drive.files.create({ resource: fileMetadata, fields: 'id, webViewLink' });
            await DriveService.makePublic(folder.data.id);
            
            console.log(`🆕 [DRIVE] Nouveau dossier créé : "${name}" -> ${folder.data.webViewLink}`);
            return folder.data.id;
        } catch (e) {
            console.error(`❌ [DRIVE ERROR] sur "${name}":`, e.message);
            return null;
        }
    },

    moveFile: async (fileId, newParentId) => {
        try {
            const file = await drive.files.get({ fileId: fileId, fields: 'parents' });
            const previousParents = file.data.parents ? file.data.parents.join(',') : "";
            await drive.files.update({
                fileId: fileId,
                addParents: newParentId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
            console.log(`🚀 [DRIVE] Dossier déplacé vers nouveau parent ID: ${newParentId}`);
            return true;
        } catch (e) {
            console.error("❌ [DRIVE ERROR] moveFile:", e.message);
            return false;
        }
    },

    deleteFile: async (fileId) => {
        try {
            if (!fileId) return true;
            await drive.files.delete({ fileId: fileId });
            console.log(`🗑️ [DRIVE] Fichier/Dossier supprimé ID: ${fileId}`);
            return true;
        } catch (e) {
            if (e.code === 404) return true;
            console.error("❌ [DRIVE ERROR] deleteFile:", e.message);
            return false;
        }
    },

    renameFolder: async (fileId, newName) => {
        try {
            await drive.files.update({ fileId, resource: { name: newName } });
            console.log(`✏️ [DRIVE] Dossier renommé en : ${newName}`);
            return true;
        } catch (e) { return false; }
    },

    uploadImage: async (folderId, fileName, base64Data) => {
        try {
            const base64Image = base64Data.split(';base64,').pop();
            const buffer = Buffer.from(base64Image, 'base64');
            const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media: media, fields: 'id, webViewLink'
            });
            await DriveService.makePublic(file.data.id);
            return { id: file.data.id, link: file.data.webViewLink };
        } catch (e) { return null; }
    },

    listFilesInFolder: async (folderId) => {
        try {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false`,
                fields: 'files(id, name, webViewLink, thumbnailLink)'
            });
            return res.data.files || [];
        } catch (e) { return []; }
    }
};

module.exports = DriveService;