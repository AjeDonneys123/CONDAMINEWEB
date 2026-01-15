import React from 'react';

export default function ProfStudioFolder({ items, chapters, classFilter, onEditItem }) {
    return (
        <div className="space-y-4">
            {chapters.filter(c => c.classroom === classFilter).map(chap => (
                <div key={chap._id} className="bg-white p-6 rounded-[30px] border shadow-sm">
                    <h3 className="font-black text-slate-700 uppercase mb-4">📂 {chap.title}</h3>
                    <div className="grid gap-2">
                        {items.filter(it => String(it.chapterId) === String(chap._id)).map(it => (
                            <div key={it._id} onClick={() => onEditItem(it)} className="p-4 bg-slate-50 rounded-xl flex justify-between cursor-pointer hover:bg-indigo-50">
                                <b className="text-xs uppercase">{it.title}</b>
                                <span className="text-[10px] font-black text-slate-300">{it.actType}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}