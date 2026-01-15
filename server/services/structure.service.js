const mongoose = require('mongoose');
const DriveService = require('./drive.service');

/**
 * 📂 SERVICE : LOGIQUE D'ARBORESCENCE (ISOLÉE)
 * Mission : Réconcilier BDD et Drive pour les chapitres.
 */
const StructureService = {
    createChapter: async (data) => {
        const { teacherId, classroom, subject, title, _id } = data;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Enseignant introuvable");

        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const driveContext = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
        
        if (!driveContext.chapterId) throw new Error("Échec Drive physique");

        const Chapter = mongoose.model('Chapter');
        if (_id) {
            return await Chapter.findByIdAndUpdate(_id, { 
                title, subject, classroom, driveFolderId: driveContext.chapterId 
            }, { new: true });
        } else {
            return await Chapter.create({ 
                title, subject, classroom, driveFolderId: driveContext.chapterId, teacherId 
            });
        }
    },

    deleteChapter: async (id) => {
        const Chapter = mongoose.model('Chapter');
        const chap = await Chapter.findById(id);
        if (chap?.driveFolderId) {
            await DriveService.deleteEntity(chap.driveFolderId);
        }
        return await Chapter.findByIdAndDelete(id);
    }
};

module.exports = StructureService;