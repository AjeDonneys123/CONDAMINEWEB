const mongoose = require('mongoose');

const ActionSchema = new mongoose.Schema({
    type: { type: String, enum: ['WAIT', 'MOVE', 'SAY', 'PLAY_SOUND', 'ASK_CHOICE', 'ASK_INPUT'], required: true },
    targetId: String, 
    params: mongoose.Schema.Types.Mixed 
});

// DEFINITION COSTUME
const CostumeSchema = new mongoose.Schema({
    id: String,
    name: String,
    url: String
}, { _id: false });

const ActorSchema = new mongoose.Schema({
    id: String, 
    name: String, 
    
    // V451 : Ajout explicite des costumes (Indispensable pour le Studio)
    costumes: { type: [CostumeSchema], default: [] },
    currentCostumeIdx: { type: Number, default: 0 },
    
    initialX: Number, 
    initialY: Number, 
    scale: { type: Number, default: 1 }
});

const SceneSchema = new mongoose.Schema({
    name: String,
    backgroundUrl: String,
    actors: [ActorSchema],
    timeline: [ActionSchema] 
});

const StudioProjectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
    scenes: [SceneSchema],
    generatedCode: String,
    isPublic: { type: Boolean, default: false }, 
    createdAt: { type: Date, default: Date.now }
}, { collection: 'studioprojects' });

module.exports = mongoose.models.StudioProject || mongoose.model('StudioProject', StudioProjectSchema);