import React, { useEffect, useMemo, useRef, useState } from 'react';

const LESSON_CARDS = [
    {
        id: 'division', name: 'La division de l’Empire', shortName: 'Division de l’Empire',
        truth: 'À partir du IIIᵉ siècle, l’Empire romain s’affaiblit et se divise en deux pour résister aux invasions barbares.',
        enemyClaim: 'À partir du IIIᵉ siècle, l’Empire romain reste uni et assez puissant pour arrêter toutes les invasions.',
        question: 'Pourquoi l’Empire romain se divise-t-il en deux ?', answer: 'Pour mieux résister aux invasions barbares',
        options: ['Pour mieux résister aux invasions barbares', 'Pour supprimer le christianisme', 'Pour abandonner Rome', 'Pour aider les royaumes barbares']
    },
    {
        id: 'occident', name: 'La chute de l’Occident', shortName: 'Chute de l’Occident',
        truth: 'À l’Ouest, l’Empire romain d’Occident disparaît en 476.',
        enemyClaim: 'L’Empire romain d’Occident survit après 476 et conserve Rome comme capitale.',
        question: 'En quelle année l’Empire romain d’Occident disparaît-il ?', answer: '476',
        options: ['476', '395', '800', '1453']
    },
    {
        id: 'byzance', name: 'La survie byzantine', shortName: 'Survie byzantine',
        truth: 'À l’Est, l’Empire romain d’Orient survit sous le nom d’Empire byzantin.',
        enemyClaim: 'L’Empire romain d’Orient disparaît lui aussi en 476 et aucun empire ne survit à l’Est.',
        question: 'Quel nom prend l’Empire romain d’Orient qui survit ?', answer: 'Empire byzantin',
        options: ['Empire byzantin', 'Empire carolingien', 'Saint-Empire romain', 'Empire ottoman']
    },
    {
        id: 'chretiente', name: 'La continuité chrétienne', shortName: 'Continuité chrétienne',
        truth: 'La religion chrétienne demeure dans tout l’ancien Empire, dirigée par le pape et le clergé.',
        enemyClaim: 'Après la disparition de Rome, la religion chrétienne disparaît totalement de l’ancien Empire.',
        question: 'Qui dirige la religion chrétienne dans l’ancien Empire ?', answer: 'Le pape et le clergé',
        options: ['Le pape et le clergé', 'Les empereurs barbares', 'Cyrille seul', 'Les sénateurs romains']
    },
    {
        id: 'missionnaires', name: 'Cyrille et Méthode', shortName: 'Cyrille et Méthode',
        truth: 'À partir du IXᵉ siècle, les missionnaires Cyrille et Méthode convertissent les peuples d’Europe de l’Est au christianisme.',
        enemyClaim: 'Au Vᵉ siècle, Cyrille et Méthode convertissent uniquement les peuples d’Europe de l’Ouest.',
        question: 'Quels peuples Cyrille et Méthode convertissent-ils à partir du IXᵉ siècle ?', answer: 'Les peuples d’Europe de l’Est',
        options: ['Les peuples d’Europe de l’Est', 'Uniquement les Romains', 'Les peuples d’Amérique', 'Les peuples d’Europe de l’Ouest']
    }
];

const clean = (value) => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();

