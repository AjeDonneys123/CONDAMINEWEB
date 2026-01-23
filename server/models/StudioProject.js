const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
    type: { type: String, enum: ['WAIT', 'MOVE', 'SAY', 'PLAY_SOUND', 'ASK_CHOICE', 'ASK_INPUT'], required: true },
    targetId: String, // ID de l'acteur concerné
    params: mongoose.Schema.Types.Mixed // { text: "Bonjour", x: 50, audio: "..." }
});

const ActorSchema = new mongoose.Schema({
    id: String, // ex: "actor_1"
    name: String, // ex: "Mario"
    spriteUrl: String, // URL de l'image
    initialX: Number, // %
    initialY: Number, // %
    scale: { type: Number, default: 1 }
});

const SceneSchema = new mongoose.Schema({
    name: String,
    backgroundUrl: String,
    actors: [ActorSchema],
    timeline: [ActionSchema] // Liste séquentielle des actions
});

const StudioProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    scenes: [SceneSchema],
    isPublic: { type: Boolean, default: false }, // Pour partager entre profs
    createdAt: { type: Date, default: Date.now }
}, { collection: 'studioprojects' });

module.exports = mongoose.models.StudioProject || mongoose.model('StudioProject', StudioProjectSchema);