

const mongoose = require('mongoose');

/**
 * 💾 COUCHE DB ADMIN : Accès brut aux états système et collections
 * RÔLE : Exécuter les ordres de l'Expert sans poser de questions.
 */
const AdminDB = {
    checkConnection: () => mongoose.connection.readyState === 1,
    
    // LECTURE
    findAllClassrooms: async () => await mongoose.model('Classroom').find({}).sort({ name: 1 }).lean(),
    findAllSubjects: async () => await mongoose.model('Subject').find({}).sort({ name: 1 }).lean(),
    findAllTeachers: async () => await mongoose.model('Teacher').find({}).sort({ lastName: 1 }).lean(),
    findAllAdmins: async () => await mongoose.model('Admin').find({}).sort({ lastName: 1 }).lean(),
    findAllBugs: async () => await mongoose.model('BugReport').find({}).sort({ createdAt: -1 }).lean(),
    
    // ÉCRITURE GÉNÉRIQUE
    createItem: async (model, data) => await mongoose.model(model).create(data),
    deleteItem: async (model, id) => await mongoose.model(model).findByIdAndDelete(id),
    
    // MAINTENANCE AVANCÉE
    dropAdminIndexes: async () => {
        try {
            await mongoose.connection.collection('admins').dropIndexes();
            return true;
        } catch (e) { return false; }
    }
};

module.exports = AdminDB;

