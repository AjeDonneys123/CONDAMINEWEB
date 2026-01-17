




const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

/**
 * ☁️ ARCHITECTE DRIVE V3 - STRUCTURE INSTITUTIONNELLE
 * Hiérarchie : CONDA_PRO > [ANNEE] > CLASSES > [CLASSE] > [MATIERE] > [CHAPITRE]
 */
const StructureDrive = {
    createFullHierarchy: async (chapterId) => {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(chapterId)
            .populate('classId')
            .populate('subjectId')
            .populate('yearId')
            .populate('teacherId');

        if (!chap || !chap.classId || !chap.subjectId) {
            throw new Error("Données insuffisantes pour générer le Drive");
        }

        try {
            console.log(`📂 [DRIVE] Génération arborescence pour : ${chap.title}`);

            // 1. Racine (Fixe)
            const rootId = await DriveEngine.getOrCreateFolder("CONDA_PRO");
            
            // 2. Année (ex: 2025-2026)
            const yearName = chap.yearId?.label || "ARCHIVES";
            const yearFolderId = await DriveEngine.getOrCreateFolder(yearName, rootId);

            // 3. Dossier "CLASSES" (Pour regrouper toutes les classes de l'année)
            const classesRootId = await DriveEngine.getOrCreateFolder("CLASSES", yearFolderId);

            // 4. La Classe spécifique (ex: 6D)
            const classFolderId = await DriveEngine.getOrCreateFolder(chap.classId.name, classesRootId);

            // 5. La Matière dans cette classe (ex: HISTOIRE)
            const subjectFolderId = await DriveEngine.getOrCreateFolder(chap.subjectId.name, classFolderId);

            // 6. Le Chapitre (ex: LA ROME ANTIQUE)
            const chapFolderId = await DriveEngine.getOrCreateFolder(chap.title, subjectFolderId);

            // 7. Sous-dossiers de travail
            const subjectsId = await DriveEngine.getOrCreateFolder("1-DOCS_ET_SUJETS", chapFolderId);
            const correctionsId = await DriveEngine.getOrCreateFolder("2-CORRECTIONS_IA", chapFolderId);

            // Mise à jour BDD
            await Chapter.findByIdAndUpdate(chapterId, {
                driveFolderId: chapFolderId,
                driveSubjectDocsId: subjectsId,
                driveCorrectionsId: correctionsId
            });

            // LOG de sécurité (AccessLogs)
            const AccessLog = mongoose.model('AccessLog');
            await AccessLog.create({
                userId: chap.teacherId._id,
                userName: `${chap.teacherId.firstName} ${chap.teacherId.lastName}`,
                userRole: 'teacher',
                action: 'DRIVE_CHAPTER_CREATED',
                details: { chapter: chap.title, path: `${yearName}/${chap.classId.name}/${chap.subjectId.name}` }
            });

            console.log(`✅ [DRIVE] OK : ${chap.title}`);
            return chapFolderId;
        } catch (e) {
            console.error("❌ [DRIVE] Erreur:", e.message);
            throw e;
        }
    }
};

module.exports = StructureDrive;




