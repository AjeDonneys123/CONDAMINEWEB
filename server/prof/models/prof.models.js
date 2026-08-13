// @signatures: ProfModels, getModel
const mongoose = require('mongoose');
const TEST_ACCOUNT_EMAIL = 'vuillet433@gmail.com';

// --- SCHÉMAS UTILITAIRES ---

const SectionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    color: { type: String, default: '#6366f1' },
    scope: { type: String, enum: ['GLOBAL', 'LEVEL', 'CLASS'], default: 'GLOBAL' },
    target: { type: String, default: null },
    hiddenIn: { type: [String], default: [] } 
}, { _id: false });

const FrameSchema = new mongoose.Schema({
    url: String,
    name: String,
    type: { type: String, default: 'image' } 
}, { _id: false });

const ActionSchema = new mongoose.Schema({
    name: { type: String, default: "Nouvelle Action" },
    speed: { type: Number, default: 100 }, 
    frames: { type: [FrameSchema], default: [] }, 
    sounds: { type: [FrameSchema], default: [] }
}, { _id: false });

const ActorSchema = new mongoose.Schema({
    id: String, 
    name: String, 
    actions: { type: [ActionSchema], default: [] },
    currentAction: { type: String, default: "" },
    initialX: { type: Number, default: 50 }, 
    initialY: { type: Number, default: 50 }, 
    scale: { type: Number, default: 1 },
    direction: { type: Number, default: 0 },
    rotationStyle: { type: String, default: 'all' }
}, { _id: false });

const SceneSchema = new mongoose.Schema({
    name: String,
    backdrops: [{ name: String, url: String }],
    currentBackdropIdx: { type: Number, default: 0 },
    actors: [ActorSchema],
    globalSounds: { type: [ActionSchema], default: [] } 
}, { _id: false });

// --- FONCTION DE RÉCUPÉRATION SÉCURISÉE ---
const getModel = (name, schema) => {
    if (mongoose.models[name]) return mongoose.models[name];
    if (schema instanceof mongoose.Schema) return mongoose.model(name, schema);
    return mongoose.model(name, new mongoose.Schema(schema, { timestamps: true }));
};

function normalizeStudentUpdate(update) {
    if (!update || typeof update !== 'object') return update;
    const directFlag = update.isTestAccount;
    const setFlag = update.$set?.isTestAccount;
    const isTestAccount = setFlag !== undefined ? setFlag : directFlag;
    if (isTestAccount !== true) return update;
    if (update.$set && typeof update.$set === 'object') {
        update.$set.email = TEST_ACCOUNT_EMAIL;
    } else {
        update.email = TEST_ACCOUNT_EMAIL;
    }
    return update;
}

const StudentSchema = new mongoose.Schema({
    firstName: String, lastName: String, currentClass: String,
    nickname: { type: String, default: '', trim: true },
    email: { type: String, lowercase: true, trim: true },
    parentEmail: { type: String, lowercase: true, trim: true },
    birthDate: { type: String, default: '' },
    dateOfBirth: { type: String, default: '' },
    dob: { type: String, default: '' },
    studentPassword: { type: String, default: '' },
    hasStudentPassword: { type: Boolean, default: false },
    classId: mongoose.Schema.Types.ObjectId,
    assignedGroups: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    behaviorRecords: [{
        teacherId: mongoose.Schema.Types.ObjectId,
        baseScore: { type: Number, default: 15 },
        crosses: { type: Number, default: 0 },
        bonuses: { type: Number, default: 0 },
        weeksToRedemption: { type: Number, default: 3 },
        nextCrossRemovalAt: { type: Date, default: null }
        ,scores: { type: [{ id: String, value: { type: Number, default: 15 }, createdAt: { type: Date, default: Date.now } }], default: [] }
        ,selectedScoreId: { type: String, default: '' }
        ,forcedSix: { type: Boolean, default: false }
        ,workIncomplete: { type: Boolean, default: false }
    }],
    teacherNotes: [{ teacherId: mongoose.Schema.Types.ObjectId, text: String }],
    punishmentStatus: { type: String, default: 'NONE' },
    punishmentDueDate: Date, seatX: Number, seatY: Number, gender: String,
    punishmentLateMailSentAt: { type: Date, default: null },
    punishmentLateMailTo: { type: String, default: "" },
    punishmentLateMailError: { type: String, default: "" },
    indicators: Array,
    spellingMistakes: [{ wrong: String, correct: String, date: { type: Date, default: Date.now } }],
    activeTutorSession: {
        moduleId: { type: String, default: '' },
        stepId: { type: String, default: '' },
        stepIndex: { type: Number, default: 0 },
        token: { type: String, default: '' },
        sourceUrl: { type: String, default: '' },
        validationUrl: { type: String, default: '' },
        instructionDocId: { type: String, default: '' },
        instructionDocUrl: { type: String, default: '' },
        expiresAt: { type: Date, default: null },
        updatedAt: { type: Date, default: null }
    },
    isTestAccount: { type: Boolean, default: false }
}, { timestamps: true });

