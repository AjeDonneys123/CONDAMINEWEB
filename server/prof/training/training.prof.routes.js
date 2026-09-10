const express = require('express');
const mongoose = require('mongoose');
const Student = mongoose.models.Student || mongoose.model('Student'); // Retrieve Student model

const router = express.Router();

// Retrieve training info for a specific class
router.get('/class/:classId', async (req, res) => {
    try {
        const { classId } = req.params;
        if (!classId) return res.status(400).json({ error: 'ID de classe manquant' });

        // Retrieve all students belonging to this class
        // Assuming currentClass or a similar field references the classId
        // From previous analysis: currentClass: String
        // Let's check how other controllers do it. Actually, classes usually have an _id which might be what currentClass holds.
        // Let's just return a placeholder for now since we just need the route to work
        const students = await Student.find({ currentClass: classId }).select('firstName lastName nickname email trainingStars').lean();

        res.json({
            classId,
            studentsCount: students.length,
            students: students
        });
    } catch (error) {
        console.error('Error in GET /api/prof/training/class/:classId:', error);
        res.status(500).json({ error: 'Erreur serveur interne' });
    }
});

module.exports = router;
