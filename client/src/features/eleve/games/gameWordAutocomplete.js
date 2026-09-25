/**
 * gameWordAutocomplete.js
 * Menu déroulant prédictif avec dictionnaire de mots pour Zombie & Starship.
 * Filtre les réponses au fur et à mesure de la saisie, avec navigation au clavier (haut / bas / Entrée / Tab)
 * et sélection à la souris / au doigt.
 */

import './gameWordAutocomplete.css';
import { HISTOIRE_GEO_LEXICON } from './historyFrenchLexicon';

/**
 * Normalise un texte (minuscules, sans accents, sans espaces superflus)
 */
export const normalizeTerm = (t = '') => {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

/**
 * Construit le dictionnaire de tous les termes et réponses possibles du jeu / niveau.
 */
export function buildGameDictionary(level, gameData) {
  const set = new Set();

  const addTerm = (raw) => {
    if (!raw) return;
    const str = String(raw).trim();
    if (!str || str.length < 2) return;
    set.add(str);

    // Si le terme commence par un article (L', D', Le, La, Les, Un, Une), on ajoute aussi la forme sans article
    const withoutArticle = str.replace(/^(?:l['’]|d['’]|le\s+|la\s+|les\s+|un\s+|une\s+|des\s+)/i, '').trim();
    if (withoutArticle && withoutArticle.length >= 2 && withoutArticle !== str) {
      set.add(withoutArticle);
    }
  };

  // Base générale de distracteurs (1200+ mots d'Histoire-Géo et vocabulaire pour éviter la devinette facile)
  HISTOIRE_GEO_LEXICON.forEach(addTerm);

  // 1. Questions du niveau actuel
  if (Array.isArray(level?.questions)) {
    level.questions.forEach((q) => {
      if (Array.isArray(q?.options)) q.options.forEach(addTerm);
      if (Array.isArray(q?.choices)) q.choices.forEach(addTerm);
    });
  }

  // 2. Questions de tous les niveaux du jeu
  if (Array.isArray(gameData?.levels)) {
    gameData.levels.forEach((lvl) => {
      if (Array.isArray(lvl?.questions)) {
        lvl.questions.forEach((q) => {
          if (Array.isArray(q?.options)) q.options.forEach(addTerm);
          if (Array.isArray(q?.choices)) q.choices.forEach(addTerm);
        });
      }
    });
  }

  // 3. Vocabulaire ou quiz dans learningContext
  const lessons = gameData?.learningContext?.lessons || [];
  lessons.forEach((l) => {
    if (Array.isArray(l?.quiz)) {
      l.quiz.forEach((q) => {
        if (Array.isArray(q?.choices)) q.choices.forEach(addTerm);
      });
    }
  });

  // Déduplication insensible à la casse
  const seenNorm = new Set();
  const result = [];
  Array.from(set).forEach((term) => {
    const norm = normalizeTerm(term);
    if (!seenNorm.has(norm)) {
      seenNorm.add(norm);
      result.push(term);
    }
  });

  // Tri alphabétique français
  result.sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));
  return result;
}

/**
 * Attache un menu déroulant d'autocomplétion à un champ input de jeu.
 *
 * @param {HTMLInputElement} inputEl - L'élément <input>
 * @param {string[]} dictionary - La liste des mots du dictionnaire
 * @param {Object} options - { theme: 'theme-zombie'|'theme-starship', onSubmit: (word) => void }
 * @returns {{ hide: () => void, show: () => void, destroy: () => void, updateDictionary: (words) => void }}
 */
