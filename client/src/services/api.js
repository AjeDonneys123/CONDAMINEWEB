const API_BASE = '/api';

export const api = {
    async get(endpoint) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`);
            if (!response.ok) return null;
            return await response.json();
        } catch (error) { return null; }
    },
    async post(endpoint, data) {
        try {
            const response = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            return await response.json();
        } catch (error) { return { ok: false }; }
    },
    // FIX : Utilise la nouvelle route avec préfixe
    async getHomeworks(classroom) {
        return this.get(`/homework/by-class/${classroom}`);
    },
    async getSingleHomework(id) {
        return this.get(`/homework/single/${id}`);
    }
};