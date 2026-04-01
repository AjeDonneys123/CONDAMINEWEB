const mongoose = require('mongoose');

const getModel = (name, schema, collection) => {
    if (mongoose.models[name]) return mongoose.models[name];
    return mongoose.model(name, new mongoose.Schema(schema, {
        timestamps: true,
        collection
    }));
};

const ContentBlockSchema = new mongoose.Schema({
    type: { type: String, enum: ['text', 'image', 'embed', 'fiche', 'animation'], default: 'text' },
    title: { type: String, default: '' },
    value: { type: String, default: '' },
    contentHtml: { type: String, default: '' },
    mediaUrl: { type: String, default: '' },
    iframeUrl: { type: String, default: '' },
    ficheStyle: {
        fontFamily: { type: String, default: 'Arial' },
        accentColor: { type: String, default: '#1d2942' },
        background: { type: String, default: '#ffffff' }
    },
    order: { type: Number, default: 0 },
    isVisible: { type: Boolean, default: true }
}, { _id: true });

const Web5eSite = getModel('Web5eSite', {
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    title: { type: String, default: 'Projet 5e' },
    subtitle: { type: String, default: '' },
    isPublic: { type: Boolean, default: true },
    welcomeAnimation: { type: mongoose.Schema.Types.Mixed, default: null },
    ownerTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    sectionOrder: { type: [String], default: ['eau', 'energie'] },
    theme: {
        primary: { type: String, default: '#ec4899' },
        secondary: { type: String, default: '#0ea5e9' }
    }
}, 'web5e_sites');

const Web5eTab = getModel('Web5eTab', {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eSite', required: true, index: true },
    sectionKey: { type: String, required: true, trim: true, lowercase: true },
    tabKey: { type: String, required: true, trim: true, lowercase: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, refPath: 'createdByModel', default: null },
    createdByModel: { type: String, enum: ['Teacher', 'Admin', 'Student'], default: 'Teacher' }
}, 'web5e_tabs');

const Web5eEntry = getModel('Web5eEntry', {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eSite', required: true, index: true },
    tabId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eTab', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    authorName: { type: String, default: '' },
    title: { type: String, default: '' },
    blocks: { type: [ContentBlockSchema], default: [] },
    order: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: true },
    teacherValidated: { type: Boolean, default: false }
}, 'web5e_entries');

const Web5eActor = getModel('Web5eActor', {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eSite', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    name: { type: String, required: true, trim: true },
    imageUrl: { type: String, default: '' },
    initialX: { type: Number, default: 50 },
    initialY: { type: Number, default: 50 },
    scale: { type: Number, default: 1 },
    hiddenByDefault: { type: Boolean, default: false },
    actions: {
        type: [{
            id: { type: String, default: '' },
            name: { type: String, default: '' },
            frames: { type: [String], default: [] },
            speed: { type: Number, default: 100 }
        }],
        default: []
    }
}, 'web5e_actors');

const Web5eAnimation = getModel('Web5eAnimation', {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eSite', required: true, index: true },
    tabId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eTab', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    name: { type: String, default: 'Animation' },
    blocks: {
        type: [{
            type: { type: String, enum: ['newBlock', 'show', 'hide', 'playAction', 'stopAction', 'move', 'sound'], default: 'newBlock' },
            label: { type: String, default: '' },
            x: { type: Number, default: 0 },
            y: { type: Number, default: 0 },
            actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eActor', default: null },
            actionName: { type: String, default: '' },
            payload: { type: mongoose.Schema.Types.Mixed, default: {} }
        }],
        default: []
    },
    isPublished: { type: Boolean, default: true }
}, 'web5e_animations');

const Web5eAudio = getModel('Web5eAudio', {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eSite', required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null, index: true },
    tabId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eTab', default: null },
    name: { type: String, default: 'Son' },
    audioUrl: { type: String, default: '' },
    durationSec: { type: Number, default: 0 },
    modulation: {
        volume: { type: Number, default: 1 },
        rate: { type: Number, default: 1 },
        pitch: { type: Number, default: 1 }
    }
}, 'web5e_audio');

const Web5eMobileActionAccess = getModel('Web5eMobileActionAccess', {
    token: { type: String, required: true, unique: true, index: true, trim: true },
    actionId: { type: String, required: true, trim: true },
    entryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eEntry', default: null, index: true },
    tabId: { type: mongoose.Schema.Types.ObjectId, ref: 'Web5eTab', default: null, index: true },
    sectionKey: { type: String, default: '', trim: true, lowercase: true },
    tabKey: { type: String, default: '', trim: true, lowercase: true },
    blockIndex: { type: Number, default: 0 },
    lastIssuedAt: { type: Date, default: Date.now }
}, 'web5e_mobile_action_access');

module.exports = {
    Web5eSite,
    Web5eTab,
    Web5eEntry,
    Web5eActor,
    Web5eAnimation,
    Web5eAudio,
    Web5eMobileActionAccess
};
