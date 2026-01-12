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
        console.log("✅ Google Drive : Prêt.");
    }
} catch (e) {
    console.error("❌ Drive API Init Error:", e.message);
}

const DriveService = {
    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        try {
            let q = "name = '" + name + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
            if (parentId) q += " and '" + parentId + "' in parents";
            else q += " and 'root' in parents";
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await drive.files.create({
                resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },
    renameFolder: async (fileId, newName) => {
        if (!drive || !fileId) return;
        try {
            await drive.files.update({ fileId: fileId, resource: { name: newName } });
        } catch (e) {}
    },
    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    },
    moveFile: async (fileId, newParentId) => {
        if (!drive || !fileId || !newParentId) return;
        try {
            const file = await drive.files.get({ fileId: fileId, fields: 'parents' });
            const previous = (file.data.parents || []).join(',');
            return await drive.files.update({ fileId, addParents: newParentId, removeParents: previous });
        } catch(e) {}
    },
    uploadImage: async (folderId, fileName, base64Data) => {
        if (!drive) return null;
        try {
            const buffer = Buffer.from(base64Data.split(',')[1], 'base64');
            const media = { mimeType: 'image/jpeg', body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media,
                fields: 'id, webViewLink'
            });
            return { id: file.data.id, link: file.data.webViewLink };
        } catch (e) { return null; }
    }
};

module.exports = DriveService;