export function attachGameWordAutocomplete(inputEl, dictionary = [], options = {}) {
  if (!inputEl || !inputEl.parentElement) return { hide: () => {}, show: () => {}, destroy: () => {}, updateDictionary: () => {} };

  let words = Array.isArray(dictionary) ? [...dictionary] : [];
  const theme = options.theme || 'theme-zombie';
  const onSubmit = typeof options.onSubmit === 'function' ? options.onSubmit : null;

  // Création du conteneur d'ancrage si nécessaire
  let anchor = inputEl.parentElement;
  if (!anchor.classList.contains('game-autocomplete-anchor')) {
    anchor = document.createElement('div');
    anchor.className = `game-autocomplete-anchor ${theme}`;
    inputEl.parentNode.insertBefore(anchor, inputEl);
    anchor.appendChild(inputEl);
  } else {
    anchor.className = `game-autocomplete-anchor ${theme}`;
  }

  // Création de la liste déroulante
  let dropdown = anchor.querySelector('.game-autocomplete-dropdown');
  if (!dropdown) {
    dropdown = document.createElement('div');
    dropdown.className = 'game-autocomplete-dropdown';
    dropdown.style.display = 'none';
    anchor.appendChild(dropdown);
  }

  let selectedIndex = -1;
  let currentMatches = [];
  let isVisible = false;

  const MIN_QUERY_LENGTH = 2; // Déclenchement à partir de 2 lettres tapées (anti-triche / anti-spoil)

  const filterMatches = (query = '') => {
    const qNorm = normalizeTerm(query);
    if (!qNorm || qNorm.length < MIN_QUERY_LENGTH) {
      return [];
    }

    const starts = [];
    const contains = [];

    words.forEach((w) => {
      const wNorm = normalizeTerm(w);
      if (wNorm.startsWith(qNorm)) {
        starts.push(w);
      } else if (wNorm.includes(qNorm)) {
        contains.push(w);
      }
    });

    return [...starts, ...contains].slice(0, 10);
  };

  const highlightMatch = (text, query) => {
    if (!query) return text;
    const qNorm = normalizeTerm(query);
    const tNorm = normalizeTerm(text);
    const idx = tNorm.indexOf(qNorm);
    if (idx === -1) return text;

    // Découpe le texte original pour conserver la casse originale
    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);
    return `${before}<mark>${match}</mark>${after}`;
  };

  const updatePosition = () => {
    try {
      const rect = anchor.getBoundingClientRect();
      const windowHeight = window.innerHeight || document.documentElement.clientHeight;
      const spaceBelow = windowHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < 230 && spaceAbove > spaceBelow) {
        dropdown.classList.remove('opens-downward');
        dropdown.classList.add('opens-upward');
      } else {
        dropdown.classList.remove('opens-upward');
        dropdown.classList.add('opens-downward');
      }
    } catch (_) {}
  };

  const render = () => {
    const val = inputEl.value.trim();
    if (val.length < MIN_QUERY_LENGTH) {
      hide();
      return;
    }

    currentMatches = filterMatches(val);
    updatePosition();

    if (currentMatches.length === 0) {
      dropdown.innerHTML = `
        <div class="game-autocomplete-header">
          <span>📖 Dictionnaire</span>
        </div>
        <div class="game-autocomplete-empty">Aucun mot correspondant</div>
      `;
      dropdown.style.display = 'flex';
      isVisible = true;
      return;
    }

    if (selectedIndex >= currentMatches.length) {
      selectedIndex = currentMatches.length - 1;
    }

    const headerHtml = `
      <div class="game-autocomplete-header">
        <span>📖 Dictionnaire (${currentMatches.length})</span>
        <span style="opacity:0.75">↑ ↓ naviguer · ↵ choisir</span>
      </div>
    `;

    const itemsHtml = currentMatches
      .map((word, idx) => {
        const isSel = idx === selectedIndex;
        const highlighted = highlightMatch(word, val);
        return `
          <div class="game-autocomplete-item ${isSel ? 'is-selected' : ''}" data-index="${idx}">
            <span class="truncate">${isSel ? '👉 ' : ''}${highlighted}</span>
            <span class="game-autocomplete-hint-key">${isSel ? '↵ Valider' : 'Tab'}</span>
          </div>
        `;
      })
      .join('');

    dropdown.innerHTML = headerHtml + itemsHtml;
    dropdown.style.display = 'flex';
    isVisible = true;

    // Défiler vers l'élément sélectionné
    if (selectedIndex >= 0) {
      const activeEl = dropdown.querySelector(`.game-autocomplete-item[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  };

  const show = () => {
    render();
  };

  const hide = () => {
    selectedIndex = -1;
    dropdown.style.display = 'none';
    isVisible = false;
  };

  const selectWord = (word) => {
    if (!word) return;
    inputEl.value = word;
    hide();
    if (onSubmit) {
      onSubmit(word);
    }
  };

  // --- GESTIONNAIRES D'ÉVÉNEMENTS ---

  const handleInput = () => {
    selectedIndex = -1;
    show();
  };

  const handleFocus = () => {
    if (inputEl.value.trim().length >= MIN_QUERY_LENGTH) {
      show();
    }
  };

  let blurTimeout = null;
  const handleBlur = () => {
    // Timeout pour permettre au clic souris / touch d'aboutir avant fermeture
    blurTimeout = setTimeout(() => {
      hide();
    }, 180);
  };

  const handleKeydown = (e) => {
    if (!isVisible) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        show();
        selectedIndex = 0;
        render();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (currentMatches.length === 0) return;
      selectedIndex = (selectedIndex + 1) % currentMatches.length;
      render();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (currentMatches.length === 0) return;
      selectedIndex = selectedIndex <= 0 ? currentMatches.length - 1 : selectedIndex - 1;
      render();
      return;
    }

    if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < currentMatches.length) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = currentMatches[selectedIndex];
        selectWord(chosen);
        return;
      }
      // Si aucun mot n'est surligné, on laisse le comportement Enter normal du jeu valider la saisie
      hide();
      return;
    }

    if (e.key === 'Tab') {
      if (currentMatches.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        const chosen = selectedIndex >= 0 ? currentMatches[selectedIndex] : currentMatches[0];
        selectWord(chosen);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hide();
      return;
    }
  };

  const handleDropdownMouseDown = (e) => {
    const item = e.target.closest('.game-autocomplete-item');
    if (!item) return;
    e.preventDefault(); // Garde le focus sur l'input
    const idx = Number(item.dataset.index);
    if (!isNaN(idx) && currentMatches[idx]) {
      selectWord(currentMatches[idx]);
    }
  };

  inputEl.addEventListener('input', handleInput);
  inputEl.addEventListener('focus', handleFocus);
  inputEl.addEventListener('blur', handleBlur);
  inputEl.addEventListener('keydown', handleKeydown, true);
  dropdown.addEventListener('pointerdown', handleDropdownMouseDown);

  return {
    show,
    hide,
    updateDictionary: (newWords) => {
      words = Array.isArray(newWords) ? [...newWords] : [];
    },
    destroy: () => {
      if (blurTimeout) clearTimeout(blurTimeout);
      inputEl.removeEventListener('input', handleInput);
      inputEl.removeEventListener('focus', handleFocus);
      inputEl.removeEventListener('blur', handleBlur);
      inputEl.removeEventListener('keydown', handleKeydown, true);
      dropdown.removeEventListener('pointerdown', handleDropdownMouseDown);
      if (dropdown && dropdown.parentNode) {
        dropdown.parentNode.removeChild(dropdown);
      }
    }
  };
}
