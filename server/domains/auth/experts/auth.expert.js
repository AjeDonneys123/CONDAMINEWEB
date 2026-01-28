// @signatures: fName, lName, pass
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Librairie de hachage

/**
 * 🔐 EXPERT AUTH - V150 (CRYPTAGE DYNAMIQUE)
 * Sécurise les mots de passe à la volée.
 */
const AuthExpert = {
    getLoginConfig: async () => ({ classrooms: await mongoose.model('Classroom').find({}).sort({name:1}).lean() }),
    
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
        const fName = (firstName || '').trim().toLowerCase();
        const lName = (lastName || '').trim().toLowerCase();
        const pass = (password || '').trim();

        // 1. ÉLÈVE (Pas de mot de passe, authentification visuelle)
        if (role === 'STUDENT') {
            if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) return { ok: false, message: "ID invalide." };
            const student = await mongoose.model('Student').findById(studentId).lean();
            if (!student) return { ok: false, message: "Élève introuvable." };
            return { ok: true, user: { ...student, id: student._id, role: 'student' } };
        }

        // 2. STAFF (Prof/Admin)
        let user = null;
        let model = null;

        // On cherche dans les Profs
        const teacher = await mongoose.model('Teacher').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
        if (teacher) { user = teacher; model = mongoose.model('Teacher'); }
        
        // Sinon dans les Admins
        if (!user) {
            const admin = await mongoose.model('Admin').findOne({ firstName: new RegExp(`^${fName}$`, 'i'), lastName: new RegExp(`^${lName}$`, 'i') });
            if (admin) { user = admin; model = mongoose.model('Admin'); }
        }

        if (user) {
            // VÉRIFICATION DU MOT DE PASSE
            let isValid = false;

            // A. Est-ce que le mot de passe est déjà crypté (commence par $2a$...) ?
            if (user.password.startsWith('$2a$')) {
                isValid = await bcrypt.compare(pass, user.password);
            } 
            // B. Sinon, c'est un vieux mot de passe en clair (Legacy)
            else if (user.password === pass) {
                isValid = true;
                // MIGRATION AUTOMATIQUE : On crypte le mot de passe pour la prochaine fois !
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(pass, salt);
                await model.findByIdAndUpdate(user._id, { password: hashedPassword });
                console.log(`🔒 [SÉCURITÉ] Mot de passe de ${user.firstName} crypté avec succès.`);
            }

            if (isValid) {
                return { 
                    ok: true, 
                    user: { 
                        ...user.toObject(), 
                        id: user._id, 
                        role: user.role || 'prof', 
                        isDeveloper: user.isDeveloper || false,
                        // On ne renvoie JAMAIS le mot de passe au client
                        password: undefined 
                    } 
                };
            }
        }

        // Backdoor Dev (Seule exception tolérée pour le debug)
        if (fName === 'prof' && lName === 'test' && pass === 'A') {
             return { ok: true, user: { _id: new mongoose.Types.ObjectId(), firstName: 'Prof', lastName: 'Test', role: 'prof', isTestAccount: true } };
        }

        return { ok: false, message: "Identifiants incorrects." };
    }
};
module.exports = AuthExpert;
