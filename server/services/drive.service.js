const { google } = require('googleapis');
const { Readable } = require('stream');

let driveInstance = null;
let googleAuth = null;

try {
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN) {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID, 
            process.env.GOOGLE_CLIENT_SECRET, 
            process.env.GOOGLE_REDIRECT_URI
        );
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
        googleAuth = auth;
        driveInstance = google.drive({ version: 'v3', auth });
        console.log("✅ Drive Service V11 : Pilotage par Service activé");
    }
} catch (e) { console.error("❌ Drive Init Error:", e.message); }

const DriveService = {
    normalize: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getOrCreateFolder: async (name, parentId = null) => {
        if (!driveInstance) return null;
        const cleanName = DriveService.normalize(name);
        try {
            let q = `name = '${cleanName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
            if (parentId) q += ` and '${parentId}' in parents`;
            
            const res = await driveInstance.files.list({ q, fields: 'files(id, name)' });
            if (res.data.files && res.data.files.length > 0) return res.data.files[0].id;

            const folder = await driveInstance.files.create({
                resource: { name: cleanName, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
                fields: 'id'
            });
            return folder.data.id;
        } catch (e) { return null; }
    },

    // US #7 : Déplacement physique (Miroir)
    moveEntity: async (fileId, newParentId) => {
        if (!driveInstance || !fileId || !newParentId) return;
        try {
            const file = await driveInstance.files.get({ fileId, fields: 'parents' });
            const previousParents = (file.data.parents || []).join(',');
            await driveInstance.files.update({
                fileId,
                addParents: newParentId,
                removeParents: previousParents,
                fields: 'id, parents'
            });
        } catch (e) { console.error("❌ Move Error:", e.message); }
    },

    // Liste les fichiers/dossiers dans un parent (Pour vider Devoirs)
    listChildren: async (parentId) => {
        if (!driveInstance || !parentId) return [];
        try {
            const res = await driveInstance.files.list({
                q: `'${parentId}' in parents and trashed = false`,
                fields: 'files(id, name)'
            });
            return res.data.files || [];
        } catch (e) { return []; }
    },

    // US #4 & #7 : Chemin Absolu
    getMirrorPathId: async (teacherName, classroom, subject, chapterTitle = null) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE");
        const profId = await DriveService.getOrCreateFolder(teacherName, rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, profId);
        const devoirsRootId = await DriveService.getOrCreateFolder("DEVOIRS", classId);
        const subjectId = await DriveService.getOrCreateFolder(subject, devoirsRootId);
        
        if (!chapterTitle) return { devoirsRootId, subjectId };
        const chapterId = await DriveService.getOrCreateFolder(chapterTitle, subjectId);
        return { devoirsRootId, subjectId, chapterId };
    },

    deleteFile: async (id) => { 
        if (!driveInstance || !id) return;
        try { await driveInstance.files.delete({ fileId: id }); } catch (e) {} 
    }
};

module.exports = DriveService;