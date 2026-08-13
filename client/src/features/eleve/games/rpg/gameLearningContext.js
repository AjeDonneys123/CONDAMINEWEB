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

const nonBoldAttackCues = (html = '') => String(html || '')
  .split(/<br\s*\/?>|<\/div>/i)
  .filter((line) => /^\s*(?:<[^>]+>)*\d+\s*[-–—]/i.test(line))
  .map((line, index) => {
    const outsideBold = line
      .replace(/<(?:strong|b)(?:\s[^>]*)?>[\s\S]*?<\/(?:strong|b)>/gi, '|')
      .replace(/<[^>]+>/g, ' ')
      .replace(/^\s*\d+\s*[-–—]\s*/, '');
    const candidates = outsideBold.split('|').map((segment) => {
      const words = segment.match(/[A-Za-zÀ-ÖØ-öø-ÿŒœ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿŒœ]+)*/g) || [];
      while (words.length && /^(le|la|les|l|un|une|il|elle|est|se)$/i.test(words[0])) words.shift();
      return words;
    }).filter((words) => words.length >= 2 || (words.length === 1 && words[0].length >= 4 && !/^(dans|avec|pour|vers)$/i.test(words[0])));
    if (!candidates.length) return `attaque ${index + 1}`;
    const words = candidates[Math.floor(Math.random() * candidates.length)];
    const size = Math.min(3, words.length);
    const start = Math.floor(Math.random() * Math.max(1, words.length - size + 1));
    return words.slice(start, start + size).join(' ');
  });

const lessonTitleFromSheet = (step = {}, fallback = 'Leçon') => {
  const firstLine = String(step?.sheetText || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).find(Boolean);
  return String(firstLine || step?.title || fallback)
    .replace(/^(?:partie\s+)?[IVXLCDM]+[.\s·:-]+/i, '')
    .replace(/^fiche\s+(?:g[eé]n[eé]rale\s*)?[·:-]\s*/i, '')
    .trim();
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
  const resources = { generalSheets: [], lessonSheets: [], generalVideos: [], sequenceVideos: [] };
  const activeModules = (Array.isArray(modules) ? modules : [])
    .filter((module) => module?.chapterIsActive !== false);
  activeModules.forEach((module) => {
    const sections = Array.isArray(module?.sections) ? module.sections : [];
    const sectionById = new Map(sections.map((section, index) => [
      String(section?.id || ''),
      { title: String(section?.title || section?.name || `Partie ${index + 1}`).trim(), order: index }
    ]));
    const steps = Array.isArray(module?.steps) ? module.steps : [];
    steps.forEach((step, index) => {
      const title = String(step?.title || `${step?.type === 'video' ? 'Vidéo' : 'Fiche'} ${index + 1}`).trim();
      if (step?.type === 'sheet' && String(step?.sheetText || step?.sheetUrl || '').trim()) {
        const row = { id: String(step?.id || index), title, text: String(step?.sheetText || ''), html: String(step?.sheetTextHtml || ''), url: String(step?.sheetUrl || '') };
        (/introduction|fiche\s+g[eé]n[eé]rale|plan\s+des/i.test(title) ? resources.generalSheets : resources.lessonSheets).push(row);
      }
      if (step?.type === 'video') {
        const url = String(step?.videoUrl || step?.url || step?.sourceUrl || step?.presentationUrl || '').trim();
        if (!url) return;
        const row = { id: String(step?.id || index), title, url };
        (/introduction|g[eé]n[eé]ral/i.test(title) ? resources.generalVideos : resources.sequenceVideos).push(row);
      }
    });
    const quizzesBySection = new Map();
    steps.filter((step) => step?.type === 'quiz').forEach((step) => {
      const key = String(step?.sectionId || 'module');
      quizzesBySection.set(key, [...(quizzesBySection.get(key) || []), ...sanitizeQuiz(step)]);
    });

    steps.filter((step) => step?.type === 'sheet' && String(step?.sheetText || '').trim()).forEach((step, index) => {
      const sectionId = String(step?.sectionId || 'module');
      const section = sectionById.get(sectionId);
      const sectionLabel = String(section?.title || step?.title || '').trim();
      if (/introduction|fiche\s+g[eé]n[eé]rale|plan\s+des/i.test(sectionLabel) || /introduction|fiche\s+g[eé]n[eé]rale|plan\s+des/i.test(String(step?.title || ''))) return;
      const text = String(step.sheetText || '').replace(/\r/g, '').trim();
      const keywords = [
        ...keywordsFromHtml(step?.sheetTextHtml),
        ...(Array.isArray(step?.sheetKeywords) ? step.sheetKeywords.map(cleanText) : [])
      ].filter(Boolean);
      const mainPoints = parseLessonLines(text, keywords);
      if (!mainPoints.length) return;
      const attackCues = nonBoldAttackCues(step?.sheetTextHtml);
      mainPoints.forEach((point, pointIndex) => { point.attackCue = attackCues[pointIndex] || point.text; });
      lessons.push({
        id: `${module?._id || 'module'}:${step?.id || index}`,
        moduleId: String(module?._id || ''),
        chapterId: String(module?.chapterId || module?._id || ''),
        sectionId,
        title: lessonTitleFromSheet(step, section?.title || module?.title || 'Leçon'),
        chapterTitle: String(module?.chapterTitle || module?.title || ''),
        mainPoints,
        quiz: quizzesBySection.get(sectionId) || []
      });
    });
  });

  const chapterMap = new Map(activeModules.map((module) => {
    const chapterId = String(module?.chapterId || module?._id || '');
    return [chapterId, {
      id: chapterId,
      title: String(module?.chapterTitle || module?.title || 'Chapitre'),
      section: String(module?.chapterSection || module?.subject || 'GÉNÉRAL'),
      lessons: []
    }];
  }));
  lessons.forEach((lesson) => {
    const chapterId = String(lesson.chapterId || lesson.moduleId || '');
    if (!chapterMap.has(chapterId)) {
      chapterMap.set(chapterId, {
        id: chapterId,
        title: lesson.chapterTitle || lesson.title || 'Chapitre',
        lessons: []
      });
    }
    chapterMap.get(chapterId).lessons.push(lesson);
  });

  return {
    version: 1,
    student: {
      id: String(student?._id || student?.id || ''),
      level: String(student?.level || student?.classLevel || student?.className || '')
    },
    chapters: [...chapterMap.values()],
    lessons,
    resources
  };
}
