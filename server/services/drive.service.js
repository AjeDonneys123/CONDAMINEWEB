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
        console.log("✅ Drive Service Ready - US #8 Sync Enabled");
    }
} catch (e) { console.error("❌ Erreur Init Drive:", e.message); }

const DriveService = {
    // US #5 : Normalisation stricte
    normalizeName: (n) => n ? n.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Z0-9 ]/g, "_").trim() : "SANS_TITRE",

    getOrCreateFolder: async (name, parentId = null) => {
        if (!drive) return null;
        const cleanName = DriveService.normalizeName(name);
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

    getHomeworkRoot: async (classroom) => {
        const rootId = await DriveService.getOrCreateFolder("CONDA CLASSE", null);
        const teacherId = await DriveService.getOrCreateFolder("JEAN VUILLET", rootId);
        const classId = await DriveService.getOrCreateFolder(classroom, teacherId);
        return await DriveService.getOrCreateFolder("DEVOIRS", classId);
    },

    // US #8 : Alignement & Nettoyage (La "Vérité Physique")
    syncFullStructure: async (classroom, sections, chapters, homeworks) => {
        if (!drive) return { error: "Drive non connecté" };
        console.log(`🔄 [SYNC] Alignement Drive pour ${classroom}...`);
        
        try {
            const hwRootId = await DriveService.getHomeworkRoot(classroom);
            const report = [];

            // 1. Aligner les matières (Sections)
            for (const section of sections) {
                const secId = await DriveService.getOrCreateFolder(section.name, hwRootId);
                
                // 2. Aligner les chapitres de cette matière
                const secChapters = chapters.filter(c => c.subject === section.name);
                for (const chap of secChapters) {
                    const chapId = await DriveService.getOrCreateFolder(chap.title, secId);
                    
                    // Mise à jour BDD si l'ID a changé ou était manquant
                    if (chap.driveFolderId !== chapId) {
                        await (require('../models/Chapter')).findByIdAndUpdate(chap._id, { driveFolderId: chapId });
                    }

                    // 3. Aligner les devoirs du chapitre
                    const chapHw = homeworks.filter(h => h.chapterId?.toString() === chap._id.toString());
                    for (const hw of chapHw) {
                        const hwId = await DriveService.getOrCreateFolder(hw.title, chapId);
                        // Créer les 3 sous-dossiers vitaux (US #4)
                        await DriveService.getOrCreateFolder("SUJET", hwId);
                        await DriveService.getOrCreateFolder("COPIES", hwId);
                        await DriveService.getOrCreateFolder("CORRECTIONS", hwId);

                        if (hw.driveFolderId !== hwId) {
                            await (require('../models/Homework')).findByIdAndUpdate(hw._id, { driveFolderId: hwId });
                        }
                    }
                }
            }
            return { success: true };
        } catch (e) {
            console.error("❌ Erreur Sync:", e);
            return { error: e.message };
        }
    },

    deleteFile: async (id) => { 
        if (!drive || !id) return true;
        try { await drive.files.delete({ fileId: id }); return true; } catch (e) { return false; } 
    },

    uploadFile: async (folderId, fileName, buffer, mimeType) => {
        if (!drive || !folderId) return null;
        try {
            const media = { mimeType, body: Readable.from(buffer) };
            const file = await drive.files.create({
                resource: { name: fileName, parents: [folderId] },
                media, fields: 'id'
            });
            await drive.permissions.create({ fileId: file.data.id, resource: { role: 'reader', type: 'anyone' } });
            return { id: file.data.id, url: `https://drive.google.com/thumbnail?id=${file.data.id}&sz=w1200` };
        } catch (e) { return null; }
    }
};

module.exports = DriveService;