export default function PokedeckBattle({ onExit, onDefense, onEnemyAttack }) {
    const [round, setRound] = useState(0);
    const [phase, setPhase] = useState('enemy');
    const [defenseType, setDefenseType] = useState('');
    const [defenseInput, setDefenseInput] = useState('');
    const [showCards, setShowCards] = useState(false);
    const [attackType, setAttackType] = useState('');
    const [attackInput, setAttackInput] = useState('');
    const [heroHp, setHeroHp] = useState(100);
    const [enemyHp, setEnemyHp] = useState(100);
    const [notice, setNotice] = useState('');
    const [rayActive, setRayActive] = useState(false);
    const timersRef = useRef([]);
    const card = LESSON_CARDS[round % LESSON_CARDS.length];
    const shuffledOptions = useMemo(() => [...card.options].sort(() => Math.random() - .5), [card.id]);

    const schedule = (callback, delay) => {
        const timer = setTimeout(callback, delay);
        timersRef.current.push(timer);
    };

    useEffect(() => () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    }, []);

    useEffect(() => {
        if (heroHp > 0) return;
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
        setRayActive(false);
        setNotice('Tes points de vie sont épuisés. Reprends le combat pour vaincre les contre-vérités.');
        setPhase('defeat');
    }, [heroHp]);

    const damageHero = (damage, message) => {
        if (message) setNotice(message);
        setHeroHp((hp) => Math.max(0, hp - damage));
    };

    const chooseDefense = (type) => {
        setDefenseType(type);
        setDefenseInput('');
        setShowCards(type === 'small');
        setNotice('');
        setPhase('defense');
    };

    const resolveDefense = (selectedName) => {
        if (clean(selectedName) !== clean(card.name) && clean(selectedName) !== clean(card.shortName)) {
            setNotice('Cette carte ne contre pas la phrase d’Hérodote. Choisis la grande idée correcte.');
            return;
        }
        setNotice('Carte correcte — invocation !');
        setPhase('defense-animation');
        onDefense?.(defenseType);
        schedule(() => {
            onEnemyAttack?.();
            setRayActive(true);
            if (defenseType === 'small') damageHero(12);
        }, 800);
        schedule(() => {
            setRayActive(false);
            setPhase('attack-choice');
            setNotice(defenseType === 'super' ? 'Super défense parfaite : aucun PV perdu.' : 'Le blocage réduit les dégâts, mais tu perds 12 PV.');
        }, 2200);
    };

    const chooseAttack = (type) => {
        setAttackType(type);
        setAttackInput('');
        setNotice('');
        setPhase('attack-answer');
    };

    const resolveAttack = (value) => {
        if (clean(value) !== clean(card.answer)) {
            damageHero(8, 'Réponse incorrecte : la contre-attaque échoue et tu perds 8 PV.');
            return;
        }
        const damage = attackType === 'large' ? 32 : 18;
        const nextEnemyHp = Math.max(0, enemyHp - damage);
        setEnemyHp(nextEnemyHp);
        setNotice(`${attackType === 'large' ? 'Grande' : 'Petite'} attaque réussie : -${damage} PV !`);
        setPhase('result');
        schedule(() => {
            if (nextEnemyHp <= 0) {
                setPhase('victory');
                return;
            }
            setRound((valueRound) => valueRound + 1);
            setDefenseType('');
            setDefenseInput('');
            setAttackType('');
            setNotice('');
            setPhase('enemy');
        }, 1500);
    };

    return (
        <div className="pokedeck-battle">
            <button type="button" className="pokedeck-close" onClick={onExit}>×</button>
            <div className="pokedeck-hud">
                <div><strong>HÉROS</strong><span><i style={{ width: `${heroHp}%` }} />{heroHp} PV</span></div>
                <div className="pokedeck-turn">TOUR {round + 1}</div>
                <div><strong>HÉRODOTE</strong><span><i style={{ width: `${enemyHp}%` }} />{enemyHp} PV</span></div>
            </div>

            <div className="pokedeck-arena">
                <div className="pokedeck-fighter hero">🛡️<b>HÉROS</b></div>
                <div className={`pokedeck-purple-ray ${rayActive ? 'active' : ''}`} />
                <div className="pokedeck-fighter enemy">👤<b>HÉRODOTE</b></div>
            </div>

            <div className="pokedeck-panel">
                {phase === 'enemy' && <>
                    <div className="pokedeck-kicker">ATTAQUE ADVERSE — CONTRE-VÉRITÉ HISTORIQUE</div>
                    <h2>« {card.enemyClaim} »</h2>
                    <div className="pokedeck-actions">
                        <button className="small" onClick={() => chooseDefense('small')}>PETITE DÉFENSE</button>
                        <button className="super" onClick={() => chooseDefense('super')}>SUPER DÉFENSE</button>
                    </div>
                </>}

                {phase === 'defense' && <>
                    <div className="pokedeck-kicker">CHOISIS LA CARTE QUI CONTRE CETTE AFFIRMATION</div>
                    {defenseType === 'super' ? <>
                        <input autoFocus value={defenseInput} onChange={(event) => setDefenseInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && resolveDefense(defenseInput)} placeholder="Écris le nom exact de la carte…" />
                        <div className="pokedeck-actions"><button onClick={() => setShowCards((value) => !value)}>VOIR MES CARTES</button><button className="super" onClick={() => resolveDefense(defenseInput)}>INVOQUER</button></div>
                    </> : <div className="pokedeck-kicker">Clique sur une carte de ta main.</div>}
                    {showCards && <div className="pokedeck-cards">{LESSON_CARDS.map((item) => <button key={item.id} onClick={() => defenseType === 'small' ? resolveDefense(item.name) : setDefenseInput(item.name)}><strong>{item.name}</strong><span>{item.truth}</span></button>)}</div>}
                </>}

                {phase === 'defense-animation' && <><div className="pokedeck-kicker">PHASE DE DÉFENSE</div><h2>{rayActive ? 'Le rayon violet frappe le bouclier !' : 'Invocation du bouclier…'}</h2></>}

                {phase === 'attack-choice' && <>
                    <div className="pokedeck-kicker">PHASE DE CONTRE-ATTAQUE</div>
                    <h2>{card.question}</h2>
                    <div className="pokedeck-actions"><button className="small" onClick={() => chooseAttack('small')}>PETITE ATTAQUE · QCM</button><button className="super" onClick={() => chooseAttack('large')}>GRANDE ATTAQUE · RÉPONSE</button></div>
                </>}

                {phase === 'attack-answer' && <>
                    <div className="pokedeck-kicker">{attackType === 'large' ? 'GRANDE ATTAQUE' : 'PETITE ATTAQUE'}</div>
                    <h2>{card.question}</h2>
                    {attackType === 'large' ? <div className="pokedeck-type-answer"><input autoFocus value={attackInput} onChange={(event) => setAttackInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && resolveAttack(attackInput)} placeholder="Tape ta réponse…"/><button onClick={() => resolveAttack(attackInput)}>ATTAQUER</button></div> : <div className="pokedeck-qcm">{shuffledOptions.map((option) => <button key={option} onClick={() => resolveAttack(option)}>{option}</button>)}</div>}
                </>}

                {phase === 'result' && <h2>{notice}</h2>}
                {phase === 'victory' && <><div className="pokedeck-kicker">VICTOIRE HISTORIQUE</div><h2>Les contre-vérités d’Hérodote sont vaincues !</h2><button className="pokedeck-victory" onClick={onExit}>RETOURNER AU JEU</button></>}
                {phase === 'defeat' && <><div className="pokedeck-kicker">DÉFAITE</div><h2>{notice}</h2><button className="pokedeck-victory" onClick={onExit}>RETOURNER AU JEU</button></>}
                {notice && !['result', 'victory'].includes(phase) && <div className="pokedeck-notice">{notice}</div>}
            </div>
        </div>
    );
}

export { LESSON_CARDS };
