const mongoose = require('mongoose');
const DriveService = require('./drive.service');

/**
 * 📂 SERVICE : STRUCTURE
 * Mission : Réconcilier BDD et Drive avec Filet de Sécurité.
 */
const StructureService = {
    createChapter: async (data) => {
        const { teacherId, classroom, subject, title, _id } = data;
        const prof = await mongoose.model('Teacher').findById(teacherId);
        if (!prof) throw new Error("Prof introuvable");

        const teacherName = `${prof.firstName} ${prof.lastName}`;
        const driveContext = await DriveService.getMirrorPathId(teacherName, classroom, subject, title);
        
        const Chapter = mongoose.model('Chapter');
        const payload = { title: title.toUpperCase(), subject, classroom, driveFolderId: driveContext.chapterId, teacherId };
        return _id ? await Chapter.findByIdAndUpdate(_id, payload, { new: true }) : await Chapter.create(payload);
    },

    deleteChapter: async (id) => {
        const Chapter = mongoose.model('Chapter');
        const target = await Chapter.findById(id);
        if (!target) return;

        // US#16 : Migration automatique vers "AUTRE"
        if (target.title !== "AUTRE") {
            let fallback = await Chapter.findOne({ title: "AUTRE", classroom: target.classroom, subject: target.subject });
            if (!fallback) fallback = await Chapter.create({ title: "AUTRE", subject: target.subject, classroom: target.classroom, teacherId: target.teacherId });
            await mongoose.model('Homework').updateMany({ chapterId: id }, { chapterId: fallback._id });
        }

        if (target.driveFolderId) await DriveService.deleteEntity(target.driveFolderId);
        return await Chapter.findByIdAndDelete(id);
    }
};

module.exports = StructureService;