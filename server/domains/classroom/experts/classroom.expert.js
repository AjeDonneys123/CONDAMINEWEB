const mongoose = require('mongoose');
const ClassroomAI = require('../ai/plan.ai');

const ClassroomExpert = {
    getClassroomData: async (classId, teacherId) => {
        const Student = mongoose.model('Student');
        const Classroom = mongoose.model('Classroom');
        const Homework = mongoose.model('Homework');
        const Game = mongoose.model('GameLevel');
        const Submission = mongoose.model('Submission');
        const GameProgress = mongoose.model('GameProgress');
        const Chapter = mongoose.model('Chapter');

        const cls = await Classroom.findById(classId).lean();
        if (!cls) return [];
        const studentQuery = cls.type === 'GROUP' ? { assignedGroups: cls._id } : { classId: cls._id };
        const students = await Student.find(studentQuery).lean();
        const activeChapters = await Chapter.find({ teacherId, isArchived: false }, '_id').lean();
        const activeChapIds = activeChapters.map(c => c._id);

        const activeHomeworks = await Homework.find({ chapterId: { $in: activeChapIds } }, '_id title isAllClass assignedStudents').lean();
        const activeGames = await Game.find({ chapterId: { $in: activeChapIds } }, '_id title isAllClass assignedStudents').lean();

        const studentIds = students.map(s => s._id);
        const submissions = await Submission.find({ studentId: { $in: studentIds }, homeworkId: { $in: activeHomeworks.map(h => h._id) } }, 'studentId homeworkId').lean();
        const progresses = await GameProgress.find({ studentId: { $in: studentIds }, gameId: { $in: activeGames.map(g => g._id) } }, 'studentId gameId levelReached').lean();

        const now = new Date();

        return Promise.all(students.map(async s => {
            const sId = String(s._id);
            const indicators = [];

            if (s.punishmentStatus === 'PENDING' && s.punishmentDueDate && new Date(s.punishmentDueDate) < now) {
                await Student.findByIdAndUpdate(s._id, { punishmentStatus: 'LATE' });
                s.punishmentStatus = 'LATE';
            }

            activeHomeworks.forEach(hw => {
                let isAssigned = hw.isAllClass || (hw.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const hasSub = submissions.some(sub => String(sub.studentId) === sId && String(sub.homeworkId) === String(hw._id));
                    indicators.push({ type: 'homework', status: hasSub ? 'done' : 'todo' });
                }
            });

            activeGames.forEach(g => {
                let isAssigned = g.isAllClass || (g.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const prog = progresses.find(p => String(p.studentId) === sId && String(p.gameId) === String(g._id));
                    let status = 'todo'; 
                    if (prog) status = prog.levelReached >= 1 ? 'done' : 'failed';
                    indicators.push({ type: 'game', status });
                }
            });

            const myNote = (s.teacherNotes || []).find(n => n.teacherId === String(teacherId));
            return { ...s, indicators, myNote: myNote ? myNote.text : "" };
        }));
    },

    addBehavior: async (sid, type, tid, extra) => {
        const Student = mongoose.model('Student');
        const Homework = mongoose.model('Homework');
        const s = await Student.findById(sid);
        
        if(!s.behaviorRecords) s.behaviorRecords=[];
        let r = s.behaviorRecords.find(x=>x.teacherId===tid);
        if(!r) { r={teacherId:tid,baseScore:15,crosses:0,bonuses:0,weeksToRedemption:3}; s.behaviorRecords.push(r); r=s.behaviorRecords[s.behaviorRecords.length-1]; }
        
        if(!s.teacherNotes) s.teacherNotes=[];
        let n = s.teacherNotes.find(x=>x.teacherId===tid);
        if(!n) { n={teacherId:tid,text:""}; s.teacherNotes.push(n); n=s.teacherNotes[s.teacherNotes.length-1]; }

        if(type==='BONUS') r.bonuses++;
        else if(type==='REMOVE_BONUS') r.bonuses=Math.max(0,r.bonuses-1);
        else if(type==='CROSS') {
            r.crosses++;
            r.weeksToRedemption=3;
            if(r.crosses >= 3) {
                r.crosses = 0;
                s.punishmentStatus = 'PENDING';
                const dueDate = new Date();
                dueDate.setDate(dueDate.getDate() + 7);
                s.punishmentDueDate = dueDate;

                const punishments = await Homework.find({ isPunishment: true, teacherId: tid });
                const validPunishment = punishments.find(p => p.targetClassrooms.includes(s.currentClass));

                if (validPunishment) {
                    if (!validPunishment.assignedStudents.includes(s._id)) {
                        validPunishment.assignedStudents.push(s._id);
                        await validPunishment.save();
                    }
                }
            }
        } 
        else if(type==='REMOVE_CROSS') r.crosses=Math.max(0,r.crosses-1);
        else if(type==='SAVE_NOTE') n.text=extra||"";
        
        else if (type === 'REMOVE_PUNISHMENT') {
            s.punishmentStatus = 'NONE';
            s.punishmentDueDate = null;
            const punishments = await Homework.find({ isPunishment: true, teacherId: tid, assignedStudents: sid });
            for (const p of punishments) {
                p.assignedStudents = p.assignedStudents.filter(id => String(id) !== String(sid));
                await p.save();
            }
        }

        s.markModified('behaviorRecords');
        s.markModified('teacherNotes');
        await s.save();
        return s;
    },

    swapSeats: async (id1, id2) => { const Student = mongoose.model('Student'); const s1 = await Student.findById(id1); const s2 = await Student.findById(id2); const tx = s1.seatX; const ty = s1.seatY; s1.seatX = s2.seatX; s1.seatY = s2.seatY; s2.seatX = tx; s2.seatY = ty; await s1.save(); await s2.save(); return {ok:true}; },
    moveStudentTo: async (sid, x, y) => { const Student = mongoose.model('Student'); const s = await Student.findById(sid); const o = await Student.findOne({classId:s.classId, seatX:x, seatY:y, _id:{$ne:sid}}); if(o){o.seatX=s.seatX;o.seatY=s.seatY;await o.save();} s.seatX=x;s.seatY=y;await s.save(); return {ok:true}; },
    
    applyPlanFromImage: async (classId, file) => {
        const Student = mongoose.model('Student');
        const Classroom = mongoose.model('Classroom');
        const cls = await Classroom.findById(classId).lean();
        if (!cls) throw new Error('Classe/Groupe introuvable');
        
        // 1. Récupérer les élèves de cette classe en BDD
        const dbStudents = await Student.find(cls.type === 'GROUP' ? { assignedGroups: cls._id } : { classId: cls._id }).lean();
        
        // 2. Lancer l'analyse IA
        const aiResults = await ClassroomAI.analyzePlanImage(file.path, file.mimetype, dbStudents);
        console.log(`📡 IA a renvoyé ${aiResults.length} positions.`);

        const updates = [];
        let matchCount = 0;

        // 3. Mapping intelligent
        for (const entry of aiResults) {
            if (!entry.name) continue;

            const cleanName = (s) => s.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const aiName = cleanName(entry.name);

            // On cherche l'élève qui correspond le mieux
            const student = dbStudents.find(s => {
                const fullName = cleanName(`${s.firstName} ${s.lastName}`);
                return fullName.includes(aiName) || aiName.includes(fullName);
            });

            if (student) {
                matchCount++;
                updates.push(Student.findByIdAndUpdate(student._id, {
                    seatX: parseInt(entry.x) || 0,
                    seatY: parseInt(entry.y) || 0
                }));
            }
        }

        if (updates.length > 0) {
            await Promise.all(updates);
        }

        console.log(`✅ Mise à jour terminée : ${matchCount} élèves placés.`);
        return updates;
    },

    applyWeeklyRedemption: async (cid, tid) => { const S = mongoose.model('Student'); const sts = await S.find({classId:cid}); let c=0; for(const s of sts){if(!s.behaviorRecords)continue;const r=s.behaviorRecords.find(x=>x.teacherId===String(tid));if(r&&r.crosses>0){r.weeksToRedemption=(r.weeksToRedemption||3)-1;if(r.weeksToRedemption<=0){r.crosses=Math.max(0,r.crosses-1);r.weeksToRedemption=3;}s.markModified('behaviorRecords');await s.save();c++;}} return {ok:true,count:c}; },
    updateLayout: async (cid, data) => { 
        const update = {};
        if (data.separators !== undefined) update['layout.separators'] = data.separators;
        if (data.cols !== undefined) update['layout.cols'] = data.cols;
        if (data.rows !== undefined) update['layout.rows'] = data.rows;
        
        await mongoose.model('Classroom').findByIdAndUpdate(cid, { $set: update }); 
        return { ok: true }; 
    }
};

module.exports = ClassroomExpert;
