import React, { useState } from 'react';
import ZombieWrapper from './zombie/ZombieWrapper';

export default function GamesGrid({ user }) {
  const [activeGame, setActiveGame] = useState(null);

  if (activeGame === 'zombie') {
      return <ZombieWrapper user={user} onClose={() => setActiveGame(null)} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4">
        
        {/* CARTE ZOMBIE */}
        <div className="bg-white p-8 rounded-[40px] border-b-8 border-green-600 shadow-xl hover:-translate-y-1 transition-all">
            <span className="text-5xl">🧟</span>
            <h3 className="text-2xl font-black mt-4 uppercase tracking-tighter">Zombie Grammar</h3>
            <p className="text-slate-400 mt-2 font-medium">Survis à l'invasion en corrigeant les fautes.</p>
            <button 
                onClick={() => setActiveGame('zombie')} 
                className="mt-6 w-full py-4 bg-green-600 text-white rounded-2xl font-black shadow-lg hover:bg-green-700 transition-all"
            >
                JOUER
            </button>
        </div>

        {/* CARTE STARSHIP (Locked) */}
        <div className="bg-white p-8 rounded-[40px] border-b-8 border-slate-200 opacity-40">
            <span className="text-5xl">🚀</span>
            <h3 className="text-2xl font-black mt-4 uppercase tracking-tighter">Starship</h3>
            <p className="text-slate-400 mt-2 font-medium">Bientôt disponible dans ta galaxie.</p>
            <button disabled className="mt-6 w-full py-4 bg-slate-300 text-white rounded-2xl font-black cursor-not-allowed">VERROUILLÉ</button>
        </div>
    </div>
  );
}