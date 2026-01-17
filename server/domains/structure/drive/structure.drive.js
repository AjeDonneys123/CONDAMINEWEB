const DriveEngine = require('../../../core/drive.engine');
const StructureDrive = {
    createPath: async (prof, cls, sub, title) => {
        const root = await DriveEngine.getOrCreateFolder("CONDA CLASSE");
        const p = await DriveEngine.getOrCreateFolder(prof, root);
        const c = await DriveEngine.getOrCreateFolder(cls, p);
        const dev = await DriveEngine.getOrCreateFolder("DEVOIRS", c);
        const s = await DriveEngine.getOrCreateFolder(sub, dev);
        return await DriveEngine.getOrCreateFolder(title, s);
    }
};
module.exports = StructureDrive;