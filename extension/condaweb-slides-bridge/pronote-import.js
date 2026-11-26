// CondaWeb Slides Bridge - Pronote Grade Importer
// Injecté après un clic explicite dans le popup de l'extension.
(() => {
  const rootToastId = 'condaweb-pronote-toast-root';

  const normalize = (value = '') =>
    String(value)
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim();

  const getTokensWithPairs = (text) => {
    const words = normalize(text).split(' ').filter(Boolean);
    const set = new Set(words);
    for (let i = 0; i < words.length - 1; i++) {
      set.add(words[i] + words[i + 1]);
    }
    return { words, all: set };
  };

  const isVisible = (element) =>
    !!element && !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);

  // Association intelligente nom CondaWeb <-> nom Pronote (gère les noms composés et concaténés ex: Ana Paula <-> Anapaula)
  const matchEntry = (rowText, entries) => {
    const row = getTokensWithPairs(rowText);
    if (row.words.length === 0) return null;

    let bestMatch = null;
    let bestScore = 0;
    let tie = false;

    for (const entry of entries) {
      const entryData = getTokensWithPairs(entry.fullName || `${entry.lastName || ''} ${entry.firstName || ''}`);
      if (!entryData.words.length) continue;

      let matched = 0;
      for (let i = 0; i < entryData.words.length; i++) {
        const w = entryData.words[i];
        if (row.all.has(w)) {
          matched++;
        } else if (i < entryData.words.length - 1 && row.all.has(w + entryData.words[i + 1])) {
          matched += 2; // ex: ANA + PAULA correspond à ANAPAULA
          i++;
        } else {
          for (const rw of row.words) {
            if ((w.length >= 4 && rw.startsWith(w)) || (rw.length >= 4 && w.startsWith(rw))) {
              matched += 0.8;
              break;
            }
          }
        }
      }

      const minReq = Math.min(2, entryData.words.length);
      if (matched >= minReq) {
        const score = matched / entryData.words.length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
          tie = false;
        } else if (Math.abs(score - bestScore) < 0.001) {
          tie = true;
        }
      }
    }

    return (!tie && bestScore >= 0.5) ? bestMatch : null;
  };

  // Détection de la colonne cible (celle du devoir à noter)
  // Détection de la colonne cible (celle du devoir ou de l'appréciation à renseigner)
  const getTargetGradeColumn = (payload = {}) => {
    // 1. Cadre de sélection Pronote (visuel)
    const cadre = document.querySelector('.liste_conteneurCadreSelection, [id*="cadreSelection"], [class*="cadreSelection"]');
    if (cadre && isVisible(cadre)) {
      const cr = cadre.getBoundingClientRect();
      const cx = cr.left + cr.width / 2;
      const cy = cr.top + cr.height / 2;
      const allCells = Array.from(document.querySelectorAll('.liste_celluleGrid[data-colonne]')).filter(isVisible);
      const overlappingCols = Array.from(new Set(allCells.flatMap((cell) => {
        const col = cell.getAttribute('data-colonne');
        if (!col || col === '0' || col === '1') return [];
        const r = cell.getBoundingClientRect();
        const overlapsX = Math.min(cr.right, r.right) - Math.max(cr.left, r.left) > 8;
        const overlapsY = Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top) > 8;
        return overlapsX && overlapsY ? [col] : [];
      })));
      // Le cadre Pronote peut couvrir toute une ligne : son centre ne désigne
      // alors aucune colonne précise et ne doit pas servir de cible.
      if (overlappingCols.length === 1) {
        console.info(`[CondaWeb Pronote] Colonne ciblée via cadre de sélection : colonne "${overlappingCols[0]}"`);
        return overlappingCols[0];
      }
      if (cr.width < 180) {
        for (const cell of allCells) {
          const col = cell.getAttribute('data-colonne');
          if (col && col !== '0' && col !== '1') {
            const r = cell.getBoundingClientRect();
            if (cx >= r.left && cx <= r.right && cy >= r.top - 6 && cy <= r.bottom + 6) return col;
          }
        }
      }
    }

    // 2. Cellule active / focusée ou en mode édition Pronote (celEdit)
    const active = document.activeElement;
    if (active && active !== document.body) {
      const cell = active.closest('.liste_celluleGrid[data-colonne]');
      const col = cell?.getAttribute('data-colonne');
      if (col && col !== '0' && col !== '1') return col;
    }

    const editInner = document.querySelector('[aria-describedby*="celEdit"], [id*="celEdit"] input, [id*="celEdit"] textarea');
    if (editInner && isVisible(editInner)) {
      const cell = editInner.closest('.liste_celluleGrid[data-colonne]');
      const col = cell?.getAttribute('data-colonne');
      if (col && col !== '0' && col !== '1') return col;
    }

    // 3. Correspondance d'en-tête (en mode appréciations ou par titre de devoir)
    const isAppMode = payload?.mode === 'appreciations' || (Array.isArray(payload?.rows) && payload.rows.some(r => String(r?.appreciation || '').trim()));
    const headers = Array.from(document.querySelectorAll('.liste_enteteGrid[data-colonne], .liste_celluleEnteteGrid[data-colonne], th[data-colonne], [role="columnheader"][data-colonne]')).filter(isVisible);

    if (isAppMode) {
      for (const h of headers) {
        const col = h.getAttribute('data-colonne');
        if (col && col !== '0' && col !== '1') {
          const hText = normalize(h.innerText || h.textContent || '');
          if (hText && (hText.includes('APPRECIATION') || hText.includes('APP A') || hText.includes('APP B') || hText.includes('APP'))) {
            console.info(`[CondaWeb Pronote] Colonne identifiée par en-tête d'appréciation "${hText}" : colonne "${col}"`);
            return col;
          }
        }
      }
    }

    if (payload?.title) {
      const normTitle = normalize(payload.title);
      for (const h of headers) {
        const col = h.getAttribute('data-colonne');
        if (col && col !== '0' && col !== '1') {
          const hText = normalize(h.innerText || h.textContent || '');
          if (hText && (hText.includes(normTitle) || normTitle.includes(hText))) {
            console.info(`[CondaWeb Pronote] Colonne identifiée par en-tête "${hText}" : colonne "${col}"`);
            return col;
          }
        }
      }
    }

    // 4. Cellule avec classe de sélection ou focus spécifique
    const selectedCell = document.querySelector('.liste_celluleGrid.selected[data-colonne]:not([data-colonne="0"]):not([data-colonne="1"]), [role="gridcell"][aria-selected="true"]');
    if (selectedCell) {
      const col = selectedCell.getAttribute('data-colonne') || selectedCell.closest('[data-colonne]')?.getAttribute('data-colonne');
      if (col && col !== '0' && col !== '1') return col;
    }

    // 5. Gridcell spécifique avec focus ou aria-selected explicite
    const focused = document.querySelector('.liste_celluleGrid[data-colonne] .liste-cellule-focusable:focus, .liste_celluleGrid[data-colonne][tabindex="0"]');
    if (focused) {
      const cell = focused.closest('.liste_celluleGrid[data-colonne]');
      const col = cell?.getAttribute('data-colonne');
      if (col && col !== '0' && col !== '1') return col;
    }

    // 6. Liste des colonnes de données existantes triées par numéro
    const allCols = Array.from(new Set(
      Array.from(document.querySelectorAll('.liste_celluleGrid[data-colonne]'))
        .map((c) => c.getAttribute('data-colonne'))
        .filter((col) => col && col !== '0' && col !== '1')
    )).sort((a, b) => Number(a) - Number(b));

    if (allCols.length === 1) return allCols[0];

    // Un nouveau devoir apparaît vide dans Pronote. Sans cellule précisément
    // sélectionnée, choisir la colonne la plus vide plutôt que la dernière.
    if (allCols.length > 0) {
      const ranked = allCols.map((col) => {
        const cells = Array.from(document.querySelectorAll(`.liste_celluleGrid[data-colonne="${col}"]`)).filter(isVisible);
        const empty = cells.filter((cell) => !(cell.innerText || cell.textContent || '').trim()).length;
        return { col, empty, total: cells.length };
      }).filter((item) => item.total > 0)
        .sort((a, b) => (b.empty / b.total) - (a.empty / a.total) || Number(a.col) - Number(b.col));
      if (ranked.length > 0 && ranked[0].empty > 0) return ranked[0].col;
    }

    return null;
  };

  // Localisation de la cellule de note correspondant à la ligne d'un élève
  const findGradeCell = (nameCell, activeCol) => {
    if (!nameCell) return null;

    // Méthode 1 : Correspondance directe par ID de ligne (_0_X -> _COL_X)
    const idMatch = nameCell.id?.match(/^(.*_)0_(\d+)$/);
    if (idMatch) {
      const baseId = idMatch[1];
      const rowIdx = idMatch[2];
      const directCell = document.getElementById(`${baseId}${activeCol}_${rowIdx}`);
      if (directCell && isVisible(directCell)) return directCell;
    }

    // Méthode 2 : Voisin dans le conteneur de grille
    const parent = nameCell.parentElement;
    if (parent) {
      const nameRect = nameCell.getBoundingClientRect();
      const candidates = Array.from(parent.querySelectorAll(`.liste_celluleGrid[data-colonne="${activeCol}"]`)).filter(isVisible);
      for (const cand of candidates) {
        const candRect = cand.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(nameRect.bottom, candRect.bottom) - Math.max(nameRect.top, candRect.top));
        if (overlap > 8 || Math.abs(nameRect.top - candRect.top) < 15) {
          return cand;
        }
      }
    }

    // Méthode 3 : Alignement géométrique global sur Y
    const nameRect = nameCell.getBoundingClientRect();
    const allColCells = Array.from(document.querySelectorAll(`.liste_celluleGrid[data-colonne="${activeCol}"]`)).filter(isVisible);
    for (const cand of allColCells) {
      const candRect = cand.getBoundingClientRect();
      const overlap = Math.max(0, Math.min(nameRect.bottom, candRect.bottom) - Math.max(nameRect.top, candRect.top));
      if (overlap > 8 || Math.abs(nameRect.top - candRect.top) < 15) {
        return cand;
      }
    }

    return null;
  };

  // Vérifie si un élément input se situe géométriquement sur la cellule cible (évite d'écrire dans la ligne précédente)
  const isOverGradeCell = (el, cell) => {
    if (!el || !cell) return false;
    if (cell.contains(el)) return true;
    const elRect = el.getBoundingClientRect();
    const cellRect = cell.getBoundingClientRect();
    const overlapY = Math.max(0, Math.min(elRect.bottom, cellRect.bottom) - Math.max(elRect.top, cellRect.top));
    return overlapY > 8;
  };

  // Écriture d'une note dans la cellule avec simulation précise
  const writeGradeToCell = async (gradeCell, grade, { textMode = false } = {}) => {
    gradeCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    await new Promise((r) => setTimeout(r, 40));

    // Si un éditeur est resté ouvert sur une AUTRE case (ex: élève intermédiaire ignoré), on le ferme avec Escape
    if (
      document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') &&
      !isOverGradeCell(document.activeElement, gradeCell)
    ) {
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      document.activeElement.blur?.();
      await new Promise((r) => setTimeout(r, 70));
    }

    const rect = gradeCell.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };

    const clickable = gradeCell.querySelector('.liste-cellule-focusable, [role="gridcell"]') || gradeCell;

    // Pronote ouvre la cellule d'édition soit par double-clic soit en pressant Entrée sur la case sélectionnée
    if (!isOverGradeCell(document.activeElement, gradeCell)) {
      clickable.focus?.();
      clickable.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
      clickable.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      clickable.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
      clickable.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      clickable.click?.();
      clickable.dispatchEvent(new MouseEvent('dblclick', mouseOpts));

      // Déclencheur officiel Pronote : touche Entrée pour activer l'édition de la cellule
      clickable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      clickable.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
      clickable.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
    }

    let input = null;
    for (let attempt = 0; attempt < 9; attempt++) {
      await new Promise((r) => setTimeout(r, 60));

      // 1. Input ou Textarea actif directement positionné sur cette cellule
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') &&
        !active.readOnly &&
        !/search|recherche|filtre/i.test(`${active.name || ''} ${active.placeholder || ''}`) &&
        isOverGradeCell(active, gradeCell)
      ) {
        input = active;
        break;
      }

      // 2. Input ou Textarea enfant direct de la cellule
      const cellInput = gradeCell.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
      if (cellInput && isVisible(cellInput)) {
        input = cellInput;
        break;
      }

      // 3. Conteneur celEdit lié via aria-describedby
      const celEditId = gradeCell.querySelector('[aria-describedby*="celEdit"]')?.getAttribute('aria-describedby');
      if (celEditId) {
        const editContainer = document.getElementById(celEditId);
        const editInput = editContainer?.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
        if (editInput && isVisible(editInput)) {
          input = editInput;
          break;
        }
      }

      // 4. Conteneurs d'édition flottants de Pronote
      const floatingEditors = Array.from(document.querySelectorAll('[id*="celEdit"], [class*="celEdit"], .liste_conteneurCadreSelection'));
      for (const fe of floatingEditors) {
        const fi = fe.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])');
        if (fi && isVisible(fi) && isOverGradeCell(fi, gradeCell)) {
          input = fi;
          break;
        }
      }
      if (input) break;

      // Retenter Entrée et dblclick au 3e essai si pas encore ouvert
      if (attempt === 3) {
        clickable.focus?.();
        clickable.click?.();
        clickable.dispatchEvent(new MouseEvent('dblclick', mouseOpts));
        clickable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        clickable.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
    }

    if (!input) {
      console.warn('[CondaWeb Pronote] Éditeur introuvable pour la cellule', gradeCell);
      return false;
    }

    // Les notes conservent le format français. Une appréciation reste un texte
    // strictement identique à celui préparé dans CondaWeb.
    const formattedGrade = textMode ? String(grade) : String(grade).replace('.', ',');
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    descriptor?.set?.call(input, formattedGrade);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    if (!textMode) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    } else {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
      input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Tab', code: 'Tab', keyCode: 9, which: 9, bubbles: true }));
    }
    input.dispatchEvent(new Event('blur', { bubbles: true }));
    input.blur?.();

    return true;
  };

  // Trouver le conteneur défilant de la grille Pronote
  const getScroller = () => {
    const candidates = [
      document.querySelector('.liste-focus-grid'),
      document.querySelector('.liste_content_lignes'),
      document.querySelector('[id*="contenuListe"]'),
      document.querySelector('[id*="ObjetListe"]'),
      document.querySelector('.liste-grid')
    ].filter(Boolean);

    for (const el of candidates) {
      let curr = el;
      while (curr && curr !== document.body) {
        const style = window.getComputedStyle(curr);
        if (/(auto|scroll)/.test(style.overflowY) && curr.scrollHeight > curr.clientHeight) {
          return curr;
        }
        curr = curr.parentElement;
      }
    }

    const allScrollable = Array.from(document.querySelectorAll('*'))
      .filter((el) => {
        if (!isVisible(el)) return false;
        const style = window.getComputedStyle(el);
        return /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 40;
      })
      .sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight));

    return allScrollable[0] || document.scrollingElement || document.body;
  };

  window.CondaWebPronoteImport = {
    async open(payload) {
      try {
        const rows = payload.rows || [];
        const isAppreciationMode = payload.mode === 'appreciations'
          || rows.some(row => String(row?.appreciation || '').trim());
        if (rows.length === 0) {
          alert(`Le lot ne contient aucune ${isAppreciationMode ? 'appréciation' : 'note'} à importer.`);
          return;
        }

        console.info('[CondaWeb Pronote] Démarrage de l’import...', { total: rows.length, title: payload.title });

        // Détection de la colonne cible
        const activeCol = getTargetGradeColumn(payload);
        if (!activeCol) {
          alert(
            '⚠️ Colonne introuvable.\n\nVeuillez cliquer sur une cellule de la colonne du devoir dans Pronote pour indiquer où écrire les notes, puis relancez l’import.'
          );
          return;
        }

        console.info(`[CondaWeb Pronote] Colonne cible identifiée : colonne "${activeCol}"`);

        // Badge flottant discret
        document.getElementById(rootToastId)?.remove();
        const toast = document.createElement('div');
        toast.id = rootToastId;
        toast.innerHTML = `
          <style>
            #${rootToastId} {
              position: fixed;
              top: 24px;
              right: 24px;
              z-index: 2147483647;
              background: #0f172a;
              color: #f8fafc;
              padding: 14px 20px;
              border-radius: 12px;
              box-shadow: 0 16px 36px rgba(0,0,0,0.35);
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              font-size: 14px;
              font-weight: 600;
              display: flex;
              align-items: center;
              gap: 12px;
              border: 1px solid #334155;
              pointer-events: none;
            }
            #${rootToastId} .cw-spin {
              width: 16px;
              height: 16px;
              border: 2.5px solid #38bdf8;
              border-top-color: transparent;
              border-radius: 50%;
              animation: cw-spinning 0.75s linear infinite;
            }
            @keyframes cw-spinning { to { transform: rotate(360deg); } }
          </style>
          <div class="cw-spin"></div>
          <div id="cw-toast-msg">Initialisation de l’import (colonne ${activeCol})…</div>
        `;
        document.body.appendChild(toast);

        const updateToast = (text) => {
          const msg = document.getElementById('cw-toast-msg');
          if (msg) msg.textContent = text;
        };

        const scroller = getScroller();
        scroller.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 450));

        let remainingRows = [...rows];
        let processedCount = 0;
        const processedCellIds = new Set();
        let stagnantScrolls = 0;

        while (remainingRows.length > 0 && stagnantScrolls < 4) {
          const nameCells = Array.from(document.querySelectorAll('.liste_celluleGrid[data-colonne="0"]')).filter(isVisible);

          for (const nameCell of nameCells) {
            if (processedCellIds.has(nameCell.id)) continue;

            // Lecture du nom de l'élève
            const idMatch = nameCell.id?.match(/^(.*_)0_(\d+)$/);
            let rowText = (nameCell.innerText || nameCell.textContent || '').trim();
            if (idMatch) {
              const col1 = document.getElementById(`${idMatch[1]}1_${idMatch[2]}`);
              if (col1) rowText += ' ' + (col1.innerText || col1.textContent || '').trim();
            }

            const entry = matchEntry(rowText, remainingRows);
            if (!entry) continue;

            const gradeCell = findGradeCell(nameCell, activeCol);
            if (!gradeCell) continue;

            updateToast(`${isAppreciationMode ? 'Appréciation' : 'Saisie'} : ${entry.fullName} (${processedCount + 1}/${rows.length})…`);

            // Protocole unique : après reconnaissance du nom, écrire exactement
            // la valeur préparée par CondaWeb dans la colonne choisie.
            let valueToWrite;
            if (isAppreciationMode) {
              const cand = String(entry.appreciation || (typeof entry.value === 'string' && entry.value.trim() ? entry.value : '')).trim();
              valueToWrite = cand;
            } else {
              valueToWrite = entry.value !== undefined ? entry.value : entry.grade;
            }
            if (valueToWrite === null || valueToWrite === undefined || valueToWrite === '') {
              processedCellIds.add(nameCell.id);
              remainingRows = remainingRows.filter((r) => r.studentId !== entry.studentId);
              continue;
            }

            const written = await writeGradeToCell(gradeCell, valueToWrite, { textMode: isAppreciationMode });
            if (written) {
              processedCount++;
              processedCellIds.add(nameCell.id);
              remainingRows = remainingRows.filter((r) => r.studentId !== entry.studentId);
              await new Promise((r) => setTimeout(r, 110));
            }
          }

          if (remainingRows.length > 0) {
            const oldScrollTop = scroller.scrollTop;
            scroller.scrollTop += 220;
            await new Promise((r) => setTimeout(r, 450));

            if (Math.abs(scroller.scrollTop - oldScrollTop) < 5) {
              stagnantScrolls++;
            } else {
              stagnantScrolls = 0;
            }
          }
        }

        // Nettoyage et remise en haut
        document.getElementById(rootToastId)?.remove();
        scroller.scrollTop = 0;

        if (remainingRows.length === 0) {
          alert(`✅ SUCCÈS TOTAL !\nLes ${processedCount} ${isAppreciationMode ? 'appréciations ont' : 'notes ont'} été écrites dans Pronote.\n\nPensez à cliquer sur l'icône de disquette Pronote pour enregistrer.`);
        } else if (processedCount > 0) {
          alert(
            `✅ ${processedCount} ${isAppreciationMode ? 'appréciation(s)' : 'note(s)'} écrite(s).\n\n⚠️ ${remainingRows.length} élève(s) non trouvé(s) :\n${remainingRows.map((r) => r.fullName).join(', ')}\n\nVérifiez qu'ils figurent bien dans la liste Pronote.`
          );
        } else {
          alert(
            `❌ Aucune ${isAppreciationMode ? 'appréciation' : 'note'} n'a pu être écrite (colonne cible : ${activeCol}).\n\nVeuillez cliquer sur une cellule vide de la colonne cible avant de relancer l'import.`
          );
        }
      } catch (err) {
        document.getElementById(rootToastId)?.remove();
        console.error('[CondaWeb Pronote] Erreur critique', err);
        alert('Erreur critique du script d’import Pronote : ' + err.message);
      }
    }
  };
})();
