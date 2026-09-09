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
      const inputs = inputCandidates();
      const mappings = inputs.map((input) => ({ input, entry: matchRow(findRowText(input), payload.rows || []) })).filter((row) => row.entry);
      const matchedIds = new Set(mappings.map((row) => row.entry.studentId));
      const unmatched = (payload.rows || []).filter((row) => !matchedIds.has(row.studentId));

      const root = document.createElement('div');
      root.id = rootId;
      root.innerHTML = `<style>
        #${rootId}{position:fixed;inset:0;z-index:2147483647;background:rgba(15,23,42,.58);font-family:Arial,sans-serif;color:#0f172a;display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
        #${rootId} *{box-sizing:border-box} #${rootId} .box{width:min(720px,100%);max-height:88vh;overflow:auto;background:#fff;border-radius:20px;box-shadow:0 24px 70px #0008;padding:24px}
        #${rootId} h2{margin:0;font-size:22px} #${rootId} p{line-height:1.45;color:#475569}.cw-summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}.cw-pill{padding:8px 11px;border-radius:99px;background:#e0f2fe;color:#075985;font-weight:700}.cw-warning{background:#fff7ed;color:#9a3412;padding:12px;border-radius:10px;font-size:13px}.cw-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.cw-actions button{border:0;border-radius:10px;padding:11px 14px;font-weight:800;cursor:pointer}.cw-cancel{background:#e2e8f0}.cw-run{background:#0284c7;color:white}.cw-run:disabled{opacity:.5;cursor:not-allowed}
      </style><div class="box"><h2>📤 Aperçu de l’import Pronote</h2><p><b>${payload.title || 'Contrôle'}</b> · ${payload.className || ''} · notes sur ${payload.outOf || 20}</p><div class="cw-summary"><span class="cw-pill">${mappings.length} cellule(s) reconnue(s)</span><span class="cw-pill">${unmatched.length} élève(s) non reconnu(s)</span><span class="cw-pill">${inputs.length} champ(s) détecté(s)</span></div>${inputs.length ? '' : '<div class="cw-warning">Aucune cellule de note éditable n’a été détectée. Cliquez d’abord dans une cellule de la grille Pronote pour activer la saisie, puis relancez l’import.</div>'}${unmatched.length ? `<div class="cw-warning">Non importés automatiquement : ${unmatched.map((row) => row.fullName).join(', ')}. Ils restent à vérifier manuellement.</div>` : ''}<p>Après l’import, vérifiez l’ensemble de la colonne puis utilisez le bouton d’enregistrement officiel de Pronote.</p><div class="cw-actions"><button class="cw-cancel">Annuler</button><button class="cw-run" ${mappings.length ? '' : 'disabled'}>Remplir ${mappings.length} note(s)</button></div></div>`;
      root.querySelector('.cw-cancel').addEventListener('click', remove);
      root.querySelector('.cw-run').addEventListener('click', async () => {
        const run = root.querySelector('.cw-run');
        run.disabled = true;
        run.textContent = 'Import en cours…';
        for (const mapping of mappings) {
          setNativeValue(mapping.input, mapping.entry.grade);
          await new Promise((resolve) => setTimeout(resolve, 80));
        }
        run.textContent = `✓ ${mappings.length} note(s) renseignée(s)`;
        console.info('[CondaWeb Pronote] import local terminé', { matched: mappings.length, unmatched: unmatched.length, title: payload.title });
      });
      document.body.appendChild(root);
      console.info('[CondaWeb Pronote] aperçu prêt', { inputs: inputs.length, matched: mappings.length, unmatched: unmatched.length });
    }
  };
})();
