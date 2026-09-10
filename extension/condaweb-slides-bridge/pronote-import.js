// Injecté uniquement après un clic explicite dans le popup de l'extension.
// Il n'envoie ni identifiant, ni cookie, ni note à CondaWeb : il propose un
// aperçu local puis renseigne les champs déjà ouverts dans Pronote.
(() => {
  const rootId = 'condaweb-pronote-import-root';
  const normalize = (value = '') => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
  const tokens = (value) => normalize(value).split(' ').filter(Boolean);
  const isVisible = (element) => !!element && !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
  const findRowText = (input) => {
    const row = input.closest('tr, [role="row"]');
    if (row) return row.innerText || row.textContent || '';
    let node = input.parentElement;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const text = node.innerText || node.textContent || '';
      if (text.length > 2) return text;
    }
    return '';
  };
  const matchRow = (rowText, entries) => {
    const rowTokens = new Set(tokens(rowText));
    const matches = entries.filter((entry) => {
      const nameTokens = tokens(entry.fullName);
      return nameTokens.length >= 2 && nameTokens.every((token) => rowTokens.has(token));
    });
    return matches.length === 1 ? matches[0] : null;
  };
  const inputCandidates = () => Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled]), textarea:not([disabled])'))
    .filter(isVisible)
    .filter((input) => !/search|recherche|filtre/i.test(`${input.name || ''} ${input.placeholder || ''} ${input.getAttribute('aria-label') || ''}`));
  const setNativeValue = (input, value) => {
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    descriptor?.set?.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  };
  const remove = () => document.getElementById(rootId)?.remove();

  window.CondaWebPronoteImport = {
    async open(payload) {
      try {
        const rows = payload.rows || [];
        if (rows.length === 0) return;

        // No modal! Run directly to prevent focus loss.
        console.info('[CondaWeb Pronote] Démarrage direct...');

        const getVisibleInput = () => Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled])'))
            .filter(isVisible)
            .filter((i) => !/search|recherche|filtre/i.test(`${i.name || ''} ${i.placeholder || ''} ${i.getAttribute('aria-label') || ''}`))[0];

        // 1. Determine active column
        let activeCol = null;
        let selectedCell = document.querySelector('.liste_celluleGrid.selected, [aria-selected="true"]');
        if (selectedCell) {
            if (!selectedCell.hasAttribute('data-colonne')) selectedCell = selectedCell.closest('[data-colonne]');
            if (selectedCell) activeCol = selectedCell.getAttribute('data-colonne');
        }

        let scroller = document.querySelector('.liste-focus-grid') || document.querySelector('.liste-grid') || document.scrollingElement || document.body;
        scroller.scrollTop = 0;
        await new Promise(r => setTimeout(r, 600));

        let remainingRows = [...rows];
        let processed = 0;
        let sameScrollCount = 0;
        let processedIds = new Set();

        while (remainingRows.length > 0 && sameScrollCount < 3) {
            // First, try the old method: write to already visible inputs
            const inputs = Array.from(document.querySelectorAll('input:not([type="hidden"]):not([disabled])'))
                .filter(isVisible)
                .filter((i) => !/search|recherche|filtre/i.test(`${i.name || ''}`));
            
            let wroteSomething = false;
            for (const input of inputs) {
                const rowText = findRowText(input);
                const entry = matchRow(rowText, remainingRows);
                if (entry) {
                    const formattedGrade = String(entry.grade).replace('.', ',');
                    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                    descriptor?.set?.call(input, formattedGrade);
                    
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                    input.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    processed++;
                    remainingRows = remainingRows.filter(r => r.studentId !== entry.studentId);
                    wroteSomething = true;
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            // If no inputs were written to, try the Click-Bot method
            if (!wroteSomething && activeCol) {
                const cells = Array.from(document.querySelectorAll(`.liste_celluleGrid[data-colonne="${activeCol}"]`));
                for (const cell of cells) {
                    if (processedIds.has(cell.id)) continue;

                    const match = cell.id.match(/^(.*_)(\d+)_(\d+)$/);
                    if (!match) continue;

                    const baseId = match[1];
                    const rowIdx = match[3];
                    let rowText = '';
                    for (let c = 0; c <= 2; c++) {
                        const nameCell = document.getElementById(`${baseId}${c}_${rowIdx}`);
                        if (nameCell) rowText += ' ' + (nameCell.innerText || nameCell.textContent || '');
                    }

                    const entry = matchRow(rowText, remainingRows);
                    if (entry) {
                        cell.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
                        cell.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                        cell.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
                        cell.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                        cell.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                        cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
                        
                        await new Promise(r => setTimeout(r, 150));

                        const input = getVisibleInput();
                        if (input) {
                            const formattedGrade = String(entry.grade).replace('.', ',');
                            const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
                            const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
                            descriptor?.set?.call(input, formattedGrade);
                            
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
                            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                            input.dispatchEvent(new Event('blur', { bubbles: true }));
                            
                            processed++;
                            remainingRows = remainingRows.filter(r => r.studentId !== entry.studentId);
                            processedIds.add(cell.id);
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }
                }
            }

            const oldScroll = scroller.scrollTop;
            scroller.scrollTop += 250; 
            await new Promise(r => setTimeout(r, 500)); 

            if (Math.abs(scroller.scrollTop - oldScroll) < 5) {
                sameScrollCount++;
            } else {
                sameScrollCount = 0;
            }
        }
        
        if (remainingRows.length > 0) {
            alert(`✅ ${processed} notes écrites.\n\n❌ ${remainingRows.length} absents ou non trouvés :\n${remainingRows.map(r => r.fullName).join(', ')}`);
        } else {
            alert(`✅ SUCCÈS TOTAL !\nLes ${processed} notes ont été remplies.`);
        }

      } catch (err) {
          alert("Erreur critique du script : " + err.message);
      }
    }
  };
})();
