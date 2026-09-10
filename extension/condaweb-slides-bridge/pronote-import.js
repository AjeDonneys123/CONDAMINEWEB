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
    open(payload) {
      remove();
      const rows = payload.rows || [];
      
      const root = document.createElement('div');
      root.id = rootId;
      root.innerHTML = `<style>
        #${rootId}{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.58);font-family:Arial,sans-serif;color:#0f172a;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
        #${rootId} *{box-sizing:border-box} #${rootId} .box{width:min(720px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 24px 70px #0008;padding:24px}
        #${rootId} h2{margin:0;font-size:22px} #${rootId} p{line-height:1.45;color:#475569}.cw-summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.cw-pill{padding:8px 11px;border-radius:99px;background:#e0f2fe;color:#075985;font-weight:700}.cw-warning{background:#fff7ed;color:#9a3412;padding:12px;border-radius:10px;font-size:13px;margin-bottom:12px}.cw-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.cw-actions button{border:0;border-radius:10px;padding:11px 14px;font-weight:800;cursor:pointer}.cw-cancel{background:#e2e8f0}.cw-run{background:#0284c7;color:white}.cw-run:disabled{opacity:.5;cursor:not-allowed}
      </style><div class="box"><h2>📤 Import Pronote Automatique</h2><p><b>${payload.title || 'Contrôle'}</b> · ${payload.className || ''} · notes sur ${payload.outOf || 20}</p><div class="cw-summary"><span class="cw-pill">${rows.length} élève(s) à traiter</span></div><div class="cw-warning"><b>Attention :</b> Le script fera défiler la page vers le bas de lui-même pour charger tous les élèves. Ne touchez pas à la souris pendant l'import.</div><p>Après l’import, vérifiez l’ensemble de la colonne puis utilisez le bouton d’enregistrement officiel de Pronote.</p><div class="cw-actions"><button class="cw-cancel">Annuler</button><button class="cw-run" ${rows.length ? '' : 'disabled'}>Lancer le balayage</button></div></div>`;
      
      root.querySelector('.cw-cancel').addEventListener('click', remove);
      root.querySelector('.cw-run').addEventListener('click', async () => {
        const run = root.querySelector('.cw-run');
        run.disabled = true;
        run.textContent = 'Import en cours, patientez...';
        
        let scroller = null;
        const firstInput = inputCandidates()[0];
        if (firstInput) {
            let node = firstInput.parentElement;
            while (node && node !== document.body) {
                const style = window.getComputedStyle(node);
                if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                    scroller = node;
                    break;
                }
                node = node.parentElement;
            }
        }
        if (!scroller) {
            scroller = document.querySelector('.liste-focus-grid') || document.querySelector('.liste-grid') || document.scrollingElement || document.body;
        }

        // Retour tout en haut pour balayer de A à Z
        scroller.scrollTop = 0;
        await new Promise(r => setTimeout(r, 600));

        let remainingRows = [...rows];
        let processed = 0;
        let sameScrollCount = 0;

        while (remainingRows.length > 0 && sameScrollCount < 3) {
            const inputs = inputCandidates();
            
            for (const input of inputs) {
                const rowText = findRowText(input);
                const entry = matchRow(rowText, remainingRows);
                
                if (entry) {
                    setNativeValue(input, entry.grade);
                    processed++;
                    remainingRows = remainingRows.filter(r => r.studentId !== entry.studentId);
                    await new Promise(r => setTimeout(r, 80));
                }
            }

            const oldScroll = scroller.scrollTop;
            scroller.scrollTop += 250; 
            await new Promise(r => setTimeout(r, 550)); 

            if (Math.abs(scroller.scrollTop - oldScroll) < 5) {
                sameScrollCount++;
            } else {
                sameScrollCount = 0;
            }
        }
        
        run.textContent = `✓ ${processed} note(s) renseignée(s)`;
        console.info('[CondaWeb Pronote] import local terminé', { processed, unmatched: remainingRows.length, title: payload.title });
        
        if (remainingRows.length > 0) {
            alert(`Terminé, mais ${remainingRows.length} élève(s) n'ont pas pu être trouvés dans la grille :\n\n${remainingRows.map(r => r.fullName).join(', ')}\n\nVérifiez s'ils sont bien présents dans ce devoir sur Pronote.`);
        }
        
        setTimeout(remove, 4000);
      });
      document.body.appendChild(root);
    }
  };
})();
