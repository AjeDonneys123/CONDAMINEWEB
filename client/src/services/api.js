const API_BASE = '/api';

export const api = {
    async post(endpoint, data) {
        try {
            console.log(`📡 [API] Envoi POST vers ${API_BASE}${endpoint}`);
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Erreur Serveur");
            return result;
        } catch (error) {
            console.error(`❌ [API] Erreur sur ${endpoint}:`, error.message);
            return { error: error.message };
        }
    },

    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            return await response.json();
        } catch (error) {
            return null;
        }
    },

    async getHomeworks(classroom) { return this.get(`/homework/${classroom}`); }
};