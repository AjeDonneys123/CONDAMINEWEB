import React, { useState } from 'react';
import './HomeworkStudio.css';

export default function HomeworkStudio({ initialData, chapters, globalClass, user, onClose }) {
  const [formData, setFormData] = useState(initialData || { title: '', levels: [{instruction: '', attachmentUrls: []}], classroom: globalClass });

  const save = async () => {
    await fetch('/api/homework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, teacherId: user.id || user._id })
    });
    onClose();
  };

  return (
    <div className="hw-studio-overlay animate-in">
        <div className="p-8 bg-orange-500 text-white flex justify-between">
            <input className="text-2xl font-black bg-transparent outline-none w-full" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} placeholder="TITRE DU DEVOIR" />
            <button onClick={onClose}>✕</button>
        </div>
        <div className="p-10 flex-1">
            <button onClick={save} className="w-full p-6 bg-orange-500 text-white font-black rounded-2xl">SAUVEGARDER</button>
        </div>
    </div>
  );
}