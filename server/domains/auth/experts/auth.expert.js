// @signatures: fName, lName, pass
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Librairie de hachage
const BCRYPT_HASH_RE = /^\$2[aby]\$/;

/**
 * 🔐 EXPERT AUTH - V150 (CRYPTAGE DYNAMIQUE)
 * Sécurise les mots de passe à la volée.
 */
const AuthExpert = {
    getLoginConfig: async () => ({ classrooms: await mongoose.model('Classroom').find({}).sort({name:1}).lean() }),
    
    getAllProfilesForFinder: async () => {
        const [students, teachers, admins] = await Promise.all([
            mongoose.model('Student').find({}, 'firstName lastName currentClass').lean(),
            mongoose.model('Teacher').find({}, 'firstName lastName').lean(),
            mongoose.model('Admin').find({}, 'firstName lastName').lean()
        ]);

        const studentItems = (students || []).map(s => ({
            id: s._id,
            type: 'student',
            firstName: s.firstName,
            lastName: s.lastName,
            className: s.currentClass || "SANS CLASSE"
        }));

        const teacherItems = [...(teachers || []), ...(admins || [])].map(t => ({
            id: t._id,
            type: 'teacher',
            firstName: t.firstName,
            lastName: t.lastName,
            className: ''
        }));

        return [...studentItems, ...teacherItems];
    },

    getAllStudentsForFinder: async () => {
        const students = await mongoose.model('Student').find({}, 'firstName lastName currentClass').lean();
        return students.map(s => ({
            id: s._id,
            type: 'student',
            firstName: s.firstName,
            lastName: s.lastName,
            className: s.currentClass || "SANS CLASSE"
        }));
    },

    getStudentsForSelection: async (classId) => {
        if (!mongoose.Types.ObjectId.isValid(classId)) return [];

        const Classroom = mongoose.model('Classroom');
        const Student = mongoose.model('Student');
        const Enrollment = mongoose.model('Enrollment');
        const cls = await Classroom.findById(classId).lean();
        if (!cls) return [];

        // Source 1 (legacy): table Enrollment
        const enrollments = await Enrollment.find({ classId }).populate('studentId').lean();
        const enrollmentStudents = enrollments.filter(e => e.studentId).map(e => e.studentId);

        // Source 2 (canonique actuelle): Student.classId / Student.assignedGroups
        let directStudents = [];
        if (cls.type === 'GROUP') {
            directStudents = await Student.find({ assignedGroups: cls._id }).lean();
        } else {
            directStudents = await Student.find({ classId: cls._id }).lean();
        }

        // Fusion sans doublons
        const map = new Map();
        [...enrollmentStudents, ...directStudents].forEach(s => {
            if (!s || !s._id) return;
            map.set(String(s._id), s);
        });

        return [...map.values()]
            .map(s => ({ id: s._id, name: `${s.firstName} ${s.lastName}` }))
            .sort((a, b) => a.name.localeCompare(b.name));
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

            // A. Mot de passe déjà hashé bcrypt ($2a$ / $2b$ / $2y$)
            if (BCRYPT_HASH_RE.test(String(user.password || ''))) {
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
