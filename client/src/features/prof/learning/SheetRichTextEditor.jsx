import React, { useEffect, useMemo, useRef } from 'react';

const escapeHtml = (value = '') => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')
  .replace(/\n/g, '<br>');

const COLORS = [
  ['#111827', 'Noir'],
  ['#dc2626', 'Rouge'],
  ['#2563eb', 'Bleu'],
  ['#16a34a', 'Vert'],
  ['#ea580c', 'Orange'],
  ['#7c3aed', 'Violet'],
];

const QUOTED_EXPECTED_PATTERN = /["“«]([^"”»\n]+)["”»]/g;

const markQuotedTextNodes = (root) => {
  if (!root) return false;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    if (node.parentElement?.closest('[data-expected-word="true"]')) continue;
    if (QUOTED_EXPECTED_PATTERN.test(node.nodeValue || '')) nodes.push(node);
    QUOTED_EXPECTED_PATTERN.lastIndex = 0;
  }
  nodes.forEach((textNode) => {
    const source = textNode.nodeValue || '';
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let match;
    QUOTED_EXPECTED_PATTERN.lastIndex = 0;
    while ((match = QUOTED_EXPECTED_PATTERN.exec(source)) !== null) {
      fragment.append(document.createTextNode(source.slice(cursor, match.index)));
      const strong = document.createElement('strong');
      strong.dataset.expectedWord = 'true';
      strong.textContent = match[1];
      fragment.append(strong);
      cursor = match.index + match[0].length;
    }
    fragment.append(document.createTextNode(source.slice(cursor)));
    textNode.replaceWith(fragment);
  });
  return nodes.length > 0;
};

const normalizeExpectedHtml = (html = '') => {
  const holder = document.createElement('div');
  holder.innerHTML = String(html || '');
  markQuotedTextNodes(holder);
  return holder.innerHTML;
};

const sanitizePastedRichHtml = (html = '', fallbackText = '') => {
  const rawHtml = String(html || '').trim();
  if (!rawHtml || typeof DOMParser === 'undefined') return escapeHtml(fallbackText);
  const source = new DOMParser().parseFromString(rawHtml, 'text/html');
  const escapeText = (value = '') => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const render = (node, inherited = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const rawText = String(node.nodeValue || '');
      // Google Docs / NotebookLM ajoutent beaucoup de retours et d'espaces
      // techniques entre leurs balises. Avec whitespace-pre-wrap ils deviennent
      // sinon de grands blancs visibles dans notre éditeur.
      if (!rawText.trim()) return '';
      const text = escapeText(rawText.replace(/\s+/g, ' '));
      let content = text;
      if (inherited.italic) content = `<em>${content}</em>`;
      if (inherited.bold) content = `<strong>${content}</strong>`;
      return content;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'SVG'].includes(element.tagName)) return '';
    if (element.tagName === 'BR') return '<br>';
    const fontWeight = String(element.style?.fontWeight || '').toLowerCase();
    const next = {
      bold: inherited.bold || ['B', 'STRONG'].includes(element.tagName)
        || fontWeight === 'bold' || Number.parseInt(fontWeight, 10) >= 600,
      italic: inherited.italic || ['I', 'EM'].includes(element.tagName)
        || String(element.style?.fontStyle || '').toLowerCase() === 'italic',
    };
    let content = Array.from(element.childNodes).map((child) => render(child, next)).join('');
    if (element.tagName === 'LI') {
      const cleanText = String(element.textContent || '').trim();
      const alreadyMarked = /^(?:[IVX]+\.|\d+\s*[-.)]|[a-z]\)|[-–—•▪◦])\s*/i.test(cleanText);
      if (!alreadyMarked) {
        const parent = element.parentElement;
        const siblings = Array.from(parent?.children || []).filter((child) => child.tagName === 'LI');
        const itemIndex = Math.max(0, siblings.indexOf(element));
        const listStyle = String(parent?.style?.listStyleType || '').toLowerCase();
        const alphaList = String(parent?.getAttribute?.('type') || '').toLowerCase() === 'a'
          || listStyle.includes('alpha') || listStyle.includes('letter');
        const marker = parent?.tagName === 'OL' && !alphaList
          ? `${itemIndex + 1}- `
          : `${String.fromCharCode(97 + (itemIndex % 26))}) `;
        content = `${marker}${content}`;
      }
    }
    return ['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName)
      ? `${content}<br>`
      : content;
  };
  const rendered = Array.from(source.body.childNodes).map((node) => render(node, {})).join('') || escapeHtml(fallbackText);
  return rendered
    .replace(/(?:\s*<br\s*\/?>\s*){2,}/gi, '<br>')
    .replace(/^(?:\s*<br\s*\/?>\s*)+|(?:\s*<br\s*\/?>\s*)+$/gi, '');
};

