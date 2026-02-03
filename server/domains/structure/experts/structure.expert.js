// @signatures: isGeneralSection, isGeneralTitle
const StructureDB = require('../db/structure.db');
const StructureDrive = require('./structure.drive');
const mongoose = require('mongoose');

/**
 * 🧠 EXPERT STRUCTURE - VERSION 436 (SECURITÉ RACINE INDESTRUCTIBLE)
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

    deleteChapter: async (id) => {
        const Chapter = mongoose.model('Chapter');
        const target = await Chapter.findById(id);
        if (!target) throw new Error("Dossier introuvable.");

        // --- RÈGLE D'OR ABSOLUE V124 : PROTECTION DE LA RACINE ---
        const isRoot = (target.section || "").toUpperCase() === "GÉNÉRAL" && (target.title || "").toUpperCase() === "GÉNÉRAL";
        if (isRoot) {
            throw new Error("⛔ INTERDIT : Le dossier racine GÉNÉRAL / GÉNÉRAL est indestructible.");
        }

        // Migration orphelins avant suppression
        const Homework = mongoose.model('Homework');
        const GameLevel = mongoose.model('GameLevel');
        let fallback = await Chapter.findOne({ teacherId: target.teacherId, section: "GÉNÉRAL", title: "GÉNÉRAL" });
        if (!fallback) fallback = await Chapter.create({ title: "GÉNÉRAL", section: "GÉNÉRAL", teacherId: target.teacherId });

        await Homework.updateMany({ chapterId: id }, { chapterId: fallback._id });
        await GameLevel.updateMany({ chapterId: id }, { chapterId: fallback._id });

        return await StructureDB.deleteChapter(id);
    }
};

module.exports = StructureExpert;
