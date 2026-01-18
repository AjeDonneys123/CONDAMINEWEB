const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

const StructureDrive = {
    createFullHierarchy: async (chapterId) => {
        try {
            const Chapter = mongoose.model('Chapter');
            const chapter = await Chapter.findById(chapterId)
                .populate('teacherId'); // Récupère les infos du prof
            
            if (!chapter) return null;

            // Résolution des noms pour le Drive (Protection contre les nulls)
            const profName = chapter.teacherId ? `${chapter.teacherId.lastName} ${chapter.teacherId.firstName}`.toUpperCase() : "PROF_INCONNU";
            const className = chapter.classroom ? chapter.classroom.toUpperCase() : "CLASSE_INCONNUE";
            const subjectName = chapter.subject ? chapter.subject.toUpperCase() : "MATIERE";
            const chapterTitle = chapter.title.toUpperCase();

            console.log(`📂 [DRIVE] Création : ${profName} > ${className} > ${subjectName} > ${chapterTitle}`);

            // 1. Racine : CONDA CLASSE
            const root = await DriveEngine.getOrCreateFolder("CONDA CLASSE");
            
            // 2. Dossier Professeur
            const profFolder = await DriveEngine.getOrCreateFolder(profName, root);
            
            // 3. Dossier Classe (ex: 6B)
            const classFolder = await DriveEngine.getOrCreateFolder(className, profFolder);
            
            // 4. Dossier Matière (ex: HISTOIRE)
            const subjectFolder = await DriveEngine.getOrCreateFolder(subjectName, classFolder);
            
            // 5. Dossier Chapitre (Le container final)
            const chapterFolder = await DriveEngine.getOrCreateFolder(chapterTitle, subjectFolder);

            // Mise à jour de la référence Drive dans la BDD
            chapter.driveFolderId = chapterFolder;
            await chapter.save();

            return chapterFolder;

        } catch (e) {
            console.error("❌ [DRIVE] Erreur Hiérarchie:", e.message);
            return null;
        }
    }
};
module.exports = StructureDrive;