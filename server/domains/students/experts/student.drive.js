const DriveEngine = require('../../../core/drive.engine');
const mongoose = require('mongoose');

const StudentDrive = {
    createPortfolio: async (studentId) => {
        try {
            const Student = mongoose.model('Student');
            const student = await Student.findById(studentId);
            if (!student) return;

            const rootId = await DriveEngine.getOrCreateFolder("CONDA_PRO");
            const portfoliosRootId = await DriveEngine.getOrCreateFolder("PORTFOLIOS_ELEVES", rootId);
            const folderName = `${student.lastName.toUpperCase()} ${student.firstName.toUpperCase()}`;
            const studentFolderId = await DriveEngine.getOrCreateFolder(folderName, portfoliosRootId);

            await Student.findByIdAndUpdate(studentId, {
                driveFolderId: studentFolderId,
                drivePortfolioUrl: `https://drive.google.com/drive/folders/${studentFolderId}`
            });
        } catch (e) { console.error("Student Portfolio Drive Error:", e); }
    }
};
module.exports = StudentDrive;