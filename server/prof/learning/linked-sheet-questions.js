const decodeHtml = (value = '') => String(value || '')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const htmlText = (value = '') => decodeHtml(String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ''));

const quoteMarkedHtml = (blockHtml = '') => {
    const placeholders = [];
    const store = (innerHtml) => {
        const value = htmlText(innerHtml).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        if (!value) return '';
        const token = `\uE000${placeholders.length}\uE001`;
        placeholders.push(`"${value.replace(/^["“”«»]+|["“”«»]+$/g, '').trim()}"`);
        return token;
    };
    let marked = String(blockHtml || '');
    // A placeholder prevents a nested <span> from creating a second blank.
    marked = marked.replace(/<(strong|b|u)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_all, _tag, inner) => store(inner));
    marked = marked.replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (all, attrs, inner) => {
        if (/data-expected-word\s*=\s*["']true["']/i.test(attrs)
            || /font-weight\s*:\s*(?:bold|[6-9]00)/i.test(attrs)) return store(inner);
        return all;
    });
    let text = htmlText(marked);
    placeholders.forEach((replacement, index) => {
        text = text.replace(`\uE000${index}\uE001`, replacement);
    });
    return text.replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').trim();
};

const sheetToFillBlankText = (sheet = {}) => {
    const fallback = String(sheet?.sheetText || '').replace(/\r/g, '').trim();
    const html = String(sheet?.sheetTextHtml || '').trim();
    if (!html) return fallback;
    const blocks = [];
    const blockRegex = /<(div|p|li|h[1-6])\b[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = blockRegex.exec(html))) blocks.push(match[2]);
    if (!blocks.length) blocks.push(html);
    const lines = blocks.map((block) => {
        const plain = htmlText(block).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
        // Les titres de parties sont structurants, même lorsqu'ils sont gras.
        if (/^(?:partie\s+)?(?:VIII|VII|VI|IV|III|II|IX|X|V|I)(?:\s*[.):\-–—]\s*|\s+).+/i.test(plain)) return plain;
        return quoteMarkedHtml(block);
    }).filter(Boolean);
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() || fallback;
};

const synchronizeLinkedSheetQuestions = (rawSteps = []) => {
    const steps = (Array.isArray(rawSteps) ? rawSteps : []).map((step) => ({ ...step }));
    const sheetsById = new Map(steps
        .filter((step) => step?.type === 'sheet' && String(step?.id || '').trim())
        .map((step) => [String(step.id), step]));
    let changed = false;
    const nextSteps = steps.map((step) => {
        if (step?.type !== 'question') return step;
        const linkedId = String(step?.autoLinkedSheetId || '').trim()
            || String(step?.sourceSheetUrl || '').replace(/^sheet:/, '').trim();
        const sheet = sheetsById.get(linkedId);
        if (!sheet || step?.autoLinkedSheetMode === 'plan' || step?.autoRevisionKind === 'plan') return step;
        const question = sheetToFillBlankText(sheet);
        if (!question) return step;
        const current = String(step?.questionAnswerPairs?.[0]?.question || '').trim();
        if (current === question) return step;
        changed = true;
        return {
            ...step,
            autoLinkedSheetId: linkedId,
            autoLinkedSheetMode: 'full',
            autoRevisionKind: 'full',
            sourceKind: 'sheet',
            sourceSheetUrl: `sheet:${linkedId}`,
            questionCount: 1,
            questionAnswerPairs: [{
                question,
                answer: '',
                expectedKeywords: [],
                generatedByAi: false,
                validationType: 'fill_blanks'
            }]
        };
    });
    return { steps: nextSteps, changed };
};

module.exports = { sheetToFillBlankText, synchronizeLinkedSheetQuestions };
