import React, { useEffect, useMemo, useRef, useState } from 'react';
import HomeworkList from '../homework/HomeworkList';

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
  const [mode, setMode] = useState('revision');
  const [geoGame, setGeoGame] = useState('metropoles');
  const isMetropoles = geoGame === 'metropoles';
  const isTerritoire = geoGame === 'territoire';
  const isRepartition = geoGame === 'repartition';
  const isEspacesProductifs = geoGame === 'espacesProductifs';
  const isDromCom = geoGame === 'dromCom';
  const isUe = geoGame === 'ue';
  const isRegions = geoGame === 'regions';

  return (
    <div className="mx-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Repères DNB · Géographie</div>
          <div className="text-2xl font-black text-slate-900">{isMetropoles ? 'Métropoles françaises' : isTerritoire ? 'Territoire français' : isRepartition ? 'Répartition de la population française' : isEspacesProductifs ? 'Espaces productifs français' : isDromCom ? 'DROM-COM' : isUe ? 'Union européenne' : isRegions ? 'Régions françaises' : 'Aire urbaine'}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setGeoGame('metropoles');
              setMode('revision');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isMetropoles ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Métropoles
          </button>
          <button
            type="button"
            onClick={() => {
              setGeoGame('territoire');
              setMode('game');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isTerritoire ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Territoire
          </button>
          <button
            type="button"
            onClick={() => {
              setGeoGame('repartition');
              setMode('game');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isRepartition ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Répartition
          </button>
          <button
            type="button"
            onClick={() => {
              setGeoGame('espacesProductifs');
              setMode('game');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isEspacesProductifs ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Espaces productifs
          </button>
          <button
            type="button"
            onClick={() => {
              setGeoGame('dromCom');
              setMode('game');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${isDromCom ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            DROM-COM
          </button>
          <button type="button" onClick={() => { setGeoGame('ue'); setMode('game'); }} className={`rounded-2xl border px-4 py-3 text-xs font-black ${isUe ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Union européenne</button>
          <button type="button" onClick={() => { setGeoGame('regions'); setMode('game'); }} className={`rounded-2xl border px-4 py-3 text-xs font-black ${isRegions ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>Régions</button>
          <button
            type="button"
            onClick={() => {
              setGeoGame('aireUrbaine');
              setMode('game');
            }}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${geoGame === 'aireUrbaine' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Aire urbaine
          </button>
          <button
            type="button"
            onClick={() => setMode('revision')}
            disabled={!isMetropoles}
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${mode === 'revision' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
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
            onClick={onBack}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-600"
          >
            ← Retour
          </button>
        </div>
      </div>
      {geoGame === 'metropoles'
        ? (mode === 'revision' ? <DnbGeoMetropolesRevision /> : <DnbGeoMetropolesGame />)
        : geoGame === 'territoire'
          ? <DnbGeoTerritoryDrawingGame />
          : geoGame === 'repartition'
            ? <DnbGeoRepartitionColoringGame key="repartition" />
          : geoGame === 'espacesProductifs'
            ? <DnbGeoRepartitionColoringGame
                key="espaces-productifs-v8"
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
              />
          : geoGame === 'dromCom'
            ? <DnbDromComLabelGame />
          : geoGame === 'ue'
            ? <DnbUeNumberGame />
          : geoGame === 'regions'
            ? <DnbRegionsPointGame />
          : <DnbUrbanAreaSchemaGame />}
    </div>
  );
}

function DnbGeoMetropolesRevision() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-xl font-black text-slate-900">Métropoles à connaître</div>
      <div className="mt-4 flex flex-wrap gap-3">
        {DNB_GEO_METROPOLES.map((city) => (
          <span key={city.id} className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
            {city.name}
          </span>
        ))}
      </div>
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

const DNB_ESPACESP_MAP_SECTIONS = [
  { key: 'industrial', label: 'Carte industrielle', minX: 0, maxX: 33.33, pencilKeys: ['industrial-pink', 'industrial-blue', 'technology-yellow', 'black'] },
  { key: 'agricultural', label: 'Carte agricole', minX: 33.33, maxX: 66.66, pencilKeys: ['cereal-orange', 'farming-green', 'specialized-red', 'mixed-light-green', 'black'] },
  { key: 'services', label: 'Carte des services', minX: 66.66, maxX: 100, pencilKeys: ['services-red', 'tourism-green', 'transport-purple'] }
];

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
  allowBackgroundFill = false
}) {
  const drawingRef = useRef(null);
  const mapImageRef = useRef(null);
  const [mapReady, setMapReady] = useState(true);
  const [pencil, setPencil] = useState(pencils[0]);
  const [strokeWidth, setStrokeWidth] = useState(compactStrokeWidths ? 0.65 : 5);
  const [drawMode, setDrawMode] = useState('line');
  const [activeMapSection, setActiveMapSection] = useState(() => mapSections[0]?.key || '');
  const [savedDrawing] = useState(() => {
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
    if (typeof window === 'undefined' || !draftReady) return;
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
  }, [draftKey, draftReady, paths, fills, mapTitle, mapTitles, centralLabel, legendItems, legendGroupTitles, mapRectangles]);

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

  const startColoring = (event) => {
    event.preventDefault();
    const pointerPoint = pointerToPercent(event);
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
      eraseAt(event, true);
      return;
    }
    if (drawMode === 'point') {
      if (!pointerPoint) return;
      setFills((previous) => [...previous, {
        id: `repartition-fill-${Date.now()}`,
        color: pencil.color,
        pattern: 'point',
        ...(activeMapSection ? { groupKey: activeMapSection } : {}),
        svgCircles: [{ x: pointerPoint.x, y: pointerPoint.y, r: 1.35 }]
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
      if (previous.type === 'arrow') return { ...previous, points: [previous.points[0], point] };
      return { ...previous, points: [...previous.points, point] };
    });
  };

  const endColoring = (event) => {
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
      return hitsCircle || hitsRectangle;
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
    const payload = JSON.stringify({ paths, fills, title: mapTitle, mapTitles, centralLabel, legendItems, legendGroupTitles, mapRectangles }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      window.alert('Sauvegarde du coloriage copiée.');
    } catch (_) {
      window.prompt('Copie la sauvegarde du coloriage :', payload);
    }
  };
  const undoLastRepartitionAction = () => {
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
    const patternByMode = { hatch: 'hatch', arrow: 'arrow', line: 'line' };
    setLegendItems((previous) => [...previous, {
      id: `repartition-legend-${Date.now()}`,
      color: pencil.color,
      pattern: patternByMode[drawMode] || 'solid',
      ...(activeMapSection ? { groupKey: activeMapSection } : {}),
      label: ''
    }]);
  };
  const legendGroupKeyForItem = (item) => item?.groupKey || (item?.pattern === 'solid' ? 'distribution' : 'dynamics');
  const selectedMapSection = effectiveMapSections.find((section) => section.key === activeMapSection);
  const visiblePencils = selectedMapSection
    ? pencils.filter((item) => selectedMapSection.pencilKeys.includes(item.key))
    : pencils;
  const sectionKeyForLegendItem = (item) => {
    if (item?.groupKey && mapSections.some((section) => section.key === item.groupKey)) return item.groupKey;
    const matchingPencil = pencils.find((candidate) => candidate.color === item?.color);
    return mapSections.find((section) => matchingPencil && section.pencilKeys.includes(matchingPencil.key))?.key || '';
  };
  const legendItemsForSection = (sectionKey) => legendItems.filter((item) => !item?.expectedOnly && sectionKeyForLegendItem(item) === sectionKey);

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Partie 2 · Géo</div>
          <div className="text-2xl font-black text-slate-900">{heading}</div>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        Choisis un crayon et colorie directement les espaces de la carte. Le dessin est sauvegardé automatiquement sur cet appareil.
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
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
        <button
          type="button"
          onClick={() => setDrawMode('arrow')}
          className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'arrow' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
        >
          ➜ Flèche
        </button>
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
            onClick={() => setDrawMode('point')}
            className={`rounded-xl px-3 py-2 text-xs font-black ${drawMode === 'point' ? 'bg-violet-600 text-white' : 'bg-white text-slate-600'}`}
          >
            ● Pôle tertiaire
          </button>
        )}
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
        <button
          type="button"
          onClick={() => setDrawMode('eraser')}
          className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black ${drawMode === 'eraser' ? 'border-slate-900 bg-slate-700 text-white shadow' : 'border-transparent bg-white/70 text-slate-600'}`}
          title="Gommer un trait, une flèche ou une zone coloriée"
        >
          <span className="text-base">⬜</span>
          Gomme
        </button>
        <span className="ml-2 text-xs font-black uppercase text-slate-500">Épaisseur</span>
        {(compactStrokeWidths ? [
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
      </div>

      <div className="mt-5">
        {mapSections.length === 0 && <label className="mx-auto mb-3 block max-w-[820px]">
          <span className="mb-1 block text-xs font-black uppercase text-slate-500">Titre de la carte</span>
          <input
            value={mapTitle}
            onChange={(event) => setMapTitle(event.target.value)}
            placeholder="Écris le titre de la carte"
            className="w-full rounded-2xl border-2 border-slate-300 bg-white px-4 py-3 text-center text-lg font-black text-slate-900 outline-none focus:border-violet-500"
          />
        </label>}
        <div
          ref={drawingRef}
          className={`relative mx-auto max-w-[820px] touch-none overflow-hidden rounded-2xl border-2 border-slate-400 bg-white ${drawMode === 'fill' || drawMode === 'hatch' ? 'cursor-cell' : drawMode === 'eraser' ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
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
          {[...fills].filter((fill) => fill?.image && !fill?.expectedOnly).sort((left, right) => {
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
            {fills.filter((fill) => !fill?.expectedOnly).flatMap((fill) => (fill?.svgCircles || []).map((circle, index) => (
              <ellipse
                key={`circle-${fill.id}-${index}`}
                cx={circle.x}
                cy={circle.y}
                rx={circle.rx ?? Number(circle.r || 1) * 0.4}
                ry={circle.ry ?? circle.r}
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
            {visiblePaths.map((path) => (
              <path
                key={path.id}
                d={pathToD(path.points)}
                fill="none"
                stroke={path.color}
                strokeWidth={path.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={uniformColors ? 1 : (path.opacity || (path.pencilKey === 'red' || path.color === '#ef2020' ? 0.82 : 0.52))}
                markerEnd={path.type === 'arrow' ? `url(#dnb-repartition-arrow-${path.pencilKey || 'red'})` : undefined}
              />
            ))}
          </svg>
          {mapSections.length > 0 && effectiveMapSections.map((section) => (
            <input
              key={`map-title-${section.key}`}
              value={mapTitles[section.key] || ''}
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
        {mapSections.length === 0 ? <div className="mx-auto mt-4 max-w-[820px] rounded-2xl border-2 border-slate-300 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black uppercase text-slate-700">Légende</div>
            <button
              type="button"
              onClick={addRepartitionLegendItem}
              className="rounded-xl bg-violet-100 px-3 py-2 text-xs font-black text-violet-700"
            >
              + Ajouter l’outil sélectionné
            </button>
          </div>
          <div className="mt-3 space-y-2">
            {legendItems.map((item, index) => (
              <React.Fragment key={item.id}>
                {(index === 0 || legendGroupKeyForItem(item) !== legendGroupKeyForItem(legendItems[index - 1])) && (
                  <input
                    value={legendGroupTitles[legendGroupKeyForItem(item)] || ''}
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
                  value={item.label}
                  onChange={(event) => setLegendItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))}
                  placeholder="Signification dans la légende"
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold outline-none focus:border-violet-500"
                />
                {showDensityInputs && item.pattern === 'solid' && (
                  <input
                    value={item.density || ''}
                    onChange={(event) => setLegendItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, density: event.target.value } : entry))}
                    placeholder="habitants/km²"
                    className="w-40 rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold outline-none focus:border-violet-500"
                  />
                )}
                <button
                  type="button"
                  onClick={() => setLegendItems((previous) => previous.filter((entry) => entry.id !== item.id))}
                  className="rounded-lg bg-red-50 px-3 py-2 font-black text-red-500"
                  title="Supprimer cet élément de légende"
                >
                  ✕
                </button>
              </div>
              </React.Fragment>
            ))}
            {legendItems.length === 0 && <div className="text-sm font-bold text-slate-400">Sélectionne une couleur et un outil, puis ajoute-le à la légende.</div>}
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
                  className={`min-w-0 rounded-2xl border-2 bg-white p-3 transition ${isActive ? 'border-violet-500 shadow-md' : 'border-slate-200 opacity-75'}`}
                >
                  <input
                    value={legendGroupTitles[section.key] || ''}
                    onChange={(event) => setLegendGroupTitles((previous) => ({ ...previous, [section.key]: event.target.value }))}
                    readOnly={!isActive}
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
                          value={item.label || ''}
                          onChange={(event) => setLegendItems((previous) => previous.map((entry) => entry.id === item.id ? { ...entry, label: event.target.value } : entry))}
                          readOnly={!isActive}
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
        )}
      </div>
    </section>
  );
}

function DnbRegionsPointGame() {
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

  return <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><div className="text-[11px] font-black uppercase text-emerald-600">Repères DNB · France</div><div className="text-2xl font-black">Les régions françaises</div></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => { setDefining(true); setChecked(false); }} className={`rounded-xl px-4 py-3 text-xs font-black ${defining ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}>Placer les champs</button>
        <button type="button" onClick={() => setDefining(false)} className="rounded-xl bg-blue-100 px-4 py-3 text-xs font-black text-blue-700">Terminer</button>
        <button type="button" onClick={() => setMarkers((previous) => previous.slice(0, -1))} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white">↶ Annuler</button>
        <button type="button" onClick={copy} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">Copier sauvegarde</button>
        {!defining && markers.length > 0 && <button type="button" onClick={() => setChecked(true)} className="rounded-xl bg-violet-600 px-4 py-3 text-xs font-black text-white">Vérifier</button>}
      </div>
    </div>
    <div ref={boardRef} onClick={place} onPointerMove={move} onPointerUp={() => setDragId('')} onPointerCancel={() => setDragId('')} className={`relative mx-auto mt-4 max-w-[900px] overflow-hidden rounded-2xl border-2 border-slate-300 ${defining ? 'cursor-crosshair' : ''}`}>
      <img src={DNB_GEO_REGIONS_MAP_URL} alt="Carte muette des régions françaises" draggable={false} className="block w-full select-none" />
      {markers.map((marker) => {
        const answer = marker.answer || '';
        const isCorrect = checked && normalizeAnswer(answer) === normalizeAnswer(marker.expectedName);
        const isWrong = checked && !isCorrect;
        return <div key={marker.id} data-region-marker onPointerDown={(event) => {
        if (!defining) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        setDragId(marker.id);
      }} className={`absolute z-10 w-[145px] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 bg-white p-0.5 shadow-md ${defining ? 'cursor-move border-amber-500' : isCorrect ? 'border-emerald-500' : isWrong ? 'border-red-500' : 'border-slate-300'}`} style={{ left: `${marker.x}%`, top: `${marker.y}%` }} title={defining ? 'Glisser pour déplacer' : undefined}>
          {defining ? <div className="px-1.5 py-1.5 text-center text-[10px] font-black leading-tight text-amber-800">{marker.expectedName}</div> : <input value={answer} onChange={(event) => {
            setChecked(false);
            setMarkers((previous) => previous.map((item) => item.id === marker.id ? { ...item, answer: event.target.value } : item));
          }} onPointerDown={(event) => event.stopPropagation()} placeholder="Nom de la région" className="w-full rounded-md border-0 bg-white px-1.5 py-1.5 text-center text-[11px] font-bold leading-tight text-slate-800 outline-none" />}
          {isWrong && <div className="px-1 pb-1 text-center text-[10px] font-black text-red-600">Réponse : {marker.expectedName}</div>}
        </div>;
      })}
    </div>
  </section>;
}

function DnbUeNumberGame() {
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
  return <section className="rounded-3xl border border-blue-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[11px] font-black uppercase text-blue-600">Repères DNB · Europe</div><div className="text-2xl font-black">Pays de l’Union européenne</div></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setDefining(true); setPlacementTool('number'); }} className={`rounded-xl px-4 py-3 text-xs font-black ${defining && placementTool === 'number' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'}`}>Placer les numéros</button><button type="button" onClick={() => { setDefining(true); setPlacementTool('mask'); }} className={`rounded-xl px-4 py-3 text-xs font-black ${defining && placementTool === 'mask' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'}`}>⚪ Masquer un repère</button><button type="button" onClick={() => setDefining(false)} className="rounded-xl bg-blue-100 px-4 py-3 text-xs font-black text-blue-700">Terminer</button><button type="button" onClick={() => placementTool === 'mask' ? setMasks((p) => p.slice(0,-1)) : setMarkers((p) => p.slice(0,-1))} className="rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white">↶ Annuler</button><button type="button" onClick={copy} className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white">Copier sauvegarde</button></div></div>
    <div ref={boardRef} onClick={place} onPointerMove={move} onPointerUp={() => setDragId('')} onPointerCancel={() => setDragId('')} className={`relative mx-auto mt-4 max-w-[900px] overflow-hidden rounded-2xl border-2 border-slate-300 ${defining ? 'cursor-crosshair' : ''}`}>
      <img src={DNB_GEO_UE_MAP_URL} alt="Carte de l’Union européenne" draggable={false} className="block w-full select-none" />
      {masks.length > 0 && <div className="pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-2 rounded-full border border-orange-300 bg-white/95 px-3 py-2 text-[11px] font-black uppercase text-orange-700 shadow"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Optionnel</div>}
      {masks.map((mask) => <button key={mask.id} type="button" data-ue-marker onClick={(event) => { event.stopPropagation(); if (defining && placementTool === 'mask') setMasks((previous) => previous.filter((item) => item.id !== mask.id)); }} className={`absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm ${defining ? 'border-2 border-dashed border-slate-400' : 'border border-orange-200'}`} style={{left:`${mask.x}%`,top:`${mask.y}%`}} title={defining ? 'Cliquer pour supprimer ce masque' : 'Repère optionnel'}><span className="h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" /></button>)}
      {markers.map((marker) => <div key={marker.id} data-ue-marker onPointerDown={(event) => { if (!defining) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); setDragId(marker.id); }} className={`absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 bg-white text-xs font-black shadow ${defining ? 'cursor-move border-amber-500 text-amber-700' : 'border-blue-600 text-blue-700'}`} style={{left:`${marker.x}%`,top:`${marker.y}%`}} title={defining ? marker.expectedName : undefined}>{marker.number}</div>)}
    </div>
    {masks.length > 0 && <div className="mx-auto mt-4 flex max-w-[900px] items-center gap-3 rounded-2xl border-2 border-orange-300 bg-orange-50 p-4 text-orange-900"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow"><span className="h-3 w-3 rounded-full bg-orange-500" /></span><div><div className="text-sm font-black uppercase">Repères optionnels</div><div className="text-xs font-bold">Les points orange sont facultatifs. Les numéros bleus correspondent aux 12 pays obligatoires à connaître.</div></div></div>}
    <div className="mx-auto mt-4 grid max-w-[900px] gap-2 sm:grid-cols-2 md:grid-cols-3">{markers.map((marker) => <div key={`legend-${marker.id}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-black text-white">{marker.number}</span>{defining ? <span className="text-xs font-black text-slate-700">{marker.expectedName}</span> : <input value={marker.answer || ''} onChange={(event) => setMarkers((previous) => previous.map((item) => item.id === marker.id ? {...item,answer:event.target.value} : item))} placeholder="Nom du pays" className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-bold outline-none" />}</div>)}</div>
  </section>;
}

function DnbDromComLabelGame() {
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

function DnbGeoTerritoryDrawingGame() {
  const drawingRef = useRef(null);
  const [tool, setTool] = useState('mountain');
  const [mapReady, setMapReady] = useState(true);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [labels, setLabels] = useState([]);
  const [draggingLabelId, setDraggingLabelId] = useState('');
  const [editModel, setEditModel] = useState(false);
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
    if (!draftLoadedRef.current || !editModel) return;
    window.localStorage.setItem(DNB_GEO_TERRITORY_DRAFT_KEY, JSON.stringify({ paths, labels }));
  }, [editModel, paths, labels]);

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
          <div className="text-2xl font-black text-slate-900">Complète les repères du territoire</div>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        {editModel
          ? 'Mode modèle : ajuste les tracés et les bulles, puis copie la sauvegarde.'
          : `Écris les noms dans les bulles placées sur la carte. ${checked ? `${goodAnswers}/${labels.length} bonnes réponses.` : ''}`}
      </div>
      <div className="mt-5">
        <div
          ref={drawingRef}
          className="relative mx-auto max-w-[760px] touch-none overflow-hidden rounded-2xl border-2 border-slate-400 bg-white"
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

function DnbUrbanAreaSchemaGame() {
  const [circles, setCircles] = useState([]);
  const [arrows, setArrows] = useState([]);
  const [answers, setAnswers] = useState({});
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
  const visibleLegend = URBAN_AREA_LEGEND.filter((item) => visibleLegendKeys.has(item.key));
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={addCircle} disabled={nextCircle >= 3} className="rounded-2xl bg-red-500 px-4 py-3 text-xs font-black text-white disabled:opacity-40">Cercles</button>
          <button type="button" onClick={() => addArrow('sprawl')} className="rounded-2xl bg-red-500 px-4 py-3 text-xs font-black text-white">Étalement urbain</button>
          <button type="button" onClick={() => addArrow('double')} className="rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white">Mobilités pendulaires</button>
          <button type="button" onClick={removeLast} className="rounded-2xl bg-slate-100 px-4 py-3 text-xs font-black text-slate-700">Effacer dernier</button>
          <button type="button" onClick={() => setChecked(true)} className="rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-black text-white">Valider</button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        Place les trois espaces, ajoute les flux, puis complète la légende qui apparaît sous le schéma.
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <div
          ref={dragRef}
          className="relative aspect-[4/3] overflow-hidden rounded-3xl border-2 border-slate-200 bg-[#b9cf32]"
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
                <circle
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
                />
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
                  {['start', 'end'].map((handle) => (
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
                  <input
                    value={answer}
                    onChange={(event) => {
                      setAnswers((prev) => ({ ...prev, [item.key]: event.target.value }));
                      setChecked(false);
                    }}
                    className={`min-w-0 flex-1 rounded-xl border px-3 py-2 text-sm font-black outline-none ${checked ? (isGood ? 'border-emerald-300 text-emerald-700' : 'border-red-300 text-red-600') : 'border-slate-200 text-slate-900'}`}
                    placeholder="..."
                  />
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
    <div className={`mx-4 grid gap-4 ${sectionFilter === 'emc' ? 'md:grid-cols-1' : 'md:grid-cols-2'}`}>
      {sectionFilter === 'emc' ? (
        renderColumn('emc', 'EMC', 'text-violet-600')
      ) : (
        <>
          {renderColumn('histoire', 'Histoire', 'text-red-500')}
          {renderColumn('geo', 'Géo', 'text-emerald-600')}
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
        <button type="button" onClick={() => setChecked(true)} className="rounded-2xl bg-emerald-500 px-5 py-3 text-sm font-black text-white">
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

const hasLocalDnbParagraphActivities = (chapter = {}) => (
  chapter.subject === 'histoire'
  && /premi[eè]re guerre mondiale/i.test(String(chapter.title || ''))
);

export default function ExamTrainingHub({ user }) {
  const mode = getTrainingModeForStudent(user);
  const [section, setSection] = useState(mode === 'seconde' ? 'rqp' : 'full');
  const [dnbSubject, setDnbSubject] = useState('all');
  const [selectedDnbChapter, setSelectedDnbChapter] = useState(null);
  const [selectedLocalDnbActivity, setSelectedLocalDnbActivity] = useState('');

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
      <section className="flex flex-col gap-4">
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
      <section className="flex flex-col gap-4">
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
        <HomeworkList
          user={user}
          assessmentKinds={[isRqp ? 'rqp' : 'commentaire']}
          emptyTitle={isRqp ? "Aucun entraînement RQP disponible pour l'instant." : "Aucune question commentaire disponible pour l'instant."}
        />
      </section>
    );
  }

  return (
    <div className="mx-4 rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center">
      <div className="text-3xl mb-2">📚</div>
      <div className="text-lg font-black text-slate-700">Aucun entraînement spécial pour ta classe.</div>
    </div>
  );
}
