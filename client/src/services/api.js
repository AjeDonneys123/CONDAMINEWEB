/**
 * SERVICE API REACT
 * Remplace window.api de la version Vanilla
 */
const API_BASE = '/api';

export const api = {
    async post(endpoint, data) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return await response.json();
        } catch (error) {
            console.error(`Erreur POST ${endpoint}:`, error);
            return { ok: false, error: error.message };
        }
    },

    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) throw new Error('Network response was not ok');
            return await response.json();
        } catch (error) {
            console.error(`Erreur GET ${endpoint}:`, error);
            return null;
        }
    },

    // Récupérer les devoirs d'une classe
    async getHomeworks(classroom) {
        return this.get(`/homework/${classroom}`);
    },

    // Récupérer les données d'un élève (fautes, etc.)
    async getPlayerData(id) {
        return this.get(`/player-data/${id}`);
    }
};

