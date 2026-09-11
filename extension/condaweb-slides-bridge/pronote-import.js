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
  const getTargetGradeColumn = () => {
    // 1. Focus actif dans une cellule de note
    const active = document.activeElement;
    if (active && active !== document.body) {
      const cell = active.closest('.liste_celluleGrid[data-colonne]');
      const col = cell?.getAttribute('data-colonne');
      if (col && col !== '0') return col;
    }

    // 2. Cellule en mode édition Pronote
    const editInner = document.querySelector('[aria-describedby*="celEdit"]');
    if (editInner) {
      const cell = editInner.closest('.liste_celluleGrid[data-colonne]');
      const col = cell?.getAttribute('data-colonne');
      if (col && col !== '0') return col;
    }

    // 3. Gridcell sélectionnée (role="gridcell" avec aria-selected="true")
    const selectedGridcells = Array.from(document.querySelectorAll('[role="gridcell"][aria-selected="true"]'));
    for (const gc of selectedGridcells) {
      const cell = gc.closest('.liste_celluleGrid[data-colonne]');
      const col = cell?.getAttribute('data-colonne');
      if (col && col !== '0') return col;
    }

    // 4. Cellule avec classe .selected (en excluant colonne 0 et 1)
    const selectedCells = Array.from(document.querySelectorAll('.liste_celluleGrid.selected[data-colonne]'))
      .filter((c) => {
        const col = c.getAttribute('data-colonne');
        return col && col !== '0' && col !== '1';
      });
    if (selectedCells.length > 0) {
      return selectedCells[selectedCells.length - 1].getAttribute('data-colonne');
    }

    // 5. Repli : Colonne la plus à droite parmi les colonnes de données
    const allCols = Array.from(new Set(
      Array.from(document.querySelectorAll('.liste_celluleGrid[data-colonne]'))
        .map((c) => c.getAttribute('data-colonne'))
        .filter((col) => col && col !== '0' && col !== '1')
    ));
    if (allCols.length > 0) {
      return allCols[allCols.length - 1];
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
  const writeGradeToCell = async (gradeCell, grade) => {
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

    // Si l'éditeur n'est pas déjà actif sur cette cellule, on déclenche les clics
    if (!isOverGradeCell(document.activeElement, gradeCell)) {
      clickable.focus?.();
      clickable.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
      clickable.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      clickable.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
      clickable.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      clickable.click?.();
      clickable.dispatchEvent(new MouseEvent('dblclick', mouseOpts));
    }

    let input = null;
    for (let attempt = 0; attempt < 9; attempt++) {
      await new Promise((r) => setTimeout(r, 60));

      // 1. Input actif directement positionné sur cette cellule
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

      // 2. Input enfant direct de la cellule
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

      // Retenter un clic plus franc si pas ouvert au 3e essai
      if (attempt === 3) {
        clickable.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
        clickable.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
        clickable.click?.();
        clickable.dispatchEvent(new MouseEvent('dblclick', mouseOpts));
      }
    }

    if (!input) {
      console.warn('[CondaWeb Pronote] Éditeur introuvable pour la cellule', gradeCell);
      return false;
    }

    // Formatage avec virgule française (ex: 15,5)
    const formattedGrade = String(grade).replace('.', ',');
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    descriptor?.set?.call(input, formattedGrade);

    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));

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
        if (rows.length === 0) {
          alert('Le lot ne contient aucune note à importer.');
          return;
        }

        console.info('[CondaWeb Pronote] Démarrage de l’import...', { total: rows.length, title: payload.title });

        // Détection de la colonne cible
        const activeCol = getTargetGradeColumn();
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

            updateToast(`Saisie : ${entry.fullName} (${processedCount + 1}/${rows.length})…`);

            // Si la note est vide ou absente, on valide sans écrire
            if (entry.grade === null || entry.grade === undefined || entry.grade === '') {
              processedCellIds.add(nameCell.id);
              remainingRows = remainingRows.filter((r) => r.studentId !== entry.studentId);
              continue;
            }

            const written = await writeGradeToCell(gradeCell, entry.grade);
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
          alert(`✅ SUCCÈS TOTAL !\nLes ${processedCount} notes ont été écrites dans Pronote.\n\nPensez à cliquer sur l'icône de disquette Pronote pour enregistrer.`);
        } else if (processedCount > 0) {
          alert(
            `✅ ${processedCount} note(s) écrite(s).\n\n⚠️ ${remainingRows.length} élève(s) non trouvé(s) :\n${remainingRows.map((r) => r.fullName).join(', ')}\n\nVérifiez qu'ils figurent bien dans la liste Pronote.`
          );
        } else {
          alert(
            `❌ Aucune note n'a pu être écrite (colonne cible : ${activeCol}).\n\nVeuillez cliquer sur une cellule vide de la colonne du devoir avant de relancer l'import.`
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
