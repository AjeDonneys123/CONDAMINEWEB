const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const router = express.Router();

// Configuration multer pour uploads d'images d'entraînement
const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'training');
try {
    fs.mkdirSync(uploadDir, { recursive: true });
} catch (_) {}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `train_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB max
});

const getModels = () => ({
    Student: mongoose.model('Student'),
    Classroom: mongoose.model('Classroom'),
    Chapter: mongoose.model('Chapter'),
    Teacher: mongoose.model('Teacher'),
    TrainingExercise: mongoose.model('TrainingExercise'),
});

// Helper extraction normalisée de niveau (ex: "5E", "5eme", "5ème B" → "5")
function extractLevel(raw) {
    const str = String(raw || '').trim().toUpperCase();
    if (!str) return '';
    if (/^6/.test(str)) return '6';
    if (/^5/.test(str)) return '5';
    if (/^4/.test(str)) return '4';
    if (/^3/.test(str)) return '3';
    if (/^(2|2DE|2NDE|SEC)/.test(str)) return '2';
    if (/^(1|1ERE|PREM)/.test(str)) return '1';
    if (/^(T|TERM)/.test(str)) return 'T';
    return str.replace(/^(\d).*/, '$1') || '';
}

// ─────────────────────────────────────────────────────────────
// EXERCICES NATIFS CLASSÉS PAR NIVEAU
// ─────────────────────────────────────────────────────────────
const NATIVE_EXERCISES = [
    // ── NIVEAU 3e / DNB ──
    {
        id: 'civilians-ww1',
        title: 'Paragraphe · Les civils dans la 1ère Guerre mondiale',
        section: 'HISTOIRE',
        level: '3',
        type: 'local',
        questionType: 'fill',
        images: [],
        content: {
            text: "Pendant la Première Guerre mondiale (1914-1918), les civils subissent le conflit tout en étant mobilisés.\nD'une part, les civils sont victimes de la guerre : bombardements des villes et réquisitions allemandes en zones occupées. En 1915-1916, l'Empire ottoman commet le génocide des Arméniens faisant plus d'un million de morts.\nD'autre part, les civils participent à l'effort : les États mettent en place une économie de guerre et financent le conflit par des emprunts nationaux. Dans les usines, les femmes remplacent les hommes : on les appelle les munitionnettes. Pour encadrer les esprits, les gouvernements utilisent la propagande et la censure.",
            blanks: ['bombardements', 'réquisitions', 'génocide', 'Arméniens', 'économie de guerre', 'emprunts nationaux', 'munitionnettes', 'propagande', 'censure'],
            wordBank: ['génocide', 'censure', 'munitionnettes', 'propagande', 'réquisitions', 'emprunts nationaux', 'économie de guerre', 'bombardements', 'Arméniens']
        }
    },
    {
        id: 'soldiers-ww1',
        title: 'Paragraphe · Les militaires dans la 1ère Guerre mondiale',
        section: 'HISTOIRE',
        level: '3',
        type: 'local',
        questionType: 'fill',
        images: [],
        content: {
            text: "Pendant la Grande Guerre, les soldats, surnommés les Poilus, vivent dans des conditions effroyables au fond des tranchées. Ils affrontent une violence de masse sans précédent, rythmée par les pilonnages d'obus et l'apparition de nouvelles armes comme les gaz asphyxiants. Des batailles d'usure gigantesques comme Verdun font des centaines de milliers de victimes. Épuisés, certains soldats participent à des mutineries en 1917. Les survivants mutilés sont appelés les Gueules cassées.",
            blanks: ['Poilus', 'violence de masse', 'obus', 'gaz asphyxiants', 'Verdun', 'tranchées', 'mutineries', 'Gueules cassées'],
            wordBank: ['Verdun', 'mutineries', 'violence de masse', 'Gueules cassées', 'tranchées', 'Poilus', 'gaz asphyxiants', 'obus']
        }
    },
    {
        id: 'total-war-ww1',
        title: 'Paragraphe · La 1ère Guerre mondiale, une guerre totale',
        section: 'HISTOIRE',
        level: '3',
        type: 'local',
        questionType: 'fill',
        images: [],
        content: {
            text: "La Première Guerre mondiale est une guerre totale car elle mobilise l'ensemble de la société et des ressources. Les militaires sont massivement mobilisés sur le front. À l'arrière, les femmes travaillent dans les champs et les usines d'armement. L'économie est entièrement tournée vers la production de guerre. L'État organise la censure de la presse et diffuse une propagande intense auprès de la population.",
            blanks: ['guerre totale', 'front', 'arrière', 'armement', 'censure', 'propagande'],
            wordBank: ['guerre totale', 'front', 'arrière', 'armement', 'censure', 'propagande', 'armistice', 'tranchées']
        }
    },
    {
        id: 'history-reperes',
        title: 'Repères · Dates et événements clés du Brevet',
        section: 'HISTOIRE',
        level: '3',
        type: 'local',
        questionType: 'targeted',
        images: [],
        content: {
            question: "Donnez les repères chronologiques majeurs du brevet : dates de la 1ère Guerre mondiale, de la Révolution russe, de l'accession d'Hitler au pouvoir et de la 2nde Guerre mondiale.",
            sampleAnswer: "1914-1918 : Première Guerre mondiale ; 1917 : Révolutions russes ; 1933 : Hitler au pouvoir ; 1939-1945 : Seconde Guerre mondiale ; 1944 : Droit de vote des femmes en France.",
            guidelines: "Mentionner au moins 4 repères avec date exacte et événement associé."
        }
    },
    {
        id: 'geo-metropoles',
        title: 'Repères · Métropoles et aires urbaines en France',
        section: 'GEO',
        level: '3',
        type: 'local',
        questionType: 'qcm',
        images: [],
        content: {
            question: "Quelle est la principale métropole française qui concentre les fonctions de commandement à l'échelle mondiale ?",
            choices: ['Lyon', 'Marseille', 'Paris', 'Toulouse'],
            correctIndex: 2,
            explanation: "Paris est la ville primatiale et la seule métropole de rang mondial en France."
        }
    },
    {
        id: 'geo-regions',
        title: 'Repères · Régions administratives de France',
        section: 'GEO',
        level: '3',
        type: 'local',
        questionType: 'qcm',
        images: [],
        content: {
            question: "Depuis la réforme territoriale de 2016, combien y a-t-il de régions administratives en France métropolitaine ?",
            choices: ['22', '18', '13', '15'],
            correctIndex: 2,
            explanation: "La France métropolitaine compte 13 régions administratives (et 5 régions d'outre-mer, soit 18 au total)."
        }
    },
    {
        id: 'emc-republique',
        title: 'EMC · Valeurs, principes et symboles de la République',
        section: 'EMC',
        level: '3',
        type: 'local',
        questionType: 'targeted',
        images: [],
        content: {
            question: "Citez la devise républicaine, deux symboles de la République et expliquez en deux phrases le principe de laïcité.",
            sampleAnswer: "Devise : Liberté, Égalité, Fraternité. Symboles : Marianne, le drapeau tricolore, la Marseillaise. Laïcité : neutralité de l'État envers toutes les religions et garantie de la liberté de conscience pour chaque citoyen.",
            guidelines: "Préciser la devise, au moins 2 symboles et une définition claire de la laïcité."
        }
    },

    // ── NIVEAU 5e ──
    {
        id: 'geo-5e-reperes',
        title: 'Géo 5e · Lignes remarquables et grands repères terrestres',
        section: 'GEO',
        level: '5',
        type: 'local',
        questionType: 'fill',
        images: [],
        content: {
            text: "La Terre est divisée en deux hémisphères par l'Équateur (latitude 0°). Au nord se situe le tropique du Cancer et au sud le tropique du Capricorne. Les pôles Nord et Sud sont délimités par les cercles polaires. Le méridien de Greenwich sert de référence pour la longitude (0°).",
            blanks: ['Équateur', 'Cancer', 'Capricorne', 'cercles polaires', 'Greenwich'],
            wordBank: ['Équateur', 'Cancer', 'Capricorne', 'cercles polaires', 'Greenwich', 'Amazonie', 'Himalaya']
        }
    },
    {
        id: 'geo-5e-population',
        title: 'Géo 5e · Les grands foyers de population mondiaux',
        section: 'GEO',
        level: '5',
        type: 'local',
        questionType: 'qcm',
        images: [],
        content: {
            question: "Quels sont les trois principaux foyers de peuplement dans le monde rassemblant plus de la moitié de l'humanité ?",
            choices: [
                "L'Asie de l'Est, l'Asie du Sud et l'Europe",
                "L'Amérique du Nord, l'Afrique et l'Océanie",
                "L'Amérique du Sud, la Russie et l'Afrique centrale",
                "Le Proche-Orient, le Japon et l'Australie"
            ],
            correctIndex: 0,
            explanation: "L'Asie du Sud (Inde), l'Asie de l'Est (Chine) et l'Europe constituent les 3 foyers majeurs historiques."
        }
    },
    {
        id: 'hist-5e-byzance',
        title: 'Histoire 5e · Byzance et l’Europe carolingienne',
        section: 'HISTOIRE',
        level: '5',
        type: 'local',
        questionType: 'targeted',
        images: [],
        content: {
            question: "Présentez les deux empires chrétiens du haut Moyen Âge (capitales, empereurs célèbres, religions).",
            sampleAnswer: "L'Empire byzantin a pour capitale Constantinople, pour empereur Justinien et pratique le christianisme orthodoxe. L'Empire carolingien a pour capitale Aix-la-Chapelle, son empereur est Charlemagne (couronné en 800) et pratique le christianisme catholique sous l'autorité du Pape.",
            guidelines: "Distinguer clairement Byzance et l'Empire carolingien, avec capitales, chefs et confessions chrétiennes."
        }
    },
    {
        id: 'hist-5e-islam',
        title: 'Histoire 5e · Les débuts de l’Islam (VIIe - IXe siècles)',
        section: 'HISTOIRE',
        level: '5',
        type: 'local',
        questionType: 'qcm',
        images: [],
        content: {
            question: "Quel événement survenu en 622 marque le point de départ du calendrier musulman ?",
            choices: [
                "La naissance de Mahomet",
                "L'Hégire (départ de La Mecque vers Médine)",
                "La construction de la Grande Mosquée de Damas",
                "La rédaction intégrale du Coran"
            ],
            correctIndex: 1,
            explanation: "L'Hégire en 622 (départ de Mahomet vers Yathrib/Médine) marque l'an 1 de l'ère musulmane."
        }
    },

    // ── NIVEAU 4e ──
    {
        id: 'hist-4e-lumieres',
        title: 'Histoire 4e · Les philosophes des Lumières',
        section: 'HISTOIRE',
        level: '4',
        type: 'local',
        questionType: 'qcm',
        images: [],
        content: {
            question: "Quel penseur des Lumières a théorisé le principe fondamental de séparation des pouvoirs (législatif, exécutif, judiciaire) ?",
            choices: ['Voltaire', 'Montesquieu', 'Jean-Jacques Rousseau', 'Denis Diderot'],
            correctIndex: 1,
            explanation: "Montesquieu théorise la séparation des pouvoirs dans 'De l'esprit des lois' (1748)."
        }
    },
    {
        id: 'geo-4e-mondialisation',
        title: 'Géo 4e · Les paysages urbains de la mondialisation',
        section: 'GEO',
        level: '4',
        type: 'local',
        questionType: 'targeted',
        images: [],
        content: {
            question: "Expliquez comment la mondialisation transforme les grandes métropoles mondiales (CBD, étalement urbain, contrastes sociaux).",
            sampleAnswer: "La mondialisation concentre les sièges sociaux et la finance dans des quartiers d'affaires verticaux (CBD). Elle produit un fort étalement urbain et accentue les contrastes socio-spatiaux (gentrification au centre, quartiers précaires ou ségrégation en périphérie).",
            guidelines: "Développer le rôle du CBD, l'étalement urbain et les disparités socio-spatiales."
        }
    },

    // ── NIVEAU 2de ──
    {
        id: 'rqp-seconde-methodo',
        title: 'RQP · Méthodologie de la question problématisée',
        section: 'HISTOIRE',
        level: '2',
        type: 'local',
        questionType: 'targeted',
        images: [],
        content: {
            question: "Quelles sont les trois composantes obligatoires de l'introduction d'une Réponse à une Question Problématisée (RQP) ?",
            sampleAnswer: "1. Présentation du sujet : accroche, définition des termes et cadre spatio-temporel. 2. Problématique explicite. 3. Annonce du plan en 2 ou 3 parties ordonnées.",
            guidelines: "Préciser la définition du sujet avec bornes, la problématique claire et l'annonce du plan."
        }
    },
    {
        id: 'hist-2de-athenes',
        title: 'Histoire 2de · La démocratie athénienne au Ve siècle av. J.-C.',
        section: 'HISTOIRE',
        level: '2',
        type: 'local',
        questionType: 'fill',
        images: [],
        content: {
            text: "Au Ve siècle avant J.-C., Athènes développe une démocratie directe. Tous les citoyens se réunissent sur la colline de la Pnyx au sein de l'Ecclésia pour voter les lois et décider de la guerre. Les magistrats sont tirés au sort ou élus, comme les stratèges (dont Périclès). Cependant, la citoyenneté est restreinte : les femmes, les métèques et les esclaves sont totalement exclus de la vie politique.",
            blanks: ['Ecclésia', 'Pnyx', 'stratèges', 'Périclès', 'métèques', 'esclaves'],
            wordBank: ['Ecclésia', 'Pnyx', 'stratèges', 'Périclès', 'métèques', 'esclaves', 'hoplites', 'ostracisme']
        }
    }
];

// ─────────────────────────────────────────────────────────────
// 1. Infos élèves de la classe
// ─────────────────────────────────────────────────────────────
router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        if (!classId) return res.status(400).json({ error: 'ID de classe manquant' });
        const { Student } = getModels();
        const students = await Student.find({ currentClass: classId })
            .select('firstName lastName nickname email trainingStars')
            .lean();
        res.json({ classId, studentsCount: students.length, students });
    } catch (error) {
        console.error('Error in GET /api/prof/training/class/:classId:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

// ─────────────────────────────────────────────────────────────
// 2. Récupérer l'entraînement actif d'une classe
// ─────────────────────────────────────────────────────────────
router.get('/class/:classId/assignment', async (req, res) => {
    try {
        const { Classroom } = getModels();
        const classroom = await Classroom.findById(req.params.classId).lean();
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        res.json({ assignment: classroom.activeTrainingAssignment || null });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 3. Définir / mettre à jour l'entraînement d'une classe
// ─────────────────────────────────────────────────────────────
router.put('/class/:classId/assignment', async (req, res) => {
    try {
        const { Classroom } = getModels();
        const classroom = await Classroom.findById(req.params.classId);
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });

        const items = Array.isArray(req.body?.items) ? req.body.items : [];
        const cleanItems = items
            .filter(item => item && String(item.id || '').trim())
            .map(item => ({
                id: String(item.id).trim(),
                type: String(item.type || 'local').trim(),      // 'chapter' | 'local' | 'custom'
                title: String(item.title || '').trim(),
                section: String(item.section || '').trim(),     // 'HISTOIRE' | 'GEO' | 'EMC'
                subject: String(item.subject || '').trim(),
                questionType: String(item.questionType || '').trim(),
                images: Array.isArray(item.images) ? item.images : [],
                content: item.content || {}
            }));

        if (cleanItems.length === 0) {
            classroom.activeTrainingAssignment = null;
        } else {
            classroom.activeTrainingAssignment = {
                items: cleanItems,
                assignedAt: new Date(),
                teacherId: req.body?.teacherId || null,
            };
        }
        await classroom.save();
        console.info('[CondaWeb training] entraînement défini', {
            classId: String(classroom._id),
            items: cleanItems.length,
        });
        res.json({ ok: true, assignment: classroom.activeTrainingAssignment });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 4. Récupérer TOUS les exercices filtrés pour la classe active
// ─────────────────────────────────────────────────────────────
router.get('/exercises', async (req, res) => {
    try {
        const { Classroom, TrainingExercise } = getModels();
        const classId = String(req.query.classId || '').trim();
        const teacherId = String(req.query.teacherId || '').trim();

        let className = String(req.query.className || '').trim();
        let classLevel = '';

        if (classId) {
            const cls = await Classroom.findById(classId).lean();
            if (cls) {
                className = cls.name || className;
            }
        }
        classLevel = extractLevel(className);

        // 1. Filtrer les exercices natifs par niveau
        const filteredNative = NATIVE_EXERCISES.filter(ex => {
            if (!classLevel) return true;
            return ex.level === classLevel;
        });

        // 2. Charger les exercices personnalisés créés par le prof pour ce niveau ou cette classe
        const customQuery = {};
        if (teacherId && mongoose.isValidObjectId(teacherId)) {
            customQuery.teacherId = teacherId;
        }
        if (classLevel) {
            customQuery.$or = [
                { level: classLevel },
                { level: '' },
                { classrooms: className },
                { classrooms: classId }
            ];
        }

        const customDocs = await TrainingExercise.find(customQuery).sort({ createdAt: -1 }).lean();
        const customExercises = customDocs.map(doc => ({
            id: String(doc._id),
            _id: String(doc._id),
            title: doc.title,
            section: doc.section || 'HISTOIRE',
            level: doc.level || classLevel,
            classrooms: doc.classrooms || [],
            type: 'custom',
            isCustom: true,
            questionType: doc.questionType || 'fill',
            images: Array.isArray(doc.images) ? doc.images : [],
            content: doc.content || {},
            createdAt: doc.createdAt
        }));

        res.json({
            classId,
            className,
            classLevel,
            exercises: [...customExercises, ...filteredNative]
        });
    } catch (e) {
        console.error('Error in GET /api/prof/training/exercises:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 5. Créer un nouvel exercice d'entraînement
// ─────────────────────────────────────────────────────────────
router.post('/exercise', async (req, res) => {
    try {
        const { TrainingExercise } = getModels();
        const { title, section, level, classrooms, teacherId, images, questionType, content } = req.body;

        if (!title || !String(title).trim()) {
            return res.status(400).json({ error: 'Le titre est requis.' });
        }

        const newDoc = new TrainingExercise({
            title: String(title).trim(),
            section: String(section || 'HISTOIRE').toUpperCase(),
            level: String(level || '').trim(),
            classrooms: Array.isArray(classrooms) ? classrooms : [],
            teacherId: teacherId && mongoose.isValidObjectId(teacherId) ? teacherId : null,
            images: Array.isArray(images) ? images : [],
            questionType: ['fill', 'targeted', 'qcm'].includes(questionType) ? questionType : 'fill',
            content: content || {},
            isCustom: true
        });

        await newDoc.save();
        res.json({ ok: true, exercise: newDoc.toObject() });
    } catch (e) {
        console.error('Error in POST /api/prof/training/exercise:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 6. Mettre à jour un exercice d'entraînement
// ─────────────────────────────────────────────────────────────
router.put('/exercise/:id', async (req, res) => {
    try {
        const { TrainingExercise } = getModels();
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID invalide' });
        }

        const doc = await TrainingExercise.findById(id);
        if (!doc) return res.status(404).json({ error: 'Exercice introuvable' });

        const { title, section, level, classrooms, images, questionType, content } = req.body;
        if (title) doc.title = String(title).trim();
        if (section) doc.section = String(section).toUpperCase();
        if (level !== undefined) doc.level = String(level).trim();
        if (Array.isArray(classrooms)) doc.classrooms = classrooms;
        if (Array.isArray(images)) doc.images = images;
        if (['fill', 'targeted', 'qcm'].includes(questionType)) doc.questionType = questionType;
        if (content) doc.content = content;
        doc.updatedAt = new Date();

        doc.markModified('content');
        doc.markModified('images');
        await doc.save();

        res.json({ ok: true, exercise: doc.toObject() });
    } catch (e) {
        console.error('Error in PUT /api/prof/training/exercise/:id:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 7. Supprimer un exercice d'entraînement
// ─────────────────────────────────────────────────────────────
router.delete('/exercise/:id', async (req, res) => {
    try {
        const { TrainingExercise } = getModels();
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ error: 'ID invalide' });
        }

        const deleted = await TrainingExercise.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ error: 'Exercice introuvable' });

        res.json({ ok: true, id });
    } catch (e) {
        console.error('Error in DELETE /api/prof/training/exercise/:id:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 8. Upload d'une image pour un exercice
// ─────────────────────────────────────────────────────────────
router.post('/upload-image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Aucun fichier fourni' });
        }
        const url = `/uploads/training/${req.file.filename}`;
        res.json({
            ok: true,
            url,
            filename: req.file.originalname,
            size: req.file.size
        });
    } catch (e) {
        console.error('Error in POST /api/prof/training/upload-image:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 9. Récupérer les chapitres STRICTEMENT filtrés par la classe
// ─────────────────────────────────────────────────────────────
router.get('/chapters', async (req, res) => {
    try {
        const { Chapter, Classroom } = getModels();
        const teacherId = String(req.query.teacherId || '').trim();
        const classId   = String(req.query.classId || '').trim();

        if (!teacherId && !classId) return res.json([]);

        let className = String(req.query.className || '').trim();

        if (classId && !className) {
            const cls = await Classroom.findById(classId).lean();
            className = String(cls?.name || '').trim();
        }

        const classLevel = extractLevel(className);

        const query = { isArchived: false };
        if (teacherId && mongoose.isValidObjectId(teacherId)) {
            query.teacherId = teacherId;
        }

        const chapters = await Chapter.find(query)
            .select('title section classroom sharedLevel teacherId')
            .lean();

        const filtered = chapters.filter(c => {
            const titleUpper = String(c.title || '').toUpperCase();
            const secUpper = String(c.section || '').toUpperCase();
            if (titleUpper === 'GÉNÉRAL' || secUpper === 'GÉNÉRAL') return false;

            const chapClass = String(c.classroom || '').trim().toUpperCase();
            const chapLevel = extractLevel(c.sharedLevel || c.classroom || '');

            // Si une classe spécifique est définie
            if (chapClass && className) {
                if (chapClass === className.toUpperCase()) return true;
            }

            // Si le niveau correspond
            if (classLevel && chapLevel) {
                return chapLevel === classLevel;
            }

            return false;
        });

        res.json(filtered.map(c => ({
            _id: String(c._id),
            title: c.title,
            section: c.section,
            classroom: c.classroom,
            sharedLevel: c.sharedLevel,
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────
// 10. Route publique (élève) : lire l'entraînement actif
// ─────────────────────────────────────────────────────────────
router.get('/active/:classId', async (req, res) => {
    try {
        const { Classroom } = getModels();
        const classroom = await Classroom.findById(req.params.classId)
            .select('activeTrainingAssignment name')
            .lean();
        if (!classroom) return res.status(404).json({ error: 'Classe introuvable' });
        res.json({
            classId: String(classroom._id),
            className: classroom.name || '',
            assignment: classroom.activeTrainingAssignment || null,
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
