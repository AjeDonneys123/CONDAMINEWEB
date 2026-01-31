/**
 * 🛠️ SETUP DES TESTS V500 (ADAPTATION ATOMIQUE)
 */
import { vi, afterEach } from 'vitest';
import mongoose from 'mongoose';

// On s'assure que les modèles sont bien chargés avant les tests
// On charge d'abord le bloc Prof car il est le plus complet
try { require('../server/prof/models/prof.models.js'); } catch(e) {}
try { require('../server/eleve/models/eleve.models.js'); } catch(e) {}

afterEach(() => {
    vi.clearAllMocks();
});
