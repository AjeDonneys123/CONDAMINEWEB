const fs = require('fs');
const path = require('path');

/**
 * 🛡️ APPLY.JS V10.0 - MODE PASSIF (SIGNAL POUR ANTIGRAVITY)
 * - Ne modifie PLUS jamais les fichiers du projet automatiquement.
 * - Son rôle est désormais de transférer les suggestions vers 'update.agent.txt'.
 * - Antigravity lit ce fichier et effectue la greffe chirurgicale après vérification.
 */

const statusFile = 'apply_status.json';
const inputFile = 'update.txt';
const agentMailbox = 'update.agent.txt';

function writeStatus(type, message) {
    const data = { status: type, message, timestamp: Date.now() };
    try { fs.writeFileSync(statusFile, JSON.stringify(data, null, 2)); } catch(e) {}
}

function processMailbox() {
    try {
        if (!fs.existsSync(inputFile)) return;
        const rawContent = fs.readFileSync(inputFile, 'utf8');
        if (!rawContent || rawContent.length < 10) return;

        // On vide l'input pour ne pas boucler
        fs.writeFileSync(inputFile, ''); 
        
        // On transfère simplement le contenu brut vers la boîte aux lettres de l'agent
        // L'agent (Antigravity) verra ce changement de fichier et le lira
        fs.writeFileSync(agentMailbox, rawContent);
        
        console.log(`📩 [MAILBOX] Nouvelle suggestion reçue dans ${agentMailbox}`);
        writeStatus('PENDING', 'Suggestion en attente de vérification par l\'agent');
    } catch (e) {
        console.log(`💥 ERREUR MAILBOX : ${e.message}`);
        writeStatus('ERROR', e.message);
    }
}

setInterval(processMailbox, 1000);
console.log("🛡️ APPLY V10.0 : MODE PASSIF ACTIVÉ (GARDRE-FOU)");
console.log("Les fichiers du projet sont désormais protégés contre l'écrasement automatique.");
