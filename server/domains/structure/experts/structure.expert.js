// @signatures: isGeneralSection, isGeneralTitle
const StructureDB = require('../db/structure.db');
const StructureDrive = require('./structure.drive');
const mongoose = require('mongoose');

/**
 * 🧠 EXPERT STRUCTURE - VERSION 436 (SECURITÉ DERNIER CHAPITRE)
 * Empêche la suppression du dernier chapitre d'une section.
 */
const StructureExpert = {
    
    getChapters: async () => {
        const chapters = await StructureDB.getAllChapters();
        return chapters.map(c => ({
            ...c,
            _id: String(c._id),
            teacherId: c.teacherId ? String(c.teacherId._id || c.teacherId) : null,
            isArchived: c.isArchived === true, 
            section: (c.section || "GÉNÉRAL").toUpperCase().trim(),
            classroom: c.classroom ? c.classroom.toUpperCase().trim() : ""
        }));
    },

    createChapter: async (data) => {
        if (!data.teacherId) throw new Error("Propriétaire (teacherId) manquant.");
        
        const cleanData = { 
            ...data, 
            title: data.title ? data.title.toUpperCase().trim() : "NOUVEAU DOSSIER",
            section: data.section ? data.section.toUpperCase().trim() : "GÉNÉRAL",
            classroom: data.classroom ? data.classroom.toUpperCase().trim() : "",
            isArchived: false 
        };
        
        return await StructureDB.createChapter(cleanData);
    },

    verifyAssetsIntegrity: async (homeworkId) => {
        const Homework = mongoose.model('Homework');
        const hw = await Homework.findById(homeworkId).lean();
        if (!hw) return { ok: false, error: "Devoir introuvable" };

        const brokenLinks = [];
        const drive = require('googleapis').google.drive({ version: 'v3', auth: require('../../../core/drive.engine').oauth2Client });

        for (const level of hw.levels) {
            const allUrls = [...(level.instructionUrls || []), ...(level.attachmentUrls || [])];
            for (const url of allUrls) {
                const driveId = url.match(/[-\w]{25,}/);
                if (driveId) {
                    try { await drive.files.get({ fileId: driveId[0], fields: 'id' }); } catch (e) { brokenLinks.push(url); }
                }
            }
        }

        return { ok: brokenLinks.length === 0, brokenLinks, totalChecked: hw.levels.length };
    },

    ensureVault: async () => {
        return await StructureDrive.ensureVault();
    },

    deleteChapter: async (id) => {
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');
        const GameLevel = mongoose.model('GameLevel');
        const ScanSession = mongoose.model('ScanSession');

        const target = await Chapter.findById(id);
        if (!target) throw new Error("Dossier introuvable.");

        // 1. Protection du dossier GÉNÉRAL principal
        const isGeneralSection = (target.section || "").toUpperCase() === "GÉNÉRAL";
        const isGeneralTitle = (target.title || "").toUpperCase() === "GÉNÉRAL";

        if (isGeneralSection && isGeneralTitle) {
            throw new Error("⛔ INTERDIT : Le dossier 'GÉNÉRAL' principal est indestructible.");
        }

        // 2. NOUVELLE RÈGLE V436 : Protection du DERNIER chapitre
        // On compte combien de chapitres (non archivés) existent dans cette section pour ce prof
        const siblingCount = await Chapter.countDocuments({
            teacherId: target.teacherId,
            section: target.section
        });

        if (siblingCount <= 1) {
            throw new Error("⛔ ACTION REFUSÉE : Impossible de supprimer le dernier dossier d'une section.");
        }

        // 3. LOGIQUE POUBELLE
        let fallback = await Chapter.findOne({ teacherId: target.teacherId, section: target.section, title: "GÉNÉRAL" });
        // Si pas de général dans la section, on cherche un autre chapitre au hasard dans la même section pour sauver les meubles
        if (!fallback) {
            fallback = await Chapter.findOne({ 
                teacherId: target.teacherId, 
                section: target.section, 
                _id: { $ne: target._id } // Pas celui qu'on supprime
            });
        }
        
        // Si toujours rien (cas Général Global), on prend le Global
        if (!fallback) fallback = await Chapter.findOne({ teacherId: target.teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        if (!fallback) fallback = await Chapter.create({ teacherId: target.teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL", classroom: "" });

        console.log(`♻️ [DELETE-LOGIC] Migration contenu de "${target.title}" vers "${fallback.title}"`);
        
        await Homework.updateMany({ chapterId: id }, { chapterId: fallback._id });
        await GameLevel.updateMany({ chapterId: id }, { chapterId: fallback._id });
        await ScanSession.updateMany({ chapterId: id }, { chapterId: fallback._id });

        return await StructureDB.deleteChapter(id);
    }
};

module.exports = StructureExpert;
