const escapeHtml = (value = '') => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const partTitlePattern = /^partie\s+(?:[ivxlcdm]+|\d+)\b/i;
const masterTitlePattern = /fiche\s+g[ée]n[ée]rale/i;
const planTitlePattern = /plan\s+des\s+grandes\s+parties/i;

const quizToText = (steps = []) => (Array.isArray(steps) ? steps : [])
    .filter((step) => step?.type === 'quiz' && Array.isArray(step?.quizQuestions) && step.quizQuestions.length > 0)
    .map((step, lessonIndex) => {
        const title = String(step.quizSourceTitle || step.title || `Partie ${lessonIndex + 1}`).trim();
        const rows = [`LEÇON ${lessonIndex + 1} : ${title}`];
        step.quizQuestions.forEach((question, questionIndex) => {
            rows.push(`${questionIndex + 1}- ${String(question?.question || '').trim()}`);
            (Array.isArray(question?.choices) ? question.choices : []).slice(0, 4).forEach((choice, choiceIndex) => {
                const text = String(choice || '').trim();
                rows.push(`${String.fromCharCode(97 + choiceIndex)}) ${choiceIndex === Number(question?.correctIndex || 0) ? `**${text}**` : text}`);
            });
        });
        return rows.join('\n');
    })
    .filter(Boolean)
    .join('\n');

const textToHtml = (value = '') => String(value || '')
    .split(/\r?\n/)
    .map((line) => `<div>${escapeHtml(line) || '<br>'}</div>`)
    .join('');

const restoreGeneralSheet = (rawSteps = [], moduleTitle = 'Apprentissage') => {
    const originalSignature = JSON.stringify(Array.isArray(rawSteps) ? rawSteps : []);
    const steps = (Array.isArray(rawSteps) ? rawSteps : []).map((step) => ({ ...step }));
    let masterIndex = steps.findIndex((step) => step?.type === 'sheet' && step?.isGeneralSheetMaster === true);
    if (masterIndex < 0) masterIndex = steps.findIndex((step) => step?.type === 'sheet' && masterTitlePattern.test(String(step?.title || '')));

    const partIndexes = steps
        .map((step, index) => ({ step, index }))
        .filter(({ step, index }) => index !== masterIndex && step?.type === 'sheet' && partTitlePattern.test(String(step?.title || '')))
        .map(({ index }) => index);
    const hasPlan = steps.some((step) => step?.type === 'sheet' && planTitlePattern.test(String(step?.title || '')));
    const hasQuiz = steps.some((step) => step?.type === 'quiz' && Array.isArray(step?.quizQuestions) && step.quizQuestions.length > 0);
    const looksDistributed = partIndexes.length > 0 && (hasPlan || hasQuiz || partIndexes.length > 1);
    if (masterIndex < 0 && !looksDistributed) return { steps, changed: false, created: false };

    let created = false;
    if (masterIndex < 0) {
        const introSectionId = String(steps.find((step) => planTitlePattern.test(String(step?.title || '')))?.sectionId || steps[0]?.sectionId || 'sec_1');
        const documentTitle = String(moduleTitle || 'Fiche générale').trim();
        const partsText = partIndexes.map((index) => String(steps[index]?.sheetText || '').trim()).filter(Boolean).join('\n');
        const partsHtml = partIndexes.map((index) => String(steps[index]?.sheetTextHtml || '').trim() || textToHtml(steps[index]?.sheetText || '')).join('');
        const quizText = quizToText(steps);
        const id = `general_sheet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const master = {
            id,
            order: 0,
            type: 'sheet',
            sectionId: introSectionId,
            title: `Fiche générale · ${documentTitle}`.slice(0, 120),
            sheetText: [documentTitle, partsText, quizText && 'QCM DE RÉVISION', quizText].filter(Boolean).join('\n'),
            sheetTextHtml: `<div><strong>${escapeHtml(documentTitle)}</strong></div>${partsHtml}${quizText ? `<div><strong>QCM DE RÉVISION</strong></div>${textToHtml(quizText)}` : ''}`,
            generalSheetGenerated: true,
            isGeneralSheetMaster: true,
            generalSheetDocumentTitle: documentTitle,
            generalSheetQuizText: quizText,
            generalSheetQuizHtml: quizText ? textToHtml(quizText) : '',
            generalSheetSyncVersion: 1
        };
        const insertionIndex = Math.max(0, steps.findIndex((step) => planTitlePattern.test(String(step?.title || ''))));
        steps.splice(insertionIndex, 0, master);
        masterIndex = insertionIndex;
        created = true;
    }

    const master = steps[masterIndex];
    const masterId = String(master.id || `general_sheet_${Date.now()}`);
    master.id = masterId;
    master.generalSheetGenerated = true;
    master.isGeneralSheetMaster = true;
    master.generalSheetDocumentTitle = String(master.generalSheetDocumentTitle || String(master.sheetText || '').split(/\r?\n/).find((line) => String(line).trim()) || moduleTitle || 'Fiche générale').trim();
    master.generalSheetQuizText = String(master.generalSheetQuizText || quizToText(steps));
    master.generalSheetQuizHtml = String(master.generalSheetQuizHtml || (master.generalSheetQuizText ? textToHtml(master.generalSheetQuizText) : ''));

    let partIndex = 0;
    steps.forEach((step, index) => {
        const generatedCompanion = index !== masterIndex && (
            (step?.type === 'sheet' && (partTitlePattern.test(String(step?.title || '')) || planTitlePattern.test(String(step?.title || ''))))
            || step?.type === 'quiz'
            || (step?.type === 'question' && /(?:r[ée]vision\s+de\s+la\s+fiche|restituer\s+le\s+plan)/i.test(String(step?.title || '')))
        );
        if (!generatedCompanion) return;
        step.generalSheetGenerated = true;
        if (step.type === 'sheet' && partTitlePattern.test(String(step.title || ''))) {
            step.generalSheetParentId = masterId;
            step.generalSheetPartIndex = partIndex;
            partIndex += 1;
        }
    });

    steps.forEach((step, index) => { step.order = index; });
    return { steps, changed: created || JSON.stringify(steps) !== originalSignature, created };
};

module.exports = { restoreGeneralSheet };
