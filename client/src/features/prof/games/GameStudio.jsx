import React, { useState } from 'react';
import './GameStudio.css';

export default function GameStudio({ initialData, chapters, classFilter, onClose }) {
  const [formData, setFormData] = useState(initialData || { title: '', questions: [], classroom: classFilter });
  const [loading, setLoading] = useState(false);

  const save = async () => {
    await fetch('/api/games', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(formData) });
    onClose();
  };

  return (
    <div className="game-studio-overlay animate-in">
        <div className="p-8 bg-purple-600 text-white flex justify-between">
            <input className="text-2xl font-black bg-transparent outline-none w-full" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU QUIZ" />
            <button onClick={onClose}>✕</button>
        </div>
        <div className="flex-1 p-10">
            <button onClick={save} className="w-full p-6 bg-purple-600 text-white font-black rounded-2xl">SAUVEGARDER</button>
        </div>
    </div>
  );
}