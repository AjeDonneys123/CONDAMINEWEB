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

  return (
    <div className="mx-4 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Repères DNB · Géographie</div>
          <div className="text-2xl font-black text-slate-900">{isMetropoles ? 'Métropoles françaises' : 'Territoire français'}</div>
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
            className={`rounded-2xl border px-4 py-3 text-xs font-black ${!isMetropoles ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
          >
            Territoire
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
      {isMetropoles
        ? (mode === 'revision' ? <DnbGeoMetropolesRevision /> : <DnbGeoMetropolesGame />)
        : <DnbGeoTerritoryDrawingGame />}
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

function DnbGeoTerritoryDrawingGame() {
  const drawingRef = useRef(null);
  const [tool, setTool] = useState('mountain');
  const [mapReady, setMapReady] = useState(true);
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [labels, setLabels] = useState([]);

  const pointerToPercent = (event) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Number(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)).toFixed(2)),
      y: Number(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)).toFixed(2))
    };
  };

  const startDraw = (event) => {
    if (tool === 'label') return;
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

  const addLabel = (event) => {
    if (tool !== 'label') return;
    const point = pointerToPercent(event);
    if (!point) return;
    const text = window.prompt('Nom de la mer ou de l’océan ?', '');
    const cleanText = String(text || '').trim();
    if (!cleanText) return;
    setLabels((prev) => [...prev, { id: `label-${Date.now()}`, text: cleanText, x: point.x, y: point.y }]);
  };

  const moveLabel = (labelId, clientX, clientY) => {
    const rect = drawingRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Number(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)).toFixed(2));
    const y = Number(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)).toFixed(2));
    setLabels((prev) => prev.map((label) => label.id === labelId ? { ...label, x, y } : label));
  };

  const addNamedFeature = () => {
    const text = window.prompt('Nom du massif ou du fleuve ?', '');
    const cleanText = String(text || '').trim();
    if (!cleanText) return;
    setLabels((prev) => [...prev, { id: `label-${Date.now()}`, text: cleanText, x: 50, y: 50 }]);
  };

  const pathToD = (points) => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const allPaths = currentPath ? [...paths, currentPath] : paths;

  return (
    <section className="rounded-3xl border border-emerald-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-black uppercase text-emerald-500">Partie 2 · Géo</div>
          <div className="text-2xl font-black text-slate-900">Dessine les repères du territoire</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'mountain', label: 'Crayon montagnes' },
            { key: 'river', label: 'Trait fleuves' },
            { key: 'label', label: 'Bulle mers/océans' }
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
          <button
            type="button"
            onClick={addNamedFeature}
            className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-700"
          >
            + Nom massif/fleuve
          </button>
          <button
            type="button"
            onClick={() => {
              setPaths((prev) => prev.slice(0, -1));
              setLabels((prev) => prev.length && paths.length === 0 ? prev.slice(0, -1) : prev);
            }}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-xs font-black text-white"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => {
              setPaths([]);
              setLabels([]);
              setCurrentPath(null);
            }}
            className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-black text-red-600"
          >
            Effacer
          </button>
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm font-black text-emerald-700">
        Montagnes : dessine une zone au crayon. Fleuves : trace une ligne. Mers et océans : clique pour poser une bulle.
      </div>
      <div className="mt-5">
        <div
          ref={drawingRef}
          className="relative mx-auto max-w-[760px] touch-none overflow-hidden rounded-2xl border-2 border-slate-400 bg-white"
          onPointerDown={(event) => {
            if (tool === 'label') addLabel(event);
            else startDraw(event);
          }}
          onPointerMove={moveDraw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            const labelId = event.dataTransfer.getData('text/plain');
            if (labelId) moveLabel(labelId, event.clientX, event.clientY);
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
                strokeWidth={path.tool === 'river' ? 0.45 : 0.9}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={path.tool === 'river' ? 0.9 : 0.55}
              />
            ))}
          </svg>
          {labels.map((label) => (
            <button
              key={label.id}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', label.id);
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (event.altKey) setLabels((prev) => prev.filter((item) => item.id !== label.id));
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-200 bg-white/95 px-3 py-2 text-xs font-black text-blue-700 shadow"
              style={{ left: `${label.x}%`, top: `${label.y}%` }}
              title="Glisser pour déplacer. Alt+clic pour supprimer."
            >
              {label.text}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function DnbChapterFolders({ user, sectionFilter = 'full', onOpenChapter }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

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
        setRows(finalRows.sort((a, b) => a.title.localeCompare(b.title, 'fr')));
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
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className={`text-4xl font-black uppercase ${colorClass}`}>{label}</div>
        <div className="mt-4 flex flex-col gap-3">
          {items.length === 0 && !loading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm font-bold text-slate-400">
              Aucun dossier pour l'instant.
            </div>
          ) : items.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onOpenChapter(item)}
              className="w-full text-left rounded-3xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-violet-200 transition"
            >
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-2xl flex items-center justify-center text-2xl ${folderTone}`}>
                  📁
                </div>
                <div className="min-w-0">
                  <div className="text-lg font-black text-slate-900 truncate">{item.title}</div>
                  <div className="text-xs font-black text-slate-400 mt-1">{item.count} élément{item.count > 1 ? 's' : ''}</div>
                </div>
              </div>
            </button>
          ))}
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

export default function ExamTrainingHub({ user }) {
  const mode = getTrainingModeForStudent(user);
  const [section, setSection] = useState(mode === 'seconde' ? 'rqp' : 'full');
  const [dnbSubject, setDnbSubject] = useState('all');
  const [selectedDnbChapter, setSelectedDnbChapter] = useState(null);

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
          <DnbChapterFolders user={user} sectionFilter={section} onOpenChapter={setSelectedDnbChapter} />
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
