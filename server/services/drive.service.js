const { google } = require('googleapis');
const { Readable } = require('stream');

let drive = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        drive = google.drive({ version: 'v3', auth });
        console.log("✅ Drive API : Prêt.");
    }
} catch (e) { console.error("Drive Init Error:", e.message); }

const DriveService = {
    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        try {
            let q = "name = '" + name + "' and mimeType = 'application/vnd.google-apps.folder' and trashed = false";
            q += parentId ? " and '" + parentId + "' in parents" : " and 'root' in parents";
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files?.length > 0) return res.data.files[0].id;

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
            await drive.files.update({ fileId, resource: { name: newName } });
        } catch (e) { console.error("Rename Error:", e.message); }
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    },

    moveFile: async (fileId, newParentId) => {
        if (!drive || !fileId || !newParentId) return;
        try {
            const file = await drive.files.get({ fileId, fields: 'parents' });
            const previous = (file.data.parents || []).join(',');
            return await drive.files.update({ fileId, addParents: newParentId, removeParents: previous });
        } catch(e) { console.error("Move Error:", e.message); }
    }
};

module.exports = DriveService;