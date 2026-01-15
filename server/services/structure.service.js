const mongoose = require('mongoose');
const DriveService = require('./drive.service');

/**
 * 📂 SERVICE : LOGIQUE D'ARBORESCENCE
 * Mission : Réconcilier la BDD et le Drive Pro.
 */
const StructureService = {
    createChapter: async (teacherId, classroom, subject, title, _id = null) => {
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Enseignant introuvable");

        const teacherName = `${prof.firstName} ${prof.lastName}`;
        
        // Création physique Drive
        const driveContext = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
        if (!driveContext.chapterId) throw new Error("Erreur Drive");

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
    }
};

module.exports = StructureService;