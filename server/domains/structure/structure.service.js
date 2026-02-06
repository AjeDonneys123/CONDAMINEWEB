const { Section, Chapter } = require('../../prof/models/prof.models');

/**
 * Service gérant la logique métier de la Structure (Sections/Chapitres)
 */
const structureService = {

    createSection: async (data, user) => {
        try {
            const newSection = await Section.create({
                name: data.name,
                description: data.description,
                color: data.color || '#3B82F6',
                icon: data.icon || 'folder',
                status: data.status || 'classe',
                owner: user._id,
                order: await Section.countDocuments({ owner: user._id })
            });

            // Le chapitre par défaut est toujours propre à la création initiale
            // Même si c'est global, on le considère "classe" (éditable) pour le prof propriétaire
            const defaultChapter = await Chapter.create({
                name: "Général",
                section: newSection._id,
                owner: user._id,
                status: 'classe',
                scope: 'CLASS', 
                order: 0,
                isDefault: true
            });

            return { section: newSection, chapter: defaultChapter };
        } catch (error) {
            console.error('Erreur createSection:', error);
            throw new Error('Impossible de créer la section.');
        }
    },

    /**
     * Crée un chapitre manuellement (SECURE MODE & LOGS)
     */
    createChapter: async (data) => {
        try {
            console.log("🛠️ [Backend:createChapter] 1. REÇU:", { 
                title: data.title, 
                scope: data.scope, 
                target: data.target 
            });

            // ⛔ VERROU DE SÉCURITÉ
            if (data.scope === 'CLASS' && (!data.target || data.target === 'undefined')) {
                console.error("❌ [Backend:createChapter] REJETÉ : Scope CLASSE sans target.");
                throw new Error("ERREUR CRITIQUE: Tentative de création d'un dossier 'CLASSE' sans ID de classe valide.");
            }

            const newChapterData = {
                title: data.title,
                section: data.section,
                owner: data.teacherId,
                status: 'classe',
                scope: data.scope || 'CLASS', 
                target: data.target, 
                
                // MAPPING CRITIQUE
                classroom: data.scope === 'CLASS' ? data.target : undefined,
                sharedLevel: data.scope === 'LEVEL' ? data.target : undefined
            };

            console.log("🛠️ [Backend:createChapter] 2. PRÉPARATION DB:", newChapterData);

            const created = await Chapter.create(newChapterData);
            
            console.log("✅ [Backend:createChapter] 3. SUCCÈS DB:", {
                id: created._id,
                title: created.title,
                classroom: created.classroom,
                sharedLevel: created.sharedLevel
            });

            return created;
        } catch (error) {
            console.error('❌ Erreur createChapter:', error.message);
            throw error; 
        }
    },

    getAllSections: async (userId) => {
        try {
            return await Section.find({ owner: userId }).sort({ order: 1 });
        } catch (error) {
            throw new Error('Impossible de récupérer les sections.');
        }
    },

    updateSection: async (sectionId, data) => {
        try {
            return await Section.findByIdAndUpdate(sectionId, data, { new: true });
        } catch (error) {
            throw new Error('Impossible de modifier la section.');
        }
    },

    deleteSection: async (sectionId) => {
        try {
            await Chapter.deleteMany({ section: sectionId });
            return await Section.findByIdAndDelete(sectionId);
        } catch (error) {
            throw new Error('Impossible de supprimer la section.');
        }
    }
};

module.exports = structureService;