const reformatImportedSheetStructure = (html = '', fallbackText = '') => {
  const holder = document.createElement('div');
  holder.innerHTML = sanitizePastedRichHtml(html, fallbackText);
  const nodes = [];
  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
  let currentNode;
  while ((currentNode = walker.nextNode())) nodes.push(currentNode);

  let hasVisibleContent = false;
  let qcmReached = false;
  const markerPattern = /(QCM\s+DE\s+R[ÉE]VISION\b|LE[CÇ]ON\s+\d+\s*[:\-–—]|(?:VIII|VII|VI|IV|III|II|IX|X|V|I)\.\s+(?=[A-ZÀ-ÖØ-Þ])|\d{1,2}\s*-\s+|[a-d]\)\s+)/g;

  nodes.forEach((textNode) => {
    const source = String(textNode.nodeValue || '').replace(/\u00a0/g, ' ');
    if (!source.trim()) {
      textNode.remove();
      return;
    }
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let match;
    markerPattern.lastIndex = 0;
    while ((match = markerPattern.exec(source)) !== null) {
      const before = source.slice(cursor, match.index);
      if (before) {
        fragment.append(document.createTextNode(before));
        if (before.trim()) hasVisibleContent = true;
      }
      let marker = String(match[0] || '');
      const isQcmTitle = /^QCM\s+DE\s+R[ÉE]VISION/i.test(marker);
      const isLetterMarker = /^[a-d]\)/i.test(marker.trim());
      if (hasVisibleContent) fragment.append(document.createElement('br'));
      if (isLetterMarker && !qcmReached) marker = marker.replace(/^\s*[a-d]\)\s*/i, '- ');
      fragment.append(document.createTextNode(marker));
      hasVisibleContent = true;
      if (isQcmTitle) qcmReached = true;
      cursor = match.index + match[0].length;
    }
    const after = source.slice(cursor);
    if (after) {
      fragment.append(document.createTextNode(after));
      if (after.trim()) hasVisibleContent = true;
    }
    textNode.replaceWith(fragment);
  });

  // Un seul retour suffit : supprimer les BR consécutifs créés par le collage
  // d'origine et par la reconstruction des niveaux.
  Array.from(holder.querySelectorAll('br')).forEach((br) => {
    let previous = br.previousSibling;
    while (previous?.nodeType === Node.TEXT_NODE && !String(previous.nodeValue || '').trim()) {
      const removable = previous;
      previous = previous.previousSibling;
      removable.remove();
    }
    if (!previous || previous.nodeName === 'BR') br.remove();
  });
  while (holder.lastChild?.nodeName === 'BR') holder.lastChild.remove();
  return holder.innerHTML;
};

const serializePlainText = (root) => {
  const visit = (node) => {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue || '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const element = node;
    if (element.matches('[data-expected-word="true"]')) return `"${element.textContent || ''}"`;
    if (element.tagName === 'BR') return '\n';
    const content = Array.from(element.childNodes).map(visit).join('');
    return ['DIV', 'P', 'LI'].includes(element.tagName) ? `${content}\n` : content;
  };
  return Array.from(root?.childNodes || [])
    .map(visit)
    .join('')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n$/, '');
};