StudentSchema.pre('save', function forceSharedEmailForTestAccount(next) {
    if (this.isTestAccount === true) {
        this.email = TEST_ACCOUNT_EMAIL;
    }
    next();
});

StudentSchema.pre('findOneAndUpdate', function forceSharedEmailBeforeFindOneAndUpdate(next) {
    normalizeStudentUpdate(this.getUpdate());
    next();
});

StudentSchema.pre('updateOne', function forceSharedEmailBeforeUpdateOne(next) {
    normalizeStudentUpdate(this.getUpdate());
    next();
});

StudentSchema.pre('updateMany', function forceSharedEmailBeforeUpdateMany(next) {
    normalizeStudentUpdate(this.getUpdate());
    next();
});

// --- DÉFINITION DES MODÈLES ---
const Models = {
    Chapter: getModel('Chapter', {
        title: { type: String, default: "NOUVEAU" },
        section: { type: String, default: "GÉNÉRAL" },
        classroom: { type: String, default: "" },
        sharedLevel: { type: String, default: "" },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        isArchived: { type: Boolean, default: false },
        hiddenIn: { type: [String], default: [] }
    }),

    Classroom: getModel('Classroom', {
        name: String,
        level: String,
        type: { type: String, default: 'CLASS' },
        layout: { 
            separators: { type: [Number], default: [] },
            cols: { type: Number, default: 6 },
            rows: { type: Number, default: 5 }
        },
        classPoints: { type: Number, default: 0 },
        activeStudentHighlight: { type: String, default: null },
        activeStudentHighlightTime: { type: Date, default: null },
        activeStudentBonusAlert: { type: String, default: null },
        activeStudentBonusAlertTime: { type: Date, default: null },
        activeHourWarnings: { type: Array, default: [] }
    }),

    Student: getModel('Student', StudentSchema),

    Homework: getModel('Homework', {
        title: String, subject: String, isPunishment: { type: Boolean, default: false },
        assessmentKind: { type: String, enum: ['', 'dnb', 'rqp', 'commentaire'], default: '' },
        targetClassrooms: [String], chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId, levels: Array,
        assignedStudents: [mongoose.Schema.Types.ObjectId], isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        date: { type: Date, default: Date.now }
    }),

    GameLevel: getModel('GameLevel', {
        title: String, 
        subject: { type: String, default: "GÉNÉRAL" }, 
        type: { type: String, default: 'zombie' }, // zombie, starship, etc.
        isTestGame: { type: Boolean, default: false }, 
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId, targetClassrooms: [String],
        questions: Array, levels: Array, assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        // MIROIR
        scenes: { type: Array, default: [] }, 
        generatedCode: { type: String, default: "" },
        globalIntro: { type: Object, default: {} }
    }),

    LearningModule: getModel('LearningModule', {
        title: { type: String, default: "APPRENTISSAGE" },
        subject: { type: String, default: "GÉNÉRAL" },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        presentationUrl: { type: String, default: '' },
        presentationSlidesFocus: { type: String, default: '' },
        sections: {
            type: [Object],
            default: []
        },
        steps: {
            type: [Object],
            default: []
        },
        completions: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                completedAt: Date,
                currentStep: { type: Number, default: 0 },
                lastUpdateAt: Date,
                chatDocId: { type: String, default: '' },
                chatDocUrl: { type: String, default: '' },
                chatDocEmbedUrl: { type: String, default: '' },
                chatDocRevisionCount: { type: Number, default: 0 },
                chatDocRevisionAt: { type: Date, default: null },
                chatLogText: { type: String, default: '' },
                sheetTimesMs: { type: Object, default: {} },
                recitationAttempts: { type: [Object], default: [] },
                recitationValidatedWords: { type: [String], default: [] }
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    Expose: getModel('Expose', {
        title: { type: String, default: "EXPOSÉ" },
        subject: { type: String, default: "GÉNÉRAL" },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        presentations: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                presentationTitle: { type: String, default: '' },
                canvasUrl: { type: String, default: '' },
                slidesText: { type: String, default: '' },
                recordingUrl: { type: String, default: '' },
                recordingDurationSec: { type: Number, default: 0 },
                recordingPitch: { type: Number, default: 1 },
                spriteImageUrls: { type: [String], default: [] },
                spriteAnimations: {
                    type: [{
                        imageUrl: { type: String, default: '' },
                        animationBlock: { type: mongoose.Schema.Types.Mixed, default: null }
                    }],
                    default: []
                },
                presenterName: { type: String, default: '' },
                presenterSlideNumber: { type: Number, default: 0 },
                selectedForPresenter: { type: Boolean, default: false },
                createdAt: Date,
                updatedAt: Date
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    Course: getModel('Course', {
        title: { type: String, required: true, trim: true },
        description: { type: String, default: '', trim: true },
        slidesUrl: { type: String, required: true, trim: true },
        presentationId: { type: String, required: true, trim: true },
        embedUrl: { type: String, required: true, trim: true },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
        targetClassroomId: { type: String, required: true, index: true },
        targetClassroomName: { type: String, default: '', trim: true },
        isEnabled: { type: Boolean, default: true },
        courseSectionId: { type: String, default: '', index: true },
        order: { type: Number, default: 0 },
        publishedUntilSlide: { type: Number, default: 0, min: 0 },
        overlays: {
            type: [{
                type: { type: String, enum: ['character', 'video'], required: true },
                sourceUrl: { type: String, default: '' },
                title: { type: String, default: '' },
                slideNumber: { type: Number, default: 1 },
                startSec: { type: Number, default: 0 },
                x: { type: Number, default: 70 },
                y: { type: Number, default: 70 },
                width: { type: Number, default: 24 }
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    CourseSection: getModel('CourseSection', {
        name: { type: String, required: true, trim: true },
        targetClassroomId: { type: String, required: true, index: true },
        order: { type: Number, default: 0 },
        createdAt: { type: Date, default: Date.now }
    }),

    Lecture: getModel('Lecture', {
        title: { type: String, default: "LECTURE" },
        subject: { type: String, default: "GÉNÉRAL" },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        readingUrl: { type: String, default: '' },
        maxScrollSpeed: { type: Number, default: 2600 },
        readingWpm: { type: Number, default: 300 },
        requiredSummaryMinLines: { type: Number, default: 5 },
        requiredSummaryMaxLines: { type: Number, default: 10 },
        submissions: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                scrollTop: { type: Number, default: 0 },
                maxScrollTop: { type: Number, default: 0 },
                scrollHeight: { type: Number, default: 0 },
                clientHeight: { type: Number, default: 0 },
                reachedEnd: { type: Boolean, default: false },
                rhythmAlerts: { type: Number, default: 0 },
                maxSpeedPxPerSec: { type: Number, default: 0 },
                pasteBlockedCount: { type: Number, default: 0 },
                readElapsedSec: { type: Number, default: 0 },
                draftDocId: { type: String, default: '' },
                draftDocUrl: { type: String, default: '' },
                draftDocEmbedUrl: { type: String, default: '' },
                draftDocRevisionCount: { type: Number, default: 0 },
                draftDocRevisionAt: { type: Date, default: null },
                summary: { type: String, default: '' },
                summarySubmittedAt: Date,
                completedAt: Date,
                updatedAt: Date
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    Fiche: getModel('Fiche', {
        title: { type: String, default: "FICHE" },
        subject: { type: String, default: "GÉNÉRAL" },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        presentationUrl: { type: String, default: '' },
        selectedSlides: { type: [Number], default: [] },
        teacherInstructions: { type: String, default: '' },
        submissions: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                participantStudentIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
                lessonSlot: { type: Number, default: 1 },
                contentHtml: { type: String, default: '' },
                plainText: { type: String, default: '' },
                imageCount: { type: Number, default: 0 },
                teacherValidated: { type: Boolean, default: false },
                updatedAt: Date,
                completedAt: Date
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    Production: getModel('Production', {
        title: { type: String, default: "PRODUCTION" },
        subject: { type: String, default: "GÉNÉRAL" },
        productionType: { type: String, enum: ['fiche', 'questionnaire', 'qcm'], default: 'fiche' },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        presentationUrl: { type: String, default: '' },
        selectedSlides: { type: [Number], default: [] },
        teacherInstructions: { type: String, default: '' },
        gameId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameLevel', default: null },
        questions: {
            type: [{
                prompt: { type: String, default: '' },
                expectedAnswer: { type: String, default: '' },
                expectedKeywords: { type: [String], default: [] },
                oralPreferred: { type: Boolean, default: true },
                options: { type: [String], default: [] },
                correctIndex: { type: Number, default: 0 }
            }],
            default: []
        },
        submissions: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                contentHtml: { type: String, default: '' },
                plainText: { type: String, default: '' },
                imageCount: { type: Number, default: 0 },
                answers: {
                    type: [{
                        levelTitle: { type: String, default: '' },
                        prompt: { type: String, default: '' },
                        answer: { type: String, default: '' },
                        expectedKeywords: { type: [String], default: [] },
                        options: { type: [String], default: [] },
                        selectedIndex: { type: Number, default: -1 },
                        correctIndex: { type: Number, default: -1 },
                        isCorrect: { type: Boolean, default: false }
                    }],
                    default: []
                },
                score: { type: Number, default: 0 },
                teacherValidated: { type: Boolean, default: false },
                participantStudentIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
                lessonSlot: { type: Number, default: 1 },
                updatedAt: Date,
                completedAt: Date
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    CommentActivity: getModel('CommentActivity', {
        title: { type: String, default: "COMMENTAIRE" },
        subject: { type: String, default: "HISTOIRE GÉOGRAPHIE" },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        documentUrls: { type: [String], default: [] },
        documentExtractions: {
            type: [{
                url: { type: String, default: '' },
                extraction: { type: String, default: '' }
            }],
            default: []
        },
        teacherPrompt: { type: String, default: '' },
        teacherInstructions: { type: String, default: '' },
        promptLevel: { type: String, default: '' },
        submissions: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                rounds: {
                    type: [{
                        draft: { type: String, default: '' },
                        aiFeedback: { type: String, default: '' },
                        createdAt: Date,
                        updatedAt: Date
                    }],
                    default: []
                },
                aiValidated: { type: Boolean, default: false },
                methodologyReflection: { type: String, default: '' },
                completedAt: Date,
                updatedAt: Date
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    RevisionActivity: getModel('RevisionActivity', {
        title: { type: String, default: "RÉVISION" },
        subject: { type: String, default: "GÉNÉRAL" },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        teacherId: mongoose.Schema.Types.ObjectId,
        targetClassrooms: [String],
        assignedStudents: [mongoose.Schema.Types.ObjectId],
        isAllClass: { type: Boolean, default: true },
        isEnabled: { type: Boolean, default: true },
        presentationUrl: { type: String, default: '' },
        selectedSlides: { type: [Number], default: [] },
        teacherInstructions: { type: String, default: '' },
        submissions: {
            type: [{
                studentId: mongoose.Schema.Types.ObjectId,
                questions: {
                    type: [{
                        question: { type: String, default: '' },
                        expectedAnswer: { type: String, default: '' },
                        expectedKeywords: { type: [String], default: [] }
                    }],
                    default: []
                },
                questionCount: { type: Number, default: 0 },
                completedAt: Date,
                updatedAt: Date
            }],
            default: []
        },
        date: { type: Date, default: Date.now }
    }),

    ControlRecovery: getModel('ControlRecovery', {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', index: true },
        title: { type: String, default: 'RÉCUPÉRER CONTRÔLE' },
        subject: { type: String, default: 'GÉNÉRAL' },
        status: { type: String, default: 'todo' },
        phase: { type: Number, default: 1 },
        submissionMode: { type: String, enum: ['photo', 'keyboard', 'next_course'], default: 'keyboard' },
        uploadedPhotoUrl: { type: String, default: '' },
        uploadedPhotoUrls: { type: [String], default: [] },
        mobileAccessToken: { type: String, default: '', index: true },
        mobileAccessEnabledAt: { type: Date, default: null },
        typedRedoText: { type: String, default: '' },
        nextCourseNote: { type: String, default: '' },
        errorsExplanation: { type: String, default: '' },
        phase2Mistakes: {
            type: [{
                questionNumber: { type: String, default: '' },
                whatWasWrong: { type: String, default: '' },
                correctionMade: { type: String, default: '' }
            }],
            default: []
        },
        selfQuestions: {
            type: [{
                question: { type: String, default: '' },
                expectedAnswer: { type: String, default: '' },
                expectedKeywords: { type: [String], default: [] },
                studentAnswer: { type: String, default: '' },
                oralPreferred: { type: Boolean, default: true }
            }],
            default: []
        },
        completedAt: { type: Date, default: null },
        awardedBonus: { type: Boolean, default: false },
        teacherValidated: { type: Boolean, default: false },
        teacherValidatedAt: { type: Date, default: null }
    }),

    VideoSegment: getModel('VideoSegment', {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', index: true },
        stepId: { type: String, default: '', index: true },
        originalUrl: { type: String, default: '' },
        normalizedUrl: { type: String, index: true },
        label: { type: String, default: '' },
        transcript: { type: String, default: '' },
        startSec: { type: Number, default: 0 },
        endSec: { type: Number, default: 0 },
        order: { type: Number, default: 1 }
    }),

    VideoSource: getModel('VideoSource', {
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', index: true },
        chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', index: true },
        originalUrl: { type: String, default: '' },
        normalizedUrl: { type: String, index: true },
        name: { type: String, default: '' }
    }),

    ScanSession: getModel('ScanSession', {
        title: String, teacherId: String, chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter' },
        subjectUrls: [String], copyUrls: [String], corrections: Array,
        aiInstructions: { type: String, default: "Corrige sévèrement la syntaxe." },
        date: { type: Date, default: Date.now },
        classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Classroom', default: null },
        className: { type: String, default: '' }
    }),

    Teacher: getModel('Teacher', {
        firstName: String, lastName: String, password: { type: String, required: true },
        mail: { type: String, default: '', trim: true, lowercase: true },
        email: { type: String, default: '', trim: true, lowercase: true },
        geminiApiEnabled: { type: Boolean, default: false },
        geminiProjectId: { type: String, default: '', trim: true },
        geminiApiKeyEncrypted: { type: String, default: '' },
        lastProfTab: { type: String, default: 'activities' },
        lastProfClassId: { type: String, default: '' },
        subjectSections: [SectionSchema], taughtSubjects: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Subject' }],
        assignedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }]
    }),

    Admin: getModel('Admin', {
        firstName: String, lastName: String, password: { type: String, required: true },
        mail: { type: String, default: '', trim: true, lowercase: true },
        email: { type: String, default: '', trim: true, lowercase: true },
        geminiApiEnabled: { type: Boolean, default: false },
        geminiProjectId: { type: String, default: '', trim: true },
        geminiApiKeyEncrypted: { type: String, default: '' },
        lastProfTab: { type: String, default: 'activities' },
        lastProfClassId: { type: String, default: '' },
        role: { type: String, default: 'admin' }, isDeveloper: { type: Boolean, default: false }
    }),

    Subject: getModel('Subject', { name: String, color: String }),
    
    Submission: getModel('Submission', {
        studentId: mongoose.Schema.Types.ObjectId, homeworkId: mongoose.Schema.Types.ObjectId,
        levelIndex: Number, content: String, feedback: String, grade: String,
        antiCheat: { type: Object, default: {} }
    }),

    HomeworkDraftDoc: getModel('HomeworkDraftDoc', {
        studentId: { type: mongoose.Schema.Types.ObjectId, index: true },
        homeworkId: { type: mongoose.Schema.Types.ObjectId, index: true },
        levelIndex: { type: Number, default: 0, index: true },
        docId: { type: String, default: '' },
        docUrl: { type: String, default: '' },
        docEmbedUrl: { type: String, default: '' },
        slidesId: { type: String, default: '' },
        slidesUrl: { type: String, default: '' },
        slidesEmbedUrl: { type: String, default: '' },
        title: { type: String, default: '' },
        lastWordCount: { type: Number, default: 0 },
        lastRevisionCount: { type: Number, default: 0 },
        lastRevisionAt: { type: Date, default: null }
    }),

    AIUsageLedger: getModel('AIUsageLedger', {
        provider: { type: String, default: 'gemini', index: true },
        source: { type: String, default: 'global', index: true },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', index: true, default: null },
        route: { type: String, default: '', index: true },
        feature: { type: String, default: '', index: true },
        model: { type: String, default: '', index: true },
        promptTokens: { type: Number, default: 0 },
        candidateTokens: { type: Number, default: 0 },
        totalTokens: { type: Number, default: 0 },
        cachedContentTokens: { type: Number, default: 0 },
        thoughtsTokens: { type: Number, default: 0 },
        estimatedInputCostUsd: { type: Number, default: 0 },
        estimatedOutputCostUsd: { type: Number, default: 0 },
        estimatedTotalCostUsd: { type: Number, default: 0 },
        status: { type: String, default: 'success', index: true },
        errorMessage: { type: String, default: '' },
        requestChars: { type: Number, default: 0 },
        responseChars: { type: Number, default: 0 },
        occurredAt: { type: Date, default: Date.now, index: true }
    }),

    GptInboxMessage: getModel('GptInboxMessage', {
        teacherId: { type: String, default: '', index: true },
        teacherName: { type: String, default: 'JP Vuillet', index: true },
        teacherEmail: { type: String, default: '', lowercase: true, trim: true, index: true },
        moduleId: { type: String, default: '', index: true },
        stepId: { type: String, default: '' },
        studentId: { type: String, default: '', index: true },
        studentName: { type: String, default: '', index: true },
        studentClass: { type: String, default: '', index: true },
        type: { type: String, default: 'feedback', index: true },
        questionNumber: { type: Number, default: null },
        message: { type: String, default: '' },
        feedback: { type: String, default: '' },
        summary: { type: String, default: '' },
        weakPoints: { type: [String], default: [] },
        errors: { type: [Object], default: [] },
        mastered: { type: Boolean, default: false, index: true },
        score: { type: Number, default: null },
        images: { type: [Object], default: [] },
        source: { type: String, default: 'chatgpt' },
        raw: { type: String, default: '' },
        receivedAt: { type: Date, default: Date.now, index: true }
    }),

    GameProgress: getModel('GameProgress', {
        studentId: mongoose.Schema.Types.ObjectId, gameId: mongoose.Schema.Types.ObjectId,
        levelReached: { type: Number, default: 0 }, lastScore: { type: Number, default: 0 }
    }),

    StudioProject: getModel('StudioProject', {
        title: { type: String, required: true },
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        scenes: [SceneSchema],
        generatedCode: String,
        isProduction: { type: Boolean, default: false },
        isTrashed: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now }
    })
};

module.exports = Models;
