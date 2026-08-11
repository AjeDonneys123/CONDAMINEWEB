const decodeHtml = (value = '') => {
  if (typeof document === 'undefined') return String(value || '').replace(/<[^>]+>/g, ' ');
  const node = document.createElement('textarea');
  node.innerHTML = String(value || '');
  return node.value;
};

const cleanText = (value = '') => decodeHtml(String(value || '').replace(/<[^>]+>/g, ' '))
  .replace(/\u00a0/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim();

const keywordsFromHtml = (html = '') => {
  const rows = [];
  const source = String(html || '');
  const pattern = /<(?:strong|b)(?:\s[^>]*)?>([\s\S]*?)<\/(?:strong|b)>/gi;
  let match;
  while ((match = pattern.exec(source))) {
    const keyword = cleanText(match[1]);
    if (keyword && !rows.some((item) => item.toLocaleLowerCase('fr') === keyword.toLocaleLowerCase('fr'))) {
      rows.push(keyword);
    }
  }
  return rows;
};

const parseLessonLines = (text = '', keywords = []) => {
  const mainPoints = [];
  let current = null;
  String(text || '').replace(/\r/g, '').split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) return;
    const mainMatch = line.match(/^(\d+)\s*[-–—]\s*(.+)$/);
    if (mainMatch) {
      current = {
        number: Number(mainMatch[1]),
        text: mainMatch[2].trim(),
        keywords: [],
        subPoints: []
      };
      mainPoints.push(current);
      return;
    }
    const subMatch = line.match(/^[-–—]\s*(.+)$/);
    if (subMatch && current) {
      current.subPoints.push(subMatch[1].trim());
      return;
    }
    if (current) {
      current.text = `${current.text} ${line}`.trim();
    }
  });

  mainPoints.forEach((point) => {
    const haystack = [point.text, ...point.subPoints].join(' ').toLocaleLowerCase('fr');
    point.keywords = keywords.filter((keyword) => haystack.includes(keyword.toLocaleLowerCase('fr')));
  });
  return mainPoints;
};

const sanitizeQuiz = (step = {}) => (Array.isArray(step.quizQuestions) ? step.quizQuestions : [])
  .map((row, index) => ({
    id: String(row?.id || `${step.id || 'quiz'}-${index + 1}`),
    question: String(row?.question || row?.q || '').trim(),
    choices: (Array.isArray(row?.choices) ? row.choices : []).map((choice) => String(choice || '').trim()).slice(0, 4),
    correctIndex: Math.max(0, Number(row?.correctIndex || 0))
  }))
  .filter((row) => row.question && row.choices.length >= 2);

export function buildGameLearningContext(modules = [], student = {}) {
  const lessons = [];
  (Array.isArray(modules) ? modules : []).forEach((module) => {
    const sections = Array.isArray(module?.sections) ? module.sections : [];
    const sectionById = new Map(sections.map((section, index) => [
      String(section?.id || ''),
      { title: String(section?.title || section?.name || `Partie ${index + 1}`).trim(), order: index }
    ]));
    const steps = Array.isArray(module?.steps) ? module.steps : [];
    const quizzesBySection = new Map();
    steps.filter((step) => step?.type === 'quiz').forEach((step) => {
      const key = String(step?.sectionId || 'module');
      quizzesBySection.set(key, [...(quizzesBySection.get(key) || []), ...sanitizeQuiz(step)]);
    });

    steps.filter((step) => step?.type === 'sheet' && String(step?.sheetText || '').trim()).forEach((step, index) => {
      const sectionId = String(step?.sectionId || 'module');
      const section = sectionById.get(sectionId);
      const text = String(step.sheetText || '').replace(/\r/g, '').trim();
      const keywords = [
        ...keywordsFromHtml(step?.sheetTextHtml),
        ...(Array.isArray(step?.sheetKeywords) ? step.sheetKeywords.map(cleanText) : [])
      ].filter(Boolean);
      const mainPoints = parseLessonLines(text, keywords);
      if (!mainPoints.length) return;
      lessons.push({
        id: `${module?._id || 'module'}:${step?.id || index}`,
        moduleId: String(module?._id || ''),
        sectionId,
        title: section?.title || String(step?.title || module?.title || module?.chapterTitle || 'Leçon'),
        chapterTitle: String(module?.chapterTitle || module?.title || ''),
        mainPoints,
        quiz: quizzesBySection.get(sectionId) || []
      });
    });
  });

  return {
    version: 1,
    student: {
      id: String(student?._id || student?.id || ''),
      level: String(student?.level || student?.classLevel || student?.className || '')
    },
    lessons
  };
}
