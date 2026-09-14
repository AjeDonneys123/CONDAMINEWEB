const mongoose = require('mongoose');

async function ensureEssentialIndexes() {
    try {
        const Student = mongoose.model('Student');
        const Chapter = mongoose.model('Chapter');
        const Homework = mongoose.model('Homework');
        const LearningModule = mongoose.model('LearningModule');
        const Submission = mongoose.model('Submission');
        const Enrollment = mongoose.models.Enrollment ? mongoose.model('Enrollment') : null;

        const tasks = [
            Student.collection.createIndex({ currentClass: 1 }, { background: true }),
            Student.collection.createIndex({ classId: 1 }, { background: true }),
            Chapter.collection.createIndex({ teacherId: 1, active: 1, isArchived: 1 }, { background: true }),
            Chapter.collection.createIndex({ classroom: 1 }, { background: true }),
            Homework.collection.createIndex({ assignedStudents: 1, isAllClass: 1 }, { background: true }),
            Homework.collection.createIndex({ chapterId: 1 }, { background: true }),
            Homework.collection.createIndex({ teacherId: 1 }, { background: true }),
            LearningModule.collection.createIndex({ assignedStudents: 1, active: 1 }, { background: true }),
            LearningModule.collection.createIndex({ chapterId: 1 }, { background: true }),
            Submission.collection.createIndex({ studentId: 1, homeworkId: 1 }, { background: true })
        ];

        if (Enrollment) {
            tasks.push(
                Enrollment.collection.createIndex({ studentId: 1, classId: 1 }, { background: true }),
                Enrollment.collection.createIndex({ classId: 1 }, { background: true })
            );
        }

        await Promise.all(tasks);
        console.log('⚡ Index MongoDB essentiels vérifiés/créés en arrière-plan.');
    } catch (e) {
        console.warn('⚠️ Avertissement création index MongoDB:', e.message);
    }
}

module.exports = { ensureEssentialIndexes };
