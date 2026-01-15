import React, { useEffect, useRef } from 'react';
import { initZombieGame } from './zombie_core';
import './zombie_style.css';

export default function ZombieWrapper({ user, level, onClose }) {
    const boxRef = useRef(null);
    useEffect(() => {
        const engine = initZombieGame(boxRef.current, { level, user }, onClose);
        return () => engine.destroy();
    }, [level]);
    return <div className="fixed inset-0 bg-black z-[2000] flex items-center justify-center p-4"><div id="zombie-root" ref={boxRef}></div></div>;
}