const StructureDB = require('../db/structure.db');
const StructureDrive = require('./structure.drive');
const mongoose = require('mongoose');

/**
 * 🧠 EXPERT STRUCTURE - VERSION 94
 * Garant de la visibilité et de l'intégrité des liens Cloud/BDD.
 */
const StructureExpert = {
    /**
     * Retourne les chapitres avec une sécurité sur les IDs et la visibilité
     */
    getChapters: async () => {
        const chapters = await StructureDB.getAllChapters();
        return chapters.map(c => ({
            ...c,
            _id: String(c._id),
            // On s'assure que le lien avec l'enseignant est une string pour le filtrage React
            teacherId: c.teacherId ? String(c.teacherId._id || c.teacherId) : null,
            isArchived: c.isArchived === true, 
            section: (c.section || "GÉNÉRAL").toUpperCase().trim(),
            classroom: c.classroom ? c.classroom.toUpperCase().trim() : ""
        }));
    },

    /**
     * Crée un chapitre en forçant la structure de routage
     */
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

    /**
     * Vérifie si les IDs Drive stockés en BDD pour un devoir sont toujours valides
     * Évite les erreurs 404/403 côté élève.
     */
    verifyAssetsIntegrity: async (homeworkId) => {
        const Homework = mongoose.model('Homework');
        const hw = await Homework.findById(homeworkId).lean();
        if (!hw) return { ok: false, error: "Devoir introuvable" };

        const brokenLinks = [];
        const drive = require('googleapis').google.drive({ 
            version: 'v3', 
            auth: require('../../../core/drive.engine').oauth2Client 
        });

        // Scan des URLs pour trouver des IDs Drive
        for (const level of hw.levels) {
            const allUrls = [...(level.instructionUrls || []), ...(level.attachmentUrls || [])];
            for (const url of allUrls) {
                const driveId = url.match(/[-\w]{25,}/);
                if (driveId) {
                    try {
                        await drive.files.get({ fileId: driveId[0], fields: 'id' });
                    } catch (e) {
                        brokenLinks.push(url);
                    }
                }
            }
        }

        return {
            ok: brokenLinks.length === 0,
            brokenLinks,
            totalChecked: hw.levels.length
        };
    },

    /**
     * Prépare le Vault (Réservoir)
     */
    ensureVault: async () => {
        return await StructureDrive.ensureVault();
    },

    deleteChapter: async (id) => {
        // Avant de supprimer le chapitre, on pourrait vérifier s'il reste des devoirs
        return await StructureDB.deleteChapter(id);
    }
};

module.exports = StructureExpert;