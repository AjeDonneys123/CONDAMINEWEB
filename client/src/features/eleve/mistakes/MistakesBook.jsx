// @signatures: MistakesBook
import React from 'react';

export default function MistakesBook({ user }) {
  // FIX V101 : On utilise directement les données de l'utilisateur passées par ElevePage
  // (Plus besoin de fetch /api/players qui causait le 404)
  const mistakes = user?.spellingMistakes || [];

  return (
    <div className="bg-white p-8 rounded-[40px] shadow-sm animate-in">
      <h2 className="text-2xl font-black mb-6">Mon Carnet d'Orthographe ✒️</h2>
      <div className="space-y-3">
        {mistakes.map((m, i) => (
            <div key={i} className="p-4 bg-slate-50 rounded-2xl flex gap-4">
                <span className="text-red-500 line-through font-bold">{m.wrong}</span>
                <span>➔</span>
                <span className="text-green-600 font-black">{m.correct}</span>
            </div>
        ))}
        {mistakes.length === 0 && (
            <div className="text-center py-10">
                <span className="text-4xl block mb-2">✨</span>
                <p className="text-slate-400 font-bold uppercase text-xs">Aucune erreur enregistrée. Félicitations !</p>
            </div>
        )}
      </div>
    </div>
  );
}