const applySheetHeadingColors = (root, numberedIdeasPlain = false) => {
  if (!root) return false;
  const blockTags = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
  const styleLine = (line) => {
    const text = String(line.textContent || '').replace(/\u00a0/g, ' ').trim();
    if (/^(?:VIII|VII|VI|IV|III|II|IX|X|V|I)\.\s+.+/i.test(text)) {
      line.style.color = '#dc2626';
      line.style.fontWeight = '700';
      return true;
    }
    if (/^\d{1,2}\s*-\s+.+/.test(text)) {
      if (numberedIdeasPlain) {
        // En 5e/6e, les idées 1-, 2-… structurent la leçon mais ne sont pas
        // des sous-titres : elles restent noires et normales. Les <strong>
        // internes gardent naturellement le rôle de mots-clés.
        line.style.color = '#111827';
        line.style.fontWeight = '400';
        line.querySelectorAll('strong, b').forEach((keyword) => {
          keyword.style.textDecoration = '';
        });
        return true;
      }
      line.style.color = '#16a34a';
      line.style.fontWeight = '700';
      // Dans une idée principale, seuls les vrais <strong>/<b> sont des
      // mots-clés : les souligner les rend identifiables sans confondre le
      // gras hiérarchique de toute la ligne avec un mot à compléter.
      line.querySelectorAll('strong, b').forEach((keyword) => {
        keyword.style.textDecoration = 'underline';
      });
      return true;
    }
    return false;
  };

  const nodes = Array.from(root.childNodes);
  const hasInlineLines = nodes.some((node) => node.nodeName === 'BR');
  let changed = false;
  if (hasInlineLines) {
    const output = document.createDocumentFragment();
    let inlineNodes = [];
    const flush = () => {
      if (!inlineNodes.length) return;
      const line = document.createElement('div');
      inlineNodes.forEach((node) => line.appendChild(node));
      if (styleLine(line)) changed = true;
      output.appendChild(line);
      inlineNodes = [];
    };
    nodes.forEach((node) => {
      if (node.nodeName === 'BR') {
        flush();
      } else if (node.nodeType === Node.ELEMENT_NODE && blockTags.has(node.tagName)) {
        flush();
        if (styleLine(node)) changed = true;
        output.appendChild(node);
      } else {
        inlineNodes.push(node);
      }
    });
    flush();
    if (changed) root.replaceChildren(output);
    return changed;
  }

  root.querySelectorAll('div, p, li, h1, h2, h3, h4, h5, h6').forEach((line) => {
    if (styleLine(line)) changed = true;
  });
  return changed;
};

