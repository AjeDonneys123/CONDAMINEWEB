const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

/**
 * ☁️ DOMAINE : UPLOAD (CLOUDINARY)
 * Gère l'hébergement des images pour les devoirs et les quiz.
 */

// Configuration Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'condamine_uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 1200, quality: "auto" }]
    }
});

const upload = multer({ storage: storage });

// POST /api/upload
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, message: "Aucun fichier reçu" });
        }
        // Renvoie l'URL sécurisée de Cloudinary
        res.json({ ok: true, imageUrl: req.file.path });
    } catch (e) {
        console.error("❌ [UPLOAD] Crash:", e.message);
        res.status(500).json({ ok: false, error: e.message });
    }
});

module.exports = router;