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
        console.log("✅ Drive Service V8 : Hiérarchie Multi-Prof active");
    }
} catch (e) { console.error("❌ Erreur Init Drive:", e.message); }

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        const cleanName = DriveService.normalize(name);
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            else q += ` and 'root' in parents`;
            
            const res = await drive.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await drive.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // LE CHEMIN ABSOLU : CONDA CLASSE > PROF > CLASSE > DEVOIRS > MATIERE > CHAPITRE
    getPathFolder: async (teacherName, classroom, subject, chapterTitle = null) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsRootId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        const subjectId = await DriveService.getOrCreateFolder(subject, devoirsRootId);
        
        if (!chapterTitle) return subjectId;
        return await DriveService.getOrCreateFolder(chapterTitle, subjectId);
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    }
};

module.exports = DriveService;