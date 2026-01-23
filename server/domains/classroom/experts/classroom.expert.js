const mongoose = require('mongoose');
const ClassroomAI = require('../ai/plan.ai');

const ClassroomExpert = {
    
    // 1. DATA ENRICHIE : CALCUL DES PASTILLES (Mise à jour logique Jeux)
    getClassroomData: async (classId, teacherId) => {
        const Student = mongoose.model('Student');
        const Homework = mongoose.model('Homework');
        const Game = mongoose.model('GameLevel');
        const Submission = mongoose.model('Submission');
        const GameProgress = mongoose.model('GameProgress');
        const Chapter = mongoose.model('Chapter');

        // A. Élèves
        const students = await Student.find({ classId }).lean();

        // B. Activités ACTIVES
        const activeChapters = await Chapter.find({ teacherId, isArchived: false }, '_id').lean();
        const activeChapIds = activeChapters.map(c => c._id);

        const activeHomeworks = await Homework.find({ chapterId: { $in: activeChapIds } }, '_id title isAllClass assignedStudents').lean();
        const activeGames = await Game.find({ chapterId: { $in: activeChapIds } }, '_id title isAllClass assignedStudents').lean();

        // C. Traces
        const studentIds = students.map(s => s._id);
        const submissions = await Submission.find({ studentId: { $in: studentIds }, homeworkId: { $in: activeHomeworks.map(h => h._id) } }, 'studentId homeworkId').lean();
        const progresses = await GameProgress.find({ studentId: { $in: studentIds }, gameId: { $in: activeGames.map(g => g._id) } }, 'studentId gameId levelReached').lean();

        // D. Mapping
        return students.map(s => {
            const sId = String(s._id);
            const indicators = [];

            // Devoirs (Vert / Rouge)
            activeHomeworks.forEach(hw => {
                let isAssigned = hw.isAllClass || (hw.assignedStudents || []).some(id => String(id) === sId);
                if (isAssigned) {
                    const hasSub = submissions.some(sub => String(sub.studentId) === sId && String(sub.homeworkId) === String(hw._id));
                    indicators.push({ type: 'homework', status: hasSub ? 'done' : 'todo' });
                }
            });

            // Jeux (Violet / Bleu / Rose)
            activeGames.forEach(g => {
                let isAssigned = g.isAllClass || (g.assignedStudents || []).some(id => String(id) === sId);
                
                if (isAssigned) {
                    const prog = progresses.find(p => String(p.studentId) === sId && String(p.gameId) === String(g._id));
                    
                    let status = 'todo'; // ROSE (Pas joué)
                    
                    if (prog) {
                        if (prog.levelReached >= 1) {
                            status = 'done'; // VIOLET (Gagné)
                        } else {
                            status = 'failed'; // BLEU (Joué mais perdu)
                        }
                    }
                    
                    indicators.push({ type: 'game', status });
                }
            });

            // Note Prof
            const myNote = (s.teacherNotes || []).find(n => n.teacherId === String(teacherId));

            return { ...s, indicators, myNote: myNote ? myNote.text : "" };
        });
    },

    // ... (Le reste est inchangé, je conserve les versions courtes pour la propreté) ...
    swapSeats: async (id1, id2) => { const Student = mongoose.model('Student'); const s1 = await Student.findById(id1); const s2 = await Student.findById(id2); const tx = s1.seatX; const ty = s1.seatY; s1.seatX = s2.seatX; s1.seatY = s2.seatY; s2.seatX = tx; s2.seatY = ty; await s1.save(); await s2.save(); return {ok:true}; },
    moveStudentTo: async (sid, x, y) => { const Student = mongoose.model('Student'); const s = await Student.findById(sid); const o = await Student.findOne({classId:s.classId, seatX:x, seatY:y, _id:{$ne:sid}}); if(o){o.seatX=s.seatX;o.seatY=s.seatY;await o.save();} s.seatX=x;s.seatY=y;await s.save(); return {ok:true}; },
    applyPlanFromImage: async (cid, f) => { const Student = mongoose.model('Student'); const sts = await Student.find({classId:cid}).lean(); const map = await ClassroomAI.analyzePlanImage(f.path, f.mimetype, sts); const ups=[]; map.forEach(m=>{if(m.studentId) ups.push(Student.findByIdAndUpdate(m.studentId, {seatX:m.seatX, seatY:m.seatY}));}); await Promise.all(ups); return map; },
    addBehavior: async (sid, type, tid, extra) => { const Student = mongoose.model('Student'); const s = await Student.findById(sid); if(!s.behaviorRecords) s.behaviorRecords=[]; let r=s.behaviorRecords.find(x=>x.teacherId===tid); if(!r){r={teacherId:tid,crosses:0,bonuses:0,weeksToRedemption:3};s.behaviorRecords.push(r);r=s.behaviorRecords[s.behaviorRecords.length-1];} if(!s.teacherNotes)s.teacherNotes=[]; let n=s.teacherNotes.find(x=>x.teacherId===tid); if(!n){n={teacherId:tid,text:""};s.teacherNotes.push(n);n=s.teacherNotes[s.teacherNotes.length-1];} if(type==='BONUS')r.bonuses++; else if(type==='REMOVE_BONUS')r.bonuses=Math.max(0,r.bonuses-1); else if(type==='CROSS'){r.crosses++;r.weeksToRedemption=3; if(r.crosses%3===0)await ClassroomExpert.triggerPunishment(s,tid);} else if(type==='REMOVE_CROSS')r.crosses=Math.max(0,r.crosses-1); else if(type==='SAVE_NOTE')n.text=extra||""; s.markModified('behaviorRecords'); s.markModified('teacherNotes'); await s.save(); return s; },
    triggerPunishment: async (s, tid) => { const C = mongoose.model('Chapter'); const H = mongoose.model('Homework'); const Sn = mongoose.model('Sanction'); let c = await C.findOne({title:"PUNITIONS", teacherId:tid}); if(!c) c=await C.create({title:"PUNITIONS", section:"DISCIPLINE", teacherId:tid, classroom:"TOUTES", isArchived:true}); let h=await H.findOne({chapterId:c._id}); if(!h) h=await H.create({title:"PUNITION", chapterId:c._id, teacherId:tid, levels:[{instruction:"Recopier...", instructionUrls:[], aiHints:"", attachmentUrls:[]}], isAllClass:false, assignedStudents:[]}); if(!h.assignedStudents.includes(s._id)){h.assignedStudents.push(s._id); await h.save();} await Sn.create({studentId:s._id, homeworkId:h._id, dueDate:new Date(Date.now()+7*24*3600*1000), status:'PENDING'}); },
    applyWeeklyRedemption: async (cid, tid) => { const S = mongoose.model('Student'); const sts = await S.find({classId:cid}); let c=0; for(const s of sts){if(!s.behaviorRecords)continue;const r=s.behaviorRecords.find(x=>x.teacherId===String(tid));if(r&&r.crosses>0){r.weeksToRedemption=(r.weeksToRedemption||3)-1;if(r.weeksToRedemption<=0){r.crosses=Math.max(0,r.crosses-1);r.weeksToRedemption=3;}s.markModified('behaviorRecords');await s.save();c++;}} return {ok:true,count:c}; },
    updateLayoutSeparators: async (cid, seps) => { await mongoose.model('Classroom').findByIdAndUpdate(cid, {'layout.separators':seps}); return {ok:true}; }
};

module.exports = ClassroomExpert;