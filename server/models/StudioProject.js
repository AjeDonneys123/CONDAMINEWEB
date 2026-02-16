const mongoose = require('mongoose');

// Sous-schémas (pour la structure)
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
});

const SceneSchema = new mongoose.Schema({
    name: String,
    backdrops: [{ name: String, url: String }],
    currentBackdropIdx: { type: Number, default: 0 },
    actors: [ActorSchema],
    globalSounds: { type: [ActionSchema], default: [] }
}, { _id: false });

const StudioProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    scenes: [SceneSchema],
    
    // CHAMP CRITIQUE : DÉCLARATION EXPLICITE
    generatedCode: { type: String, default: "" },
    
    createdAt: { type: Date, default: Date.now }
}, { 
    collection: 'studioprojects',
    strict: false,
    minimize: false
});

module.exports = mongoose.models.StudioProject || mongoose.model('StudioProject', StudioProjectSchema);