export default function SheetRichTextEditor({ html = '', plainText = '', onChange, numberedIdeasPlain = false }) {
  const editorRef = useRef(null);
  const displayedHtml = useMemo(
    () => normalizeExpectedHtml(String(html || '').trim() ? String(html) : escapeHtml(plainText)),
    [html, plainText],
  );

  useEffect(() => {
    if (!editorRef.current || editorRef.current.innerHTML === displayedHtml) return;
    editorRef.current.innerHTML = displayedHtml;
  }, [displayedHtml]);

  const emitChange = () => {
    if (!editorRef.current) return;
    onChange({
      html: editorRef.current.innerHTML,
      text: serializePlainText(editorRef.current),
    });
  };

  const command = (name, value = null) => (event) => {
    event.preventDefault();
    editorRef.current?.focus();
    document.execCommand(name, false, value);
    emitChange();
  };

  const pasteRichText = (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') || '';
    const htmlFromClipboard = event.clipboardData?.getData('text/html') || '';
    const safeHtml = reformatImportedSheetStructure(htmlFromClipboard, text);
    document.execCommand('insertHTML', false, normalizeExpectedHtml(safeHtml));
    applySheetHeadingColors(editorRef.current, numberedIdeasPlain);
    emitChange();
  };

  const normalizeNumberedStructure = () => {
    if (!editorRef.current) return;
    const root = editorRef.current;
    const blockTags = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    let atLineStart = true;
    let titleHandled = false;
    let pointNumber = 0;
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const source = String(node.nodeValue || '');
        if (!atLineStart || !source.trim()) return;
        if (!titleHandled) {
          titleHandled = true;
          node.nodeValue = source;
        } else if (/^\s*[-–—•▪◦➤⇒→]\s*/.test(source)) {
          node.nodeValue = source.replace(/^\s*[-–—•▪◦➤⇒→]\s*/, '- ');
        } else {
          pointNumber += 1;
          node.nodeValue = source.replace(/^\s*(?:\d+\s*[-.)]\s*)?/, `${pointNumber}- `);
        }
        atLineStart = false;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === 'BR') {
        atLineStart = true;
        return;
      }
      const isBlock = blockTags.has(node.tagName);
      if (isBlock) atLineStart = true;
      Array.from(node.childNodes).forEach(visit);
      if (isBlock) atLineStart = true;
    };
    Array.from(root.childNodes).forEach(visit);
    emitChange();
  };

  const normalizeBeforeLeaving = () => {
    if (!editorRef.current) return;
    markQuotedTextNodes(editorRef.current);
    // La structure et la numérotation fournies par NotebookLM doivent rester
    // strictement inchangées. La renumérotation reste disponible via le bouton
    // manuel « 1- Numéroter » lorsque le professeur en a réellement besoin.
    applySheetHeadingColors(editorRef.current, numberedIdeasPlain);
    emitChange();
  };

  const cleanImportedStructure = (event) => {
    event.preventDefault();
    if (!editorRef.current) return;
    const plain = serializePlainText(editorRef.current);
    editorRef.current.innerHTML = normalizeExpectedHtml(
      reformatImportedSheetStructure(editorRef.current.innerHTML, plain),
    );
    emitChange();
  };

  const handleStructuredTab = (event) => {
    if (event.key !== 'Tab' || event.shiftKey || !editorRef.current) return;
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current.contains(range.startContainer)) return;
    const blockSelector = 'div,p,li,h1,h2,h3,h4,h5,h6';
    const startElement = range.startContainer.nodeType === Node.ELEMENT_NODE
      ? range.startContainer
      : range.startContainer.parentElement;
    const lineBlock = startElement?.closest?.(blockSelector);
    const scope = lineBlock && editorRef.current.contains(lineBlock) ? lineBlock : range.startContainer;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let firstText = scope.nodeType === Node.TEXT_NODE ? scope : walker.nextNode();
    while (firstText && !String(firstText.nodeValue || '').trim()) firstText = walker.nextNode();
    const prefixMatch = String(firstText?.nodeValue || '').match(/^(\s*)\d+\s*[-.)]\s*/);
    if (prefixMatch && firstText) {
      event.preventDefault();
      event.stopPropagation();
      const oldPrefixLength = prefixMatch[0].length;
      const replacement = `${prefixMatch[1]}- `;
      firstText.nodeValue = `${replacement}${String(firstText.nodeValue || '').slice(oldPrefixLength)}`;
      if (range.startContainer === firstText) {
        const nextOffset = Math.max(replacement.length, range.startOffset - oldPrefixLength + replacement.length);
        const nextRange = document.createRange();
        nextRange.setStart(firstText, Math.min(nextOffset, String(firstText.nodeValue || '').length));
        nextRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(nextRange);
      }
      emitChange();
      return;
    }

    const beforeCaret = range.cloneRange();
    beforeCaret.selectNodeContents(editorRef.current);
    beforeCaret.setEnd(range.startContainer, range.startOffset);
    const fragmentHolder = document.createElement('div');
    fragmentHolder.appendChild(beforeCaret.cloneContents());
    const currentLine = String(serializePlainText(fragmentHolder) || '').split(/\r?\n/).pop() || '';
    if (!/^\s*\d+\s*[-.)]\s*/.test(currentLine)) return;
    event.preventDefault();
    event.stopPropagation();
    document.execCommand('insertHTML', false, '<br>-&nbsp;');
    emitChange();
  };

  const turnSelectionIntoSubpoints = (event) => {
    event.preventDefault();
    editorRef.current?.focus();
    const selection = window.getSelection?.();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) return;

    const fragment = range.extractContents();
    const holder = document.createElement('div');
    holder.appendChild(fragment);
    let atLineStart = true;
    const blockTags = new Set(['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const value = String(node.nodeValue || '');
        if (atLineStart && value.trim()) {
          node.nodeValue = value.replace(/^\s*(?:(?:\d+)\s*[-.)]\s*|-\s*)?/, '- ');
          atLineStart = false;
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      if (node.tagName === 'BR') {
        atLineStart = true;
        return;
      }
      const isBlock = blockTags.has(node.tagName);
      if (isBlock) atLineStart = true;
      Array.from(node.childNodes).forEach(visit);
      if (isBlock) atLineStart = true;
    };
    Array.from(holder.childNodes).forEach(visit);

    const inserted = document.createDocumentFragment();
    while (holder.firstChild) inserted.appendChild(holder.firstChild);
    const lastNode = inserted.lastChild;
    range.insertNode(inserted);
    if (lastNode) {
      const nextRange = document.createRange();
      nextRange.setStartAfter(lastNode);
      nextRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(nextRange);
    }
    emitChange();
  };

  return (
    <div className="flex max-h-[600px] min-h-[540px] flex-col overflow-hidden rounded-2xl border-4 border-slate-300 bg-white shadow-inner focus-within:border-purple-500">
      <div className="z-10 shrink-0 flex flex-wrap items-center gap-2 border-b-2 border-slate-200 bg-slate-50 p-3">
        <button
          type="button"
          className="grid h-10 min-w-10 place-items-center rounded-lg border-2 border-slate-300 bg-white px-3 text-lg font-black text-slate-900 shadow-sm hover:bg-slate-100"
          onMouseDown={command('bold')}
          title="Mettre en gras"
        >B</button>
        <button
          type="button"
          className="grid h-10 min-w-10 place-items-center rounded-lg border-2 border-slate-300 bg-white px-3 text-lg italic text-slate-900 shadow-sm hover:bg-slate-100"
          onMouseDown={command('italic')}
          title="Mettre en italique"
        >I</button>
        <button
          type="button"
          className="grid h-10 min-w-10 place-items-center rounded-lg border-2 border-slate-300 bg-white px-3 text-lg font-black underline text-slate-900 shadow-sm hover:bg-slate-100"
          onMouseDown={command('underline')}
          title="Souligner"
        >U</button>
        <button
          type="button"
          className="grid h-10 min-w-10 place-items-center rounded-lg border-2 border-slate-300 bg-white px-3 text-lg font-black text-slate-900 shadow-sm hover:bg-slate-100"
          onMouseDown={turnSelectionIntoSubpoints}
          title="Transformer les lignes sélectionnées en sous-parties"
        >−</button>
        <button
          type="button"
          className="h-10 rounded-lg border-2 border-slate-300 bg-white px-3 text-sm font-black text-slate-900 shadow-sm hover:bg-slate-100"
          onMouseDown={(event) => {
            event.preventDefault();
            normalizeNumberedStructure();
          }}
          title="Structurer et renuméroter les points de premier niveau"
        >1- Numéroter</button>
        <div className="mx-1 h-8 w-px bg-slate-300" />
        <span className="text-xs font-black uppercase text-slate-500">Couleur</span>
        {COLORS.map(([color, label]) => (
          <button
            key={color}
            type="button"
            className="h-9 w-9 rounded-full border-4 border-white shadow ring-2 ring-slate-300 transition hover:scale-110"
            style={{ backgroundColor: color }}
            onMouseDown={command('foreColor', color)}
            title={label}
            aria-label={`Texte ${label}`}
          />
        ))}
        <button
          type="button"
          className="ml-auto rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase text-slate-600 hover:bg-slate-100"
          onMouseDown={cleanImportedStructure}
          title="Supprimer les blancs et convertir les pastilles importées en marqueurs lisibles"
        >Nettoyer le collage</button>
        <button
          type="button"
          className="rounded-lg border-2 border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase text-slate-600 hover:bg-slate-100"
          onMouseDown={command('removeFormat')}
        >Effacer le format</button>
      </div>
      <div
        ref={editorRef}
        className="sheet-rich-editor min-h-0 flex-1 overflow-y-auto w-full whitespace-pre-wrap p-6 text-lg font-medium leading-relaxed text-slate-900 outline-none"
        contentEditable
        suppressContentEditableWarning
        onInput={emitChange}
        onPaste={pasteRichText}
        onKeyDown={handleStructuredTab}
        onBlur={normalizeBeforeLeaving}
        spellCheck
        data-placeholder="Colle ici tout le texte de la fiche, puis sélectionne les passages à mettre en gras ou en couleur."
      />
      <style>{`
        .sheet-rich-editor:empty::before { content: attr(data-placeholder); color: #94a3b8; pointer-events: none; }
        .sheet-rich-editor [data-expected-word="true"] { font-weight: 800; }
      `}</style>
    </div>
  );
}
