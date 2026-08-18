import React, { useEffect, useMemo, useRef, useState } from 'react';
import HomeworkList from '../homework/HomeworkList';
import './ExamTrainingHub.css';

const TRAINING_SCORE_EVENT = 'condaweb:training-score';

const reportTrainingScore = (exerciseId, correct, total) => {
  if (typeof window === 'undefined' || !exerciseId) return;
  window.dispatchEvent(new CustomEvent(TRAINING_SCORE_EVENT, {
    detail: {
      exerciseId: String(exerciseId),
      correct: Math.max(0, Number(correct) || 0),
      total: Math.max(0, Number(total) || 0)
    }
  }));
};

function TrainingPointsBadge({ user }) {
  const studentKey = String(user?._id || user?.id || user?.name || 'student').replace(/[^a-zA-Z0-9_-]/g, '_');
  const storageKey = `condaweb-training-points-v1:${studentKey}`;
  const [progress, setProgress] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (saved && typeof saved === 'object') return { points: Number(saved.points) || 0, best: saved.best || {} };
    } catch (_) {}
    return { points: 0, best: {} };
  });
  const [gain, setGain] = useState(0);

  useEffect(() => {
    const onScore = (event) => {
      const detail = event?.detail || {};
      if (!detail.exerciseId || detail.total <= 0) return;
      setProgress((previous) => {
        const oldBest = Math.max(0, Number(previous.best?.[detail.exerciseId]) || 0);
        const nextBest = Math.min(detail.total, Math.max(oldBest, detail.correct));
        const newlyCorrect = Math.max(0, nextBest - oldBest);
        const perfectBonus = nextBest === detail.total && oldBest < detail.total ? 20 : 0;
        const earned = newlyCorrect * 10 + perfectBonus;
        if (!earned) return previous;
        const next = {
          points: previous.points + earned,
          best: { ...previous.best, [detail.exerciseId]: nextBest }
        };
        try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch (_) {}
        setGain(earned);
        window.setTimeout(() => setGain(0), 1800);
        return next;
      });
    };
    window.addEventListener(TRAINING_SCORE_EVENT, onScore);
    return () => window.removeEventListener(TRAINING_SCORE_EVENT, onScore);
  }, [storageKey]);

  return (
    <div className="fixed right-5 top-4 z-[900] flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-white/95 px-4 py-3 font-black text-amber-700 shadow-xl backdrop-blur">
      <span className="text-xl">⭐</span>
      <span>{progress.points} points</span>
      {gain > 0 && <span className="animate-pulse rounded-xl bg-emerald-100 px-2 py-1 text-xs text-emerald-700">+{gain}</span>}
    </div>
  );
}

const normalizeClass = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

const normalizeClassKey = (value = '') => normalizeClass(value).replace(/[^A-Z0-9]/g, '');

const normalizeLevel = (value = '') => {
  const raw = normalizeClass(value);
  if (/^(6|6E|6EME|SIXIEME)/.test(raw)) return '6';
  if (/^(5|5E|5EME|CINQUIEME)/.test(raw)) return '5';
  if (/^(4|4E|4EME|QUATRIEME)/.test(raw)) return '4';
  if (/^(3|3E|3EME|TROISIEME)/.test(raw)) return '3';
  if (/^(2|2DE|2NDE|SECONDE)/.test(raw)) return '2';
  if (/^(1|1ERE|PREMIERE)/.test(raw)) return '1';
  return raw.slice(0, 1);
};

export const getTrainingModeForStudent = (user = {}) => {
  const cls = normalizeClass(user.currentClass || user.className || '');
  if (/^3/.test(cls)) return 'dnb';
  if (/^(5|5E|5EME|CINQUIEME)/.test(cls)) return 'cinquieme';
  if (/^(2|2DE|SECONDE)/.test(cls)) return 'seconde';
  return '';
};

const DNB_TABS = [
  { key: 'full', label: 'Brevet', hint: 'Sujet complet' },
  { key: 'docs', label: 'Docs', hint: 'Questions sur documents' },
  { key: 'paragraphe', label: 'Paragraphe', hint: 'Développement construit' },
  { key: 'reperes', label: 'Repères', hint: 'Dates, cartes, frises' },
  { key: 'emc', label: 'EMC', hint: 'Enseignement moral et civique' }
];

const DNB_PARAGRAPH_LOCAL_ACTIVITIES = [
  {
    id: 'civilians-ww1',
    title: 'Les civils dans la Première Guerre mondiale',
    wordBank: ['génocide', 'censure', 'munitionnettes', 'propagande', 'réquisitions', 'emprunts nationaux', 'économie de guerre', 'bombardements', 'Arméniens'],
    blanks: ['bombardements', 'réquisitions', 'génocide', 'Arméniens', 'économie de guerre', 'emprunts nationaux', 'munitionnettes', 'propagande', 'censure'],
    paragraphs: [
      ['Pendant la Première Guerre mondiale (1914-1918), les civils subissent le conflit tout en étant mobilisés.'],
      ["D'une part, les civils sont victimes de la guerre. Certaines villes subissent des ", 1, ', comme à Reims, tandis que dans les zones occupées, les habitants subissent des ', 2, " allemandes. De plus, en 1915-1916, l'Empire ottoman commet le ", 3, ' des ', 4, ", accusés de complicité avec la Russie, faisant plus d'un million de morts."],
      ["D'autre part, les civils participent à l'", 5, '. Pour financer le conflit, les États lancent des impôts et des ', 6, ". Les usines se reconvertissent pour fabriquer des armes. Dans les champs et les usines de munitions, les femmes remplacent les hommes : on les appelle les ", 7, ". Enfin, pour contrôler les esprits, les États utilisent la ", 8, " (affiches, école) et la ", 9, ' des journaux.']
    ]
  },
  {
    id: 'soldiers-ww1',
    title: 'Les militaires dans la Première Guerre mondiale',
    wordBank: ['Verdun', 'mutineries', 'violence de masse', 'Gueules cassées', 'tranchées', 'Poilus', 'gaz asphyxiants', 'obus'],
    blanks: ['Poilus', 'violence de masse', 'obus', 'gaz asphyxiants', 'Verdun', 'tranchées', 'mutineries', 'Gueules cassées'],
    paragraphs: [
      ['Durant la Première Guerre mondiale, les soldats font face à une souffrance extrême.'],
      ["Tout d'abord, les soldats français, surnommés les ", 1, ', subissent une ', 2, " due à des armes modernes. Ils sont soumis aux tirs d'", 3, ' et aux ', 4, '. Les combats sont très meurtriers, notamment lors de la bataille de ', 5, ' en 1916 qui fait 300 000 morts.'],
      ["Ensuite, durant la guerre de position, les combattants s'enterrent dans des ", 6, ". Le quotidien y est terrible : froid, boue, faim, rats et poux. Malgré la camaraderie, l'épuisement et la détresse psychologique provoquent des ", 7, ' en 1917.'],
      ['Enfin, le bilan est dramatique : la guerre laisse 10 millions de morts et des millions de mutilés, surnommés les ', 8, '.']
    ]
  },
  {
    id: 'total-war-ww1',
    title: 'La Première Guerre mondiale, une guerre totale',
    wordBank: ['propagande', 'guerre totale', 'munitionnettes', 'censure', 'économie de guerre', 'tranchées', 'violence de masse'],
    blanks: ['guerre totale', 'violence de masse', 'tranchées', 'économie de guerre', 'munitionnettes', 'propagande', 'censure'],
    paragraphs: [
      ['La Première Guerre mondiale (1914-1918) est considérée comme une ', 1, ' car toute la société y est impliquée.'],
      ['Sur le front, les soldats subissent une ', 2, " et s'enterrent dans des ", 3, '. Les armes industrielles provoquent la mort de 10 millions de militaires.'],
      ["À l'Arrière, l'État met en place une ", 4, '. Les usines sont reconverties pour produire des armes et les femmes, appelées les ', 5, ", travaillent dans les usines d'armement. Pour financer le conflit, les gouvernements font des emprunts nationaux."],
      ["Enfin, l'État cherche à contrôler les esprits. Il utilise la ", 6, ' (affiches, école) pour motiver la population et applique la ', 7, ' pour éviter les critiques dans les journaux.']
    ]
  }
];

const DNB_PARAGRAPH_REAL_ACTIVITIES = [
  {
    id: 'civilians-ww1-real',
    title: 'Sujet réel · Les civils dans la guerre',
    source: 'Amérique du Nord — Juin 2019',
    instruction: "Dans un développement construit d'une vingtaine de lignes, décrivez et expliquez les souffrances subies par les civils au cours de la Première Guerre mondiale."
  },
  {
    id: 'soldiers-ww1-real',
    title: 'Sujet réel · Les militaires et la violence de masse',
    source: 'Centres Étrangers — Juin 2017',
    instruction: "Dans un développement construit d'une vingtaine de lignes, décrivez les conditions de vie des soldats dans les tranchées et montrez la violence des combats."
  },
  {
    id: 'total-war-ww1-real',
    title: 'Sujet réel · La guerre totale',
    source: 'Métropole — Juin 2018',
    instruction: "Dans un développement construit d'une vingtaine de lignes, vous montrerez que la Première Guerre mondiale est une guerre totale qui touche les militaires et les civils."
  }
];

const DNB_HISTORY_REPERES = [
  { id: 'sarajevo', group: 'La Première Guerre mondiale', date: '28 juin 1914', year: 1914.49, title: "Assassinat de François-Ferdinand à Sarajevo", detail: "L'attentat déclenche la crise qui mène à la guerre." },
  { id: 'ww1-start-france', group: 'La Première Guerre mondiale', date: '3 août 1914', year: 1914.59, title: "L'Allemagne déclare la guerre à la France", detail: "Début de la Première Guerre mondiale pour la France." },
  { id: 'trenches-start', group: 'La Première Guerre mondiale', date: 'Novembre 1914', year: 1914.86, title: "Début de la guerre de positions", detail: "Les soldats s'enterrent dans les tranchées." },
  { id: 'verdun-1916', group: 'La Première Guerre mondiale', date: 'Février-décembre 1916', year: 1916.15, startYear: 1916.15, endYear: 1916.95, title: "Bataille de Verdun", detail: "Bataille symbole de la violence de masse." },
  { id: 'russia-usa-1917', group: 'La Première Guerre mondiale', date: '1917', year: 1917, title: "Révolution bolchevique et entrée en guerre des États-Unis", detail: "La guerre devient encore plus mondiale." },
  { id: 'armistice-1918', group: 'La Première Guerre mondiale', date: '11 novembre 1918', year: 1918.86, title: "Armistice de la Grande Guerre", detail: "Fin des combats de la Première Guerre mondiale." },
  { id: 'versailles-1919', group: 'La Première Guerre mondiale', date: '28 juin 1919', year: 1919.49, title: "Traité de Versailles", detail: "Paix officielle imposée à l'Allemagne." },
  { id: 'bolchevique-1917', group: 'Les régimes totalitaires', date: 'Octobre 1917', year: 1917.82, title: "Révolution bolchevique en Russie", detail: "Les bolcheviks prennent le pouvoir." },
  { id: 'mussolini-1922', group: 'Les régimes totalitaires', date: '1922', year: 1922, title: "Mussolini prend le pouvoir en Italie", detail: "La marche sur Rome installe le fascisme au pouvoir." },
  { id: 'stalin-1924', group: 'Les régimes totalitaires', date: '1924', year: 1924, title: "Mort de Lénine et début de l'ère Staline", detail: "Staline s'impose progressivement en URSS." },
  { id: 'wall-street-1929', group: 'Les régimes totalitaires', date: 'Octobre 1929', year: 1929.82, title: "Krach boursier à Wall Street", detail: "Début d'une crise économique mondiale." },
  { id: 'hitler-1933', group: 'Les régimes totalitaires', date: '30 janvier 1933', year: 1933.08, title: "Hitler devient chancelier", detail: "Les nazis arrivent au pouvoir en Allemagne." },
  { id: 'nuremberg-1935', group: 'Les régimes totalitaires', date: '1935', year: 1935, title: "Lois antisémites de Nuremberg", detail: "Les Juifs allemands sont exclus de la citoyenneté." },
  { id: 'espagne-1936', group: 'Les régimes totalitaires', date: '1936-1939', year: 1936, startYear: 1936, endYear: 1939, title: "Guerre d'Espagne", detail: "La guerre oppose républicains et nationalistes." },
  { id: 'purges-1936', group: 'Les régimes totalitaires', date: '1936-1938', year: 1936.2, startYear: 1936, endYear: 1938, title: "Grandes purges staliniennes", detail: "Staline élimine ses opposants réels ou supposés." },
  { id: 'pologne-1939', group: 'La Seconde Guerre mondiale', date: '1er septembre 1939', year: 1939.67, title: "Invasion de la Pologne", detail: "Début de la Seconde Guerre mondiale." },
  { id: 'appel-1940', group: 'La Seconde Guerre mondiale', date: '18 juin 1940', year: 1940.47, title: "Appel du général de Gaulle", detail: "De Gaulle appelle à résister depuis Londres." },
  { id: 'vichy-1940', group: 'La Seconde Guerre mondiale', date: '1940-1944', year: 1940.55, startYear: 1940, endYear: 1944, title: "Régime de Vichy", detail: "Pétain dirige un régime autoritaire et collaborateur." },
  { id: 'barbarossa-1941', group: 'La Seconde Guerre mondiale', date: '22 juin 1941', year: 1941.47, title: "Opération Barbarossa", detail: "L'Allemagne nazie envahit l'URSS." },
  { id: 'pearl-harbor-1941', group: 'La Seconde Guerre mondiale', date: '7 décembre 1941', year: 1941.93, title: "Attaque de Pearl Harbor", detail: "Les États-Unis entrent en guerre contre le Japon." },
  { id: 'solution-finale-1942', group: 'La Seconde Guerre mondiale', date: '1942', year: 1942, title: "Mise en œuvre de la Solution finale", detail: "Les nazis organisent l'extermination des Juifs d'Europe." },
  { id: 'stalingrad-1943', group: 'La Seconde Guerre mondiale', date: 'Janvier-février 1943', year: 1943.05, title: "Bataille de Stalingrad", detail: "Tournant majeur de la guerre en Europe." },
  { id: 'normandie-1944', group: 'La Seconde Guerre mondiale', date: '6 juin 1944', year: 1944.43, title: "Débarquement allié en Normandie", detail: "Les Alliés ouvrent un front à l'ouest." },
  { id: 'capitulation-allemande-1945', group: 'La Seconde Guerre mondiale', date: '8 mai 1945', year: 1945.35, title: "Capitulation allemande", detail: "Fin de la guerre en Europe." },
  { id: 'onu-1945', group: 'La Seconde Guerre mondiale', date: '26 juin 1945', year: 1945.49, title: "Création de l'ONU", detail: "Organisation chargée de maintenir la paix." },
  { id: 'hiroshima-nagasaki-1945', group: 'La Seconde Guerre mondiale', date: '6 et 9 août 1945', year: 1945.6, title: "Bombes atomiques sur Hiroshima et Nagasaki", detail: "Les États-Unis utilisent l'arme nucléaire contre le Japon." },
  { id: 'japon-1945', group: 'La Seconde Guerre mondiale', date: '2 septembre 1945', year: 1945.67, title: "Capitulation du Japon", detail: "Fin de la Seconde Guerre mondiale." },
  { id: 'nuremberg-1945', group: 'La Seconde Guerre mondiale', date: '1945', year: 1945.82, title: "Procès de Nuremberg", detail: "Les principaux criminels nazis sont jugés." },
  { id: 'marshall-1947', group: "L'après-guerre et la Guerre froide", date: '1947', year: 1947, title: "Plan Marshall et début de la Guerre froide", detail: "Les États-Unis aident l'Europe occidentale et l'opposition Est-Ouest s'installe." },
  { id: 'inde-pakistan-1947', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '15 août 1947', year: 1947.62, title: "Indépendance de l'Inde et du Pakistan", detail: "Fin de la domination britannique sur les Indes." },
  { id: 'berlin-israel-ddhc-1948', group: "L'après-guerre et la Guerre froide", date: '1948', year: 1948, title: "Blocus de Berlin, Israël, Déclaration universelle des droits de l'homme", detail: "Année majeure de l'après-guerre." },
  { id: 'otan-allemagne-chine-1949', group: "L'après-guerre et la Guerre froide", date: '1949', year: 1949, title: "OTAN, RFA/RDA et victoire communiste en Chine", detail: "Le monde se structure autour de blocs." },
  { id: 'ceca-1951', group: 'La construction européenne', date: '1951', year: 1951, title: "Création de la CECA", detail: "Première étape importante de la construction européenne." },
  { id: 'dien-bien-phu-1954', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '1954', year: 1954, title: "Diên Biên Phu et indépendance du Vietnam", detail: "La France est vaincue en Indochine." },
  { id: 'algerie-war-1954', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '1954-1962', year: 1954.2, startYear: 1954, endYear: 1962, title: "Guerre d'Algérie", detail: "Guerre de décolonisation entre la France et les indépendantistes algériens." },
  { id: 'rome-1957', group: 'La construction européenne', date: '1957', year: 1957, title: "Traité de Rome", detail: "Création de la CEE." },
  { id: 'afrique-1960', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '1960', year: 1960, title: "Année de l'Afrique", detail: "17 pays africains accèdent à l'indépendance." },
  { id: 'berlin-wall-1961', group: "L'après-guerre et la Guerre froide", date: '13 août 1961', year: 1961.61, title: "Construction du mur de Berlin", detail: "Berlin devient le symbole de la division Est-Ouest." },
  { id: 'cuba-1962', group: "L'après-guerre et la Guerre froide", date: 'Octobre 1962', year: 1962.82, title: "Crise des missiles de Cuba", detail: "Le monde frôle la guerre nucléaire." },
  { id: 'algerie-independence-1962', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '1962', year: 1962.55, title: "Indépendance de l'Algérie", detail: "Accords d'Évian puis référendum d'indépendance." },
  { id: 'kennedy-1963', group: "L'après-guerre et la Guerre froide", date: '22 novembre 1963', year: 1963.89, title: "Assassinat de Kennedy", detail: "Le président américain est assassiné à Dallas." },
  { id: 'vietnam-1964', group: "L'après-guerre et la Guerre froide", date: '1964-1975', year: 1964, startYear: 1964, endYear: 1975, title: "Guerre du Vietnam", detail: "Conflit majeur de la guerre froide en Asie." },
  { id: 'barbie-1987', group: "L'après-guerre et la Guerre froide", date: '1987', year: 1987, title: "Procès de Klaus Barbie", detail: "Ancien responsable nazi jugé en France." },
  { id: 'berlin-wall-1989', group: "L'après-guerre et la Guerre froide", date: '9 novembre 1989', year: 1989.85, title: "Chute du mur de Berlin", detail: "Symbole de la fin de la guerre froide." },
  { id: 'urss-1991', group: "L'après-guerre et la Guerre froide", date: '1991', year: 1991, title: "Éclatement de l'URSS", detail: "Fin de la guerre froide." },
  { id: 'gulf-1991', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '1991', year: 1991.1, title: "Guerre du Golfe", detail: "Coalition internationale contre l'Irak après l'invasion du Koweït." },
  { id: 'maastricht-1992', group: 'La construction européenne', date: '1992', year: 1992, title: "Traité de Maastricht", detail: "Création de l'Union européenne." },
  { id: 'rwanda-1994', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '1994', year: 1994, title: "Génocide au Rwanda", detail: "Massacre des Tutsi et des opposants hutu." },
  { id: 'september-11-2001', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '11 septembre 2001', year: 2001.7, title: "Attentats du 11 septembre", detail: "Attaques terroristes aux États-Unis." },
  { id: 'euro-2002', group: 'La construction européenne', date: '1er janvier 2002', year: 2002, title: "Mise en circulation de l'euro", detail: "Les pièces et billets en euros entrent en circulation." },
  { id: 'irak-2003', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '2003', year: 2003, title: "Invasion de l'Irak par les États-Unis", detail: "Nouvelle guerre au Moyen-Orient." },
  { id: 'financial-crisis-2008', group: 'Décolonisation et nouveaux enjeux mondiaux', date: '2008', year: 2008, title: "Crise financière mondiale", detail: "Une crise économique majeure touche le monde." }
];

const shuffle = (items) => [...items].sort(() => Math.random() - 0.5);

const DNB_HISTORY_PEOPLE = [
  {
    id: 'de-gaulle',
    name: 'Charles de Gaulle',
    role: "Appel du 18 juin, France libre, Ve République",
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/De%20Gaulle-OWI%20%28cropped%29-%28d%29.jpg'
  },
  {
    id: 'petain',
    name: 'Philippe Pétain',
    role: 'Régime de Vichy, collaboration',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Philippe%20P%C3%A9tain%201941%20Portrait%20photograph%20%283x4%20cropped%29.jpg'
  },
  {
    id: 'hitler',
    name: 'Adolf Hitler',
    role: 'Dictateur nazi, Allemagne totalitaire',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/Adolf%20Hitler%201938%20Portrait%20%283x4%20cropped%29.jpg'
  },
  {
    id: 'stalin',
    name: 'Joseph Staline',
    role: 'Dictateur soviétique, URSS totalitaire',
    image: 'https://commons.wikimedia.org/wiki/Special:FilePath/StalinCropped1943.jpg'
  }
];

const DNB_GEO_METROPOLES = [
  { id: 'lille', name: 'Lille', x: 58.3, y: 10.2, label: 'right', labelDx: 3.8, labelDy: -1.2 },
  { id: 'paris', name: 'Paris', x: 53.4, y: 23.3, label: 'right', labelDx: 3.8, labelDy: -1.1 },
  { id: 'strasbourg', name: 'Strasbourg', x: 86.4, y: 24.8, label: 'left', labelDx: -4.2, labelDy: -1.1 },
  { id: 'nantes', name: 'Nantes', x: 27.9, y: 34.1, label: 'right', labelDx: 3.8, labelDy: -1.1 },
  { id: 'bordeaux', name: 'Bordeaux', x: 32.3, y: 51.6, label: 'right', labelDx: 3.8, labelDy: -1.1 },
  { id: 'toulouse', name: 'Toulouse', x: 45.9, y: 62.4, label: 'left', labelDx: -3.8, labelDy: -1.1 },
  { id: 'montpellier', name: 'Montpellier', x: 60.9, y: 63.2, label: 'left', labelDx: -4.2, labelDy: -1.1 },
  { id: 'marseille', name: 'Marseille', x: 73, y: 65.3, label: 'left', labelDx: -4.2, labelDy: -1.1 },
  { id: 'nice', name: 'Nice', x: 85.4, y: 61.6, label: 'left', labelDx: -4.2, labelDy: -1.1 },
  { id: 'lyon', name: 'Lyon', x: 68.8, y: 46.3, label: 'left', labelDx: -4.2, labelDy: -1.1 },
  { id: 'grenoble', name: 'Grenoble', x: 75.4, y: 50.9, label: 'left', labelDx: -4.2, labelDy: 1.8 },
  { id: 'rennes', name: 'Rennes', x: 28.3, y: 27.6, label: 'right', labelDx: 3.8, labelDy: -1.1 }
];

const DNB_GEO_WHITE_MASKS = [
  { id: 'mask-1784739876249', x: 10.8, y: 24.1, size: 2.1 },
  { id: 'mask-1784739906098', x: 45.3, y: 19.1, size: 2.1 }
];

const DNB_GEO_METROPOLES_MAP_URL = '/dnb-metropoles-france.png';
const DNB_GEO_TERRITORY_MAP_URL = '/dnb-territoire-france.png';
const DNB_GEO_REPARTITION_MAP_URL = '/dnb-repartition-france.jpg';
const DNB_GEO_REPARTITION_DRAFT_URL = '/dnb-repartition-draft.json';
const DNB_GEO_REPARTITION_DRAFT_KEY = 'condaweb-dnb-repartition-france-drawing-v1';
const DNB_GEO_ESPACESP_MAP_URL = '/dnb-espacesp-france.png';
const DNB_GEO_ESPACESP_DRAFT_URL = '/dnb-espacesp-draft.json';
const DNB_GEO_ESPACESP_DRAFT_KEY = 'condaweb-dnb-espacesp-france-drawing-v8';
const DNB_GEO_DROMCOM_MAP_URL = '/dnb-dromcom-france.png';
const DNB_GEO_DROMCOM_DRAFT_URL = '/dnb-dromcom-draft.json';
const DNB_GEO_DROMCOM_DRAFT_KEY = 'condaweb-dnb-dromcom-labels-v1';
const DNB_GEO_UE_MAP_URL = '/dnb-ue-france.png';
const DNB_GEO_UE_DRAFT_URL = '/dnb-ue-draft.json';
const DNB_GEO_UE_DRAFT_KEY = 'condaweb-dnb-ue-markers-v1';
const DNB_GEO_REGIONS_MAP_URL = '/dnb-regions-france.png';
const DNB_GEO_REGIONS_DRAFT_URL = '/dnb-regions-draft.json';
const DNB_GEO_REGIONS_DRAFT_KEY = 'condaweb-dnb-regions-markers-v3';
const DNB_GEO_ORG_UE_MAP_URL = '/dnb-orgue-france.png';
const DNB_GEO_ORG_UE_DRAFT_URL = '/dnb-orgue-draft.json';
const DNB_GEO_ORG_UE_DRAFT_KEY = 'condaweb-dnb-orgue-drawing-v12';
const DNB_ORG_UE_CITY_POSITIONS = [
  ['Dublin',20.47,21.43],['Londres',29.79,29.19],['Paris',31.88,40.27],['Madrid',17.9,66.68],
  ['Barcelone',27.36,63.2],['Rome',46.75,63.29],['Berlin',49.39,30.32],['Varsovie',60.71,29.88]
].map(([name,x,y]) => ({ name,x,y }));
const inferOrgUeCity = (x, y) => DNB_ORG_UE_CITY_POSITIONS.reduce((best, city) => {
  const distance = Math.hypot(city.x - x, city.y - y);
  return !best || distance < best.distance ? { ...city, distance } : best;
}, null)?.name || '';
const DNB_ORG_UE_INSTITUTION_POSITIONS = [
  ['Bruxelles',36.24,34.27],['Luxembourg',38.06,38.22],['Francfort',40.24,37.01],['Strasbourg',39.32,42.06]
].map(([name,x,y]) => ({ name,x,y }));
const inferOrgUeInstitution = (x, y) => DNB_ORG_UE_INSTITUTION_POSITIONS.reduce((best, city) => {
  const distance = Math.hypot(city.x - x, city.y - y);
  return !best || distance < best.distance ? { ...city, distance } : best;
}, null)?.name || '';
const DNB_REGIONS_POSITIONS = [
  ['Hauts-de-France',54.2,15.5],['Normandie',40.7,24.5],['Grand Est',75.9,26.1],
  ['Bretagne',17.6,31.8],['Pays de la Loire',31.6,40.8],['Centre-Val de Loire',49.7,39.6],
  ['Île-de-France',54.2,26.1],['Bourgogne-Franche-Comté',71.4,40.8],
  ['Auvergne-Rhône-Alpes',68.7,57.1],['Nouvelle-Aquitaine',40.7,58.7],
  ['Occitanie',51.5,73.4],['Provence-Alpes-Côte d’Azur',79.6,69.3],['Corse',87.7,84.8]
].map(([name,x,y]) => ({ name,x,y }));
const inferRegionName = (x, y) => DNB_REGIONS_POSITIONS.reduce((best, region) => {
  const distance = Math.hypot(region.x - x, region.y - y);
  return !best || distance < best.distance ? { ...region, distance } : best;
}, null)?.name || '';
const DNB_UE_COUNTRY_POSITIONS = [
  ['France',29,47],['Allemagne',48.5,37],['Espagne',13,71],['Italie',44,74],['Belgique',34.8,40],['Pays-Bas',36.5,35],['Luxembourg',37.2,45],['Pologne',61,40],['Roumanie',70,67],['Grèce',68,87],['Irlande',19,26],['Portugal',2.5,71]
].map(([name,x,y]) => ({ name,x,y }));
const inferUeCountry = (x, y) => DNB_UE_COUNTRY_POSITIONS.reduce((best, country) => {
  const distance = Math.hypot(country.x - x, country.y - y);
  return !best || distance < best.distance ? { ...country, distance } : best;
}, null)?.name || '';
const DNB_DROMCOM_EXPECTED_POSITIONS = [
  { name: 'Polynésie française', x: 10, y: 11 },
  { name: 'Saint-Pierre-et-Miquelon', x: 33, y: 13 },
  { name: 'Wallis-et-Futuna', x: 77, y: 10 },
  { name: 'Saint-Barthélemy', x: 13, y: 26 },
  { name: 'Saint-Martin', x: 17, y: 31 },
  { name: 'Guadeloupe', x: 35, y: 25 },
  { name: 'Martinique', x: 35, y: 33 },
  { name: 'Guyane', x: 27, y: 40 },
  { name: 'Mayotte', x: 58, y: 42 },
  { name: 'La Réunion', x: 70, y: 48 },
  { name: 'La Réunion', x: 15, y: 69 },
  { name: 'Polynésie française', x: 15, y: 76 },
  { name: 'Guyane', x: 12, y: 96 },
  { name: 'Martinique', x: 31, y: 96 },
  { name: 'Guadeloupe', x: 50, y: 96 },
  { name: 'La Réunion', x: 69, y: 96 },
  { name: 'Mayotte', x: 89, y: 96 }
];
const inferDromComName = (x, y) => DNB_DROMCOM_EXPECTED_POSITIONS.reduce((closest, candidate) => {
  const distance = Math.hypot(candidate.x - x, candidate.y - y);
  return !closest || distance < closest.distance ? { ...candidate, distance } : closest;
}, null)?.name || '';
const DNB_DROMCOM_CATEGORIES = {
  Guadeloupe: 'drom',
  Martinique: 'drom',
  Guyane: 'drom',
  'La Réunion': 'drom',
  Mayotte: 'drom',
  'Polynésie française': 'com',
  'Saint-Barthélemy': 'com',
  'Saint-Martin': 'com',
  'Saint-Pierre-et-Miquelon': 'com',
  'Wallis-et-Futuna': 'com'
};
const DNB_GEO_TERRITORY_DRAFT_URL = '/dnb-territoire-draft.json';
const DNB_GEO_TERRITORY_DRAFT_KEY = 'condaweb-dnb-territory-model-v2';
const EMPTY_REPARTITION_LEGEND_TITLES = { distribution: '', dynamics: '' };
const lightenRepartitionBlue = (paths = []) => paths.map((path) => (
  path?.color === '#2563eb' ? { ...path, color: '#38bdf8' } : path
));

const normalizeAnswer = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z]/g, '');

function DnbHistoryReperesWorkspace({ onBack }) {
  const [mode, setMode] = useState('revision');

  return (
    <div className="mx-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-[11px] font-black uppercase text-red-400">Repères DNB · Histoire</div>
          <div className="text-2xl font-black text-slate-900">Frises chronologiques</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('revision')}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${mode === 'revision' ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
          >
            Voir les repères
          </button>
          <button
            type="button"
            onClick={() => setMode('game')}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${mode === 'game' ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
          >
            Jouer au jeu
          </button>
          <button
            type="button"
            onClick={() => setMode('people')}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${mode === 'people' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
          >
            Personnages
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600"
          >
            ← Retour
          </button>
          {mode === 'revision' && <button type="button" onClick={() => setMode('game')} className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-black text-white shadow-sm">Entraînement</button>}
        </div>
      </div>
      {mode === 'revision' && <DnbHistoryReperesRevision />}
      {mode === 'game' && (
        <>
          <DnbHistoryTimelineGame />
          <DnbHistoryPeopleGame compact />
        </>
      )}
      {mode === 'people' && <DnbHistoryPeopleGame />}
    </div>
  );
}

function DnbHistoryReperesRevision() {
  const periods = [
    { title: "L'Europe, théâtre majeur des guerres mondiales et des régimes totalitaires", groups: ['La Première Guerre mondiale', 'Les régimes totalitaires', 'La Seconde Guerre mondiale'] },
    { title: 'Le monde depuis 1945', groups: ["L'après-guerre et la Guerre froide", 'Décolonisation et nouveaux enjeux mondiaux', 'La construction européenne'] }
  ];

  return (
    <div className="flex flex-col gap-4">
      {periods.map((period) => {
        return (
          <section key={period.title} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-xl font-black text-slate-900">{period.title}</div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {period.groups.map((group) => {
                const items = DNB_HISTORY_REPERES.filter((item) => item.group === group).sort((a, b) => a.year - b.year);
                return (
                  <div key={group} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-base font-black text-red-600">{group}</div>
                    <div className="mt-3 flex flex-col gap-3">
                      {items.map((item) => (
                        <div key={item.id} className="rounded-2xl bg-white p-4">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="rounded-xl bg-red-100 px-3 py-1 text-sm font-black text-red-600">{item.date}</span>
                            <span className="text-base font-black text-slate-900">{item.title}</span>
                          </div>
                          <div className="mt-2 text-sm font-bold text-slate-500">{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function DnbHistoryTimelineGame() {
  const buildRound = () => shuffle(DNB_HISTORY_REPERES.filter((item) => item.year >= 1900 && item.year <= 2010))
    .slice(0, 8)
    .sort((a, b) => a.year - b.year);
  const minYear = 1900;
  const maxYear = 2010;
  const axisTop = 210;
  const timelineRef = useRef(null);
  const [roundItems, setRoundItems] = useState(buildRound);
  const [cardOrder, setCardOrder] = useState(() => shuffle(roundItems).map((item) => item.id));
  const [placed, setPlaced] = useState({});
  const [selectedId, setSelectedId] = useState('');
  const [activeDragId, setActiveDragId] = useState('');
  const [dragPreview, setDragPreview] = useState(null);
  const [checked, setChecked] = useState(false);

  const cardsById = useMemo(() => new Map(roundItems.map((item) => [item.id, item])), [roundItems]);
  const cards = cardOrder.map((id) => cardsById.get(id)).filter(Boolean);
  const isPeriod = (item) => Number.isFinite(Number(item?.startYear)) && Number.isFinite(Number(item?.endYear));
  const correctCount = roundItems.filter((item) => {
    const position = placed[item.id];
    if (!position) return false;
    if (isPeriod(item)) return Math.abs((position.startYear || 0) - item.startYear) <= 1 && Math.abs((position.endYear || 0) - item.endYear) <= 1;
    return Math.abs((position.year || 0) - item.year) <= 1;
  }).length;
  const remaining = cards.filter((item) => !placed[item.id]);
  const yearToPercent = (year) => Math.max(0, Math.min(100, ((year - minYear) / (maxYear - minYear)) * 100));
  const percentToYear = (percent) => Math.round(minYear + (Math.max(0, Math.min(100, percent)) / 100) * (maxYear - minYear));
  const decadeTicks = Array.from({ length: 12 }, (_, index) => minYear + index * 10);

  const getTimelinePositionFromPointer = (clientX, clientY) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const percent = (clampedX / rect.width) * 100;
    const year = percentToYear(percent);
    const isTop = clientY - rect.top < axisTop;
    return {
      year,
      percent: yearToPercent(year),
      side: isTop ? 'top' : 'bottom'
    };
  };

  const updateDragPreview = (cardId, clientX, clientY) => {
    if (!cardId) return;
    const position = getTimelinePositionFromPointer(clientX, clientY);
    if (!position) return;
    setDragPreview({ cardId, ...position });
  };

  const placeCardAt = (cardId, clientX, clientY) => {
    if (!cardId) return;
    const position = getTimelinePositionFromPointer(clientX, clientY);
    if (!position) return;
    const card = cardsById.get(cardId);
    setPlaced((prev) => {
      const nextIndex = Object.keys(prev).length;
      if (isPeriod(card)) {
        const defaultSpan = Math.max(2, Math.min(8, Math.round((card.endYear || card.year + 4) - (card.startYear || card.year))));
        const startYear = Math.max(minYear, position.year);
        const endYear = Math.min(maxYear, startYear + defaultSpan);
        return {
          ...prev,
          [cardId]: {
            startYear,
            endYear,
            percent: yearToPercent(startYear),
            endPercent: yearToPercent(endYear),
            side: position.side,
            lane: nextIndex % 2
          }
        };
      }
      return {
        ...prev,
        [cardId]: {
          ...position,
          lane: nextIndex % 2
        }
      };
    });
    setDragPreview(null);
    setSelectedId('');
    setActiveDragId('');
    setChecked(false);
  };

  const resizePeriodAt = (cardId, edge, clientX) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    const current = placed[cardId];
    if (!rect || !current) return;
    const clampedX = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const year = percentToYear((clampedX / rect.width) * 100);
    setPlaced((prev) => {
      const previous = prev[cardId];
      if (!previous) return prev;
      const next = { ...previous };
      if (edge === 'start') {
        next.startYear = Math.min(year, previous.endYear - 1);
      } else {
        next.endYear = Math.max(year, previous.startYear + 1);
      }
      next.percent = yearToPercent(next.startYear);
      next.endPercent = yearToPercent(next.endYear);
      return { ...prev, [cardId]: next };
    });
    setChecked(false);
  };

  const removePlacedCard = (cardId) => {
    setPlaced((prev) => {
      const next = { ...prev };
      delete next[cardId];
      return next;
    });
    setChecked(false);
  };

  const newRound = () => {
    const nextRound = buildRound();
    setRoundItems(nextRound);
    setCardOrder(shuffle(nextRound).map((item) => item.id));
    setPlaced({});
    setSelectedId('');
    setActiveDragId('');
    setDragPreview(null);
    setChecked(false);
  };

  return (
    <section className="rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-violet-500">Entraînement</div>
          <div className="text-2xl font-black text-slate-900">Place les événements sur la frise</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setChecked(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white">
            Vérifier
          </button>
          <button type="button" onClick={newRound} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">
            Nouvelle frise
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm font-black text-violet-700">
        {checked ? `${correctCount}/${roundItems.length} repères bien placés.` : "Les dates ne sont pas données : place chaque événement au bon endroit sur la frise."}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {remaining.map((item) => (
          <button
            key={item.id}
            type="button"
            draggable
            onDragStart={(event) => {
              setActiveDragId(item.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', item.id);
            }}
            onDragEnd={() => {
              setActiveDragId('');
              setDragPreview(null);
            }}
            onClick={() => setSelectedId(item.id)}
            className={`rounded-2xl border px-4 py-3 text-left text-sm font-black shadow-sm transition ${selectedId === item.id ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-violet-200'}`}
          >
            <span>{item.title}</span>
            <span className="mt-1 block text-[10px] font-black opacity-60">{item.group}</span>
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto pb-2">
        <div className="min-w-[1120px] rounded-3xl border border-slate-200 bg-slate-50 p-6">
          <div
            ref={timelineRef}
            className="relative h-[500px]"
            onDragOver={(event) => {
              event.preventDefault();
              const cardId = activeDragId || event.dataTransfer.getData('text/plain');
              updateDragPreview(cardId, event.clientX, event.clientY);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setDragPreview(null);
            }}
            onDrop={(event) => {
              const cardId = activeDragId || event.dataTransfer.getData('text/plain');
              const kind = event.dataTransfer.getData('application/x-conda-kind');
              if (kind === 'period-start') resizePeriodAt(cardId, 'start', event.clientX);
              else if (kind === 'period-end') resizePeriodAt(cardId, 'end', event.clientX);
              else placeCardAt(cardId, event.clientX, event.clientY);
            }}
            onMouseMove={(event) => selectedId ? updateDragPreview(selectedId, event.clientX, event.clientY) : null}
            onClick={(event) => selectedId ? placeCardAt(selectedId, event.clientX, event.clientY) : null}
          >
            <div className="absolute left-0 right-0 h-1 bg-slate-900" style={{ top: axisTop }} />
            <div
              className="absolute right-[-58px] h-0 w-0 border-y-[32px] border-l-[58px] border-y-transparent border-l-slate-900"
              style={{ top: axisTop - 30 }}
              aria-hidden="true"
            />
            {decadeTicks.map((year) => {
              const left = `${yearToPercent(year)}%`;
              return (
                <div key={year} className="absolute" style={{ left, top: axisTop - 43 }}>
                  <div className="h-[86px] w-[2px] bg-slate-900" />
                  <div className="mt-2 -translate-x-1/2 text-sm font-black text-slate-700">{year}</div>
                </div>
              );
            })}
            {Array.from({ length: 111 }, (_, index) => minYear + index).map((year) => {
              const isDecade = year % 10 === 0;
              const left = `${yearToPercent(year)}%`;
              return (
                <div
                  key={year}
                  className={`absolute bg-slate-500 ${isDecade ? 'h-9 w-[2px]' : 'h-5 w-px'}`}
                  style={{ left, top: axisTop - (isDecade ? 49 : 38) }}
                  aria-hidden="true"
                />
              );
            })}
            {dragPreview && (() => {
              const previewTop = dragPreview.side === 'top' ? 64 : 330;
              const previewCardHeight = 74;
              const lineTop = dragPreview.side === 'top' ? previewTop + previewCardHeight : axisTop + 4;
              const lineHeight = dragPreview.side === 'top'
                ? Math.max(10, axisTop - (previewTop + previewCardHeight))
                : Math.max(10, previewTop - axisTop);
              return (
                <div
                  className="pointer-events-none absolute z-20 w-[150px] -translate-x-1/2"
                  style={{ left: `${dragPreview.percent}%`, top: previewTop }}
                >
                  <div className="rounded-2xl border-2 border-violet-500 bg-violet-50/90 p-3 text-center text-xs font-black text-violet-700 shadow-lg">
                    {cardsById.get(dragPreview.cardId)?.title || 'Placement'}
                    <div className="mt-1 text-[11px] text-violet-500">vers {dragPreview.year}</div>
                  </div>
                  <div
                    className="absolute left-1/2 w-[3px] -translate-x-1/2 bg-violet-600"
                    style={{ top: lineTop - previewTop, height: lineHeight }}
                    aria-hidden="true"
                  />
                </div>
              );
            })()}
            {Object.entries(placed).map(([cardId, position]) => {
              const card = cardsById.get(cardId);
              if (!card) return null;
              const periodCard = isPeriod(card);
              const isCorrect = checked && (periodCard
                ? Math.abs((position.startYear || 0) - card.startYear) <= 1 && Math.abs((position.endYear || 0) - card.endYear) <= 1
                : Math.abs(position.year - card.year) <= 1);
              const isWrong = checked && !isCorrect;
              const isTop = position.side === 'top';
              const cardTop = isTop ? 24 + position.lane * 18 : 300 + position.lane * 18;
              const cardHeight = 104;
              const lineTop = isTop ? cardTop + cardHeight : axisTop + 4;
              const lineHeight = isTop ? Math.max(10, axisTop - (cardTop + cardHeight)) : Math.max(10, cardTop - axisTop);
              if (periodCard) {
                const left = Math.min(position.percent, position.endPercent);
                const width = Math.max(7, Math.abs(position.endPercent - position.percent));
                return (
                  <div
                    key={cardId}
                    className="absolute"
                    style={{ left: `${left}%`, top: cardTop, width: `${width}%` }}
                  >
                    <div className={`relative min-h-[96px] rounded-2xl border p-3 text-center shadow-sm transition ${isCorrect ? 'border-emerald-400 bg-emerald-50' : isWrong ? 'border-red-300 bg-red-50' : 'border-violet-200 bg-white'}`}>
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          setActiveDragId(cardId);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('application/x-conda-kind', 'period-start');
                          event.dataTransfer.setData('text/plain', cardId);
                        }}
                        className="absolute left-[-8px] top-0 h-full w-4 cursor-ew-resize rounded-full bg-violet-500"
                        title="Déplacer le début"
                      />
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          setActiveDragId(cardId);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('application/x-conda-kind', 'period-end');
                          event.dataTransfer.setData('text/plain', cardId);
                        }}
                        className="absolute right-[-8px] top-0 h-full w-4 cursor-ew-resize rounded-full bg-violet-500"
                        title="Déplacer la fin"
                      />
                      <button
                        type="button"
                        draggable
                        onDragStart={(event) => {
                          setActiveDragId(cardId);
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', cardId);
                        }}
                        onClick={(event) => {
                          event.stopPropagation();
                          removePlacedCard(cardId);
                        }}
                        className="w-full text-xs font-black text-slate-800"
                      >
                        {card.title}
                      </button>
                      <div className="mt-2 text-[10px] font-black text-slate-400">
                        {position.startYear} → {position.endYear}
                      </div>
                      {isCorrect && <div className="mt-2 text-xs font-black text-emerald-600">Bravo</div>}
                      {isWrong && <div className="mt-2 text-xs font-black text-red-500">À ajuster</div>}
                    </div>
                    <div
                      className="absolute w-[2px] bg-violet-500"
                      style={{ left: 0, top: lineTop - cardTop, height: lineHeight }}
                      aria-hidden="true"
                    />
                    <div
                      className="absolute w-[2px] bg-violet-500"
                      style={{ right: 0, top: lineTop - cardTop, height: lineHeight }}
                      aria-hidden="true"
                    />
                    {checked && (
                      <div className="mt-2 rounded-xl bg-white px-2 py-1 text-center text-[10px] font-black text-slate-500 shadow-sm">
                        Attendu : {card.date}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div
                  key={cardId}
                  className="absolute w-[168px] -translate-x-1/2"
                  style={{ left: `${position.percent}%`, top: cardTop }}
                >
                  <button
                    type="button"
                    draggable
                    onDragStart={(event) => {
                      setActiveDragId(cardId);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', cardId);
                    }}
                    onDragEnd={() => {
                      setActiveDragId('');
                      setDragPreview(null);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      removePlacedCard(cardId);
                    }}
                    className={`min-h-[104px] w-full rounded-2xl border p-3 text-center shadow-sm transition ${isCorrect ? 'border-emerald-400 bg-emerald-50' : isWrong ? 'border-red-300 bg-red-50' : 'border-violet-200 bg-white hover:border-red-200'}`}
                  >
                    <div className="text-xs font-black text-slate-800">{card.title}</div>
                    <div className="mt-2 text-[10px] font-black text-slate-400">clic = retirer</div>
                    {isCorrect && <div className="mt-2 text-xs font-black text-emerald-600">Bravo</div>}
                    {isWrong && <div className="mt-2 text-xs font-black text-red-500">À replacer</div>}
                  </button>
                  <div
                    className="absolute left-1/2 w-[2px] -translate-x-1/2 bg-violet-500"
                    style={{ top: lineTop - cardTop, height: lineHeight }}
                    aria-hidden="true"
                  />
                  {checked && (
                    <div className="mt-2 rounded-xl bg-white px-2 py-1 text-center text-[10px] font-black text-slate-500 shadow-sm">
                      Placé : {position.year} · attendu : {card.date}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function DnbHistoryPeopleGame({ compact = false }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const names = useMemo(() => shuffle(DNB_HISTORY_PEOPLE.map((person) => person.name)), []);
  const correctCount = DNB_HISTORY_PEOPLE.filter((person) => answers[person.id] === person.name).length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-slate-500">Personnages du brevet</div>
          <div className="text-2xl font-black text-slate-900">{compact ? 'Partie 2 · Reconnais les personnages' : 'Reconnais les personnages'}</div>
        </div>
        <button type="button" onClick={() => setChecked(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white">
          Vérifier
        </button>
      </div>
      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-black text-slate-600">
        {checked ? `${correctCount}/${DNB_HISTORY_PEOPLE.length} personnages reconnus.` : "Associe chaque portrait au bon nom."}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {DNB_HISTORY_PEOPLE.map((person) => {
          const isCorrect = checked && answers[person.id] === person.name;
          const isWrong = checked && answers[person.id] && answers[person.id] !== person.name;
          return (
            <article key={person.id} className={`rounded-3xl border p-4 ${isCorrect ? 'border-emerald-300 bg-emerald-50' : isWrong ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white'}`}>
              <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-slate-100">
                <img src={person.image} alt="Portrait historique à identifier" className="h-full w-full object-cover grayscale" loading="lazy" />
              </div>
              <select
                value={answers[person.id] || ''}
                onChange={(event) => {
                  setAnswers((prev) => ({ ...prev, [person.id]: event.target.value }));
                  setChecked(false);
                }}
                className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-black text-slate-800"
              >
                <option value="">Choisir le nom...</option>
                {names.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
              {checked && (
                <div className={`mt-3 rounded-2xl p-3 text-xs font-black ${isCorrect ? 'bg-white text-emerald-700' : 'bg-white text-red-600'}`}>
                  {isCorrect ? person.role : `Réponse : ${person.name}`}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DnbGeoReperesWorkspace({ onBack }) {
  const marathonGames = [
    ['metropoles', 'Métropoles'], ['territoire', 'Territoire'], ['repartition', 'Répartition'],
    ['espacesProductifs', 'Espaces productifs'], ['dromCom', 'DROM-COM'], ['ue', 'Union européenne'],
    ['regions', 'Régions'], ['orgUe', 'Organisation UE'], ['aireUrbaine', 'Aire urbaine']
  ];
  const [mode, setMode] = useState('revision');
  const [geoGame, setGeoGame] = useState('metropoles');
  const [marathonIndex, setMarathonIndex] = useState(-1);
  const marathonActive = marathonIndex >= 0;
  const selectGeoGame = (game) => {
    setMarathonIndex(-1);
    setGeoGame(game);
    setMode('revision');
  };
  const startMarathon = () => {
    setMarathonIndex(0);
    setGeoGame(marathonGames[0][0]);
    setMode('game');
  };
  const moveMarathon = (offset) => {
    const nextIndex = marathonIndex + offset;
    if (nextIndex < 0) return;
    if (nextIndex >= marathonGames.length) {
      setMarathonIndex(-1);
      setMode('revision');
      return;
    }
    setMarathonIndex(nextIndex);
    setGeoGame(marathonGames[nextIndex][0]);
    setMode('game');
  };
  const isMetropoles = geoGame === 'metropoles';
  const isTerritoire = geoGame === 'territoire';
  const isRepartition = geoGame === 'repartition';
  const isEspacesProductifs = geoGame === 'espacesProductifs';
  const isDromCom = geoGame === 'dromCom';
  const isUe = geoGame === 'ue';
  const isRegions = geoGame === 'regions';
  const isOrgUe = geoGame === 'orgUe';

  return (
    <div className="mx-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Repères DNB · Géographie</div>
          <div className="text-2xl font-black text-slate-900">{isMetropoles ? 'Métropoles françaises' : isTerritoire ? 'Territoire français' : isRepartition ? 'Répartition de la population française' : isEspacesProductifs ? 'Espaces productifs français' : isDromCom ? 'DROM-COM' : isUe ? 'Union européenne' : isRegions ? 'Régions françaises' : isOrgUe ? 'Organisation du territoire de l’UE' : 'Aire urbaine'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              selectGeoGame('metropoles');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isMetropoles ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Métropoles
          </button>
          <button
            type="button"
            onClick={() => {
              selectGeoGame('territoire');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isTerritoire ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Territoire
          </button>
          <button
            type="button"
            onClick={() => {
              selectGeoGame('repartition');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isRepartition ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Répartition
          </button>
          <button
            type="button"
            onClick={() => {
              selectGeoGame('espacesProductifs');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isEspacesProductifs ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Espaces productifs
          </button>
          <button
            type="button"
            onClick={() => {
              selectGeoGame('dromCom');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isDromCom ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            DROM-COM
          </button>
          <button type="button" onClick={() => selectGeoGame('ue')} className={`rounded-2xl border px-4 py-3 text-xs font-black ${isUe ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Union européenne</button>
          <button type="button" onClick={() => selectGeoGame('regions')} className={`rounded-2xl border px-4 py-3 text-xs font-black ${isRegions ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Régions</button>
          <button type="button" onClick={() => selectGeoGame('orgUe')} className={`rounded-2xl border px-4 py-3 text-xs font-black ${isOrgUe ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Organisation UE</button>
          <button
            type="button"
            onClick={() => {
              selectGeoGame('aireUrbaine');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${geoGame === 'aireUrbaine' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Aire urbaine
          </button>
          <button
            type="button"
            onClick={startMarathon}
            className={`rounded-2xl border px-5 py-3 text-sm font-black ${marathonActive ? 'border-violet-600 bg-violet-600 text-white' : 'border-violet-300 bg-violet-50 text-violet-700'}`}
          >
            🏃 Marathon
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600"
          >
            ← Retour
          </button>
        </div>
      </div>
      {marathonActive ? <div className="flex flex-wrap items-center gap-3 rounded-3xl border-2 border-violet-300 bg-violet-50 p-4">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-black uppercase text-violet-600">Marathon géographie · {marathonIndex + 1}/{marathonGames.length}</div>
          <div className="mt-1 text-xl font-black text-slate-900">{marathonGames[marathonIndex]?.[1]}</div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${((marathonIndex + 1) / marathonGames.length) * 100}%` }} /></div>
        </div>
        {marathonIndex > 0 && <button type="button" onClick={() => moveMarathon(-1)} className="rounded-xl bg-white px-4 py-3 text-xs font-black text-violet-700">← Précédente</button>}
        <button type="button" onClick={() => moveMarathon(1)} className="rounded-xl bg-violet-600 px-5 py-3 text-xs font-black text-white">{marathonIndex === marathonGames.length - 1 ? 'Terminer le marathon ✓' : 'Carte suivante →'}</button>
      </div> : null}
      {geoGame === 'metropoles'
        ? (mode === 'revision' ? <DnbGeoMetropolesRevision /> : <DnbGeoMetropolesGame />)
          : geoGame === 'territoire'
          ? <DnbGeoTerritoryDrawingGame revisionMode={mode === 'revision' && !marathonActive} />
          : geoGame === 'repartition'
            ? <DnbGeoRepartitionColoringGame key={`repartition-${mode}`} revisionMode={mode === 'revision' && !marathonActive} />
          : geoGame === 'espacesProductifs'
            ? <DnbGeoRepartitionColoringGame
                key={`espaces-productifs-v8-${mode}`}
                mapUrl={DNB_GEO_ESPACESP_MAP_URL}
                draftUrl={DNB_GEO_ESPACESP_DRAFT_URL}
                draftKey={DNB_GEO_ESPACESP_DRAFT_KEY}
                heading="Construis la carte des espaces productifs"
                mapAlt="Carte muette des espaces productifs français"
                showCentralLabel={false}
                showDensityInputs={false}
                pencils={DNB_ESPACESP_PENCILS}
                repeatBlankPanel
                compactStrokeWidths
                uniformColors
                mapSections={DNB_ESPACESP_MAP_SECTIONS}
                allowPoints
                allowSquares
                allowBackgroundFill
                revisionMode={mode === 'revision' && !marathonActive}
                revisionLegendBelow
              />
          : geoGame === 'dromCom'
            ? <DnbDromComLabelGame revisionMode={mode === 'revision' && !marathonActive} />
          : geoGame === 'ue'
            ? <DnbUeNumberGame revisionMode={mode === 'revision' && !marathonActive} />
          : geoGame === 'regions'
            ? <DnbRegionsPointGame revisionMode={mode === 'revision' && !marathonActive} />
          : geoGame === 'orgUe'
            ? <DnbGeoRepartitionColoringGame
                key="organisation-ue-v1"
                mapUrl={DNB_GEO_ORG_UE_MAP_URL}
                draftUrl={DNB_GEO_ORG_UE_DRAFT_URL}
                draftKey={DNB_GEO_ORG_UE_DRAFT_KEY}
                heading="Construis la carte de l’organisation du territoire de l’Union européenne"
                mapAlt="Carte muette de l’organisation du territoire de l’Union européenne"
                showCentralLabel={false}
                showDensityInputs={false}
                pencils={DNB_ORG_UE_PENCILS}
                compactStrokeWidths
                uniformColors
                allowPoints
                allowSquares
                allowBackgroundFill
                allowStars
                allowDashedLines
                forceRedPoints
                hideEraser
                smallRoundPoints
                allowStraightAxes
                allowPointLabels
                stagedWorkflow
                revisionMode={mode === 'revision' && !marathonActive}
                revisionLegendBelow
              />
          : <DnbUrbanAreaSchemaGame revisionMode={mode === 'revision' && !marathonActive} />}
    </div>
  );
}

function DnbGeoMetropolesRevision() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xl font-black text-slate-900">Carte complète des métropoles françaises</div>
      <div className="relative mx-auto mt-4 max-w-[760px] overflow-hidden rounded-2xl border-2 border-emerald-300 bg-white">
        <img src={DNB_GEO_METROPOLES_MAP_URL} alt="Carte complète des métropoles françaises" draggable={false} className="block h-auto w-full select-none" />
        {DNB_GEO_WHITE_MASKS.map((mask) => <span key={mask.id} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.size}%`, aspectRatio: '1 / 1' }} />)}
        {DNB_GEO_METROPOLES.map((city) => (
          <div key={city.id} className="absolute" style={{ left: `${city.x}%`, top: `${city.y}%` }}>
            <span className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600 shadow" />
            <span className={`absolute top-[-14px] whitespace-nowrap rounded-md bg-white/95 px-2 py-1 text-[clamp(8px,1vw,12px)] font-black text-slate-800 shadow ${city.label === 'left' ? 'right-[10px]' : 'left-[10px]'}`}>{city.name}</span>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-4 max-w-[760px] rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-emerald-800">Repère chaque point violet et mémorise le nom placé à côté avant de lancer l’entraînement.</div>
    </section>
  );
}

function DnbGeoMetropolesGame() {
  const mapBoxRef = useRef(null);
  const [activeCityId, setActiveCityId] = useState('');
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const [mapReady, setMapReady] = useState(true);
  const [editPoints, setEditPoints] = useState(false);
  const [editLabels, setEditLabels] = useState(false);
  const [draftPoints, setDraftPoints] = useState(() => DNB_GEO_METROPOLES.map((city) => ({ ...city })));
  const [whiteMasks, setWhiteMasks] = useState(() => DNB_GEO_WHITE_MASKS.map((mask) => ({ ...mask })));
  const [placingMask, setPlacingMask] = useState(false);
  const activeCity = draftPoints.find((city) => city.id === activeCityId);
  const correctCount = draftPoints.filter((city) => normalizeAnswer(answers[city.id]) === normalizeAnswer(city.name)).length;

  const updateAnswer = (cityId, value) => {
    setAnswers((prev) => ({ ...prev, [cityId]: value }));
    setChecked(false);
  };

  const movePoint = (cityId, clientX, clientY) => {
    const rect = mapBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setDraftPoints((prev) => prev.map((city) => city.id === cityId ? { ...city, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : city));
  };

  const moveLabel = (cityId, clientX, clientY) => {
    const rect = mapBoxRef.current?.getBoundingClientRect();
    const city = draftPoints.find((item) => item.id === cityId);
    if (!rect || !city) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setDraftPoints((prev) => prev.map((item) => {
      if (item.id !== cityId) return item;
      return {
        ...item,
        labelDx: Number((x - item.x).toFixed(1)),
        labelDy: Number((y - item.y).toFixed(1)),
        label: x < item.x ? 'left' : 'right'
      };
    }));
  };

  const addCityPoint = () => {
    const name = window.prompt('Nom de la ville à ajouter ?', '');
    const cleanName = String(name || '').trim();
    if (!cleanName) return;
    const baseId = normalizeAnswer(cleanName) || `ville${Date.now()}`;
    let id = baseId;
    let suffix = 2;
    while (draftPoints.some((city) => city.id === id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    setDraftPoints((prev) => [...prev, { id, name: cleanName, x: 50, y: 50, label: 'right' }]);
    setActiveCityId(id);
  };

  const addWhiteMask = (clientX, clientY) => {
    const rect = mapBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setWhiteMasks((prev) => [...prev, { id: `mask-${Date.now()}`, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), size: 2.1 }]);
    setPlacingMask(false);
  };

  const moveWhiteMask = (maskId, clientX, clientY) => {
    const rect = mapBoxRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    setWhiteMasks((prev) => prev.map((mask) => mask.id === maskId ? { ...mask, x: Number(x.toFixed(1)), y: Number(y.toFixed(1)) } : mask));
  };

  const copyPointPositions = async () => {
    const payload = [
      `const DNB_GEO_METROPOLES = ${JSON.stringify(draftPoints, null, 2)};`,
      '',
      `const DNB_GEO_WHITE_MASKS = ${JSON.stringify(whiteMasks, null, 2)};`
    ].join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      window.alert('Positions copiées.');
    } catch (_) {
      window.prompt('Copie les positions :', payload);
    }
  };

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Partie 2 · Géo</div>
          <div className="text-2xl font-black text-slate-900">Clique sur un point et écris la ville</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setEditPoints((prev) => !prev)} className={`rounded-2xl px-4 py-3 text-xs font-black ${editPoints ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
            Placer les points
          </button>
          {editPoints ? (
            <>
              <button type="button" onClick={() => setEditLabels((prev) => !prev)} className={`rounded-2xl px-4 py-3 text-xs font-black ${editLabels ? 'bg-violet-600 text-white' : 'bg-white text-slate-700'}`}>
                Placer les noms
              </button>
              <button type="button" onClick={addCityPoint} className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white">
                + Ville
              </button>
              <button type="button" onClick={() => setPlacingMask(true)} className={`rounded-2xl px-4 py-3 text-xs font-black ${placingMask ? 'bg-white text-slate-900 ring-2 ring-slate-900' : 'bg-white text-slate-700'}`}>
                + Masque blanc
              </button>
              <button type="button" onClick={copyPointPositions} className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">
                Valider positions
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setChecked(true)} className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white">
              Vérifier
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        {editPoints
          ? (editLabels
            ? 'Mode noms : glisse les étiquettes des villes exactement où tu veux les afficher.'
            : placingMask ? 'Clique sur la carte pour poser un cercle blanc sur un point à cacher.' : 'Mode placement : glisse les points sur ceux de la carte, ajoute des masques blancs si besoin, puis valide.')
          : checked ? `${correctCount}/${draftPoints.length} métropoles trouvées.` : 'Les noms ne sont pas affichés : clique un point puis saisis le nom au clavier.'}
      </div>
      <div className="mt-5">
        <div
          ref={mapBoxRef}
          className="relative mx-auto max-w-[760px] overflow-hidden rounded-2xl border-2 border-slate-400 bg-white"
          onDragOver={(event) => editPoints ? event.preventDefault() : null}
          onClick={(event) => {
            if (editPoints && placingMask) {
              addWhiteMask(event.clientX, event.clientY);
              return;
            }
            if (!editPoints) setActiveCityId('');
          }}
          onDrop={(event) => {
            if (!editPoints) return;
            const kind = event.dataTransfer.getData('application/x-conda-kind');
            const id = event.dataTransfer.getData('text/plain');
            if (kind === 'mask') moveWhiteMask(id, event.clientX, event.clientY);
            else if (kind === 'label') moveLabel(id, event.clientX, event.clientY);
            else movePoint(id, event.clientX, event.clientY);
          }}
        >
          <img
            src={DNB_GEO_METROPOLES_MAP_URL}
            alt="Carte muette des aires urbaines françaises"
            className={`${mapReady ? 'block' : 'hidden'} h-auto w-full select-none`}
            draggable={false}
            onError={() => setMapReady(false)}
          />
          {whiteMasks.map((mask) => (
            <button
              key={mask.id}
              type="button"
              draggable={editPoints}
              onDragStart={(event) => {
                if (!editPoints) return;
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('application/x-conda-kind', 'mask');
                event.dataTransfer.setData('text/plain', mask.id);
              }}
              onClick={(event) => {
                if (!editPoints) return;
                event.stopPropagation();
                if (event.altKey) setWhiteMasks((prev) => prev.filter((item) => item.id !== mask.id));
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-white bg-white ${editPoints ? 'cursor-move shadow-sm' : ''}`}
              style={{ left: `${mask.x}%`, top: `${mask.y}%`, width: `${mask.size}%`, aspectRatio: '1 / 1' }}
              title="Masque blanc. Alt+clic pour supprimer."
              aria-label="Masque blanc"
            />
          ))}
          {!mapReady && (
            <div className="flex aspect-[383/487] items-center justify-center bg-slate-50 p-8 text-center text-sm font-black text-slate-400">
              Image de carte attendue : /dnb-metropoles-france.png
            </div>
          )}
            {draftPoints.map((city) => {
              const answer = answers[city.id] || '';
              const isCorrect = checked && normalizeAnswer(answer) === normalizeAnswer(city.name);
              const isWrong = checked && answer && !isCorrect;
              const isActive = activeCityId === city.id;
              const openLeft = city.label === 'left';
              return (
                <div key={city.id} className="absolute" style={{ left: `${city.x}%`, top: `${city.y}%` }}>
                  <button
                    type="button"
                    draggable={editPoints}
                    onDragStart={(event) => {
                      if (!editPoints) return;
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('application/x-conda-kind', 'city');
                      event.dataTransfer.setData('text/plain', city.id);
                    }}
                    onClick={(event) => {
                      event.stopPropagation();
                      setActiveCityId(city.id);
                    }}
                    className={`h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full transition ${editPoints ? 'border-4 border-white bg-violet-600 shadow-xl' : isCorrect ? 'border-4 border-white bg-emerald-500 shadow' : isWrong ? 'border-4 border-white bg-red-500 shadow' : isActive ? 'border-4 border-white bg-violet-600 shadow' : 'bg-transparent hover:bg-violet-400/20'}`}
                    aria-label={`Point ${city.id}`}
                  />
                  {editPoints && (
                    <div
                      draggable={editLabels}
                      onDragStart={(event) => {
                        if (!editLabels) return;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('application/x-conda-kind', 'label');
                        event.dataTransfer.setData('text/plain', city.id);
                      }}
                      className={`absolute rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-violet-700 shadow ${editLabels ? 'pointer-events-auto cursor-move ring-2 ring-violet-300' : 'pointer-events-none'}`}
                      style={{
                        left: `${city.labelDx ?? (openLeft ? -4.2 : 3.8)}%`,
                        top: `${city.labelDy ?? -1.1}%`,
                        transform: openLeft ? 'translateX(-100%)' : 'none'
                      }}
                    >
                      {city.name}
                    </div>
                  )}
                  {!editPoints && answer && !isActive && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setActiveCityId(city.id);
                      }}
                      className="absolute rounded-xl bg-white/90 px-2 py-1 text-sm font-black text-slate-700 shadow-sm"
                      style={{
                        left: `${city.labelDx ?? (openLeft ? -4.2 : 3.8)}%`,
                        top: `${city.labelDy ?? -1.1}%`,
                        transform: openLeft ? 'translateX(-100%)' : 'none'
                      }}
	                    >
                      {answer}
                    </button>
                  )}
                  {!editPoints && isActive && (
                    <div
                      className="absolute z-20 w-[190px] rounded-2xl border-2 border-slate-200 bg-white p-2 shadow-xl"
                      style={{
                        left: `${city.labelDx ?? (openLeft ? -4.2 : 3.8)}%`,
                        top: `${(city.labelDy ?? -1.1) - 0.8}%`,
                        transform: openLeft ? 'translateX(-100%)' : 'none'
                      }}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={answer}
                        onChange={(event) => updateAnswer(city.id, event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            const index = draftPoints.findIndex((item) => item.id === city.id);
                            setActiveCityId(draftPoints[(index + 1) % draftPoints.length].id);
                          }
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-900 outline-none focus:border-emerald-400"
                        placeholder="Nom de la ville"
                      />
                      {checked && (
                        <div className={`mt-2 rounded-xl px-2 py-1 text-[11px] font-black ${normalizeAnswer(answer) === normalizeAnswer(city.name) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {normalizeAnswer(answer) === normalizeAnswer(city.name) ? 'Bonne réponse' : city.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </section>
  );
}

const DNB_REPARTITION_PENCILS = [
  { key: 'red', label: 'Rouge', color: '#f00000', opacity: 0.82 },
  { key: 'orange', label: 'Orange', color: '#ff7a00' },
  { key: 'yellow', label: 'Jaune', color: '#f4df27' },
  { key: 'green', label: 'Vert', color: '#16a66a' },
  { key: 'blue', label: 'Bleu clair', color: '#38bdf8' },
  { key: 'purple', label: 'Violet', color: '#7c3aed' },
  { key: 'black', label: 'Noir', color: '#111827' }
];

const DNB_ESPACESP_PENCILS = [
  { key: 'industrial-pink', label: 'Rose', color: '#ef5b78', opacity: 0.78 },
  { key: 'industrial-blue', label: 'Bleu', color: '#3974ad', opacity: 0.78 },
  { key: 'technology-yellow', label: 'Jaune', color: '#f5c635', opacity: 0.76 },
  { key: 'cereal-orange', label: 'Orange', color: '#f6b82f', opacity: 0.78 },
  { key: 'farming-green', label: 'Vert', color: '#42b649', opacity: 0.78 },
  { key: 'specialized-red', label: 'Rouge', color: '#ef3155', opacity: 0.8 },
  { key: 'mixed-light-green', label: 'Vert clair', color: '#dce8a8', opacity: 0.72 },
  { key: 'services-red', label: 'Rouge', color: '#f23b20', opacity: 0.88 },
  { key: 'tourism-green', label: 'Vert', color: '#a9cc2f', opacity: 0.78 },
  { key: 'transport-purple', label: 'Violet', color: '#7c3aed', opacity: 0.78 },
  { key: 'black', label: 'Noir', color: '#111827' }
];

const DNB_ORG_UE_PENCILS = [
  { key: 'center-pink', label: 'Rose', color: '#ef5b78', opacity: 0.8 },
  { key: 'dynamic-orange', label: 'Orange', color: '#f2a866', opacity: 0.78 },
  { key: 'integration-yellow', label: 'Jaune', color: '#f5d75a', opacity: 0.78 },
  { key: 'land-red', label: 'Rouge', color: '#dc2626', opacity: 0.92 },
  { key: 'sea-blue', label: 'Bleu', color: '#1677b8', opacity: 0.92 },
  { key: 'institution-yellow', label: 'Jaune clair', color: '#f8ef45', opacity: 0.92 },
  { key: 'white', label: 'Blanc', color: '#ffffff', opacity: 1 },
  { key: 'black', label: 'Noir', color: '#111827' }
];

const DNB_ESPACESP_MAP_SECTIONS = [
  { key: 'industrial', label: 'Carte industrielle', minX: 0, maxX: 33.33, pencilKeys: ['industrial-pink', 'industrial-blue', 'technology-yellow', 'black'] },
  { key: 'agricultural', label: 'Carte agricole', minX: 33.33, maxX: 66.66, pencilKeys: ['cereal-orange', 'farming-green', 'specialized-red', 'mixed-light-green', 'black'] },
  { key: 'services', label: 'Carte des services', minX: 66.66, maxX: 100, pencilKeys: ['services-red', 'tourism-green', 'transport-purple'] }
];

const DNB_ESPACESP_REVISION_LABELS = {
  'solid:#ef5b78': 'Grande région industrielle',
  'solid:#3974ad': 'Vieille région industrielle',
  'solid:#f5c635': 'Espace de hautes technologies',
  'solid:#f6b82f': 'Grande culture céréalière',
  'solid:#42b649': 'Élevage intensif',
  'solid:#ef3155': 'Cultures spécialisées',
  'solid:#dce8a8': 'Polyculture et élevage extensif',
  'dashed:#111827': 'Régions intégrées à la mondialisation',
  'point:#f23b20': 'Pôles tertiaires',
  'solid:#a9cc2f': 'Espaces touristiques',
  'line:#7c3aed': 'Axes de transports'
};

const DNB_ESPACESP_REVISION_TITLES = {
  industrial: 'Les espaces industriels',
  agricultural: 'Les espaces agricoles',
  services: 'Les espaces de services'
};

const DNB_ORG_UE_REVISION_LABELS = {
  'solid:#ef5b78': 'Mégalopole européenne',
  'dashed:#111827': 'Limites de la mégalopole européenne',
  'point:#dc2626': 'Métropoles mondiales et autres métropoles',
  'star:#f8ef45': 'Sièges des institutions de l’UE',
  'solid:#f2a866': 'Périphéries dynamiques',
  'solid:#f5d75a': 'Périphéries en cours d’intégration',
  'line:#ef5b78': 'Axes terrestres majeurs',
  'line:#1677b8': 'Axe maritime mondial'
};

const DNB_ORG_UE_REVISION_GROUP_TITLES = {
  center: '1. Le centre de l’UE',
  peripheries: '2. Les périphéries de l’UE',
  axes: '3. Les axes de communication'
};

function DnbGeoRepartitionColoringGame({
  mapUrl = DNB_GEO_REPARTITION_MAP_URL,
  draftUrl = DNB_GEO_REPARTITION_DRAFT_URL,
  draftKey = DNB_GEO_REPARTITION_DRAFT_KEY,
  heading = 'Colorie la répartition de la population',
  mapAlt = 'Carte muette de la répartition de la population française',
  showCentralLabel = true,
  showDensityInputs = true,
  pencils = DNB_REPARTITION_PENCILS,
  repeatBlankPanel = false,
  resetWhenDraftMissing = false,
  compactStrokeWidths = false,
  uniformColors = false,
  mapSections = [],
  allowPoints = false,
  allowSquares = false,
  allowBackgroundFill = false,
  allowStars = false,
  allowDashedLines = false,
  forceRedPoints = false,
  hideEraser = false,
  smallRoundPoints = false,
  allowStraightAxes = false,
  allowPointLabels = false,
  stagedWorkflow = false,
  revisionMode = false,
  revisionLegendBelow = false
}) {
  const drawingRef = useRef(null);
  const mapImageRef = useRef(null);
  const [mapReady, setMapReady] = useState(true);
  const [pencil, setPencil] = useState(pencils[0]);
  const [strokeWidth, setStrokeWidth] = useState(compactStrokeWidths ? 0.65 : 5);
  const [drawMode, setDrawMode] = useState('line');
  const [activeMapSection, setActiveMapSection] = useState(() => mapSections[0]?.key || '');
  const [savedDrawing] = useState(() => {
    if (revisionMode) return { paths: [], fills: [], hasLocalDraft: false };
    if (typeof window === 'undefined') return { paths: [], fills: [], hasLocalDraft: false };
    try {
      const rawStored = window.localStorage.getItem(draftKey);
      if (!rawStored) return { paths: [], fills: [], hasLocalDraft: false };
      const stored = JSON.parse(rawStored);
      return Array.isArray(stored)
        ? { paths: lightenRepartitionBlue(stored), fills: [], title: '', legendItems: [], legendGroupTitles: EMPTY_REPARTITION_LEGEND_TITLES, hasLocalDraft: true }
        : { paths: lightenRepartitionBlue(stored?.paths || []), fills: stored?.fills || [], title: stored?.title || '', mapTitles: stored?.mapTitles || {}, centralLabel: stored?.centralLabel || '', legendItems: stored?.legendItems || [], legendGroupTitles: stored?.legendGroupTitles || EMPTY_REPARTITION_LEGEND_TITLES, mapRectangles: stored?.mapRectangles || [], hasLocalDraft: true };
    } catch (_) {
      return { paths: [], fills: [], hasLocalDraft: false };
    }
  });
  const [paths, setPaths] = useState(() => savedDrawing.paths || []);
  const [fills, setFills] = useState(() => savedDrawing.fills || []);
  const [mapTitle, setMapTitle] = useState(() => savedDrawing.title || '');
  const [mapTitles, setMapTitles] = useState(() => savedDrawing.mapTitles || {});
  const [centralLabel, setCentralLabel] = useState(() => savedDrawing.centralLabel || '');
  const [legendItems, setLegendItems] = useState(() => savedDrawing.legendItems || []);
  const [legendGroupTitles, setLegendGroupTitles] = useState(() => savedDrawing.legendGroupTitles || EMPTY_REPARTITION_LEGEND_TITLES);
  const [mapRectangles, setMapRectangles] = useState(() => savedDrawing.mapRectangles || []);
  const [currentMapRectangle, setCurrentMapRectangle] = useState(null);
  const [draftReady, setDraftReady] = useState(savedDrawing.hasLocalDraft);
  const [currentPath, setCurrentPath] = useState(null);
  const [erasedSnapshot, setErasedSnapshot] = useState(null);
  const [editPointLabels, setEditPointLabels] = useState(false);
  const [checkedPointLabels, setCheckedPointLabels] = useState(false);
  const [draggingPointLabel, setDraggingPointLabel] = useState(null);
  const [activePointLabelId, setActivePointLabelId] = useState('');
  const [workflowStage, setWorkflowStage] = useState('color');
  const [workflowValidated, setWorkflowValidated] = useState(false);

  useEffect(() => {
    if (!allowPointLabels || !draftReady) return;
    setFills((previous) => previous.map((fill) => {
      const isPoint = fill?.pattern === 'point' && fill?.svgCircles?.[0];
      const isStar = fill?.pattern === 'star' && fill?.svgStars?.[0];
      if (!isPoint && !isStar) return fill;
      const symbol = isPoint ? fill.svgCircles[0] : fill.svgStars[0];
      if (fill.expectedName && Number.isFinite(fill.labelX) && Number.isFinite(fill.labelY)) return fill;
      return {
        ...fill,
        expectedName: fill.expectedName || (isPoint ? inferOrgUeCity(symbol.x, symbol.y) : inferOrgUeInstitution(symbol.x, symbol.y)),
        answer: fill.answer || '',
        labelX: Number.isFinite(fill.labelX) ? fill.labelX : Math.min(88, symbol.x + 1.2),
        labelY: Number.isFinite(fill.labelY) ? fill.labelY : Math.max(0, symbol.y - 2),
        labelWidth: Number(fill.labelWidth || (isStar ? 9 : 10)),
        labelHeight: Number(fill.labelHeight || (isStar ? 2.6 : 4))
      };
    }));
  }, [allowPointLabels, draftReady]);

  useEffect(() => {
    if (!resetWhenDraftMissing || typeof window === 'undefined') return;
    if (window.localStorage.getItem(draftKey)) return;
    setPaths([]);
    setFills([]);
    setMapTitle('');
    setMapTitles({});
    setCentralLabel('');
    setLegendItems([]);
    setLegendGroupTitles(EMPTY_REPARTITION_LEGEND_TITLES);
    setMapRectangles([]);
    setCurrentMapRectangle(null);
    setCurrentPath(null);
    setDraftReady(true);
  }, [draftKey, resetWhenDraftMissing]);

  useEffect(() => {
    let cancelled = false;
    fetch(draftUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`Brouillon introuvable (${response.status})`);
        return response.json();
      })
      .then((draft) => {
        if (cancelled) return;
        if (savedDrawing.hasLocalDraft && !Array.isArray(draft)) {
          setFills((previous) => [
            ...(draft?.fills || []).filter((fill) => fill?.expectedOnly),
            ...previous.filter((fill) => !fill?.expectedOnly)
          ]);
          setLegendItems((previous) => [
            ...(draft?.legendItems || []).filter((item) => item?.expectedOnly),
            ...previous.filter((item) => !item?.expectedOnly)
          ]);
          setMapRectangles((previous) => previous.length > 0 ? previous : (draft?.mapRectangles || []));
          return;
        }
        setPaths(lightenRepartitionBlue(Array.isArray(draft) ? draft : (draft?.paths || [])));
        setFills(Array.isArray(draft) ? [] : (draft?.fills || []));
        setMapTitle(Array.isArray(draft) ? '' : (draft?.title || ''));
        setMapTitles(Array.isArray(draft) ? {} : (draft?.mapTitles || {}));
        setCentralLabel(Array.isArray(draft) ? '' : (draft?.centralLabel || ''));
        setLegendItems(Array.isArray(draft) ? [] : (draft?.legendItems || []));
        setLegendGroupTitles(Array.isArray(draft) ? EMPTY_REPARTITION_LEGEND_TITLES : (draft?.legendGroupTitles || EMPTY_REPARTITION_LEGEND_TITLES));
        setMapRectangles(Array.isArray(draft) ? [] : (draft?.mapRectangles || []));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDraftReady(true);
      });
    return () => { cancelled = true; };
  }, [draftUrl, savedDrawing.hasLocalDraft]);

  useEffect(() => {
    if (revisionMode || typeof window === 'undefined' || !draftReady) return;
    const payload = JSON.stringify({
      paths,
      fills: fills.filter((fill) => !fill?.expectedOnly),
      title: mapTitle,
      mapTitles,
      centralLabel,
      legendItems: legendItems.filter((item) => !item?.expectedOnly),
      legendGroupTitles,
      mapRectangles
    });
    const clearObsoleteDrafts = () => {
      if (!draftKey.startsWith('condaweb-dnb-espacesp-france-drawing-')) return;
      const obsoleteKeys = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key?.startsWith('condaweb-dnb-espacesp-france-drawing-') && key !== draftKey) obsoleteKeys.push(key);
      }
      obsoleteKeys.forEach((key) => window.localStorage.removeItem(key));
    };
    try {
      clearObsoleteDrafts();
      window.localStorage.setItem(draftKey, payload);
    } catch (error) {
      try {
        clearObsoleteDrafts();
        window.localStorage.setItem(draftKey, payload);
      } catch (retryError) {
        console.warn('Sauvegarde locale de la carte impossible : quota atteint.', retryError || error);
      }
    }
  }, [draftKey, draftReady, paths, fills, mapTitle, mapTitles, centralLabel, legendItems, legendGroupTitles, mapRectangles, revisionMode]);

  useEffect(() => {
    if (!draftReady) return;
    const automaticItems = [];
    const knownKeys = new Set();
    const addAutomaticItem = (pattern, color, groupKey = '') => {
      if (!color) return;
      const key = `${pattern}:${String(color).toLowerCase()}`;
      if (knownKeys.has(key)) return;
      knownKeys.add(key);
      automaticItems.push({
        id: `repartition-legend-auto-${pattern}-${String(color).replace('#', '')}`,
        color,
        pattern,
        ...(groupKey ? { groupKey } : {}),
        label: ''
      });
    };
    fills.forEach((fill) => {
      if (!fill?.skipLegend && !fill?.expectedOnly) addAutomaticItem(fill?.pattern || 'solid', fill?.color, fill?.groupKey);
    });
    paths.forEach((path) => {
      if (path?.type === 'arrow') addAutomaticItem('arrow', path?.color, path?.groupKey);
      if (path?.type === 'dashed') addAutomaticItem('dashed', path?.color, path?.groupKey);
      if (path?.type === 'axis') addAutomaticItem('line', path?.color, path?.groupKey);
    });
    setLegendItems((previous) => {
      const existingKeys = new Set(previous.map((item) => `${item?.pattern}:${String(item?.color || '').toLowerCase()}`));
      const missingItems = automaticItems.filter((item) => !existingKeys.has(`${item.pattern}:${String(item.color).toLowerCase()}`));
      return missingItems.length > 0 ? [...previous, ...missingItems] : previous;
    });
  }, [draftReady, paths, fills]);

  const pointerToPercent = (event) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Number(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2)),
      y: Number(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2))
    };
  };
  const effectiveMapSections = mapRectangles.length > 0
    ? mapRectangles.map((rectangle, index) => ({
        ...(mapSections[index] || {}),
        ...rectangle,
        minX: rectangle.x,
        maxX: rectangle.x + rectangle.width,
        minY: rectangle.y,
        maxY: rectangle.y + rectangle.height
      }))
    : mapSections;

  const startPointLabelDrag = (event, fill, mode = 'move') => {
    if (!editPointLabels) return;
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    setDraggingPointLabel(mode === 'resize' ? {
      id: fill.id,
      mode,
      right: Number(fill.labelX || 0) + Number(fill.labelWidth || 10),
      bottom: Number(fill.labelY || 0) + Number(fill.labelHeight || 4)
    } : {
      id: fill.id,
      mode,
      offsetX: pointerX - Number(fill.labelX || 0),
      offsetY: pointerY - Number(fill.labelY || 0)
    });
  };

  const movePointLabel = (event) => {
    if (!draggingPointLabel || !editPointLabels) return false;
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return true;
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    setFills((previous) => previous.map((fill) => {
      if (fill.id !== draggingPointLabel.id) return fill;
      if (draggingPointLabel.mode === 'resize') {
        const nextX = Math.max(0, Math.min(draggingPointLabel.right - 5, pointerX));
        const nextY = Math.max(0, Math.min(draggingPointLabel.bottom - 2.5, pointerY));
        return { ...fill, labelX: +nextX.toFixed(2), labelY: +nextY.toFixed(2), labelWidth: +(draggingPointLabel.right - nextX).toFixed(2), labelHeight: +(draggingPointLabel.bottom - nextY).toFixed(2) };
      }
      return {
        ...fill,
        labelX: +Math.max(0, Math.min(100 - Number(fill.labelWidth || 10), pointerX - draggingPointLabel.offsetX)).toFixed(2),
        labelY: +Math.max(0, Math.min(100 - Number(fill.labelHeight || 4), pointerY - draggingPointLabel.offsetY)).toFixed(2)
      };
    }));
    return true;
  };

  const startColoring = (event) => {
    event.preventDefault();
    if (revisionMode) return;
    if (stagedWorkflow && workflowStage !== 'color') return;
    const pointerPoint = pointerToPercent(event);
    if (drawMode !== 'eraser' && erasedSnapshot) setErasedSnapshot(null);
    if (drawMode === 'define-map') {
      if (!pointerPoint || mapRectangles.length >= mapSections.length) return;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setCurrentMapRectangle({ startX: pointerPoint.x, startY: pointerPoint.y, endX: pointerPoint.x, endY: pointerPoint.y });
      return;
    }
    const clickedSection = effectiveMapSections.find((section) => pointerPoint
      && pointerPoint.x >= section.minX && pointerPoint.x <= section.maxX
      && pointerPoint.y >= (section.minY ?? 0) && pointerPoint.y <= (section.maxY ?? 100));
    if (clickedSection && clickedSection.key !== activeMapSection && drawMode !== 'eraser') {
      setActiveMapSection(clickedSection.key);
      const firstSectionPencil = pencils.find((item) => clickedSection.pencilKeys.includes(item.key));
      if (firstSectionPencil) setPencil(firstSectionPencil);
      return;
    }
    if (drawMode === 'eraser') {
      setErasedSnapshot({ paths, fills });
      eraseAt(event, true);
      return;
    }
    if (drawMode === 'point') {
      if (!pointerPoint) return;
      const pointPencil = forceRedPoints ? (pencils.find((item) => item.key === 'land-red') || pencil) : pencil;
      setFills((previous) => [...previous, {
        id: `repartition-fill-${Date.now()}`,
        color: pointPencil.color,
        pattern: 'point',
        ...(allowPointLabels ? {
          expectedName: inferOrgUeCity(pointerPoint.x, pointerPoint.y),
          answer: '',
          labelX: Math.min(88, pointerPoint.x + 1.2),
          labelY: Math.max(0, pointerPoint.y - 2),
          labelWidth: 10,
          labelHeight: 4
        } : {}),
        ...(activeMapSection ? { groupKey: activeMapSection } : {}),
        svgCircles: [{ x: pointerPoint.x, y: pointerPoint.y, r: 1.35 }]
      }]);
      return;
    }
    if (drawMode === 'star') {
      if (!pointerPoint) return;
      const starPencil = pencils.find((item) => item.key === 'institution-yellow') || pencil;
      setFills((previous) => [...previous, {
        id: `repartition-fill-${Date.now()}`,
        color: starPencil.color,
        pattern: 'star',
        ...(allowPointLabels ? {
          expectedName: inferOrgUeInstitution(pointerPoint.x, pointerPoint.y),
          answer: '',
          labelX: Math.min(88, pointerPoint.x + 1.2),
          labelY: Math.max(0, pointerPoint.y - 2),
          labelWidth: 9,
          labelHeight: 2.6
        } : {}),
        ...(activeMapSection ? { groupKey: activeMapSection } : {}),
        svgStars: [{ x: pointerPoint.x, y: pointerPoint.y, r: 1.8 }]
      }]);
      return;
    }
    if (drawMode === 'square') {
      if (!pointerPoint) return;
      const blackPencil = pencils.find((item) => item.key === 'black');
      setFills((previous) => [...previous, {
        id: `repartition-fill-${Date.now()}`,
        color: blackPencil?.color || '#111827',
        pattern: 'square',
        skipLegend: true,
        ...(activeMapSection ? { groupKey: activeMapSection } : {}),
        svgRectangles: [{ x: pointerPoint.x - 0.7, y: pointerPoint.y - 1.7, width: 1.4, height: 3.4 }]
      }]);
      return;
    }
    if (drawMode === 'fill' || drawMode === 'hatch' || drawMode === 'fill-background') {
      fillClosedZone(event, drawMode);
      return;
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = pointerPoint;
    if (!point) return;
    setCurrentPath({
      id: `repartition-path-${Date.now()}`,
      color: pencil.color,
      pencilKey: pencil.key,
      opacity: uniformColors ? 1 : (pencil.opacity || 0.52),
      type: drawMode,
      ...(activeMapSection ? { groupKey: activeMapSection } : {}),
      width: strokeWidth,
      points: [point]
    });
  };

  const continueColoring = (event) => {
    if (movePointLabel(event)) return;
    if (drawMode === 'define-map' && currentMapRectangle) {
      const point = pointerToPercent(event);
      if (point) setCurrentMapRectangle((previous) => previous ? { ...previous, endX: point.x, endY: point.y } : previous);
      return;
    }
    if (drawMode === 'eraser' && event.buttons > 0) {
      eraseAt(event, false);
      return;
    }
    if (!currentPath) return;
    const point = pointerToPercent(event);
    if (!point) return;
    setCurrentPath((previous) => {
      if (!previous) return previous;
      if (previous.type === 'arrow' || previous.type === 'axis') return { ...previous, points: [previous.points[0], point] };
      return { ...previous, points: [...previous.points, point] };
    });
  };

  const endColoring = (event) => {
    if (draggingPointLabel) {
      setDraggingPointLabel(null);
      return;
    }
    event?.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (drawMode === 'define-map') {
      setCurrentMapRectangle((rectangle) => {
        if (!rectangle) return null;
        const width = Math.abs(rectangle.endX - rectangle.startX);
        const height = Math.abs(rectangle.endY - rectangle.startY);
        if (width >= 3 && height >= 3) {
          setMapRectangles((previous) => {
            if (previous.length >= mapSections.length) return previous;
            const section = mapSections[previous.length];
            setActiveMapSection(section.key);
            if (previous.length + 1 >= mapSections.length) setDrawMode('line');
            return [...previous, {
              key: section.key,
              label: section.label,
              x: Math.min(rectangle.startX, rectangle.endX),
              y: Math.min(rectangle.startY, rectangle.endY),
              width,
              height
            }];
          });
        }
        return null;
      });
      return;
    }
    setCurrentPath((previous) => {
      if (previous?.points?.length > 1) setPaths((existing) => [...existing, previous]);
      return null;
    });
  };

  const pathToD = (points = []) => points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ');
  const visiblePaths = currentPath ? [...paths, currentPath] : paths;
  const distanceToSegment = (point, start, end) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y);
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
  };

  const removeFillAt = (point) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect || fills.length === 0) return;
    const vectorFill = [...fills].reverse().find((fill) => {
      const hitsCircle = (fill?.svgCircles || []).some((circle) => {
        const rx = circle.rx ?? Number(circle.r || 1) * 0.4;
        const ry = circle.ry ?? circle.r ?? 1;
        return (((point.x - circle.x) / rx) ** 2) + (((point.y - circle.y) / ry) ** 2) <= 1;
      });
      const hitsRectangle = (fill?.svgRectangles || []).some((rectangle) => point.x >= rectangle.x
        && point.x <= rectangle.x + rectangle.width
        && point.y >= rectangle.y
        && point.y <= rectangle.y + rectangle.height);
      const hitsStar = (fill?.svgStars || []).some((star) => Math.hypot(point.x - star.x, point.y - star.y) <= Number(star.r || 1.8));
      return hitsCircle || hitsRectangle || hitsStar;
    });
    if (vectorFill) {
      setFills((previous) => previous.filter((fill) => fill.id !== vectorFill.id));
      return;
    }
    const inspect = (index) => {
      if (index < 0) return;
      const fill = fills[index];
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(image, 0, 0);
        const x = Math.max(0, Math.min(canvas.width - 1, Math.floor(point.x / 100 * canvas.width)));
        const y = Math.max(0, Math.min(canvas.height - 1, Math.floor(point.y / 100 * canvas.height)));
        const alpha = ctx.getImageData(x, y, 1, 1).data[3];
        if (alpha > 0) {
          setFills((previous) => previous.filter((item) => item.id !== fill.id));
        } else {
          inspect(index - 1);
        }
      };
      image.onerror = () => inspect(index - 1);
      image.src = fill.image;
    };
    inspect(fills.length - 1);
  };

  const eraseAt = (event, eraseFill = false) => {
    const point = pointerToPercent(event);
    if (!point) return;
    const touchedIds = new Set(paths.filter((path) => {
      const points = Array.isArray(path?.points) ? path.points : [];
      const radius = Math.max(1.6, Number(path.width || 1) * 0.55 + 1.2);
      return points.some((pathPoint, index) => {
        if (index === 0) return Math.hypot(point.x - pathPoint.x, point.y - pathPoint.y) <= radius;
        return distanceToSegment(point, points[index - 1], pathPoint) <= radius;
      });
    }).map((path) => path.id));
    if (touchedIds.size > 0) {
      const pathBounds = (path) => {
        const points = Array.isArray(path?.points) ? path.points : [];
        return points.reduce((bounds, pathPoint) => ({
          minX: Math.min(bounds.minX, pathPoint.x),
          maxX: Math.max(bounds.maxX, pathPoint.x),
          minY: Math.min(bounds.minY, pathPoint.y),
          maxY: Math.max(bounds.maxY, pathPoint.y)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
      };
      const boundsById = new Map(paths.map((path) => [path.id, pathBounds(path)]));
      let expanded = true;
      while (expanded) {
        expanded = false;
        paths.forEach((candidate) => {
          if (touchedIds.has(candidate.id)) return;
          const candidateBounds = boundsById.get(candidate.id);
          const connectsToSelection = paths.some((selectedPath) => {
            if (!touchedIds.has(selectedPath.id) || selectedPath.color !== candidate.color) return false;
            const selectedBounds = boundsById.get(selectedPath.id);
            const margin = Math.max(1.2, Number(candidate.width || 1), Number(selectedPath.width || 1));
            return candidateBounds.minX <= selectedBounds.maxX + margin
              && candidateBounds.maxX >= selectedBounds.minX - margin
              && candidateBounds.minY <= selectedBounds.maxY + margin
              && candidateBounds.maxY >= selectedBounds.minY - margin;
          });
          if (connectsToSelection) {
            touchedIds.add(candidate.id);
            expanded = true;
          }
        });
      }
    }
    if (touchedIds.size > 0) setPaths((previous) => previous.filter((path) => !touchedIds.has(path.id)));
    if (eraseFill && touchedIds.size === 0) removeFillAt(point);
  };
  const hexToRgb = (hex = '') => {
    const clean = String(hex || '').replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0
    };
  };

  const fillClosedZone = (event, fillMode = 'fill') => {
    const image = mapImageRef.current;
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!image?.naturalWidth || !image?.naturalHeight || !rect) return;
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    const startX = Math.max(0, Math.min(width - 1, Math.floor(((event.clientX - rect.left) / rect.width) * width)));
    const startY = Math.max(0, Math.min(height - 1, Math.floor(((event.clientY - rect.top) / rect.height) * height)));

    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceCtx.drawImage(image, 0, 0, width, height);
    const source = sourceCtx.getImageData(0, 0, width, height).data;

    const barrierCanvas = document.createElement('canvas');
    barrierCanvas.width = width;
    barrierCanvas.height = height;
    const barrierCtx = barrierCanvas.getContext('2d', { willReadFrequently: true });
    barrierCtx.strokeStyle = '#000';
    barrierCtx.lineCap = 'round';
    barrierCtx.lineJoin = 'round';
    const lastOutlinePath = [...paths].reverse().find((path) => path?.type !== 'arrow' && path?.color);
    const barrierPaths = fillMode === 'hatch' && lastOutlinePath
      ? paths.filter((path) => path?.type !== 'arrow' && path?.color === lastOutlinePath.color)
      : paths;
    barrierPaths.forEach((path) => {
      if (!Array.isArray(path?.points) || path.points.length < 2) return;
      barrierCtx.beginPath();
      path.points.forEach((point, index) => {
        const x = (point.x / 100) * width;
        const y = (point.y / 100) * height;
        if (index === 0) barrierCtx.moveTo(x, y);
        else barrierCtx.lineTo(x, y);
      });
      barrierCtx.lineWidth = Math.max(2, Number(path.width || 2.5) * width / 100);
      barrierCtx.stroke();
    });
    const barriers = barrierCtx.getImageData(0, 0, width, height).data;
    const startIndex = startY * width + startX;
    if (barriers[startIndex * 4 + 3] > 0) {
      window.alert('Clique à l’intérieur de la zone, pas sur son contour.');
      return;
    }

    const visited = new Uint8Array(width * height);
    const queueX = new Int32Array(width * height);
    const queueY = new Int32Array(width * height);
    let head = 0;
    let tail = 0;
    queueX[tail] = startX;
    queueY[tail] = startY;
    tail += 1;
    visited[startIndex] = 1;
    while (head < tail) {
      const x = queueX[head];
      const y = queueY[head];
      head += 1;
      const neighbours = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      neighbours.forEach(([nx, ny]) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
        const index = ny * width + nx;
        if (visited[index] || barriers[index * 4 + 3] > 0) return;
        visited[index] = 1;
        queueX[tail] = nx;
        queueY[tail] = ny;
        tail += 1;
      });
    }
    if (tail > width * height * 0.9) {
      window.alert('La zone semble ouverte : ferme mieux le contour avant de colorier.');
      return;
    }

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outputCtx = outputCanvas.getContext('2d');
    const output = outputCtx.createImageData(width, height);
    const rgb = hexToRgb(pencil.color);
    const hatchSpacing = Math.max(8, Math.round(width / 48));
    const hatchThickness = Math.max(2, Math.round(width / 240));
    for (let index = 0; index < visited.length; index += 1) {
      if (!visited[index]) continue;
      const offset = index * 4;
      const luminance = source[offset] * 0.299 + source[offset + 1] * 0.587 + source[offset + 2] * 0.114;
      if (luminance < 75) continue;
      if (fillMode === 'hatch') {
        const x = index % width;
        const y = Math.floor(index / width);
        if (((x + y) % hatchSpacing) >= hatchThickness) continue;
      }
      output.data[offset] = rgb.r;
      output.data[offset + 1] = rgb.g;
      output.data[offset + 2] = rgb.b;
      output.data[offset + 3] = uniformColors ? 255 : (fillMode === 'hatch' ? 220 : (pencil.key === 'red' ? 190 : 145));
    }
    outputCtx.putImageData(output, 0, 0);
    setFills((previous) => [...previous, {
      id: `repartition-fill-${Date.now()}`,
      color: pencil.color,
      pattern: fillMode === 'hatch' ? 'hatch' : 'solid',
      ...(fillMode === 'fill-background' ? { background: true } : {}),
      ...(activeMapSection ? { groupKey: activeMapSection } : {}),
      image: outputCanvas.toDataURL('image/png')
    }]);
  };
  const copyRepartitionDraft = async () => {
    const savedFills = allowPointLabels ? fills.map((fill) => fill?.pattern === 'point' || fill?.pattern === 'star' ? { ...fill, answer: '' } : fill) : fills;
    const payload = JSON.stringify({ paths, fills: savedFills, title: mapTitle, mapTitles, centralLabel, legendItems, legendGroupTitles, mapRectangles }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      window.alert('Sauvegarde du coloriage copiée.');
    } catch (_) {
      window.prompt('Copie la sauvegarde du coloriage :', payload);
    }
  };
  const undoLastRepartitionAction = () => {
    if (erasedSnapshot) {
      setPaths(erasedSnapshot.paths);
      setFills(erasedSnapshot.fills);
      setErasedSnapshot(null);
      return;
    }
    const lastPath = paths[paths.length - 1];
    const lastFill = fills[fills.length - 1];
    const actionTime = (item) => {
      const match = String(item?.id || '').match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    };
    if (lastPath && (!lastFill || actionTime(lastPath) >= actionTime(lastFill))) {
      setPaths((previous) => previous.slice(0, -1));
      return;
    }
    if (lastFill) setFills((previous) => previous.slice(0, -1));
  };
  const addRepartitionLegendItem = () => {
    const patternByMode = { hatch: 'hatch', arrow: 'arrow', line: 'line', dashed: 'dashed', point: 'point', star: 'star' };
    setLegendItems((previous) => [...previous, {
      id: `repartition-legend-${Date.now()}`,
      color: pencil.color,
      pattern: patternByMode[drawMode] || 'solid',
      ...(activeMapSection ? { groupKey: activeMapSection } : {}),
      label: ''
    }]);
  };
  const isOrgUeRevision = revisionMode && mapUrl === DNB_GEO_ORG_UE_MAP_URL;
  const orgUeLegendKey = (item) => `${item?.pattern}:${String(item?.color || '').toLowerCase()}`;
  const orgUeGroupKey = (item) => {
    const key = orgUeLegendKey(item);
    if (key === 'solid:#f2a866' || key === 'solid:#f5d75a') return 'peripheries';
    if (item?.pattern === 'line') return 'axes';
    return 'center';
  };
  const legendGroupKeyForItem = (item) => item?.groupKey || (isOrgUeRevision ? orgUeGroupKey(item) : (item?.pattern === 'solid' ? 'distribution' : 'dynamics'));
  const displayedLegendItems = isOrgUeRevision
    ? legendItems
      .filter((item) => Object.prototype.hasOwnProperty.call(DNB_ORG_UE_REVISION_LABELS, orgUeLegendKey(item)))
      .sort((left, right) => {
        const order = ['solid:#ef5b78', 'point:#dc2626', 'star:#f8ef45', 'dashed:#111827', 'solid:#f2a866', 'solid:#f5d75a', 'line:#ef5b78', 'line:#1677b8'];
        return order.indexOf(orgUeLegendKey(left)) - order.indexOf(orgUeLegendKey(right));
      })
    : legendItems;
  const selectedMapSection = effectiveMapSections.find((section) => section.key === activeMapSection);
  const visiblePencils = selectedMapSection
    ? pencils.filter((item) => selectedMapSection.pencilKeys.includes(item.key))
    : pencils;
  const sectionKeyForLegendItem = (item) => {
    if (item?.groupKey && mapSections.some((section) => section.key === item.groupKey)) return item.groupKey;
    const matchingPencil = pencils.find((candidate) => candidate.color === item?.color);
    return mapSections.find((section) => matchingPencil && section.pencilKeys.includes(matchingPencil.key))?.key || '';
  };
  const legendItemsForSection = (sectionKey) => legendItems.filter((item) => (revisionMode || !item?.expectedOnly) && sectionKeyForLegendItem(item) === sectionKey);
  const revisionLegendLabel = (item) => item?.label
    || (isOrgUeRevision ? DNB_ORG_UE_REVISION_LABELS[orgUeLegendKey(item)] : DNB_ESPACESP_REVISION_LABELS[`${item?.pattern}:${String(item?.color || '').toLowerCase()}`])
    || '';

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Partie 2 · Géo</div>
          <div className="text-2xl font-black text-slate-900">{heading}</div>
        </div>
        {!revisionMode && <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={copyRepartitionDraft}
            disabled={paths.length === 0}
            className="rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            Copier sauvegarde
          </button>
          <button
            type="button"
            onClick={undoLastRepartitionAction}
            disabled={paths.length === 0 && fills.length === 0}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            ↶ Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              if (!window.confirm('Effacer tout le coloriage de cette carte ?')) return;
              setPaths([]);
              setFills([]);
              setCurrentPath(null);
            }}
            className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-600"
          >
            Tout effacer
          </button>
        </div>}
      </div>

      {!revisionMode && stagedWorkflow && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        {[
          ['color', '🎨 Colorier'],
          ['names', '✍ Noms'],
          ['legend', '▤ Légende']
        ].map(([stage, label]) => <button key={stage} type="button" onClick={() => {
          setWorkflowStage(stage);
          setWorkflowValidated(false);
          if (stage !== 'names') setEditPointLabels(false);
        }} className={`rounded-xl px-5 py-3 text-sm font-black ${workflowStage === stage ? 'bg-violet-600 text-white shadow' : 'bg-slate-100 text-slate-700'}`}>{label}</button>)}
        <button type="button" onClick={() => { setEditPointLabels(false); setCheckedPointLabels(true); setWorkflowValidated(true); }} className="ml-auto rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">✓ Valider</button>
        {workflowValidated && <span className="text-xs font-black text-emerald-700">Carte envoyée à la validation.</span>}
      </div>}

      {!revisionMode && <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        {stagedWorkflow && workflowStage === 'names' ? 'Complète les noms des métropoles et des institutions.' : stagedWorkflow && workflowStage === 'legend' ? 'Complète le titre et les éléments de la légende.' : 'Choisis un crayon et colorie directement les espaces de la carte. Le dessin est sauvegardé automatiquement sur cet appareil.'}
      </div>}

      {!revisionMode && (!stagedWorkflow || workflowStage === 'color') && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
        {selectedMapSection && (
          <span className="mr-2 rounded-xl bg-emerald-100 px-3 py-2 text-xs font-black text-emerald-700">
            {selectedMapSection.label}
          </span>
        )}
        <span className="mr-1 text-xs font-black uppercase text-slate-500">Outil</span>
        {mapSections.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (mapRectangles.length >= mapSections.length) {
                if (!window.confirm('Redéfinir les trois rectangles des cartes ?')) return;
                setMapRectangles([]);
                setActiveMapSection(mapSections[0]?.key || '');
              }
              setDrawMode('define-map');
            }}
            className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'define-map' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}
          >
            ▭ Définir ({mapRectangles.length}/{mapSections.length})
          </button>
        )}
        <button
          type="button"
          onClick={() => setDrawMode('line')}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'line' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >
          ✎ Trait
        </button>
        {allowStraightAxes && <button
          type="button"
          onClick={() => setDrawMode('axis')}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'axis' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >━ Axe droit</button>}
        <button
          type="button"
          onClick={() => setDrawMode('arrow')}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'arrow' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >
          ➜ Flèche
        </button>
        {allowDashedLines && <button
          type="button"
          onClick={() => {
            setDrawMode('dashed');
            const blackPencil = pencils.find((item) => item.key === 'black');
            if (blackPencil) setPencil(blackPencil);
          }}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'dashed' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >┄ Ligne pointillée</button>}
        <button
          type="button"
          onClick={() => setDrawMode('fill')}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'fill' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >
          🪣 Colorier
        </button>
        <button
          type="button"
          onClick={() => setDrawMode('hatch')}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'hatch' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >
          ▨ Hachurer
        </button>
        {allowBackgroundFill && (!selectedMapSection || selectedMapSection.key === 'agricultural') && (
          <button
            type="button"
            onClick={() => setDrawMode('fill-background')}
            className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'fill-background' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
          >
            ◻ Colorier le blanc
          </button>
        )}
        {allowPoints && (!selectedMapSection || selectedMapSection.key === 'services') && (
          <button
            type="button"
            onClick={() => {
              setDrawMode('point');
              if (forceRedPoints) {
                const redPencil = pencils.find((item) => item.key === 'land-red');
                if (redPencil) setPencil(redPencil);
              }
            }}
            className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'point' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
          >
            {forceRedPoints ? '● Point rouge' : '● Pôle tertiaire'}
          </button>
        )}
        {allowStars && <button
          type="button"
          onClick={() => {
            setDrawMode('star');
            const starPencil = pencils.find((item) => item.key === 'institution-yellow');
            if (starPencil) setPencil(starPencil);
          }}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'star' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >★ Institution UE</button>}
        {allowPointLabels && !stagedWorkflow && <button
          type="button"
          onClick={() => { setEditPointLabels((previous) => !previous); setCheckedPointLabels(false); }}
          className={`rounded-xl px-3 py-2 text-xs font-black ${editPointLabels ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}
        >▭ Calibrer les noms</button>}
        {allowPointLabels && !stagedWorkflow && !editPointLabels && <button
          type="button"
          onClick={() => setCheckedPointLabels(true)}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
        >✓ Vérifier les noms</button>}
        {allowSquares && selectedMapSection?.key === 'industrial' && (
          <button
            type="button"
            onClick={() => {
              setDrawMode('square');
              const blackPencil = pencils.find((item) => item.key === 'black');
              if (blackPencil) setPencil(blackPencil);
            }}
            className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'square' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
          >
            ■ Paris / Lyon
          </button>
        )}
        <span className="mr-1 text-xs font-black uppercase text-slate-500">Crayons</span>
        {visiblePencils.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setPencil(item);
              if (drawMode === 'eraser') setDrawMode('line');
            }}
            className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black ${pencil.key === item.key ? 'border-slate-900 bg-white shadow' : 'border-transparent bg-white/70 text-slate-600'}`}
            title={`Crayon ${item.label.toLowerCase()}`}
          >
            <span className="h-5 w-3 rotate-12 rounded-sm border border-black/10" style={{ backgroundColor: item.color }} />
            {item.label}
          </button>
        ))}
        {!hideEraser && <button
          type="button"
          onClick={() => setDrawMode('eraser')}
          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black ${drawMode === 'eraser' ? 'border-slate-900 bg-slate-700 text-white shadow' : 'border-transparent bg-white/70 text-slate-600'}`}
          title="Gommer un trait, une flèche ou une zone coloriée"
        >
          <span className="text-base">⬜</span>
          Gomme
        </button>}
        <span className="ml-2 text-xs font-black uppercase text-slate-500">Épaisseur</span>
        {(compactStrokeWidths ? [
          { value: 0.25, label: 'Ultra-fin' },
          { value: 0.65, label: 'Très fin' }
        ] : [
          { value: 0.65, label: 'Très très fin' },
          { value: 2.5, label: 'Fin' },
          { value: 5, label: 'Moyen' },
          { value: 9, label: 'Large' }
        ]).map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setStrokeWidth(item.value)}
            className={`rounded-xl px-3 py-2 text-xs font-black ${strokeWidth === item.value ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}
          >
            {item.label}
          </button>
        ))}
      </div>}
      {stagedWorkflow && workflowStage === 'names' && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 p-3">
        <button type="button" onClick={() => { setEditPointLabels((previous) => !previous); setCheckedPointLabels(false); }} className={`rounded-xl px-4 py-3 text-xs font-black ${editPointLabels ? 'bg-amber-500 text-white' : 'bg-white text-amber-800'}`}>▭ Calibrer les noms</button>
        {!editPointLabels && <button type="button" onClick={() => setCheckedPointLabels(true)} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">✓ Vérifier les noms</button>}
      </div>}

      <div className={revisionMode && !revisionLegendBelow ? 'mt-3 grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]' : 'mt-5'}>
        {mapSections.length === 0 && (revisionMode || !stagedWorkflow || workflowStage === 'legend') && <label className={`mx-auto mb-3 block max-w-[820px] ${revisionMode ? 'w-full lg:col-span-2' : ''}`}>
          <span className="mb-1 block text-xs font-black uppercase text-slate-500">Titre de la carte</span>
          <input
            value={mapTitle}
            onChange={(event) => setMapTitle(event.target.value)}
            readOnly={revisionMode}
            placeholder="Écris le titre de la carte"
            className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-center text-lg font-black text-slate-900 outline-none focus:border-violet-500"
          />
        </label>}
        <div
          ref={drawingRef}
          className={`relative mx-auto w-full max-w-[820px] touch-none overflow-hidden rounded-2xl border-2 border-slate-400 bg-white ${revisionMode ? 'pointer-events-none cursor-default' : stagedWorkflow && workflowStage !== 'color' ? 'cursor-default' : drawMode === 'fill' || drawMode === 'hatch' ? 'cursor-cell' : drawMode === 'eraser' ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
          onPointerDown={startColoring}
          onPointerMove={continueColoring}
          onPointerUp={endColoring}
          onPointerCancel={endColoring}
          onPointerLeave={(event) => {
            if (event.buttons === 0) endColoring(event);
          }}
        >
          <img
            ref={mapImageRef}
            src={mapUrl}
            alt={mapAlt}
            className={`${mapReady && !repeatBlankPanel ? 'block' : 'hidden'} h-auto w-full select-none`}
            draggable={false}
            onError={() => setMapReady(false)}
          />
          {mapReady && repeatBlankPanel && (
            <div className="grid aspect-[1946/768] w-full grid-cols-3 bg-white" aria-label={mapAlt}>
              {[0, 1, 2].map((panel) => (
                <div
                  key={`blank-map-panel-${panel}`}
                  className="h-full w-full bg-no-repeat"
                  style={{
                    backgroundImage: `url(${mapUrl})`,
                    backgroundSize: '300% 100%',
                    backgroundPosition: 'left top'
                  }}
                />
              ))}
            </div>
          )}
          {[...fills].filter((fill) => fill?.image
            && (revisionMode || !fill?.expectedOnly)
            && fill?.pattern !== 'hatch'
            && !(isOrgUeRevision && String(fill?.color).toLowerCase() === '#dc2626')).sort((left, right) => {
            const layer = (fill) => fill?.background ? -1 : (fill?.pattern === 'hatch' ? 1 : 0);
            return layer(left) - layer(right);
          }).map((fill) => (
            <img
              key={fill.id}
              src={fill.image}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full select-none"
              draggable={false}
            />
          ))}
          {!mapReady && (
            <div className="flex aspect-[487/473] items-center justify-center bg-slate-50 p-8 text-center text-sm font-black text-slate-400">
              Image de carte attendue : {mapUrl}
            </div>
          )}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              {pencils.map((item) => (
                <marker
                  key={`arrowhead_${item.key}`}
                  id={`dnb-repartition-arrow-${item.key}`}
                  markerWidth="4.5"
                  markerHeight="4.5"
                  refX="4"
                  refY="2.25"
                  orient="auto"
                  markerUnits="userSpaceOnUse"
                >
                  <path d="M 0 0 L 4.5 2.25 L 0 4.5 z" fill={item.color} />
                </marker>
              ))}
            </defs>
            {drawMode === 'define-map' && [...mapRectangles, ...(currentMapRectangle ? [{
              key: 'current',
              label: mapSections[mapRectangles.length]?.label || 'Nouvelle carte',
              x: Math.min(currentMapRectangle.startX, currentMapRectangle.endX),
              y: Math.min(currentMapRectangle.startY, currentMapRectangle.endY),
              width: Math.abs(currentMapRectangle.endX - currentMapRectangle.startX),
              height: Math.abs(currentMapRectangle.endY - currentMapRectangle.startY)
            }] : [])].map((rectangle, index) => (
              <g key={`map-rectangle-${rectangle.key || index}`} className="pointer-events-none">
                <rect
                  x={rectangle.x}
                  y={rectangle.y}
                  width={rectangle.width}
                  height={rectangle.height}
                  fill="rgba(245, 158, 11, 0.06)"
                  stroke="#f59e0b"
                  strokeWidth="0.35"
                  strokeDasharray="1 0.7"
                />
                <text x={rectangle.x + 0.6} y={rectangle.y + 2.2} fontSize="1.6" fontWeight="900" fill="#92400e">
                  {rectangle.label}
                </text>
              </g>
            ))}
            {fills.filter((fill) => fill?.svgPath && !fill?.expectedOnly).map((fill) => (
              <path
                key={`vector-${fill.id}`}
                d={fill.svgPath}
                fill={fill.color}
                fillOpacity={fill.opacity ?? 0.62}
                stroke={fill.stroke || 'none'}
                strokeWidth={fill.strokeWidth || 0}
              />
            ))}
            {visiblePaths.map((path) => (
              <path
                key={path.id}
                d={pathToD(path.points)}
                fill="none"
                stroke={isOrgUeRevision && String(path.color).toLowerCase() === '#dc2626' ? '#ef5b78' : path.color}
                strokeWidth={path.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={path.type === 'dashed' ? '1.2 1' : undefined}
                opacity={uniformColors ? 1 : (path.opacity || (path.pencilKey === 'red' || path.color === '#ef2020' ? 0.82 : 0.52))}
                markerEnd={path.type === 'arrow' ? `url(#dnb-repartition-arrow-${path.pencilKey || 'red'})` : undefined}
              />
            ))}
            {fills.filter((fill) => !fill?.expectedOnly).flatMap((fill) => (fill?.svgCircles || []).map((circle, index) => (
              <ellipse
                key={`circle-${fill.id}-${index}`}
                cx={circle.x}
                cy={circle.y}
                rx={smallRoundPoints && fill.pattern === 'point' ? 0.64 : (circle.rx ?? Number(circle.r || 1) * 0.4)}
                ry={smallRoundPoints && fill.pattern === 'point' ? 0.9 : (circle.ry ?? circle.r)}
                fill={fill.color}
                fillOpacity={fill.opacity ?? 0.9}
                stroke={circle.stroke || '#ffffff'}
                strokeWidth={circle.strokeWidth || 0.3}
              />
            )))}
            {fills.filter((fill) => !fill?.expectedOnly).flatMap((fill) => (fill?.svgRectangles || []).map((rectangle, index) => (
              <rect
                key={`symbol-rectangle-${fill.id}-${index}`}
                x={rectangle.x}
                y={rectangle.y}
                width={rectangle.width}
                height={rectangle.height}
                fill={fill.color}
                stroke="#ffffff"
                strokeWidth="0.2"
              />
            )))}
            {fills.filter((fill) => !fill?.expectedOnly).flatMap((fill) => (fill?.svgStars || []).map((star, index) => {
              const outerY = Number(star.r || 1.8);
              const outerX = outerY * 0.55;
              const points = Array.from({ length: 10 }, (_, pointIndex) => {
                const radiusX = pointIndex % 2 === 0 ? outerX : outerX * 0.42;
                const radiusY = pointIndex % 2 === 0 ? outerY : outerY * 0.42;
                const angle = -Math.PI / 2 + pointIndex * Math.PI / 5;
                return `${star.x + Math.cos(angle) * radiusX},${star.y + Math.sin(angle) * radiusY}`;
              }).join(' ');
              return <polygon key={`symbol-star-${fill.id}-${index}`} points={points} fill={fill.color} stroke="#111827" strokeWidth="0.25" />;
            }))}
          </svg>
          {fills.filter((fill) => fill?.image && fill?.pattern === 'hatch' && (revisionMode || !fill?.expectedOnly)).map((fill) => (
            <img
              key={`top-hatch-${fill.id}`}
              src={fill.image}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-30 h-full w-full select-none"
              style={String(fill.color).toLowerCase() === '#38bdf8' ? { filter: 'saturate(2.5) contrast(1.15)' } : undefined}
              draggable={false}
            />
          ))}
          {allowPointLabels && (revisionMode || !stagedWorkflow || workflowStage === 'names') && fills.filter((fill) => !fill?.expectedOnly && (fill?.pattern === 'point' || fill?.pattern === 'star')).flatMap((fill) => {
            const symbols = fill.pattern === 'star' ? (fill.svgStars || []) : (fill.svgCircles || []);
            return symbols.map((symbol, index) => {
            const answer = fill.answer || '';
            const isCorrect = checkedPointLabels && normalizeAnswer(answer) === normalizeAnswer(fill.expectedName || '');
            const isWrong = checkedPointLabels && !isCorrect;
            const isActive = activePointLabelId === fill.id;
            const isCompleted = !editPointLabels && !checkedPointLabels && answer.trim() && !isActive;
            return <div
              key={`point-label-${fill.id}-${index}`}
              className={`absolute z-40 flex items-center rounded-md border-2 transition-colors ${revisionMode ? 'border-transparent bg-white/45 shadow-none' : editPointLabels ? `cursor-move bg-white/95 shadow ${fill.pattern === 'star' ? 'border-blue-500' : 'border-amber-400'}` : isCompleted ? 'border-transparent bg-transparent shadow-none' : `bg-white/95 shadow ${isCorrect ? 'border-emerald-500' : isWrong ? 'border-red-500' : fill.pattern === 'star' ? 'border-blue-300' : 'border-amber-300'}`}`}
              style={{ left: `${fill.labelX ?? symbol.x + 1.1}%`, top: `${fill.labelY ?? symbol.y - 2}%`, width: `${isOrgUeRevision && fill.pattern === 'star' ? Math.min(Number(fill.labelWidth || 9), 8) : (fill.labelWidth || 10)}%`, height: `${isOrgUeRevision && fill.pattern === 'star' ? Math.min(Number(fill.labelHeight || 2.6), 2.4) : (fill.labelHeight || 4)}%` }}
              onPointerDown={(event) => editPointLabels ? startPointLabelDrag(event, fill, 'move') : event.stopPropagation()}
              onPointerMove={(event) => { if (editPointLabels) movePointLabel(event); }}
              onPointerUp={(event) => { if (draggingPointLabel) { event.stopPropagation(); setDraggingPointLabel(null); } }}
              onPointerCancel={() => setDraggingPointLabel(null)}
            >
              {revisionMode ? <span className={`w-full whitespace-nowrap px-0.5 text-center font-black leading-none ${fill.pattern === 'star' ? 'text-[clamp(6px,0.7vw,9px)] text-blue-800' : 'text-[clamp(7px,0.8vw,10px)] text-slate-900'}`} title={fill.expectedName}>{fill.expectedName || answer}</span> : editPointLabels ? <>
                <button type="button" data-resize-handle onPointerDown={(event) => startPointLabelDrag(event, fill, 'resize')} className={`absolute left-0 top-0 z-10 flex h-3.5 w-3.5 -translate-x-1/3 -translate-y-1/3 cursor-nw-resize items-center justify-center rounded-full border bg-white text-[7px] font-black shadow ${fill.pattern === 'star' ? 'border-blue-500 text-blue-700' : 'border-amber-500 text-amber-700'}`} title="Tirer pour redimensionner">↖</button>
                <span className={`min-w-0 flex-1 truncate text-center font-black ${fill.pattern === 'star' ? 'px-1 text-[8px] leading-none text-blue-700' : 'px-2 text-[10px] text-amber-800'}`} title={fill.expectedName}>{fill.expectedName}</span>
              </> : <input
                value={revisionMode ? (fill.expectedName || answer) : answer}
                onChange={(event) => {
                  setCheckedPointLabels(false);
                  setFills((previous) => previous.map((item) => item.id === fill.id ? { ...item, answer: event.target.value } : item));
                }}
                onPointerDown={(event) => event.stopPropagation()}
                onFocus={() => setActivePointLabelId(fill.id)}
                onBlur={() => setActivePointLabelId('')}
                onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                placeholder={fill.pattern === 'star' ? 'Institution' : 'Nom de la ville'}
                className={`h-full w-full rounded-md px-1.5 text-center text-[clamp(8px,1vw,11px)] font-black text-slate-800 outline-none transition-colors ${isCompleted ? 'bg-transparent' : 'bg-white/95'}`}
              />}
              {isWrong && <div className="mt-0.5 rounded bg-white/95 px-1 py-0.5 text-[9px] font-black text-red-600">{fill.expectedName}</div>}
            </div>;
          });})}
          {revisionMode && mapUrl === DNB_GEO_ESPACESP_MAP_URL && fills.filter((fill) => !fill?.expectedOnly && fill?.pattern === 'square').flatMap((fill) => fill.svgRectangles || []).map((rectangle, index) => (
            <span
              key={`industrial-city-${index}`}
              className="absolute z-30 whitespace-nowrap rounded bg-white/95 px-1.5 py-0.5 text-[clamp(8px,1vw,11px)] font-black text-slate-900 shadow"
              style={{ left: `${Number(rectangle.x || 0) + Number(rectangle.width || 0) + 0.5}%`, top: `${Number(rectangle.y || 0) - 0.3}%` }}
            >
              {index === 0 ? 'Paris' : 'Lyon'}
            </span>
          ))}
          {mapSections.length > 0 && effectiveMapSections.map((section) => (
            <input
              key={`map-title-${section.key}`}
              value={mapTitles[section.key] || (revisionMode ? DNB_ESPACESP_REVISION_TITLES[section.key] || section.label : '')}
              onChange={(event) => setMapTitles((previous) => ({ ...previous, [section.key]: event.target.value }))}
              onPointerDown={(event) => {
                event.stopPropagation();
                setActiveMapSection(section.key);
              }}
              onFocus={() => setActiveMapSection(section.key)}
              readOnly={activeMapSection !== section.key}
              placeholder={activeMapSection === section.key ? 'Titre de cette carte' : ''}
              className={`absolute z-30 rounded-md border bg-white/95 px-2 py-0.5 text-center text-[clamp(8px,1vw,11px)] font-black leading-tight outline-none ${activeMapSection === section.key ? 'border-violet-500 text-slate-900 shadow' : 'border-transparent text-slate-700'}`}
              style={{
                left: `${section.minX + 3}%`,
                top: `${Math.max(0.2, (section.minY ?? 0) - 3.2)}%`,
                width: `${Math.max(10, section.maxX - section.minX - 6)}%`
              }}
            />
          ))}
          {showCentralLabel && <input
            value={centralLabel}
            onChange={(event) => setCentralLabel(event.target.value)}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerMove={(event) => event.stopPropagation()}
            placeholder="Nom de cet espace"
            className="absolute left-[49%] top-[55%] z-20 w-[25%] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-amber-500/70 bg-white/85 px-2 py-2 text-center text-[clamp(9px,1.5vw,14px)] font-black text-slate-800 shadow-sm outline-none focus:border-violet-500"
          />}
        </div>
        {(revisionMode || !stagedWorkflow || workflowStage === 'legend') && (mapSections.length === 0 ? <div className={`mx-auto max-w-[820px] rounded-2xl border-2 border-slate-300 bg-white p-4 ${revisionMode ? 'pointer-events-none mt-0 w-full text-sm' : 'mt-4'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black uppercase text-slate-700">Légende</div>
            {!revisionMode && <button
              type="button"
              onClick={addRepartitionLegendItem}
              className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-black text-violet-700"
            >
              + Ajouter l’outil sélectionné
            </button>}
          </div>
          <div className="mt-3 space-y-2">
            {isOrgUeRevision && <div className="grid grid-cols-3 gap-3">
              {['center', 'peripheries', 'axes'].map((groupKey) => <div key={`org-legend-${groupKey}`} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="mb-2 text-[11px] font-black text-slate-800">{DNB_ORG_UE_REVISION_GROUP_TITLES[groupKey]}</div>
                <div className="space-y-1.5">{displayedLegendItems.filter((item) => orgUeGroupKey(item) === groupKey).map((item) => <div key={`org-item-${item.id}`} className="flex items-center gap-2 rounded-lg bg-white p-1.5">
                  {item.pattern === 'point' ? <span className="mx-1 h-4 w-4 shrink-0 rounded-full bg-red-600" />
                    : item.pattern === 'star' ? <span className="w-7 shrink-0 text-center text-xl font-black text-yellow-300" style={{ WebkitTextStroke: '1px #111827' }}>★</span>
                      : item.pattern === 'dashed' ? <span className="w-7 shrink-0 border-t-4 border-dashed border-slate-900" />
                        : item.pattern === 'line' ? <span className="h-1 w-7 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                          : <span className="h-5 w-7 shrink-0 rounded border border-slate-300" style={{ backgroundColor: item.color }} />}
                  <span className="min-w-0 text-[10px] font-bold leading-tight text-slate-800">{revisionLegendLabel(item)}</span>
                </div>)}</div>
              </div>)}
            </div>}
            {!isOrgUeRevision && displayedLegendItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {(index === 0 || legendGroupKeyForItem(item) !== legendGroupKeyForItem(displayedLegendItems[index - 1])) && (
                  <input
                    value={legendGroupTitles[legendGroupKeyForItem(item)] || (isOrgUeRevision ? DNB_ORG_UE_REVISION_GROUP_TITLES[legendGroupKeyForItem(item)] || '' : '')}
                    onChange={(event) => {
                      const groupKey = legendGroupKeyForItem(item);
                      setLegendGroupTitles((previous) => ({ ...previous, [groupKey]: event.target.value }));
                    }}
                    placeholder="Titre de la sous-légende"
                    className="mt-4 w-full rounded-xl border-2 border-slate-300 bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 outline-none focus:border-violet-500"
                  />
                )}
              <div className="flex items-center gap-3">
                {item.pattern === 'arrow' ? (
                  <span className="w-10 text-center text-3xl font-black leading-none" style={{ color: item.color }}>➜</span>
                ) : item.pattern === 'point' ? (
                  <span className="mx-3 h-5 w-5 shrink-0 rounded-full border border-white shadow" style={{ backgroundColor: item.color }} />
                ) : item.pattern === 'star' ? (
                  <span className="w-10 text-center text-3xl font-black leading-none text-yellow-300" style={{ WebkitTextStroke: '1px #111827' }}>★</span>
                ) : item.pattern === 'dashed' ? (
                  <span className="w-10 border-t-4 border-dashed" style={{ borderColor: item.color }} />
                ) : item.pattern === 'line' ? (
                  <span className="h-1 w-10 rounded-full" style={{ backgroundColor: item.color }} />
                ) : (
                  <span
                    className="h-7 w-10 shrink-0 rounded border border-slate-300"
                    style={{
                      background: item.pattern === 'hatch'
                        ? `repeating-linear-gradient(135deg, transparent 0 5px, ${item.color} 5px 8px)`
                        : item.color
                    }}
                  />
                )}
                <input
                  value={revisionMode ? revisionLegendLabel(item) : item.label}
                  onChange={(event) => setLegendItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))}
                  placeholder="Signification dans la légende"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold outline-none focus:border-violet-500"
                />
                {showDensityInputs && item.pattern === 'solid' && (
                  revisionMode ? (
                    null
                  ) : (
                    <label className="w-20 shrink-0 text-center text-[8px] font-bold leading-tight text-slate-400">
                      <input
                        value={item.density || ''}
                        onChange={(event) => setLegendItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, density: event.target.value } : entry))}
                        placeholder="facultatif"
                        className="mb-1 w-full rounded-lg border border-slate-300 px-1.5 py-1 text-center text-[10px] font-bold text-slate-700 outline-none placeholder:text-[9px] focus:border-violet-500"
                      />
                      hab/km² · optionnel
                    </label>
                  )
                )}
                {!revisionMode && <button
                  type="button"
                  onClick={() => setLegendItems((previous) => previous.filter((entry) => entry.id !== item.id))}
                  className="rounded-lg bg-red-50 px-3 py-2 font-black text-red-500"
                  title="Supprimer cet élément de légende"
                >
                  ✕
                </button>}
              </div>
              </React.Fragment>
            ))}
            {revisionMode && showDensityInputs && <div className="pt-1 text-right text-[8px] font-bold text-slate-400">Densités en hab/km² : optionnelles</div>}
            {displayedLegendItems.length === 0 && <div className="text-sm font-bold text-slate-400">Sélectionne une couleur et un outil, puis ajoute-le à la légende.</div>}
          </div>
        </div> : (
          <div className="mx-auto mt-4 grid max-w-[820px] grid-cols-3 gap-2">
            {mapSections.map((section) => {
              const sectionItems = legendItemsForSection(section.key);
              const isActive = activeMapSection === section.key;
              return (
                <div
                  key={`map-legend-${section.key}`}
                  onClick={() => setActiveMapSection(section.key)}
                  className={`min-w-0 rounded-2xl border-2 bg-white p-3 transition ${revisionMode ? 'border-slate-300' : isActive ? 'border-violet-500 shadow-md' : 'border-slate-200 opacity-75'}`}
                >
                  <input
                    value={legendGroupTitles[section.key] || (revisionMode ? DNB_ESPACESP_REVISION_TITLES[section.key] || section.label : '')}
                    onChange={(event) => setLegendGroupTitles((previous) => ({ ...previous, [section.key]: event.target.value }))}
                    readOnly={revisionMode || !isActive}
                    placeholder={isActive ? 'Titre de la légende' : section.label}
                    className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-center text-xs font-black outline-none focus:border-violet-500"
                  />
                  <div className="mt-2 space-y-2">
                    {sectionItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2">
                        {item.pattern === 'point' ? (
                          <span className="mx-2 h-4 w-4 shrink-0 rounded-full border border-white shadow" style={{ backgroundColor: item.color }} />
                        ) : (
                          <span
                            className={`shrink-0 ${item.pattern === 'line' ? 'h-1 w-7 rounded-full' : 'h-5 w-7 rounded border border-slate-300'}`}
                            style={{
                              background: item.pattern === 'hatch'
                                ? `repeating-linear-gradient(135deg, transparent 0 4px, ${item.color} 4px 7px)`
                                : item.color
                            }}
                          />
                        )}
                        <input
                          value={revisionMode ? revisionLegendLabel(item) : (item.label || '')}
                          onChange={(event) => setLegendItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))}
                          readOnly={revisionMode || !isActive}
                          placeholder={isActive ? 'Légende' : ''}
                          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-[11px] font-bold outline-none focus:border-violet-500"
                        />
                      </div>
                    ))}
                    {sectionItems.length === 0 && <div className="py-2 text-center text-[10px] font-bold text-slate-400">La légende apparaîtra ici.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function DnbRegionsPointGame({ revisionMode = false }) {
  const boardRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [defining, setDefining] = useState(false);
  const [dragId, setDragId] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let local = null;
    try { local = JSON.parse(window.localStorage.getItem(DNB_GEO_REGIONS_DRAFT_KEY) || 'null'); } catch (_) {}
    if (Array.isArray(local?.markers)) { setMarkers(local.markers); return undefined; }
    fetch(DNB_GEO_REGIONS_DRAFT_URL)
      .then((response) => response.ok ? response.json() : { markers: [] })
      .then((draft) => { if (!cancelled) setMarkers(Array.isArray(draft?.markers) ? draft.markers : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(DNB_GEO_REGIONS_DRAFT_KEY, JSON.stringify({ markers })); } catch (_) {}
  }, [markers]);

  const point = (event) => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? {
      x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)),
      y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100))
    } : null;
  };
  const place = (event) => {
    if (!defining || event.target.closest('[data-region-marker]')) return;
    const p = point(event); if (!p) return;
    setMarkers((previous) => [...previous, {
      id: `region-marker-${Date.now()}`,
      number: previous.length + 1,
      x: +p.x.toFixed(2),
      y: +p.y.toFixed(2),
      expectedName: inferRegionName(p.x, p.y),
      answer: ''
    }]);
  };
  const move = (event) => {
    if (!dragId) return;
    const p = point(event); if (!p) return;
    setMarkers((previous) => previous.map((marker) => marker.id === dragId ? {
      ...marker,
      x: +p.x.toFixed(2),
      y: +p.y.toFixed(2),
      expectedName: inferRegionName(p.x, p.y)
    } : marker));
  };
  const copy = async () => {
    const payload = JSON.stringify({ markers }, null, 2);
    try { await navigator.clipboard.writeText(payload); window.alert('Sauvegarde des régions copiée.'); }
    catch (_) { window.prompt('Copie la sauvegarde :', payload); }
  };
  const displayedMarkers = revisionMode
    ? DNB_REGIONS_POSITIONS.map((region, index) => {
      const adjusted = region.name === 'Normandie' ? { x: 35.2, y: 22.2 }
        : region.name === 'Île-de-France' ? { x: 55.8, y: 28.4 }
          : region;
      return { id: `region-revision-${region.name}`, number: index + 1, x: adjusted.x, y: adjusted.y, expectedName: region.name, answer: region.name };
    })
    : markers;

  return <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-emerald-600">Repères DNB · France</div><div className="text-2xl font-black">Les régions françaises</div></div>
      {!revisionMode && <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setDefining(true); setChecked(false); }} className={`rounded-xl px-4 py-3 text-xs font-black ${defining ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}>Placer les champs</button>
        <button type="button" onClick={() => setDefining(false)} className="rounded-xl bg-blue-100 px-4 py-3 text-xs font-black text-blue-700">Terminer</button>
        <button type="button" onClick={() => setMarkers((previous) => previous.slice(0, -1))} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white">↶ Annuler</button>
        <button type="button" onClick={copy} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">Copier sauvegarde</button>
        {!defining && markers.length > 0 && <button type="button" onClick={() => setChecked(true)} className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">Vérifier</button>}
      </div>}
    </div>
    <div ref={boardRef} onClick={place} onPointerMove={move} onPointerUp={() => setDragId('')} onPointerCancel={() => setDragId('')} className={`relative mx-auto mt-4 overflow-hidden rounded-2xl border-2 border-slate-300 ${revisionMode ? 'pointer-events-none max-w-[680px]' : 'max-w-[900px]'} ${defining ? 'cursor-crosshair' : ''}`}>
      <img src={DNB_GEO_REGIONS_MAP_URL} alt="Carte muette des régions françaises" draggable={false} className="block w-full select-none" />
      {displayedMarkers.map((marker) => {
        const answer = marker.answer || '';
        const isCorrect = checked && normalizeAnswer(answer) === normalizeAnswer(marker.expectedName);
        const isWrong = checked && !isCorrect;
        return <div key={marker.id} data-region-marker onPointerDown={(event) => {
        if (!defining) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragId(marker.id);
      }} className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 p-0.5 shadow-md ${revisionMode ? 'w-[102px] border-emerald-700 bg-emerald-600' : 'w-[145px] bg-white'} ${defining ? 'cursor-move border-amber-500' : isCorrect ? 'border-emerald-500' : isWrong ? 'border-red-500' : 'border-slate-300'}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} title={defining ? 'Glisser pour déplacer' : undefined}>
          {revisionMode ? <div className="px-0.5 py-1 text-center text-[11px] font-black leading-[1.05] text-white">{marker.expectedName}</div> : defining ? <div className="px-1.5 py-1.5 text-center text-[10px] font-black leading-tight text-amber-800">{marker.expectedName}</div> : <input value={answer} onChange={(event) => {
            setChecked(false);
            setMarkers((previous) => previous.map((item) => item.id === marker.id ? { ...item, answer: event.target.value } : item));
          }} onPointerDown={(event) => event.stopPropagation()} placeholder="Nom de la région" className="w-full rounded-md border-0 bg-white px-1.5 py-1.5 text-center text-[11px] font-bold leading-tight text-slate-800 outline-none" />}
          {isWrong && <div className="px-1 pb-1 text-center text-[10px] font-black text-red-600">Réponse : {marker.expectedName}</div>}
        </div>;
      })}
    </div>
  </section>;
}

function DnbUeNumberGame({ revisionMode = false }) {
  const boardRef = useRef(null);
  const [markers, setMarkers] = useState([]);
  const [masks, setMasks] = useState([]);
  const [defining, setDefining] = useState(false);
  const [placementTool, setPlacementTool] = useState('number');
  const [dragId, setDragId] = useState('');

  useEffect(() => {
    let cancelled = false;
    let local = null;
    try { local = JSON.parse(window.localStorage.getItem(DNB_GEO_UE_DRAFT_KEY) || 'null'); } catch (_) {}
    if (Array.isArray(local?.markers)) { setMarkers(local.markers); setMasks(Array.isArray(local?.masks) ? local.masks : []); return undefined; }
    fetch(DNB_GEO_UE_DRAFT_URL).then((response) => response.ok ? response.json() : { markers: [] }).then((draft) => {
      if (!cancelled) { setMarkers(Array.isArray(draft?.markers) ? draft.markers : []); setMasks(Array.isArray(draft?.masks) ? draft.masks : []); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(DNB_GEO_UE_DRAFT_KEY, JSON.stringify({ markers, masks })); } catch (_) {}
  }, [markers, masks]);
  const point = (event) => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? { x: Math.max(0, Math.min(100, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)) } : null;
  };
  const place = (event) => {
    if (!defining || event.target.closest('[data-ue-marker]')) return;
    const p = point(event); if (!p) return;
    if (placementTool === 'mask') {
      setMasks((previous) => [...previous, { id: `ue-mask-${Date.now()}`, x: +p.x.toFixed(2), y: +p.y.toFixed(2) }]);
      return;
    }
    setMarkers((previous) => [...previous, { id: `ue-marker-${Date.now()}`, number: previous.length + 1, x: +p.x.toFixed(2), y: +p.y.toFixed(2), expectedName: inferUeCountry(p.x, p.y), answer: '' }]);
  };
  const move = (event) => {
    if (!dragId) return; const p = point(event); if (!p) return;
    setMarkers((previous) => previous.map((marker) => marker.id === dragId ? { ...marker, x: +p.x.toFixed(2), y: +p.y.toFixed(2), expectedName: inferUeCountry(p.x, p.y) } : marker));
  };
  const copy = async () => {
    const payload = JSON.stringify({ markers, masks }, null, 2);
    try { await navigator.clipboard.writeText(payload); window.alert('Sauvegarde UE copiée.'); } catch (_) { window.prompt('Copie la sauvegarde :', payload); }
  };
  const displayedMarkers = revisionMode
    ? DNB_UE_COUNTRY_POSITIONS.map(({ name, x, y }, index) => ({ id: `ue-revision-${name}`, number: index + 1, x, y, expectedName: name, answer: name }))
    : markers;
  return <section className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[11px] font-black uppercase text-blue-600">Repères DNB · Europe</div><div className="text-2xl font-black">Pays de l’Union européenne</div></div>{!revisionMode && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setDefining(true); setPlacementTool('number'); }} className={`rounded-xl px-4 py-3 text-xs font-black ${defining && placementTool === 'number' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}>Placer les numéros</button><button type="button" onClick={() => { setDefining(true); setPlacementTool('mask'); }} className={`rounded-xl px-4 py-3 text-xs font-black ${defining && placementTool === 'mask' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>⚪ Masquer un repère</button><button type="button" onClick={() => setDefining(false)} className="rounded-xl bg-blue-100 px-4 py-3 text-xs font-black text-blue-700">Terminer</button><button type="button" onClick={() => placementTool === 'mask' ? setMasks((p) => p.slice(0,-1)) : setMarkers((p) => p.slice(0,-1))} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white">↶ Annuler</button><button type="button" onClick={copy} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">Copier sauvegarde</button></div>}</div>
    <div ref={boardRef} onClick={place} onPointerMove={move} onPointerUp={() => setDragId('')} onPointerCancel={() => setDragId('')} className={`relative mx-auto mt-4 max-w-[900px] overflow-hidden rounded-2xl border-2 border-slate-300 ${defining ? 'cursor-crosshair' : ''}`}>
      <img src={DNB_GEO_UE_MAP_URL} alt="Carte de l’Union européenne" draggable={false} className="block w-full select-none" />
      {masks.length > 0 && <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-2 rounded-full border border-orange-300 bg-white/95 px-3 py-2 text-[11px] font-black uppercase text-orange-700 shadow"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Optionnel</div>}
      {masks.map((mask) => <button key={mask.id} type="button" data-ue-marker onClick={(event) => { event.stopPropagation(); if (defining && placementTool === 'mask') setMasks((previous) => previous.filter((item) => item.id !== mask.id)); }} className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm ${defining ? 'border-2 border-dashed border-slate-400' : 'border border-orange-200'}`} style={{left:`${mask.x}%`,top:`${mask.y}%`}} title={defining ? 'Cliquer pour supprimer ce masque' : 'Repère optionnel'}><span className="h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" /></button>)}
      {displayedMarkers.map((marker) => <div key={marker.id} data-ue-marker onPointerDown={(event) => { if (!defining || revisionMode) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); setDragId(marker.id); }} className={`absolute -translate-x-1/2 -translate-y-1/2 ${revisionMode ? 'z-10' : ''}`} style={{left:`${marker.x}%`,top:`${marker.y}%`}} title={defining ? marker.expectedName : undefined}><span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-blue-600 bg-white text-xs font-black text-blue-700 shadow">{marker.number}</span>{revisionMode && <span className="absolute left-5 top-4 whitespace-nowrap rounded-md border border-blue-200 bg-white/95 px-2 py-1 text-[11px] font-black text-slate-800 shadow">{marker.expectedName}</span>}</div>)}
    </div>
    {masks.length > 0 && <div className="mx-auto mt-4 flex max-w-[900px] items-center gap-3 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 text-orange-900"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow"><span className="h-3 w-3 rounded-full bg-orange-500" /></span><div><div className="text-sm font-black uppercase">Repères optionnels</div><div className="text-xs font-bold">Les points orange sont facultatifs. Les numéros bleus correspondent aux 12 pays obligatoires à connaître.</div></div></div>}
    <div className="mx-auto mt-4 grid max-w-[900px] gap-2 sm:grid-cols-2 md:grid-cols-3">{displayedMarkers.map((marker) => <div key={`legend-${marker.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{marker.number}</span>{revisionMode || defining ? <span className="text-xs font-black text-slate-700">{marker.expectedName}</span> : <input value={marker.answer || ''} onChange={(event) => setMarkers((previous) => previous.map((item) => item.id === marker.id ? {...item,answer:event.target.value} : item))} placeholder="Nom du pays" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold outline-none" />}</div>)}</div>
  </section>;
}

function DnbDromComLabelGame({ revisionMode = false }) {
  const boardRef = useRef(null);
  const [slots, setSlots] = useState([]);
  const [defining, setDefining] = useState(false);
  const [mapReady, setMapReady] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [draggingSlot, setDraggingSlot] = useState(null);
  const [classification, setClassification] = useState({});
  const [classificationPassed, setClassificationPassed] = useState(false);
  const [classificationChecked, setClassificationChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let localDraft = null;
    try {
      localDraft = JSON.parse(window.localStorage.getItem(DNB_GEO_DROMCOM_DRAFT_KEY) || 'null');
    } catch (_) {}
    if (Array.isArray(localDraft?.slots)) {
      setSlots(localDraft.slots.map((slot) => ({
        ...slot,
        expectedName: slot.expectedName || inferDromComName(Number(slot.x || 0) + Number(slot.width || 17) / 2, Number(slot.y || 0) + Number(slot.height || 6) / 2)
      })));
      setDraftReady(true);
      return () => { cancelled = true; };
    }
    fetch(DNB_GEO_DROMCOM_DRAFT_URL)
      .then((response) => response.ok ? response.json() : { slots: [] })
      .then((draft) => {
        if (!cancelled) setSlots(Array.isArray(draft?.slots) ? draft.slots.map((slot) => ({
          ...slot,
          expectedName: slot.expectedName || inferDromComName(Number(slot.x || 0) + Number(slot.width || 17) / 2, Number(slot.y || 0) + Number(slot.height || 6) / 2)
        })) : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDraftReady(true);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      window.localStorage.setItem(DNB_GEO_DROMCOM_DRAFT_KEY, JSON.stringify({ slots }));
    } catch (error) {
      console.warn('Sauvegarde locale DROM-COM impossible.', error);
    }
  }, [draftReady, slots]);

  const territoryNames = [...new Set(slots.map((slot) => slot.expectedName).filter((name) => DNB_DROMCOM_CATEGORIES[name]))];

  useEffect(() => {
    setClassification((previous) => {
      const next = { ...previous };
      territoryNames.forEach((name) => {
        if (!next[name]) next[name] = 'bank';
      });
      return next;
    });
  }, [territoryNames.join('|')]);

  const dropTerritory = (event, category) => {
    event.preventDefault();
    const name = event.dataTransfer.getData('text/dromcom-name');
    if (!name || !DNB_DROMCOM_CATEGORIES[name]) return;
    setClassification((previous) => ({ ...previous, [name]: category }));
    setClassificationChecked(false);
  };

  const checkClassification = () => {
    const complete = territoryNames.length === Object.keys(DNB_DROMCOM_CATEGORIES).length
      && territoryNames.every((name) => classification[name] === DNB_DROMCOM_CATEGORIES[name]);
    setClassificationChecked(true);
    if (complete) setClassificationPassed(true);
  };

  const placeSlot = (event) => {
    if (!defining) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    setSlots((previous) => [...previous, {
      id: `dromcom-slot-${Date.now()}`,
      x: Number(Math.max(0, Math.min(83, x - 8.5)).toFixed(2)),
      y: Number(Math.max(0, Math.min(94, y - 3)).toFixed(2)),
      width: 17,
      height: 6,
      answer: '',
      expectedName: inferDromComName(x, y)
    }]);
  };

  const startSlotDrag = (event, slot) => {
    if (!defining || event.target.closest('button') || event.target.closest('[data-resize-handle]')) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    setDraggingSlot({ id: slot.id, mode: 'move', offsetX: pointerX - slot.x, offsetY: pointerY - slot.y });
  };

  const startSlotResize = (event, slot) => {
    if (!defining) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDraggingSlot({
      id: slot.id,
      mode: 'resize',
      right: Number(slot.x || 0) + Number(slot.width || 17),
      bottom: Number(slot.y || 0) + Number(slot.height || 6)
    });
  };

  const moveSlot = (event) => {
    if (!draggingSlot || !defining) return;
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pointerX = ((event.clientX - rect.left) / rect.width) * 100;
    const pointerY = ((event.clientY - rect.top) / rect.height) * 100;
    setSlots((previous) => previous.map((slot) => {
      if (slot.id !== draggingSlot.id) return slot;
      if (draggingSlot.mode === 'resize') {
        const nextX = Math.max(0, Math.min(draggingSlot.right - 8, pointerX));
        const nextY = Math.max(0, Math.min(draggingSlot.bottom - 3.5, pointerY));
        return {
          ...slot,
          x: Number(nextX.toFixed(2)),
          y: Number(nextY.toFixed(2)),
          width: Number((draggingSlot.right - nextX).toFixed(2)),
          height: Number((draggingSlot.bottom - nextY).toFixed(2))
        };
      }
      return {
        ...slot,
        x: Number(Math.max(0, Math.min(100 - Number(slot.width || 17), pointerX - draggingSlot.offsetX)).toFixed(2)),
        y: Number(Math.max(0, Math.min(100 - Number(slot.height || 6), pointerY - draggingSlot.offsetY)).toFixed(2))
      };
    }));
  };

  const endSlotDrag = (event) => {
    if (!draggingSlot) return;
    setDraggingSlot(null);
  };

  const copyDraft = async () => {
    const payload = JSON.stringify({ slots }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      window.alert('Sauvegarde DROM-COM copiée.');
    } catch (_) {
      window.prompt('Copie la sauvegarde :', payload);
    }
  };

  if (revisionMode) {
    const dromNames = Object.entries(DNB_DROMCOM_CATEGORIES).filter(([, category]) => category === 'drom').map(([name]) => name);
    const comNames = Object.entries(DNB_DROMCOM_CATEGORIES).filter(([, category]) => category === 'com').map(([name]) => name);
    return <section className="rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm">
      <div className="text-[11px] font-black uppercase text-cyan-600">Correction complète · DROM-COM</div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4"><div className="mb-2 text-sm font-black uppercase text-red-700">DROM</div>{dromNames.map((name) => <div key={name} className="py-1 text-sm font-bold text-slate-800">• {name}</div>)}</div>
        <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50 p-4"><div className="mb-2 text-sm font-black uppercase text-cyan-700">COM</div>{comNames.map((name) => <div key={name} className="py-1 text-sm font-bold text-slate-800">• {name}</div>)}</div>
      </div>
      <div className="relative mx-auto mt-4 max-w-[1000px] overflow-hidden rounded-2xl border-2 border-slate-300 bg-white">
        <img src={DNB_GEO_DROMCOM_MAP_URL} alt="Carte complète des DROM-COM" draggable={false} className="block h-auto w-full select-none" />
        {slots.map((slot) => <div key={`revision-${slot.id}`} className="absolute flex items-center justify-center rounded-md border-2 border-cyan-500 bg-white/95 px-1 text-center text-[clamp(8px,1vw,13px)] font-black text-cyan-800 shadow" style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}>{slot.expectedName}</div>)}
      </div>
    </section>;
  }

  return (
    <section className="rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-cyan-600">Repères DNB · DROM-COM</div>
          <div className="text-2xl font-black text-slate-900">Localise les territoires ultramarins</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDefining((previous) => !previous)}
            className={`rounded-xl px-4 py-3 text-xs font-black ${defining ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}
          >
            ▭ {defining ? 'Terminer le placement' : 'Placer une réponse'}
          </button>
          <button
            type="button"
            onClick={() => setSlots((previous) => previous.slice(0, -1))}
            disabled={slots.length === 0}
            className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            ↶ Annuler
          </button>
          <button
            type="button"
            onClick={copyDraft}
            disabled={slots.length === 0}
            className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white disabled:opacity-40"
          >
            Copier sauvegarde
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-cyan-50 p-3 text-sm font-bold text-cyan-800">
        {defining
          ? `Clique sur chaque nom à masquer. ${slots.length} case${slots.length > 1 ? 's' : ''} placée${slots.length > 1 ? 's' : ''}.`
          : classificationPassed ? 'Clique dans une case blanche et écris le nom du territoire.' : 'Classe d’abord les territoires dans la bonne catégorie.'}
      </div>
      {!classificationPassed && !defining ? (
        <div className="mt-4 rounded-3xl border-2 border-cyan-200 bg-slate-50 p-5">
          <div className="text-center text-lg font-black text-slate-900">Glisse chaque territoire dans DROM ou COM</div>
          <div
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => dropTerritory(event, 'bank')}
            className="mt-4 flex min-h-[72px] flex-wrap justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-3"
          >
            {territoryNames.filter((name) => (classification[name] || 'bank') === 'bank').sort().map((name) => (
              <div
                key={name}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/dromcom-name', name)}
                className="cursor-grab rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 shadow-sm active:cursor-grabbing"
              >
                {name}
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {[
              { key: 'drom', title: 'DROM', subtitle: 'Départements et régions d’outre-mer', color: 'red' },
              { key: 'com', title: 'COM', subtitle: 'Collectivités d’outre-mer', color: 'cyan' }
            ].map((category) => (
              <div
                key={category.key}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => dropTerritory(event, category.key)}
                className={`min-h-[190px] rounded-2xl border-2 border-dashed bg-white p-4 ${category.key === 'drom' ? 'border-red-300' : 'border-cyan-300'}`}
              >
                <div className={`text-center text-xl font-black ${category.key === 'drom' ? 'text-red-600' : 'text-cyan-700'}`}>{category.title}</div>
                <div className="mb-3 text-center text-xs font-bold text-slate-400">{category.subtitle}</div>
                <div className="flex flex-wrap justify-center gap-2">
                  {territoryNames.filter((name) => classification[name] === category.key).map((name) => (
                    <div
                      key={name}
                      draggable
                      onDragStart={(event) => event.dataTransfer.setData('text/dromcom-name', name)}
                      className={`cursor-grab rounded-xl px-3 py-2 text-sm font-black shadow-sm ${category.key === 'drom' ? 'bg-red-50 text-red-700' : 'bg-cyan-50 text-cyan-800'}`}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {classificationChecked && (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-center text-sm font-black text-red-600">
              Certaines réponses sont incorrectes. Replace les territoires puis réessaie.
            </div>
          )}
          <button
            type="button"
            onClick={checkClassification}
            disabled={territoryNames.length < Object.keys(DNB_DROMCOM_CATEGORIES).length || territoryNames.some((name) => !classification[name] || classification[name] === 'bank')}
            className="mx-auto mt-4 block rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white disabled:opacity-40"
          >
            Valider le classement et ouvrir la carte
          </button>
        </div>
      ) : (
      <div
        ref={boardRef}
        onClick={placeSlot}
        onPointerMove={moveSlot}
        onPointerUp={endSlotDrag}
        onPointerCancel={endSlotDrag}
        className={`relative mx-auto mt-4 max-w-[1000px] overflow-hidden rounded-2xl border-2 border-slate-300 bg-white ${defining ? 'cursor-crosshair' : ''}`}
      >
        <img
          src={DNB_GEO_DROMCOM_MAP_URL}
          alt="Carte des DROM-COM"
          draggable={false}
          className={`${mapReady ? 'block' : 'hidden'} h-auto w-full select-none`}
          onError={() => setMapReady(false)}
        />
        {slots.map((slot, index) => (
          <div
            key={slot.id}
            className={`absolute flex items-center rounded-md border-2 bg-white shadow ${defining ? 'border-amber-400' : 'border-slate-300'}`}
            style={{ left: `${slot.x}%`, top: `${slot.y}%`, width: `${slot.width}%`, height: `${slot.height}%` }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => startSlotDrag(event, slot)}
          >
            {defining ? (
              <>
                <button
                  type="button"
                  data-resize-handle
                  onPointerDown={(event) => startSlotResize(event, slot)}
                  className="absolute left-0 top-0 z-10 flex h-5 w-5 -translate-x-1/3 -translate-y-1/3 cursor-nw-resize items-center justify-center rounded-full border border-amber-500 bg-white text-[10px] font-black text-amber-700 shadow"
                  title="Tirer pour redimensionner"
                >
                  ↖
                </button>
                <span className="min-w-0 flex-1 truncate pl-4 pr-1 text-center text-[10px] font-black text-amber-700" title={slot.expectedName || `Case ${index + 1}`}>
                  {slot.expectedName || `Case ${index + 1}`}
                </span>
                <button
                  type="button"
                  onClick={() => setSlots((previous) => previous.filter((item) => item.id !== slot.id))}
                  className="mr-1 rounded bg-red-50 px-1.5 py-1 text-xs font-black text-red-500"
                >
                  ✕
                </button>
              </>
            ) : (
              <input
                value={slot.answer || ''}
                onChange={(event) => setSlots((previous) => previous.map((item) => item.id === slot.id ? { ...item, answer: event.target.value } : item))}
                placeholder="Nom"
                className="h-full w-full rounded-md bg-white px-2 text-center text-[clamp(9px,1.3vw,15px)] font-black text-slate-800 outline-none"
              />
            )}
          </div>
        ))}
      </div>
      )}
    </section>
  );
}

function DnbGeoTerritoryDrawingGame({ revisionMode = false }) {
  const drawingRef = useRef(null);
  const [tool, setTool] = useState('mountain');
  const [mapReady, setMapReady] = useState(true);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [labels, setLabels] = useState([]);
  const [draggingLabelId, setDraggingLabelId] = useState('');
  const [editModel, setEditModel] = useState(revisionMode);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const [activeLabelId, setActiveLabelId] = useState('');
  const draftLoadedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetch(DNB_GEO_TERRITORY_DRAFT_URL)
      .then((response) => response.ok ? response.json() : null)
      .then((draft) => {
        if (cancelled) return;
        if (draft && Array.isArray(draft.paths)) {
          setPaths(draft.paths);
          setLabels(Array.isArray(draft.labels) ? draft.labels : []);
        }
        draftLoadedRef.current = true;
      })
      .catch(() => {
        draftLoadedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!draftLoadedRef.current || !editModel || revisionMode) return;
    try {
      window.localStorage.setItem(DNB_GEO_TERRITORY_DRAFT_KEY, JSON.stringify({ paths, labels }));
    } catch (error) {
      console.warn('Sauvegarde locale du territoire impossible : quota atteint.', error);
    }
  }, [editModel, paths, labels, revisionMode]);

  const pointerToPercent = (event) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Number(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2)),
      y: Number(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2))
    };
  };

  const startDraw = (event) => {
    const point = pointerToPercent(event);
    if (!point) return;
    setCurrentPath({ id: `path-${Date.now()}`, tool, points: [point] });
  };

  const moveDraw = (event) => {
    if (!currentPath) return;
    const point = pointerToPercent(event);
    if (!point) return;
    setCurrentPath((prev) => prev ? { ...prev, points: [...prev.points, point] } : prev);
  };

  const endDraw = () => {
    if (!currentPath) return;
    if (currentPath.points.length > 1) setPaths((prev) => [...prev, currentPath]);
    setCurrentPath(null);
  };

  const addLabel = (kind) => {
    const text = window.prompt(kind === 'mountainName' ? 'Nom du massif ?' : kind === 'riverName' ? 'Nom du fleuve ?' : 'Nom de la mer ou de l’océan ?', '');
    const cleanText = String(text || '').trim();
    if (!cleanText) return;
    setLabels((prev) => [...prev, { id: `label-${Date.now()}`, text: cleanText, kind, x: 50, y: 50 }]);
  };

  const moveLabel = (labelId, clientX, clientY) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Number(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)).toFixed(2));
    const y = Number(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)).toFixed(2));
    setLabels((prev) => prev.map((label) => label.id === labelId ? { ...label, x, y } : label));
  };

  const labelTone = (kind) => {
    if (kind === 'mountainName') return 'border-amber-600 text-amber-800 placeholder:text-amber-700';
    if (kind === 'riverName') return 'border-blue-600 text-blue-800 placeholder:text-blue-700';
    return 'border-sky-400 text-sky-800 placeholder:text-sky-700';
  };

  const labelPlaceholder = (kind) => {
    return '...';
  };

  const selectNearestLabel = (kind, points = []) => {
    if (editModel || points.length === 0) return;
    const center = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    center.x /= points.length;
    center.y /= points.length;
    const candidates = labels.filter((label) => label.kind === kind);
    const nearest = candidates
      .map((label) => ({ label, distance: Math.hypot(label.x - center.x, label.y - center.y) }))
      .sort((a, b) => a.distance - b.distance)[0]?.label;
    if (nearest) setActiveLabelId(nearest.id);
  };

  const copyDraft = async () => {
    const payload = JSON.stringify({ paths, labels }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      window.alert('Dessin copié.');
    } catch {
      window.alert(payload);
    }
  };

  const pathToD = (points) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const allPaths = currentPath ? [...paths, currentPath] : paths;
  const goodAnswers = labels.filter((label) => normalizeAnswer(answers[label.id]) === normalizeAnswer(label.text)).length;

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Partie 2 · Géo</div>
          <div className="text-2xl font-black text-slate-900">{revisionMode ? 'Carte complète du territoire français' : 'Complète les repères du territoire'}</div>
        </div>
        {!revisionMode && <div className="flex flex-wrap gap-2">
          {!editModel && (
            <button
              type="button"
              onClick={() => setChecked(true)}
              className="rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white"
            >
              Valider
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditModel((value) => !value)}
            className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700"
          >
            {editModel ? 'Tester élève' : 'Modifier le modèle'}
          </button>
          {editModel && (
            <>
              {[
                { key: 'mountain', label: 'Crayon montagnes' },
                { key: 'river', label: 'Trait fleuves' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setTool(item.key)}
                  className={`rounded-2xl px-4 py-3 text-xs font-black ${tool === item.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700'}`}
                >
                  {item.label}
                </button>
              ))}
              <button type="button" onClick={() => addLabel('riverName')} className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white">+ Nom fleuve</button>
              <button type="button" onClick={() => addLabel('mountainName')} className="rounded-2xl bg-amber-700 px-4 py-3 text-xs font-black text-white">+ Nom massif</button>
              <button type="button" onClick={() => addLabel('seaName')} className="rounded-2xl bg-sky-300 px-4 py-3 text-xs font-black text-sky-950">+ Nom mer/océan</button>
              <button
                type="button"
                onClick={() => {
                  if (labels.length > 0 && paths.length === 0) setLabels((prev) => prev.slice(0, -1));
                  else setPaths((prev) => prev.slice(0, -1));
                  setCurrentPath(null);
                }}
                className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white"
              >
                Effacer dernière action
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm('Tout effacer sur cette carte ?')) return;
                  setPaths([]);
                  setLabels([]);
                  setCurrentPath(null);
                  if (typeof window !== 'undefined') window.localStorage.removeItem(DNB_GEO_TERRITORY_DRAFT_KEY);
                }}
                className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-600"
              >
                Tout effacer
              </button>
              <button type="button" onClick={copyDraft} className="rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-black text-emerald-700">Copier sauvegarde</button>
            </>
          )}
        </div>}
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        {revisionMode ? 'Observe les fleuves en bleu, les massifs en brun et mémorise tous les noms avant l’entraînement.' : editModel
          ? 'Mode modèle : ajuste les tracés et les bulles, puis copie la sauvegarde.'
          : `Écris les noms dans les bulles placées sur la carte. ${checked ? `${goodAnswers}/${labels.length} bonnes réponses.` : ''}`}
      </div>
      <div className="mt-5">
        <div
          ref={drawingRef}
          className={`relative mx-auto max-w-[760px] touch-none overflow-hidden rounded-2xl border-2 border-slate-400 bg-white ${revisionMode ? 'pointer-events-none' : ''}`}
          onPointerDown={(event) => {
            if (editModel && !draggingLabelId) startDraw(event);
            if (!editModel) setActiveLabelId('');
          }}
          onPointerMove={(event) => {
            if (draggingLabelId) moveLabel(draggingLabelId, event.clientX, event.clientY);
            else if (editModel) moveDraw(event);
          }}
          onPointerUp={() => {
            setDraggingLabelId('');
            endDraw();
          }}
          onPointerLeave={() => {
            setDraggingLabelId('');
            endDraw();
          }}
        >
          <img
            src={DNB_GEO_TERRITORY_MAP_URL}
            alt="Carte muette du territoire français"
            className={`${mapReady ? 'block' : 'hidden'} h-auto w-full select-none`}
            draggable={false}
            onError={() => setMapReady(false)}
          />
          {!mapReady && (
            <div className="flex aspect-[383/487] items-center justify-center bg-slate-50 p-8 text-center text-sm font-black text-slate-400">
              Image de carte attendue : /dnb-territoire-france.png
            </div>
          )}
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            {allPaths.map((path) => (
              <path
                key={path.id}
                d={pathToD(path.points)}
                fill="none"
                stroke={path.tool === 'river' ? '#2563eb' : '#92400e'}
                strokeWidth={path.tool === 'river' ? 0.65 : 1.1}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={path.tool === 'river' ? 0.9 : 0.55}
                className={editModel ? '' : 'cursor-pointer'}
                style={{ pointerEvents: editModel ? 'none' : 'stroke' }}
                onClick={(event) => {
                  event.stopPropagation();
                  selectNearestLabel(path.tool === 'river' ? 'riverName' : 'mountainName', path.points);
                }}
              />
            ))}
          </svg>
          {labels.map((label) => {
            const answer = answers[label.id] || '';
            const isGood = normalizeAnswer(answer) === normalizeAnswer(label.text);
            if (!editModel) {
              const isActive = activeLabelId === label.id;
              return (
                <div
                  key={label.id}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-4 bg-white/95 shadow ${checked ? (isGood ? 'border-emerald-500 text-emerald-700 placeholder:text-emerald-700' : 'border-red-500 text-red-600 placeholder:text-red-500') : labelTone(label.kind)} ${isActive ? 'z-20 px-3 py-2' : 'z-10 px-2 py-1'}`}
                  style={{ left: `${label.x}%`, top: `${label.y}%` }}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActiveLabelId(label.id);
                  }}
                >
                  {isActive ? (
                    <>
                      <input
                        autoFocus
                        value={answer}
                        onChange={(event) => {
                          setAnswers((prev) => ({ ...prev, [label.id]: event.target.value }));
                          setChecked(false);
                        }}
                        className={`w-32 bg-transparent text-center text-xs font-black outline-none ${labelTone(label.kind)}`}
                        placeholder={labelPlaceholder(label.kind)}
                      />
                      {checked && !isGood && (
                        <div className="mt-1 text-center text-[10px] font-black text-red-600">{label.text}</div>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      className={`min-w-20 bg-transparent text-center text-[10px] font-black uppercase outline-none ${labelTone(label.kind)}`}
                    >
                      {answers[label.id] || labelPlaceholder(label.kind)}
                    </button>
                  )}
                </div>
              );
            }
            return (
              <button
                key={label.id}
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  setDraggingLabelId(label.id);
                  moveLabel(label.id, event.clientX, event.clientY);
                }}
                onPointerMove={(event) => {
                  if (draggingLabelId === label.id) {
                    event.stopPropagation();
                    moveLabel(label.id, event.clientX, event.clientY);
                  }
                }}
                onPointerUp={(event) => {
                  event.stopPropagation();
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                  setDraggingLabelId('');
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (event.altKey) setLabels((prev) => prev.filter((item) => item.id !== label.id));
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border-4 bg-white/95 px-3 py-2 text-xs font-black shadow ${labelTone(label.kind)}`}
                style={{ left: `${label.x}%`, top: `${label.y}%` }}
                title="Glisser pour déplacer. Alt+clic pour supprimer."
              >
                {label.text}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const URBAN_AREA_LEGEND = [
  { key: 'center', label: 'ville centre', color: '#ff2a1f', expected: 'ville centre' },
  { key: 'suburbs', label: 'banlieues', color: '#fb923c', expected: 'banlieues' },
  { key: 'periurban', label: 'zone périurbaine', color: '#fde68a', expected: 'zone periurbaine' },
  { key: 'rural', label: 'espace rural', color: '#b9cf32', expected: 'espace rural' },
  { key: 'sprawl', label: 'étalement urbain', color: '#ef4444', expected: 'etalement urbain' },
  { key: 'commute', label: 'mobilités pendulaires', color: '#2563eb', expected: 'mobilites pendulaires' }
];

function DnbUrbanAreaSchemaGame({ revisionMode = false }) {
  const [circles, setCircles] = useState(() => revisionMode ? [
    { key: 'center', cx: 50, cy: 37.5, rx: 11, ry: 7, fill: '#ff2a1f' },
    { key: 'suburbs', cx: 50, cy: 37.5, rx: 21, ry: 13, fill: '#fb923c' },
    { key: 'periurban', cx: 50, cy: 37.5, rx: 34, ry: 22, fill: '#fde68a' }
  ] : []);
  const [arrows, setArrows] = useState(() => revisionMode ? [
    { id: 'revision-sprawl-1', type: 'sprawl', x1: 35, y1: 28, x2: 17, y2: 15 },
    { id: 'revision-sprawl-2', type: 'sprawl', x1: 65, y1: 28, x2: 84, y2: 16 },
    { id: 'revision-sprawl-3', type: 'sprawl', x1: 35, y1: 48, x2: 17, y2: 64 },
    { id: 'revision-sprawl-4', type: 'sprawl', x1: 65, y1: 48, x2: 85, y2: 64 },
    { id: 'revision-commute-1', type: 'double', x1: 24, y1: 37.5, x2: 43, y2: 37.5 },
    { id: 'revision-commute-2', type: 'double', x1: 57, y1: 37.5, x2: 76, y2: 37.5 }
  ] : []);
  const [answers, setAnswers] = useState(() => revisionMode ? Object.fromEntries(URBAN_AREA_LEGEND.map((item) => [item.key, item.expected])) : {});
  const [checked, setChecked] = useState(false);
  const [activeDrag, setActiveDrag] = useState(null);
  const [actions, setActions] = useState([]);
  const dragRef = useRef(null);
  const nextCircle = circles.length;
  const visibleLegendKeys = new Set([
    ...(circles.length >= 1 ? ['center'] : []),
    ...(circles.length >= 2 ? ['suburbs'] : []),
    ...(circles.length >= 3 ? ['periurban', 'rural'] : []),
    ...(arrows.some((arrow) => arrow.type === 'sprawl') ? ['sprawl'] : []),
    ...(arrows.some((arrow) => arrow.type === 'double') ? ['commute'] : [])
  ]);
  const visibleLegend = revisionMode ? URBAN_AREA_LEGEND : URBAN_AREA_LEGEND.filter((item) => visibleLegendKeys.has(item.key));
  const goodLegend = visibleLegend.filter((item) => normalizeAnswer(answers[item.key]) === normalizeAnswer(item.expected)).length;
  const sortedCircles = [...circles].sort((a, b) => a.rx - b.rx);
  const hasNestedCircles = sortedCircles.length === 3
    && sortedCircles[0].rx < sortedCircles[1].rx
    && sortedCircles[1].rx < sortedCircles[2].rx
    && sortedCircles[0].ry < sortedCircles[1].ry
    && sortedCircles[1].ry < sortedCircles[2].ry
    && sortedCircles.every((circle) => Math.hypot(circle.cx - sortedCircles[0].cx, circle.cy - sortedCircles[0].cy) <= 8)
    && sortedCircles[0].rx <= sortedCircles[1].rx - 4
    && sortedCircles[1].rx <= sortedCircles[2].rx - 4;
  const schemaReady = hasNestedCircles && arrows.some((arrow) => arrow.type === 'sprawl') && arrows.some((arrow) => arrow.type === 'double');

  const addCircle = () => {
    if (circles.length >= 3) return;
    const circleModels = [
      { key: 'center', cx: 32, cy: 31, rx: 11, ry: 7, fill: '#ff2a1f' },
      { key: 'suburbs', cx: 67, cy: 29, rx: 16, ry: 10, fill: '#fb923c' },
      { key: 'periurban', cx: 48, cy: 57, rx: 23, ry: 14, fill: '#fde68a' }
    ];
    const circle = circleModels[circles.length];
    setCircles((prev) => [...prev, circle]);
    setActions((prev) => [...prev, { type: 'circle', id: circle.key }]);
    setChecked(false);
  };

  const addArrow = (type) => {
    const presets = {
      sprawl: [
        { x1: 30, y1: 26, x2: 17, y2: 15 },
        { x1: 70, y1: 27, x2: 84, y2: 17 },
        { x1: 31, y1: 57, x2: 17, y2: 68 },
        { x1: 69, y1: 56, x2: 87, y2: 65 }
      ],
      double: [
        { x1: 47, y1: 42, x2: 62, y2: 15 },
        { x1: 27, y1: 46, x2: 43, y2: 46 },
        { x1: 57, y1: 46, x2: 73, y2: 46 },
        { x1: 50, y1: 54, x2: 50, y2: 30 }
      ]
    };
    const existing = arrows.filter((arrow) => arrow.type === type).length;
    const preset = presets[type][existing % presets[type].length];
    const arrow = { id: `arrow-${Date.now()}-${arrows.length}`, type, ...preset };
    setArrows((prev) => [...prev, arrow]);
    setActions((prev) => [...prev, { type: 'arrow', id: arrow.id }]);
    setChecked(false);
  };

  const removeLast = () => {
    const last = actions[actions.length - 1];
    if (!last) return;
    if (last.type === 'arrow') setArrows((prev) => prev.filter((arrow) => arrow.id !== last.id));
    if (last.type === 'circle') setCircles((prev) => prev.filter((circle) => circle.key !== last.id));
    setActions((prev) => prev.slice(0, -1));
    setChecked(false);
  };

  const moveArrow = (event) => {
    if (!activeDrag || !dragRef.current) return;
    const rect = dragRef.current.getBoundingClientRect();
    const x = Number(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2));
    const y = Number(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2));
    if (activeDrag.kind === 'circle') {
      setCircles((prev) => prev.map((circle) => {
        if (circle.key !== activeDrag.id) return circle;
        if (activeDrag.handle === 'resize') {
          return {
            ...circle,
            rx: Number(Math.max(5, Math.min(42, Math.abs(x - circle.cx))).toFixed(2)),
            ry: Number(Math.max(3, Math.min(28, Math.abs(y - circle.cy))).toFixed(2))
          };
        }
        return { ...circle, cx: x, cy: y };
      }));
      return;
    }
    setArrows((prev) => prev.map((arrow) => {
      if (arrow.id !== activeDrag.id) return arrow;
      const dx = x - arrow[activeDrag.handle === 'start' ? 'x1' : 'x2'];
      const dy = y - arrow[activeDrag.handle === 'start' ? 'y1' : 'y2'];
      if (activeDrag.handle === 'body') return { ...arrow, x1: arrow.x1 + dx, y1: arrow.y1 + dy, x2: arrow.x2 + dx, y2: arrow.y2 + dy };
      return activeDrag.handle === 'start' ? { ...arrow, x1: x, y1: y } : { ...arrow, x2: x, y2: y };
    }));
  };

  const arrowStroke = (type) => type === 'double' ? '#2563eb' : '#ef4444';
  const arrowMarker = (type, end) => type === 'double' || (type === 'sprawl' && end === 'end');

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Partie 2 · Géo</div>
          <div className="text-2xl font-black text-slate-900">Schéma d’une aire urbaine</div>
        </div>
        {!revisionMode && <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addCircle} disabled={nextCircle >= 3} className="rounded-2xl bg-red-500 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Cercles</button>
          <button type="button" onClick={() => addArrow('sprawl')} className="rounded-2xl bg-red-500 px-4 py-3 text-xs font-black text-white">Étalement urbain</button>
          <button type="button" onClick={() => addArrow('double')} className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white">Mobilités pendulaires</button>
          <button type="button" onClick={removeLast} className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">Effacer dernier</button>
          <button type="button" onClick={() => setChecked(true)} className="rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white">Valider</button>
        </div>}
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        {revisionMode ? 'Observe les trois espaces emboîtés et les deux types de flux, puis mémorise la légende.' : 'Place les trois espaces, ajoute les flux, puis complète la légende qui apparaît sous le schéma.'}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div
          ref={dragRef}
          className={`relative aspect-[4/3] overflow-hidden rounded-3xl border-2 border-slate-200 bg-[#b9cf32] ${revisionMode ? 'pointer-events-none' : ''}`}
          onPointerMove={moveArrow}
          onPointerUp={() => setActiveDrag(null)}
          onPointerLeave={() => setActiveDrag(null)}
        >
          <svg className="h-full w-full" viewBox="0 0 100 75">
            <defs>
              <marker id="urban-arrow-red" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L6,3 L0,6 Z" fill="#ef4444" />
              </marker>
              <marker id="urban-arrow-red-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M6,0 L0,3 L6,6 Z" fill="#ef4444" />
              </marker>
              <marker id="urban-arrow-blue" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L6,3 L0,6 Z" fill="#2563eb" />
              </marker>
              <marker id="urban-arrow-blue-start" markerWidth="8" markerHeight="8" refX="0" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M6,0 L0,3 L6,6 Z" fill="#2563eb" />
              </marker>
            </defs>
            {circles.slice().reverse().map((circle) => (
              <g key={circle.key}>
                <ellipse
                  cx={circle.cx}
                  cy={circle.cy}
                  rx={circle.rx}
                  ry={circle.ry}
                  fill={circle.fill}
                  opacity={0.9}
                  stroke={checked && !hasNestedCircles ? '#ef4444' : '#ffffff'}
                  strokeWidth="0.5"
                  className="cursor-move"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setActiveDrag({ kind: 'circle', id: circle.key, handle: 'body' });
                  }}
                />
                {!revisionMode && <circle
                  cx={circle.cx + circle.rx}
                  cy={circle.cy + circle.ry}
                  r="1.7"
                  fill="white"
                  stroke="#111827"
                  strokeWidth="0.45"
                  className="cursor-se-resize"
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setActiveDrag({ kind: 'circle', id: circle.key, handle: 'resize' });
                  }}
                />}
              </g>
            ))}
            {arrows.map((arrow) => {
              const stroke = arrowStroke(arrow.type);
              const markerId = stroke === '#2563eb' ? 'urban-arrow-blue' : 'urban-arrow-red';
              const startMarkerId = `${markerId}-start`;
              return (
                <g key={arrow.id}>
                  <line
                    x1={arrow.x1}
                    y1={arrow.y1}
                    x2={arrow.x2}
                    y2={arrow.y2}
                    stroke={stroke}
                    strokeWidth={arrow.type === 'sprawl' ? 1.6 : 1.35}
                    markerStart={arrowMarker(arrow.type, 'start') ? `url(#${startMarkerId})` : undefined}
                    markerEnd={arrowMarker(arrow.type, 'end') ? `url(#${markerId})` : undefined}
                    className="cursor-move"
	                    onPointerDown={(event) => {
	                      event.stopPropagation();
	                      setActiveDrag({ kind: 'arrow', id: arrow.id, handle: 'body' });
	                    }}
                  />
                  {!revisionMode && ['start', 'end'].map((handle) => (
                    <circle
                      key={handle}
                      cx={handle === 'start' ? arrow.x1 : arrow.x2}
                      cy={handle === 'start' ? arrow.y1 : arrow.y2}
                      r="1.6"
                      fill="white"
                      stroke={stroke}
                      strokeWidth="0.5"
                      className="cursor-pointer"
	                      onPointerDown={(event) => {
	                        event.stopPropagation();
	                        setActiveDrag({ kind: 'arrow', id: arrow.id, handle });
	                      }}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-lg font-black text-slate-900">Légende</div>
          <div className="mt-4 space-y-3">
            {visibleLegend.length === 0 && (
              <div className="rounded-2xl bg-white p-4 text-sm font-black text-slate-400">Commence par ajouter les cercles.</div>
            )}
            {visibleLegend.map((item) => {
              const answer = answers[item.key] || '';
              const isGood = normalizeAnswer(answer) === normalizeAnswer(item.expected);
              return (
                <label key={item.key} className="flex items-center gap-3 rounded-2xl bg-white p-3">
                  <span className="h-7 w-12 rounded-lg border border-slate-200" style={{ background: item.color }} />
                  {revisionMode ? <span className="min-w-0 flex-1 text-sm font-black text-slate-900">{item.label}</span> : <input
                      value={answer}
                      onChange={(event) => {
                        setAnswers((prev) => ({ ...prev, [item.key]: event.target.value }));
                        setChecked(false);
                      }}
                      className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm font-black outline-none ${checked ? (isGood ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-600') : 'border-slate-200 text-slate-900'}`}
                      placeholder="..."
                    />}
                </label>
              );
            })}
          </div>
          {checked && (
            <div className={`mt-4 rounded-2xl bg-white p-4 text-sm font-black ${schemaReady && goodLegend === visibleLegend.length ? 'text-emerald-700' : 'text-red-600'}`}>
              Schéma : {schemaReady ? 'structure correcte' : 'les 3 cercles doivent être emboîtés et les flèches placées'}<br />
              Légende : {goodLegend}/{visibleLegend.length}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function DnbChapterFolders({ user, sectionFilter = 'full', onOpenChapter }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedKey, setExpandedKey] = useState('');

  useEffect(() => {
    const studentId = String(user?._id || user?.id || '').trim();
    const studentClass = String(user?.currentClass || user?.className || '').trim();
    const studentClassKey = normalizeClassKey(studentClass);
    const studentLevel = normalizeLevel(studentClass);
    if (!studentId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/eleve/homework/list/${studentId}`)
      .then((res) => res.ok ? res.json() : [])
      .then(async (data) => {
        if (cancelled) return;
        const homeworks = Array.isArray(data) ? data : [];
        const dnbHomeworks = homeworks.filter((hw) => String(hw.assessmentKind || '') === 'dnb');
        const teacherIds = [...new Set(dnbHomeworks.map((hw) => String(hw.teacherId || '').trim()).filter(Boolean))];
        let chapters = [];
        if (teacherIds.length > 0) {
          const chapterResults = await Promise.all(teacherIds.map((teacherId) =>
            fetch(`/api/structure/chapters?teacherId=${encodeURIComponent(teacherId)}&classContext=${encodeURIComponent(user?.currentClass || user?.className || '')}`)
              .then((res) => res.ok ? res.json() : [])
              .catch(() => [])
          ));
          chapters = chapterResults.flat().filter(Boolean);
        }

        const dnbCountByChapterAndSubject = new Map();
        dnbHomeworks.forEach((hw) => {
          const chapterId = String(hw.chapterId || '').trim();
          if (!chapterId) return;
          const subjects = [...new Set((hw.levels || [])
            .filter((lvl) => sectionFilter === 'full' || String(lvl.dnbSection || 'docs') === String(sectionFilter))
            .map((lvl) => String(lvl.dnbSubject || 'histoire'))
            .filter((subject) => sectionFilter === 'emc' ? subject === 'emc' : ['histoire', 'geo'].includes(subject)))];
          subjects.forEach((subject) => {
            const key = `${subject}:${chapterId}`;
            dnbCountByChapterAndSubject.set(key, (dnbCountByChapterAndSubject.get(key) || 0) + 1);
          });
        });

        const chapterRows = chapters
          .map((chapter) => {
            const sectionRaw = String(chapter.section || '').toUpperCase();
            const title = String(chapter.title || '').trim();
            const subject = sectionRaw.includes('EMC') ? 'emc' : (sectionRaw.includes('GEO') ? 'geo' : (sectionRaw.includes('HIST') ? 'histoire' : ''));
            if (!subject) return null;
            if (['DNB', 'GÉNÉRAL', 'GENERAL'].includes(title.toUpperCase())) return null;
            if (sectionFilter === 'emc' && subject !== 'emc') return null;
            if (sectionFilter !== 'emc' && subject === 'emc') return null;
            if (chapter.isArchived === true) return null;
            if (Array.isArray(chapter.hiddenIn) && chapter.hiddenIn.some((cls) => normalizeClassKey(cls) === studentClassKey)) return null;
            const chapterClassKey = normalizeClassKey(chapter.classroom || '');
            const chapterLevel = normalizeLevel(chapter.sharedLevel || '');
            const matchesCurrentClass = chapterClassKey && chapterClassKey === studentClassKey;
            const matchesCurrentLevel = chapterLevel && chapterLevel === studentLevel;
            if (!matchesCurrentClass && !matchesCurrentLevel) return null;
            const chapterId = String(chapter._id || '').trim();
            return {
              key: `${subject}:${chapterId}`,
              subject,
              chapterId,
              title,
              section: String(chapter.section || '').trim(),
              count: dnbCountByChapterAndSubject.get(`${subject}:${chapterId}`) || 0
            };
          })
          .filter(Boolean);

        const groups = new Map();
        dnbHomeworks
          .forEach((hw) => {
            const subjects = [...new Set((hw.levels || [])
              .filter((lvl) => sectionFilter === 'full' || String(lvl.dnbSection || 'docs') === String(sectionFilter))
              .map((lvl) => String(lvl.dnbSubject || 'histoire'))
              .filter((subject) => sectionFilter === 'emc' ? subject === 'emc' : ['histoire', 'geo'].includes(subject)))];
            subjects.forEach((subject) => {
              const chapterId = String(hw.chapterId || '').trim() || `title:${hw.chapterTitle || hw.title || 'DNB'}`;
              const key = `${subject}:${chapterId}`;
              const previous = groups.get(key) || {
                key,
                subject,
                chapterId: String(hw.chapterId || '').trim(),
                title: String(hw.chapterTitle || hw.title || 'DNB').trim(),
                section: String(hw.chapterSection || '').trim(),
                itemIds: new Set()
              };
              previous.itemIds.add(String(hw._id || ''));
              groups.set(key, previous);
            });
          });
        const fallbackRows = [...groups.values()].map((group) => ({
          ...group,
          count: group.itemIds.size
        })).filter((group) => !['DNB', 'GÉNÉRAL', 'GENERAL', 'EMC'].includes(String(group.title || '').toUpperCase()));

	        const finalRows = chapterRows.length > 0 ? chapterRows : fallbackRows;
	        setRows(finalRows
	          .map((row) => ({
	            ...row,
	            count: row.count + (sectionFilter === 'paragraphe' && hasLocalDnbParagraphActivities(row) ? DNB_PARAGRAPH_LOCAL_ACTIVITIES.length + DNB_PARAGRAPH_REAL_ACTIVITIES.length : 0)
	          }))
	          .sort((a, b) => a.title.localeCompare(b.title, 'fr')));
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user, sectionFilter]);

  const renderColumn = (subject, label, colorClass) => {
    const items = rows.filter((row) => row.subject === subject);
    const folderTone = subject === 'histoire' ? 'bg-red-500' : (subject === 'emc' ? 'bg-violet-600' : 'bg-emerald-500');
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className={`text-2xl font-black uppercase ${colorClass}`}>{label}</div>
        <div className="mt-3 flex flex-col gap-2">
          {items.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm font-bold text-slate-400">
              Aucun dossier pour l'instant.
            </div>
	          ) : items.map((item) => {
	            const isExpanded = expandedKey === item.key;
	            const itemLevelFilter = {
	              dnbSubject: item.subject,
	              ...(item.chapterId ? { chapterId: item.chapterId } : {}),
	              ...(sectionFilter !== 'full' ? { dnbSection: sectionFilter } : {})
	            };
	            return (
	              <article key={item.key} className="rounded-2xl border border-slate-200 bg-white shadow-sm">
	                <button
	                  type="button"
	                  onClick={() => setExpandedKey((key) => key === item.key ? '' : item.key)}
	                  className="w-full rounded-2xl p-3 text-left transition hover:border-violet-200 hover:bg-slate-50"
	                >
	                  <div className="flex items-center gap-3">
	                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${folderTone}`}>
	                      📁
	                    </div>
	                    <div className="min-w-0 flex-1">
	                      <div className="truncate text-sm font-black text-slate-900">{item.title}</div>
	                      <div className="mt-0.5 text-[11px] font-black text-slate-400">{item.count} élément{item.count > 1 ? 's' : ''}</div>
	                    </div>
	                    <div className="text-lg font-black text-slate-300">{isExpanded ? '⌃' : '⌄'}</div>
	                  </div>
	                </button>
	                {isExpanded && (
	                  <div className="border-t border-slate-100 px-3 pb-3 pt-2">
	                    {sectionFilter === 'paragraphe' && hasLocalDnbParagraphActivities(item) ? (
	                      <DnbLocalParagraphActivities selectedActivity="" onSelectActivity={() => {}} user={user} />
	                    ) : (
	                      <HomeworkList
	                        user={user}
	                        assessmentKinds={['dnb']}
	                        levelFilter={itemLevelFilter}
	                        compact
	                        titleOverride={sectionFilter === 'docs' ? 'Brevet blanc académie Amiens 2000' : ''}
	                        emptyTitle="Aucun entraînement publié dans ce chapitre pour l'instant."
	                      />
	                    )}
	                  </div>
	                )}
	              </article>
	            );
	          })}
          {loading && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-5 text-sm font-black text-slate-400">
              Chargement...
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`mx-4 grid gap-4 ${sectionFilter === 'emc' ? 'md:grid-cols-1' : ['paragraphe', 'docs'].includes(sectionFilter) ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
      {sectionFilter === 'emc' ? (
        renderColumn('emc', 'EMC', 'text-violet-600')
      ) : (
        <>
          {renderColumn('histoire', 'Histoire', 'text-red-500')}
          {renderColumn('geo', 'Géo', 'text-emerald-600')}
          {(sectionFilter === 'paragraphe' || sectionFilter === 'docs') && <button
            type="button"
            onClick={() => onOpenChapter({
              key: `${sectionFilter}:methodo`,
              subject: sectionFilter === 'docs' ? 'methodo-docs' : 'methodo',
              title: sectionFilter === 'docs' ? 'Méthodologie des documents' : 'Méthodologie du développement construit',
              subjectOnly: true
            })}
            className="rounded-2xl border border-blue-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
          >
            <div className="text-2xl font-black uppercase text-blue-600">Méthodo</div>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-lg">🎓</div>
              <div>
                <div className="text-sm font-black text-slate-900">{sectionFilter === 'docs' ? 'Présenter et décrire' : 'Réussir son paragraphe'}</div>
                <div className="mt-0.5 text-[11px] font-black text-blue-500">{sectionFilter === 'docs' ? 'Vidéos + exercices' : 'Vidéo + fiche méthode'}</div>
              </div>
            </div>
          </button>}
        </>
      )}
    </div>
  );
}

function DnbReperesSubjectFolders({ onOpenSubject }) {
  const subjects = [
    { subject: 'histoire', title: 'Histoire', color: 'text-red-500', bg: 'bg-red-500', hint: 'Dates, périodes, repères historiques' },
    { subject: 'geo', title: 'Géo', color: 'text-emerald-600', bg: 'bg-emerald-500', hint: 'Cartes, localisations, repères géographiques' }
  ];
  return (
    <div className="mx-4 grid gap-4 md:grid-cols-2">
      {subjects.map((item) => (
        <button
          key={item.subject}
          type="button"
          onClick={() => onOpenSubject({
            key: `reperes:${item.subject}`,
            subject: item.subject,
            title: item.title,
            subjectOnly: true
          })}
          className="rounded-3xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:shadow-md hover:border-violet-200 transition"
        >
          <div className={`text-4xl font-black uppercase ${item.color}`}>{item.title}</div>
          <div className="mt-5 flex items-center gap-4">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl ${item.bg}`}>📁</div>
            <div>
              <div className="text-lg font-black text-slate-900">Tous les repères</div>
              <div className="text-xs font-black text-slate-400 mt-1">{item.hint}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

const DNB_DOC_METHOD_DB = 'condaweb-dnb-method-images';
const DNB_DOC_METHOD_STORE = 'images';

const openDnbMethodImageDb = () => new Promise((resolve, reject) => {
  const request = window.indexedDB.open(DNB_DOC_METHOD_DB, 1);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(DNB_DOC_METHOD_STORE)) db.createObjectStore(DNB_DOC_METHOD_STORE);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const saveDnbMethodImage = async (key, file) => {
  const db = await openDnbMethodImageDb();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(DNB_DOC_METHOD_STORE, 'readwrite');
    transaction.objectStore(DNB_DOC_METHOD_STORE).put(file, key);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
};

const loadDnbMethodImage = async (key) => {
  const db = await openDnbMethodImageDb();
  const blob = await new Promise((resolve, reject) => {
    const request = db.transaction(DNB_DOC_METHOD_STORE, 'readonly').objectStore(DNB_DOC_METHOD_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return blob;
};

const youtubeEmbedUrl = (url = '') => {
  const value = String(url || '').trim();
  const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  return match ? `https://www.youtube.com/embed/${match[1]}` : value;
};

function DnbDocumentsMethodology({ onBack, user }) {
  const [module, setModule] = useState('home');
  const canCalibrate = user?.isDeveloper === true || user?.isTestAccount === true;
  if (module === 'analysis') return <DnbDocumentAnalysisMethodology onBack={() => setModule('home')} />;
  if (module === 'presentation') return canCalibrate
    ? <DnbDocumentMethodCalibration type="presentation" onBack={() => setModule('home')} />
    : <DnbDocumentMethodReader type="presentation" user={user} onBack={() => setModule('home')} />;
  if (module === 'image') return canCalibrate
    ? <DnbDocumentMethodCalibration type="image" onBack={() => setModule('home')} />
    : <DnbDocumentMethodReader type="image" user={user} onBack={() => setModule('home')} />;
  return <section className="mx-4 rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-cyan-600">Documents · Méthodologie</div><h3 className="m-0 text-2xl font-black text-slate-900">Présenter et décrire un document</h3></div>
      <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">← Retour aux dossiers</button>
    </div>
    <div className="mt-5 grid gap-4 md:grid-cols-3">
      <button type="button" onClick={() => setModule('presentation')} className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-6 text-left transition hover:border-blue-500 hover:shadow-md">
        <div className="text-3xl">📄</div><div className="mt-3 text-xl font-black text-slate-900">Présentation de document</div><div className="mt-2 text-sm font-bold text-blue-800">Date, auteur, nature, sujet et contexte.</div><div className="mt-5 inline-flex rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white">{canCalibrate ? 'Calibrer l’apprentissage' : 'Commencer'}</div>
      </button>
      <button type="button" onClick={() => setModule('image')} className="rounded-3xl border-2 border-emerald-200 bg-emerald-50 p-6 text-left transition hover:border-emerald-500 hover:shadow-md">
        <div className="text-3xl">🖼️</div><div className="mt-3 text-xl font-black text-slate-900">Description d’image</div><div className="mt-2 text-sm font-bold text-emerald-800">Premier plan, deuxième plan et arrière-plan.</div><div className="mt-5 inline-flex rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">{canCalibrate ? 'Calibrer l’apprentissage' : 'Commencer'}</div>
      </button>
      <button type="button" onClick={() => setModule('analysis')} className="rounded-3xl border-2 border-violet-200 bg-violet-50 p-6 text-left transition hover:border-violet-500 hover:shadow-md">
        <div className="text-3xl">🔎</div><div className="mt-3 text-xl font-black text-slate-900">Analyse de documents</div><div className="mt-2 text-sm font-bold text-violet-800">Introduction, citations, explications et conclusion.</div><div className="mt-5 inline-flex rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">Commencer</div>
      </button>
    </div>
  </section>;
}

function DnbDocumentAnalysisMethodology({ onBack }) {
  return <section className="mx-4 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-violet-600">Documents · Méthodologie</div><h3 className="m-0 text-2xl font-black text-slate-900">Analyser un document</h3></div>
      <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">← Retour à la méthodo</button>
    </div>
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
      <div className="overflow-hidden rounded-2xl border-2 border-violet-200 bg-slate-950 shadow-sm">
        <div className="aspect-video">
          <iframe className="h-full w-full" src="https://www.youtube.com/embed/j_zAZ5lKX2s" title="Méthodologie de l’analyse de documents" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
        </div>
      </div>
      <a href="/2d-AnalyseDoc.png" target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border-2 border-violet-200 bg-white shadow-sm" title="Ouvrir la fiche d’analyse de documents en grand">
        <img src="/2d-AnalyseDoc.png" alt="Fiche méthode pour analyser un document" className="block h-auto w-full" />
      </a>
    </div>
    <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm font-bold text-violet-800">Regarde la vidéo, puis utilise la fiche comme guide pour construire ton introduction, ton développement et ta conclusion. Clique sur la fiche pour l’ouvrir en grand.</div>
  </section>;
}

const documentMethodFields = {
  presentation: [
    ['date', 'Date + mots-clés'], ['author', 'Auteur + mots-clés'], ['nature', 'Nature + mots-clés'], ['subject', 'Sujet + mots-clés'], ['context', 'Contexte + mots-clés']
  ],
  image: [
    ['foreground', 'Au premier plan + mots-clés'], ['middleGround', 'Au deuxième plan + mots-clés'], ['background', 'À l’arrière-plan + mots-clés']
  ]
};

const parseExpectedCorrectionRule = (value = '') => {
  const source = String(value || '');
  const quoteSource = '(?:"([^"]*)"|«([^»]*)»|“([^”]*)”)';
  const quoteRegex = /"([^"]*)"|«([^»]*)»|“([^”]*)”/g;
  const chainRegex = new RegExp(`${quoteSource}(?:\\s*=\\s*${quoteSource})+`, 'g');
  const groups = [];
  const chainRanges = [];
  let chainMatch;
  while ((chainMatch = chainRegex.exec(source)) !== null) {
    const alternatives = [];
    const innerRegex = /"([^"]*)"|«([^»]*)»|“([^”]*)”/g;
    let innerMatch;
    while ((innerMatch = innerRegex.exec(chainMatch[0])) !== null) alternatives.push(innerMatch[1] ?? innerMatch[2] ?? innerMatch[3] ?? '');
    groups.push(alternatives.filter(Boolean));
    chainRanges.push({ start: chainMatch.index, end: chainMatch.index + chainMatch[0].length });
  }
  let quoteMatch;
  while ((quoteMatch = quoteRegex.exec(source)) !== null) {
    if (chainRanges.some((range) => quoteMatch.index >= range.start && quoteMatch.index < range.end)) continue;
    const keyword = quoteMatch[1] ?? quoteMatch[2] ?? quoteMatch[3] ?? '';
    if (keyword) groups.push([keyword]);
  }
  const correction = source
    .replace(chainRegex, (chain) => {
      const first = chain.match(/"([^"]*)"|«([^»]*)»|“([^”]*)”/);
      return first ? (first[1] ?? first[2] ?? first[3] ?? '') : chain;
    })
    .replace(quoteRegex, (_match, straight, french, curly) => straight ?? french ?? curly ?? '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return { correction, groups };
};

const normalizeMethodAnswer = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

const methodAnswerMatches = (answer, rule) => {
  const normalized = normalizeMethodAnswer(answer);
  const { groups } = parseExpectedCorrectionRule(rule);
  if (!normalized || groups.length === 0) return false;
  return groups.every((alternatives) => alternatives.some((item) => normalized.includes(normalizeMethodAnswer(item))));
};

function DnbDocumentMethodReader({ type, user, onBack }) {
  const storageKey = `condaweb-dnb-doc-method-${type}-v1`;
  const isImageDescription = type === 'image';
  const fields = documentMethodFields[type];
  const [model] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (stored && Array.isArray(stored.exercises)) {
        if (type === 'presentation') stored.exercises = stored.exercises.map((exercise) => ({ ...exercise, expected: { ...exercise.expected, subject: exercise.expected?.subject || exercise.expected?.source || '' } }));
        return stored;
      }
    } catch (_) {}
    return { videoUrl: '', exercises: [] };
  });
  const [page, setPage] = useState(0);
  const [showLesson, setShowLesson] = useState(true);
  const [showSheet, setShowSheet] = useState(false);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const [exercisePreview, setExercisePreview] = useState('');
  const [sheetPreview, setSheetPreview] = useState('');
  const total = model.exercises.length;
  const exercise = model.exercises[page];
  const lessonVideoUrl = type === 'presentation'
    ? 'https://www.youtube.com/embed/NVh1P8Lbx1A'
    : youtubeEmbedUrl(model.videoUrl);
  const effectiveSheetPreview = sheetPreview || (type === 'presentation' ? '/dnb-danse.png' : '');

  useEffect(() => {
    let cancelled = false;
    let url = '';
    if (!model.sheetKey) return undefined;
    loadDnbMethodImage(model.sheetKey).then((blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      setSheetPreview(url);
    }).catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [model.sheetKey]);

  useEffect(() => {
    let cancelled = false;
    let url = '';
    setExercisePreview('');
    if (!exercise?.imageKey) return undefined;
    loadDnbMethodImage(exercise.imageKey).then((blob) => {
      if (!blob || cancelled) return;
      url = URL.createObjectURL(blob);
      setExercisePreview(url);
    }).catch(() => {});
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [exercise?.imageKey]);

  const reportProgress = (reached) => {
    const studentId = user?._id || user?.id;
    if (!studentId || total === 0) return;
    if (reached >= total) reportTrainingScore(`dnb-doc-method-${type}`, total, total);
    fetch('/api/games/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, gameId: `dnb-doc-method-${type}::${total}`, score: reached >= total ? 100 : 0, levelReached: reached })
    }).catch(() => {});
  };

  const methodSheetModal = showSheet ? <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/70 p-4" onClick={() => setShowSheet(false)}>
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border-2 border-blue-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><div><div className="text-[10px] font-black uppercase text-blue-600">Fiche de méthodologie</div><div className="text-lg font-black text-slate-900">{isImageDescription ? 'Décrire une image' : 'Présenter un document'}</div></div><button type="button" onClick={() => setShowSheet(false)} aria-label="Fermer la fiche" className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl font-black text-slate-700 hover:bg-red-100 hover:text-red-600">×</button></div>
      <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-3">{effectiveSheetPreview ? (sheetPreview && model.sheetMime === 'application/pdf' ? <iframe src={effectiveSheetPreview} title="Fiche de méthodologie" className="h-[78vh] w-full rounded-xl bg-white" /> : <img src={effectiveSheetPreview} alt="Fiche de méthodologie" className="mx-auto block max-w-full rounded-xl bg-white object-contain" />) : <div className="flex min-h-[45vh] items-center justify-center rounded-2xl bg-white p-8 text-center font-bold text-slate-500">La fiche de méthodologie n’a pas encore été ajoutée aux fichiers de l’application.</div>}</div>
    </div>
  </div> : null;

  if (showLesson && type === 'presentation') return <><section className="mx-4 rounded-3xl border border-blue-200 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={onBack} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">← Retour</button><div className="text-center"><div className="text-[10px] font-black uppercase text-blue-600">Apprentissage</div><h3 className="m-0 text-xl font-black text-slate-900">Comment présenter un document ?</h3></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowSheet(true)} className="rounded-xl bg-blue-100 px-4 py-3 text-xs font-black text-blue-700">📘 Consulter la fiche</button><button type="button" onClick={() => setShowLesson(false)} className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">Passer aux exercices →</button></div></div>
    <div className="mt-4 grid min-h-[66vh] gap-4 lg:grid-cols-2">
      <div className="flex flex-col rounded-2xl border-2 border-blue-100 bg-blue-50 p-3"><div className="mb-2 text-center text-xs font-black uppercase text-blue-700">1. Regarde la vidéo</div><div className="flex flex-1 items-center"><div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-950"><iframe className="h-full w-full" src={lessonVideoUrl} title="Présenter un document au DNB" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></div></div>
      <div className="flex min-h-0 flex-col rounded-2xl border-2 border-amber-100 bg-amber-50 p-3"><div className="mb-2 text-center text-xs font-black uppercase text-amber-700">2. Observe le document d’exemple</div><a href="/dnb-presEx.png" target="_blank" rel="noreferrer" className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-white"><img src="/dnb-presEx.png" alt="Document d’exemple à présenter" className="max-h-[62vh] w-full object-contain" /></a></div>
    </div>
  </section>{methodSheetModal}</>;

  if (!total) return <section className="mx-4 rounded-3xl border border-cyan-200 bg-white p-6"><button type="button" onClick={onBack} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black">← Retour</button><div className="mt-5 text-center font-bold text-slate-400">Aucun exercice n’est encore disponible.</div></section>;

  const pageAnswers = answers[exercise.id] || {};
  const pageChecked = checked[exercise.id] || false;
  const correctCount = fields.filter(([key]) => methodAnswerMatches(pageAnswers[key], exercise.expected?.[key])).length;
  const goNext = () => {
    reportProgress(page + 1);
    if (page < total - 1) setPage((value) => value + 1);
    else setPage(total);
  };

  if (page >= total) return <section className="mx-4 flex min-h-[62vh] items-center justify-center rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center"><div><div className="text-6xl">🏁</div><h3 className="mt-4 text-3xl font-black text-slate-900">Parcours terminé</h3><p className="mt-2 font-bold text-emerald-800">Ton professeur peut maintenant voir que tu es allé au bout des {total} exercices.</p><div className="mt-5 flex justify-center gap-3"><button type="button" onClick={() => setPage(0)} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-emerald-700">Recommencer</button><button type="button" onClick={onBack} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white">Terminer</button></div></div></section>;

  return <><section className="mx-4 rounded-3xl border border-cyan-200 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3"><button type="button" onClick={onBack} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">← Retour</button><div className="text-center"><div className="text-[10px] font-black uppercase text-cyan-600">Mode liseuse</div><div className="text-lg font-black text-slate-900">{isImageDescription ? 'Décrire une image' : 'Présenter un document'}</div></div><div className="rounded-xl bg-cyan-50 px-3 py-2 text-xs font-black text-cyan-700">{page + 1}/{total}</div></div>
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-cyan-500 transition-all" style={{ width: `${((page + 1) / total) * 100}%` }} /></div>
    <div className="mt-4 grid min-h-[62vh] items-start gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.15fr)]">
      <div className="space-y-3">
        {exercisePreview ? <div className="flex max-h-[58vh] items-center justify-center overflow-hidden rounded-2xl border-2 border-cyan-100 bg-slate-50"><img src={exercisePreview} alt={`Document ${page + 1}`} className="max-h-[58vh] w-full object-contain" /></div> : <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-bold text-slate-400">Document non disponible</div>}
        <button type="button" onClick={() => setShowSheet(true)} className="block w-full rounded-xl bg-blue-50 px-4 py-3 text-center text-xs font-black text-blue-700">📘 Consulter la fiche méthode</button>
      </div>
      <div className="space-y-3">{fields.map(([key, label]) => {
        const ok = pageChecked && methodAnswerMatches(pageAnswers[key], exercise.expected?.[key]);
        const parsed = parseExpectedCorrectionRule(exercise.expected?.[key] || '');
        return <label key={key} className={`block rounded-2xl border-2 p-3 ${!pageChecked ? 'border-slate-100 bg-slate-50' : ok ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><textarea value={pageAnswers[key] || ''} onChange={(event) => setAnswers((previous) => ({ ...previous, [exercise.id]: { ...(previous[exercise.id] || {}), [key]: event.target.value } }))} className="min-h-[58px] w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400" />{pageChecked && !ok && <div className="mt-2 text-xs font-bold text-amber-800">À retenir : {parsed.correction || 'Réponse à revoir'}</div>}</label>;
      })}
        {pageChecked && <div className="rounded-xl bg-cyan-50 p-3 text-sm font-black text-cyan-800">{correctCount}/{fields.length} éléments reconnus. Tu peux continuer même si tout n’est pas juste.{exercise.correction ? <div className="mt-1 font-bold whitespace-pre-wrap">{exercise.correction}</div> : null}</div>}
        <div className="flex items-center justify-between gap-3 pt-1"><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-600 disabled:opacity-30">Précédent</button><div className="flex gap-2"><button type="button" onClick={() => setChecked((previous) => ({ ...previous, [exercise.id]: true }))} className="rounded-xl bg-cyan-600 px-4 py-3 text-xs font-black text-white">Vérifier</button><button type="button" onClick={goNext} className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">{page === total - 1 ? 'Finir' : 'Suivant →'}</button></div></div>
      </div>
    </div>
  </section>{methodSheetModal}</>;
}

function DnbDocumentMethodCalibration({ type, onBack }) {
  const storageKey = `condaweb-dnb-doc-method-${type}-v1`;
  const isImageDescription = type === 'image';
  const fields = documentMethodFields[type];
  const [model, setModel] = useState(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (stored && Array.isArray(stored.exercises)) {
        if (type === 'presentation') stored.exercises = stored.exercises.map((exercise) => ({ ...exercise, expected: { ...exercise.expected, subject: exercise.expected?.subject || exercise.expected?.source || '' } }));
        return stored;
      }
    } catch (_) {}
    return { videoUrl: '', exercises: [] };
  });
  const [previews, setPreviews] = useState({});
  const [sheetPreview, setSheetPreview] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const urls = [];
    Promise.all(model.exercises.map(async (exercise) => {
      if (!exercise.imageKey || previews[exercise.id]) return;
      try {
        const blob = await loadDnbMethodImage(exercise.imageKey);
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        setPreviews((previous) => ({ ...previous, [exercise.id]: url }));
      } catch (_) {}
    }));
    return () => { cancelled = true; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    if (model.sheetKey) {
      loadDnbMethodImage(model.sheetKey).then((blob) => {
        if (!blob || cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSheetPreview(objectUrl);
      }).catch(() => {});
    }
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  const addExercise = () => {
    const id = `${type}-exercise-${Date.now()}`;
    setModel((previous) => ({ ...previous, exercises: [...previous.exercises, { id, imageKey: '', imageName: '', correction: '', expected: Object.fromEntries(fields.map(([key]) => [key, ''])) }] }));
    setSaved(false);
  };
  const updateExercise = (id, patch) => {
    setModel((previous) => ({ ...previous, exercises: previous.exercises.map((exercise) => exercise.id === id ? { ...exercise, ...patch } : exercise) }));
    setSaved(false);
  };
  const uploadImage = async (exercise, file) => {
    if (!file) return;
    const imageKey = `${storageKey}:${exercise.id}`;
    await saveDnbMethodImage(imageKey, file);
    const previousUrl = previews[exercise.id];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    setPreviews((previous) => ({ ...previous, [exercise.id]: URL.createObjectURL(file) }));
    updateExercise(exercise.id, { imageKey, imageName: file.name });
  };
  const uploadMethodSheet = async (file) => {
    if (!file) return;
    const sheetKey = `${storageKey}:method-sheet`;
    await saveDnbMethodImage(sheetKey, file);
    if (sheetPreview) URL.revokeObjectURL(sheetPreview);
    setSheetPreview(URL.createObjectURL(file));
    setModel((previous) => ({ ...previous, sheetKey, sheetName: file.name, sheetMime: file.type || '' }));
    setSaved(false);
  };
  const save = () => {
    window.localStorage.setItem(storageKey, JSON.stringify(model));
    setSaved(true);
  };
  const embedUrl = youtubeEmbedUrl(model.videoUrl);

  return <section className="mx-4 rounded-3xl border border-cyan-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-cyan-600">Documents · Calibrage</div><h3 className="m-0 text-2xl font-black text-slate-900">{isImageDescription ? 'Description d’image' : 'Présentation de document'}</h3></div>
      <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">← Retour à la méthodo</button>
    </div>
    <label className="mt-5 block rounded-2xl bg-cyan-50 p-4"><span className="mb-1 block text-[10px] font-black uppercase text-cyan-700">Lien de la vidéo explicative</span><input value={model.videoUrl || ''} onChange={(event) => { setModel((previous) => ({ ...previous, videoUrl: event.target.value })); setSaved(false); }} placeholder="Colle ici le lien YouTube" className="w-full rounded-xl border-2 border-cyan-100 bg-white px-4 py-3 text-sm font-bold outline-none focus:border-cyan-400" /></label>
    {embedUrl && <div className="mx-auto mt-4 max-w-[760px] overflow-hidden rounded-2xl border-2 border-cyan-200 bg-slate-950"><div className="aspect-video"><iframe className="h-full w-full" src={embedUrl} title={`Vidéo ${isImageDescription ? 'description image' : 'présentation document'}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div></div>}
    <div className="mx-auto mt-4 max-w-[760px] rounded-2xl border-2 border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase text-blue-600">Fiche méthode</div><div className="text-sm font-bold text-slate-700">{model.sheetName || 'Aucune fiche ajoutée'}</div></div><label className="cursor-pointer rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white">+ Ajouter la fiche<input type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => uploadMethodSheet(event.target.files?.[0])} /></label></div>
      {sheetPreview && <div className="mt-3 overflow-hidden rounded-xl border border-blue-200 bg-white">{model.sheetMime === 'application/pdf' ? <iframe src={sheetPreview} title="Fiche méthode PDF" className="h-[520px] w-full" /> : <a href={sheetPreview} target="_blank" rel="noreferrer"><img src={sheetPreview} alt="Fiche méthode" className="block max-h-[720px] w-full object-contain" /></a>}</div>}
    </div>
    <div className="mt-5 flex items-center justify-between gap-3"><div className="text-lg font-black text-slate-900">Exercices calibrés ({model.exercises.length})</div><button type="button" onClick={addExercise} className="rounded-xl bg-cyan-600 px-4 py-3 text-xs font-black text-white">+ Ajouter un exercice</button></div>
    <div className="mt-4 space-y-5">{model.exercises.map((exercise, index) => <article key={exercise.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between"><div className="text-sm font-black text-slate-900">Exercice {index + 1}</div><button type="button" onClick={() => { setModel((previous) => ({ ...previous, exercises: previous.exercises.filter((item) => item.id !== exercise.id) })); setSaved(false); }} className="text-xs font-black text-red-500">Supprimer</button></div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[300px_1fr]">
        <label className="flex min-h-[190px] cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-cyan-300 bg-white text-center">
          {previews[exercise.id] ? <img src={previews[exercise.id]} alt={`Document exercice ${index + 1}`} className="h-full max-h-[300px] w-full object-contain" /> : <span className="p-5 text-sm font-black text-cyan-700">Ajouter l’image ou le document<br /><span className="text-[10px] text-slate-400">PNG, JPG, WEBP…</span></span>}
          <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadImage(exercise, event.target.files?.[0])} />
        </label>
        <div className="space-y-3">{fields.map(([fieldKey, label]) => {
          const rawRule = exercise.expected?.[fieldKey] || '';
          const parsedRule = parseExpectedCorrectionRule(rawRule);
          return <label key={fieldKey} className="block"><span className="mb-1 block text-[10px] font-black uppercase text-slate-500">{label}</span><input value={rawRule} onChange={(event) => updateExercise(exercise.id, { expected: { ...exercise.expected, [fieldKey]: event.target.value } })} placeholder={'Phrase avec "mots attendus" ou "choix 1"="choix 2"'} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm font-bold outline-none focus:border-cyan-400" />
            {rawRule && <div className="mt-1 rounded-lg bg-white px-2 py-1.5 text-[10px] leading-relaxed text-slate-600"><span className="font-black text-slate-800">Correction affichée :</span> {parsedRule.correction || '—'}{parsedRule.groups.length > 0 && <><br /><span className="font-black text-cyan-700">Attendu :</span> {parsedRule.groups.map((group) => group.join(' / ')).join(' + ')}</>}</div>}
          </label>;
        })}</div>
      </div>
      <label className="mt-3 block"><span className="mb-1 block text-[10px] font-black uppercase text-blue-600">Description / explication du corrigé</span><textarea value={exercise.correction || ''} onChange={(event) => updateExercise(exercise.id, { correction: event.target.value })} placeholder="Ajoute l’explication qui sera montrée après la correction." className="min-h-[80px] w-full rounded-2xl border-2 border-blue-100 bg-blue-50 p-3 text-sm font-bold leading-relaxed outline-none focus:border-blue-400" /></label>
    </article>)}</div>
    {model.exercises.length === 0 && <div className="mt-4 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm font-bold text-slate-400">Ajoute le premier exercice pour commencer le calibrage.</div>}
    <div className="mt-5 flex flex-wrap items-center gap-3"><button type="button" onClick={save} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">Valider et enregistrer</button>{saved && <span className="text-sm font-black text-emerald-600">✓ Calibrage enregistré</span>}</div>
  </section>;
}

function DnbParagraphMethodology({ onBack }) {
  const [module, setModule] = useState('home');
  if (module === 'hors-sujet') return <DnbOffTopicCalibration onBack={() => setModule('home')} />;
  if (module === 'introduction') return <DnbIntroductionCalibration onBack={() => setModule('home')} />;
  return (
    <section className="mx-4 rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-blue-500">Paragraphe · Méthodologie</div>
          <h3 className="m-0 text-2xl font-black text-slate-900">Réussir le développement construit</h3>
        </div>
        <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">← Retour aux dossiers</button>
      </div>
      <div className="mt-4 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.72fr)]">
        <div className="overflow-hidden rounded-2xl border-2 border-blue-200 bg-slate-950 shadow-sm">
          <div className="aspect-video">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/bNAhL2TvU8A"
              title="Méthodologie du développement construit au DNB"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
        </div>
        <a href="/dnb-paragraph.png" target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-sm" title="Ouvrir la fiche méthode en grand">
          <img src="/dnb-paragraph.png" alt="Fiche méthode du développement construit au DNB" className="block h-auto w-full" />
        </a>
      </div>
      <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Regarde d’abord la vidéo, puis utilise la fiche méthode comme modèle. Clique sur la fiche pour l’ouvrir en grand.</div>
      <div className="mt-5 rounded-3xl border-2 border-amber-200 bg-amber-50 p-4">
        <div className="mb-3">
          <div className="text-[11px] font-black uppercase text-amber-600">Deuxième apprentissage</div>
          <div className="text-xl font-black text-slate-900">Détecter et éviter le hors-sujet</div>
        </div>
        <div className="grid items-center gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="overflow-hidden rounded-2xl border-2 border-amber-300 bg-slate-950 shadow-sm">
            <div className="aspect-video">
              <iframe className="h-full w-full" src="https://www.youtube.com/embed/S5cXMZk-BDs" title="Éviter le hors-sujet au DNB" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold leading-relaxed text-amber-900">Apprends à vérifier que chaque argument répond précisément au sujet demandé.</p>
            <button type="button" onClick={() => setModule('hors-sujet')} className="mt-4 w-full rounded-2xl bg-amber-500 px-5 py-4 text-sm font-black text-white shadow-sm">S’entraîner à détecter le hors-sujet</button>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-violet-200 bg-violet-50 p-5">
        <div>
          <div className="text-[11px] font-black uppercase text-violet-600">Troisième apprentissage</div>
          <div className="text-xl font-black text-slate-900">Vérifier une introduction</div>
          <p className="mt-1 text-sm font-bold text-violet-800">Repérer s’il manque une définition ou des bornes spatiales et temporelles.</p>
        </div>
        <button type="button" onClick={() => setModule('introduction')} className="rounded-2xl bg-violet-600 px-6 py-4 text-sm font-black text-white shadow-sm">Calibrer les 6 introductions</button>
      </div>
    </section>
  );
}

const DNB_INTRO_DRAFT_KEY = 'condaweb-dnb-introduction-calibration-v1';
const DNB_INTRO_CHOICES = [
  { key: 'keywords', label: 'Il manque la définition des mots-clés' },
  { key: 'spatial', label: 'Il manque les bornes spatiales' },
  { key: 'temporal', label: 'Il manque les bornes temporelles' },
  { key: 'complete', label: 'Rien ne manque' }
];

function DnbIntroductionCalibration({ onBack }) {
  const [introductions, setIntroductions] = useState(() => {
    let storedItems = [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(DNB_INTRO_DRAFT_KEY) || 'null');
      if (Array.isArray(stored?.introductions)) storedItems = stored.introductions;
    } catch (_) {}
    return Array.from({ length: 6 }, (_, index) => ({ id: `introduction-${index + 1}`, subject: '', text: '', expected: '', ...(storedItems[index] || {}) }));
  });
  const [saved, setSaved] = useState(false);
  const save = () => {
    window.localStorage.setItem(DNB_INTRO_DRAFT_KEY, JSON.stringify({ introductions }));
    setSaved(true);
  };

  return <section className="mx-4 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-violet-600">Méthodo · Calibrage</div><h3 className="m-0 text-2xl font-black text-slate-900">Analyser une introduction</h3></div>
      <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">← Retour à la méthodo</button>
    </div>
    <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm font-bold text-violet-900">Colle six introductions et sélectionne pour chacune l’unique réponse correcte. Les retours à la ligne du texte seront conservés.</div>
    <div className="mt-5 space-y-4">{introductions.map((introduction, index) => <article key={introduction.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-black text-slate-900">Introduction {index + 1}</div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase text-violet-600">Sujet demandé</span>
        <input
          value={introduction.subject || ''}
          onChange={(event) => {
            const subject = event.target.value;
            setIntroductions((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, subject } : item));
            setSaved(false);
          }}
          placeholder="Ex. Décrivez les transformations des espaces productifs français."
          className="w-full rounded-2xl border-2 border-violet-100 bg-violet-50 px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-violet-400"
        />
      </label>
      <textarea
        value={introduction.text || ''}
        onChange={(event) => {
          const text = event.target.value;
          setIntroductions((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, text } : item));
          setSaved(false);
        }}
        placeholder="Colle ici l’introduction proposée à l’élève..."
        className="mt-3 min-h-[120px] w-full resize-y rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm font-bold leading-relaxed text-slate-800 outline-none focus:border-violet-400"
      />
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{DNB_INTRO_CHOICES.map((choice) => <button
        key={choice.key}
        type="button"
        onClick={() => {
          setIntroductions((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, expected: choice.key } : item));
          setSaved(false);
        }}
        className={`rounded-xl border-2 px-3 py-3 text-xs font-black leading-tight ${introduction.expected === choice.key ? 'border-violet-700 bg-violet-600 text-white' : 'border-violet-100 bg-white text-slate-700'}`}
      >{choice.label}</button>)}</div>
    </article>)}</div>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <button type="button" onClick={save} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">Valider et enregistrer le calibrage</button>
      {saved && <span className="text-sm font-black text-emerald-600">✓ Les 6 introductions sont enregistrées</span>}
    </div>
  </section>;
}

const DNB_OFF_TOPIC_DRAFT_KEY = 'condaweb-dnb-off-topic-calibration-v1';

const parseQuotedOffTopic = (source = '') => {
  const text = String(source || '');
  const quotePattern = /"([\s\S]*?)"|«([\s\S]*?)»|“([\s\S]*?)”/g;
  const ranges = [];
  let cleanText = '';
  let sourceCursor = 0;
  let match;
  while ((match = quotePattern.exec(text)) !== null) {
    cleanText += text.slice(sourceCursor, match.index);
    const quotedText = match[1] ?? match[2] ?? match[3] ?? '';
    const start = cleanText.length;
    cleanText += quotedText;
    ranges.push({ start, end: cleanText.length });
    sourceCursor = match.index + match[0].length;
  }
  cleanText += text.slice(sourceCursor);
  return { text: cleanText, offTopicRanges: ranges };
};

function DnbOffTopicCalibration({ onBack }) {
  const [paragraphs, setParagraphs] = useState(() => {
    let storedParagraphs = [];
    try {
      const stored = JSON.parse(window.localStorage.getItem(DNB_OFF_TOPIC_DRAFT_KEY) || 'null');
      if (Array.isArray(stored?.paragraphs)) storedParagraphs = stored.paragraphs;
    } catch (_) {}
    return [0, 1, 2, 3].map((index) => ({
      id: `paragraph-${index + 1}`,
      subject: '',
      sourceText: '',
      text: '',
      offTopicRanges: [],
      explanation: '',
      ...(storedParagraphs[index] || {})
    }));
  });
  const [saved, setSaved] = useState(false);

  const preview = (paragraph) => {
    if (!paragraph.text) return <span className="text-slate-400">Le texte calibré apparaîtra ici.</span>;
    const parts = [];
    let cursor = 0;
    paragraph.offTopicRanges.forEach((range, index) => {
      if (range.start > cursor) parts.push(<React.Fragment key={`normal-${index}`}>{paragraph.text.slice(cursor, range.start)}</React.Fragment>);
      parts.push(<mark key={`off-${index}`} className="rounded bg-red-200 px-0.5 font-black text-red-800">{paragraph.text.slice(range.start, range.end)}</mark>);
      cursor = range.end;
    });
    if (cursor < paragraph.text.length) parts.push(<React.Fragment key="normal-last">{paragraph.text.slice(cursor)}</React.Fragment>);
    return parts;
  };

  const saveCalibration = () => {
    window.localStorage.setItem(DNB_OFF_TOPIC_DRAFT_KEY, JSON.stringify({ paragraphs }));
    setSaved(true);
  };

  return <section className="mx-4 rounded-3xl border border-amber-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-amber-600">Méthodo · Calibrage</div><h3 className="m-0 text-2xl font-black text-slate-900">Détecter le hors-sujet</h3></div>
      <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">← Retour à la méthodo</button>
    </div>
    <div className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">Saisis quatre paragraphes argumentés et place chaque passage hors sujet entre guillemets. Ils apparaîtront automatiquement en rouge dans l’aperçu. Les retours et sauts de ligne seront conservés.</div>
    <div className="mt-5 space-y-5">{paragraphs.map((paragraph, paragraphIndex) => <article key={paragraph.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm font-black text-slate-900">Paragraphe argumenté {paragraphIndex + 1}</div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase text-amber-700">Sujet demandé</span>
        <input
          value={paragraph.subject || ''}
          onChange={(event) => {
            const subject = event.target.value;
            setParagraphs((previous) => previous.map((item, index) => index === paragraphIndex ? { ...item, subject } : item));
            setSaved(false);
          }}
          placeholder="Ex. Montrez comment les civils sont mobilisés pendant la Première Guerre mondiale."
          className="w-full rounded-2xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-black text-slate-900 outline-none focus:border-amber-400"
        />
      </label>
      <textarea
        value={paragraph.sourceText ?? paragraph.text}
        onChange={(event) => {
          const sourceText = event.target.value;
          const parsed = parseQuotedOffTopic(sourceText);
          setParagraphs((previous) => previous.map((item, index) => index === paragraphIndex ? { ...item, sourceText, ...parsed } : item));
          setSaved(false);
        }}
        placeholder={'Écris ou colle le paragraphe. Exemple : Cet argument répond au sujet. "Cet argument est hors sujet."\n\nLe paragraphe peut continuer après une ligne vide.'}
        className="mt-3 min-h-[150px] w-full resize-y rounded-2xl border-2 border-slate-200 bg-white p-4 text-sm font-bold leading-relaxed text-slate-800 outline-none focus:border-amber-400"
      />
      <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold leading-relaxed text-slate-700"><div className="mb-2 text-[10px] font-black uppercase text-slate-400">Aperçu du corrigé</div>{preview(paragraph)}</div>
      <label className="mt-3 block">
        <span className="mb-1 block text-[10px] font-black uppercase text-blue-600">Petite explication du corrigé</span>
        <textarea
          value={paragraph.explanation || ''}
          onChange={(event) => {
            const explanation = event.target.value;
            setParagraphs((previous) => previous.map((item, index) => index === paragraphIndex ? { ...item, explanation } : item));
            setSaved(false);
          }}
          placeholder="Explique brièvement pourquoi les passages rouges sont hors sujet et ce qu’il fallait traiter à la place."
          className="min-h-[80px] w-full resize-y rounded-2xl border-2 border-blue-100 bg-blue-50 p-3 text-sm font-bold leading-relaxed text-slate-800 outline-none focus:border-blue-400"
        />
      </label>
    </article>)}</div>
    <div className="mt-5 flex items-center gap-3"><button type="button" onClick={saveCalibration} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">Valider et enregistrer le calibrage</button>{saved && <span className="text-sm font-black text-emerald-600">✓ Calibrage enregistré</span>}</div>
  </section>;
}

function DnbParagraphFillActivity({ activity, onBack }) {
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState(false);
  const expected = (index) => activity.blanks[index - 1] || '';
  const score = activity.blanks.filter((answer, index) => normalizeAnswer(answers[`blank-${index + 1}`]) === normalizeAnswer(answer)).length;
  const input = (index) => {
    const id = `blank-${index}`;
    const isGood = checked && normalizeAnswer(answers[id]) === normalizeAnswer(expected(index));
    const isWrong = checked && answers[id] && !isGood;
    return (
      <span className="inline-flex flex-col align-middle">
        <input
          value={answers[id] || ''}
          onChange={(event) => {
            setAnswers((prev) => ({ ...prev, [id]: event.target.value }));
            setChecked(false);
          }}
          className={`mx-1 inline-block w-44 rounded-xl border bg-white px-3 py-2 text-center text-sm font-black outline-none ${isGood ? 'border-emerald-400 text-emerald-700' : isWrong ? 'border-red-400 text-red-600' : 'border-violet-200 text-slate-900'}`}
          placeholder="..."
        />
        {checked && !isGood && (
          <span className="mx-1 mt-1 text-center text-[10px] font-black text-red-600">{expected(index)}</span>
        )}
      </span>
    );
  };
  const renderPart = (part, index) => (
    typeof part === 'number'
      ? <React.Fragment key={`blank-${index}`}>{input(part)}</React.Fragment>
      : <React.Fragment key={`txt-${index}`}>{part}</React.Fragment>
  );

  return (
    <section className="mx-4 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-violet-500">Paragraphe · Histoire</div>
          <h3 className="m-0 text-2xl font-black text-slate-900">{activity.title}</h3>
        </div>
        <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">
          ← Activités
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-sm font-black text-violet-700">
        Complète le développement construit avec les mots-clés et les connecteurs logiques manquants.
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="text-xs font-black uppercase text-slate-400">Boîte à mots</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {activity.wordBank.map((word) => (
            <span key={word} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm">{word}</span>
          ))}
        </div>
      </div>

      <article className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 text-base font-bold leading-9 text-slate-800">
        {activity.paragraphs.map((paragraph, paragraphIndex) => (
          <p key={paragraphIndex} className={paragraphIndex === 0 ? '' : 'mt-4'}>
            {paragraph.map(renderPart)}
          </p>
        ))}
      </article>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => { setChecked(true); reportTrainingScore(`dnb-paragraph-${activity.id}`, score, activity.blanks.length); }} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white">
          Valider
        </button>
        <button
          type="button"
          onClick={() => {
            setAnswers({});
            setChecked(false);
          }}
          className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
        >
          Recommencer
        </button>
        {checked && (
          <div className={`rounded-2xl px-4 py-3 text-sm font-black ${score === activity.blanks.length ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            Score : {score}/{activity.blanks.length}
          </div>
        )}
      </div>
    </section>
  );
}

function DnbParagraphRealActivity({ activity, user, onBack }) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    const userText = String(answer || '').trim();
    if (!userText) return;
    setSubmitting(true);
    setResult(null);
    try {
      const response = await fetch('/api/eleve/homework/submit-local-dnb-paragraph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          userText,
          playerId: user?._id || user?.id
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || 'Erreur correction IA');
      setResult(data);
    } catch (error) {
      setResult({ error: error.message || 'Erreur correction IA' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-4 rounded-3xl border border-violet-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-violet-500">Conditions réelles · {activity.source}</div>
          <h3 className="m-0 text-2xl font-black text-slate-900">{activity.title}</h3>
        </div>
        <button type="button" onClick={onBack} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600">
          ← Activités
        </button>
      </div>
      <div className="mt-4 rounded-2xl bg-violet-50 p-4 text-base font-black leading-7 text-violet-800">
        {activity.instruction}
      </div>
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        className="mt-5 min-h-[360px] w-full rounded-3xl border border-slate-200 bg-slate-50 p-5 text-base font-bold leading-7 text-slate-900 outline-none focus:border-violet-300"
        placeholder="Rédige ton développement construit ici..."
      />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !answer.trim()}
          className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white disabled:opacity-40"
        >
          {submitting ? 'Correction...' : 'Envoyer à l’IA'}
        </button>
        <button
          type="button"
          onClick={() => {
            setAnswer('');
            setResult(null);
          }}
          className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-black text-slate-700"
        >
          Recommencer
        </button>
        {result?.score_label && (
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            {result.score_label} · {result.grade}
          </div>
        )}
      </div>
      {result?.error && (
        <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm font-black text-red-600">{result.error}</div>
      )}
      {result?.feedback_fond && (
        <div className="mt-4 rounded-3xl border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-7 text-emerald-800">
          {result.feedback_fond}
        </div>
      )}
      {Array.isArray(result?.questions) && result.questions.length > 0 && (
        <div className="mt-4 grid gap-3">
          {result.questions.map((row, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700">
              <div className="font-black text-slate-900">{row.score}/{row.max}</div>
              <div className="mt-1">{row.feedback}</div>
              {row.conseil && <div className="mt-1 text-violet-700">{row.conseil}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function DnbLocalParagraphActivities({ selectedActivity, onSelectActivity, user }) {
  const [activity, setActivity] = useState('');
  const currentActivityId = selectedActivity || activity;
  const currentActivity = DNB_PARAGRAPH_LOCAL_ACTIVITIES.find((item) => item.id === currentActivityId);
  const currentRealActivity = DNB_PARAGRAPH_REAL_ACTIVITIES.find((item) => item.id === currentActivityId);
  if (currentActivity) {
    return <DnbParagraphFillActivity activity={currentActivity} onBack={() => {
      setActivity('');
      onSelectActivity?.('');
    }} />;
  }
  if (currentRealActivity) {
    return <DnbParagraphRealActivity activity={currentRealActivity} user={user} onBack={() => {
      setActivity('');
      onSelectActivity?.('');
    }} />;
  }
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <div className="mb-2 px-2 text-[10px] font-black uppercase text-violet-500">Activités disponibles</div>
      <div className="grid gap-2">
        {[...DNB_PARAGRAPH_LOCAL_ACTIVITIES.map((item) => ({ ...item, mode: 'Texte à trous' })), ...DNB_PARAGRAPH_REAL_ACTIVITIES.map((item) => ({ ...item, mode: 'Conditions réelles' }))].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActivity(item.id);
              onSelectActivity?.(item.id);
            }}
            className="w-full rounded-2xl border border-violet-100 bg-white px-3 py-2 text-left transition hover:border-violet-300 hover:bg-violet-50"
          >
            <div className="flex items-center gap-3">
              <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${item.mode === 'Conditions réelles' ? 'bg-emerald-100 text-emerald-700' : 'bg-violet-100 text-violet-600'}`}>{item.mode}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-black text-slate-900">{item.title}</span>
              <span className="text-sm font-black text-violet-400">›</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

const FIFTH_GRADE_WORLD_MARKERS = [
  { id: 1, answer: 'Amérique', x: 19, y: 43, kind: 'continent' },
  { id: 2, answer: 'Europe', x: 49, y: 32, kind: 'continent' },
  { id: 3, answer: 'Afrique', x: 49, y: 55, kind: 'continent' },
  { id: 4, answer: 'Asie', x: 67, y: 37, kind: 'continent' },
  { id: 5, answer: 'Océanie', x: 81, y: 67, kind: 'continent' },
  { id: 6, answer: 'Antarctique', x: 52, y: 88, kind: 'continent' },
  { id: 7, answer: 'Océan Pacifique', x: 7, y: 58, kind: 'ocean' },
  { id: 8, answer: 'Océan Atlantique', x: 36, y: 49, kind: 'ocean' },
  { id: 9, answer: 'Océan Indien', x: 67, y: 66, kind: 'ocean' },
  { id: 10, answer: 'Océan Arctique', x: 51, y: 9, kind: 'ocean' },
  { id: 11, answer: 'Océan Austral', x: 52, y: 97, kind: 'ocean' }
];

const fifthGradeWorldAnswerMatches = (answer, expected) => {
  const actual = normalizeAnswer(answer);
  const target = normalizeAnswer(expected);
  if (!actual || !target) return false;
  if (actual === target) return true;
  return target.startsWith('ocean') && actual === target.replace(/^ocean/, '');
};

const FIFTH_GRADE_SCALE_LEVELS = [
  { id: 'mondiale', label: 'Mondiale', example: 'Le monde entier', icon: '🌍' },
  { id: 'macro-regionale', label: 'Macro-régionale', example: 'Un continent ou un grand ensemble de pays', icon: '🌐' },
  { id: 'nationale', label: 'Nationale', example: 'Un pays entier', icon: '🇫🇷' },
  { id: 'regionale', label: 'Régionale', example: "Une région ou une partie d'un pays", icon: '🗺️' },
  { id: 'locale', label: 'Locale', example: 'Une ville, un quartier ou un site', icon: '📍' }
];

const FIFTH_GRADE_SCALE_QUESTIONS = [
  { id: 'world', title: 'Les grands climats du monde', detail: 'Tous les continents sont représentés.', answer: 'mondiale', icon: '🌍' },
  { id: 'europe', title: "Les États de l'Union européenne", detail: "La carte représente une grande partie de l'Europe.", answer: 'macro-regionale', icon: '🌐' },
  { id: 'france', title: 'La population en France', detail: 'Le territoire français entier est représenté.', answer: 'nationale', icon: '🇫🇷' },
  { id: 'occitanie', title: "Les transports en Occitanie", detail: 'Une région française est représentée.', answer: 'regionale', icon: '🗺️' },
  { id: 'town', title: 'Le centre-ville de Toulouse', detail: 'Les rues et les bâtiments sont visibles.', answer: 'locale', icon: '📍' }
];

const FIFTH_GRADE_DEMOGRAPHIC_CURVES = [
  {
    id: 'curve-trend', title: 'Population du pays A (en millions)', years: [1960, 1980, 2000, 2020], values: [18, 25, 39, 55],
    question: 'Comment évolue globalement la population ?', choices: ['Elle augmente', 'Elle diminue', 'Elle reste stable'], answer: 'Elle augmente'
  },
  {
    id: 'curve-value', title: 'Population du pays B (en millions)', years: [1960, 1980, 2000, 2020], values: [22, 31, 40, 48],
    question: 'Combien d’habitants compte ce pays en 2000 ?', choices: ['31 millions', '40 millions', '48 millions'], answer: '40 millions'
  },
  {
    id: 'curve-date', title: 'Population du pays C (en millions)', years: [1960, 1980, 2000, 2020], values: [12, 20, 29, 29],
    question: 'À partir de quelle année la population devient-elle stable ?', choices: ['1980', '2000', '2020'], answer: '2000'
  },
  {
    id: 'curve-decline', title: 'Population du pays D (en millions)', years: [1960, 1980, 2000, 2020], values: [46, 50, 47, 41],
    question: 'Durant quelle période la population diminue-t-elle le plus ?', choices: ['1960–1980', '1980–2000', '2000–2020'], answer: '2000–2020'
  }
];

function FifthGradeDemographicCurve({ item, compact = false }) {
  const width = 520;
  const height = compact ? 230 : 280;
  const margin = { left: 52, right: 18, top: 26, bottom: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(10, Math.ceil(Math.max(...item.values) / 10) * 10);
  const points = item.values.map((value, index) => ({
    x: margin.left + (index / Math.max(1, item.values.length - 1)) * plotWidth,
    y: margin.top + plotHeight - (value / maxValue) * plotHeight
  }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
    <div className="px-2 pt-1 text-center text-sm font-black text-slate-800">{item.title}</div>
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={item.title}>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = margin.top + plotHeight - ratio * plotHeight;
        return <g key={ratio}><line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#dbeafe" strokeWidth="2" /><text x={margin.left - 8} y={y + 5} textAnchor="end" fontSize="13" fontWeight="800" fill="#64748b">{Math.round(maxValue * ratio)}</text></g>;
      })}
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#0f172a" strokeWidth="3" />
      <line x1={margin.left} y1={margin.top + plotHeight} x2={width - margin.right} y2={margin.top + plotHeight} stroke="#0f172a" strokeWidth="3" />
      {item.years.map((year, index) => <text key={year} x={points[index].x} y={height - 14} textAnchor="middle" fontSize="13" fontWeight="800" fill="#475569">{year}</text>)}
      <path d={path} fill="none" stroke="#7c3aed" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((point, index) => <g key={item.years[index]}><circle cx={point.x} cy={point.y} r="7" fill="#fff" stroke="#7c3aed" strokeWidth="5" />{!item.approximate && <text x={point.x} y={Math.max(18, point.y - 13)} textAnchor="middle" fontSize="13" fontWeight="900" fill="#5b21b6" stroke="#fff" strokeWidth="4" paintOrder="stroke">{item.values[index]}</text>}<title>{item.years[index]} : {item.values[index]} millions</title></g>)}
    </svg>
    {item.approximate && <div className="pb-1 text-center text-[11px] font-black text-amber-700">Chiffres approximatifs — une marge de ±5 millions est acceptée.</div>}
  </div>;
}

const FIFTH_GRADE_CURVE_FALLBACK = [
  { ...FIFTH_GRADE_DEMOGRAPHIC_CURVES[0], type: 'evolution', expected: { startYear: '1960', endYear: '2020', trend: 'augmente', startValue: '18', endValue: '55' } }
];

const FIFTH_GRADE_EVOLUTION_CURVE_SUPPLEMENTS = [
  {
    id: 'curve-exact-decline', title: 'Population du pays B (en millions)', type: 'evolution',
    years: [1960, 1980, 2000, 2020], values: [58, 52, 43, 34],
    expected: { startYear: '1960', endYear: '2020', trend: 'diminue', startValue: '58', endValue: '34' }
  },
  {
    id: 'curve-exact-stable', title: 'Population du pays C (en millions)', type: 'evolution',
    years: [1960, 1980, 2000, 2020], values: [36, 36, 36, 36],
    expected: { startYear: '1960', endYear: '2020', trend: 'stagne', startValue: '36', endValue: '36' }
  },
  {
    id: 'curve-approx-growth', title: 'Population du pays D (en millions)', type: 'evolution', approximate: true, tolerance: 5,
    years: [1960, 1980, 2000, 2020], values: [23, 31, 46, 67],
    expected: { startYear: '1960', endYear: '2020', trend: 'augmente', startValue: '23', endValue: '67' }
  },
  {
    id: 'curve-approx-decline', title: 'Population du pays E (en millions)', type: 'evolution', approximate: true, tolerance: 5,
    years: [1960, 1980, 2000, 2020], values: [72, 63, 51, 38],
    expected: { startYear: '1960', endYear: '2020', trend: 'diminue', startValue: '72', endValue: '38' }
  }
];

const FIFTH_GRADE_NATURAL_BALANCE_CURVES = [
  {
    id: 'natural-balance-positive',
    title: 'Natalité et mortalité du pays A',
    type: 'natural-balance',
    years: [1980, 1990, 2000, 2010, 2020],
    natalityValues: [44, 42, 39, 36, 33],
    mortalityValues: [20, 17, 14, 12, 10],
    expected: { periodStart: '1980', relation: 'superieure', evolution: 'augmente', balance: 'positif' }
  },
  {
    id: 'natural-balance-negative',
    title: 'Natalité et mortalité du pays B',
    type: 'natural-balance',
    years: [1980, 1990, 2000, 2010, 2020],
    natalityValues: [14, 12, 10, 8, 7],
    mortalityValues: [8, 8, 9, 10, 12],
    expected: { periodStart: '2010', relation: 'inferieure', evolution: 'diminue', balance: 'negatif' }
  },
  {
    id: 'natural-balance-positive-two',
    title: 'Natalité et mortalité du pays C',
    type: 'natural-balance',
    years: [1980, 1990, 2000, 2010, 2020],
    natalityValues: [32, 29, 26, 23, 20],
    mortalityValues: [12, 11, 10, 9, 8],
    expected: { periodStart: '1980', relation: 'superieure', evolution: 'augmente', balance: 'positif' }
  },
  {
    id: 'natural-balance-negative-two',
    title: 'Natalité et mortalité du pays D',
    type: 'natural-balance',
    years: [1980, 1990, 2000, 2010, 2020],
    natalityValues: [11, 10, 9, 8, 7],
    mortalityValues: [15, 14, 13, 12, 11],
    expected: { periodStart: '1980', relation: 'inferieure', evolution: 'diminue', balance: 'negatif' }
  },
  {
    id: 'natural-balance-positive-three',
    title: 'Natalité et mortalité du pays E',
    type: 'natural-balance',
    years: [1980, 1990, 2000, 2010, 2020],
    natalityValues: [25, 24, 22, 20, 18],
    mortalityValues: [9, 9, 8, 8, 7],
    expected: { periodStart: '1980', relation: 'superieure', evolution: 'augmente', balance: 'positif' }
  }
];

function FifthGradeNaturalBalanceCurve({ item }) {
  const width = 520;
  const height = 265;
  const margin = { left: 50, right: 20, top: 55, bottom: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const allValues = [...item.natalityValues, ...item.mortalityValues];
  const maxValue = Math.max(10, Math.ceil(Math.max(...allValues) / 10) * 10);
  const pointsFor = (values) => values.map((value, index) => ({
    x: margin.left + (index / Math.max(1, values.length - 1)) * plotWidth,
    y: margin.top + plotHeight - (value / maxValue) * plotHeight
  }));
  const natalityPoints = pointsFor(item.natalityValues);
  const mortalityPoints = pointsFor(item.mortalityValues);
  const pathFor = (points) => points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
    <div className="px-2 pt-1 text-center text-sm font-black text-slate-800">{item.title}</div>
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={`${item.title} : taux de natalité et de mortalité`}>
      <g transform="translate(112 35)">
        <line x1="0" y1="0" x2="34" y2="0" stroke="#fb7185" strokeWidth="7" strokeLinecap="round" />
        <text x="43" y="5" fontSize="14" fontWeight="900" fill="#be123c">Natalité</text>
        <line x1="145" y1="0" x2="179" y2="0" stroke="#8b5cf6" strokeWidth="7" strokeLinecap="round" />
        <text x="188" y="5" fontSize="14" fontWeight="900" fill="#6d28d9">Mortalité</text>
      </g>
      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const y = margin.top + plotHeight - ratio * plotHeight;
        return <g key={ratio}><line x1={margin.left} y1={y} x2={width - margin.right} y2={y} stroke="#e2e8f0" strokeWidth="2" /><text x={margin.left - 8} y={y + 5} textAnchor="end" fontSize="12" fontWeight="800" fill="#64748b">{Math.round(maxValue * ratio)}</text></g>;
      })}
      <text x="8" y="49" fontSize="11" fontWeight="900" fill="#475569">‰</text>
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + plotHeight} stroke="#0f172a" strokeWidth="3" />
      <line x1={margin.left} y1={margin.top + plotHeight} x2={width - margin.right} y2={margin.top + plotHeight} stroke="#0f172a" strokeWidth="3" />
      {item.years.map((year, index) => <text key={year} x={natalityPoints[index].x} y={height - 14} textAnchor="middle" fontSize="12" fontWeight="800" fill="#475569">{year}</text>)}
      <path d={pathFor(natalityPoints)} fill="none" stroke="#fb7185" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d={pathFor(mortalityPoints)} fill="none" stroke="#8b5cf6" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      {natalityPoints.map((point, index) => <circle key={`n-${item.years[index]}`} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#fb7185" strokeWidth="3" />)}
      {mortalityPoints.map((point, index) => <circle key={`m-${item.years[index]}`} cx={point.x} cy={point.y} r="4" fill="#fff" stroke="#8b5cf6" strokeWidth="3" />)}
    </svg>
  </div>;
}

const curveTextMatches = (actual, expected, tolerance = 0) => {
  const a = normalizeAnswer(actual).replace(/millions?|habitants?/g, '').trim();
  const e = normalizeAnswer(expected).replace(/millions?|habitants?/g, '').trim();
  const actualNumber = Number.parseFloat(a.replace(',', '.'));
  const expectedNumber = Number.parseFloat(e.replace(',', '.'));
  if (tolerance > 0 && Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)) {
    return Math.abs(actualNumber - expectedNumber) <= tolerance;
  }
  return Boolean(a && e && (a === e || a.split(/\s+/).includes(e)));
};

const demographicExerciseIsCorrect = (item, answer = {}) => {
  const expected = item.expected || {};
  if (item.type === 'natural-balance') {
    return answer.relation === expected.relation && answer.evolution === expected.evolution && answer.balance === expected.balance;
  }
  const valueTolerance = item.approximate ? Number(item.tolerance || 5) : 0;
  const common = curveTextMatches(answer.startYear, expected.startYear)
    && curveTextMatches(answer.endYear, expected.endYear)
    && answer.trend === expected.trend
    && curveTextMatches(answer.startValue, expected.startValue, valueTolerance);
  return common && (expected.trend === 'stagne' || curveTextMatches(answer.endValue, expected.endValue, valueTolerance));
};

const FIFTH_GRADE_MAP_QUESTIONS = [
  { id: 'no-title', missing: 'titre', title: false, legend: true, scale: true },
  { id: 'no-legend', missing: 'légende', title: true, legend: false, scale: true },
  { id: 'no-scale', missing: 'échelle', title: true, legend: true, scale: false },
  { id: 'no-orientation', missing: 'orientation', title: true, legend: true, scale: true, orientation: false },
  { id: 'complete', missing: 'rien', title: true, legend: true, scale: true, orientation: true }
];

function FifthGradeWorldMap({ learning = false, imageUrl = '', markers = FIFTH_GRADE_WORLD_MARKERS, editable = false, onPlace }) {
  return (
    <div
      className={`relative overflow-hidden rounded-3xl border-4 border-sky-200 bg-sky-100 shadow-inner ${editable ? 'cursor-crosshair' : ''}`}
      style={{ aspectRatio: '2 / 1' }}
      onClick={(event) => {
        if (!editable || !onPlace) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onPlace({
          x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
          y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
        });
      }}
    >
      {imageUrl ? <img src={imageUrl} alt="Carte du monde ajoutée pour l'entraînement" className="absolute inset-0 h-full w-full object-contain" /> : <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 500" aria-label="Planisphère simplifié">
        <rect width="1000" height="500" fill="#dff5ff" />
        <path d="M86 120 L175 70 260 105 240 165 275 210 230 258 190 230 150 285 112 250 128 190 78 165Z" fill="#86d39a" stroke="#fff" strokeWidth="5" />
        <path d="M210 265 L265 282 280 350 245 425 210 390 190 320Z" fill="#69c884" stroke="#fff" strokeWidth="5" />
        <path d="M440 125 L505 105 545 135 520 175 470 166Z" fill="#ffd66b" stroke="#fff" strokeWidth="5" />
        <path d="M452 178 L525 170 558 252 520 352 465 322 438 240Z" fill="#f6b867" stroke="#fff" strokeWidth="5" />
        <path d="M520 103 L670 68 835 120 882 212 810 270 700 230 632 172 545 160Z" fill="#f4ca55" stroke="#fff" strokeWidth="5" />
        <path d="M755 300 L842 292 900 342 850 395 765 370Z" fill="#c6a4e8" stroke="#fff" strokeWidth="5" />
        <path d="M155 442 Q500 402 850 444 L805 482 195 482Z" fill="#d8e4ee" stroke="#fff" strokeWidth="5" />
      </svg>}
      {markers.map((marker) => (
        <div
          key={marker.id}
          className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ${marker.kind === 'ocean' ? 'bg-blue-600 text-white' : 'bg-emerald-700 text-white'}`}
          style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
        >
          <span className="flex h-7 min-w-7 items-center justify-center px-1 text-[11px] font-black">
            {learning ? marker.answer.replace('Océan ', '') : marker.id}
          </span>
        </div>
      ))}
    </div>
  );
}

function FifthGradeCompass({ learning = false }) {
  const labels = { top: 'Nord', right: 'Est', bottom: 'Sud', left: 'Ouest' };
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[360px] rounded-full border-4 border-amber-200 bg-amber-50 shadow-inner">
      <svg className="absolute inset-[15%] h-[70%] w-[70%]" viewBox="0 0 200 200" aria-label="Rose des vents">
        <circle cx="100" cy="100" r="66" fill="white" stroke="#f59e0b" strokeWidth="4" />
        <polygon points="100,8 119,89 100,75 81,89" fill="#ef4444" />
        <polygon points="192,100 111,119 125,100 111,81" fill="#2563eb" />
        <polygon points="100,192 81,111 100,125 119,111" fill="#2563eb" />
        <polygon points="8,100 89,81 75,100 89,119" fill="#2563eb" />
        <circle cx="100" cy="100" r="12" fill="#0f172a" />
      </svg>
      {Object.entries({ top: ['50%', '5%'], right: ['94%', '50%'], bottom: ['50%', '94%'], left: ['6%', '50%'] }).map(([position, coords]) => (
        <div key={position} className="absolute -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-800 shadow" style={{ left: coords[0], top: coords[1] }}>
          {learning ? labels[position] : '?'}
        </div>
      ))}
    </div>
  );
}

function FifthGradeMiniMap({ title, legend, scale, orientation = true }) {
  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white p-3 shadow-sm">
      <div className="h-8 text-center text-sm font-black text-slate-800">{title ? 'La population de mon territoire' : '\u00a0'}</div>
      <div className="grid grid-cols-[1fr_88px] gap-2">
        <svg className="h-32 w-full rounded-xl bg-sky-50" viewBox="0 0 180 120" aria-hidden="true">
          <path d="M35 20 L120 12 155 48 138 100 62 105 24 70Z" fill="#86efac" stroke="#15803d" strokeWidth="3" />
          <circle cx="75" cy="55" r="13" fill="#ef4444" />
          <path d="M30 92 Q88 60 150 82" fill="none" stroke="#2563eb" strokeWidth="5" />
          {orientation && <g><path d="M158 28 L158 8" stroke="#0f172a" strokeWidth="3" /><polygon points="158,4 152,14 164,14" fill="#0f172a" /><text x="154" y="40" fontSize="11" fontWeight="800">N</text></g>}
        </svg>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-[10px] font-bold text-slate-600">
          {legend ? <><div className="mb-2"><i className="mr-1 inline-block h-3 w-3 rounded-full bg-red-500" />Ville</div><div><i className="mr-1 inline-block h-2 w-5 bg-blue-600" />Fleuve</div></> : null}
        </div>
      </div>
      <div className="mt-2 h-5 text-xs font-black text-slate-600">{scale ? '0 ━━━ 100 km' : '\u00a0'}</div>
    </div>
  );
}

function FifthGradeGeoTraining({ user, canCalibrate: canCalibrateFromProf = false }) {
  const [view, setView] = useState('learn');
  const [checked, setChecked] = useState(false);
  const [worldAnswers, setWorldAnswers] = useState({});
  const [compassAnswers, setCompassAnswers] = useState({});
  const [attributeAnswers, setAttributeAnswers] = useState({});
  const [scaleAnswers, setScaleAnswers] = useState({});
  const [curveAnswers, setCurveAnswers] = useState({});
  const canCalibrate = canCalibrateFromProf || user?.isDeveloper === true || user?.isTestAccount === true;
  const worldMapImageKey = 'condaweb-fifth-grade-world-map-v1';
  const worldMapModelKey = 'condaweb-fifth-grade-world-map-model-v1';
  const customMapsModelKey = 'condaweb-fifth-grade-map-attributes-v1';
  const scaleMapsModelKey = 'condaweb-fifth-grade-geographic-scales-v1';
  const curveMapsModelKey = 'condaweb-fifth-grade-demographic-curves-v1';
  const [worldMapPreview, setWorldMapPreview] = useState('');
  const [worldMapName, setWorldMapName] = useState('');
  const [selectedWorldMarker, setSelectedWorldMarker] = useState(null);
  const [placingWorldMarkers, setPlacingWorldMarkers] = useState(false);
  const [activeWorldMic, setActiveWorldMic] = useState(null);
  const worldRecognitionRef = useRef(null);
  const [worldMarkerPositions, setWorldMarkerPositions] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(worldMapModelKey) || 'null');
      if (Array.isArray(saved?.markers) && saved.markers.length) return saved.markers;
    } catch (_) {}
    return FIFTH_GRADE_WORLD_MARKERS;
  });
  const [customMapQuestions, setCustomMapQuestions] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(customMapsModelKey) || 'null');
      if (Array.isArray(saved?.questions)) return saved.questions;
    } catch (_) {}
    return [];
  });
  const [customMapPreviews, setCustomMapPreviews] = useState({});
  const [maskingMapId, setMaskingMapId] = useState(null);
  const [calibrationStatus, setCalibrationStatus] = useState('');
  const [colorDetectionStatus, setColorDetectionStatus] = useState({});
  const [scaleMapQuestions, setScaleMapQuestions] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(scaleMapsModelKey) || 'null');
      if (Array.isArray(saved?.questions)) return saved.questions;
    } catch (_) {}
    return [];
  });
  const [scaleMapPreviews, setScaleMapPreviews] = useState({});
  const [scaleQuestionOrder, setScaleQuestionOrder] = useState([]);
  const [scaleCalibrationStatus, setScaleCalibrationStatus] = useState('');
  const [curveQuestions, setCurveQuestions] = useState(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(curveMapsModelKey) || 'null');
      if (Array.isArray(saved?.questions)) return saved.questions.map((question, index) => {
        const isGermanTypeTwo = question.type === 'natural-balance'
          && (index === 1 || normalizeAnswer(question.title).includes('allemagne'));
        if (!isGermanTypeTwo || question.expected?.periodStart) return question;
        return { ...question, expected: { ...(question.expected || {}), periodStart: '1970' } };
      });
    } catch (_) {}
    return [];
  });
  const [curvePreviews, setCurvePreviews] = useState({});
  const [curveCalibrationStatus, setCurveCalibrationStatus] = useState('');
  const maskStartRef = useRef(null);
  const maskResizeRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = '';
    loadDnbMethodImage(worldMapImageKey).then((blob) => {
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setWorldMapPreview(objectUrl);
      setWorldMapName(blob.name || 'Carte monde enregistrée');
    }).catch(() => {});
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(worldMapModelKey, JSON.stringify({ markers: worldMarkerPositions }));
    } catch (_) {}
  }, [worldMarkerPositions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(customMapsModelKey, JSON.stringify({ questions: customMapQuestions }));
    } catch (_) {}
  }, [customMapQuestions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(scaleMapsModelKey, JSON.stringify({ questions: scaleMapQuestions }));
    } catch (_) {}
  }, [scaleMapQuestions]);

  useEffect(() => {
    try {
      window.localStorage.setItem(curveMapsModelKey, JSON.stringify({ questions: curveQuestions }));
    } catch (_) {}
  }, [curveQuestions]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/training-config/fifth-grade-map').then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then((payload) => {
      if (!payload?.model || cancelled || !Array.isArray(payload.model.questions)) return;
      setCustomMapQuestions(payload.model.questions);
      setCustomMapPreviews(payload.imageUrls || {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/training-config/fifth-grade-scales').then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then((payload) => {
      if (!payload?.model || cancelled || !Array.isArray(payload.model.questions)) return;
      setScaleMapQuestions(payload.model.questions);
      setScaleMapPreviews(payload.imageUrls || {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/training-config/fifth-grade-curves').then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    }).then((payload) => {
      if (!payload?.model || cancelled || !Array.isArray(payload.model.questions)) return;
      setCurveQuestions(payload.model.questions.map((question, index) => {
        const isGermanTypeTwo = question.type === 'natural-balance'
          && (index === 1 || normalizeAnswer(question.title).includes('allemagne'));
        if (!isGermanTypeTwo || question.expected?.periodStart) return question;
        return { ...question, expected: { ...(question.expected || {}), periodStart: '1970' } };
      }));
      setCurvePreviews(payload.imageUrls || {});
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    Promise.all(customMapQuestions.map(async (question) => {
      if (!question.imageKey || customMapPreviews[question.id]) return;
      try {
        const blob = await loadDnbMethodImage(question.imageKey);
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        setCustomMapPreviews((previous) => ({ ...previous, [question.id]: url }));
      } catch (_) {}
    }));
    return () => { cancelled = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [customMapQuestions]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    Promise.all(scaleMapQuestions.map(async (question) => {
      if (!question.imageKey || scaleMapPreviews[question.id]) return;
      try {
        const blob = await loadDnbMethodImage(question.imageKey);
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        setScaleMapPreviews((previous) => ({ ...previous, [question.id]: url }));
      } catch (_) {}
    }));
    return () => { cancelled = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [scaleMapQuestions]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];
    Promise.all(curveQuestions.map(async (question) => {
      if (!question.imageKey || curvePreviews[question.id]) return;
      try {
        const blob = await loadDnbMethodImage(question.imageKey);
        if (!blob || cancelled) return;
        const url = URL.createObjectURL(blob);
        objectUrls.push(url);
        setCurvePreviews((previous) => ({ ...previous, [question.id]: url }));
      } catch (_) {}
    }));
    return () => { cancelled = true; objectUrls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [curveQuestions]);

  useEffect(() => {
    if (view !== 'scales') return;
    const source = scaleMapQuestions.length ? scaleMapQuestions : FIFTH_GRADE_SCALE_QUESTIONS;
    setScaleQuestionOrder(source.map((item) => item.id).sort(() => Math.random() - 0.5));
    setScaleAnswers({});
    setChecked(false);
  }, [view, scaleMapQuestions.length]);

  const uploadWorldMap = async (file) => {
    if (!file) return;
    await saveDnbMethodImage(worldMapImageKey, file);
    if (worldMapPreview) URL.revokeObjectURL(worldMapPreview);
    setWorldMapPreview(URL.createObjectURL(file));
    setWorldMapName(file.name);
  };

  const addCustomMap = async (file) => {
    if (!file) return;
    const id = `fifth-map-${Date.now()}`;
    const imageKey = `${customMapsModelKey}:${id}`;
    await saveDnbMethodImage(imageKey, file);
    const previewUrl = URL.createObjectURL(file);
    setCustomMapPreviews((previous) => ({ ...previous, [id]: previewUrl }));
    const dimensions = await new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth || 4, height: image.naturalHeight || 3 });
      image.onerror = () => resolve({ width: 4, height: 3 });
      image.src = previewUrl;
    });
    setCustomMapQuestions((previous) => [...previous, { id, imageKey, name: file.name, missing: 'titre', mask: null, displayWidth: 100, aspectRatio: dimensions.width / dimensions.height }]);
    setChecked(false);
  };

  const addScaleMaps = async (files) => {
    for (const file of Array.from(files || [])) {
      if (!file) continue;
      const id = `fifth-scale-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const imageKey = `${scaleMapsModelKey}:${id}`;
      await saveDnbMethodImage(imageKey, file);
      const previewUrl = URL.createObjectURL(file);
      setScaleMapPreviews((previous) => ({ ...previous, [id]: previewUrl }));
      const dimensions = await new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth || 4, height: image.naturalHeight || 3 });
        image.onerror = () => resolve({ width: 4, height: 3 });
        image.src = previewUrl;
      });
      setScaleMapQuestions((previous) => [...previous, {
        id, imageKey, name: file.name, title: file.name.replace(/\.[^.]+$/, ''), answer: 'mondiale', aspectRatio: dimensions.width / dimensions.height
      }]);
    }
    setChecked(false);
  };

  const addCurveExercise = async (file, type) => {
    if (!file) return;
    const id = `fifth-curve-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const imageKey = `${curveMapsModelKey}:${id}`;
    await saveDnbMethodImage(imageKey, file);
    setCurvePreviews((previous) => ({ ...previous, [id]: URL.createObjectURL(file) }));
    const expected = type === 'natural-balance'
      ? { periodStart: '', relation: 'superieure', evolution: 'augmente', balance: 'positif' }
      : { startYear: '', endYear: '', trend: 'augmente', startValue: '', endValue: '' };
    setCurveQuestions((previous) => [...previous, { id, imageKey, name: file.name, title: file.name.replace(/\.[^.]+$/, ''), type, expected }]);
    setChecked(false);
  };

  const updateCurveQuestion = (id, patch) => {
    setCurveQuestions((previous) => previous.map((question) => question.id === id ? { ...question, ...patch } : question));
    setChecked(false);
  };

  const updateCurveExpected = (item, field, value) => updateCurveQuestion(item.id, { expected: { ...(item.expected || {}), [field]: value } });

  const saveCurveQuestionsToDatabase = async () => {
    setCurveCalibrationStatus('Enregistrement…');
    try {
      const formData = new FormData();
      formData.append('model', JSON.stringify({ questions: curveQuestions }));
      for (const question of curveQuestions) {
        let blob = null;
        try { blob = await loadDnbMethodImage(question.imageKey); } catch (_) {}
        if (!blob && curvePreviews[question.id]) {
          const response = await fetch(curvePreviews[question.id]);
          if (response.ok) blob = await response.blob();
        }
        if (blob) formData.append('images', blob, `${question.id}__${question.name || 'courbe.png'}`);
      }
      const response = await fetch('/api/training-config/fifth-grade-curves', { method: 'PUT', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Enregistrement impossible');
      setCurveCalibrationStatus(`✓ ${payload.questions} exercice(s) enregistré(s) en BDD`);
    } catch (error) {
      setCurveCalibrationStatus(`Échec : ${error.message}`);
    }
  };

  const updateScaleMap = (id, patch) => {
    setScaleMapQuestions((previous) => previous.map((question) => question.id === id ? { ...question, ...patch } : question));
    setChecked(false);
  };

  const saveScaleMapsToDatabase = async () => {
    setScaleCalibrationStatus('Enregistrement…');
    try {
      const formData = new FormData();
      formData.append('model', JSON.stringify({ questions: scaleMapQuestions }));
      for (const question of scaleMapQuestions) {
        let blob = null;
        try { blob = await loadDnbMethodImage(question.imageKey); } catch (_) {}
        if (!blob && scaleMapPreviews[question.id]) {
          const response = await fetch(scaleMapPreviews[question.id]);
          if (response.ok) blob = await response.blob();
        }
        if (blob) formData.append('images', blob, `${question.id}__${question.name || 'carte.png'}`);
      }
      const response = await fetch('/api/training-config/fifth-grade-scales', { method: 'PUT', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Enregistrement impossible');
      setScaleCalibrationStatus(`✓ ${payload.questions} carte(s) enregistrée(s) en BDD`);
    } catch (error) {
      setScaleCalibrationStatus(`Échec : ${error.message}`);
    }
  };

  const updateCustomMap = (id, patch) => {
    setCustomMapQuestions((previous) => previous.map((question) => question.id === id ? { ...question, ...patch } : question));
    setChecked(false);
  };

  const saveCustomMapsToDatabase = async () => {
    setCalibrationStatus('Enregistrement…');
    try {
      const formData = new FormData();
      formData.append('model', JSON.stringify({ questions: customMapQuestions }));
      for (const question of customMapQuestions) {
        let blob = null;
        try { blob = await loadDnbMethodImage(question.imageKey); } catch (_) {}
        if (!blob && customMapPreviews[question.id]) {
          const response = await fetch(customMapPreviews[question.id]);
          if (response.ok) blob = await response.blob();
        }
        if (blob) formData.append('images', blob, `${question.id}__${question.name || 'carte.png'}`);
      }
      const response = await fetch('/api/training-config/fifth-grade-map', { method: 'PUT', body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Enregistrement impossible');
      setCalibrationStatus(`✓ Calibré en BDD : ${payload.questions} carte(s)`);
    } catch (error) {
      setCalibrationStatus(`Échec : ${error.message}`);
    }
  };

  const pointInMap = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
    };
  };

  const beginMapMask = (event, id) => {
    if (maskingMapId !== id) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    maskStartRef.current = pointInMap(event);
  };

  const finishMapMask = (event, id) => {
    if (maskingMapId !== id || !maskStartRef.current) return;
    const end = pointInMap(event);
    const start = maskStartRef.current;
    maskStartRef.current = null;
    const mask = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.max(3, Math.abs(end.x - start.x)),
        height: Math.max(3, Math.abs(end.y - start.y)),
        color: '#ffffff'
      };
    updateCustomMap(id, { mask });
    setMaskingMapId(null);
    const question = customMapQuestions.find((item) => item.id === id);
    if (question) setTimeout(() => detectSurroundingMaskColor({ ...question, mask }), 0);
  };

  const detectSurroundingMaskColor = async (question) => {
    const source = customMapPreviews[question.id];
    if (!source || !question.mask) {
      setColorDetectionStatus((previous) => ({ ...previous, [question.id]: 'Image ou cache indisponible' }));
      return;
    }
    setColorDetectionStatus((previous) => ({ ...previous, [question.id]: 'Analyse…' }));
    try {
      const image = await new Promise((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = reject;
        element.src = source;
      });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const mask = question.mask;
      const left = Math.round((mask.x / 100) * canvas.width);
      const top = Math.round((mask.y / 100) * canvas.height);
      const right = Math.round(((mask.x + mask.width) / 100) * canvas.width);
      const bottom = Math.round(((mask.y + mask.height) / 100) * canvas.height);
      const thickness = Math.max(3, Math.round(Math.min(canvas.width, canvas.height) * 0.012));
      const samples = [];
      const addPixel = (x, y) => {
        if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
        const pixel = context.getImageData(x, y, 1, 1).data;
        if (pixel[3] < 180) return;
        const lightness = (pixel[0] + pixel[1] + pixel[2]) / 3;
        if (lightness < 35) return;
        samples.push([pixel[0], pixel[1], pixel[2]]);
      };
      const step = Math.max(1, Math.round(Math.max(canvas.width, canvas.height) / 650));
      for (let x = left + thickness; x <= right - thickness; x += step) for (let offset = 1; offset <= thickness; offset += step) { addPixel(x, top - offset); addPixel(x, bottom + offset); }
      for (let y = top + thickness; y <= bottom - thickness; y += step) for (let offset = 1; offset <= thickness; offset += step) { addPixel(left - offset, y); addPixel(right + offset, y); }
      if (!samples.length) throw new Error('Aucun pixel lisible autour du cache');
      const coloredSamples = samples.filter(([red, green, blue]) => {
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        return max - min > 10 && !(red > 246 && green > 246 && blue > 246);
      });
      const usefulSamples = coloredSamples.length >= Math.max(5, samples.length * 0.12) ? coloredSamples : samples;
      const median = (channel) => {
        const values = usefulSamples.map((sample) => sample[channel]).sort((a, b) => a - b);
        return values[Math.floor(values.length / 2)];
      };
      const red = median(0);
      const green = median(1);
      const blue = median(2);
      const color = `rgb(${red}, ${green}, ${blue})`;
      updateCustomMap(question.id, { mask: { ...question.mask, color } });
      setColorDetectionStatus((previous) => ({ ...previous, [question.id]: `Couleur détectée : ${color}` }));
    } catch (error) {
      setColorDetectionStatus((previous) => ({ ...previous, [question.id]: `Échec : ${error.message || 'couleur illisible'}` }));
    }
  };

  const beginMaskResize = (event, question) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const board = event.currentTarget.closest('[data-custom-map-board]');
    maskResizeRef.current = { id: question.id, startX: event.clientX, startY: event.clientY, boardRect: board?.getBoundingClientRect(), mask: { ...question.mask } };
  };

  const resizeMapMask = (event) => {
    const current = maskResizeRef.current;
    if (!current?.boardRect) return;
    event.preventDefault();
    event.stopPropagation();
    const width = Math.max(3, Math.min(100 - current.mask.x, current.mask.width + ((event.clientX - current.startX) / current.boardRect.width) * 100));
    const height = Math.max(3, Math.min(100 - current.mask.y, current.mask.height + ((event.clientY - current.startY) / current.boardRect.height) * 100));
    updateCustomMap(current.id, { mask: { ...current.mask, width, height } });
  };

  const finishMaskResize = (event) => {
    const current = maskResizeRef.current;
    if (!current) return;
    resizeMapMask(event);
    maskResizeRef.current = null;
    const question = customMapQuestions.find((item) => item.id === current.id);
    if (question) setTimeout(() => {
      const latest = customMapQuestions.find((item) => item.id === current.id) || question;
      detectSurroundingMaskColor(latest);
    }, 0);
  };

  const detectWorldMarkers = () => {
    setWorldMarkerPositions(FIFTH_GRADE_WORLD_MARKERS.map((marker) => ({ ...marker })));
    setSelectedWorldMarker(null);
    setPlacingWorldMarkers(false);
  };

  const placeSelectedWorldMarker = (position) => {
    if (!selectedWorldMarker) return;
    setWorldMarkerPositions((previous) => previous.map((marker) => marker.id === selectedWorldMarker ? { ...marker, ...position } : marker));
    if (placingWorldMarkers) {
      const currentIndex = worldMarkerPositions.findIndex((marker) => marker.id === selectedWorldMarker);
      const nextMarker = worldMarkerPositions[currentIndex + 1];
      if (nextMarker) setSelectedWorldMarker(nextMarker.id);
      else {
        setSelectedWorldMarker(null);
        setPlacingWorldMarkers(false);
      }
    }
  };

  const startPlacingWorldMarkers = () => {
    setPlacingWorldMarkers(true);
    setSelectedWorldMarker(worldMarkerPositions[0]?.id || null);
  };

  const resetCheck = (nextView) => {
    setView(nextView);
    setChecked(false);
  };
  const startWorldDictation = (markerId) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      window.alert('Micro non disponible. Utilise Chrome ou écris la réponse au clavier.');
      return;
    }
    try { worldRecognitionRef.current?.stop?.(); } catch (_) {}
    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || []).map((result) => result?.[0]?.transcript || '').join(' ').replace(/\s+/g, ' ').trim();
      if (!transcript) return;
      setWorldAnswers((previous) => ({ ...previous, [markerId]: transcript }));
      setChecked(false);
    };
    recognition.onerror = () => {
      setActiveWorldMic(null);
      worldRecognitionRef.current = null;
    };
    recognition.onend = () => {
      setActiveWorldMic(null);
      worldRecognitionRef.current = null;
    };
    worldRecognitionRef.current = recognition;
    setActiveWorldMic(markerId);
    recognition.start();
  };

  const compassExpected = { top: 'Nord', right: 'Est', bottom: 'Sud', left: 'Ouest' };
  const activeMapQuestions = customMapQuestions.length ? customMapQuestions : FIFTH_GRADE_MAP_QUESTIONS;
  const activeScaleQuestions = scaleMapQuestions.length ? scaleMapQuestions : FIFTH_GRADE_SCALE_QUESTIONS;
  const activeCurveQuestions = (() => {
    const configured = curveQuestions.length
      ? [...curveQuestions, ...(curveQuestions.some((item) => item.type === 'evolution') ? [] : FIFTH_GRADE_CURVE_FALLBACK)]
      : FIFTH_GRADE_CURVE_FALLBACK;
    const fillToFive = (type, supplements) => {
      const selected = configured.filter((item) => item.type === type);
      const selectedIds = new Set(selected.map((item) => item.id));
      return [...selected, ...supplements.filter((item) => !selectedIds.has(item.id))].slice(0, 5);
    };
    return [
      ...fillToFive('evolution', FIFTH_GRADE_EVOLUTION_CURVE_SUPPLEMENTS),
      ...fillToFive('natural-balance', FIFTH_GRADE_NATURAL_BALANCE_CURVES)
    ];
  })();
  const orderedScaleQuestions = scaleQuestionOrder.length
    ? scaleQuestionOrder.map((id) => activeScaleQuestions.find((item) => item.id === id)).filter(Boolean)
    : activeScaleQuestions;
  const exerciseConfig = view === 'world'
    ? { total: FIFTH_GRADE_WORLD_MARKERS.length, correct: FIFTH_GRADE_WORLD_MARKERS.filter((item) => fifthGradeWorldAnswerMatches(worldAnswers[item.id], item.answer)).length }
    : view === 'compass'
      ? { total: 4, correct: Object.entries(compassExpected).filter(([key, value]) => compassAnswers[key] === value).length }
      : view === 'attributes'
        ? { total: activeMapQuestions.length, correct: activeMapQuestions.filter((item) => attributeAnswers[item.id] === item.missing).length }
        : view === 'scales'
          ? { total: activeScaleQuestions.length, correct: activeScaleQuestions.filter((item) => scaleAnswers[item.id] === item.answer).length }
          : view === 'curves'
            ? { total: activeCurveQuestions.length, correct: activeCurveQuestions.filter((item) => demographicExerciseIsCorrect(item, curveAnswers[item.id])).length }
          : null;

  const answerClass = (isCorrect) => checked ? (isCorrect ? 'border-emerald-400 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-slate-200 bg-white';

  const validateCurrentExercise = () => {
    setChecked(true);
    if (!exerciseConfig) return;
    reportTrainingScore(`5e-geo-${view}`, exerciseConfig.correct, exerciseConfig.total);
  };

  return (
    <section className="training-responsive mx-3 flex flex-col gap-4 pb-10">
      <TrainingPointsBadge user={user} />
      <header className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-5 shadow-sm">
        <div className="text-[11px] font-black uppercase tracking-wider text-emerald-600">5e · Géographie</div>
        <h2 className="m-0 text-3xl font-black text-slate-900">Entraînement</h2>
        <p className="mt-2 text-sm font-bold text-slate-600">Apprends à lire une carte, puis vérifie tes repères avec les quatre ateliers.</p>
        <nav className="mt-4 flex flex-wrap gap-2">
          {[
            ['learn', '📖 Apprendre'], ['world', '🌍 Continents et océans'], ['compass', '🧭 Points cardinaux'],
            ['attributes', '🗺️ Attributs de la carte'], ['scales', '🔎 Échelles géographiques'],
            ['curves', '📈 Courbes démographiques']
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => resetCheck(key)} className={`rounded-2xl border px-4 py-3 text-sm font-black ${view === key ? 'border-emerald-700 bg-emerald-600 text-white' : 'border-white bg-white text-slate-700 shadow-sm'}`}>{label}</button>
          ))}
        </nav>
      </header>

      {view === 'learn' && (
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-3xl border border-sky-200 bg-white p-5">
            <h3 className="m-0 text-xl font-black text-slate-900">1. Continents et océans</h3>
            <p className="text-sm font-bold text-slate-500">Vert : les continents · Bleu : les océans.</p>
            <FifthGradeWorldMap learning imageUrl={worldMapPreview} markers={worldMarkerPositions} />
          </article>
          <article className="rounded-3xl border border-amber-200 bg-white p-5">
            <h3 className="m-0 text-xl font-black text-slate-900">2. Les points cardinaux</h3>
            <p className="text-sm font-bold text-slate-500">Nord en haut, Est à droite, Sud en bas, Ouest à gauche.</p>
            <FifthGradeCompass learning />
          </article>
          <article className="rounded-3xl border border-violet-200 bg-white p-5">
            <h3 className="m-0 text-xl font-black text-slate-900">3. Les attributs indispensables</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[['Titre', 'Il indique le sujet de la carte.'], ['Légende', 'Elle explique les couleurs et les symboles.'], ['Échelle', 'Elle relie la distance sur la carte à la distance réelle.'], ['Orientation', 'Elle indique le Nord et permet de se repérer.']].map(([title, text]) => <div key={title} className="rounded-2xl bg-violet-50 p-4"><div className="font-black text-violet-800">{title}</div><div className="mt-1 text-sm font-bold text-slate-600">{text}</div></div>)}
            </div>
          </article>
          <article className="rounded-3xl border border-indigo-200 bg-white p-5">
            <h3 className="m-0 text-xl font-black text-slate-900">4. Les échelles géographiques</h3>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-2">
              {FIFTH_GRADE_SCALE_LEVELS.map((level) => <div key={level.id} className="rounded-2xl bg-indigo-50 p-3"><div className="text-xl">{level.icon}</div><div className="text-sm font-black text-indigo-900">{level.label}</div><div className="text-[11px] font-bold text-slate-500">{level.example}</div></div>)}
            </div>
          </article>
          <article className="rounded-3xl border border-fuchsia-200 bg-white p-5 xl:col-span-2">
            <h3 className="m-0 text-xl font-black text-slate-900">5. Lire une courbe démographique</h3>
            <div className="mt-4 grid items-center gap-4 lg:grid-cols-[1fr_1.1fr]">
              <FifthGradeDemographicCurve item={FIFTH_GRADE_DEMOGRAPHIC_CURVES[0]} compact />
              <div className="grid gap-2 text-sm font-bold text-slate-600">
                <div className="rounded-xl bg-fuchsia-50 p-3"><strong className="text-fuchsia-800">1.</strong> Lis le titre et l’unité : ici, la population est exprimée en millions.</div>
                <div className="rounded-xl bg-fuchsia-50 p-3"><strong className="text-fuchsia-800">2.</strong> Repère l’année sur l’axe horizontal.</div>
                <div className="rounded-xl bg-fuchsia-50 p-3"><strong className="text-fuchsia-800">3.</strong> Remonte jusqu’à la courbe puis lis la valeur sur l’axe vertical.</div>
                <div className="rounded-xl bg-fuchsia-50 p-3"><strong className="text-fuchsia-800">4.</strong> Observe enfin si la courbe augmente, diminue ou reste stable.</div>
              </div>
            </div>
          </article>
        </div>
      )}

      {view === 'world' && (
        <article className="rounded-3xl border border-sky-200 bg-white p-5">
          <h3 className="m-0 text-2xl font-black text-slate-900">Nomme les repères numérotés</h3>
          {canCalibrate && <div className="mt-4 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><div className="text-[10px] font-black uppercase text-amber-700">Calibrage du repère</div><div className="text-sm font-black text-slate-800">{worldMapName || 'Le planisphère intégré est utilisé actuellement.'}</div></div>
              <div className="flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-xl bg-sky-600 px-4 py-3 text-xs font-black text-white">+ Ajouter une carte monde<input type="file" accept="image/*" className="hidden" onChange={(event) => uploadWorldMap(event.target.files?.[0])} /></label>
                <button type="button" onClick={detectWorldMarkers} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">✦ Détection automatique</button>
                <button type="button" onClick={startPlacingWorldMarkers} className={`rounded-xl px-4 py-3 text-xs font-black text-white ${placingWorldMarkers ? 'bg-amber-600 ring-4 ring-amber-200' : 'bg-slate-900'}`}>📍 Placer les points</button>
                {placingWorldMarkers && <button type="button" onClick={() => { setPlacingWorldMarkers(false); setSelectedWorldMarker(null); }} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-black text-slate-700">Terminer</button>}
              </div>
            </div>
            <p className="mb-2 mt-3 text-xs font-bold text-amber-800">La détection place automatiquement les continents et océans. Pour corriger un repère, sélectionne son nom puis clique sur sa position dans la carte.</p>
            <div className="flex flex-wrap gap-1.5">{worldMarkerPositions.map((marker) => <button key={`calibrate-${marker.id}`} type="button" onClick={() => { setPlacingWorldMarkers(false); setSelectedWorldMarker(marker.id); }} className={`rounded-lg border px-2.5 py-2 text-[10px] font-black ${selectedWorldMarker === marker.id ? 'border-amber-600 bg-amber-500 text-white' : 'border-amber-200 bg-white text-slate-700'}`}>{marker.id}. {marker.answer}</button>)}</div>
          </div>}
          <div className="mt-4 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <div>
              <FifthGradeWorldMap imageUrl={worldMapPreview} markers={worldMarkerPositions} editable={canCalibrate && Boolean(selectedWorldMarker)} onPlace={placeSelectedWorldMarker} />
              {canCalibrate && selectedWorldMarker && <div className="mt-2 rounded-xl bg-amber-100 p-2 text-center text-xs font-black text-amber-800">Clique maintenant sur la carte pour placer : {worldMarkerPositions.find((marker) => marker.id === selectedWorldMarker)?.answer}</div>}
            </div>
            <div className="grid max-h-[620px] grid-cols-1 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-1">
              {FIFTH_GRADE_WORLD_MARKERS.map((marker) => {
                const isCorrect = fifthGradeWorldAnswerMatches(worldAnswers[marker.id], marker.answer);
                return <div key={marker.id} className={`rounded-xl border p-2 ${answerClass(isCorrect)}`}>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">{marker.id}</span>
                    <input
                      type="text"
                      autoComplete="off"
                      spellCheck="false"
                      className="min-w-0 flex-1 bg-transparent px-1 text-sm font-black outline-none"
                      value={worldAnswers[marker.id] || ''}
                      placeholder={marker.kind === 'ocean' ? "Nom de l'océan" : 'Nom du continent'}
                      onChange={(event) => { setWorldAnswers((old) => ({ ...old, [marker.id]: event.target.value })); setChecked(false); }}
                    />
                    <button type="button" onClick={() => startWorldDictation(marker.id)} title="Répondre avec le micro" aria-label={`Dicter la réponse ${marker.id}`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base ${activeWorldMic === marker.id ? 'animate-pulse bg-red-500 text-white' : 'bg-sky-100 text-sky-700'}`}>{activeWorldMic === marker.id ? '■' : '🎙️'}</button>
                  </div>
                  {checked && !isCorrect && <div className="mt-1 pl-10 text-[10px] font-black text-red-600">Réponse attendue : {marker.answer}</div>}
                </div>;
              })}
            </div>
          </div>
        </article>
      )}

      {view === 'compass' && (
        <article className="rounded-3xl border border-amber-200 bg-white p-5">
          <h3 className="m-0 text-2xl font-black text-slate-900">Place les quatre points cardinaux</h3>
          <div className="mt-5 grid items-center gap-6 md:grid-cols-2"><FifthGradeCompass /><div className="grid gap-3">{Object.entries({ top: 'En haut', right: 'À droite', bottom: 'En bas', left: 'À gauche' }).map(([key, label]) => <label key={key} className={`rounded-2xl border p-3 ${answerClass(compassAnswers[key] === compassExpected[key])}`}><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span><select className="w-full bg-transparent font-black outline-none" value={compassAnswers[key] || ''} onChange={(e) => { setCompassAnswers((old) => ({ ...old, [key]: e.target.value })); setChecked(false); }}><option value="">Choisir…</option>{Object.values(compassExpected).map((value) => <option key={value}>{value}</option>)}</select></label>)}</div></div>
        </article>
      )}

      {view === 'attributes' && (
        <article className="rounded-3xl border border-violet-200 bg-white p-5">
          <h3 className="m-0 text-2xl font-black text-slate-900">Quel attribut manque sur chaque carte ?</h3>
          {canCalibrate && <div className="mt-4 rounded-2xl border-2 border-dashed border-violet-300 bg-violet-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase text-violet-600">Calibrage professeur</div><div className="text-sm font-black text-slate-800">Ajoute tes cartes, masque l’attribut et définis la réponse attendue.</div></div><label className="cursor-pointer rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">+ Ajouter une carte<input type="file" accept="image/*" className="hidden" onChange={(event) => addCustomMap(event.target.files?.[0])} /></label></div>
          </div>}
          <div className="mt-5 flex flex-wrap items-start gap-4">{activeMapQuestions.map((item, index) => {
            const isCustom = Boolean(item.imageKey);
            const containerWidth = isCustom ? Math.max(34, Math.min(100, ((item.displayWidth || 100) / 160) * 100)) : 24;
            return <div key={item.id} className={`min-w-[280px] rounded-2xl border p-3 ${answerClass(attributeAnswers[item.id] === item.missing)}`} style={{ flex: `0 0 calc(${containerWidth}% - 1rem)`, maxWidth: '100%' }}>
              <div className="mb-2 flex items-center justify-between gap-2"><div className="text-xs font-black uppercase text-violet-600">Carte {index + 1}</div>{canCalibrate && isCustom && <button type="button" onClick={() => { setCustomMapQuestions((previous) => previous.filter((question) => question.id !== item.id)); setMaskingMapId(null); }} className="text-[10px] font-black text-red-500">Supprimer</button>}</div>
              {isCustom ? <div className="flex w-full justify-center rounded-2xl bg-slate-100 p-2"><div
                data-custom-map-board
                className={`relative w-full touch-none overflow-hidden rounded-2xl border-2 bg-white ${maskingMapId === item.id ? 'cursor-crosshair border-violet-500' : 'border-slate-200'}`}
                style={{ aspectRatio: item.aspectRatio || (4 / 3) }}
                onPointerDown={(event) => beginMapMask(event, item.id)}
                onPointerUp={(event) => finishMapMask(event, item.id)}
              >
                {customMapPreviews[item.id] ? <img src={customMapPreviews[item.id]} alt={`Carte personnalisée ${index + 1}`} className="h-full w-full object-fill" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Chargement de la carte…</div>}
                {item.mask && <div className="pointer-events-none absolute z-10 border border-slate-300 shadow-sm" style={{ left: `${item.mask.x}%`, top: `${item.mask.y}%`, width: `${item.mask.width}%`, height: `${item.mask.height}%`, backgroundColor: item.mask.color || '#ffffff' }} />}
              </div></div> : <FifthGradeMiniMap {...item} />}
              {canCalibrate && isCustom && <div className="mt-2 space-y-2 rounded-xl bg-violet-50 p-2">
                <label className="block text-[10px] font-black text-violet-800">Taille de la carte : {Math.round(item.displayWidth || 100)} %<input type="range" min="45" max="160" step="1" value={item.displayWidth || 100} onChange={(event) => updateCustomMap(item.id, { displayWidth: Number(event.target.value) })} className="mt-1 w-full accent-violet-600" /></label>
                <button type="button" onClick={() => setMaskingMapId(item.id)} className={`w-full rounded-lg px-3 py-2 text-[10px] font-black ${maskingMapId === item.id ? 'bg-violet-600 text-white' : 'bg-white text-violet-700'}`}>{maskingMapId === item.id ? 'Trace le cache sur la carte…' : '▭ Définir le cache'}</button>
                {item.mask && <div className="grid grid-cols-2 gap-2"><label className="text-[9px] font-black text-violet-800">Largeur du cache<input type="range" min="3" max={Math.max(3, 100 - item.mask.x)} step="0.5" value={item.mask.width} onChange={(event) => updateCustomMap(item.id, { mask: { ...item.mask, width: Number(event.target.value) } })} className="mt-1 w-full accent-violet-600" /></label><label className="text-[9px] font-black text-violet-800">Hauteur du cache<input type="range" min="3" max={Math.max(3, 100 - item.mask.y)} step="0.5" value={item.mask.height} onChange={(event) => updateCustomMap(item.id, { mask: { ...item.mask, height: Number(event.target.value) } })} className="mt-1 w-full accent-violet-600" /></label></div>}
                <select value={item.missing} onChange={(event) => updateCustomMap(item.id, { missing: event.target.value })} className="w-full rounded-lg border border-violet-200 bg-white p-2 text-[10px] font-black"><option value="titre">Réponse : titre</option><option value="légende">Réponse : légende</option><option value="échelle">Réponse : échelle</option><option value="orientation">Réponse : orientation</option><option value="rien">Réponse : rien</option></select>
                {item.mask && <button type="button" onClick={() => detectSurroundingMaskColor(item)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-sky-100 px-3 py-2 text-[10px] font-black text-sky-700"><span className="h-4 w-4 rounded border border-slate-300" style={{ backgroundColor: item.mask.color || '#ffffff' }} />🎨 Détecter la couleur autour</button>}
                {item.mask && colorDetectionStatus[item.id] && <div className={`text-center text-[9px] font-black ${colorDetectionStatus[item.id].startsWith('Échec') ? 'text-red-600' : 'text-sky-700'}`}>{colorDetectionStatus[item.id]}</div>}
                {item.mask && <button type="button" onClick={() => updateCustomMap(item.id, { mask: null })} className="w-full text-[10px] font-black text-red-500">Retirer le cache</button>}
              </div>}
              <select className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-black" value={attributeAnswers[item.id] || ''} onChange={(e) => { setAttributeAnswers((old) => ({ ...old, [item.id]: e.target.value })); setChecked(false); }}><option value="">Il manque…</option>{['titre', 'légende', 'échelle', 'orientation', 'rien'].map((value) => <option key={value} value={value}>{value === 'rien' ? 'Rien : la carte est complète' : value}</option>)}</select>
            </div>;
          })}</div>
          {canCalibrate && customMapQuestions.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><button type="button" onClick={saveCustomMapsToDatabase} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">✓ Calibré — enregistrer en BDD</button>{calibrationStatus && <span className={`text-sm font-black ${calibrationStatus.startsWith('Échec') ? 'text-red-600' : 'text-emerald-700'}`}>{calibrationStatus}</span>}</div>}
        </article>
      )}

      {view === 'scales' && (
        <article className="rounded-3xl border border-indigo-200 bg-white p-5">
          <h3 className="m-0 text-2xl font-black text-slate-900">À quelle échelle travaille cette carte ?</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">Les cartes sont mélangées à chaque ouverture de cet atelier.</p>
          {canCalibrate && <div className="mt-4 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase text-indigo-600">Calibrage professeur</div><div className="text-sm font-black text-slate-800">Ajoute une ou plusieurs cartes, puis choisis leur échelle attendue.</div></div><label className="cursor-pointer rounded-xl bg-indigo-600 px-4 py-3 text-xs font-black text-white">+ Ajouter des cartes<input type="file" accept="image/*" multiple className="hidden" onChange={(event) => { addScaleMaps(event.target.files); event.target.value = ''; }} /></label></div></div>}
          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{orderedScaleQuestions.map((item, index) => {
            const isCustom = Boolean(item.imageKey);
            return <div key={item.id} className={`rounded-2xl border p-4 ${answerClass(scaleAnswers[item.id] === item.answer)}`}>
              <div className="mb-2 flex items-center justify-between gap-2"><div className="text-xs font-black uppercase text-indigo-600">Carte {index + 1}</div>{canCalibrate && isCustom && <button type="button" onClick={() => setScaleMapQuestions((previous) => previous.filter((question) => question.id !== item.id))} className="text-[10px] font-black text-red-500">Supprimer</button>}</div>
              {isCustom ? <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-2xl bg-slate-100"><img src={scaleMapPreviews[item.id]} alt={item.title || `Carte ${index + 1}`} className="max-h-[330px] w-full object-contain" /></div> : <div className="text-5xl">{item.icon}</div>}
              {canCalibrate && isCustom ? <input value={item.title || ''} onChange={(event) => updateScaleMap(item.id, { title: event.target.value })} placeholder="Nom facultatif de la carte" className="mt-3 w-full rounded-xl border border-indigo-200 bg-white p-3 text-sm font-black" /> : <div className="mt-3 min-h-[28px] font-black text-slate-900">{item.title}</div>}
              {!isCustom && <div className="mt-1 min-h-[36px] text-xs font-bold text-slate-500">{item.detail}</div>}
              {canCalibrate && isCustom && <label className="mt-3 block rounded-xl bg-indigo-50 p-2 text-[10px] font-black uppercase text-indigo-700">Réponse attendue<select value={item.answer} onChange={(event) => updateScaleMap(item.id, { answer: event.target.value })} className="mt-1 w-full rounded-lg border border-indigo-200 bg-white p-2 text-xs font-black normal-case text-slate-900">{FIFTH_GRADE_SCALE_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select></label>}
              <select className="mt-3 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-black" value={scaleAnswers[item.id] || ''} onChange={(e) => { setScaleAnswers((old) => ({ ...old, [item.id]: e.target.value })); setChecked(false); }}><option value="">Choisir l’échelle…</option>{FIFTH_GRADE_SCALE_LEVELS.map((level) => <option key={level.id} value={level.id}>{level.label}</option>)}</select>
              {checked && scaleAnswers[item.id] !== item.answer && <div className="mt-2 text-xs font-black text-red-600">Réponse attendue : {FIFTH_GRADE_SCALE_LEVELS.find((level) => level.id === item.answer)?.label}</div>}
            </div>;
          })}</div>
          {canCalibrate && scaleMapQuestions.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><button type="button" onClick={saveScaleMapsToDatabase} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">✓ Calibré — enregistrer en BDD</button>{scaleCalibrationStatus && <span className={`text-sm font-black ${scaleCalibrationStatus.startsWith('Échec') ? 'text-red-600' : 'text-emerald-700'}`}>{scaleCalibrationStatus}</span>}</div>}
        </article>
      )}

      {view === 'curves' && (
        <article className="rounded-3xl border border-fuchsia-200 bg-white p-5">
          <h3 className="m-0 text-2xl font-black text-slate-900">Lis les courbes démographiques</h3>
          <p className="mt-2 text-sm font-bold text-slate-500">Observe les axes, les dates et les valeurs, puis complète la phrase entière.</p>
          {canCalibrate && <div className="mt-4 rounded-2xl border-2 border-dashed border-fuchsia-300 bg-fuchsia-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-black uppercase text-fuchsia-700">Calibrage professeur</div><div className="text-sm font-black text-slate-800">Ajoute l’image puis renseigne toutes les réponses attendues.</div></div><div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-xl bg-fuchsia-600 px-4 py-3 text-xs font-black text-white">+ Courbe type 1<input type="file" accept="image/*" className="hidden" onChange={(event) => { addCurveExercise(event.target.files?.[0], 'evolution'); event.target.value = ''; }} /></label><label className="cursor-pointer rounded-xl bg-sky-600 px-4 py-3 text-xs font-black text-white">+ Courbe type 2<input type="file" accept="image/*" className="hidden" onChange={(event) => { addCurveExercise(event.target.files?.[0], 'natural-balance'); event.target.value = ''; }} /></label></div></div><div className="mt-2 text-[11px] font-bold text-slate-600"><strong>Type 1 :</strong> évolution entre deux dates · <strong>Type 2 :</strong> natalité, mortalité et solde naturel.</div></div>}
          <div className="mt-5 grid gap-5 lg:grid-cols-2">{activeCurveQuestions.map((item, index) => {
            const answer = curveAnswers[item.id] || {};
            const isCorrect = demographicExerciseIsCorrect(item, answer);
            const setAnswer = (field, value) => { setCurveAnswers((previous) => ({ ...previous, [item.id]: { ...(previous[item.id] || {}), [field]: value } })); setChecked(false); };
            const custom = Boolean(item.imageKey);
            return <div key={item.id} className={`rounded-2xl border p-4 ${answerClass(isCorrect)}`}>
              <div className="mb-3 flex items-center justify-between gap-2"><div className="text-xs font-black uppercase text-fuchsia-600">Exercice {index + 1} · Type {item.type === 'natural-balance' ? '2' : '1'}</div>{canCalibrate && custom && <button type="button" onClick={() => setCurveQuestions((previous) => previous.filter((question) => question.id !== item.id))} className="text-[10px] font-black text-red-500">Supprimer</button>}</div>
              {custom ? <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50"><img src={curvePreviews[item.id]} alt={item.title || `Courbe ${index + 1}`} className="max-h-[440px] w-full object-contain" /></div> : item.type === 'natural-balance' ? <FifthGradeNaturalBalanceCurve item={item} /> : <FifthGradeDemographicCurve item={item} compact />}
              {canCalibrate && custom && <div className="mt-3 rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-3"><input value={item.title || ''} onChange={(event) => updateCurveQuestion(item.id, { title: event.target.value })} placeholder="Titre de l’exercice" className="w-full rounded-xl border border-fuchsia-200 bg-white p-2 text-sm font-black" />{item.type === 'natural-balance' ? <div className="mt-3 grid gap-2 sm:grid-cols-4"><label className="text-[10px] font-black uppercase text-fuchsia-700">À partir de<input value={item.expected?.periodStart || ''} onChange={(event) => updateCurveExpected(item, 'periodStart', event.target.value)} placeholder="ex. 1970" className="mt-1 w-full rounded-lg border bg-white p-2 text-xs font-black normal-case" /></label><label className="text-[10px] font-black uppercase text-fuchsia-700">Natalité<select value={item.expected?.relation || 'superieure'} onChange={(event) => updateCurveExpected(item, 'relation', event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs font-black normal-case"><option value="superieure">supérieure</option><option value="inferieure">inférieure</option><option value="egale">égale</option></select></label><label className="text-[10px] font-black uppercase text-fuchsia-700">Population<select value={item.expected?.evolution || 'augmente'} onChange={(event) => updateCurveExpected(item, 'evolution', event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs font-black normal-case"><option value="augmente">a augmenté</option><option value="diminue">a diminué</option><option value="stagne">a stagné</option></select></label><label className="text-[10px] font-black uppercase text-fuchsia-700">Solde<select value={item.expected?.balance || 'positif'} onChange={(event) => updateCurveExpected(item, 'balance', event.target.value)} className="mt-1 w-full rounded-lg border bg-white p-2 text-xs font-black normal-case"><option value="positif">positif</option><option value="negatif">négatif</option><option value="nul">nul</option></select></label></div> : <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"><input value={item.expected?.startYear || ''} onChange={(event) => updateCurveExpected(item, 'startYear', event.target.value)} placeholder="Date de début" className="rounded-lg border bg-white p-2 text-xs font-black" /><input value={item.expected?.endYear || ''} onChange={(event) => updateCurveExpected(item, 'endYear', event.target.value)} placeholder="Date de fin" className="rounded-lg border bg-white p-2 text-xs font-black" /><select value={item.expected?.trend || 'augmente'} onChange={(event) => updateCurveExpected(item, 'trend', event.target.value)} className="rounded-lg border bg-white p-2 text-xs font-black"><option value="augmente">augmenté</option><option value="diminue">diminué</option><option value="stagne">stagné</option></select><input value={item.expected?.startValue || ''} onChange={(event) => updateCurveExpected(item, 'startValue', event.target.value)} placeholder={item.expected?.trend === 'stagne' ? 'Valeur stable' : 'Valeur de départ'} className="rounded-lg border bg-white p-2 text-xs font-black" />{item.expected?.trend !== 'stagne' && <input value={item.expected?.endValue || ''} onChange={(event) => updateCurveExpected(item, 'endValue', event.target.value)} placeholder="Valeur d’arrivée" className="rounded-lg border bg-white p-2 text-xs font-black" />}</div>}</div>}
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-bold leading-[2.8] text-slate-800">{item.type === 'natural-balance' ? <>{item.expected?.periodStart && <strong className="mr-1">À partir de {item.expected.periodStart},</strong>} la natalité est <select value={answer.relation || ''} onChange={(event) => setAnswer('relation', event.target.value)} className="mx-1 rounded-lg border bg-white p-2 font-black"><option value="">…</option><option value="superieure">supérieure</option><option value="inferieure">inférieure</option><option value="egale">égale</option></select> à la mortalité. La population a donc <select value={answer.evolution || ''} onChange={(event) => setAnswer('evolution', event.target.value)} className="mx-1 rounded-lg border bg-white p-2 font-black"><option value="">…</option><option value="augmente">augmenté</option><option value="diminue">diminué</option><option value="stagne">stagné</option></select> et le solde naturel est donc <select value={answer.balance || ''} onChange={(event) => setAnswer('balance', event.target.value)} className="mx-1 rounded-lg border bg-white p-2 font-black"><option value="">…</option><option value="positif">positif</option><option value="negatif">négatif</option><option value="nul">nul</option></select>.</> : <>Entre <input value={answer.startYear || ''} onChange={(event) => setAnswer('startYear', event.target.value)} className="mx-1 w-24 rounded-lg border bg-white p-2 text-center font-black" placeholder="date" /> et <input value={answer.endYear || ''} onChange={(event) => setAnswer('endYear', event.target.value)} className="mx-1 w-24 rounded-lg border bg-white p-2 text-center font-black" placeholder="date" />, la population a <select value={answer.trend || ''} onChange={(event) => setAnswer('trend', event.target.value)} className="mx-1 rounded-lg border bg-white p-2 font-black"><option value="">…</option><option value="augmente">augmenté</option><option value="diminue">diminué</option><option value="stagne">stagné</option></select>{answer.trend === 'stagne' ? <> à <input value={answer.startValue || ''} onChange={(event) => setAnswer('startValue', event.target.value)} className="mx-1 w-28 rounded-lg border bg-white p-2 text-center font-black" placeholder="valeur" /></> : <>, passant de <input value={answer.startValue || ''} onChange={(event) => setAnswer('startValue', event.target.value)} className="mx-1 w-28 rounded-lg border bg-white p-2 text-center font-black" placeholder="valeur" /> à <input value={answer.endValue || ''} onChange={(event) => setAnswer('endValue', event.target.value)} className="mx-1 w-28 rounded-lg border bg-white p-2 text-center font-black" placeholder="valeur" /></>}.</>}</div>
              {checked && !isCorrect && <div className="mt-2 rounded-xl bg-red-100 p-2 text-xs font-black text-red-700">Relis la courbe : au moins un élément de la phrase est incorrect.</div>}
            </div>;
          })}</div>
          {canCalibrate && curveQuestions.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><button type="button" onClick={saveCurveQuestionsToDatabase} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white">✓ Calibré — enregistrer en BDD</button>{curveCalibrationStatus && <span className={`text-sm font-black ${curveCalibrationStatus.startsWith('Échec') ? 'text-red-600' : 'text-emerald-700'}`}>{curveCalibrationStatus}</span>}</div>}
        </article>
      )}

      {exerciseConfig && <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur"><div className="font-black text-slate-700">{checked ? `${exerciseConfig.correct} / ${exerciseConfig.total} bonnes réponses` : 'Complète toutes les réponses puis valide.'}</div><button type="button" onClick={validateCurrentExercise} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow">✓ Valider</button></div>}
    </section>
  );
}

const hasLocalDnbParagraphActivities = (chapter = {}) => (
  chapter.subject === 'histoire'
  && /premi[eè]re guerre mondiale/i.test(String(chapter.title || ''))
);

const RQP_EXERCISE_FILES = ['/exIntroRQP.json', '/exParRQP.json', '/exCnclRQP.json'];

function RqpMethodExercises() {
  const [activities, setActivities] = useState([]);
  const [activityIndex, setActivityIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(RQP_EXERCISE_FILES.map((url) => fetch(url).then((response) => {
      if (!response.ok) throw new Error(`Impossible de charger ${url}`);
      return response.json();
    }))).then((files) => {
      if (cancelled) return;
      setActivities(files.flatMap((file, fileIndex) => Object.entries(file || {}).map(([key, value]) => ({
        ...value,
        key: `${fileIndex}-${key}`
      }))));
    }).catch(() => {
      if (!cancelled) setActivities([]);
    });
    return () => { cancelled = true; };
  }, []);

  const activity = activities[activityIndex];
  const question = activity?.questions?.[questionIndex];
  const answerKey = activity && question ? `${activity.key}:${question.id}` : '';
  const selectedAnswer = answers[answerKey] || '';
  const isChecked = checked[answerKey] === true;
  const isCorrect = selectedAnswer === question?.reponse_correcte;

  const selectActivity = (index) => {
    setActivityIndex(index);
    setQuestionIndex(0);
  };

  if (!activity || !question) return <div className="flex min-h-[360px] items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50 p-5 text-center text-sm font-bold text-blue-500">Chargement des exercices RQP…</div>;

  return <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 shadow-sm">
    <div className="text-[10px] font-black uppercase text-blue-600">3. Entraîne-toi</div>
    <select value={activityIndex} onChange={(event) => selectActivity(Number(event.target.value))} className="mt-2 w-full rounded-xl border-2 border-blue-200 bg-white px-3 py-2 text-sm font-black text-slate-800">
      {activities.map((item, index) => <option key={item.key} value={index}>{item.titre}</option>)}
    </select>
    <div className="mt-3 flex items-center justify-between gap-2"><div className="text-xs font-black text-blue-700">Question {questionIndex + 1}/{activity.questions.length}</div><div className="h-2 flex-1 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600 transition-all" style={{ width: `${((questionIndex + 1) / activity.questions.length) * 100}%` }} /></div></div>
    <div className="mt-3 rounded-xl bg-white p-3">
      <div className="text-[10px] font-black uppercase text-slate-400">Sujet</div>
      <div className="mt-1 text-sm font-black text-slate-900">{question.sujet}</div>
      <div className="mt-3 text-sm font-bold leading-relaxed text-slate-700">{question.texte}</div>
    </div>
    <div className="mt-3 space-y-2">{activity.options.map((option) => {
      const selected = selectedAnswer === option.cle;
      const tone = !isChecked ? (selected ? 'border-blue-500 bg-blue-100' : 'border-blue-100 bg-white') : option.cle === question.reponse_correcte ? 'border-emerald-500 bg-emerald-50' : selected ? 'border-red-400 bg-red-50' : 'border-blue-100 bg-white';
      return <button key={option.cle} type="button" disabled={isChecked} onClick={() => setAnswers((previous) => ({ ...previous, [answerKey]: option.cle }))} className={`block w-full rounded-xl border-2 px-3 py-2 text-left text-xs font-bold transition ${tone}`}>{option.label}</button>;
    })}</div>
    {isChecked && <div className={`mt-3 rounded-xl p-3 text-xs font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}><div className="font-black">{isCorrect ? '✓ Bonne réponse' : 'À revoir'}</div><div className="mt-1 leading-relaxed">{question.explication || question.explication_alternative}</div></div>}
    <div className="mt-3 flex items-center justify-between gap-2">
      <button type="button" disabled={questionIndex === 0} onClick={() => setQuestionIndex((index) => Math.max(0, index - 1))} className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-600 disabled:opacity-30">← Précédent</button>
      {!isChecked ? <button type="button" disabled={!selectedAnswer} onClick={() => setChecked((previous) => ({ ...previous, [answerKey]: true }))} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-40">Vérifier</button> : <button type="button" onClick={() => {
        if (questionIndex < activity.questions.length - 1) setQuestionIndex((index) => index + 1);
        else selectActivity((activityIndex + 1) % activities.length);
      }} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white">{questionIndex < activity.questions.length - 1 ? 'Suivant →' : 'Série suivante →'}</button>}
    </div>
  </div>;
}

export default function ExamTrainingHub({ user, canCalibrate = false }) {
  const mode = getTrainingModeForStudent(user);
  const [section, setSection] = useState(mode === 'seconde' ? 'rqp' : 'full');
  const [dnbSubject, setDnbSubject] = useState('all');
  const [selectedDnbChapter, setSelectedDnbChapter] = useState(null);
  const [selectedLocalDnbActivity, setSelectedLocalDnbActivity] = useState('');

  if (mode === 'cinquieme') {
    return <FifthGradeGeoTraining user={user} canCalibrate={canCalibrate} />;
  }

  if (mode === 'dnb') {
    const activeTab = DNB_TABS.find((tab) => tab.key === section) || DNB_TABS[0];
    const showSubjectFilter = false;
    const levelFilter = section === 'full'
      ? null
      : {
          dnbSection: section,
          dnbSubject: dnbSubject === 'all' ? null : dnbSubject
        };
    const showChapterFolders = ['full', 'docs', 'paragraphe', 'emc'].includes(section);
    const selectedChapterLevelFilter = selectedDnbChapter
      ? {
          dnbSubject: selectedDnbChapter.subject,
          ...(selectedDnbChapter.subjectOnly ? {} : { chapterId: selectedDnbChapter.chapterId }),
          ...(section !== 'full' ? { dnbSection: section } : {})
        }
      : null;

    return (
      <section className="training-responsive flex flex-col gap-4">
        <TrainingPointsBadge user={user} />
        <div className="mx-4 rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <div className="text-[11px] font-black uppercase text-violet-500">Brevet</div>
          <h2 className="text-3xl font-black text-slate-900 m-0">Entraînement DNB</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">
            Choisis le brevet complet ou entraîne-toi exercice par exercice.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {DNB_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
	                  setSection(tab.key);
	                  setSelectedDnbChapter(null);
	                  setSelectedLocalDnbActivity('');
	                  setDnbSubject('all');
                }}
                title={tab.hint}
                className={`px-4 py-3 rounded-2xl border text-sm font-black ${section === tab.key ? 'bg-violet-600 text-white border-violet-700' : 'bg-white text-violet-700 border-violet-200'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {showSubjectFilter && (
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-[11px] font-black uppercase text-violet-400">Matière</span>
              {[
                { key: 'all', label: 'Toutes' },
                { key: 'histoire', label: 'Histoire' },
                { key: 'geo', label: 'Géo' }
              ].map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  onClick={() => setDnbSubject(sub.key)}
                  className={`px-3 py-2 rounded-xl border text-xs font-black ${dnbSubject === sub.key ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {sub.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 text-[11px] font-bold text-violet-500">
            Affichage : {activeTab.hint}{showSubjectFilter && dnbSubject !== 'all' ? ` · ${dnbSubject === 'geo' ? 'Géo' : 'Histoire'}` : ''}
          </div>
        </div>
        {section === 'reperes' && !selectedDnbChapter ? (
          <DnbReperesSubjectFolders onOpenSubject={setSelectedDnbChapter} />
        ) : section === 'reperes' && selectedDnbChapter?.subject === 'histoire' ? (
          <DnbHistoryReperesWorkspace onBack={() => setSelectedDnbChapter(null)} />
        ) : section === 'reperes' && selectedDnbChapter?.subject === 'geo' ? (
          <DnbGeoReperesWorkspace onBack={() => setSelectedDnbChapter(null)} />
	        ) : section === 'paragraphe' && selectedDnbChapter?.subject === 'methodo' ? (
	          <DnbParagraphMethodology onBack={() => setSelectedDnbChapter(null)} />
	        ) : section === 'docs' && selectedDnbChapter?.subject === 'methodo-docs' ? (
	          <DnbDocumentsMethodology user={user} onBack={() => setSelectedDnbChapter(null)} />
	        ) : showChapterFolders && !selectedDnbChapter ? (
	          <DnbChapterFolders user={user} sectionFilter={section} onOpenChapter={(chapter) => {
	            setSelectedDnbChapter(chapter);
	            setSelectedLocalDnbActivity('');
	          }} />
	        ) : (showChapterFolders || section === 'reperes') && selectedDnbChapter ? (
          <>
            <div className="mx-4 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
              <div>
                <div className="text-[11px] font-black uppercase text-slate-400">
                  {activeTab.hint} · {selectedDnbChapter.subject === 'emc' ? 'EMC' : (selectedDnbChapter.subject === 'geo' ? 'Géographie' : 'Histoire')}
                </div>
                <div className="text-xl font-black text-slate-900">{selectedDnbChapter.title}</div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDnbChapter(null)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600"
              >
                ← Retour aux dossiers
              </button>
            </div>
            <HomeworkList
              user={user}
              assessmentKinds={['dnb']}
              levelFilter={selectedChapterLevelFilter}
              emptyTitle="Aucun entraînement publié dans ce chapitre pour l'instant."
            />
          </>
        ) : (
          <HomeworkList
            user={user}
            assessmentKinds={['dnb']}
            levelFilter={levelFilter}
            emptyTitle={section === 'emc' ? "Aucun entraînement EMC disponible pour l'instant." : "Aucun exercice DNB disponible dans cette section pour l'instant."}
          />
        )}
      </section>
    );
  }

  if (mode === 'seconde') {
    const isRqp = section === 'rqp';
    return (
      <section className="training-responsive flex flex-col gap-4">
        <TrainingPointsBadge user={user} />
        <div className="mx-4 rounded-3xl border border-blue-200 bg-blue-50 p-5">
          <div className="text-[11px] font-black uppercase text-blue-500">Seconde</div>
          <h2 className="text-3xl font-black text-slate-900 m-0">Entraînement</h2>
          <p className="text-sm font-bold text-slate-500 mt-2">
            Choisis une section puis ouvre le sujet.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSection('rqp')}
              className={`px-4 py-3 rounded-2xl border text-sm font-black ${isRqp ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-blue-700 border-blue-200'}`}
            >
              RQP
            </button>
            <button
              type="button"
              onClick={() => setSection('commentaire')}
              className={`px-4 py-3 rounded-2xl border text-sm font-black ${!isRqp ? 'bg-emerald-600 text-white border-emerald-700' : 'bg-white text-emerald-700 border-emerald-200'}`}
            >
              Question commentaire
            </button>
          </div>
        </div>
        {isRqp && <section className="mx-4 rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
          <div><div className="text-[11px] font-black uppercase text-blue-600">RQP · Méthodologie</div><h3 className="m-0 text-2xl font-black text-slate-900">Réussir une réponse à une question problématisée</h3></div>
          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.68fr)_minmax(340px,0.9fr)]">
            <div className="overflow-hidden rounded-2xl border-2 border-blue-200 bg-slate-950 shadow-sm">
              <div className="aspect-video">
                <iframe className="h-full w-full" src="https://www.youtube.com/embed/9pITlqVsPhM" title="Méthodologie de la réponse à une question problématisée" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
              </div>
            </div>
            <a href="/2d-RQP.png" target="_blank" rel="noreferrer" className="block overflow-hidden rounded-2xl border-2 border-blue-200 bg-white shadow-sm" title="Ouvrir la fiche RQP en grand">
              <img src="/2d-RQP.png" alt="Fiche méthode pour réussir une RQP" className="block h-auto w-full" />
            </a>
            <RqpMethodExercises />
          </div>
          <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-800">Regarde la vidéo, puis garde la fiche sous les yeux pour construire ta réponse. Clique sur la fiche pour l’ouvrir en grand.</div>
        </section>}
        <HomeworkList
          user={user}
          assessmentKinds={[isRqp ? 'rqp' : 'commentaire']}
          emptyTitle={isRqp ? "Aucun entraînement RQP disponible pour l'instant." : "Aucune question commentaire disponible pour l'instant."}
        />
      </section>
    );
  }

  return (
    <div className="training-responsive mx-4 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">📚</div>
      <div className="text-lg font-black text-slate-700">Aucun entraînement spécial pour ta classe.</div>
    </div>
  );
}
