const mongoose = require('mongoose');

// Sous-schéma pour le layout (plus sûr qu'un objet imbriqué direct)
const LayoutSchema = new mongoose.Schema({
    separators: { type: [Number], default: [] },
    cols: { type: Number, default: 6 },
    rows: { type: Number, default: 5 }
}, { _id: false });

const Plan2SeatSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, required: true },
    seatX: { type: Number, required: true },
    seatY: { type: Number, required: true }
}, { _id: false });

const ClassroomSchema = new mongoose.Schema({
    name: { type: String, required: true, uppercase: true },
    level: { type: String }, 
    
    type: { type: String, enum: ['CLASS', 'GROUP'], default: 'CLASS' },
    associatedClasses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Classroom' }],
    yearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },

    // Configuration visuelle
    layout: { type: LayoutSchema, default: () => ({ separators: [] }) },
    // Le plan 1 conserve les coordonnées historiques des élèves. Le plan 2
    // possède son propre layout et ses propres places dans le document classe.
    layout2: { type: LayoutSchema, default: undefined },
    seatPlan2: { type: [Plan2SeatSchema], default: [] },
    activePlanNumber: { type: Number, enum: [1, 2], default: 1 }
}, { collection: 'classrooms' });

module.exports = mongoose.models.Classroom || mongoose.model('Classroom', ClassroomSchema);
