import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../services/api';
import StudioDistributionSidebar from '../components/StudioDistributionSidebar';
import { resolveBackendAssetUrl, resolveDriveAssetUrl } from '../../../utils/driveUrl';
import SheetRichTextEditor from './SheetRichTextEditor';

const uid = () => `st_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const inferLearningLevelFromClass = (value = '') => {
    const match = String(value || '').trim().toUpperCase().match(/^([1-6])/);
    return match ? match[1] : '';
};
const normalizeLearningLevel = (value = '') => {
    const cleaned = String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    if (/^(6|6E|6EME|SIXIEME)/.test(cleaned)) return '6';
    if (/^(5|5E|5EME|CINQUIEME)/.test(cleaned)) return '5';
    if (/^(4|4E|4EME|QUATRIEME)/.test(cleaned)) return '4';
    if (/^(3|3E|3EME|TROISIEME)/.test(cleaned)) return '3';
    if (/^(2|2DE|2NDE|SECONDE)/.test(cleaned)) return '2';
    if (/^(1|1ERE|PREMIERE)/.test(cleaned)) return '1';
    return cleaned;
};
const renderFillBlankDetectionPreview = (value = '', placeholder = '') => {
    const source = String(value || '');
    const matcher = /[\"“«]([^\"”»]+)[\"”»]/g;
    const nodes = [];
    let cursor = 0;
    let match;
    let detected = 0;
    if (!source) return { nodes: <span className="text-slate-400">{placeholder}</span>, detected: 0 };
    while ((match = matcher.exec(source)) !== null) {
        nodes.push(source.slice(cursor, match.index));
        const content = String(match[1] || '');
        const before = source.slice(0, match.index);
        const after = source.slice(match.index + match[0].length);
        const isList = content.includes('+')
            || /[\"”»]\+$/.test(before)
            || /^\+[\"“«]/.test(after);
        nodes.push(
            <span key={`blank_preview_${detected}_${match.index}`} className={`font-black ${isList ? 'text-blue-600' : 'text-red-600'}`}>
                {match[0]}
            </span>
        );
        detected += 1;
        cursor = match.index + match[0].length;
    }
    nodes.push(source.slice(cursor));
    return { nodes, detected };
};

// Aperçu professeur : même syntaxe que le texte à trous élève, sans devoir
// sauvegarder ou ouvrir l'apprentissage dans un second onglet.
const parseFillBlankForTest = (value = '') => {
    const source = String(value || '');
    const parts = [];
    const blanks = [];
    let cursor = 0;
    const quoteAt = (position) => {
        const match = source.slice(position).match(/^["“«]([^"”»]+)["”»]/);
        return match ? { content: String(match[1] || '').trim(), end: position + match[0].length } : null;
    };
    while (cursor < source.length) {
        const offset = source.slice(cursor).search(/["“«]/);
        if (offset < 0) break;
        const start = cursor + offset;
        const first = quoteAt(start);
        if (!first) { cursor = start + 1; continue; }
        const items = [first.content];
        let sequenceEnd = first.end;
        while (source[sequenceEnd] === '+') {
            const next = quoteAt(sequenceEnd + 1);
            if (!next) break;
            items.push(next.content);
            sequenceEnd = next.end;
        }
        parts.push(source.slice(cursor, start));
        if (items.length > 1) {
            blanks.push({ type: 'list_flexible', items, raw: items.join('+') });
            cursor = sequenceEnd;
        } else if (first.content.includes('+')) {
            const strictItems = first.content.split('+').map((item) => item.trim()).filter(Boolean);
            blanks.push({ type: 'list_strict', items: strictItems, raw: first.content });
            cursor = first.end;
        } else {
            blanks.push({ type: 'exact', items: [first.content], raw: first.content });
            cursor = first.end;
        }
    }
    parts.push(source.slice(cursor));
    return { parts, blanks };
};

const normalizeFillBlankForTest = (value = '') => String(value || '')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’`´]/g, "'")
    .replace(/[‐‑‒–—-]/g, ' ')
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !['le', 'la', 'les', 'un', 'une', 'des', 'du', 'l', 'd', 'au', 'aux'].includes(word))
    .join(' ')
    .trim();

const FillBlankStudentTester = ({ question = '', onClose }) => {
    const parsed = parseFillBlankForTest(question);
    const [answers, setAnswers] = useState(() => parsed.blanks.map(() => ''));
    const [checked, setChecked] = useState(false);
    const isCorrect = (answer, blank) => {
        const given = normalizeFillBlankForTest(answer);
        if (!given || !blank) return false;
        const contains = (item) => String(item || '').split('=').map(normalizeFillBlankForTest).filter(Boolean)
            .some((variant) => given === variant || (` ${given} `).includes(` ${variant} `));
        if (blank.type === 'exact') return blank.items.some(contains);
        const matched = blank.items.filter(contains).length;
        return matched >= (blank.type === 'list_strict' ? blank.items.length : Math.max(1, blank.items.length - 2));
    };
    return (
        <div className="mt-2 rounded-xl border-2 border-violet-300 bg-violet-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-black uppercase text-violet-800">
                <span>👁 Test élève</span>
                <button type="button" className="rounded-md border border-violet-200 bg-white px-2 py-1 text-[10px]" onClick={onClose}>Fermer</button>
            </div>
            <div className="whitespace-pre-wrap text-[14px] font-bold leading-8 text-slate-800">
                {parsed.parts.map((part, index) => {
                    const right = isCorrect(answers[index], parsed.blanks[index]);
                    const showExpected = checked && !right;
                    return <React.Fragment key={`test_blank_${index}`}><span>{part}</span>{index < parsed.blanks.length && <input
                        className={`mx-1 inline-block min-w-[120px] max-w-full rounded-md border-2 px-2 py-1 text-center outline-none ${checked ? (right ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-red-500 bg-red-50 text-red-700') : 'border-blue-300 bg-white text-slate-800'}`}
                        value={showExpected ? parsed.blanks[index].raw : (answers[index] || '')}
                        disabled={checked}
                        onChange={(event) => setAnswers((previous) => previous.map((answer, answerIndex) => answerIndex === index ? event.target.value : answer))}
                        aria-label={`Trou ${index + 1}`}
                    />}</React.Fragment>;
                })}
            </div>
            <button type="button" className="mt-3 rounded-lg bg-violet-600 px-3 py-2 text-[11px] font-black uppercase text-white" onClick={() => setChecked(true)}>Vérifier comme l’élève</button>
            {checked && <span className="ml-2 text-[11px] font-bold text-slate-600">Vert : juste · Rouge : réponse attendue.</span>}
        </div>
    );
};

const FillBlankSyntaxTextarea = ({ value, onChange, onKeyDown, placeholder, rows = 3 }) => {
    const previewRef = useRef(null);
    const preview = renderFillBlankDetectionPreview(value, placeholder);
    return (
        <div className="relative min-w-0 flex-1">
            <div
                ref={previewRef}
                aria-hidden="true"
                className="pointer-events-none absolute inset-[2px] overflow-hidden whitespace-pre-wrap break-words rounded-[18px] p-5 text-[13px] font-bold leading-snug text-slate-800"
            >
                {preview.nodes}
            </div>
            <textarea
                rows={rows}
                className="v84-q-input relative z-[1] !bg-transparent !text-[13px] !leading-snug !text-transparent caret-slate-800 selection:bg-blue-200/70"
                value={value}
                onChange={onChange}
                onKeyDown={onKeyDown}
                placeholder=""
                spellCheck
                onScroll={(event) => {
                    if (!previewRef.current) return;
                    previewRef.current.scrollTop = event.currentTarget.scrollTop;
                    previewRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
            />
        </div>
    );
};
const isProbablyDirectVideo = (url = '') => {
    const u = String(url || '').toLowerCase();
    if (!u) return false;
    if (u.startsWith('blob:') || u.startsWith('data:')) return true;
    if (u.includes('/api/proxy/')) return true;
    if (/(\.mp4|\.webm|\.ogg|\.m3u8)(\?|#|$)/i.test(u)) return true;
    return false;
};
const isImageLike = (url = '') => {
    const u = String(url || '').toLowerCase();
    return /(\.png|\.jpg|\.jpeg|\.webp|\.gif|\.bmp|\.svg)(\?|#|$)/i.test(u);
};
const isGoogleSlidesUrl = (url = '') => /docs\.google\.com\/presentation\/d\//i.test(String(url || '').trim());
const extractGoogleSlidesId = (url = '') => {
    const raw = String(url || '').trim();
    const m = raw.match(/\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
    return m?.[1] ? String(m[1]).trim() : '';
};
const extractGoogleSlidesPageObjectId = (url = '') => {
    const raw = String(url || '').trim();
    const m = raw.match(/(?:[?#&]slide=)(?:id\.)?([a-zA-Z0-9_-]+)/i);
    return m?.[1] ? String(m[1]).trim() : '';
};
const buildSlidesThumbnailProxyUrl = (presentationId = '', objectId = '', slideNumber = '') => {
    const pid = String(presentationId || '').trim();
    const oid = String(objectId || '').trim();
    if (!pid || !oid) return '';
    const params = new URLSearchParams({ presentationId: pid, pageObjectId: oid });
    if (String(slideNumber || '').trim()) params.set('slideNumber', String(slideNumber).trim());
    return `/api/learning/slides/thumbnail?${params.toString()}`;
};
const buildSpecificGoogleSlidePreviewUrl = (url = '') => {
    const presentationId = extractGoogleSlidesId(url);
    const pageObjectId = extractGoogleSlidesPageObjectId(url);
    if (!presentationId || !pageObjectId) return '';
    return buildSlidesThumbnailProxyUrl(presentationId, pageObjectId);
};
const toGoogleSlidesReadOnlyUrl = (url = '') => {
    const raw = String(url || '').trim();
    const presentationId = extractGoogleSlidesId(raw);
    if (!presentationId) return raw;
    return `https://docs.google.com/presentation/d/${encodeURIComponent(presentationId)}/preview?rm=minimal`;
};
const sanitizeSlideSectionMap = (input) => {
    if (!input || typeof input !== 'object') return {};
    const out = {};
    Object.entries(input).forEach(([objectId, sectionId]) => {
        const oid = String(objectId || '').trim();
        const sid = String(sectionId || '').trim();
        if (!oid || !sid) return;
        out[oid] = sid;
    });
    return out;
};
const sanitizeSlideTextMap = (input) => {
    if (!input || typeof input !== 'object') return {};
    const out = {};
    Object.entries(input).forEach(([objectId, text]) => {
        const oid = String(objectId || '').trim();
        if (!oid) return;
        out[oid] = String(text || '').replace(/\r/g, '').slice(0, 60000);
    });
    return out;
};
const getStepSlideTextMap = (step) => {
    if (!step || typeof step !== 'object') return {};
    if (step.type === 'sheet') return sanitizeSlideTextMap(step.sheetSlideTextMap);
    if (step.type === 'question') return sanitizeSlideTextMap(step.questionSlideTextMap);
    return {};
};
const parseManualQuestionBlocks = (raw = '') => {
    const src = String(raw || '').replace(/\r/g, '').trim();
    if (!src) return [];
    return src
        .split(/\n\s*\n+/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block) => {
            const out = { q: '', question: '', expectedAnswer: '', expectedKeywords: [] };
            block.split('\n').forEach((line) => {
                const trimmed = String(line || '').trim();
                if (!trimmed) return;
                const qMatch = trimmed.match(/^(?:q(?:uestion)?)[\s:.-]+(.+)$/i);
                if (qMatch) {
                    const value = String(qMatch[1] || '').trim();
                    out.q = value;
                    out.question = value;
                    return;
                }
                const aMatch = trimmed.match(/^(?:r(?:eponse)?|réponse|answer)[\s:.-]+(.+)$/i);
                if (aMatch) {
                    out.expectedAnswer = String(aMatch[1] || '').trim();
                    return;
                }
                const kMatch = trimmed.match(/^(?:mots?\s*cles?|mots?\s*clés|keywords?|tags?)[\s:.-]+(.+)$/i);
                if (kMatch) {
                    out.expectedKeywords = String(kMatch[1] || '')
                        .split(/[;,|]/)
                        .map((part) => String(part || '').trim())
                        .filter(Boolean);
                    return;
                }
                if (!out.question) {
                    out.q = trimmed;
                    out.question = trimmed;
                    return;
                }
                if (!out.expectedAnswer) {
                    out.expectedAnswer = trimmed;
                    return;
                }
                out.expectedKeywords.push(trimmed);
            });
            out.expectedKeywords = [...new Set(out.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean))];
            return out;
        })
        .filter((row) => String(row.question || '').trim());
};
const toEmbedUrl = (rawUrl = '') => {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#?/]+)/i);
    if (yt?.[1]) return `https://www.youtube.com/embed/${yt[1]}?rel=0`;
    const vimeo = url.match(/vimeo\.com\/(\d+)/i);
    if (vimeo?.[1]) return `https://player.vimeo.com/video/${vimeo[1]}`;
    return url;
};
const extractYoutubeId = (rawUrl = '') => {
    const url = String(rawUrl || '').trim();
    if (!url) return '';
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&#?/]+)/i);
    return yt?.[1] ? String(yt[1]).trim() : '';
};
// YouTube expose souvent une même vidéo sous youtu.be et youtube.com/watch.
// Les séquences doivent rester liées à la vidéo, quelle que soit cette forme.
const normalizeVideoSourceUrl = (rawUrl = '') => {
    const raw = String(rawUrl || '').trim();
    if (!raw) return '';
    const youtubeId = extractYoutubeId(raw);
    if (youtubeId) return `https://www.youtube.com/watch?v=${youtubeId}`;
    try {
        const url = new URL(raw);
        ['start', 'end', 't'].forEach((key) => url.searchParams.delete(key));
        return url.toString();
    } catch (_) {
        return raw;
    }
};
const withSegmentParams = (rawUrl = '', startSec = 0, endSec = 0) => {
    const base = String(rawUrl || '').trim();
    if (!base) return '';
    try {
        const u = new URL(base, window.location.origin);
        const start = Math.max(0, Number(startSec || 0));
        const end = Math.max(0, Number(endSec || 0));
        if (start > 0) u.searchParams.set('start', String(Math.floor(start)));
        if (end > 0 && end > start) u.searchParams.set('end', String(Math.floor(end)));
        if (u.hostname.includes('youtube.com')) u.searchParams.set('rel', '0');
        return u.toString();
    } catch (_) {
        return base;
    }
};
const withAutoplay = (rawUrl = '') => {
    const base = String(rawUrl || '').trim();
    if (!base) return '';
    try {
        const u = new URL(base, window.location.origin);
        u.searchParams.set('autoplay', '1');
        if (u.hostname.includes('youtube.com')) {
            u.searchParams.set('enablejsapi', '1');
            u.searchParams.set('playsinline', '1');
        }
        return u.toString();
    } catch (_) {
        return base;
    }
};
const QUESTION_DRAFT_FIELDS = [
    'title',
    'difficulty',
    'customQuestion',
    'sourceKind',
    'sourceSheetUrl',
    'sourceVideoRef',
    'sourceSlidesUrl',
    'materialSource',
    'materialText',
    'questionSlideTextMap',
    'questionCount',
    'questionAnswerPairs',
    'questionSectionQuestions',
    'keywords',
    'minKeywordMatches',
    'questionPinkRanges',
    'questionZoneRanges',
    'questionZoneMarkers',
    'redHighlights',
    'orangeHighlights',
    'zoneHighlights',
    'sheetAnnotations'
];

const emptyStep = (type = 'sheet') => {
    if (type === 'video') return { id: uid(), type: 'video', title: 'Vidéo', videoUrl: '', videoSourceName: '', thumbnailUrl: '', videoTranscript: '', questionCount: 3, startSec: 0, endSec: 0, mustWatchToEnd: true };
    if (type === 'quiz') return {
        id: uid(),
        type: 'quiz',
        title: 'Quiz de révision',
        hiddenFromLearning: true,
        gameQuestionBank: true,
        quizQuestions: [{
            id: uid(),
            question: '',
            choices: ['', '', '', ''],
            correctIndex: 0
        }]
    };
    if (type === 'question') return {
        id: uid(),
        type: 'question',
        title: 'Questions contrôlées',
        difficulty: 'easy',
        questionMode: 'easy',
        customQuestion: '',
        sourceKind: 'sheet',
        sourceSheetUrl: '',
        sourceVideoRef: '',
        sourceSlidesUrl: '',
        questionCount: 1,
        questionAnswerPairs: [{
            question: '',
            answer: '',
            expectedKeywords: [],
            generatedByAi: false,
            validationType: 'fill_blanks'
        }],
        orangeHighlights: [],
        redHighlights: [],
        sheetAnnotations: [],
        keywords: [],
        minKeywordMatches: 1,
        aiPreviewQuestions: []
    };
    return { id: uid(), type: 'sheet', title: 'Fiche', sheetUrl: '', sheetText: '', sheetTextHtml: '', questionCount: 3, minReadSeconds: 20 };
};

const sheetToFillBlankText = (sheet = null) => {
    const plainText = String(sheet?.sheetText || '');
    const html = String(sheet?.sheetTextHtml || '').trim();
    if (!html || typeof DOMParser === 'undefined') return plainText;
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const isHeading = (node) => {
            const line = node.closest('div, p, li, h1, h2, h3, h4, h5, h6');
            const text = String(line?.textContent || '').replace(/\u00a0/g, ' ').trim();
            return /^(?:(?:VIII|VII|VI|IV|III|II|IX|X|V|I)\.\s+|\d{1,2}\s*-\s+)/i.test(text);
        };
        // Process U first: a title can be visually bold as a whole, but only
        // the words manually underlined by the teacher are expected answers.
        const formattedNodes = [
            ...Array.from(doc.body.querySelectorAll('u')),
            ...Array.from(doc.body.querySelectorAll('strong, b'))
        ];
        formattedNodes.forEach((node) => {
            if (node.tagName !== 'U' && isHeading(node)) return;
            const raw = String(node.textContent || '').replace(/\u00a0/g, ' ');
            // Keep list markers and punctuation in the displayed text, outside
            // the expected answer. A student must answer the word, not `1-`.
            const prefix = raw.match(/^\s*(?:(?:\d{1,2}\s*[-.)]|[a-z]\)|[-–—•▪◦])\s*)?/i)?.[0] || '';
            const withoutPrefix = raw.slice(prefix.length);
            const suffix = withoutPrefix.match(/(?:\s*[,.!?;:…]+\s*)$/)?.[0] || '';
            const value = withoutPrefix
                .slice(0, Math.max(0, withoutPrefix.length - suffix.length))
                .trim()
                .replace(/^["“”«»]+|["“”«»]+$/g, '')
                .trim();
            if (value) node.replaceWith(doc.createTextNode(`${prefix}"${value}"${suffix}`));
            else node.replaceWith(doc.createTextNode(raw));
        });
        doc.body.querySelectorAll('br').forEach((node) => node.replaceWith(doc.createTextNode('\n')));
        doc.body.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach((node) => {
            node.appendChild(doc.createTextNode('\n'));
        });
        const converted = String(doc.body.textContent || '')
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        return converted || plainText;
    } catch {
        return plainText;
    }
};

const unquoteKeywordsOnFirstContentLine = (value = '') => {
    let firstContentLineHandled = false;
    return String(value || '').split('\n').map((line) => {
        if (firstContentLineHandled || !String(line || '').trim()) return line;
        firstContentLineHandled = true;
        return String(line || '').replace(/["“«]([^"”»\n]+)["”»]/g, '$1');
    }).join('\n');
};

const structureRevisionLines = (value = '') => {
    let titleHandled = false;
    let pointNumber = 0;
    return String(value || '').replace(/\r/g, '').split('\n').map((line) => {
        const raw = String(line || '');
        const trimmed = raw.trim();
        if (!trimmed) return '';
        if (!titleHandled) {
            titleHandled = true;
            return trimmed;
        }
        if (/^[-–—•▪◦➤⇒→]\s*/.test(trimmed)) {
            return `- ${trimmed.replace(/^[-–—•▪◦➤⇒→]\s*/, '')}`;
        }
        pointNumber += 1;
        return `${pointNumber}- ${trimmed.replace(/^\d+\s*[-.)]\s*/, '')}`;
    }).join('\n');
};

const structureRevisionHtml = (value = '') => {
    const html = String(value || '').trim();
    if (!html || typeof DOMParser === 'undefined') return html;
    try {
        const doc = new DOMParser().parseFromString(`<div id="revision-root">${html}</div>`, 'text/html');
        const root = doc.getElementById('revision-root');
        if (!root) return html;
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
        return root.innerHTML;
    } catch (_) {
        return html;
    }
};

const structureSheetForRevision = (sheet = null) => ({
    ...sheet,
    sheetText: structureRevisionLines(sheet?.sheetText || ''),
    sheetTextHtml: structureRevisionHtml(sheet?.sheetTextHtml || '')
});

const renumberRemainingMainPoints = (value = '') => {
    let nextNumber = 0;
    return String(value || '').split('\n').map((line) => {
        const match = String(line || '').match(/^(\s*)(?:\d+\s*[-.)]|-\s*\d+)\s*(.*)$/);
        if (!match) return line;
        nextNumber += 1;
        return `${match[1]}${nextNumber}- ${match[2]}`;
    }).join('\n');
};

const escapeGeneralSheetHtml = (value = '') => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

// Les titres sont mis en forme par leur bloc, et non avec un <strong> autour
// de toute la ligne : sinon chaque mot d'un titre deviendrait une réponse du
// texte à trous. Cette fonction est également utilisée pendant la découpe en
// sous-fiches, afin que ces styles ne disparaissent pas à la sauvegarde.
const formatGeneratedSheetBlock = (text = '', innerHtml = '') => {
    const line = String(text || '').replace(/\u00a0/g, ' ').trim();
    const romanHeading = /^(?:VIII|VII|VI|IV|III|II|IX|X|V|I)\.\s+.+/i.test(line);
    const mainHeading = /^\d{1,2}\s*-\s+.+/.test(line);
    let content = String(innerHtml || '').trim() || escapeGeneralSheetHtml(line);

    // Dans un sous-titre vert, un vrai gras est un mot-clé. On le conserve en
    // gras et on lui ajoute le soulignement, sans souligner le reste du titre.
    if (mainHeading && typeof DOMParser !== 'undefined') {
        try {
            const doc = new DOMParser().parseFromString(`<div id="sheet-block">${content}</div>`, 'text/html');
            const root = doc.getElementById('sheet-block');
            root?.querySelectorAll('strong, b').forEach((keyword) => {
                if (keyword.closest('u') || String(keyword.style.textDecoration || '').includes('underline')) return;
                const underline = doc.createElement('u');
                keyword.parentNode?.insertBefore(underline, keyword);
                underline.appendChild(keyword);
            });
            content = root?.innerHTML || content;
        } catch (_) {}
    }

    const style = romanHeading
        ? 'color:#dc2626;font-weight:700'
        : mainHeading
            ? 'color:#16a34a;font-weight:700'
            : '';
    return `<div${style ? ` style="${style}"` : ''}>${content}</div>`;
};

// Découpe le HTML de la Superfiche ligne par ligne sans casser les balises
// englobantes. Un éditeur contenteditable peut produire par exemple
// `<strong>ligne 1<br>ligne 2</strong>` : un simple split sur BR faisait perdre
// le gras de la ligne 2 et donc les mots-clés des fiches de sous-sections.
const generalSheetHtmlToBlocks = (richHtml = '') => {
    if (!String(richHtml || '').trim() || typeof DOMParser === 'undefined') return [];
    const doc = new DOMParser().parseFromString(`<div id="general-sheet-root">${String(richHtml)}</div>`, 'text/html');
    const root = doc.getElementById('general-sheet-root');
    if (!root) return [];

    const blocks = [];
    let textParts = [];
    let htmlParts = [];
    const flush = () => {
        const text = textParts.join('').replace(/\u00a0/g, ' ').trim();
        const html = htmlParts.join('').trim();
        if (text) blocks.push({ text, html: formatGeneratedSheetBlock(text, html) });
        textParts = [];
        htmlParts = [];
    };
    const wrapText = (text = '', context = {}) => {
        let value = escapeGeneralSheetHtml(String(text || '').replace(/\u00a0/g, ' '));
        if (context.italic) value = `<em>${value}</em>`;
        if (context.color) value = `<span style="color:${escapeGeneralSheetHtml(context.color)}">${value}</span>`;
        if (context.underline) value = `<u>${value}</u>`;
        if (context.bold) value = `<strong>${value}</strong>`;
        return value;
    };
    const visit = (node, inherited = {}) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const value = String(node.nodeValue || '').replace(/\u00a0/g, ' ');
            if (!value) return;
            textParts.push(value);
            htmlParts.push(wrapText(value, inherited));
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const element = node;
        if (element.tagName === 'BR') {
            flush();
            return;
        }
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'SVG'].includes(element.tagName)) return;
        const blockElement = ['DIV', 'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(element.tagName);
        if (blockElement && textParts.join('').trim()) flush();
        const fontWeight = String(element.style?.fontWeight || '').toLowerCase();
        const textDecoration = String(element.style?.textDecoration || element.style?.textDecorationLine || '').toLowerCase();
        const color = String(element.style?.color || element.getAttribute?.('color') || inherited.color || '').trim();
        const context = {
            bold: Boolean(inherited.bold
                || ['B', 'STRONG'].includes(element.tagName)
                || element.getAttribute?.('data-expected-word') === 'true'
                // La couleur et le gras du bloc `1- ...` sont une hiérarchie
                // visuelle : ils ne doivent pas transformer toute la ligne en
                // mots-clés. Seul le gras appliqué à l'intérieur du texte l'est.
                || (!blockElement && (fontWeight === 'bold' || Number.parseInt(fontWeight, 10) >= 600))),
            italic: Boolean(inherited.italic
                || ['I', 'EM'].includes(element.tagName)
                || String(element.style?.fontStyle || '').toLowerCase() === 'italic'),
            // Le soulignement est le marqueur explicite des mots à compléter,
            // y compris dans les titres `1- ...`.
            underline: Boolean(inherited.underline
                || element.tagName === 'U'
                || (!blockElement && textDecoration.includes('underline'))),
            color
        };
        Array.from(element.childNodes).forEach((child) => visit(child, context));
        if (blockElement && textParts.join('').trim()) flush();
    };
    Array.from(root.childNodes).forEach((node) => visit(node, {}));
    flush();
    return blocks;
};

const toRomanPartNumber = (value = 1) => {
    const safe = Math.max(1, Math.min(20, Number(value || 1)));
    const table = [
        [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
    ];
    let remaining = safe;
    let result = '';
    table.forEach(([amount, symbol]) => {
        while (remaining >= amount) {
            result += symbol;
            remaining -= amount;
        }
    });
    return result;
};

const replaceGeneralSheetLinePrefix = (block = {}, matcher, replacement = '') => {
    const text = String(block?.text || '').replace(/\u00a0/g, ' ').trim();
    const nextText = text.replace(matcher, replacement);
    // Une ligne déjà normalisée ne doit surtout pas être reconstruite depuis
    // son texte brut : cela supprimerait les balises <strong> de ses mots-clés.
    if (nextText === text) {
        return {
            ...block,
            text: nextText,
            html: String(block?.html || '').trim() || `<div>${escapeGeneralSheetHtml(nextText)}</div>`
        };
    }
    if (typeof DOMParser === 'undefined') {
        return {
            ...block,
            text: nextText,
            html: `<div>${escapeGeneralSheetHtml(nextText)}</div>`
        };
    }
    try {
        const doc = new DOMParser().parseFromString(`<div id="general-sheet-line">${String(block?.html || '')}</div>`, 'text/html');
        const root = doc.getElementById('general-sheet-line');
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        while (node && !String(node.nodeValue || '').trim()) node = walker.nextNode();
        if (node) node.nodeValue = String(node.nodeValue || '').replace(matcher, replacement);
        return { ...block, text: nextText, html: root?.innerHTML || `<div>${escapeGeneralSheetHtml(nextText)}</div>` };
    } catch (_) {
        return { ...block, text: nextText, html: `<div>${escapeGeneralSheetHtml(nextText)}</div>` };
    }
};

const normalizeGeneralSheetLessonBlocks = (sourceBlocks = []) => {
    let automaticSubIdeas = false;
    return sourceBlocks
        .filter((block) => String(block?.text || '').replace(/\u00a0/g, ' ').trim())
        .map((sourceBlock) => {
            let block = {
                ...sourceBlock,
                text: String(sourceBlock?.text || '').replace(/\u00a0/g, ' ').trim()
            };
            const text = block.text;
            const romanHeading = /^(?:VIII|VII|VI|IV|III|II|IX|X|V|I)(?:\s*[.):\-–—]\s*|\s+).+/i.test(text);
            const mainIdea = /^\d{1,2}\s*[-.)]\s*.+/.test(text);
            const explicitSubIdea = /^[a-z]\)\s*.+/i.test(text);
            const alreadyDashed = /^[-–—•▪◦]\s*.+/.test(text);

            if (romanHeading) {
                automaticSubIdeas = false;
                return block;
            }
            if (mainIdea) {
                automaticSubIdeas = /:\s*$/.test(text);
                return block;
            }
            if (explicitSubIdea) {
                return replaceGeneralSheetLinePrefix(block, /^\s*[a-z]\)\s*/i, '- ');
            }
            if (alreadyDashed) {
                return replaceGeneralSheetLinePrefix(block, /^\s*[-–—•▪◦]\s*/, '- ');
            }
            if (automaticSubIdeas) {
                return replaceGeneralSheetLinePrefix(block, /^\s*/, '- ');
            }
            return block;
        });
};

const splitGeneralSheetIntoParts = (plainText = '', richHtml = '') => {
    const fallbackLines = String(plainText || '').replace(/\r/g, '').split('\n');
    let blocks = fallbackLines.map((text) => ({
        text,
        html: formatGeneratedSheetBlock(text, escapeGeneralSheetHtml(text))
    }));
    if (String(richHtml || '').trim() && typeof DOMParser !== 'undefined') {
        try {
            const parsed = generalSheetHtmlToBlocks(richHtml);
            if (parsed.some((row) => row.text)) blocks = parsed;
        } catch (_) {}
    }
    // NotebookLM insère parfois plusieurs paragraphes vides entre deux idées.
    // Ils ne portent aucune information et produisent de très grands blancs dans la fiche.
    blocks = blocks.filter((block) => String(block?.text || '').replace(/\u00a0/g, ' ').trim());
    const qcmStart = blocks.findIndex((block) => /^(?:❓\s*)?QCM(?:\s+DE\s+R[ÉE]VISION)?\b/i.test(String(block.text || '').trim()));
    const lessonBlocks = normalizeGeneralSheetLessonBlocks(qcmStart >= 0 ? blocks.slice(0, qcmStart) : blocks);
    // Dans le QCM, a), b), c), d) restent des choix : ils ne sont jamais changés en tirets.
    const quizBlocks = qcmStart >= 0 ? blocks.slice(qcmStart + 1) : [];
    const isRomanHeading = (text = '') => /^(VIII|VII|VI|IV|III|II|IX|X|V|I)(?:\s*[.):\-–—]\s*|\s+).+/i.test(String(text || '').trim());
    const hasRomanHierarchy = lessonBlocks.some((block) => isRomanHeading(block.text));
    const headingInfo = (text = '') => {
        const value = String(text || '').trim();
        const roman = value.match(/^(VIII|VII|VI|IV|III|II|IX|X|V|I)(?:\s*[.):\-–—]\s*|\s+)(.+)$/i);
        if (roman) return { key: String(roman[1] || '').toUpperCase(), title: String(roman[2] || '').trim() };
        if (hasRomanHierarchy) return null;
        const arabic = value.match(/^(\d{1,2})\s*[.)\-–—]\s*(.+)$/);
        if (arabic) return { key: String(Number(arabic[1])), title: String(arabic[2] || '').trim() };
        return null;
    };
    const firstContent = lessonBlocks.find((row) => row.text)?.text || 'Fiche générale';
    const parts = [];
    let current = null;
    lessonBlocks.forEach((block) => {
        const heading = headingInfo(block.text);
        if (heading) {
            current = { ...heading, blocks: [block] };
            parts.push(current);
            return;
        }
        if (current) current.blocks.push(block);
    });
    const romanValue = (value = '') => {
        const roman = String(value || '').toUpperCase();
        const values = { I: 1, V: 5, X: 10 };
        let total = 0;
        for (let i = 0; i < roman.length; i += 1) {
            const currentValue = values[roman[i]] || 0;
            const nextValue = values[roman[i + 1]] || 0;
            total += currentValue < nextValue ? -currentValue : currentValue;
        }
        return total;
    };
    const quizGroups = [];
    let quizGroup = null;
    let quizQuestion = null;
    const ensureQuizGroup = (key = '') => {
        if (quizGroup) return quizGroup;
        quizGroup = { key: String(key || '1'), title: '', questions: [] };
        quizGroups.push(quizGroup);
        return quizGroup;
    };
    quizBlocks.forEach((block) => {
        const text = String(block.text || '').trim();
        if (!text) return;
        const groupMatch = text.match(/^(?:LE[CÇ]ON|PARTIE|SECTION)\s+([IVX]+|\d+)\s*(?:[:\-–—]\s*)?(.*)$/i);
        if (groupMatch) {
            const rawKey = String(groupMatch[1] || '1');
            quizGroup = {
                key: /^\d+$/.test(rawKey) ? String(Number(rawKey)) : String(romanValue(rawKey)),
                title: String(groupMatch[2] || '').trim(),
                questions: []
            };
            quizGroups.push(quizGroup);
            quizQuestion = null;
            return;
        }
        const questionMatch = text.match(/^\d+\s*[.)\-]\s*(.+)$/);
        if (questionMatch) {
            quizQuestion = { id: uid(), question: String(questionMatch[1] || '').trim(), choices: [], correctIndex: -1 };
            ensureQuizGroup().questions.push(quizQuestion);
            return;
        }
        const choiceMatch = text.match(/^(?:[-•]\s*)?([A-D])\s*[.)\-]\s*(.+)$/i);
        if (choiceMatch && quizQuestion) {
            const choice = String(choiceMatch[2] || '').trim();
            const choiceIndex = quizQuestion.choices.length;
            quizQuestion.choices.push(choice);
            if (/<(?:strong|b)\b/i.test(String(block.html || ''))) quizQuestion.correctIndex = choiceIndex;
        }
    });
    quizGroups.forEach((group) => {
        group.questions = group.questions
            .filter((question) => question.question && question.choices.length >= 2)
            .map((question) => ({
                ...question,
                choices: [...question.choices, '', '', '', ''].slice(0, 4),
                correctIndex: question.correctIndex >= 0 ? question.correctIndex : 0
            }));
    });
    return {
        documentTitle: firstContent,
        quizGroups,
        parts: parts.map((part) => ({
            ...part,
            text: part.blocks.map((row) => row.text).join('\n').trim(),
            html: part.blocks.map((row) => row.html).join('')
        }))
    };
};

// La fiche générale reste un véritable élément de l'apprentissage. Les parties
// générées gardent un lien vers elle afin qu'une correction dans une petite
// fiche soit immédiatement répercutée dans la fiche complète.
const rebuildGeneralSheetMaster = (master = {}, steps = []) => {
    const children = (Array.isArray(steps) ? steps : [])
        .filter((step) => step?.type === 'sheet'
            && String(step?.generalSheetParentId || '') === String(master?.id || ''))
        .sort((a, b) => Number(a?.generalSheetPartIndex || 0) - Number(b?.generalSheetPartIndex || 0));
    if (!children.length) return master;
    const documentTitle = String(master?.generalSheetDocumentTitle || master?.title || 'Fiche générale').trim();
    const lessonText = children.map((step) => String(step?.sheetText || '').trim()).filter(Boolean).join('\n');
    const lessonHtml = children.map((step) => String(step?.sheetTextHtml || '').trim()
        || `<div>${escapeGeneralSheetHtml(step?.sheetText || '')}</div>`).join('');
    const quizText = String(master?.generalSheetQuizText || '').trim();
    const quizHtml = String(master?.generalSheetQuizHtml || '').trim();
    return {
        ...master,
        sheetText: [documentTitle, lessonText, quizText].filter(Boolean).join('\n'),
        sheetTextHtml: `<div>${escapeGeneralSheetHtml(documentTitle)}</div>${lessonHtml}${quizHtml}`,
        // Force l'éditeur de la fiche générale à refléter immédiatement les
        // changements faits dans une sous-fiche, même s'il a déjà été monté.
        generalSheetSyncVersion: Number(master?.generalSheetSyncVersion || 0) + 1
    };
};

const sheetToRevisionQuestion = (sheet = null, requestedKind = 'full') => {
    const fullRevisionText = sheetToFillBlankText(sheet);
    const sourceText = String(sheet?.sheetText || fullRevisionText || '').replace(/\r/g, '');
    const headings = [];
    const seen = new Set();
    sourceText.split('\n').forEach((line) => {
        const rawLine = String(line || '');
        const romanMatch = rawLine.match(/^\s*(?:partie\s+)?(VIII|VII|VI|IV|III|II|IX|X|V|I)(?:\s*[.):\-–—]\s*|\s+)(.+?)\s*$/i);
        const arabicMatch = rawLine.match(/^\s*(\d{1,2})\s*[.)\-–—]\s*(.+?)\s*$/);
        const match = romanMatch || arabicMatch;
        if (!match) return;
        const headingKey = romanMatch
            ? String(match[1] || '').toUpperCase()
            : String(Number(match[1] || 0));
        const title = String(match[2] || '')
            .trim()
            .replace(/^["“”«»]+|["“”«»]+$/g, '')
            .trim();
        if (!title || seen.has(headingKey)) return;
        seen.add(headingKey);
        headings.push({ key: headingKey, title });
    });
    if (requestedKind === 'plan') {
        return {
            kind: 'plan',
            title: 'Question IA · restituer le plan de la fiche',
            text: headings.map(({ title }, index) => `${index + 1} "${title}"`).join('\n')
        };
    }
    const revisionTextWithoutTitleKeyword = unquoteKeywordsOnFirstContentLine(fullRevisionText);
    return {
        kind: 'full',
        title: 'Question IA · révision de la fiche',
        // Une super fiche est déjà structurée par NotebookLM : conserver ses
        // numéros et ses sous-points au lieu de les recalculer côté CondaWeb.
        text: sheet?.generalSheetGenerated
            ? revisionTextWithoutTitleKeyword
            : structureRevisionLines(revisionTextWithoutTitleKeyword)
    };
};

const normalizeLoadedSteps = (rawSteps = []) => {
    if (!Array.isArray(rawSteps)) return [];
    const sorted = [...rawSteps].sort((a, b) => {
        const ao = Number(a?.order);
        const bo = Number(b?.order);
        const aOk = Number.isFinite(ao);
        const bOk = Number.isFinite(bo);
        if (aOk && bOk) return ao - bo;
        if (aOk) return -1;
        if (bOk) return 1;
        return 0;
    });
    const usedIds = new Set();
    return sorted.map((s, i) => {
        const rawId = String(s?.id || `step_${i + 1}`).trim() || `step_${i + 1}`;
        let nextId = rawId;
        let suffix = 2;
        while (usedIds.has(nextId)) {
            nextId = `${rawId}_${suffix}`;
            suffix += 1;
        }
        usedIds.add(nextId);
        return { ...s, id: nextId };
    });
};

const normalizeLoadedSections = (rawSections = []) => {
    if (!Array.isArray(rawSections) || rawSections.length === 0) {
        return [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
    }
    const used = new Set();
    return rawSections.map((s, i) => {
        const baseId = String(s?.id || `sec_${i + 1}`).trim() || `sec_${i + 1}`;
        let id = baseId;
        let n = 2;
        while (used.has(id)) {
            id = `${baseId}_${n}`;
            n += 1;
        }
        used.add(id);
        return {
            id,
            name: String(s?.name || `Section ${i + 1}`).trim() || `Section ${i + 1}`,
            order: Number.isFinite(Number(s?.order)) ? Number(s.order) : i,
            visible: s?.visible !== false
        };
    }).sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
};

const normalizeCourseMatchText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(chapitre|sequence|cours|histoire|geo(?:graphie)?|emc|ch)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const COURSE_MATCH_STOP_WORDS = new Set(['le', 'la', 'les', 'de', 'des', 'du', 'un', 'une', 'et', 'en', 'au', 'aux', 'ses', 'ces', 'son', 'sa']);

const getCourseMatchTokens = (value = '') => normalizeCourseMatchText(value)
    .split(/\s+/)
    .filter((token) => token.length > 1 && !COURSE_MATCH_STOP_WORDS.has(token));

const scoreCourseForChapter = (course = {}, chapter = {}) => {
    const chapterText = normalizeCourseMatchText(chapter?.title || '');
    const courseTitle = normalizeCourseMatchText(course?.title || '');
    const courseDescription = normalizeCourseMatchText(course?.description || '');
    if (!chapterText || (!courseTitle && !courseDescription)) return 0;
    let score = 0;
    if (courseTitle.includes(chapterText) || chapterText.includes(courseTitle)) score += 120;
    if (courseDescription.includes(chapterText) || chapterText.includes(courseDescription)) score += 100;
    const chapterTokens = [...new Set(getCourseMatchTokens(chapterText))];
    const titleTokens = new Set(getCourseMatchTokens(courseTitle));
    const descriptionTokens = new Set(getCourseMatchTokens(courseDescription));
    chapterTokens.forEach((token) => {
        if (titleTokens.has(token)) score += 18;
        if (descriptionTokens.has(token)) score += 14;
    });
    return score;
};

export default function LearningStudio({ initialData, chapters, user, targetSection, targetLevel, globalClassId = '', onClose, allStudents: propStudents, allClasses: propClasses }) {
    const usesPlainNumberedIdeas = /(?:^|\D)[56](?:\s*(?:e|ème)?)(?=\D|$)/i.test(String(targetLevel || ''));
    // Le contentEditable peut contenir une frappe plus récente que le dernier rendu React.
    // Ce registre synchrone garantit que « Inspecter fiche » utilise toujours ce qui est
    // réellement visible dans l'éditeur au moment du clic.
    const sheetDraftsRef = useRef(new Map());
    const [formData, setFormData] = useState(() => ({
        ...(() => {
            const sections = normalizeLoadedSections(initialData?.sections);
            const defaultSectionId = String(sections[0]?.id || 'sec_1');
            const steps = normalizeLoadedSteps(initialData?.steps).map((s) => ({
                ...s,
                sectionId: String(s?.sectionId || defaultSectionId)
            }));
            return { sections, steps };
        })(),
        _id: initialData?._id,
        title: initialData?.title || 'APPRENTISSAGE',
        chapterId: initialData?.chapterId ? String(initialData.chapterId) : '',
        subject: initialData?.subject || targetSection || 'GÉNÉRAL',
        presentationUrl: initialData?.presentationUrl || '',
        presentationSourceUrl: initialData?.presentationSourceUrl || '',
        presentationSlidesFocus: initialData?.presentationSlidesFocus || '',
        generalSheetDocUrl: initialData?.generalSheetDocUrl || '',
        generalSheetCourseId: initialData?.generalSheetCourseId || '',
        generalSheetCourseTitle: initialData?.generalSheetCourseTitle || '',
        generalSheetCourseDescription: initialData?.generalSheetCourseDescription || ''
    }));
    const [activeStep, setActiveStep] = useState(0);
    const [allStudents, setAllStudents] = useState(propStudents || []);
    const [allClasses, setAllClasses] = useState(propClasses || []);
    const [distribution, setDistribution] = useState({});
    const [viewingClass, setViewingClass] = useState('');
    const [studentSearch, setStudentSearch] = useState('');
    const [allGames, setAllGames] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAnnotModal, setShowAnnotModal] = useState(false);
    const [showKeywordModal, setShowKeywordModal] = useState(false);
    const [showQuestionSourceText, setShowQuestionSourceText] = useState(false);
    const [loadingQuestionSourceText, setLoadingQuestionSourceText] = useState(false);
    const [extractingSheetText, setExtractingSheetText] = useState(false);
    const [savingSheetText, setSavingSheetText] = useState(false);
    const [uploadingSheetMedia, setUploadingSheetMedia] = useState(false);
    const [annotColor, setAnnotColor] = useState('orange');
    const [annotLabel, setAnnotLabel] = useState('');
    const [annotDraft, setAnnotDraft] = useState(null);
    const [aiTesting, setAiTesting] = useState(false);
    const [showVideoEditor, setShowVideoEditor] = useState(false);
    const [videoSequencePreviewStepId, setVideoSequencePreviewStepId] = useState('');
    const [localVideoPreviewUrl, setLocalVideoPreviewUrl] = useState('');
    const [localVideoStepId, setLocalVideoStepId] = useState('');
    const [localVideoName, setLocalVideoName] = useState('');
    const [localVideoSegmentKey, setLocalVideoSegmentKey] = useState('');
    const [segmentStart, setSegmentStart] = useState(0);
    const [segmentEnd, setSegmentEnd] = useState(0);
    const [segmentLabel, setSegmentLabel] = useState('');
    const [segmentRate, setSegmentRate] = useState(1);
    const [segmentEndFollowPlayhead, setSegmentEndFollowPlayhead] = useState(true);
    const [knownSegments, setKnownSegments] = useState([]);
    const [selectedSegmentId, setSelectedSegmentId] = useState('');
    const [selectedSegmentLabel, setSelectedSegmentLabel] = useState('');
    const [selectedSegmentTranscript, setSelectedSegmentTranscript] = useState('');
    const [lastSavedSegmentLabel, setLastSavedSegmentLabel] = useState('');
    const [lastSavedSegmentTranscript, setLastSavedSegmentTranscript] = useState('');
    const [previewSegmentMode, setPreviewSegmentMode] = useState(false);
    const [editorEmbedReloadKey, setEditorEmbedReloadKey] = useState(0);
    const [segmentPreviewRelSec, setSegmentPreviewRelSec] = useState(0);
    const [embedPreviewSeekSec, setEmbedPreviewSeekSec] = useState(null);
    const [editorPlaybackMode, setEditorPlaybackMode] = useState('video'); // video | segment
    const [editorDurationSec, setEditorDurationSec] = useState(0);
    const [editorCurrentAbsSec, setEditorCurrentAbsSec] = useState(0);
    const [editorPlaying, setEditorPlaying] = useState(false);
    const [keywordMaterialSource, setKeywordMaterialSource] = useState('manual');
    const [keywordMaterialText, setKeywordMaterialText] = useState('');
    const [keywordSelectedText, setKeywordSelectedText] = useState('');
    const [activeTarget, setActiveTarget] = useState('response'); // response | zone
    const [eraseMode, setEraseMode] = useState(false);
    const [autoHighlighting, setAutoHighlighting] = useState(false);
    const [keywordSelectionSpan, setKeywordSelectionSpan] = useState(null);
    const [keywordActiveZoneIdx, setKeywordActiveZoneIdx] = useState(null);
    const [zoneQuestionCount, setZoneQuestionCount] = useState(3);
    const [dragStepIdx, setDragStepIdx] = useState(null);
    const [pendingVideoEditorStepId, setPendingVideoEditorStepId] = useState('');
    const [questionSourceNotice, setQuestionSourceNotice] = useState('');
    const [zoneKeywordDrafts, setZoneKeywordDrafts] = useState({});
    const [bulkQuestionImport, setBulkQuestionImport] = useState('');
    const [showBulkQuestionImport, setShowBulkQuestionImport] = useState(false);
    const [selectedZoneKeyword, setSelectedZoneKeyword] = useState(null); // { zoneIdx, rowIdx, keywordIdx }
    const [synonymDraft, setSynonymDraft] = useState('');
    const [savingStepData, setSavingStepData] = useState(false);
    const [importingSheet, setImportingSheet] = useState(false);
    const [recordingQuestionCell, setRecordingQuestionCell] = useState(null); // { rowIdx, field, zoneIdx? }
    const [testingFillBlankKey, setTestingFillBlankKey] = useState('');
    const [sourcePickerKind, setSourcePickerKind] = useState(''); // '' | 'video' | 'sheet'
    const [sourcePickerExistingUrl, setSourcePickerExistingUrl] = useState('');
    const [sourcePickerCustomUrl, setSourcePickerCustomUrl] = useState('');
    const [sourcePickerVideoName, setSourcePickerVideoName] = useState('');
    const [showGeneralSheetBuilder, setShowGeneralSheetBuilder] = useState(false);
    const [generalSheetMedia, setGeneralSheetMedia] = useState(null);
    const [generalSheetCourses, setGeneralSheetCourses] = useState([]);
    const [generalSheetCoursesLoading, setGeneralSheetCoursesLoading] = useState(false);
    const [generalSheetCourseAutomatic, setGeneralSheetCourseAutomatic] = useState(false);
    const [generalSheetText, setGeneralSheetText] = useState('');
    const [generalSheetHtml, setGeneralSheetHtml] = useState('');
    const [globalSheetSourceUrl, setGlobalSheetSourceUrl] = useState('');
    const [globalVideoSourceUrl, setGlobalVideoSourceUrl] = useState('');
    const [globalVideoSourceName, setGlobalVideoSourceName] = useState('');
    const [globalSlidesWarmup, setGlobalSlidesWarmup] = useState({ active: false, percent: 0, loaded: 0, total: 0, ready: false, error: '' });
    const [savedVideoSources, setSavedVideoSources] = useState([]);
    const [savingVideoSource, setSavingVideoSource] = useState(false);
    const [creatingNotebookLmSource, setCreatingNotebookLmSource] = useState(false);
    const [notebookSlides, setNotebookSlides] = useState([]);
    const [notebookSlidesLoading, setNotebookSlidesLoading] = useState(false);
    const [notebookSlidesError, setNotebookSlidesError] = useState('');
    const [notebookSlidesSelection, setNotebookSlidesSelection] = useState([]);
    const [showNotebookSlidesPicker, setShowNotebookSlidesPicker] = useState(false);
    const [slidesPanelMode, setSlidesPanelMode] = useState('slide');
    const [slidesManifest, setSlidesManifest] = useState([]);
    const [slidesManifestLoading, setSlidesManifestLoading] = useState(false);
    const [slidesManifestError, setSlidesManifestError] = useState('');
    const [slidesActiveIdx, setSlidesActiveIdx] = useState(0);
    const [slideSectionNameDraft, setSlideSectionNameDraft] = useState('');
    const [slidesTextHydrating, setSlidesTextHydrating] = useState(false);
    const [slidesImageTryByObjectId, setSlidesImageTryByObjectId] = useState({});
    const [slidesImageNonceByObjectId, setSlidesImageNonceByObjectId] = useState({});
    const [slideBlobUrlByObjectId, setSlideBlobUrlByObjectId] = useState({});
    const videoEditorRef = useRef(null);
    const youtubeEditorHostRef = useRef(null);
    const youtubeEditorPlayerRef = useRef(null);
    const youtubeTickRef = useRef(null);
    const youtubeBoundsRef = useRef({ start: 0, end: 0 });
    const videoPreviewRef = useRef(null);
    const sheetImportInputRef = useRef(null);
    const sheetMediaInputRef = useRef(null);
    const generalSheetMediaInputRef = useRef(null);
    const keywordSelectionRef = useRef(null);
    const slidesManifestCacheRef = useRef(new Map());
    const slidesRetryTimerRef = useRef(new Map());
    const slidesWarmupDoneRef = useRef(new Set());
    const slideBlobFetchInFlightRef = useRef(new Map());
    const slideBlobUrlByObjectIdRef = useRef({});
    const slidesPreferredSrcRef = useRef({ pid: '', map: {} });
    const knownSegmentsReqRef = useRef(0);
    const knownSegmentsUrlRef = useRef('');
    const timelineZonesRef = useRef(null);
    const resizingSegmentRef = useRef(null);
    const hydratedQuestionDraftsRef = useRef(new Set());
    const generalSheetMatchedChapterRef = useRef(String(initialData?.chapterId || ''));
    const teacherId = String(user?._id || user?.id || '').trim();
    const step = formData.steps[activeStep] || null;
    const questionDraftKey = useMemo(() => {
        if (!step || step.type !== 'question' || !step.id) return '';
        const scope = formData._id
            ? `id_${String(formData._id)}`
            : `new_${String(formData.chapterId || 'nochap')}_${String(formData.title || '').slice(0, 24)}`;
        return `learning_qia_draft_v1_${scope}_${String(step.id)}`;
    }, [formData._id, formData.chapterId, formData.title, step?.id, step?.type]);

    useEffect(() => {
        const init = async () => {
            if ((!propStudents || propStudents.length === 0) || (!propClasses || propClasses.length === 0)) {
                const [sts, cls] = await Promise.all([api.get('/admin/students'), api.get('/admin/classrooms')]);
                setAllStudents(sts || []);
                setAllClasses(cls || []);
            }
            const games = await fetch('/api/games/all').then(r => r.ok ? r.json() : []);
            setAllGames(games || []);
        };
        init();
    }, [propStudents, propClasses]);

    useEffect(() => {
        if (!initialData?.targetClassrooms) return;
        const dist = {};
        initialData.targetClassrooms.forEach(clsName => {
            dist[clsName] = {
                chapterId: initialData.chapterId ? String(initialData.chapterId) : '',
                studentIds: initialData.isAllClass ? [] : (initialData.assignedStudents || [])
            };
        });
        setDistribution(dist);
        if (initialData.targetClassrooms.length > 0) setViewingClass(initialData.targetClassrooms[0]);
    }, [initialData]);

    useEffect(() => {
        if (!questionDraftKey || !step || step.type !== 'question') return;
        if (hydratedQuestionDraftsRef.current.has(questionDraftKey)) return;
        hydratedQuestionDraftsRef.current.add(questionDraftKey);
        try {
            const raw = localStorage.getItem(questionDraftKey);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return;
            const patch = {};
            QUESTION_DRAFT_FIELDS.forEach((k) => {
                if (parsed[k] !== undefined) patch[k] = parsed[k];
            });
            if (Object.keys(patch).length > 0) updateStep(activeStep, patch);
        } catch (_) {}
    }, [questionDraftKey, step?.id, step?.type, activeStep]);

    useEffect(() => {
        if (!questionDraftKey || !step || step.type !== 'question') return;
        try {
            const snapshot = {};
            QUESTION_DRAFT_FIELDS.forEach((k) => {
                if (step[k] !== undefined) snapshot[k] = step[k];
            });
            localStorage.setItem(questionDraftKey, JSON.stringify(snapshot));
        } catch (_) {}
    }, [questionDraftKey, step]);

    useEffect(() => {
        if (!formData?._id || !step || step.type !== 'question' || !step.id) return;
        const patch = {};
        QUESTION_DRAFT_FIELDS.forEach((k) => {
            if (step[k] !== undefined) patch[k] = step[k];
        });
        const timer = setTimeout(async () => {
            try {
                await fetch(`/api/learning/${encodeURIComponent(String(formData._id))}/step-data`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stepId: String(step.id), patch })
                });
            } catch (_) {}
        }, 900);
        return () => clearTimeout(timer);
    }, [formData?._id, step]);

    useEffect(() => {
        if (!globalClassId) {
            setGeneralSheetCourses([]);
            return undefined;
        }
        let cancelled = false;
        setGeneralSheetCoursesLoading(true);
        fetch(`/api/courses?classId=${encodeURIComponent(globalClassId)}`)
            .then(async (response) => {
                const data = await response.json();
                if (!response.ok) throw new Error(data?.error || 'Chargement des séquences impossible');
                if (!cancelled) setGeneralSheetCourses(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setGeneralSheetCourses([]);
            })
            .finally(() => {
                if (!cancelled) setGeneralSheetCoursesLoading(false);
            });
        return () => { cancelled = true; };
    }, [globalClassId]);

    useEffect(() => {
        if (!formData.chapterId || generalSheetCourses.length === 0) return;
        const chapter = (chapters || []).find((row) => String(row?._id || '') === String(formData.chapterId));
        if (!chapter) return;
        const ranked = generalSheetCourses
            .map((course) => ({ course, score: scoreCourseForChapter(course, chapter) }))
            .sort((a, b) => b.score - a.score);
        const current = ranked.find((row) => String(row.course?._id || '') === String(formData.generalSheetCourseId || ''));
        const chapterChanged = generalSheetMatchedChapterRef.current !== String(formData.chapterId);
        generalSheetMatchedChapterRef.current = String(formData.chapterId);
        if (!chapterChanged && current && current.score > 0) return;
        const best = ranked[0];
        if (!best || best.score <= 0) return;
        setFormData((prev) => ({
            ...prev,
            generalSheetCourseId: String(best.course?._id || ''),
            generalSheetCourseTitle: String(best.course?.title || ''),
            generalSheetCourseDescription: String(best.course?.description || ''),
            presentationUrl: String(best.course?.slidesUrl || prev.presentationUrl || '')
        }));
        setGeneralSheetCourseAutomatic(true);
    }, [chapters, formData.chapterId, formData.generalSheetCourseId, generalSheetCourses]);

    const selectGeneralSheetCourse = (courseId, automatic = false) => {
        const course = generalSheetCourses.find((row) => String(row?._id || '') === String(courseId || ''));
        setFormData((prev) => ({
            ...prev,
            generalSheetCourseId: String(course?._id || ''),
            generalSheetCourseTitle: String(course?.title || ''),
            generalSheetCourseDescription: String(course?.description || ''),
            presentationUrl: course ? String(course.slidesUrl || '') : prev.presentationUrl
        }));
        setGeneralSheetCourseAutomatic(Boolean(automatic));
    };

    const availableChapters = useMemo(() => {
        const section = String(targetSection || 'GÉNÉRAL').toUpperCase();
        const targetClassNames = initialData?.targetClassrooms || Object.keys(distribution || {});
        const classLevel = targetClassNames.map(inferLearningLevelFromClass).find(Boolean);
        const level = normalizeLearningLevel(targetLevel || classLevel);
        return (chapters || []).filter((chapter) => {
            if (chapter?.isArchived) return false;
            if (String(chapter?.section || 'GÉNÉRAL').toUpperCase() !== section) return false;
            if (!level) return true;
            if (chapter?.sharedLevel) return normalizeLearningLevel(chapter.sharedLevel) === level;
            if (chapter?.classroom) return inferLearningLevelFromClass(chapter.classroom) === level;
            return false;
        });
    }, [chapters, targetSection, targetLevel, initialData?.targetClassrooms, distribution]);

    useEffect(() => {
        const selectedStillAllowed = availableChapters.some((chapter) => String(chapter._id) === String(formData.chapterId || ''));
        if (selectedStillAllowed) return;
        const first = availableChapters[0];
        setFormData(prev => ({ ...prev, chapterId: first ? String(first._id) : '', subject: first?.section || prev.subject }));
    }, [availableChapters, formData.chapterId]);

    useEffect(() => {
        const loadSavedVideoSources = async () => {
            const chapterId = String(formData.chapterId || '').trim();
            if (!teacherId || !chapterId) {
                setSavedVideoSources([]);
                return;
            }
            try {
                const res = await fetch(`/api/learning/video-sources?teacherId=${encodeURIComponent(teacherId)}&chapterId=${encodeURIComponent(chapterId)}`);
                const rows = res.ok ? await res.json() : [];
                setSavedVideoSources(Array.isArray(rows) ? rows : []);
            } catch (_) {
                setSavedVideoSources([]);
            }
        };
        loadSavedVideoSources();
    }, [teacherId, formData.chapterId]);
    useEffect(() => {
        const steps = Array.isArray(formData.steps) ? formData.steps : [];
        if (!globalSheetSourceUrl) {
            const firstSheetUrl = steps.find((s) => s?.type === 'sheet' && String(s?.sheetUrl || '').trim())?.sheetUrl || '';
            if (firstSheetUrl) setGlobalSheetSourceUrl(String(firstSheetUrl).trim());
        }
        if (!globalVideoSourceUrl) {
            const firstVideo = steps.find((s) => s?.type === 'video' && String(s?.videoUrl || '').trim());
            if (firstVideo?.videoUrl) setGlobalVideoSourceUrl(String(firstVideo.videoUrl).trim());
            if (firstVideo?.videoSourceName) setGlobalVideoSourceName(String(firstVideo.videoSourceName).trim());
        }
    }, [formData.steps, globalSheetSourceUrl, globalVideoSourceUrl]);

    const updateStep = (idx, patch) => {
        setFormData(prev => {
            const steps = [...(prev.steps || [])];
            if (!steps[idx]) return prev;
            steps[idx] = { ...steps[idx], ...patch };
            if (steps[idx]?.type === 'sheet' && ('sheetText' in patch || 'sheetTextHtml' in patch)) {
                const sheetId = String(steps[idx]?.id || '');
                const sheetSource = `sheet:${sheetId}`;
                let linkedIndexes = steps.reduce((indexes, candidate, candidateIndex) => {
                    if (candidate?.type === 'question' && (
                        String(candidate?.autoLinkedSheetId || '') === sheetId
                        || String(candidate?.sourceSheetUrl || '') === sheetSource
                    )) indexes.push(candidateIndex);
                    return indexes;
                }, []);

                // Répare aussi les anciennes fiches : avant la liaison explicite, la question IA
                // était simplement placée juste après la fiche dans la même section.
                if (!linkedIndexes.length) {
                    const nextCandidate = steps[idx + 1];
                    if (nextCandidate?.type === 'question'
                        && String(nextCandidate?.sectionId || '') === String(steps[idx]?.sectionId || '')
                        && !String(nextCandidate?.autoLinkedSheetId || '').trim()) {
                        linkedIndexes = [idx + 1];
                    }
                }

                linkedIndexes.forEach((linkedQuestionIndex) => {
                    const candidate = steps[linkedQuestionIndex];
                    const linkedMode = candidate?.autoLinkedSheetMode === 'plan' ? 'plan' : 'full';
                    const revision = sheetToRevisionQuestion(steps[idx], linkedMode);
                    steps[linkedQuestionIndex] = {
                        ...steps[linkedQuestionIndex],
                        title: revision.title,
                        autoLinkedSheetId: sheetId,
                        autoLinkedSheetMode: linkedMode,
                        autoRevisionKind: revision.kind,
                        sourceKind: 'sheet',
                        sourceSheetUrl: sheetSource,
                        questionCount: 1,
                        questionAnswerPairs: [{
                            question: revision.text,
                            answer: '',
                            expectedKeywords: [],
                            generatedByAi: false,
                            validationType: 'fill_blanks'
                        }]
                    };
                });

                // Une sous-fiche issue d'une Superfiche ne remplace jamais sa
                // source. Elle met à jour la partie correspondante de la fiche
                // générale, laquelle reste visible dans l'introduction.
                const parentId = String(steps[idx]?.generalSheetParentId || '');
                if (parentId) {
                    const masterIndex = steps.findIndex((candidate) => candidate?.type === 'sheet'
                        && candidate?.isGeneralSheetMaster === true
                        && String(candidate?.id || '') === parentId);
                    if (masterIndex >= 0) {
                        steps[masterIndex] = rebuildGeneralSheetMaster(steps[masterIndex], steps);
                        sheetDraftsRef.current.set(parentId, {
                            text: steps[masterIndex].sheetText,
                            html: steps[masterIndex].sheetTextHtml
                        });
                    }
                }
            }
            return { ...prev, steps };
        });
    };
    const getDefaultSectionId = () => String(formData.sections?.[0]?.id || 'sec_1');
    const stepBelongsToSection = (stepRow, sectionId) => {
        const sid = String(stepRow?.sectionId || getDefaultSectionId());
        return sid === String(sectionId || '');
    };
    const addSection = () => {
        setFormData((prev) => {
            const current = Array.isArray(prev.sections) && prev.sections.length
                ? [...prev.sections]
                : [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
            const id = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const name = `Section ${current.length + 1}`;
            current.push({ id, name, order: current.length, visible: true });
            return { ...prev, sections: current };
        });
    };
    const removeSection = (sectionId) => {
        const sections = Array.isArray(formData.sections) ? formData.sections : [];
        if (sections.length <= 1) return alert("Impossible de supprimer la dernière section.");
        const section = sections.find((row) => String(row?.id) === String(sectionId));
        const containedSteps = (formData.steps || []).filter((row) => String(row?.sectionId || '') === String(sectionId));
        const suffix = containedSteps.length
            ? ` Ses ${containedSteps.length} activité${containedSteps.length > 1 ? 's' : ''} seront aussi supprimée${containedSteps.length > 1 ? 's' : ''}.`
            : '';
        if (!window.confirm(`Supprimer la partie « ${section?.name || 'sans nom'} » ?${suffix}`)) return;
        setFormData((prev) => {
            const nextSections = (prev.sections || [])
                .filter((row) => String(row?.id) !== String(sectionId))
                .map((row, index) => ({ ...row, order: index }));
            const nextSteps = (prev.steps || []).filter((row) => String(row?.sectionId || '') !== String(sectionId));
            return { ...prev, sections: nextSections, steps: nextSteps };
        });
    };
    const renameSection = (sectionId, name) => {
        const nextName = String(name || '');
        setFormData((prev) => ({
            ...prev,
            sections: (prev.sections || []).map((s) => String(s.id) === String(sectionId) ? { ...s, name: nextName } : s)
        }));
    };
    const assignStepToSection = (idx, sectionId) => {
        updateStep(idx, { sectionId: String(sectionId || getDefaultSectionId()) });
    };

    const toggleSectionVisible = (sectionId) => {
        setFormData((prev) => ({
            ...prev,
            sections: (prev.sections || []).map((s) => {
                if (String(s.id) !== String(sectionId)) return s;
                return { ...s, visible: s.visible === false };
            })
        }));
    };

    const getCandidateSheets = () => {
        const chapterId = String(formData.chapterId || '');
        const all = [];
        (formData.steps || []).forEach((s) => {
            if (s.type === 'sheet' && s.sheetUrl) all.push({ url: s.sheetUrl, source: 'Fiche module' });
        });
        (allGames || [])
            .filter(g => String(g.chapterId || '') === chapterId)
            .forEach((g) => {
                if (g?.globalIntro?.sheetUrl) all.push({ url: g.globalIntro.sheetUrl, source: `Jeu: ${g.title || 'Sans titre'} (intro)` });
                (g?.levels || []).forEach((lvl, idx) => {
                    if (lvl?.intro?.sheetUrl) all.push({ url: lvl.intro.sheetUrl, source: `Jeu: ${g.title || 'Sans titre'} (${lvl.name || `Niveau ${idx + 1}`})` });
                });
            });
        const unique = [];
        const seen = new Set();
        all.forEach((x) => {
            const key = String(x.url || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(x);
        });
        return unique;
    };
    const getCandidateVideos = () => {
        const chapterId = String(formData.chapterId || '');
        const all = [];
        const globalUrl = String(globalVideoSourceUrl || '').trim();
        const globalName = String(globalVideoSourceName || '').trim();
        if (globalUrl) {
            all.push({
                url: globalUrl,
                source: `Vidéo générale: ${globalName || globalUrl.slice(0, 42)}`
            });
        }
        (savedVideoSources || []).forEach((s) => {
            const url = String(s.originalUrl || '').trim();
            if (!url) return;
            const label = String(s.name || '').trim() || 'Sans nom';
            all.push({ url, source: `Bibliothèque: ${label}` });
        });
        (formData.steps || []).forEach((s) => {
            if (s.type === 'video' && s.videoUrl) {
                const label = String(s.videoSourceName || s.title || 'Sans titre').trim();
                all.push({ url: s.videoUrl, source: `Vidéo module: ${label}` });
            }
        });
        (allGames || [])
            .filter(g => String(g.chapterId || '') === chapterId)
            .forEach((g) => {
                if (g?.globalIntro?.videoUrl) all.push({ url: g.globalIntro.videoUrl, source: `Jeu: ${g.title || 'Sans titre'} (intro)` });
                (g?.levels || []).forEach((lvl, idx) => {
                    if (lvl?.intro?.videoUrl) all.push({ url: lvl.intro.videoUrl, source: `Jeu: ${g.title || 'Sans titre'} (${lvl.name || `Niveau ${idx + 1}`})` });
                });
            });
        const unique = [];
        const seen = new Set();
        all.forEach((x) => {
            const key = String(x.url || '').trim();
            if (!key || seen.has(key)) return;
            seen.add(key);
            unique.push(x);
        });
        return unique;
    };

    const getQuestionSources = () => {
        const rows = [];
        // Sources internes (étapes du module)
        (formData.steps || []).forEach((s) => {
            if (!s || s.id === step?.id) return;
            if (s.type === 'sheet' && s.sheetUrl) {
                rows.push({
                    value: `sheet:${s.id}`,
                    type: 'sheet',
                    label: `Fiche (module): ${s.title || 'Sans titre'}`,
                    url: s.sheetUrl,
                    text: String(s.sheetText || '')
                });
            }
            if (s.type === 'video' && s.videoUrl) {
                rows.push({
                    value: `video:${s.id}`,
                    type: 'video',
                    label: `Séquence vidéo (module): ${s.title || 'Sans titre'}`,
                    url: s.videoUrl,
                    text: String(s.videoTranscript || '')
                });
            }
        });
        // Sources externes (jeux du chapitre) - fiches seulement
        getCandidateSheets().forEach((item) => {
            rows.push({
                value: `sheet-url:${encodeURIComponent(String(item.url || ''))}`,
                type: 'sheet',
                label: `Fiche (jeu): ${item.source || 'Sans titre'}`,
                url: item.url,
                text: ''
            });
        });
        const seen = new Set();
        return rows.filter((r) => {
            const key = `${r.type}|${r.value}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    };

    const getForcedQuestionSourceForIndex = (questionIndex, stepsInput = null) => {
        const rows = Array.isArray(stepsInput) ? stepsInput : (formData.steps || []);
        if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= rows.length) return null;
        for (let i = questionIndex - 1; i >= 0; i -= 1) {
            const candidate = rows[i];
            if (!candidate) continue;
            if (candidate.type === 'video') {
                const sid = String(candidate.id || '').trim();
                if (!sid) continue;
                return {
                    kind: 'video',
                    value: `video:${sid}`,
                    label: `Séquence vidéo (module): ${candidate.title || 'Sans titre'}`,
                    stepId: sid
                };
            }
            if (candidate.type === 'sheet') {
                const sid = String(candidate.id || '').trim();
                if (!sid) continue;
                return {
                    kind: 'sheet',
                    value: `sheet:${sid}`,
                    label: `Fiche (module): ${candidate.title || 'Sans titre'}`,
                    stepId: sid
                };
            }
        }
        return null;
    };

    const resolveQuestionSource = (sourceValue = '') => {
        const raw = String(sourceValue || '').trim();
        if (!raw) return null;
        if (raw.startsWith('sheet-url:')) {
            const url = decodeURIComponent(raw.slice('sheet-url:'.length));
            return { type: 'sheet', url, text: '' };
        }
        if (raw.startsWith('sheet:')) {
            const sid = raw.slice('sheet:'.length);
            const s = (formData.steps || []).find((x) => String(x?.id || '') === sid && x.type === 'sheet');
            if (!s) return null;
            return { type: 'sheet', url: String(s.sheetUrl || ''), text: String(s.sheetText || '') };
        }
        if (raw.startsWith('video:')) {
            const sid = raw.slice('video:'.length);
            const s = (formData.steps || []).find((x) => String(x?.id || '') === sid && x.type === 'video');
            if (!s) return null;
            return {
                type: 'video',
                stepId: sid,
                url: String(s.videoUrl || ''),
                text: String(s.videoTranscript || ''),
                startSec: Number(s.startSec || 0),
                endSec: Number(s.endSec || 0)
            };
        }
        // Compat legacy: URL brute de fiche
        return { type: 'sheet', url: raw, text: '' };
    };
    const parseVideoStepId = (sourceValue = '') => {
        const raw = String(sourceValue || '').trim();
        if (!raw.startsWith('video:')) return '';
        return raw.slice('video:'.length);
    };
    const buildVideoSegmentsQuery = (url = '', stepId = '') => {
        const params = new URLSearchParams({
            teacherId: String(teacherId || ''),
            url: String(url || '')
        });
        const sid = String(stepId || '').trim();
        if (sid) params.set('stepId', sid);
        return params.toString();
    };
    const getSelectedQuestionSource = (questionStep = null) => {
        const q = questionStep || step;
        if (!q || q.type !== 'question') return null;
        const preferredKindRaw = String(q.sourceKind || 'sheet').toLowerCase();
        const preferredKind = ['sheet', 'video', 'slides'].includes(preferredKindRaw) ? preferredKindRaw : 'sheet';
        if (preferredKind === 'slides') {
            const url = String(q.sourceSlidesUrl || '').trim();
            return url ? { type: 'slides', url, text: '' } : null;
        }
        const preferredRaw = preferredKind === 'video'
            ? String(q.sourceVideoRef || '').trim()
            : String(q.sourceSheetUrl || '').trim();
        if (preferredRaw) return resolveQuestionSource(preferredRaw);
        const fallbackRaw = preferredKind === 'video'
            ? String(q.sourceSheetUrl || '').trim()
            : String(q.sourceVideoRef || '').trim();
        return fallbackRaw ? resolveQuestionSource(fallbackRaw) : null;
    };

    const getQuestionTextSources = () => {
        const rows = [{ id: 'manual', label: 'Texte manuel', text: '' }];
        (formData.steps || []).forEach((s) => {
            if (!s || s.id === step?.id) return;
            if (s.type === 'video' && String(s.videoTranscript || '').trim()) {
                rows.push({
                    id: `video:${s.id}`,
                    label: `Vidéo: ${s.title || 'Sans titre'}`,
                    text: String(s.videoTranscript || '')
                });
            }
            if (s.type === 'sheet' && String(s.sheetText || '').trim()) {
                rows.push({
                    id: `sheet:${s.id}`,
                    label: `Fiche: ${s.title || 'Sans titre'}`,
                    text: String(s.sheetText || '')
                });
            }
        });
        return rows;
    };

    const rebuildHighlightsFromAnnotations = (annotations = []) => {
        const orange = [...new Set((annotations || []).filter(a => a.color === 'orange').map(a => String(a.label || '').trim()).filter(Boolean))];
        const red = [...new Set((annotations || []).filter(a => a.color === 'red').map(a => String(a.label || '').trim().toLowerCase()).filter(Boolean))];
        return { orangeHighlights: orange, redHighlights: red, keywords: red };
    };

    const pushAnnotation = () => {
        if (!step || step.type !== 'question' || !annotDraft) return;
        const label = String(annotLabel || '').trim();
        if (!label) return;
        const current = Array.isArray(step.sheetAnnotations) ? step.sheetAnnotations : [];
        const next = [...current, { ...annotDraft, color: annotColor, label }];
        updateStep(activeStep, { sheetAnnotations: next, ...rebuildHighlightsFromAnnotations(next) });
        setAnnotDraft(null);
        setAnnotLabel('');
    };

    const removeAnnotation = (idx) => {
        if (!step || step.type !== 'question') return;
        const current = Array.isArray(step.sheetAnnotations) ? step.sheetAnnotations : [];
        const next = current.filter((_, i) => i !== idx);
        updateStep(activeStep, { sheetAnnotations: next, ...rebuildHighlightsFromAnnotations(next) });
    };
    const normalizeQuestionPairs = (rows = []) =>
        (Array.isArray(rows) ? rows : [])
            .map((r) => {
                const question = String(r?.question || r?.q || '').trim();
                const options = Array.isArray(r?.options) ? r.options.map((x) => String(x || '').trim()) : [];
                const answerIdx = Number(r?.a);
                const answerFromOptions = Number.isInteger(answerIdx) && answerIdx >= 0 && answerIdx < options.length
                    ? options[answerIdx]
                    : '';
                const answer = String(r?.answer || r?.expectedAnswer || answerFromOptions || '').trim();
                const expectedKeywords = Array.isArray(r?.expectedKeywords)
                    ? r.expectedKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
                    : [];
                return {
                    question,
                    answer,
                    expectedKeywords,
                    generatedByAi: r?.generatedByAi === true,
                    validationType: r?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open'
                };
            })
            .filter((r) => r.question || r.answer || r.expectedKeywords.length)
            .slice(0, 20);
    const patchFromQuestionPairs = (pairs = []) => {
        const clean = normalizeQuestionPairs(pairs);
        const firstQuestion = String(clean[0]?.question || '').trim();
        const answers = clean.map((p) => String(p.answer || '').trim()).filter(Boolean);
        const explicitKeywords = clean
            .flatMap((p) => Array.isArray(p.expectedKeywords) ? p.expectedKeywords : [])
            .map((w) => String(w || '').trim().toLowerCase())
            .filter(Boolean);
        const keywordBag = answers
            .join(' ')
            .toLowerCase()
            .split(/[^a-z0-9àâäéèêëîïôöùûüÿçœæ'-]+/i)
            .map((w) => w.trim())
            .filter((w) => w.length >= 3);
        return {
            questionAnswerPairs: clean,
            customQuestion: firstQuestion || '',
            redHighlights: answers.slice(0, 30),
            keywords: [...new Set([...explicitKeywords, ...keywordBag])].slice(0, 30)
        };
    };
    const updateQuestionPairs = (pairs = []) => {
        if (!step || step.type !== 'question') return;
        updateStep(activeStep, patchFromQuestionPairs(pairs));
    };
    const updateQuestionPairsDraft = (rows = []) => {
        if (!step || step.type !== 'question') return;
        const firstQuestion = String(rows[0]?.question || '').trim();
        const explicitKeywords = rows
            .flatMap((p) => Array.isArray(p?.expectedKeywords) ? p.expectedKeywords : [])
            .map((w) => String(w || '').trim().toLowerCase())
            .filter(Boolean);
        const answerKeywords = rows
            .map((p) => String(p?.answer || '').trim())
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .split(/[^a-z0-9àâäéèêëîïôöùûüÿçœæ'-]+/i)
            .map((w) => w.trim())
            .filter((w) => w.length >= 3);
        updateStep(activeStep, {
            questionAnswerPairs: rows,
            customQuestion: firstQuestion || '',
            redHighlights: rows.map((p) => String(p?.answer || '').trim()).filter(Boolean).slice(0, 30),
            keywords: [...new Set([...explicitKeywords, ...answerKeywords])].slice(0, 30)
        });
    };
    const getQuestionPairRowsForEditor = () => {
        const rawRows = Array.isArray(step?.questionAnswerPairs) ? step.questionAnswerPairs : [];
        if (rawRows.length > 0) {
            const legacyQuestion = String(step?.customQuestion || '').trim();
            const legacyAnswers = Array.isArray(step?.redHighlights)
                ? step.redHighlights.map((x) => String(x || '').trim()).filter(Boolean)
                : [];
            const legacyKeywords = Array.isArray(step?.keywords)
                ? step.keywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30)
                : [];
            return rawRows.map((row, idx) => {
                const question = String(row?.question || row?.q || '').trim()
                    || (idx === 0 ? legacyQuestion : '');
                const answer = String(row?.answer || row?.expectedAnswer || '').trim()
                    || String(legacyAnswers[idx] || '').trim();
                const expectedKeywords = Array.isArray(row?.expectedKeywords) && row.expectedKeywords.length > 0
                    ? row.expectedKeywords.map((x) => String(x ?? ''))
                    : legacyKeywords;
                return {
                    ...row,
                    question,
                    answer,
                    expectedKeywords,
                    generatedByAi: row?.generatedByAi === true,
                    validationType: row?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open'
                };
            });
        }
        const previewRows = normalizeQuestionPairs(step?.aiPreviewQuestions || []);
        if (previewRows.length > 0) return previewRows.map((row) => ({ ...row, generatedByAi: true }));
        const question = String(step?.customQuestion || '').trim();
        const answer = Array.isArray(step?.redHighlights)
            ? step.redHighlights.map((x) => String(x || '').trim()).filter(Boolean).join('\n')
            : '';
        const expectedKeywords = Array.isArray(step?.keywords)
            ? step.keywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30)
            : [];
        if (!question && !answer && expectedKeywords.length === 0) return [];
        return [{ question, answer, expectedKeywords, generatedByAi: false }];
    };
    const getQuestionPairRowsForEditorOrPlaceholders = () => {
        const rows = getQuestionPairRowsForEditor();
        if (rows.length > 0) return rows;
        const count = Math.max(1, Math.min(20, Number(step?.questionCount || 1)));
        return Array.from({ length: count }, (_, idx) => ({
            question: '',
            answer: '',
            expectedKeywords: [],
            generatedByAi: false,
            validationType: 'fill_blanks',
            placeholder: true,
            placeholderLabel: `Question ${idx + 1}`
        }));
    };
    const updateQuestionPairRow = (rowIdx = 0, patch = {}) => {
        if (!step || step.type !== 'question') return;
        const rows = [...getQuestionPairRowsForEditor()];
        const current = rows[rowIdx] || { question: '', answer: '', expectedKeywords: [], validationType: 'open' };
        const nextPatch = { ...patch };
        if (Object.prototype.hasOwnProperty.call(nextPatch, 'question')
            && (current.validationType === 'fill_blanks' || nextPatch.validationType === 'fill_blanks')) {
            nextPatch.question = renumberRemainingMainPoints(nextPatch.question);
        }
        rows[rowIdx] = { ...current, ...nextPatch };
        updateQuestionPairsDraft(rows);
    };
    const moveQuestionPairRow = (fromIdx = 0, toIdx = 0) => {
        if (!step || step.type !== 'question') return;
        const rows = [...getQuestionPairRowsForEditor()];
        if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0 || fromIdx >= rows.length || toIdx >= rows.length) return;
        const [moved] = rows.splice(fromIdx, 1);
        rows.splice(toIdx, 0, moved);
        updateQuestionPairsDraft(rows);
    };
    const renderStructuredAnswerPreview = (value = '') => {
        const text = String(value || '');
        const lines = text.replace(/\r/g, '\n').split('\n');
        const hasStructuredDash = lines.some((line) => /^\s*[-–—•]\s*/.test(line));
        if (!hasStructuredDash) return null;
        return (
            <div className="mt-1 rounded-xl border border-red-100 bg-red-50/40 px-3 py-2 text-[12px] font-bold text-slate-700 leading-snug">
                <div className="text-[10px] font-black uppercase text-red-500 mb-1">
                    Tirets rouges = blocs attendus vérifiés séparément
                </div>
                <div className="space-y-0.5">
                    {lines.map((line, idx) => {
                        const match = String(line || '').match(/^(\s*)([-–—•])(\s*)(.*)$/);
                        if (!match) {
                            return <div key={`structured_line_${idx}`}>{line || ' '}</div>;
                        }
                        return (
                            <div key={`structured_line_${idx}`}>
                                <span>{match[1]}</span>
                                <span className="text-red-600 font-black">{match[2]}</span>
                                <span>{match[3]}{match[4]}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };
    const startQuestionCellDictation = (rowIdx = 0, field = 'question', zoneIdx = null) => {
        if (typeof window === 'undefined') return;
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert("Micro non disponible dans ce navigateur. Essaie Chrome.");
            return;
        }
        const keywordMatch = String(field || '').match(/^expectedKeyword:(\d+)$/);
        const keywordIdx = keywordMatch ? Number(keywordMatch[1]) : null;
        const targetField = keywordMatch ? 'expectedKeyword' : (field === 'answer' ? 'answer' : 'question');
        const rec = new SpeechRecognition();
        rec.lang = 'fr-FR';
        rec.interimResults = false;
        rec.continuous = false;
        setRecordingQuestionCell({ rowIdx, field: targetField, zoneIdx });
        rec.onresult = (event) => {
            const transcript = Array.from(event.results || [])
                .map((result) => String(result?.[0]?.transcript || '').trim())
                .filter(Boolean)
                .join(' ')
                .trim();
            if (!transcript) return;
            if (zoneIdx !== null && Number.isFinite(Number(zoneIdx))) {
                const map = getCurrentSectionQuestionsMap();
                const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
                const current = rows[rowIdx] || { q: '', question: '', expectedAnswer: '', expectedKeywords: [] };
                if (targetField === 'expectedKeyword') {
                    const kws = Array.isArray(current.expectedKeywords) ? [...current.expectedKeywords] : [];
                    const idx = Number.isFinite(keywordIdx) ? keywordIdx : kws.length;
                    const previousKeyword = String(kws[idx] || '');
                    const separator = previousKeyword && !/\s$/.test(previousKeyword) ? ' ' : '';
                    kws[idx] = `${previousKeyword}${separator}${transcript}`;
                    rows[rowIdx] = { ...current, expectedKeywords: kws };
                    updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
                    return;
                }
                const previous = String(current[targetField] || current.q || '');
                const separator = previous && !/\s$/.test(previous) ? ' ' : '';
                rows[rowIdx] = {
                    ...current,
                    [targetField]: `${previous}${separator}${transcript}`,
                    q: targetField === 'question' ? `${previous}${separator}${transcript}` : current.q
                };
                updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
                return;
            }
            const rows = [...(Array.isArray(step?.questionAnswerPairs) ? step.questionAnswerPairs : [])];
            const current = rows[rowIdx] || { question: '', answer: '', expectedKeywords: [] };
            if (targetField === 'expectedKeyword') {
                const kws = Array.isArray(current.expectedKeywords) ? [...current.expectedKeywords] : [];
                const idx = Number.isFinite(keywordIdx) ? keywordIdx : kws.length;
                const previousKeyword = String(kws[idx] || '');
                const separator = previousKeyword && !/\s$/.test(previousKeyword) ? ' ' : '';
                kws[idx] = `${previousKeyword}${separator}${transcript}`;
                rows[rowIdx] = { ...current, expectedKeywords: kws };
                updateQuestionPairsDraft(rows);
                return;
            }
            const previous = String(current[targetField] || '');
            const separator = previous && !/\s$/.test(previous) ? ' ' : '';
            rows[rowIdx] = {
                ...current,
                [targetField]: `${previous}${separator}${transcript}`
            };
            updateQuestionPairsDraft(rows);
        };
        rec.onerror = () => {
            alert("Dictée micro impossible. Vérifie l'autorisation du micro.");
        };
        rec.onend = () => setRecordingQuestionCell(null);
        try {
            rec.start();
        } catch (_) {
            setRecordingQuestionCell(null);
        }
    };

    const handleAnnotMouseDown = (e) => {
        if (!showAnnotModal) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setAnnotDraft({ x, y, w: 0, h: 0 });
    };

    const handleAnnotMouseMove = (e) => {
        if (!annotDraft) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = ((e.clientX - rect.left) / rect.width) * 100;
        const cy = ((e.clientY - rect.top) / rect.height) * 100;
        const x = Math.min(annotDraft.x, cx);
        const y = Math.min(annotDraft.y, cy);
        const w = Math.abs(cx - annotDraft.x);
        const h = Math.abs(cy - annotDraft.y);
        setAnnotDraft({ x, y, w, h });
    };

    const handleAnnotMouseUp = () => {
        if (!annotDraft) return;
        if (annotDraft.w < 1 || annotDraft.h < 1) {
            setAnnotDraft(null);
            return;
        }
        if (!String(annotLabel || '').trim()) return;
        pushAnnotation();
    };

    const generateTestQuestions = async () => {
        if (!step || step.type !== 'question') return;
        const orange = Array.isArray(step.orangeHighlights) ? step.orangeHighlights : [];
        const red = Array.isArray(step.redHighlights) ? step.redHighlights : [];
        const topic = `Génère des questions sur: ${orange.join(', ')}. Repères fiche: ${red.join(', ')}.`;
        setAiTesting(true);
        try {
            const fd = new FormData();
            fd.append('topic', topic || 'Question de compréhension');
            fd.append('count', '4');
            fd.append('teacherId', teacherId);
            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const rows = await res.json();
            const clean = Array.isArray(rows) ? rows.slice(0, 6) : [];
            updateStep(activeStep, { aiPreviewQuestions: clean });
        } catch (e) {
            alert("Erreur génération questions test.");
        }
        setAiTesting(false);
    };

    const generateQuestionsFromCurrentResource = async () => {
        if (!step || (step.type !== 'sheet' && step.type !== 'video')) return;
        const count = Math.max(1, Math.min(20, Number(step.questionCount || 3)));
        setAiTesting(true);
        try {
            let sourceText = '';
            if (step.type === 'sheet') {
                sourceText = String(step.sheetText || '').trim();
                if (!sourceText) {
                    const sheetUrl = String(step.sheetUrl || '').trim();
                    if (!sheetUrl) throw new Error("Ajoute d'abord l'URL de la fiche.");
                    const res = await fetch('/api/learning/extract-sheet-text', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ sheetUrl, teacherId })
                    });
                    const data = await res.json();
                    if (!res.ok || !data?.text) throw new Error(data?.error || 'Extraction fiche impossible');
                    sourceText = String(data.text || '').trim();
                    updateStep(activeStep, { sheetText: sourceText });
                }
            } else {
                sourceText = String(step.videoTranscript || '').trim();
                if (!sourceText) {
                    sourceText = String(selectedSegmentTranscript || '').trim();
                }
                if (!sourceText) {
                    throw new Error("Ajoute d'abord la transcription de la séquence vidéo dans l'éditeur.");
                }
            }

            const topic = [
                `Crée ${count} questions de compréhension pour des élèves.`,
                `Ressource: ${step.type === 'sheet' ? 'fiche' : 'séquence vidéo'}`,
                `Titre: ${String(step.title || 'Sans titre')}`,
                `Texte source:`,
                sourceText.slice(0, 20000)
            ].join('\n');

            const fd = new FormData();
            fd.append('topic', topic);
            fd.append('count', String(count));
            fd.append('teacherId', teacherId);
            const res = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const rows = await res.json();
            const clean = Array.isArray(rows) ? rows.slice(0, count) : [];
            const pairs = normalizeQuestionPairs(clean).map((pair) => ({ ...pair, generatedByAi: true }));
            const qStep = {
                ...emptyStep('question'),
                title: `Questions ${step.type === 'sheet' ? 'Fiche' : 'Vidéo'}`,
                materialSource: step.type === 'sheet' ? `sheet:${step.id}` : `video:${step.id}`,
                materialText: sourceText,
                aiPreviewQuestions: clean,
                ...patchFromQuestionPairs(pairs)
            };
            setFormData((prev) => {
                const steps = [...(prev.steps || [])];
                steps.splice(activeStep + 1, 0, qStep);
                return { ...prev, steps };
            });
            setActiveStep(activeStep + 1);
        } catch (e) {
            alert(`Génération impossible: ${e.message}`);
        }
        setAiTesting(false);
    };

    const extractSlidesTextForQuestion = async () => {
        if (!step || step.type !== 'question') return;
        const presentationUrl = String(formData.presentationUrl || '').trim();
        if (!presentationUrl) return alert("Ajoute d'abord l'URL de la présentation.");
        setExtractingSheetText(true);
        try {
            const res = await fetch('/api/learning/slides/extract-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    presentationUrl,
                    slideSelection: String(formData.presentationSlidesFocus || '').trim()
                })
            });
            const data = await res.json();
            if (!res.ok || !data?.combinedText) throw new Error(data?.error || 'Extraction slides impossible');
            updateStep(activeStep, {
                materialSource: 'slides',
                materialText: String(data.combinedText || '')
            });
            setKeywordMaterialSource('manual');
            setKeywordMaterialText(String(data.combinedText || ''));
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
        } catch (e) {
            alert(`Extraction slides impossible: ${e.message}`);
        }
        setExtractingSheetText(false);
    };

    const generateQuestionsFromSlides = async () => {
        if (!step || step.type !== 'question') return;
        const presentationUrl = String(formData.presentationUrl || '').trim();
        if (!presentationUrl) return alert("Ajoute d'abord l'URL de la présentation.");
        setAiTesting(true);
        try {
            const extract = await fetch('/api/learning/slides/extract-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    presentationUrl,
                    slideSelection: String(formData.presentationSlidesFocus || '').trim()
                })
            });
            const extracted = await extract.json();
            if (!extract.ok || !extracted?.combinedText) throw new Error(extracted?.error || 'Extraction slides impossible');
            const count = Math.max(1, Math.min(20, Number(zoneQuestionCount || 4)));
            const topic = [
                `Crée ${count} questions de compréhension pour des élèves à partir de ces slides (trace écrite).`,
                `Contexte: ${String(formData.title || 'Apprentissage')}`,
                `Slides ciblées: ${String(formData.presentationSlidesFocus || 'toutes')}`,
                `Texte source:`,
                String(extracted.combinedText || '').slice(0, 20000)
            ].join('\n');
            const fd = new FormData();
            fd.append('topic', topic);
            fd.append('count', String(count));
            fd.append('teacherId', teacherId);
            const qRes = await fetch('/api/games/generate-content', { method: 'POST', body: fd });
            const rows = await qRes.json();
            const clean = Array.isArray(rows) ? rows.slice(0, count) : [];
            const pairs = normalizeQuestionPairs(clean).map((pair) => ({ ...pair, generatedByAi: true }));
            updateStep(activeStep, {
                aiPreviewQuestions: clean,
                ...patchFromQuestionPairs(pairs),
                materialSource: 'slides',
                materialText: String(extracted.combinedText || '')
            });
        } catch (e) {
            alert(`Génération slides impossible: ${e.message}`);
        }
        setAiTesting(false);
    };

    const refreshKnownSegments = async (url, stepId = '') => {
        const safeUrl = String(url || '').trim();
        const safeStepId = '';
        const reqId = ++knownSegmentsReqRef.current;
        knownSegmentsUrlRef.current = `${safeUrl}::${safeStepId}`;
        if (!teacherId || !safeUrl) {
            setKnownSegments([]);
            return [];
        }
        setKnownSegments([]);
        setSelectedSegmentId('');
        setSelectedSegmentLabel('');
        setSelectedSegmentTranscript('');
        setLastSavedSegmentLabel('');
        setLastSavedSegmentTranscript('');
        try {
            const res = await fetch(`/api/learning/video-segments?${buildVideoSegmentsQuery(safeUrl, safeStepId)}`);
            const list = res.ok ? await res.json() : [];
            if (reqId !== knownSegmentsReqRef.current) return [];
            if (knownSegmentsUrlRef.current !== `${safeUrl}::${safeStepId}`) return [];
            const rowsRaw = Array.isArray(list) ? list : [];
            const normUrl = normalizeVideoSourceUrl(safeUrl);
            const dedupByBounds = new Map();
            rowsRaw.forEach((r) => {
                const rn = normalizeVideoSourceUrl(r?.originalUrl || r?.url || r?.normalizedUrl || safeUrl);
                if (rn && normUrl && rn !== normUrl) return;
                const startSec = Math.max(0, Number(r?.startSec || 0));
                const endSec = Math.max(0, Number(r?.endSec || 0));
                const key = `${startSec}|${endSec}`;
                const prev = dedupByBounds.get(key);
                if (!prev) {
                    dedupByBounds.set(key, r);
                    return;
                }
                const prevLabel = String(prev?.label || '').trim();
                const nextLabel = String(r?.label || '').trim();
                if (!prevLabel && nextLabel) dedupByBounds.set(key, r);
            });
            const dedup = Array.from(dedupByBounds.values());
            dedup.sort((a, b) => {
                const as = Number(a?.startSec || 0);
                const bs = Number(b?.startSec || 0);
                if (as !== bs) return as - bs;
                const ae = Number(a?.endSec || 0) || Number.MAX_SAFE_INTEGER;
                const be = Number(b?.endSec || 0) || Number.MAX_SAFE_INTEGER;
                return ae - be;
            });
            const cleaned = [];
            const orphanIds = [];
            dedup.forEach((row) => {
                const start = Math.max(0, Number(row?.startSec || 0));
                const endRaw = Math.max(0, Number(row?.endSec || 0));
                const end = endRaw > start ? endRaw : Number.MAX_SAFE_INTEGER;
                const sid = String(row?._id || row?.id || '').trim();
                if (end !== Number.MAX_SAFE_INTEGER && end <= start) {
                    if (sid) orphanIds.push(sid);
                    return;
                }
                if (cleaned.length === 0) {
                    cleaned.push(row);
                    return;
                }
                const prev = cleaned[cleaned.length - 1];
                const prevStart = Math.max(0, Number(prev?.startSec || 0));
                const prevEndRaw = Math.max(0, Number(prev?.endSec || 0));
                const prevEnd = prevEndRaw > prevStart ? prevEndRaw : Number.MAX_SAFE_INTEGER;
                if (start >= prevEnd) {
                    cleaned.push(row);
                    return;
                }
                // Segment parasite (chevauchement): on le supprime.
                if (sid) orphanIds.push(sid);
            });
            if (orphanIds.length > 0) {
                await Promise.all(orphanIds.map((sid) => fetch(
                    `/api/learning/video-segments/${encodeURIComponent(sid)}?teacherId=${encodeURIComponent(teacherId)}`,
                    { method: 'DELETE' }
                ).catch(() => null)));
            }
            setKnownSegments(cleaned);
            const last = cleaned[cleaned.length - 1];
            const fallbackStart = Math.max(0, Number(last?.endSec || last?.startSec || 0));
            setSegmentStart(fallbackStart);
            return cleaned;
        } catch (_) {
            if (reqId !== knownSegmentsReqRef.current) return [];
            setKnownSegments([]);
            return [];
        }
    };

    const openVideoEditor = () => {
        if (!step || step.type !== 'video' || (!step.videoUrl && localVideoStepId !== String(step.id || ''))) return;
        setSegmentStart(Math.max(0, Number(step.startSec || 0)));
        setSegmentEnd(Math.max(0, Number(step.endSec || 0)));
        setSegmentEndFollowPlayhead(true);
        setSegmentLabel('');
        setSelectedSegmentTranscript('');
        setSegmentRate(1);
        setPreviewSegmentMode(false);
        setEditorEmbedReloadKey(0);
        setSegmentPreviewRelSec(0);
        setEmbedPreviewSeekSec(null);
        setEditorPlaybackMode('video');
        setEditorDurationSec(0);
        setEditorCurrentAbsSec(0);
        setEditorPlaying(false);
        refreshKnownSegments(step.videoUrl, step.id);
        setShowVideoEditor(true);
    };

    const chooseLocalVideo = (file) => {
        if (!file || !step || step.type !== 'video') return;
        if (localVideoPreviewUrl) URL.revokeObjectURL(localVideoPreviewUrl);
        const objectUrl = URL.createObjectURL(file);
        const fingerprint = `local-video://${encodeURIComponent(file.name)}-${Number(file.size || 0)}-${Number(file.lastModified || 0)}`;
        setLocalVideoPreviewUrl(objectUrl);
        setLocalVideoStepId(String(step.id || ''));
        setLocalVideoName(file.name || 'Vidéo locale');
        setLocalVideoSegmentKey(fingerprint);
        updateStep(activeStep, { videoUrl: fingerprint, videoSourceName: file.name || 'Vidéo locale', startSec: 0, endSec: 0 });
        setSelectedSegmentId('');
        setSelectedSegmentLabel('');
        setSelectedSegmentTranscript('');
        refreshKnownSegments(fingerprint, step.id);
    };

    const cloneLocalSegmentsToOnlineUrl = async (onlineUrl) => {
        const targetUrl = String(onlineUrl || '').trim();
        if (!teacherId || !localVideoSegmentKey || !/^https?:\/\//i.test(targetUrl)) return;
        try {
            await fetch('/api/learning/video-segments/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId, fromUrl: localVideoSegmentKey, toUrl: targetUrl })
            });
            setLocalVideoSegmentKey('');
            refreshKnownSegments(targetUrl, step?.id || '');
        } catch (_) {}
    };

    const saveCurrentSegment = async (overrides = null) => {
        if (!step || step.type !== 'video' || !step.videoUrl) return;
        const ov = overrides && typeof overrides === 'object' ? overrides : {};
        const nextStart = Math.max(0, Number(ov.startSec !== undefined ? ov.startSec : segmentStart) || 0);
        const nextEnd = Math.max(0, Number(ov.endSec !== undefined ? ov.endSec : segmentEnd) || 0);
        const nextLabel = String(ov.label !== undefined ? ov.label : (segmentLabel || `Segment ${nextStart}-${nextEnd || 'fin'}`)).trim();
        const nextTranscript = String(ov.transcript !== undefined ? ov.transcript : selectedSegmentTranscript || '');
        if (nextEnd > 0 && nextEnd <= nextStart) {
            return alert("La fin doit être > début.");
        }
        const res = await fetch('/api/learning/video-segments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                teacherId,
                stepId: String(step.id || ''),
                url: step.videoUrl,
                label: nextLabel,
                transcript: nextTranscript,
                startSec: nextStart,
                endSec: nextEnd
            })
        });
        const saved = res.ok ? await res.json() : null;
        if (!saved) return;
        updateStep(activeStep, { startSec: saved.startSec, endSec: saved.endSec });
        const sid = String(saved._id || saved.id || '');
        const label = String(saved.label || '');
        const transcript = String(saved.transcript || '');
        setSelectedSegmentId(sid);
        setSelectedSegmentLabel(label);
        setSelectedSegmentTranscript(transcript);
        setLastSavedSegmentLabel(label);
        setLastSavedSegmentTranscript(transcript);
        await refreshKnownSegments(step.videoUrl, step.id);
        return saved;
    };

    const getEditorCurrentSecond = () => {
        if (videoEditorRef.current) {
            return Math.max(0, Math.floor(Number(videoEditorRef.current.currentTime || 0)));
        }
        if (youtubeEditorPlayerRef.current?.getCurrentTime) {
            try { return Math.max(0, Math.floor(Number(youtubeEditorPlayerRef.current.getCurrentTime() || 0))); } catch (_) {}
        }
        return Math.max(0, Math.floor(Number(editorCurrentAbsSec || 0)));
    };
    const seekEditorTo = (absSec = 0, { freePlayback = false } = {}) => {
        const target = Math.max(0, Number(absSec || 0));
        if (freePlayback || (editorPlaybackMode === 'video' && !String(selectedSegmentId || '').trim())) {
            // Un segment supprimé peut avoir laissé une ancienne borne dans le
            // lecteur YouTube déjà monté. Un déplacement en mode vidéo libre
            // doit toujours neutraliser cette borne avant le seek.
            youtubeBoundsRef.current = { start: 0, end: 0 };
            setPreviewSegmentMode(false);
            if (freePlayback) {
                setEditorPlaybackMode('video');
                setEmbedPreviewSeekSec(null);
            }
        }
        setEditorCurrentAbsSec(target);
        if (videoEditorRef.current) {
            try { videoEditorRef.current.currentTime = target; } catch (_) {}
            return;
        }
        if (youtubeEditorPlayerRef.current?.seekTo) {
            try { youtubeEditorPlayerRef.current.seekTo(target, true); } catch (_) {}
        }
    };
    const cutCurrentSegment = async () => {
        if (!step || step.type !== 'video' || !step.videoUrl) return;
        const cutAt = Math.max(
            getEditorCurrentSecond(),
            Math.floor(Number(editorCurrentAbsSec || 0)),
            Math.floor(Number(timelineCurrentSec || 0))
        );
        if (selectedSegment) {
            const sid = String(selectedSegment._id || selectedSegment.id || '').trim();
            const segStart = Math.max(0, Number(selectedSegment.startSec || 0));
            const segEnd = Math.max(0, Number(selectedSegment.endSec || 0));
            const hasFiniteEnd = segEnd > segStart;
            if (cutAt <= segStart) {
                alert("Coupe après le début de la section sélectionnée.");
                return;
            }
            if (hasFiniteEnd && cutAt >= segEnd) {
                alert("Coupe avant la fin de la section sélectionnée.");
                return;
            }
            if (!sid) return;
            const patchRes = await fetch(`/api/learning/video-segments/${encodeURIComponent(sid)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId, endSec: cutAt })
            });
            if (!patchRes.ok) return;
            const newLabel = String(segmentLabel || '').trim() || `Segment ${cutAt}-${hasFiniteEnd ? segEnd : 'fin'}`;
            const saved = await saveCurrentSegment({
                startSec: cutAt,
                endSec: hasFiniteEnd ? segEnd : 0,
                label: newLabel,
                transcript: ''
            });
            if (!saved) return;
            setSegmentStart(cutAt);
            setSegmentEnd(hasFiniteEnd ? segEnd : 0);
            setSegmentEndFollowPlayhead(false);
            setSegmentLabel('');
            setPreviewSegmentMode(false);
            setEditorPlaybackMode('segment');
            return;
        }
        const lastKnownEndBeforeCut = (Array.isArray(knownSegments) ? knownSegments : [])
            .map((seg) => Math.max(0, Number(seg?.endSec || seg?.startSec || 0)))
            .filter((sec) => sec > 0 && sec < cutAt)
            .sort((a, b) => b - a)[0] || 0;
        const rawStart = Math.max(0, Number(segmentStart || 0));
        const start = rawStart < cutAt ? rawStart : lastKnownEndBeforeCut;
        if (cutAt <= start) {
            alert("Avance la lecture avant de couper.");
            return;
        }
        const saved = await saveCurrentSegment({
            startSec: start,
            endSec: cutAt,
            label: String(segmentLabel || '').trim() || `Segment ${start}-${cutAt}`
        });
        if (!saved) return;
        setSegmentStart(cutAt);
        setSegmentEnd(cutAt);
        setSegmentEndFollowPlayhead(true);
        setSegmentLabel('');
        setPreviewSegmentMode(false);
        setEditorPlaybackMode('video');
    };

    const previewSegment = () => {
        const start = Math.max(0, Number(segmentStart || 0));
        setSegmentPreviewRelSec(0);
        setEditorPlaybackMode('segment');
        if (editorIsDirect && videoEditorRef.current) {
            const el = videoEditorRef.current;
            try { el.currentTime = start; } catch (_) {}
            setPreviewSegmentMode(true);
            el.play().catch(() => {});
            return;
        }
        // Embed player (YouTube/Vimeo): force a reload with start/end params.
        setPreviewSegmentMode(true);
        setEmbedPreviewSeekSec(start);
        if (youtubeEditorPlayerRef.current?.seekTo) {
            try {
                youtubeEditorPlayerRef.current.seekTo(start, true);
                youtubeEditorPlayerRef.current.playVideo?.();
            } catch (_) {}
        } else {
            setEditorEmbedReloadKey(Date.now());
        }
    };

    const applyKnownSegment = (seg) => {
        if (!seg) return;
        updateStep(activeStep, { startSec: Number(seg.startSec || 0), endSec: Number(seg.endSec || 0) });
        setSegmentStart(Number(seg.startSec || 0));
        setSegmentEnd(Number(seg.endSec || 0));
        setSegmentEndFollowPlayhead(false);
        const sid = String(seg._id || seg.id || '');
        const label = String(seg.label || '');
        const transcript = String(seg.transcript || '');
        setSelectedSegmentId(sid);
        setSelectedSegmentLabel(label);
        setSelectedSegmentTranscript(transcript);
        setLastSavedSegmentLabel(label);
        setLastSavedSegmentTranscript(transcript);
        setSegmentPreviewRelSec(0);
        setEmbedPreviewSeekSec(null);
        setEditorPlaybackMode('segment');
    };
    const playSelectedSegmentNow = (seg) => {
        if (!seg) return;
        const start = Math.max(0, Number(seg.startSec || 0));
        const end = Math.max(0, Number(seg.endSec || 0));
        applyKnownSegment(seg);
        setSegmentStart(start);
        setSegmentEnd(end);
        setSegmentEndFollowPlayhead(false);
        setSegmentPreviewRelSec(0);
        setEditorPlaybackMode('segment');
        setPreviewSegmentMode(true);
        if (editorIsDirect && videoEditorRef.current) {
            try { videoEditorRef.current.currentTime = start; } catch (_) {}
            videoEditorRef.current.play().catch(() => {});
            return;
        }
        if (youtubeEditorPlayerRef.current?.seekTo) {
            try {
                youtubeEditorPlayerRef.current.seekTo(start, true);
                youtubeEditorPlayerRef.current.playVideo?.();
            } catch (_) {}
            return;
        }
        setEmbedPreviewSeekSec(start);
        setEditorEmbedReloadKey(Date.now());
    };
    const continueAfterSelectedSegment = async () => {
        const lastKnownEnd = (Array.isArray(knownSegments) ? knownSegments : [])
            .map((seg) => Math.max(0, Number(seg?.endSec || seg?.startSec || 0)))
            .sort((a, b) => b - a)[0] || 0;
        const baseEnd = selectedSegment
            ? Math.max(0, Number(selectedSegment.endSec || selectedSegment.startSec || 0))
            : Math.max(0, Number(lastKnownEnd || segmentEnd || segmentStart || editorCurrentAbsSec || 0));
        const nextStart = Math.max(0, Math.floor(baseEnd));
        const followingStart = (Array.isArray(knownSegments) ? knownSegments : [])
            .filter((seg) => String(seg?._id || seg?.id || '') !== String(selectedSegment?._id || selectedSegment?.id || ''))
            .map((seg) => Math.max(0, Math.floor(Number(seg?.startSec || 0))))
            .filter((startSec) => startSec > nextStart)
            .sort((a, b) => a - b)[0];
        const availableEnd = Number.isFinite(followingStart)
            ? followingStart
            : (timelineDurationSec > nextStart ? timelineDurationSec : 0);
        if (availableEnd > 0 && availableEnd <= nextStart) {
            alert("Il n'y a aucun espace libre après cette séquence.");
            return;
        }
        const saved = await saveCurrentSegment({
            startSec: nextStart,
            endSec: availableEnd,
            label: `Séquence ${(Array.isArray(knownSegments) ? knownSegments.length : 0) + 1}`,
            transcript: ''
        });
        if (!saved) return;
        setSelectedSegmentId('');
        setSelectedSegmentLabel('');
        setSelectedSegmentTranscript('');
        setLastSavedSegmentLabel('');
        setLastSavedSegmentTranscript('');
        setSegmentStart(nextStart);
        setSegmentEnd(availableEnd);
        setSegmentEndFollowPlayhead(false);
        setSegmentLabel('');
        setSegmentPreviewRelSec(0);
        setPreviewSegmentMode(false);
        setEditorPlaybackMode('segment');
        playSelectedSegmentNow(saved);
    };
    const removeKnownSegment = async (seg) => {
        if (!seg || !step?.videoUrl) return;
        const sid = String(seg._id || seg.id || '').trim();
        if (!sid) return;
        const res = await fetch(`/api/learning/video-segments/${encodeURIComponent(sid)}?teacherId=${encodeURIComponent(teacherId)}`, { method: 'DELETE' });
        if (!res.ok) return;
        const wasSelected = selectedSegmentId === sid;
        // Retire immédiatement la ligne locale afin que l'effet de synchronisation
        // ne puisse pas resélectionner le segment pendant le rafraîchissement API.
        setKnownSegments((prev) => (Array.isArray(prev) ? prev.filter((row) => String(row?._id || row?.id || '') !== sid) : []));
        if (wasSelected) {
            const resumeAt = Math.max(0, Number(editorCurrentAbsSec || seg.startSec || 0));
            setSelectedSegmentId('');
            setSelectedSegmentLabel('');
            setSelectedSegmentTranscript('');
            setLastSavedSegmentLabel('');
            setLastSavedSegmentTranscript('');
            setPreviewSegmentMode(false);
            setEditorPlaybackMode('video');
            setEmbedPreviewSeekSec(null);
            setSegmentStart(resumeAt);
            setSegmentEnd(resumeAt);
            setSegmentEndFollowPlayhead(true);
            youtubeBoundsRef.current = { start: 0, end: 0 };
            updateStep(activeStep, { startSec: 0, endSec: 0 });
            seekEditorTo(resumeAt);
        }
        await refreshKnownSegments(step.videoUrl, step.id);
    };
    const clearSegmentsForCurrentVideo = async () => {
        if (!step?.videoUrl) return;
        const ok = window.confirm("Supprimer tous les segments de cette vidéo ?");
        if (!ok) return;
        try {
            const res = await fetch(
                `/api/learning/video-segments-by-url?${buildVideoSegmentsQuery(String(step.videoUrl || '').trim(), String(step.id || ''))}`,
                { method: 'DELETE' }
            );
            if (!res.ok) throw new Error('Suppression impossible');
            setKnownSegments([]);
            setSelectedSegmentId('');
            setSelectedSegmentLabel('');
            setSelectedSegmentTranscript('');
            setLastSavedSegmentLabel('');
            setLastSavedSegmentTranscript('');
            setSegmentStart(0);
            setSegmentEnd(0);
            setSegmentEndFollowPlayhead(true);
            setPreviewSegmentMode(false);
            setEditorPlaybackMode('video');
            setEmbedPreviewSeekSec(null);
            youtubeBoundsRef.current = { start: 0, end: 0 };
            updateStep(activeStep, { startSec: 0, endSec: 0 });
        } catch (e) {
            alert(`Suppression impossible: ${String(e?.message || 'Erreur')}`);
        }
    };

    const saveSelectedSegmentBounds = async (nextStartSec, nextEndSec) => {
        if (!selectedSegmentId || !step?.videoUrl) return false;
        const startSec = Math.max(0, Math.floor(Number(nextStartSec || 0)));
        let endSec = Math.max(0, Math.floor(Number(nextEndSec || 0)));
        if (endSec > 0 && endSec <= startSec) endSec = startSec + 1;
        const res = await fetch(`/api/learning/video-segments/${encodeURIComponent(selectedSegmentId)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId, startSec, endSec })
        });
        if (!res.ok) return false;
        setSegmentStart(startSec);
        setSegmentEnd(endSec);
        updateStep(activeStep, { startSec, endSec });
        await refreshKnownSegments(step.videoUrl, step.id);
        return true;
    };
    const buildVideoSegmentStructure = ({ sourceUrl = '', sourceName = '', segments = [], templateStep = null } = {}) => {
        const safeUrl = String(sourceUrl || '').trim();
        const orderedSegments = (Array.isArray(segments) ? segments : [])
            .filter(Boolean)
            .sort((a, b) => Number(a?.startSec || 0) - Number(b?.startSec || 0));
        if (!safeUrl || orderedSegments.length === 0) return null;

        let nextSections = Array.isArray(formData.sections) ? formData.sections.map((row) => ({ ...row })) : [];
        if (nextSections.length === 0) nextSections = [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
        while (nextSections.length < orderedSegments.length) {
            const sectionNumber = nextSections.length + 1;
            nextSections.push({ id: `sec_${Date.now()}_${sectionNumber}`, name: `Section ${sectionNumber}`, order: nextSections.length, visible: true });
        }
        nextSections = nextSections.map((section, index) => index < orderedSegments.length ? {
            ...section,
            name: index === 0 ? 'Introduction' : `Partie ${toRomanPartNumber(index)}`,
            order: index
        } : section);

        const sourceTemplate = templateStep || (formData.steps || []).find((row) => row?.type === 'video' && String(row?.videoUrl || '').trim() === safeUrl) || {
            ...emptyStep('video'),
            videoUrl: safeUrl
        };
        const sourceStepId = String(sourceTemplate?.segmentSourceStepId || sourceTemplate?.id || uid());
        const removableIds = new Set((formData.steps || [])
            .filter((row) => row?.type === 'video' && (
                String(row?.id || '') === String(sourceTemplate?.id || '')
                || String(row?.segmentSourceUrl || '').trim() === safeUrl
                || (row?.generatedFromVideoSegments === true && String(row?.videoUrl || '').trim() === safeUrl)
            ))
            .map((row) => String(row?.id || '')));
        const baseSteps = (formData.steps || []).filter((row) => !removableIds.has(String(row?.id || '')));
        const generatedSteps = orderedSegments.map((segment, index) => ({
            ...sourceTemplate,
            id: index === 0 ? String(sourceTemplate?.id || uid()) : uid(),
            type: 'video',
            sectionId: String(nextSections[index]?.id || nextSections[0]?.id || ''),
            title: index === 0 ? 'Introduction' : `Partie ${toRomanPartNumber(index)}`,
            videoUrl: safeUrl,
            ...(sourceName ? { videoSourceName: sourceName } : {}),
            startSec: Math.max(0, Number(segment?.startSec || 0)),
            endSec: Math.max(0, Number(segment?.endSec || 0)),
            videoTranscript: String(segment?.transcript || ''),
            videoSegmentId: String(segment?._id || segment?.id || `segment_${index + 1}`),
            segmentSourceStepId: sourceStepId,
            segmentSourceUrl: safeUrl,
            generatedFromVideoSegments: true
        }));
        const nextSteps = [...baseSteps];
        [...generatedSteps].reverse().forEach((videoStep) => {
            const firstInSection = nextSteps.findIndex((row) => String(row?.sectionId || '') === String(videoStep.sectionId || ''));
            if (firstInSection < 0) nextSteps.push(videoStep);
            else nextSteps.splice(firstInSection, 0, videoStep);
        });
        return { nextSections, nextSteps, generatedSteps };
    };
    const applySelectedSegmentToStep = async () => {
        if (!selectedSegment || !selectedSegmentId || !step) return;
        const startSec = Math.max(0, Math.floor(Number(segmentStart || selectedSegment.startSec || 0)));
        const endSec = Math.max(startSec + 1, Math.floor(Number(segmentEnd || selectedSegment.endSec || startSec + 1)));
        const label = String(selectedSegmentLabel || selectedSegment.label || '').trim();
        const videoTranscript = String(selectedSegmentTranscript || '');
        setSavingStepData(true);
        try {
            const segmentRes = await fetch(`/api/learning/video-segments/${encodeURIComponent(selectedSegmentId)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId, startSec, endSec, label, transcript: videoTranscript })
            });
            const segmentData = await segmentRes.json().catch(() => ({}));
            if (!segmentRes.ok) throw new Error(segmentData?.error || 'Enregistrement de la séquence impossible');

            const sourceUrl = String(step.videoUrl || '').trim();
            const sourceStepId = String(step.segmentSourceStepId || step.id || '');
            const orderedSegments = (Array.isArray(knownSegments) ? knownSegments : [])
                .map((row) => String(row?._id || row?.id || '') === String(selectedSegmentId)
                    ? { ...row, startSec, endSec, label, transcript: videoTranscript }
                    : row)
                .sort((a, b) => Number(a?.startSec || 0) - Number(b?.startSec || 0));

            const structure = buildVideoSegmentStructure({ sourceUrl, segments: orderedSegments, templateStep: { ...step, segmentSourceStepId: sourceStepId } });
            if (!structure) throw new Error('Aucune séquence enregistrée pour cette vidéo');
            const { nextSections, nextSteps, generatedSteps } = structure;
            const nextFormData = { ...formData, sections: nextSections, steps: nextSteps };
            setFormData(nextFormData);
            setActiveStep(Math.max(0, nextSteps.findIndex((row) => String(row?.id || '') === String(generatedSteps[0]?.id || ''))));

            if (formData?._id) {
                const stepRes = await fetch(`/api/learning/${encodeURIComponent(String(formData._id))}/structure`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sections: nextSections,
                        steps: nextSteps
                    })
                });
                const stepData = await stepRes.json().catch(() => ({}));
                if (!stepRes.ok) throw new Error(stepData?.error || "Enregistrement de la structure impossible");
            }

            setLastSavedSegmentLabel(label);
            setLastSavedSegmentTranscript(videoTranscript);
            setShowVideoEditor(false);
        } catch (error) {
            alert(`Sauvegarde impossible : ${String(error?.message || 'Erreur')}`);
        } finally {
            setSavingStepData(false);
        }
    };
    const clearSelectedSegment = () => {
        setSelectedSegmentId('');
        setSelectedSegmentLabel('');
        setSelectedSegmentTranscript('');
        setEditorPlaybackMode('video');
        setPreviewSegmentMode(false);
        setSegmentEndFollowPlayhead(true);
    };
    const resizeBoundarySegments = async ({ leftSid = '', rightSid = '', leftStartSec = 0, rightEndSec = 0, boundarySec = 0 }) => {
        const lsid = String(leftSid || '').trim();
        const rsid = String(rightSid || '').trim();
        if (!lsid || !rsid || !step?.videoUrl) return false;
        const leftStart = Math.max(0, Math.floor(Number(leftStartSec || 0)));
        const rightEnd = Math.max(leftStart + 2, Math.floor(Number(rightEndSec || 0)));
        const boundary = Math.max(leftStart + 1, Math.min(rightEnd - 1, Math.floor(Number(boundarySec || 0))));
        const [leftRes, rightRes] = await Promise.all([
            fetch(`/api/learning/video-segments/${encodeURIComponent(lsid)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId, startSec: leftStart, endSec: boundary })
            }),
            fetch(`/api/learning/video-segments/${encodeURIComponent(rsid)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId, startSec: boundary, endSec: rightEnd })
            })
        ]);
        if (!leftRes.ok || !rightRes.ok) return false;
        if (selectedSegmentId === lsid) {
            setSegmentStart(leftStart);
            setSegmentEnd(boundary);
            updateStep(activeStep, { startSec: leftStart, endSec: boundary });
        } else if (selectedSegmentId === rsid) {
            setSegmentStart(boundary);
            setSegmentEnd(rightEnd);
            updateStep(activeStep, { startSec: boundary, endSec: rightEnd });
        }
        await refreshKnownSegments(step.videoUrl, step.id);
        return true;
    };
    const secFromTimelineClientX = (clientX) => {
        const el = timelineZonesRef.current;
        if (!el) return 0;
        const rect = el.getBoundingClientRect();
        const ratio = rect.width > 0 ? (Number(clientX || 0) - rect.left) / rect.width : 0;
        return Math.max(0, Math.floor(Math.max(0, Math.min(1, ratio)) * Math.max(1, timelineDurationSec)));
    };
    const startResizeSegment = (seg, nextSeg, ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const sid = String(seg?.sid || '').trim();
        const nextSid = String(nextSeg?.sid || '').trim();
        if (!sid || !nextSid) return;
        const nextEnd = Math.max(0, Number(nextSeg?.endSec || 0));
        if (nextEnd <= 0) return;
        const minEnd = Math.max(1, Number(seg?.startSec || 0) + 1);
        const maxEnd = Math.max(minEnd, Math.floor(nextEnd) - 1);
        resizingSegmentRef.current = {
            leftSid: sid,
            rightSid: nextSid,
            leftStartSec: Math.max(0, Number(seg?.startSec || 0)),
            rightEndSec: Math.floor(nextEnd),
            minEndSec: minEnd,
            maxEndSec: maxEnd
        };
        const onMove = (e) => {
            const ctx = resizingSegmentRef.current;
            if (!ctx) return;
            const raw = secFromTimelineClientX(e.clientX);
            const clamped = Math.max(ctx.minEndSec, Math.min(ctx.maxEndSec, raw));
            setKnownSegments((prev) => (Array.isArray(prev) ? prev.map((row) => {
                const rowId = String(row?._id || row?.id || '').trim();
                if (rowId === ctx.leftSid) return { ...row, endSec: clamped };
                if (rowId === ctx.rightSid) return { ...row, startSec: clamped };
                return row;
            }) : prev));
            if (selectedSegmentId === ctx.leftSid) {
                setSegmentStart(ctx.leftStartSec);
                setSegmentEnd(clamped);
            } else if (selectedSegmentId === ctx.rightSid) {
                setSegmentStart(clamped);
                setSegmentEnd(ctx.rightEndSec);
            }
        };
        const onUp = async (e) => {
            const ctx = resizingSegmentRef.current;
            resizingSegmentRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            if (!ctx) return;
            const raw = secFromTimelineClientX(e.clientX);
            const clamped = Math.max(ctx.minEndSec, Math.min(ctx.maxEndSec, raw));
            await resizeBoundarySegments({
                leftSid: ctx.leftSid,
                rightSid: ctx.rightSid,
                leftStartSec: ctx.leftStartSec,
                rightEndSec: ctx.rightEndSec,
                boundarySec: clamped
            });
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };
    const selectedSegment = knownSegments.find((s) => String(s._id || s.id || '') === selectedSegmentId) || null;
    const getQuestionSectionMapFromAnyStep = (sourceStep = null) => {
        if (!sourceStep) return {};
        const keepEmptyRows = step && String(sourceStep?.id || '') === String(step?.id || '');
        const normalizeExpectedKeywordDrafts = (value) => {
            const raw = Array.isArray(value)
                ? value.map((x) => String(x ?? ''))
                : String(value || '').split(',').map((x) => String(x ?? ''));
            return keepEmptyRows
                ? raw
                : raw.map((x) => x.trim()).filter(Boolean);
        };
        const objectCandidates = [
            sourceStep.questionSectionQuestions,
            sourceStep.sheetSectionQuestions,
            sourceStep.videoSectionQuestions,
            sourceStep.sectionQuestions,
            sourceStep.zoneQuestions
        ];
        for (const candidate of objectCandidates) {
            if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue;
            const clean = {};
            Object.keys(candidate).forEach((key) => {
                const rows = Array.isArray(candidate[key]) ? candidate[key] : [];
                const usable = rows
                    .map((row) => ({
                        q: String(row?.q || row?.question || ''),
                        question: String(row?.question || row?.q || ''),
                        expectedAnswer: String(row?.expectedAnswer || row?.answer || '').trim(),
                        expectedKeywords: normalizeExpectedKeywordDrafts(row?.expectedKeywords),
                        generatedByAi: row?.generatedByAi === true,
                        validationType: row?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open'
                    }))
                    .filter((row) => keepEmptyRows || String(row.question || '').trim() || row.expectedAnswer || row.expectedKeywords.length > 0);
                if (usable.length > 0) clean[String(key)] = usable;
            });
            if (Object.keys(clean).length > 0) return clean;
        }
        const pairs = Array.isArray(sourceStep.questionAnswerPairs) ? sourceStep.questionAnswerPairs : [];
        const pairRows = pairs
            .map((pair) => ({
                q: String(pair?.question || pair?.q || ''),
                question: String(pair?.question || pair?.q || ''),
                expectedAnswer: String(pair?.expectedAnswer || pair?.answer || '').trim(),
                expectedKeywords: normalizeExpectedKeywordDrafts(pair?.expectedKeywords),
                generatedByAi: pair?.generatedByAi === true,
                validationType: pair?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open'
            }))
            .filter((row) => String(row.question || '').trim() || row.expectedAnswer || row.expectedKeywords.length > 0);
        if (pairRows.length > 0) return { 0: pairRows };
        const fallbackQuestion = String(sourceStep.customQuestion || '').trim();
        const fallbackAnswer = Array.isArray(sourceStep.redHighlights)
            ? sourceStep.redHighlights.map((x) => String(x || '').trim()).filter(Boolean).join('\n')
            : '';
        const fallbackKeywords = Array.isArray(sourceStep.keywords)
            ? sourceStep.keywords.map((x) => String(x || '').trim()).filter(Boolean)
            : [];
        if (fallbackQuestion || fallbackAnswer || fallbackKeywords.length > 0) {
            return {
                0: [{
                    q: fallbackQuestion,
                    question: fallbackQuestion,
                    expectedAnswer: fallbackAnswer,
                    expectedKeywords: fallbackKeywords,
                    generatedByAi: false
                }]
            };
        }
        return {};
    };
    const questionTextSources = useMemo(() => getQuestionTextSources(), [formData.steps, step?.id]);
    const questionSources = useMemo(() => getQuestionSources(), [formData.steps, allGames, formData.chapterId, step?.id]);
    const videoSources = useMemo(() => getCandidateVideos(), [formData.steps, allGames, formData.chapterId]);
    const sheetQuestionSources = useMemo(() => questionSources.filter((s) => s.type === 'sheet'), [questionSources]);
    const videoQuestionSources = useMemo(() => questionSources.filter((s) => s.type === 'video'), [questionSources]);
    const forcedQuestionSource = useMemo(
        () => (step?.type === 'question' ? getForcedQuestionSourceForIndex(activeStep) : null),
        [formData.steps, activeStep, step?.id, step?.type]
    );
    const questionSectionsFromDb = useMemo(() => {
        if (!step || step.type !== 'question') return [];
        let map = getQuestionSectionMapFromAnyStep(step);
        if (Object.keys(map).length === 0) {
            const sourceInfo = getForcedQuestionSourceForIndex(activeStep);
            const sourceStep = sourceInfo?.stepId
                ? (formData.steps || []).find((s) => String(s?.id || '') === String(sourceInfo.stepId))
                : null;
            const fallbackMap = getQuestionSectionMapFromAnyStep(sourceStep);
            if (fallbackMap && typeof fallbackMap === 'object' && Object.keys(fallbackMap).length > 0) {
                map = fallbackMap;
            }
        }
        return Object.keys(map)
            .map((k) => ({ idx: Number(k), rows: Array.isArray(map[k]) ? map[k] : [] }))
            .filter((x) => Number.isFinite(x.idx) && x.rows.length > 0)
            .sort((a, b) => a.idx - b.idx);
    }, [activeStep, formData.steps, step?.id, step?.questionSectionQuestions, step?.type]);
    const selectedQuestionSource = useMemo(() => {
        if (step?.type === 'question' && forcedQuestionSource?.value) {
            return resolveQuestionSource(forcedQuestionSource.value) || getSelectedQuestionSource(step);
        }
        return getSelectedQuestionSource(step);
    }, [step?.type, step?.sourceKind, step?.sourceSheetUrl, step?.sourceVideoRef, step?.sourceSlidesUrl, formData.steps, forcedQuestionSource?.value]);
    const keywordSlidesUrl = useMemo(() => {
        if (!step || step.type !== 'sheet') return '';
        const url = String(step.sheetUrl || '').trim();
        return isGoogleSlidesUrl(url) ? url : '';
    }, [step?.id, step?.type, step?.sheetUrl]);
    const keywordSlidesMode = Boolean(showKeywordModal && keywordSlidesUrl);
    const keywordSlidesPresentationId = useMemo(
        () => extractGoogleSlidesId(keywordSlidesUrl),
        [keywordSlidesUrl]
    );
    const currentSlideObjectId = String(slidesManifest[slidesActiveIdx]?.objectId || '').trim();
    const currentSlideSectionId = useMemo(() => {
        if (!step || step.type !== 'sheet') return '';
        const map = sanitizeSlideSectionMap(step.sheetSlideSectionMap);
        return String(map[currentSlideObjectId] || '').trim();
    }, [step?.id, step?.type, step?.sheetSlideSectionMap, currentSlideObjectId]);
    const currentSlideSectionName = useMemo(() => {
        if (!currentSlideSectionId) return '';
        const row = (formData.sections || []).find((sec) => String(sec?.id || '') === currentSlideSectionId);
        return String(row?.name || '').trim();
    }, [currentSlideSectionId, formData.sections]);

    useEffect(() => {
        if (!step || step.type !== 'question') return;
        if (!forcedQuestionSource) return;
        if (forcedQuestionSource.kind === 'video') {
            const same =
                String(step.sourceKind || '') === 'video' &&
                String(step.sourceVideoRef || '') === String(forcedQuestionSource.value);
            if (same) return;
            updateStep(activeStep, {
                sourceKind: 'video',
                sourceVideoRef: forcedQuestionSource.value,
                sourceSheetUrl: '',
                sourceSlidesUrl: ''
            });
            return;
        }
        const same =
            String(step.sourceKind || '') === 'sheet' &&
            String(step.sourceSheetUrl || '') === String(forcedQuestionSource.value);
        if (same) return;
        updateStep(activeStep, {
            sourceKind: 'sheet',
            sourceSheetUrl: forcedQuestionSource.value,
            sourceVideoRef: '',
            sourceSlidesUrl: ''
        });
    }, [step?.id, step?.type, step?.sourceKind, step?.sourceSheetUrl, step?.sourceVideoRef, forcedQuestionSource, activeStep]);

    const openKeywordModal = () => {
        if (!step) return;
        if (step.type === 'question') {
            const existingSource = String(step.materialSource || 'manual');
            const source = questionTextSources.find((s) => s.id === existingSource) || questionTextSources[0] || { id: 'manual', text: '' };
            setKeywordMaterialSource(source.id);
            setKeywordMaterialText(String(step.materialText || source.text || ''));
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
            return;
        }
        if (step.type === 'video') {
            const stepTranscript = String(step.videoTranscript || '').trim();
            let transcript = stepTranscript;
            if (!transcript) {
                const match = (knownSegments || []).find((seg) =>
                    Number(seg?.startSec || 0) === Number(step.startSec || 0)
                    && Number(seg?.endSec || 0) === Number(step.endSec || 0)
                );
                transcript = String(match?.transcript || '').trim();
            }
            setKeywordMaterialSource(`video:${step.id}`);
            setKeywordMaterialText(transcript);
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setShowKeywordModal(true);
            return;
        }
        if (step.type === 'sheet') {
            const isSlides = isGoogleSlidesUrl(step.sheetUrl || '');
            setKeywordMaterialSource(`sheet:${step.id}`);
            setKeywordMaterialText(String(step.sheetText || ''));
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            setActiveTarget('response');
            setEraseMode(false);
            setSlidesPanelMode(isSlides ? 'slide' : 'transcription');
            if (!isSlides) {
                setSlidesManifest([]);
                setSlidesManifestError('');
                setSlidesManifestLoading(false);
                setSlidesActiveIdx(0);
            }
            setShowKeywordModal(true);
        }
    };

    const loadQuestionSourceText = async ({ openKeyword = false, quietMissingVideoText = false } = {}) => {
        if (!step || step.type !== 'question') return '';
        const source = getSelectedQuestionSource(step)
            || (forcedQuestionSource?.value ? resolveQuestionSource(forcedQuestionSource.value) : null);
        if (!source?.url) {
            alert("Choisis d'abord une source.");
            return '';
        }
        if (source.type === 'slides') {
            setLoadingQuestionSourceText(true);
            try {
                const res = await fetch('/api/learning/slides/extract-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ presentationUrl: source.url, slideSelection: '' })
                });
                const data = await res.json();
                if (!res.ok || !data?.combinedText) throw new Error(data?.error || 'Extraction slides impossible');
                const extracted = String(data.combinedText || '');
                updateStep(activeStep, { materialSource: String(step.sourceSlidesUrl || ''), materialText: extracted });
                if (openKeyword) {
                    setKeywordMaterialSource(String(step.sourceSlidesUrl || 'manual'));
                    setKeywordMaterialText(extracted);
                    setKeywordSelectedText('');
                    setKeywordSelectionSpan(null);
                    setActiveTarget('response');
                    setEraseMode(false);
                    setShowKeywordModal(true);
                } else {
                    setShowQuestionSourceText(true);
                }
                return extracted;
            } catch (e) {
                alert(`Extraction Slides impossible: ${e.message}`);
                return '';
            } finally {
                setLoadingQuestionSourceText(false);
            }
        }
        if (source.type === 'video') {
            let transcript = String(source.text || '').trim();
            if (!transcript) {
                try {
                    const res = await fetch(`/api/learning/video-segments?${buildVideoSegmentsQuery(String(source.url || ''), String(source.stepId || ''))}`);
                    const list = res.ok ? await res.json() : [];
                    const rows = Array.isArray(list) ? list : [];
                    const sameBounds = rows.find((seg) =>
                        Number(seg?.startSec || 0) === Number(source.startSec || 0)
                        && Number(seg?.endSec || 0) === Number(source.endSec || 0)
                        && String(seg?.transcript || '').trim()
                    );
                    const withText = sameBounds || rows.find((seg) => String(seg?.transcript || '').trim());
                    transcript = String(withText?.transcript || '').trim();
                    if (transcript) {
                        const sid = parseVideoStepId(step.sourceVideoRef || '');
                        if (sid) {
                            const idx = (formData.steps || []).findIndex((s) => String(s.id || '') === sid && s.type === 'video');
                            if (idx >= 0) updateStep(idx, { videoTranscript: transcript });
                        }
                    }
                } catch (_) {}
            }
            if (!transcript) {
                if (!quietMissingVideoText) alert("La séquence vidéo n'a pas encore de transcription.");
                return '';
            }
            updateStep(activeStep, { materialSource: String(step.sourceVideoRef || ''), materialText: transcript });
            if (openKeyword) {
                setKeywordMaterialSource(String(step.sourceVideoRef || `video:${step.id}`));
                setKeywordMaterialText(transcript);
                setKeywordSelectedText('');
                setKeywordSelectionSpan(null);
                setActiveTarget('response');
                setEraseMode(false);
                setShowKeywordModal(true);
            } else {
                setShowQuestionSourceText(true);
            }
            return transcript;
        }
        setLoadingQuestionSourceText(true);
        try {
            const sourceRef = String(step.sourceSheetUrl || '').trim();
            const sourceUrl = String(source.url || '').trim();
            const cacheRef = sourceUrl ? `${sourceRef}|${sourceUrl}` : sourceRef;
            const cachedSourceRef = String(step.materialSource || '').trim();
            const cachedText = String(step.materialText || '').trim();
            if (cachedText && cacheRef && cachedSourceRef === cacheRef) {
                if (openKeyword) {
                    setKeywordMaterialSource(cacheRef);
                    setKeywordMaterialText(cachedText);
                    setKeywordSelectedText('');
                    setKeywordSelectionSpan(null);
                    setActiveTarget('response');
                    setEraseMode(false);
                    setShowKeywordModal(true);
                } else {
                    setShowQuestionSourceText(true);
                }
                return cachedText;
            }
            const localText = String(source.text || '').trim();
            if (localText) {
                updateStep(activeStep, { materialSource: cacheRef, materialText: localText });
                if (openKeyword) {
                    setKeywordMaterialSource(cacheRef || String(step.sourceSheetUrl || `sheet:${step.id}`));
                    setKeywordMaterialText(localText);
                    setKeywordSelectedText('');
                    setKeywordSelectionSpan(null);
                    setActiveTarget('response');
                    setEraseMode(false);
                    setShowKeywordModal(true);
                } else {
                    setShowQuestionSourceText(true);
                }
                return localText;
            }
            const res = await fetch('/api/learning/extract-sheet-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetUrl: source.url })
            });
            const data = await res.json();
            if (!res.ok || !data?.text) throw new Error(data?.error || 'Extraction impossible');
            const extracted = String(data.text || '');
            updateStep(activeStep, { materialSource: cacheRef, materialText: extracted });
            if (openKeyword) {
                setKeywordMaterialSource(cacheRef || String(step.sourceSheetUrl || `sheet:${step.id}`));
                setKeywordMaterialText(extracted);
                setKeywordSelectedText('');
                setKeywordSelectionSpan(null);
                setActiveTarget('response');
                setEraseMode(false);
                setShowKeywordModal(true);
            } else {
                setShowQuestionSourceText(true);
            }
            return extracted;
        } catch (e) {
            alert(`Extraction fiche impossible: ${e.message}`);
            return '';
        } finally {
            setLoadingQuestionSourceText(false);
        }
    };
    const hydrateTranscriptForVideoSource = async (videoRef = '') => {
        if (!step || step.type !== 'question') return '';
        const ref = String(videoRef || step.sourceVideoRef || '').trim();
        if (!ref) return '';
        const source = resolveQuestionSource(ref);
        if (!source || source.type !== 'video' || !source.url) return '';
        let transcript = String(source.text || '').trim();
        if (!transcript) {
            try {
                const res = await fetch(`/api/learning/video-segments?${buildVideoSegmentsQuery(String(source.url || ''), String(source.stepId || ''))}`);
                const list = res.ok ? await res.json() : [];
                const rows = Array.isArray(list) ? list : [];
                const sameBounds = rows.find((seg) =>
                    Number(seg?.startSec || 0) === Number(source.startSec || 0)
                    && Number(seg?.endSec || 0) === Number(source.endSec || 0)
                    && String(seg?.transcript || '').trim()
                );
                const withText = sameBounds || rows.find((seg) => String(seg?.transcript || '').trim());
                transcript = String(withText?.transcript || '').trim();
                if (transcript) {
                    const sid = parseVideoStepId(ref);
                    if (sid) {
                        const idx = (formData.steps || []).findIndex((s) => String(s.id || '') === sid && s.type === 'video');
                        if (idx >= 0) updateStep(idx, { videoTranscript: transcript });
                    }
                    updateStep(activeStep, { materialSource: ref, materialText: transcript });
                }
            } catch (_) {}
        }
        return transcript;
    };

    const openQuestionEditor = async () => {
        if (!step || step.type !== 'question') return;
        setQuestionSourceNotice('');
        const source = getSelectedQuestionSource(step);
        if (!source?.url) {
            alert("Choisis d'abord une source.");
            return;
        }
        if (source.type === 'video') {
            const transcript = String(await hydrateTranscriptForVideoSource(step.sourceVideoRef || '') || '').trim();
            if (!transcript) {
                const sid = parseVideoStepId(step.sourceVideoRef || '');
                if (sid) {
                    const videoStep = (formData.steps || []).find((s) => String(s.id || '') === sid && s.type === 'video');
                    const label = String(videoStep?.title || 'cette séquence');
                    setQuestionSourceNotice(`Transcription manquante pour "${label}". Ouvre l'éditeur vidéo pour l'ajouter.`);
                } else {
                    setQuestionSourceNotice("Transcription vidéo manquante.");
                }
                return;
            }
        }
        await loadQuestionSourceText({ openKeyword: true, quietMissingVideoText: true });
    };
    const openVideoEditorFromQuestionSource = () => {
        if (!step || step.type !== 'question') return;
        const sid = parseVideoStepId(step.sourceVideoRef || '');
        if (!sid) return;
        const idx = (formData.steps || []).findIndex((s) => String(s.id || '') === sid && s.type === 'video');
        if (idx < 0) return;
        setPendingVideoEditorStepId(sid);
        setActiveStep(idx);
    };

    const extractTextFromSelectedSourceForQuestion = async () => {
        await loadQuestionSourceText({ openKeyword: true });
    };

    const generateQuestionAnswerPairsFromSource = async () => {
        if (!step || step.type !== 'question') return;
        const wanted = Math.max(1, Math.min(20, Number(step.questionCount || 3)));
        setAiTesting(true);
        try {
            const source = getSelectedQuestionSource(step)
                || (forcedQuestionSource?.value ? resolveQuestionSource(forcedQuestionSource.value) : null);
            const sourceRef = source?.type === 'sheet'
                ? `${String(step.sourceSheetUrl || forcedQuestionSource?.value || '').trim()}|${String(source?.url || '').trim()}`
                : source?.type === 'video'
                    ? String(step.sourceVideoRef || forcedQuestionSource?.value || '').trim()
                    : source?.type === 'slides'
                        ? String(step.sourceSlidesUrl || '').trim()
                        : String(step.materialSource || '').trim();
            const cacheMatches = sourceRef && String(step.materialSource || '').trim() === sourceRef;
            let sourceText = cacheMatches ? String(step.materialText || '').trim() : '';
            if (!sourceText) sourceText = String(await loadQuestionSourceText({ openKeyword: false }) || '').trim();
            if (!sourceText) {
                const sourceLabel = forcedQuestionSource?.label || selectedQuestionSource?.url || 'source précédente';
                throw new Error(`Aucun texte source disponible pour "${sourceLabel}". Si c'est une image, l'OCR IA n'a pas réussi à extraire le texte.`);
            }
            const res = await fetch('/api/learning/generate-section-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sectionText: sourceText,
                    sourceAnswers: [],
                    count: wanted,
                    teacherId
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Génération impossible');
            const pairs = normalizeQuestionPairs(data?.rows || data?.pairs || [])
                .map((pair) => ({ ...pair, generatedByAi: true }));
            if (!pairs.length) throw new Error('Aucune question générée');
            const manualRows = (Array.isArray(step.questionAnswerPairs) ? step.questionAnswerPairs : [])
                .filter((pair) => pair?.generatedByAi !== true);
            updateStep(activeStep, patchFromQuestionPairs([...manualRows, ...pairs]));
        } catch (e) {
            alert(`Génération impossible: ${e.message}`);
        }
        setAiTesting(false);
    };

    const extractTextForSheetStep = async () => {
        if (!step || step.type !== 'sheet') return;
        const sheetUrl = String(step.sheetUrl || '').trim();
        if (!sheetUrl) return alert("Ajoute d'abord l'URL de la fiche.");
        setExtractingSheetText(true);
        try {
            const res = await fetch('/api/learning/extract-sheet-text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sheetUrl, teacherId })
            });
            const data = await res.json();
            if (!res.ok || !data?.text) throw new Error(data?.error || 'Extraction impossible');
            updateStep(activeStep, { sheetText: data.text });
        } catch (e) {
            alert(`Extraction fiche impossible: ${e.message}`);
        }
        setExtractingSheetText(false);
    };

    const saveExtractedSheetText = async () => {
        if (!step || step.type !== 'sheet') return;
        const text = String(step.sheetText || '').trim();
        if (!text) return alert("Aucun texte de fiche à sauvegarder.");
        if (!formData?._id) {
            return alert("Texte prêt: il sera sauvegardé lors de la publication de l'apprentissage.");
        }
        setSavingSheetText(true);
        try {
            const res = await fetch(`/api/learning/${encodeURIComponent(String(formData._id))}/step-text`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stepId: String(step.id || ''), kind: 'sheet', text })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur sauvegarde');
            alert("Texte extrait sauvegardé.");
        } catch (e) {
            alert(`Sauvegarde impossible: ${e.message}`);
        }
        setSavingSheetText(false);
    };

    const onKeywordSourceChange = (sourceId) => {
        const source = questionTextSources.find((s) => s.id === sourceId) || { id: 'manual', text: '' };
        setKeywordMaterialSource(source.id);
        setKeywordMaterialText(source.text || '');
        setKeywordSelectedText('');
        setKeywordSelectionSpan(null);
        setActiveTarget('response');
        setEraseMode(false);
    };
    useEffect(() => {
        if (!keywordSlidesMode) return;
        const url = String(keywordSlidesUrl || '').trim();
        if (!url) return;
        const cacheKey = `${url}|all`;
        const cached = slidesManifestCacheRef.current.get(cacheKey);
        if (Array.isArray(cached)) {
            setSlidesManifest(cached);
            setSlidesActiveIdx(0);
            setSlidesManifestError('');
            setSlidesManifestLoading(false);
            return;
        }
        const ctrl = new AbortController();
        (async () => {
            setSlidesManifestLoading(true);
            setSlidesManifestError('');
            try {
                const res = await fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationUrl: url,
                        slideSelection: '',
                        filterCondition: '',
                        includeThumbnails: false
                    }),
                    signal: ctrl.signal
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(String(data?.error || 'Slides indisponibles'));
                const pid = extractGoogleSlidesId(url);
                const rows = (Array.isArray(data?.slides) ? data.slides : []).map((r) => {
                    const objectId = String(r?.objectId || '').trim();
                    const slideNumber = String(r?.slideNumber || '').trim();
                    const proxyFromServer = String(r?.thumbnailProxyUrl || '').trim();
                    return {
                        ...r,
                        thumbnailProxyUrl: proxyFromServer || buildSlidesThumbnailProxyUrl(pid, objectId, slideNumber)
                    };
                });
                slidesManifestCacheRef.current.set(cacheKey, rows);
                setSlidesManifest(rows);
                setSlidesActiveIdx(0);
            } catch (e) {
                if (ctrl.signal.aborted) return;
                setSlidesManifest([]);
                setSlidesManifestError(String(e?.message || 'Slides indisponibles'));
            } finally {
                if (!ctrl.signal.aborted) setSlidesManifestLoading(false);
            }
        })();
        return () => ctrl.abort();
    }, [keywordSlidesMode, keywordSlidesUrl]);
    useEffect(() => {
        if (!keywordSlidesMode || !step || !['sheet', 'question'].includes(step.type)) return;
        const currentMap = getStepSlideTextMap(step);
        const hasStoredSlideText = Object.values(currentMap).some((value) => String(value || '').trim());
        if (!hasStoredSlideText && Array.isArray(slidesManifest) && slidesManifest.length > 0) {
            const hydratedMap = {};
            slidesManifest.forEach((slide) => {
                const objectId = String(slide?.objectId || '').trim();
                const text = String(slide?.text || '').replace(/\r/g, '').trim();
                if (!objectId || !text) return;
                hydratedMap[objectId] = text;
            });
            if (Object.keys(hydratedMap).length > 0) {
                const activeObjectId = String(slidesManifest[slidesActiveIdx]?.objectId || '').trim();
                const activeText = String(hydratedMap[activeObjectId] || slidesManifest[slidesActiveIdx]?.text || '').trim();
                if (step.type === 'sheet') {
                    updateStep(activeStep, {
                        sheetSlideTextMap: hydratedMap,
                        sheetText: activeText || String(step.sheetText || '')
                    });
                } else {
                    updateStep(activeStep, {
                        questionSlideTextMap: hydratedMap,
                        materialSource: String(step.sourceSlidesUrl || 'slides'),
                        materialText: activeText || String(step.materialText || '')
                    });
                }
                return;
            }
        }
        const objectId = String(slidesManifest[slidesActiveIdx]?.objectId || '').trim();
        if (!objectId) return;
        const manifestText = String(slidesManifest[slidesActiveIdx]?.text || '').replace(/\r/g, '').trim();
        const map = getStepSlideTextMap(step);
        const fallbackText = step.type === 'sheet' ? step.sheetText : step.materialText;
        const next = String(map[objectId] || manifestText || fallbackText || '');
        setKeywordMaterialSource(step.type === 'question'
            ? String(step.sourceSlidesUrl || 'slides')
            : `sheet:${step.id}`);
        setKeywordMaterialText(next);
        setKeywordSelectedText('');
        setKeywordSelectionSpan(null);
        setActiveTarget('response');
        setEraseMode(false);
    }, [keywordSlidesMode, step?.id, step?.type, step?.sheetSlideTextMap, step?.questionSlideTextMap, step?.sheetText, step?.materialText, step?.sourceSlidesUrl, slidesManifest, slidesActiveIdx]);
    useEffect(() => {
        if (!keywordSlidesMode || !step || !['sheet', 'question'].includes(step.type)) return;
        const slide = slidesManifest[slidesActiveIdx];
        const objectId = String(slide?.objectId || '').trim();
        const slideNumber = Number(slide?.slideNumber || 0);
        if (!objectId || !slideNumber) return;
        const map = getStepSlideTextMap(step);
        const currentText = String(map[objectId] || slide?.text || '').trim();
        if (currentText || slidesTextHydrating) return;
        const presentationUrl = String(keywordSlidesUrl || '').trim();
        if (!presentationUrl) return;
        let cancelled = false;
        (async () => {
            setSlidesTextHydrating(true);
            try {
                const res = await fetch('/api/learning/slides/extract-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        presentationUrl,
                        slideSelection: String(slideNumber)
                    })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(String(data?.error || 'Extraction slide impossible'));
                const extractedSlide = Array.isArray(data?.slides) ? data.slides.find((row) => Number(row?.slideNumber || 0) === slideNumber) : null;
                const extractedText = String(extractedSlide?.text || data?.combinedText || '').replace(/^Slide\s+\d+\s*:\s*/i, '').trim();
                if (cancelled || !extractedText) return;
                setSlidesManifest((prev) => prev.map((row, idx) => (
                    idx === slidesActiveIdx ? { ...row, text: extractedText } : row
                )));
                slidesManifestCacheRef.current.set(`${presentationUrl}|all`, (slidesManifest || []).map((row, idx) => (
                    idx === slidesActiveIdx ? { ...row, text: idx === slidesActiveIdx ? extractedText : row.text } : row
                )));
                if (step.type === 'sheet') {
                    const nextMap = sanitizeSlideTextMap(step.sheetSlideTextMap);
                    nextMap[objectId] = extractedText;
                    updateStep(activeStep, { sheetSlideTextMap: nextMap, sheetText: extractedText });
                } else {
                    const nextMap = sanitizeSlideTextMap(step.questionSlideTextMap);
                    nextMap[objectId] = extractedText;
                    updateStep(activeStep, {
                        questionSlideTextMap: nextMap,
                        materialSource: String(step.sourceSlidesUrl || 'slides'),
                        materialText: extractedText
                    });
                }
            } catch (_) {
            } finally {
                if (!cancelled) setSlidesTextHydrating(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [keywordSlidesMode, keywordSlidesUrl, step?.id, step?.type, step?.sheetSlideTextMap, step?.questionSlideTextMap, step?.sourceSlidesUrl, slidesManifest, slidesActiveIdx, slidesTextHydrating, activeStep]);
    useEffect(() => {
        setSlideSectionNameDraft(currentSlideSectionName || '');
    }, [currentSlideSectionId, currentSlideSectionName]);
    useEffect(() => {
        const url = String(globalSheetSourceUrl || '').trim();
        if (!isGoogleSlidesUrl(url)) {
            setGlobalSlidesWarmup({ active: false, percent: 0, loaded: 0, total: 0, ready: false, error: '' });
            return;
        }
        if (slidesWarmupDoneRef.current.has(url)) {
            setGlobalSlidesWarmup((prev) => ({ ...prev, active: false, ready: true, error: '' }));
            return;
        }
        let aborted = false;
        const cacheKey = `${url}|all`;
        (async () => {
            try {
                setGlobalSlidesWarmup({ active: true, percent: 0, loaded: 0, total: 0, ready: false, error: '' });
                let rows = slidesManifestCacheRef.current.get(cacheKey);
                if (!Array.isArray(rows)) {
                    const res = await fetch('/api/learning/slides/manifest', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            presentationUrl: url,
                            slideSelection: '',
                            filterCondition: '',
                            includeThumbnails: false
                        })
                    });
                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(String(data?.error || 'Préchargement slides impossible'));
                    const pid = extractGoogleSlidesId(url);
                    rows = (Array.isArray(data?.slides) ? data.slides : []).map((r) => {
                        const objectId = String(r?.objectId || '').trim();
                        const slideNumber = String(r?.slideNumber || '').trim();
                        const proxyFromServer = String(r?.thumbnailProxyUrl || '').trim();
                        return {
                            ...r,
                            thumbnailProxyUrl: proxyFromServer || buildSlidesThumbnailProxyUrl(pid, objectId, slideNumber)
                        };
                    });
                    slidesManifestCacheRef.current.set(cacheKey, rows);
                }
                if (aborted) return;
                const targets = (rows || []).filter((r) => String(r?.objectId || '').trim());
                const total = targets.length;
                if (!total) {
                    slidesWarmupDoneRef.current.add(url);
                    setGlobalSlidesWarmup({ active: false, percent: 100, loaded: 0, total: 0, ready: true, error: '' });
                    return;
                }
                let loaded = 0;
                setGlobalSlidesWarmup({ active: true, percent: 0, loaded, total, ready: false, error: '' });
                const queue = [...targets];
                const workers = Array.from({ length: Math.min(6, queue.length) }).map(async () => {
                    while (queue.length && !aborted) {
                        const row = queue.shift();
                        if (!row) break;
                        await ensureSlideBlob(row);
                        loaded += 1;
                        if (aborted) return;
                        const percent = Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
                        setGlobalSlidesWarmup({ active: true, percent, loaded, total, ready: false, error: '' });
                    }
                });
                await Promise.all(workers);
                if (aborted) return;
                slidesWarmupDoneRef.current.add(url);
                setGlobalSlidesWarmup({ active: false, percent: 100, loaded: total, total, ready: true, error: '' });
            } catch (e) {
                if (aborted) return;
                setGlobalSlidesWarmup({ active: false, percent: 0, loaded: 0, total: 0, ready: false, error: String(e?.message || 'Préchargement impossible') });
            }
        })();
        return () => {
            aborted = true;
        };
    }, [globalSheetSourceUrl]);
    const setCurrentSlideSection = (sectionId = '') => {
        if (!step || step.type !== 'sheet' || !currentSlideObjectId) return;
        const sid = String(sectionId || '').trim();
        const map = sanitizeSlideSectionMap(step.sheetSlideSectionMap);
        if (sid) map[currentSlideObjectId] = sid;
        else delete map[currentSlideObjectId];
        updateStep(activeStep, { sheetSlideSectionMap: map });
    };
    const onSlideSectionSelect = (sectionId = '') => {
        const sid = String(sectionId || '').trim();
        if (!sid) {
            setCurrentSlideSection('');
            return;
        }
        const map = sanitizeSlideSectionMap(step?.sheetSlideSectionMap);
        const targetIdx = slidesManifest.findIndex((slide) => {
            const oid = String(slide?.objectId || '').trim();
            return oid && String(map[oid] || '') === sid;
        });
        if (targetIdx >= 0) {
            setSlidesActiveIdx(targetIdx);
            return;
        }
        setCurrentSlideSection(sid);
    };
    const createSlideSection = () => {
        const base = 'Nouveau';
        const existingNames = new Set((formData.sections || []).map((sec) => String(sec?.name || '').trim().toLowerCase()).filter(Boolean));
        let name = base;
        let idx = 2;
        while (existingNames.has(String(name).toLowerCase())) {
            name = `${base} ${idx}`;
            idx += 1;
        }
        const sid = `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        setFormData((prev) => {
            const sections = Array.isArray(prev.sections) ? [...prev.sections] : [];
            sections.push({ id: sid, name, order: sections.length, visible: true });
            return { ...prev, sections };
        });
        if (currentSlideObjectId) setCurrentSlideSection(sid);
        setSlideSectionNameDraft(name);
    };
    const deleteCurrentSlideSection = () => {
        const sid = String(currentSlideSectionId || '').trim();
        if (!sid) return;
        const currentSections = Array.isArray(formData.sections) ? formData.sections : [];
        if (currentSections.length <= 1) return alert("Impossible de supprimer la dernière section.");
        setFormData((prev) => {
            const nextSectionsRaw = (prev.sections || []).filter((s) => String(s?.id || '') !== sid);
            const nextSections = nextSectionsRaw.map((sec, i) => ({ ...sec, order: i }));
            const fallbackId = String(nextSections[0]?.id || '');
            const nextSteps = (prev.steps || []).map((s) => {
                if (!s) return s;
                const row = { ...s };
                if (String(row.sectionId || '') === sid && fallbackId) row.sectionId = fallbackId;
                if (row.type === 'sheet') {
                    const map = sanitizeSlideSectionMap(row.sheetSlideSectionMap);
                    Object.keys(map).forEach((oid) => {
                        if (String(map[oid] || '') === sid) delete map[oid];
                    });
                    row.sheetSlideSectionMap = map;
                }
                return row;
            });
            return { ...prev, sections: nextSections, steps: nextSteps };
        });
    };
    const saveSlideSectionName = async () => {
        if (!currentSlideSectionId) return;
        const nextName = String(slideSectionNameDraft || '').trim() || 'Nouveau';
        renameSection(currentSlideSectionId, nextName);
        setSlideSectionNameDraft(nextName);
        await saveCurrentStepDataNow();
    };
    const getSlidesPreferredStorageKey = (pid = '') => `learning_slides_pref_src_v1_${String(pid || '').trim()}`;
    const loadPreferredSlidesMap = (pid = '') => {
        const keyPid = String(pid || '').trim();
        if (!keyPid) return {};
        if (slidesPreferredSrcRef.current.pid === keyPid) return slidesPreferredSrcRef.current.map || {};
        let map = {};
        try {
            const raw = localStorage.getItem(getSlidesPreferredStorageKey(keyPid));
            const parsed = raw ? JSON.parse(raw) : {};
            if (parsed && typeof parsed === 'object') map = parsed;
        } catch (_) {}
        slidesPreferredSrcRef.current = { pid: keyPid, map };
        return map;
    };
    const savePreferredSlideSrc = (pid = '', objectId = '', src = '') => {
        const keyPid = String(pid || '').trim();
        const oid = String(objectId || '').trim();
        const chosen = String(src || '').trim();
        if (!keyPid || !oid || !chosen) return;
        const map = { ...loadPreferredSlidesMap(keyPid), [oid]: chosen };
        slidesPreferredSrcRef.current = { pid: keyPid, map };
        try {
            localStorage.setItem(getSlidesPreferredStorageKey(keyPid), JSON.stringify(map));
        } catch (_) {}
    };
    const getSlideImageCandidates = (slide = null) => {
        const s = slide || slidesManifest[slidesActiveIdx] || {};
        const objectId = String(s?.objectId || '').trim();
        const slideNumber = String(s?.slideNumber || '').trim();
        if (!keywordSlidesPresentationId || !objectId) return [];
        const proxy = String(s?.thumbnailProxyUrl || '').trim();
        const byProxy = proxy || buildSlidesThumbnailProxyUrl(keywordSlidesPresentationId, objectId, slideNumber);
        const byPublicFromManifest = String(s?.thumbnailPublicUrl || '').trim();
        const byPublicExport = `https://docs.google.com/presentation/d/${encodeURIComponent(keywordSlidesPresentationId)}/export/png?pageid=${encodeURIComponent(objectId)}`;
        const byPublicExportWithId = `https://docs.google.com/presentation/d/${encodeURIComponent(keywordSlidesPresentationId)}/export/png?id=${encodeURIComponent(keywordSlidesPresentationId)}&pageid=${encodeURIComponent(objectId)}`;
        const bySlideIndexExport = slideNumber
            ? `https://docs.google.com/presentation/d/${encodeURIComponent(keywordSlidesPresentationId)}/export/png?pageid=${encodeURIComponent(`p${slideNumber}`)}`
            : '';
        const unique = [...new Set([byProxy, byPublicFromManifest, byPublicExport, byPublicExportWithId, bySlideIndexExport].filter(Boolean))];
        const preferred = String(loadPreferredSlidesMap(keywordSlidesPresentationId)?.[objectId] || '').trim();
        if (!preferred) return unique;
        return [preferred, ...unique.filter((u) => u !== preferred)];
    };
    const fetchSlideBlobFromPersistentCache = async (src = '') => {
        const url = String(src || '').trim();
        if (!url) return null;
        const fetchDirect = async () => {
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) return null;
            const blob = await res.blob();
            if (!blob || !String(blob.type || '').toLowerCase().startsWith('image/')) return null;
            return blob;
        };
        if (typeof window === 'undefined' || !('caches' in window)) {
            try { return await fetchDirect(); } catch (_) { return null; }
        }
        try {
            const cache = await caches.open('learning-slides-thumb-v1');
            const req = new Request(url, { method: 'GET' });
            const cached = await cache.match(req);
            if (cached) {
                const b = await cached.blob();
                if (b && String(b.type || '').toLowerCase().startsWith('image/')) return b;
            }
            const res = await fetch(url, { cache: 'force-cache' });
            if (!res.ok) return null;
            try { await cache.put(req, res.clone()); } catch (_) {}
            const blob = await res.blob();
            if (!blob || !String(blob.type || '').toLowerCase().startsWith('image/')) return null;
            return blob;
        } catch (_) {
            try { return await fetchDirect(); } catch (__) { return null; }
        }
    };
    const ensureSlideBlob = async (slide = null) => {
        const s = slide || slidesManifest[slidesActiveIdx] || {};
        const objectId = String(s?.objectId || '').trim();
        if (!objectId) return false;
        if (String(slideBlobUrlByObjectIdRef.current?.[objectId] || '').trim()) return true;
        if (slideBlobFetchInFlightRef.current.has(objectId)) {
            try { return await slideBlobFetchInFlightRef.current.get(objectId); } catch (_) { return false; }
        }
        const run = (async () => {
            const candidates = getSlideImageCandidates(s);
            for (const src of candidates) {
                const blob = await fetchSlideBlobFromPersistentCache(src);
                if (!blob) continue;
                const localUrl = URL.createObjectURL(blob);
                setSlideBlobUrlByObjectId((prev) => {
                    const existing = String(prev?.[objectId] || '').trim();
                    if (existing && existing !== localUrl) {
                        try { URL.revokeObjectURL(existing); } catch (_) {}
                    }
                    const next = { ...(prev || {}), [objectId]: localUrl };
                    slideBlobUrlByObjectIdRef.current = next;
                    return next;
                });
                savePreferredSlideSrc(keywordSlidesPresentationId, objectId, src);
                return true;
            }
            return false;
        })();
        slideBlobFetchInFlightRef.current.set(objectId, run);
        try {
            return await run;
        } finally {
            slideBlobFetchInFlightRef.current.delete(objectId);
        }
    };
    const buildSlideImageSrc = (slide = null) => {
        const s = slide || slidesManifest[slidesActiveIdx] || {};
        const objectId = String(s?.objectId || '').trim();
        const blobSrc = String(slideBlobUrlByObjectId[objectId] || '').trim();
        if (blobSrc) return blobSrc;
        const candidates = getSlideImageCandidates(s);
        if (!candidates.length || !objectId) return '';
        const tryIdxRaw = Number(slidesImageTryByObjectId[objectId] || 0);
        const tryIdx = Math.max(0, Math.min(candidates.length - 1, tryIdxRaw));
        const base = String(candidates[tryIdx] || '').trim();
        const nonce = Number(slidesImageNonceByObjectId[objectId] || 0);
        if (!base) return '';
        const sep = base.includes('?') ? '&' : '?';
        return nonce > 0 ? `${base}${sep}r=${nonce}` : base;
    };
    const clearSlideRetryTimer = (objectId = '') => {
        const key = String(objectId || '').trim();
        if (!key) return;
        const t = slidesRetryTimerRef.current.get(key);
        if (t) clearTimeout(t);
        slidesRetryTimerRef.current.delete(key);
    };
    const handleSlideImageLoad = (slide = null) => {
        const s = slide || slidesManifest[slidesActiveIdx] || {};
        const objectId = String(s?.objectId || '').trim();
        if (!objectId) return;
        clearSlideRetryTimer(objectId);
    };
    const handleSlideImageError = (slide = null) => {
        const s = slide || slidesManifest[slidesActiveIdx] || {};
        const objectId = String(s?.objectId || '').trim();
        if (!objectId) return;
        ensureSlideBlob(s);
        const candidates = getSlideImageCandidates(s);
        const currTry = Number(slidesImageTryByObjectId[objectId] || 0);
        if (currTry < Math.max(0, candidates.length - 1)) {
            setSlidesImageTryByObjectId((prev) => ({ ...prev, [objectId]: currTry + 1 }));
            return;
        }
        clearSlideRetryTimer(objectId);
        const timer = setTimeout(() => {
            setSlidesImageTryByObjectId((prev) => ({ ...prev, [objectId]: 0 }));
            setSlidesImageNonceByObjectId((prev) => ({ ...prev, [objectId]: Date.now() }));
        }, 1400);
        slidesRetryTimerRef.current.set(objectId, timer);
    };
    useEffect(() => {
        const objectId = String(slidesManifest[slidesActiveIdx]?.objectId || '').trim();
        if (!objectId) return;
        setSlidesImageTryByObjectId((prev) => ({ ...prev, [objectId]: 0 }));
    }, [slidesManifest, slidesActiveIdx]);
    useEffect(() => {
        const rows = [
            slidesManifest[slidesActiveIdx - 1],
            slidesManifest[slidesActiveIdx],
            slidesManifest[slidesActiveIdx + 1]
        ].filter(Boolean);
        rows.forEach((row) => {
            ensureSlideBlob(row);
        });
    }, [slidesManifest, slidesActiveIdx, slidesImageTryByObjectId, slidesImageNonceByObjectId]);
    useEffect(() => {
        slideBlobUrlByObjectIdRef.current = slideBlobUrlByObjectId || {};
    }, [slideBlobUrlByObjectId]);
    useEffect(() => () => {
        const timers = slidesRetryTimerRef.current;
        timers.forEach((t) => clearTimeout(t));
        timers.clear();
        Object.values(slideBlobUrlByObjectIdRef.current || {}).forEach((u) => {
            try { URL.revokeObjectURL(String(u || '')); } catch (_) {}
        });
    }, []);

    const normalizeRanges = (ranges = [], textLen = 0) => {
        const clean = (ranges || [])
            .map((r) => ({
                start: Math.max(0, Math.min(textLen, Number(r?.start || 0))),
                end: Math.max(0, Math.min(textLen, Number(r?.end || 0)))
            }))
            .filter((r) => r.end > r.start)
            .sort((a, b) => a.start - b.start);
        const merged = [];
        clean.forEach((r) => {
            const last = merged[merged.length - 1];
            if (!last || r.start > last.end) merged.push({ ...r });
            else last.end = Math.max(last.end, r.end);
        });
        return merged;
    };
    const rangesToSnippets = (text = '', ranges = []) => {
        const source = String(text || '');
        return [...new Set(normalizeRanges(ranges, source.length)
            .map((r) => source.slice(r.start, r.end).replace(/\s+/g, ' ').trim())
            .filter(Boolean))];
    };
    const getCurrentResponseRanges = () => {
        if (!step) return [];
        if (step.type === 'question') return Array.isArray(step.questionPinkRanges) ? step.questionPinkRanges : [];
        if (step.type === 'video') return Array.isArray(step.videoPinkRanges) ? step.videoPinkRanges : [];
        if (step.type === 'sheet') return Array.isArray(step.sheetPinkRanges) ? step.sheetPinkRanges : [];
        return [];
    };
    const getCurrentZoneRanges = () => {
        if (!step) return [];
        if (step.type === 'question') return Array.isArray(step.questionZoneRanges) ? step.questionZoneRanges : [];
        if (step.type === 'video') return Array.isArray(step.videoZoneRanges) ? step.videoZoneRanges : [];
        if (step.type === 'sheet') return Array.isArray(step.sheetZoneRanges) ? step.sheetZoneRanges : [];
        return [];
    };
    const normalizeMarkers = (markers = [], textLen = 0) =>
        [...new Set((markers || [])
            .map((n) => Math.max(0, Math.min(textLen, Number(n))))
            .filter((n) => Number.isFinite(n) && n > 0 && n < textLen))]
            .sort((a, b) => a - b);
    const markersToRanges = (markers = [], textLen = 0) => {
        const cuts = [0, ...normalizeMarkers(markers, textLen), textLen];
        const ranges = [];
        for (let i = 0; i < cuts.length - 1; i += 1) {
            ranges.push({ start: cuts[i], end: cuts[i + 1] });
        }
        return normalizeRanges(ranges, textLen);
    };
    const getCurrentZoneMarkers = () => {
        if (!step) return [];
        const textLen = String(keywordMaterialText || '').length;
        if (step.type === 'question') {
            if (Array.isArray(step.questionZoneMarkers)) return normalizeMarkers(step.questionZoneMarkers, textLen);
            return normalizeMarkers((step.questionZoneRanges || []).map((r) => r?.end), textLen);
        }
        if (step.type === 'video') {
            if (Array.isArray(step.videoZoneMarkers)) return normalizeMarkers(step.videoZoneMarkers, textLen);
            return normalizeMarkers((step.videoZoneRanges || []).map((r) => r?.end), textLen);
        }
        if (step.type === 'sheet') {
            if (Array.isArray(step.sheetZoneMarkers)) return normalizeMarkers(step.sheetZoneMarkers, textLen);
            return normalizeMarkers((step.sheetZoneRanges || []).map((r) => r?.end), textLen);
        }
        return [];
    };
    const applyRangesToStep = ({ responseRanges = null, zoneRanges = null, zoneMarkers = null } = {}) => {
        if (!step) return;
        const source = String(keywordMaterialText || '');
        const finalResponseRanges = normalizeRanges(responseRanges ?? getCurrentResponseRanges(), source.length);
        const finalZoneMarkers = normalizeMarkers(zoneMarkers ?? getCurrentZoneMarkers(), source.length);
        const finalZoneRanges = normalizeRanges(zoneRanges ?? markersToRanges(finalZoneMarkers, source.length), source.length);
        const snippets = rangesToSnippets(source, finalResponseRanges);
        const zoneSnippets = rangesToSnippets(source, finalZoneRanges);
        const words = snippets
            .flatMap((snippet) => snippet.toLowerCase().split(/[^a-z0-9àâäéèêëîïôöùûüÿçœæ'-]+/i))
            .map((w) => w.trim())
            .filter((w) => w.length >= 3);
        if (step.type === 'question') {
            const keywordSet = new Set((Array.isArray(step.keywords) ? step.keywords : []).map((w) => String(w || '').toLowerCase()).filter(Boolean));
            words.forEach((w) => keywordSet.add(w));
            updateStep(activeStep, {
                questionPinkRanges: finalResponseRanges,
                questionZoneMarkers: finalZoneMarkers,
                questionZoneRanges: finalZoneRanges,
                redHighlights: snippets,
                zoneHighlights: zoneSnippets,
                keywords: [...keywordSet],
                materialSource: keywordMaterialSource,
                materialText: keywordMaterialText
            });
            return;
        }
        if (step.type === 'video') {
            const keywordSet = new Set((Array.isArray(step.videoKeywords) ? step.videoKeywords : []).map((w) => String(w || '').toLowerCase()).filter(Boolean));
            words.forEach((w) => keywordSet.add(w));
            updateStep(activeStep, {
                videoPinkRanges: finalResponseRanges,
                videoZoneMarkers: finalZoneMarkers,
                videoZoneRanges: finalZoneRanges,
                videoPinkHighlights: snippets,
                videoZoneHighlights: zoneSnippets,
                videoKeywords: [...keywordSet],
                videoTranscript: keywordMaterialText
            });
            return;
        }
        if (step.type === 'sheet') {
            const keywordSet = new Set((Array.isArray(step.sheetKeywords) ? step.sheetKeywords : []).map((w) => String(w || '').toLowerCase()).filter(Boolean));
            words.forEach((w) => keywordSet.add(w));
            updateStep(activeStep, {
                sheetPinkRanges: finalResponseRanges,
                sheetZoneMarkers: finalZoneMarkers,
                sheetZoneRanges: finalZoneRanges,
                sheetPinkHighlights: snippets,
                sheetZoneHighlights: zoneSnippets,
                sheetKeywords: [...keywordSet],
                sheetText: keywordMaterialText
            });
        }
    };
    const subtractRange = (ranges = [], cut = null, textLen = 0) => {
        const normalized = normalizeRanges(ranges, textLen);
        if (!cut) return normalized;
        const span = { start: Math.max(0, cut.start || 0), end: Math.max(0, cut.end || 0) };
        if (span.end <= span.start) return normalized;
        const next = [];
        normalized.forEach((r) => {
            if (span.end <= r.start || span.start >= r.end) {
                next.push(r);
                return;
            }
            if (span.start > r.start) next.push({ start: r.start, end: span.start });
            if (span.end < r.end) next.push({ start: span.end, end: r.end });
        });
        return normalizeRanges(next, textLen);
    };
    const getZoneBounds = (zoneIdx = 0, markers = [], textLen = 0) => {
        const points = [0, ...normalizeMarkers(markers, textLen), textLen];
        const idx = Math.max(0, Math.min(points.length - 2, Number(zoneIdx || 0)));
        return { start: points[idx], end: points[idx + 1] };
    };
    const highlightTextWithPink = (text = '', responseRanges = [], zoneMarkers = [], activeZoneIdx = null) => {
        const source = String(text || '');
        const pink = normalizeRanges(responseRanges, source.length);
        const markers = normalizeMarkers(zoneMarkers, source.length);
        const zone = Number.isFinite(activeZoneIdx) ? getZoneBounds(activeZoneIdx, markers, source.length) : null;
        if (!source || (pink.length === 0 && markers.length === 0 && !zone)) return source;
        const points = [0, source.length];
        pink.forEach((r) => { points.push(r.start, r.end); });
        markers.forEach((m) => { points.push(m); });
        if (zone) points.push(zone.start, zone.end);
        const cuts = [...new Set(points)].sort((a, b) => a - b);
        const out = [];
        const markerSet = new Set(markers);
        for (let i = 0; i < cuts.length - 1; i += 1) {
            const start = cuts[i];
            const end = cuts[i + 1];
            if (markerSet.has(start)) {
                out.push(<span key={`mk_${start}`} className="inline-block h-[1.1em] align-middle border-l-4 border-red-600 mx-[2px]" />);
            }
            if (end <= start) continue;
            const chunk = source.slice(start, end);
            const inPink = pink.some((r) => start >= r.start && end <= r.end);
            const inZone = !!zone && start >= zone.start && end <= zone.end;
            if (!inPink && !inZone) {
                out.push(<span key={`txt_${start}`}>{chunk}</span>);
            } else if (inPink && inZone) {
                out.push(<mark key={`both_${start}`} className="bg-fuchsia-200 text-fuchsia-900 rounded px-[2px] border border-indigo-300">{chunk}</mark>);
            } else if (inPink) {
                out.push(<mark key={`pink_${start}`} className="bg-pink-200 text-pink-900 rounded px-[2px]">{chunk}</mark>);
            } else {
                out.push(<mark key={`zone_${start}`} className="bg-slate-200 text-slate-900 rounded px-[2px] border border-slate-300">{chunk}</mark>);
            }
        }
        if (markerSet.has(source.length)) out.push(<span key="mk_end" className="inline-block h-[1.1em] align-middle border-l-4 border-red-600 mx-[2px]" />);
        return out;
    };

    const applyPinkSnippets = (incoming = []) => {
        const source = String(keywordMaterialText || '');
        if (!source || !step) return;
        const snippets = [...new Set((incoming || []).map((x) => String(x || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
        if (!snippets.length) return;
        const baseRanges = normalizeRanges(getCurrentResponseRanges(), source.length);
        const next = [...baseRanges];
        snippets.forEach((snippet) => {
            const needle = snippet.toLowerCase();
            let from = 0;
            while (from < source.length) {
                const idx = source.toLowerCase().indexOf(needle, from);
                if (idx === -1) break;
                next.push({ start: idx, end: idx + snippet.length });
                from = idx + Math.max(1, snippet.length);
            }
        });
        applyRangesToStep({ responseRanges: next });
    };

    const loose = (value = '') =>
        String(value || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s'-]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    const removePinkSnippet = (snippetRaw = '', fallbackLast = false, target = 'response') => {
        if (!step) return;
        const source = String(keywordMaterialText || '');
        const ranges = normalizeRanges(target === 'zone' ? getCurrentZoneRanges() : getCurrentResponseRanges(), source.length);
        const snippet = loose(snippetRaw);
        if (!ranges.length) return;
        if (!snippet && fallbackLast) {
            if (target === 'zone') applyRangesToStep({ zoneRanges: ranges.slice(0, -1) });
            else applyRangesToStep({ responseRanges: ranges.slice(0, -1) });
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            return;
        }
        if (!snippet) return;
        const next = [];
        ranges.forEach((r) => {
            const chunk = source.slice(r.start, r.end);
            const lowChunk = loose(chunk);
            const pos = lowChunk.indexOf(snippet);
            if (pos === -1) {
                next.push(r);
                return;
            }
            const rawPos = chunk.toLowerCase().indexOf(String(snippetRaw || '').toLowerCase());
            const splitAt = rawPos >= 0 ? rawPos : pos;
            const cutStart = r.start + splitAt;
            const cutEnd = Math.min(r.end, cutStart + String(snippetRaw || '').length);
            if (cutStart > r.start) next.push({ start: r.start, end: cutStart });
            if (cutEnd < r.end) next.push({ start: cutEnd, end: r.end });
        });
        if (target === 'zone') applyRangesToStep({ zoneRanges: next });
        else applyRangesToStep({ responseRanges: next });
        setKeywordSelectedText('');
        setKeywordSelectionSpan(null);
    };

    const runAutoHighlight = async () => {
        if (!step) return;
        const text = String(keywordMaterialText || '').trim();
        if (!text) return alert("Ajoute d'abord du texte source.");
        setAutoHighlighting(true);
        try {
            const res = await fetch('/api/learning/auto-highlight', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, max: 10, teacherId })
            });
            const data = await res.json();
            if (!res.ok || !Array.isArray(data?.snippets)) throw new Error(data?.error || 'Auto impossible');
            applyPinkSnippets(data.snippets);
        } catch (e) {
            alert(`Auto impossible: ${e.message}`);
        }
        setAutoHighlighting(false);
    };

    const captureKeywordSelection = () => {
        const root = keywordSelectionRef.current;
        const sel = window.getSelection ? window.getSelection() : null;
        if (!root || !sel || sel.rangeCount === 0) {
            setKeywordSelectedText('');
            return;
        }
        const range = sel.getRangeAt(0);
        const inRoot = root.contains(range.commonAncestorContainer);
        const txt = inRoot ? String(sel.toString() || '') : '';
        const cleaned = txt.replace(/\s+/g, ' ').trim();
        setKeywordSelectedText(cleaned);
        if (!cleaned) return;
        const pre = range.cloneRange();
        pre.selectNodeContents(root);
        pre.setEnd(range.startContainer, range.startOffset);
        const start = pre.toString().length;
        const end = start + txt.length;
        const span = { start, end };
        setKeywordSelectionSpan(span);
    };

    const getLiveSelectionInKeywordBox = () => {
        const root = keywordSelectionRef.current;
        const sel = window.getSelection ? window.getSelection() : null;
        if (!root || !sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return null;
        const txt = String(sel.toString() || '');
        const cleaned = txt.replace(/\s+/g, ' ').trim();
        if (!cleaned) return null;
        const pre = range.cloneRange();
        pre.selectNodeContents(root);
        pre.setEnd(range.startContainer, range.startOffset);
        const start = pre.toString().length;
        const end = start + txt.length;
        if (end <= start) return null;
        return { text: cleaned, span: { start, end } };
    };
    const getLiveCursorPosInKeywordBox = () => {
        const root = keywordSelectionRef.current;
        const sel = window.getSelection ? window.getSelection() : null;
        if (!root || !sel || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return null;
        const pre = range.cloneRange();
        pre.selectNodeContents(root);
        pre.setEnd(range.startContainer, range.startOffset);
        const sourceLen = String(keywordMaterialText || '').length;
        const pos = pre.toString().length;
        return Math.max(0, Math.min(sourceLen, pos));
    };
    const removeMarkerAtCursor = () => {
        const sourceLen = String(keywordMaterialText || '').length;
        const pos = getLiveCursorPosInKeywordBox();
        if (!Number.isFinite(pos)) return false;
        const markers = normalizeMarkers(getCurrentZoneMarkers(), sourceLen);
        if (markers.length === 0) return false;
        let target = markers.find((m) => m === pos);
        if (!Number.isFinite(target)) {
            target = markers.find((m) => Math.abs(m - pos) <= 1);
        }
        if (!Number.isFinite(target)) return false;
        const next = markers.filter((m) => m !== target);
        applyRangesToStep({ zoneMarkers: next });
        return true;
    };
    const handleKeywordEditorKeyDown = (e) => {
        const key = String(e.key || '').toLowerCase();
        if (key !== 'delete' && key !== 'backspace') return;
        if (removeMarkerAtCursor()) {
            e.preventDefault();
            e.stopPropagation();
        }
    };

    const applyCurrentSelectionForMode = (target = activeTarget, remove = eraseMode) => {
        const live = getLiveSelectionInKeywordBox();
        const selectionSpan = live?.span || keywordSelectionSpan;
        if (!selectionSpan) return;
        const selectionText = live?.text || String(keywordSelectedText || '').trim();
        if (selectionText) setKeywordSelectedText(selectionText);
        setKeywordSelectionSpan(selectionSpan);
        const sourceLen = String(keywordMaterialText || '').length;
        if (remove) {
            if (target === 'zone') {
                const nextZone = subtractRange(getCurrentZoneRanges(), selectionSpan, sourceLen);
                applyRangesToStep({ zoneRanges: nextZone });
            } else {
                const nextResp = subtractRange(getCurrentResponseRanges(), selectionSpan, sourceLen);
                applyRangesToStep({ responseRanges: nextResp });
            }
            setKeywordSelectedText('');
            setKeywordSelectionSpan(null);
            return;
        }
        if (target === 'zone') {
            const currentZone = normalizeRanges(getCurrentZoneRanges(), sourceLen);
            applyRangesToStep({ zoneRanges: [...currentZone, selectionSpan] });
        } else {
            const currentResp = normalizeRanges(getCurrentResponseRanges(), sourceLen);
            applyRangesToStep({ responseRanges: [...currentResp, selectionSpan] });
        }
    };
    const onCutAction = () => {
        const sourceLen = String(keywordMaterialText || '').length;
        const pos = getLiveCursorPosInKeywordBox();
        if (!Number.isFinite(pos) || pos <= 0 || pos >= sourceLen) return;
        const markers = normalizeMarkers(getCurrentZoneMarkers(), sourceLen);
        if (markers.includes(pos)) return;
        applyRangesToStep({ zoneMarkers: [...markers, pos] });
    };
    const onNextAction = () => {
        const sourceLen = String(keywordMaterialText || '').length;
        const markers = normalizeMarkers(getCurrentZoneMarkers(), sourceLen);
        const zoneCount = markers.length + 1;
        if (zoneCount <= 0) return;
        setKeywordActiveZoneIdx((prev) => Number.isFinite(prev) ? ((prev + 1) % zoneCount) : 0);
    };
    const getCurrentSectionQuestionsMap = () => {
        if (!step) return {};
        if (step.type === 'question') {
            const own = getQuestionSectionMapFromAnyStep(step);
            if (Object.keys(own).length > 0) return own;
            const sourceInfo = getForcedQuestionSourceForIndex(activeStep);
            const sourceStep = sourceInfo?.stepId
                ? (formData.steps || []).find((s) => String(s?.id || '') === String(sourceInfo.stepId))
                : null;
            const fallbackMap = getQuestionSectionMapFromAnyStep(sourceStep);
            return (fallbackMap && typeof fallbackMap === 'object') ? fallbackMap : {};
        }
        if (step.type === 'video' || step.type === 'sheet') return getQuestionSectionMapFromAnyStep(step);
        return {};
    };
    const updateCurrentSectionQuestionsMap = (nextMap = {}) => {
        if (!step) return;
        if (step.type === 'question') {
            updateStep(activeStep, { questionSectionQuestions: nextMap });
            return;
        }
        if (step.type === 'video') {
            updateStep(activeStep, { videoSectionQuestions: nextMap });
            return;
        }
        if (step.type === 'sheet') {
            updateStep(activeStep, { sheetSectionQuestions: nextMap });
        }
    };
    const getActiveZoneQuestions = () => {
        const idx = Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0;
        const map = getCurrentSectionQuestionsMap();
        const rows = map[String(idx)];
        return Array.isArray(rows) ? rows : [];
    };
    const getZoneCount = () => {
        const sourceLen = String(keywordMaterialText || '').length;
        const markers = normalizeMarkers(getCurrentZoneMarkers(), sourceLen);
        return Math.max(1, markers.length + 1);
    };
    const getZoneQuestions = (zoneIdx = 0) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = map[String(zoneIdx)];
        return Array.isArray(rows) ? rows : [];
    };
    const getTotalZoneQuestions = () => {
        const map = getCurrentSectionQuestionsMap();
        return Object.values(map).reduce((acc, rows) => {
            if (!Array.isArray(rows)) return acc;
            return acc + rows.length;
        }, 0);
    };
    const updateZoneQuestion = (zoneIdx = 0, rowIdx = 0, patch = {}) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        rows[rowIdx] = { ...rows[rowIdx], ...patch };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
    };
    const renumberZoneQuestion = (zoneIdx = 0, rowIdx = 0) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        const currentText = String(rows[rowIdx]?.question || rows[rowIdx]?.q || '');
        const nextText = renumberRemainingMainPoints(currentText);
        rows[rowIdx] = { ...rows[rowIdx], question: nextText, q: nextText };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
    };
    const removeZoneKeyword = (zoneIdx = 0, rowIdx = 0, keywordIdx = 0) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        const kws = Array.isArray(rows[rowIdx].expectedKeywords) ? [...rows[rowIdx].expectedKeywords] : [];
        kws.splice(keywordIdx, 1);
        rows[rowIdx] = { ...rows[rowIdx], expectedKeywords: kws };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
        if (
            selectedZoneKeyword
            && Number(selectedZoneKeyword.zoneIdx) === Number(zoneIdx)
            && Number(selectedZoneKeyword.rowIdx) === Number(rowIdx)
            && Number(selectedZoneKeyword.keywordIdx) === Number(keywordIdx)
        ) {
            setSelectedZoneKeyword(null);
            setSynonymDraft('');
        }
    };
    const addZoneKeyword = (zoneIdx = 0, rowIdx = 0) => {
        const key = `${zoneIdx}_${rowIdx}`;
        const value = String(zoneKeywordDrafts[key] || '').trim();
        if (!value) return;
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        const kws = Array.isArray(rows[rowIdx].expectedKeywords) ? [...rows[rowIdx].expectedKeywords] : [];
        if (!kws.includes(value)) kws.push(value);
        rows[rowIdx] = { ...rows[rowIdx], expectedKeywords: kws };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
        setZoneKeywordDrafts((prev) => ({ ...prev, [key]: '' }));
    };
    const addZoneQuestion = (zoneIdx = 0) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        rows.push({ q: '', question: '', expectedAnswer: '', expectedKeywords: [], validationType: 'fill_blanks' });
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
    };
    const importQuestionsForZone = (zoneIdx = 0) => {
        const parsed = parseManualQuestionBlocks(bulkQuestionImport);
        if (!parsed.length) {
            alert("Aucun bloc valide. Utilise par exemple : Question:");
            return;
        }
        const map = getCurrentSectionQuestionsMap();
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: parsed });
        setKeywordActiveZoneIdx(zoneIdx);
        setBulkQuestionImport('');
        setShowBulkQuestionImport(false);
    };
    const removeZoneQuestion = (zoneIdx = 0, rowIdx = 0) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        rows.splice(rowIdx, 1);
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
    };
    const addSynonymToZoneKeyword = (zoneIdx = 0, rowIdx = 0, keywordIdx = 0, synonymRaw = '') => {
        const synonym = String(synonymRaw || '').trim();
        if (!synonym) return;
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        const kws = Array.isArray(rows[rowIdx].expectedKeywords) ? [...rows[rowIdx].expectedKeywords] : [];
        const current = String(kws[keywordIdx] || '').trim();
        if (!current) return;
        const parts = [...new Set(current.split('=').map((p) => String(p || '').trim()).filter(Boolean))];
        if (!parts.includes(synonym)) parts.push(synonym);
        kws[keywordIdx] = parts.join('=');
        rows[rowIdx] = { ...rows[rowIdx], expectedKeywords: kws };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
        setSynonymDraft('');
    };
    const updateActiveZoneQuestion = (rowIdx, patch = {}) => {
        const zoneIdx = Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0;
        updateZoneQuestion(zoneIdx, rowIdx, patch);
    };
    const keepQuestionTextareaSpace = (event, value = '', onValueChange = () => {}) => {
        const target = event.currentTarget;
        const source = String(value || '');
        const start = Number.isFinite(target.selectionStart) ? target.selectionStart : source.length;
        const end = Number.isFinite(target.selectionEnd) ? target.selectionEnd : start;
        if (event.key === 'Tab' && !event.shiftKey) {
            const lineStart = source.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
            const currentLine = source.slice(lineStart, start);
            const prefixMatch = currentLine.match(/^(\s*)\d+\s*[-.)]\s*/);
            if (prefixMatch) {
                event.preventDefault();
                event.stopPropagation();
                const replacement = `${prefixMatch[1]}- `;
                const prefixEnd = lineStart + prefixMatch[0].length;
                const nextValue = `${source.slice(0, lineStart)}${replacement}${source.slice(prefixEnd)}`;
                const delta = replacement.length - prefixMatch[0].length;
                onValueChange(nextValue);
                window.requestAnimationFrame(() => {
                    try {
                        target.selectionStart = Math.max(lineStart + replacement.length, start + delta);
                        target.selectionEnd = Math.max(lineStart + replacement.length, end + delta);
                    } catch (_) {}
                });
                return;
            }
        }
        if (event.key !== ' ') {
            event.stopPropagation();
            return;
        }
        event.preventDefault();
        event.stopPropagation();
        const nextValue = `${source.slice(0, start)} ${source.slice(end)}`;
        onValueChange(nextValue);
        window.requestAnimationFrame(() => {
            try {
                target.selectionStart = start + 1;
                target.selectionEnd = start + 1;
            } catch (_) {}
        });
    };
    const keepQuestionEditorKey = (
        event,
        value = '',
        onValueChange = () => {},
        onKeywordValueChange = onValueChange
    ) => {
        const isBoldShortcut = (event.metaKey || event.ctrlKey)
            && !event.altKey
            && String(event.key || '').toLowerCase() === 'b';
        if (!isBoldShortcut) {
            keepQuestionTextareaSpace(event, value, onValueChange);
            return;
        }

        const target = event.currentTarget;
        const source = String(value || '');
        const start = Number.isFinite(target.selectionStart) ? target.selectionStart : source.length;
        const end = Number.isFinite(target.selectionEnd) ? target.selectionEnd : start;
        event.preventDefault();
        event.stopPropagation();
        if (start === end) return;

        const alreadyQuoted = start > 0
            && end < source.length
            && /[\"“«]/.test(source[start - 1])
            && /[\"”»]/.test(source[end]);
        const nextValue = alreadyQuoted
            ? source
            : `${source.slice(0, start)}\"${source.slice(start, end)}\"${source.slice(end)}`;
        onKeywordValueChange(nextValue);
        window.requestAnimationFrame(() => {
            try {
                target.focus();
                target.selectionStart = alreadyQuoted ? start : start + 1;
                target.selectionEnd = alreadyQuoted ? end : end + 1;
            } catch (_) {}
        });
    };
    const keepQuestionInputSpace = keepQuestionTextareaSpace;
    const removeActiveZoneKeyword = (rowIdx, keywordIdx) => {
        const zoneIdx = Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0;
        removeZoneKeyword(zoneIdx, rowIdx, keywordIdx);
    };
    const updateZoneExpectedKeyword = (zoneIdx = 0, rowIdx = 0, keywordIdx = 0, value = '') => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        const kws = Array.isArray(rows[rowIdx].expectedKeywords) ? [...rows[rowIdx].expectedKeywords] : [];
        kws[keywordIdx] = value;
        rows[rowIdx] = { ...rows[rowIdx], expectedKeywords: kws };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
    };
    const addZoneExpectedKeywordField = (zoneIdx = 0, rowIdx = 0) => {
        const map = getCurrentSectionQuestionsMap();
        const rows = Array.isArray(map[String(zoneIdx)]) ? [...map[String(zoneIdx)]] : [];
        if (!rows[rowIdx]) return;
        const kws = Array.isArray(rows[rowIdx].expectedKeywords) ? [...rows[rowIdx].expectedKeywords] : [];
        kws.push('');
        rows[rowIdx] = { ...rows[rowIdx], expectedKeywords: kws };
        updateCurrentSectionQuestionsMap({ ...map, [String(zoneIdx)]: rows });
    };
    const updatePairExpectedKeyword = (rowIdx = 0, keywordIdx = 0, value = '') => {
        const rows = [...getQuestionPairRowsForEditor()];
        const current = rows[rowIdx] || { question: '', answer: '', expectedKeywords: [] };
        const kws = Array.isArray(current.expectedKeywords) ? [...current.expectedKeywords] : [];
        kws[keywordIdx] = value;
        rows[rowIdx] = { ...current, expectedKeywords: kws };
        updateQuestionPairsDraft(rows);
    };
    const addPairExpectedKeywordField = (rowIdx = 0) => {
        const rows = [...getQuestionPairRowsForEditor()];
        const current = rows[rowIdx] || { question: '', answer: '', expectedKeywords: [] };
        const kws = Array.isArray(current.expectedKeywords) ? [...current.expectedKeywords] : [];
        kws.push('');
        rows[rowIdx] = { ...current, expectedKeywords: kws };
        updateQuestionPairsDraft(rows);
    };
    const addActiveZoneKeyword = (rowIdx) => {
        const zoneIdx = Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0;
        addZoneKeyword(zoneIdx, rowIdx);
    };
    const addActiveZoneQuestion = () => {
        const zoneIdx = Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0;
        addZoneQuestion(zoneIdx);
    };
    const removeActiveZoneQuestion = (rowIdx) => {
        const zoneIdx = Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0;
        removeZoneQuestion(zoneIdx, rowIdx);
    };
    const renderSectionQuestionEditor = (sectionIdx, q, i) => {
        const isQuestionRecording = recordingQuestionCell
            && Number(recordingQuestionCell.zoneIdx) === Number(sectionIdx)
            && Number(recordingQuestionCell.rowIdx) === Number(i)
            && recordingQuestionCell.field === 'question';
        const questionValue = String(q?.question || q?.q || '');
        const expectedAnswers = Array.isArray(q?.expectedKeywords) && q.expectedKeywords.length > 0
            ? q.expectedKeywords
            : [''];
        return (
            <div key={`db_q_${sectionIdx}_${i}`} className="relative rounded-lg border border-slate-200 bg-white p-2 pr-10">
                <button
                    type="button"
                    className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-[15px] font-black text-red-600 shadow-sm hover:bg-red-600 hover:text-white"
                    onClick={() => removeZoneQuestion(sectionIdx, i)}
                    title="Supprimer cette question"
                    aria-label={`Supprimer question ${i + 1}`}
                >
                    ✕
                </button>
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="text-[11px] font-black uppercase text-indigo-700">
                        Question {i + 1}
                    </div>
                    <select
                        className="v84-ans-input !w-auto !py-1 !text-[11px] !font-black"
                        value={q?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open'}
                        onChange={(e) => updateZoneQuestion(sectionIdx, i, { validationType: e.target.value })}
                    >
                        <option value="open">Question ciblée</option>
                        <option value="fill_blanks">Texte à trous</option>
                    </select>
                </div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-black uppercase text-slate-400">
                        {q?.validationType === 'fill_blanks' ? 'Texte — réponses entre guillemets' : 'Question'}
                    </div>
                    {q?.validationType === 'fill_blanks' && (
                        <button
                            type="button"
                            className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700 hover:bg-indigo-600 hover:text-white"
                            onClick={() => renumberZoneQuestion(sectionIdx, i)}
                        >
                            1-2-3 Renuméroter
                        </button>
                    )}
                    {q?.validationType === 'fill_blanks' && (
                        <button
                            type="button"
                            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase text-violet-700 hover:bg-violet-600 hover:text-white"
                            onClick={() => setTestingFillBlankKey((current) => current === `zone-${sectionIdx}-${i}` ? '' : `zone-${sectionIdx}-${i}`)}
                        >
                            👁 Tester élève
                        </button>
                    )}
                </div>
                <div className="flex gap-1">
                    {q?.validationType === 'fill_blanks' ? (
                        <FillBlankSyntaxTextarea
                            rows={2}
                            value={questionValue}
                            onChange={(e) => updateZoneQuestion(sectionIdx, i, { question: e.target.value, q: e.target.value })}
                            onKeyDown={(e) => keepQuestionEditorKey(
                                e,
                                questionValue,
                                (nextValue) => updateZoneQuestion(sectionIdx, i, { question: nextValue, q: nextValue }),
                                (nextValue) => updateZoneQuestion(sectionIdx, i, { question: nextValue, q: nextValue, validationType: 'fill_blanks' })
                            )}
                            placeholder={'Les soldats vivent dans des "tranchées".'}
                        />
                    ) : (
                        <textarea
                            rows={2}
                            className="v84-q-input !text-[13px] !leading-snug"
                            value={questionValue}
                            onChange={(e) => updateZoneQuestion(sectionIdx, i, { question: e.target.value, q: e.target.value })}
                            onKeyDown={(e) => keepQuestionEditorKey(
                                e,
                                questionValue,
                                (nextValue) => updateZoneQuestion(sectionIdx, i, { question: nextValue, q: nextValue }),
                                (nextValue) => updateZoneQuestion(sectionIdx, i, { question: nextValue, q: nextValue, validationType: 'fill_blanks' })
                            )}
                            placeholder={`Question ${i + 1}`}
                        />
                    )}
                    <button
                        type="button"
                        className={`v84-res-btn upload !px-2 !py-1 !min-w-0 ${isQuestionRecording ? 'bg-red-500 text-white' : ''}`}
                        onClick={() => startQuestionCellDictation(i, 'question', sectionIdx)}
                        title="Dicter la question"
                    >
                        🎙️
                    </button>
                </div>
                {q?.validationType === 'fill_blanks' && testingFillBlankKey === `zone-${sectionIdx}-${i}` && (
                    <FillBlankStudentTester key={`test_zone_${sectionIdx}_${i}_${questionValue}`} question={questionValue} onClose={() => setTestingFillBlankKey('')} />
                )}
                {q?.validationType !== 'fill_blanks' && <div className="mt-3">
                    <div className="text-[11px] font-black uppercase text-slate-400 mb-1">Réponses attendues</div>
                    <div className="space-y-2">
                        {expectedAnswers.map((answerValue, answerIdx) => {
                            const isAnswerRecording = recordingQuestionCell
                                && Number(recordingQuestionCell.zoneIdx) === Number(sectionIdx)
                                && Number(recordingQuestionCell.rowIdx) === Number(i)
                                && recordingQuestionCell.field === 'expectedKeyword';
                            return (
                                <div key={`expected_${sectionIdx}_${i}_${answerIdx}`} className="flex gap-1">
                                    <input
                                        className={`v84-ans-input !text-[13px] !py-2 ${String(answerValue || '').includes('+') ? '!font-black !text-blue-600' : ''}`}
                                        value={String(answerValue || '')}
                                        onChange={(e) => updateZoneExpectedKeyword(sectionIdx, i, answerIdx, e.target.value)}
                                        onKeyDown={(e) => keepQuestionInputSpace(e, String(answerValue || ''), (nextValue) => updateZoneExpectedKeyword(sectionIdx, i, answerIdx, nextValue))}
                                        placeholder={`Expression attendue ${answerIdx + 1}`}
                                    />
                                    <button
                                        type="button"
                                        className={`v84-res-btn upload !px-2 !py-1 !min-w-0 ${isAnswerRecording ? 'bg-red-500 text-white' : ''}`}
                                        onClick={() => startQuestionCellDictation(i, `expectedKeyword:${answerIdx}`, sectionIdx)}
                                        title="Dicter cette réponse attendue"
                                    >
                                        🎙️
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-del-btn !h-auto !w-8"
                                        onClick={() => removeZoneKeyword(sectionIdx, i, answerIdx)}
                                        title="Supprimer cette réponse attendue"
                                    >
                                        ✕
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    <button
                        type="button"
                        className="v84-res-btn upload !mt-2 !px-3 !py-2 !text-[11px]"
                        onClick={() => addZoneExpectedKeywordField(sectionIdx, i)}
                    >
                        + Réponse attendue
                    </button>
                </div>}
            </div>
        );
    };
    const saveCurrentStepDataNow = async () => {
        if (!step) return;
        if (!formData?._id) {
            alert("Étape enregistrée localement. Elle sera sauvegardée lors de la publication.");
            return;
        }
        setSavingStepData(true);
        try {
            const patch = {};
            if (step.type === 'question') {
                patch.materialText = String(step.materialText || '');
                patch.questionSlideTextMap = sanitizeSlideTextMap(step.questionSlideTextMap);
                patch.questionAnswerPairs = Array.isArray(step.questionAnswerPairs) ? step.questionAnswerPairs : [];
                patch.questionSectionQuestions = step.questionSectionQuestions || {};
            } else if (step.type === 'sheet') {
                patch.sheetText = String(step.sheetText || '');
                patch.sheetTextHtml = String(step.sheetTextHtml || '');
                patch.sheetSlideSectionMap = sanitizeSlideSectionMap(step.sheetSlideSectionMap);
                patch.sheetSlideTextMap = sanitizeSlideTextMap(step.sheetSlideTextMap);
            } else if (step.type === 'video') {
                patch.videoTranscript = String(step.videoTranscript || '');
                patch.startSec = Math.max(0, Number(step.startSec || 0));
                patch.endSec = Math.max(0, Number(step.endSec || 0));
            }
            const res = await fetch(`/api/learning/${encodeURIComponent(String(formData._id))}/step-data`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stepId: String(step.id || ''),
                    patch,
                    stepSnapshot: { ...step, ...patch },
                    sections: formData.sections || []
                })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur sauvegarde');
            alert("Étape enregistrée.");
        } catch (e) {
            alert(`Sauvegarde impossible: ${e.message}`);
        }
        setSavingStepData(false);
    };
    const importSheetFile = async (file) => {
        if (!file || !step || step.type !== 'sheet') return;
        setImportingSheet(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch('/api/games/upload-asset', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok || !data?.url) throw new Error(data?.error || "Erreur import");
            updateStep(activeStep, {
                sheetUrl: String(data.url || ''),
                sheetText: '',
                sheetTextHtml: '',
                sheetSlideTextMap: {}
            });
        } catch (err) {
            alert(`Import fiche impossible: ${err.message || 'Erreur réseau'}`);
        }
        setImportingSheet(false);
    };
    const handleImportSheetFile = async (e) => {
        const file = e?.target?.files?.[0];
        await importSheetFile(file);
        if (e?.target) e.target.value = null;
    };
    const handleSheetMediaFile = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file || !step || step.type !== 'sheet') return;
        if (!/^(audio|video)\//.test(String(file.type || ''))) {
            alert('Choisis un MP3 ou un fichier audio.');
            if (event?.target) event.target.value = null;
            return;
        }
        setUploadingSheetMedia(true);
        try {
            const data = new FormData();
            data.append('file', file);
            const response = await fetch('/api/learning/media/upload', { method: 'POST', body: data });
            const result = await response.json();
            if (!response.ok || !result?.url) throw new Error(result?.error || 'Import impossible');
            const existing = Array.isArray(step.sheetMediaItems) ? step.sheetMediaItems : (step.sheetMediaUrl ? [{
                id: uid(), url: step.sheetMediaUrl, name: step.sheetMediaName, type: step.sheetMediaType,
                startSec: step.sheetMediaStartSec || 0, endSec: step.sheetMediaEndSec || 0
            }] : []);
            updateStep(activeStep, {
                sheetMediaItems: [...existing, {
                    id: uid(), url: result.url, name: result.name || file.name, type: result.mimeType || file.type, startSec: 0, endSec: 0
                }],
                sheetMediaUrl: '', sheetMediaName: '', sheetMediaType: '', sheetMediaStartSec: 0, sheetMediaEndSec: 0,
                sheetMediaInheritedFromGeneral: false
            });
        } catch (error) {
            alert(`Ajout du média impossible : ${error.message || 'erreur réseau'}`);
        } finally {
            setUploadingSheetMedia(false);
            if (event?.target) event.target.value = null;
        }
    };
    const handleGeneralSheetMediaFile = async (event) => {
        const file = event?.target?.files?.[0];
        if (!file) return;
        if (!/^(audio|video)\//.test(String(file.type || ''))) {
            alert('Choisis un MP3 ou un fichier audio.');
            return;
        }
        setUploadingSheetMedia(true);
        try {
            const data = new FormData();
            data.append('file', file);
            const response = await fetch('/api/learning/media/upload', { method: 'POST', body: data });
            const result = await response.json();
            if (!response.ok || !result?.url) throw new Error(result?.error || 'Import impossible');
            setGeneralSheetMedia({ url: result.url, name: result.name || file.name, type: result.mimeType || file.type, startSec: 0, endSec: 0 });
        } catch (error) {
            alert(`Ajout du média impossible : ${error.message || 'erreur réseau'}`);
        } finally {
            setUploadingSheetMedia(false);
            if (event?.target) event.target.value = null;
        }
    };
    const handlePasteSheet = async (event) => {
        if (!step || step.type !== 'sheet') return;
        const items = Array.from(event.clipboardData?.items || []);
        const fileItem = items.find((item) => item.kind === 'file');
        const file = fileItem?.getAsFile ? fileItem.getAsFile() : null;
        if (file) {
            event.preventDefault();
            event.stopPropagation();
            const ext = String(file.type || '').includes('jpeg') ? 'jpg' : 'png';
            const safeFile = file instanceof File
                ? new File([file], file.name || `fiche-collee-${Date.now()}.${ext}`, { type: file.type || 'image/png' })
                : file;
            await importSheetFile(safeFile);
            return;
        }
        const text = String(event.clipboardData?.getData('text/plain') || '').trim();
        if (/^(https?:\/\/|\/api\/|data:image\/)/i.test(text)) {
            event.preventDefault();
            updateStep(activeStep, { sheetUrl: text, sheetText: '', sheetTextHtml: '', sheetSlideTextMap: {} });
        }
    };
    const clearSheetStep = () => {
        if (!step || step.type !== 'sheet') return;
        updateStep(activeStep, {
            sheetUrl: '',
            sheetText: '',
            sheetTextHtml: '',
            extractedSheetText: '',
            sheetSlideTextMap: {},
            sheetZoneRanges: [],
            sheetZoneMarkers: [],
            sheetPinkRanges: [],
            redHighlights: [],
            keywords: []
        });
    };
    const confirmClearSheetStep = () => {
        if (!step || step.type !== 'sheet') return;
        const hasContent = String(step.sheetUrl || '').trim() || String(step.sheetText || '').trim();
        if (!hasContent) return;
        if (!window.confirm('Supprimer cette fiche, son URL et tout son texte ?')) return;
        clearSheetStep();
    };
    const generateQuestionsForActiveZone = async (zoneIdxOverride = null, countOverride = null) => {
        if (!step) return;
        let source = String(keywordMaterialText || step.materialText || '');
        if (!source.trim() && step.type === 'question') {
            source = String(await loadQuestionSourceText({ openKeyword: false }) || '');
        }
        if (!source) return alert("Aucun texte source.");
        const textLen = source.length;
        const rawMarkers = step.type === 'question'
            ? (Array.isArray(step.questionZoneMarkers)
                ? step.questionZoneMarkers
                : (Array.isArray(step.questionZoneRanges) ? step.questionZoneRanges.map((r) => r?.end) : []))
            : getCurrentZoneMarkers();
        const markers = normalizeMarkers(rawMarkers, textLen);
        const zoneIdx = Number.isFinite(Number(zoneIdxOverride))
            ? Number(zoneIdxOverride)
            : (Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0);
        const zone = getZoneBounds(zoneIdx, markers, textLen);
        const sectionText = source.slice(zone.start, zone.end).trim();
        if (!sectionText) return alert("Section vide.");
        const pinkRanges = normalizeRanges(getCurrentResponseRanges(), textLen)
            .filter((r) => r.end > zone.start && r.start < zone.end)
            .map((r) => ({ start: Math.max(zone.start, r.start), end: Math.min(zone.end, r.end) }));
        const answers = rangesToSnippets(source, pinkRanges);
        const count = Math.max(1, Math.min(20, Number(countOverride || zoneQuestionCount || step.questionCount || 3)));
        const selectedOnly = answers.length > 0;
        const promptText = selectedOnly ? answers.join('\n') : sectionText;
        const topic = [
            `Crée ${count} questions de compréhension.`,
            selectedOnly
                ? "IMPORTANT: utilise EXCLUSIVEMENT le contenu des réponses roses ci-dessous. N'utilise aucun autre passage."
                : "Utilise le contenu de la section ci-dessous.",
            `CONTENU SOURCE: ${promptText}`,
            selectedOnly ? `RÉPONSES CIBLES (texte rose): ${answers.join(' | ')}` : 'RÉPONSES CIBLES: libre selon la section.'
        ].join('\n');
        setAiTesting(true);
        try {
            const res = await fetch('/api/learning/generate-section-questions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sectionText: promptText, sourceAnswers: answers, count, topic, teacherId })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || 'Erreur génération');
            const clean = Array.isArray(data?.rows) ? data.rows.slice(0, count) : [];
            const forcedKeywords = [...new Set(answers.map((a) => String(a || '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
            const withForced = clean.map((row) => {
                const base = Array.isArray(row?.expectedKeywords) ? row.expectedKeywords.map((k) => String(k || '').trim()).filter(Boolean) : [];
                const merged = [...new Set([...base, ...forcedKeywords])].slice(0, 20);
                return { ...row, expectedKeywords: merged, generatedByAi: true };
            });
            const map = getCurrentSectionQuestionsMap();
            const existingRows = Array.isArray(map[String(zoneIdx)]) ? map[String(zoneIdx)] : [];
            const next = { ...map, [String(zoneIdx)]: [...existingRows, ...withForced] };
            updateCurrentSectionQuestionsMap(next);
        } catch (e) {
            alert(String(e?.message || "Erreur génération questions."));
        }
        setAiTesting(false);
    };

    const addSelectedPinkKeyword = (forcedSnippet = '') => {
        if (!step) return;
        const snippet = String(forcedSnippet || keywordSelectedText || '').replace(/\s+/g, ' ').trim();
        if (!snippet) return;
        if (activeTarget === 'zone') {
            if (keywordSelectionSpan && Number.isFinite(keywordSelectionSpan.start) && Number.isFinite(keywordSelectionSpan.end)) {
                const sourceLen = String(keywordMaterialText || '').length;
                const currentZone = normalizeRanges(getCurrentZoneRanges(), sourceLen);
                applyRangesToStep({ zoneRanges: [...currentZone, keywordSelectionSpan] });
            }
            setKeywordSelectedText(snippet);
            return;
        }
        if (keywordSelectionSpan && Number.isFinite(keywordSelectionSpan.start) && Number.isFinite(keywordSelectionSpan.end)) {
            const sourceLen = String(keywordMaterialText || '').length;
            const currentResp = normalizeRanges(getCurrentResponseRanges(), sourceLen);
            applyRangesToStep({ responseRanges: [...currentResp, keywordSelectionSpan] });
        } else {
            applyPinkSnippets([snippet]);
        }
        setKeywordSelectedText(snippet);
    };

    useEffect(() => {
        if (step?.type === 'video' && step?.videoUrl) {
            setSelectedSegmentId('');
            setSelectedSegmentLabel('');
            setSelectedSegmentTranscript('');
            setLastSavedSegmentLabel('');
            setLastSavedSegmentTranscript('');
            refreshKnownSegments(step.videoUrl, step.id);
        } else {
            setKnownSegments([]);
            setSelectedSegmentId('');
            setSelectedSegmentLabel('');
            setSelectedSegmentTranscript('');
            setLastSavedSegmentLabel('');
            setLastSavedSegmentTranscript('');
        }
    }, [step?.type, step?.videoUrl, teacherId]);

    useEffect(() => {
        if (!step || step.type !== 'video') return;
        if (!Array.isArray(knownSegments) || knownSegments.length === 0) return;
        const active = knownSegments.find((seg) =>
            Number(seg?.startSec || 0) === Number(step.startSec || 0)
            && Number(seg?.endSec || 0) === Number(step.endSec || 0)
        );
        if (!active) return;
        const sid = String(active._id || active.id || '');
        if (!sid || sid === selectedSegmentId) return;
        setSelectedSegmentId(sid);
        setSelectedSegmentLabel(String(active.label || ''));
        setSelectedSegmentTranscript(String(active.transcript || ''));
        setLastSavedSegmentLabel(String(active.label || ''));
        setLastSavedSegmentTranscript(String(active.transcript || ''));
        setSegmentStart(Math.max(0, Number(active.startSec || 0)));
        setSegmentEnd(Math.max(0, Number(active.endSec || 0)));
        setSegmentEndFollowPlayhead(false);
        setEditorPlaybackMode('segment');
    }, [knownSegments, step?.id, step?.type, step?.startSec, step?.endSec, selectedSegmentId]);

    useEffect(() => {
        if (!selectedSegmentId) return;
        const label = String(selectedSegmentLabel || '').trim();
        const transcript = String(selectedSegmentTranscript || '');
        const sameAsSaved = label === String(lastSavedSegmentLabel || '').trim()
            && transcript === String(lastSavedSegmentTranscript || '');
        if (sameAsSaved) return;
        const t = setTimeout(async () => {
            try {
                const res = await fetch(`/api/learning/video-segments/${encodeURIComponent(selectedSegmentId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherId, label, transcript })
                });
                if (!res.ok) return;
                setLastSavedSegmentLabel(label);
                setLastSavedSegmentTranscript(transcript);
                setKnownSegments(prev => prev.map((seg) => {
                    const sid = String(seg._id || seg.id || '');
                    if (sid !== selectedSegmentId) return seg;
                    return { ...seg, label, transcript };
                }));
            } catch (_) {}
        }, 700);
        return () => clearTimeout(t);
    }, [selectedSegmentId, selectedSegmentLabel, selectedSegmentTranscript, lastSavedSegmentLabel, lastSavedSegmentTranscript, teacherId]);
    useEffect(() => {
        setQuestionSourceNotice('');
    }, [step?.id, step?.sourceSheetUrl, step?.sourceVideoRef, step?.sourceSlidesUrl, step?.sourceKind]);
    useEffect(() => {
        if (!step || step.type !== 'question') return;
        if (String(step.sourceKind || '') !== 'video') return;
        if (!String(step.sourceVideoRef || '').trim()) return;
        hydrateTranscriptForVideoSource(step.sourceVideoRef);
    }, [step?.id, step?.type, step?.sourceKind, step?.sourceVideoRef, teacherId]);

    useEffect(() => {
        if (!pendingVideoEditorStepId) return;
        if (!step || step.type !== 'video') return;
        if (String(step.id || '') !== String(pendingVideoEditorStepId)) return;
        setPendingVideoEditorStepId('');
        openVideoEditor();
    }, [pendingVideoEditorStepId, step?.id, step?.type]);

    useEffect(() => {
        if (!showVideoEditor) return;
        if (!step || step.type !== 'video') return;
        if (!String(step.videoUrl || '').trim()) return;
        refreshKnownSegments(step.videoUrl, step.id);
    }, [showVideoEditor, step?.id, step?.type, step?.videoUrl]);

    const addStep = (type, sectionId = '', customPatch = {}) => {
        const fallbackSection = String(sectionId || step?.sectionId || getDefaultSectionId());
        const inferredSheet = String(
            globalSheetSourceUrl
            || (Array.isArray(formData.steps) ? formData.steps : [])
                .find((s) => s?.type === 'sheet' && String(s?.sheetUrl || '').trim())?.sheetUrl
            || ''
        ).trim();
        const inferredVideoRow = (Array.isArray(formData.steps) ? formData.steps : [])
            .find((s) => s?.type === 'video' && String(s?.videoUrl || '').trim());
        const inferredVideoUrl = String(globalVideoSourceUrl || inferredVideoRow?.videoUrl || '').trim();
        const inferredVideoName = String(globalVideoSourceName || inferredVideoRow?.videoSourceName || '').trim();
        const autoPatch = (() => {
            if (type === 'sheet' && inferredSheet) return { sheetUrl: inferredSheet };
            if (type === 'video' && inferredVideoUrl) {
                return {
                    videoUrl: inferredVideoUrl,
                    ...(inferredVideoName ? { videoSourceName: inferredVideoName } : {})
                };
            }
            if (type === 'question') {
                const precedingSheet = [...(Array.isArray(formData.steps) ? formData.steps : [])]
                    .reverse()
                    .find((candidate) => candidate?.type === 'sheet'
                        && (!fallbackSection || String(candidate?.sectionId || '') === fallbackSection));
                const fillBlankText = sheetToFillBlankText(precedingSheet);
                return {
                    questionCount: 1,
                    sourceKind: 'sheet',
                    sourceSheetUrl: precedingSheet?.id ? `sheet:${precedingSheet.id}` : '',
                    questionAnswerPairs: [{
                        question: fillBlankText,
                        answer: '',
                        expectedKeywords: [],
                        generatedByAi: false,
                        validationType: 'fill_blanks'
                    }]
                };
            }
            return {};
        })();
        setFormData(prev => ({
            ...prev,
            steps: [...(prev.steps || []), { ...emptyStep(type), sectionId: fallbackSection, ...autoPatch, ...customPatch }]
        }));
        setActiveStep((formData.steps || []).length);
    };

    const createOrInspectSheetQuestion = (sheetIndex, requestedKind = 'full') => {
        const steps = Array.isArray(formData.steps) ? formData.steps : [];
        const storedSheetStep = steps[sheetIndex];
        if (!storedSheetStep || storedSheetStep.type !== 'sheet') return;
        const linkedMode = requestedKind === 'plan' ? 'plan' : 'full';
        const liveDraft = sheetDraftsRef.current.get(String(storedSheetStep.id || ''));
        const currentSheetStep = liveDraft
            ? { ...storedSheetStep, sheetText: liveDraft.text, sheetTextHtml: liveDraft.html }
            : storedSheetStep;
        const shouldAutoStructure = linkedMode === 'full' && currentSheetStep?.generalSheetGenerated !== true;
        const sheetStep = shouldAutoStructure
            ? structureSheetForRevision(currentSheetStep)
            : currentSheetStep;
        if (shouldAutoStructure) {
            sheetDraftsRef.current.set(String(sheetStep.id || ''), {
                text: sheetStep.sheetText,
                html: sheetStep.sheetTextHtml
            });
        }
        const existingIndex = steps.findIndex((candidate) => candidate?.type === 'question'
            && (String(candidate?.autoLinkedSheetId || '') === String(sheetStep.id || '')
                || String(candidate?.sourceSheetUrl || '') === `sheet:${sheetStep.id}`)
            && (candidate?.autoLinkedSheetMode === 'plan' ? 'plan' : 'full') === linkedMode);
        if (existingIndex >= 0) {
            const existingQuestionId = String(steps[existingIndex]?.id || '');
            setFormData((prev) => {
                const next = [...(prev.steps || [])];
                const freshSheetIndex = next.findIndex((candidate) => String(candidate?.id || '') === String(sheetStep.id || ''));
                const freshStoredSheet = freshSheetIndex >= 0 ? next[freshSheetIndex] : sheetStep;
                const freshDraft = sheetDraftsRef.current.get(String(sheetStep.id || ''));
                const freshUnstructuredSheet = freshDraft
                    ? { ...freshStoredSheet, sheetText: freshDraft.text, sheetTextHtml: freshDraft.html }
                    : freshStoredSheet;
                const shouldStructureFreshSheet = linkedMode === 'full' && freshUnstructuredSheet?.generalSheetGenerated !== true;
                const freshSheet = shouldStructureFreshSheet
                    ? structureSheetForRevision(freshUnstructuredSheet)
                    : freshUnstructuredSheet;
                if (freshSheetIndex >= 0 && shouldStructureFreshSheet) {
                    next[freshSheetIndex] = {
                        ...next[freshSheetIndex],
                        sheetText: freshSheet.sheetText,
                        sheetTextHtml: freshSheet.sheetTextHtml
                    };
                    sheetDraftsRef.current.set(String(sheetStep.id || ''), {
                        text: freshSheet.sheetText,
                        html: freshSheet.sheetTextHtml
                    });
                }
                const freshQuestionIndex = next.findIndex((candidate) => (
                    (existingQuestionId && String(candidate?.id || '') === existingQuestionId)
                    || (candidate?.type === 'question'
                        && String(candidate?.autoLinkedSheetId || '') === String(sheetStep.id || '')
                        && (candidate?.autoLinkedSheetMode === 'plan' ? 'plan' : 'full') === linkedMode)
                ));
                if (freshQuestionIndex < 0) return prev;
                const revision = sheetToRevisionQuestion(freshSheet, linkedMode);
                next[freshQuestionIndex] = {
                    ...next[freshQuestionIndex],
                    title: revision.title,
                    autoLinkedSheetId: sheetStep.id,
                    autoLinkedSheetMode: linkedMode,
                    autoRevisionKind: revision.kind,
                    sourceKind: 'sheet',
                    sourceSheetUrl: `sheet:${sheetStep.id}`,
                    questionCount: 1,
                    questionAnswerPairs: [{
                        question: revision.text,
                        answer: '',
                        expectedKeywords: [],
                        generatedByAi: false,
                        validationType: 'fill_blanks'
                    }]
                };
                return { ...prev, steps: next };
            });
            setActiveStep(existingIndex);
            return;
        }
        const revision = sheetToRevisionQuestion(sheetStep, linkedMode);
        const linkedQuestion = {
            ...emptyStep('question'),
            sectionId: String(sheetStep.sectionId || getDefaultSectionId()),
            title: revision.title,
            autoLinkedSheetId: sheetStep.id,
            autoLinkedSheetMode: linkedMode,
            autoRevisionKind: revision.kind,
            sourceKind: 'sheet',
            sourceSheetUrl: `sheet:${sheetStep.id}`,
            questionCount: 1,
            questionAnswerPairs: [{
                question: revision.text,
                answer: '',
                expectedKeywords: [],
                generatedByAi: false,
                validationType: 'fill_blanks'
            }]
        };
        const next = [...steps];
        if (linkedMode === 'full' && sheetStep?.generalSheetGenerated !== true) {
            next[sheetIndex] = {
                ...next[sheetIndex],
                sheetText: sheetStep.sheetText,
                sheetTextHtml: sheetStep.sheetTextHtml
            };
        }
        const lastLinkedOffset = steps.slice(sheetIndex + 1).findIndex((candidate) => candidate?.type !== 'question'
            || String(candidate?.autoLinkedSheetId || '') !== String(sheetStep.id || ''));
        const insertionIndex = lastLinkedOffset < 0 ? steps.length : sheetIndex + 1 + lastLinkedOffset;
        next.splice(insertionIndex, 0, linkedQuestion);
        setFormData((prev) => ({ ...prev, steps: next }));
        setActiveStep(insertionIndex);
    };

    const generateLearningFromGeneralSheet = () => {
        const startMarker = '=== DÉBUT FICHE CONDAWEB ===';
        const endMarker = '=== FIN FICHE CONDAWEB ===';
        const rawGeneralText = String(generalSheetText || '');
        const startIndex = rawGeneralText.toUpperCase().indexOf(startMarker);
        const endIndex = rawGeneralText.toUpperCase().indexOf(endMarker);
        const importText = startIndex >= 0 && endIndex > startIndex
            ? rawGeneralText.slice(startIndex + startMarker.length, endIndex).trim()
            : rawGeneralText.trim();
        const rawBlocks = generalSheetHtmlToBlocks(generalSheetHtml);
        const htmlStartIndex = rawBlocks.findIndex((block) => String(block?.text || '').trim().toUpperCase() === startMarker);
        const htmlEndIndex = rawBlocks.findIndex((block, index) => index > htmlStartIndex && String(block?.text || '').trim().toUpperCase() === endMarker);
        const importHtml = htmlStartIndex >= 0 && htmlEndIndex > htmlStartIndex
            ? rawBlocks.slice(htmlStartIndex + 1, htmlEndIndex).map((block) => block.html).join('')
            : String(generalSheetHtml || '').trim();
        const parsed = splitGeneralSheetIntoParts(importText, importHtml);
        if (!parsed.parts.length) {
            alert('Aucune grande partie détectée. Utilise des titres comme « 1. Titre », « 2. Titre » ou « I. Titre », « II. Titre ».');
            return;
        }
        const preservedVideos = (formData.steps || [])
            .filter((step) => step?.type === 'video')
            .map((step) => ({ ...step }));
        const hasExistingWork = (formData.steps || []).length > 0;
        if (hasExistingWork && !window.confirm(
            `Cette génération va remplacer les fiches, questions et quiz actuels. ${preservedVideos.length ? 'Les vidéos existantes seront conservées au début de leur partie.' : ''} Continuer ?`
        )) return;

        const sections = [];
        const steps = [];
        const previousSections = (Array.isArray(formData.sections) ? formData.sections : [])
            .map((section, index) => ({ ...section, order: Number.isFinite(Number(section?.order)) ? Number(section.order) : index }))
            .sort((a, b) => Number(a.order) - Number(b.order));
        const reusedSectionIds = new Set();
        // Réutiliser l'identifiant de la section placée au même rang permet de
        // garder les vidéos existantes attachées à leur séquence.
        const createSection = (index, name) => {
            const previous = previousSections.find((section) => Number(section.order) === index && !reusedSectionIds.has(String(section.id)))
                || previousSections.find((section) => !reusedSectionIds.has(String(section.id)));
            if (previous?.id) {
                reusedSectionIds.add(String(previous.id));
                return { ...previous, name, order: index };
            }
            return { id: uid(), name, order: index, visible: true };
        };
        const addLinkedQuestion = (sheetStep, mode = 'full') => {
            const revision = sheetToRevisionQuestion(sheetStep, mode);
            steps.push({
                ...emptyStep('question'),
                sectionId: sheetStep.sectionId,
                title: revision.title,
                autoLinkedSheetId: sheetStep.id,
                autoLinkedSheetMode: mode,
                autoRevisionKind: revision.kind,
                sourceKind: 'sheet',
                sourceSheetUrl: `sheet:${sheetStep.id}`,
                questionCount: 1,
                questionAnswerPairs: [{
                    question: revision.text,
                    answer: '',
                    expectedKeywords: [],
                    generatedByAi: false,
                    validationType: 'fill_blanks'
                }]
            });
        };

        const planSection = createSection(0, 'Introduction');
        const planSectionId = planSection.id;
        sections.push(planSection);
        const allGeneralBlocks = generalSheetHtmlToBlocks(importHtml);
        const qcmBlockIndex = allGeneralBlocks.findIndex((block) => /^(?:❓\s*)?QCM(?:\s+DE\s+R[ÉE]VISION)?\b/i.test(String(block?.text || '').trim()));
        const generalQuizBlocks = qcmBlockIndex >= 0 ? allGeneralBlocks.slice(qcmBlockIndex) : [];
        const previousMaster = (formData.steps || []).find((candidate) => candidate?.type === 'sheet' && candidate?.isGeneralSheetMaster === true);
        const selectedGeneralMedia = generalSheetMedia || (previousMaster?.sheetMediaUrl ? {
            url: previousMaster.sheetMediaUrl,
            name: previousMaster.sheetMediaName,
            type: previousMaster.sheetMediaType,
            startSec: previousMaster.sheetMediaStartSec,
            endSec: previousMaster.sheetMediaEndSec
        } : null);
        const masterSheet = {
            ...emptyStep('sheet'),
            sectionId: planSectionId,
            title: `Fiche générale · ${parsed.documentTitle}`,
            sheetText: importText,
            sheetTextHtml: importHtml,
            generalSheetGenerated: true,
            isGeneralSheetMaster: true,
            generalSheetDocumentTitle: parsed.documentTitle,
            generalSheetQuizText: generalQuizBlocks.map((block) => block.text).join('\n').trim(),
            generalSheetQuizHtml: generalQuizBlocks.map((block) => block.html).join(''),
            sheetMediaUrl: String(selectedGeneralMedia?.url || ''),
            sheetMediaName: String(selectedGeneralMedia?.name || ''),
            sheetMediaType: String(selectedGeneralMedia?.type || ''),
            sheetMediaStartSec: Math.max(0, Number(selectedGeneralMedia?.startSec || 0)),
            sheetMediaEndSec: Math.max(0, Number(selectedGeneralMedia?.endSec || 0))
        };
        steps.push(masterSheet);
        const planLines = parsed.parts.map((part, index) => `${toRomanPartNumber(index + 1)} ${part.title}`);
        const planSheet = {
            ...emptyStep('sheet'),
            sectionId: planSectionId,
            title: `Introduction · Plan des grandes parties`,
            sheetText: `${parsed.documentTitle}\n${planLines.join('\n')}`,
            sheetTextHtml: `<div>${escapeGeneralSheetHtml(parsed.documentTitle)}</div>${planLines.map((line) => `<div><strong>${escapeGeneralSheetHtml(line)}</strong></div>`).join('')}`,
            generalSheetGenerated: true
        };
        steps.push(planSheet);
        addLinkedQuestion(planSheet, 'plan');

        parsed.parts.forEach((part, index) => {
            const romanPart = toRomanPartNumber(index + 1);
            const section = createSection(index + 1, `Partie ${romanPart}`);
            const sectionId = section.id;
            sections.push(section);
            const partSheet = {
                ...emptyStep('sheet'),
                sectionId,
                title: `Partie ${romanPart} · ${part.title}`,
                sheetText: part.text,
                sheetTextHtml: part.html,
                generalSheetGenerated: true,
                generalSheetParentId: masterSheet.id,
                generalSheetPartIndex: index,
                sheetMediaUrl: masterSheet.sheetMediaUrl,
                sheetMediaName: masterSheet.sheetMediaName,
                sheetMediaType: masterSheet.sheetMediaType,
                sheetMediaStartSec: masterSheet.sheetMediaStartSec,
                sheetMediaEndSec: masterSheet.sheetMediaEndSec,
                sheetMediaInheritedFromGeneral: Boolean(masterSheet.sheetMediaUrl)
            };
            steps.push(partSheet);
            addLinkedQuestion(partSheet, 'full');
            const quizGroup = (parsed.quizGroups || []).find((group) => String(group?.key || '') === String(index + 1));
            steps.push({
                ...emptyStep('quiz'),
                sectionId,
                title: `Quiz · Partie ${romanPart}`,
                quizSourceTitle: String(quizGroup?.title || part.title || '').trim(),
                quizQuestions: Array.isArray(quizGroup?.questions) && quizGroup.questions.length > 0
                    ? quizGroup.questions
                    : emptyStep('quiz').quizQuestions,
                generalSheetGenerated: true
            });
        });

        // Une vidéo est une ressource indépendante de la fiche : elle ne doit
        // jamais être remplacée par une régénération. Les sections restantes
        // qui contiennent une vidéo sont donc aussi conservées.
        previousSections.forEach((previous) => {
            const hasVideo = preservedVideos.some((video) => String(video?.sectionId || '') === String(previous.id));
            if (!hasVideo || reusedSectionIds.has(String(previous.id))) return;
            reusedSectionIds.add(String(previous.id));
            sections.push({ ...previous, order: sections.length });
        });
        const validSectionIds = new Set(sections.map((section) => String(section.id)));
        const videosBySection = new Map();
        preservedVideos.forEach((video) => {
            const sectionId = validSectionIds.has(String(video?.sectionId || ''))
                ? String(video.sectionId)
                : String(planSectionId);
            const list = videosBySection.get(sectionId) || [];
            list.push({ ...video, sectionId });
            videosBySection.set(sectionId, list);
        });
        const generatedBySection = new Map();
        steps.forEach((step) => {
            const sectionId = String(step?.sectionId || planSectionId);
            const list = generatedBySection.get(sectionId) || [];
            list.push(step);
            generatedBySection.set(sectionId, list);
        });
        const orderedSteps = sections.flatMap((section) => [
            ...(videosBySection.get(String(section.id)) || []),
            ...(generatedBySection.get(String(section.id)) || [])
        ]);

        setFormData((prev) => ({ ...prev, sections, steps: orderedSteps }));
        setActiveStep(0);
        setShowGeneralSheetBuilder(false);
    };

    const getGeneralSheetMaster = () => (Array.isArray(formData.steps) ? formData.steps : [])
        .find((step) => step?.type === 'sheet' && step?.isGeneralSheetMaster === true);

    const openGeneralSheetBuilder = () => {
        const master = getGeneralSheetMaster();
        setGeneralSheetText(String(master?.sheetText || ''));
        setGeneralSheetHtml(String(master?.sheetTextHtml || ''));
        setGeneralSheetMedia(master?.sheetMediaUrl ? {
            url: master.sheetMediaUrl,
            name: master.sheetMediaName,
            type: master.sheetMediaType,
            startSec: Number(master.sheetMediaStartSec || 0),
            endSec: Number(master.sheetMediaEndSec || 0)
        } : null);
        setShowGeneralSheetBuilder(true);
    };

    const deleteGeneralSheet = () => {
        if (!window.confirm('Effacer la fiche générale et toutes les sections créées depuis cette fiche ?')) return;
        setFormData((prev) => {
            const keptSteps = (prev.steps || []).filter((step) => step?.generalSheetGenerated !== true);
            const usedSectionIds = new Set(keptSteps.map((step) => String(step?.sectionId || '')).filter(Boolean));
            const keptSections = (prev.sections || []).filter((section) => usedSectionIds.has(String(section?.id || '')));
            return { ...prev, steps: keptSteps, sections: keptSections };
        });
        setGeneralSheetText('');
        setGeneralSheetHtml('');
        setGlobalSheetSourceUrl('');
        setActiveStep(0);
        setShowGeneralSheetBuilder(false);
    };

    const copyLearningText = async (text, successMessage) => {
        try {
            await navigator.clipboard.writeText(String(text || ''));
        } catch (_) {
            const textarea = document.createElement('textarea');
            textarea.value = String(text || '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
        }
        alert(successMessage);
    };

    const copyNotebookLmSlidesSource = async () => {
        const slidesUrl = String(formData.presentationSourceUrl || formData.presentationUrl || '').trim();
        if (!slidesUrl) return alert('Aucune présentation Google Slides n’est associée à cette séquence.');
        await copyLearningText(slidesUrl, 'URL des slides copiée. Ajoute-la comme SOURCE 2 dans NotebookLM.');
    };

    const selectNotebookSlideRange = (slideNumber) => {
        const selected = Math.max(1, Number(slideNumber || 0));
        if (!selected) return;
        setNotebookSlidesSelection((current) => {
            if (current.length !== 1) return [selected];
            const first = Number(current[0]);
            const start = Math.min(first, selected);
            const end = Math.max(first, selected);
            return Array.from({ length: end - start + 1 }, (_item, index) => start + index);
        });
    };

    useEffect(() => {
        const presentationUrl = String(formData.presentationUrl || '').trim();
        if (sourcePickerKind !== 'video' || !showNotebookSlidesPicker || !isGoogleSlidesUrl(presentationUrl)) {
            setNotebookSlides([]);
            setNotebookSlidesError('');
            return;
        }
        const initialRange = String(formData.presentationSlidesFocus || '').match(/^(\d+)\s*(?:-|–|—)\s*(\d+)$/);
        if (initialRange) {
            const start = Number(initialRange[1]);
            const end = Number(initialRange[2]);
            setNotebookSlidesSelection(Array.from({ length: Math.max(0, end - start + 1) }, (_item, index) => start + index));
        } else {
            setNotebookSlidesSelection([]);
        }
        const controller = new AbortController();
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 15000);
        (async () => {
            setNotebookSlidesLoading(true);
            setNotebookSlidesError('');
            try {
                const res = await fetch('/api/learning/slides/manifest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    // Les miniatures directes Google peuvent bloquer longtemps.
                    // On affiche tout de suite la liste et chaque carte utilise
                    // ensuite son proxy miniature individuel.
                    body: JSON.stringify({ presentationUrl, includeThumbnails: false }),
                    signal: controller.signal
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data?.error || 'Chargement des slides impossible');
                setNotebookSlides(Array.isArray(data?.slides) ? data.slides : []);
            } catch (error) {
                if (!controller.signal.aborted || timedOut) {
                    setNotebookSlides([]);
                    setNotebookSlidesError(timedOut ? 'Les slides ne répondent pas. Vérifie la présentation ou la connexion Google.' : String(error?.message || 'Chargement des slides impossible'));
                }
            } finally {
                clearTimeout(timeout);
                if (!controller.signal.aborted || timedOut) setNotebookSlidesLoading(false);
            }
        })();
        return () => {
            clearTimeout(timeout);
            controller.abort();
        };
    }, [sourcePickerKind, formData.presentationUrl, showNotebookSlidesPicker]);

    const createNotebookLmPublicSlides = async () => {
        const presentationUrl = String(formData.presentationUrl || '').trim();
        const selectedNumbers = [...new Set(notebookSlidesSelection.map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
        const selection = String(formData.presentationSlidesFocus || '').trim();
        const range = selectedNumbers.length
            ? [String(selectedNumbers[0]), String(selectedNumbers[selectedNumbers.length - 1])]
            : selection.match(/^(\d+)\s*(?:-|–|—)\s*(\d+)$/)?.slice(1);
        if (!presentationUrl) return alert('Ajoute d’abord l’URL de la présentation Google Slides complète.');
        if (!range) return alert('Indique une plage de slides au format « 8-12 ».');
        const startSlide = Number(range[0]);
        const endSlide = Number(range[1]);
        if (!Number.isInteger(startSlide) || !Number.isInteger(endSlide) || startSlide < 1 || endSlide < startSlide) {
            return alert('La plage de slides est invalide.');
        }
        setCreatingNotebookLmSource(true);
        try {
            const res = await fetch('/api/learning/slides/create-range', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    presentationUrl,
                    startSlide,
                    endSlide,
                    title: `${String(formData.title || 'Apprentissage').trim()} — Slides NotebookLM`
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.publicReaderUrl) throw new Error(data?.error || 'Création de la présentation impossible');
            setFormData((prev) => ({
                ...prev,
                presentationSourceUrl: String(data.publicReaderUrl),
                presentationSlidesFocus: `${startSlide}-${endSlide}`
            }));
            await copyLearningText(String(data.publicReaderUrl), `Présentation publique ${startSlide}-${endSlide} créée et copiée. Ajoute-la comme SOURCE 2 dans NotebookLM.`);
        } catch (error) {
            alert(`Création des slides NotebookLM impossible : ${error.message}`);
        } finally {
            setCreatingNotebookLmSource(false);
        }
    };

    const createNotebookLmGoogleDoc = async () => {
        const master = (formData.steps || []).find((item) => item?.type === 'sheet' && item?.isGeneralSheetMaster);
        const fullText = String(master?.sheetText || generalSheetText || '').trim();
        // Le QCM est destiné à CondaWeb : la source narrative de NotebookLM ne
        // contient que la fiche de cours, jusqu'au titre « QCM DE RÉVISION ».
        const qcmStart = fullText.search(/(?:^|\n)\s*(?:❓\s*)?QCM(?:\s+DE\s+R[ÉE]VISION)?\b/i);
        const text = (qcmStart >= 0 ? fullText.slice(0, qcmStart) : fullText).trim();
        if (!text) return alert('Crée ou colle d’abord la fiche générale avant de générer le Google Docs.');
        setCreatingNotebookLmSource(true);
        try {
            const res = await fetch('/api/learning/general-sheet/google-doc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: String(formData.title || 'Fiche générale').trim(),
                    text,
                    existingUrl: String(formData.generalSheetDocUrl || '').trim()
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data?.editUrl) throw new Error(data?.error || 'Création du Google Docs impossible');
            setFormData((prev) => ({ ...prev, generalSheetDocUrl: String(data.editUrl) }));
            await copyLearningText(String(data.editUrl), 'Google Docs de la fiche créé et copié. Ajoute-le comme SOURCE 1 dans NotebookLM.');
        } catch (error) {
            alert(`Création du Google Docs impossible : ${error.message}`);
        } finally {
            setCreatingNotebookLmSource(false);
        }
    };

    const openNotebookLm = () => {
        window.open('https://notebooklm.google.com/', '_blank', 'noopener,noreferrer');
    };

    const copyNotebookLmVideoPrompt = async () => {
        const selectedChapter = (chapters || []).find((chapter) => String(chapter?._id || '') === String(formData.chapterId || ''));
        const chapterTitle = String(selectedChapter?.title || formData.title || 'ce chapitre').trim();
        const prompt = `GÉNÈRE UNE VIDÉO PÉDAGOGIQUE SUR « ${chapterTitle} » POUR DES ÉLÈVES DE NIVEAU ${targetLevel || 'INDIQUÉ'}.

RÈGLE ABSOLUE SUR LES SOURCES
- SOURCE 1 (le Google Docs pédagogique) est l'unique source du contenu, du plan, des explications, des faits, des dates, des notions et du récit de la vidéo.
- SOURCE 2 (la présentation Google Slides) ne doit jamais fournir une information supplémentaire et ne doit jamais modifier le plan de la SOURCE 1.
- SOURCE 2 sert exclusivement à illustrer les passages pour lesquels la SOURCE 1 contient une référence explicite de la forme « REPÈRE VISUEL — SOURCE 2, DIAPOSITIVE N°... ».
- Pour chaque repère, utilise uniquement la ou les diapositives exactement numérotées dans la SOURCE 1. N'utilise aucune autre diapositive, même si elle semble pertinente.
- Si un visuel référencé est indisponible ou illisible, poursuis la vidéo sans lui.

CONSTRUCTION DE LA VIDÉO
- Suis exactement l'ordre des grandes parties de la SOURCE 1.
- Explique clairement les liens de cause, conséquence, évolution, comparaison ou opposition présents dans la SOURCE 1.
- Fais apparaître les repères visuels référencés au moment précis où l'idée correspondante est expliquée.
- Commente ce qu'il faut observer dans chaque visuel, conformément à la légende donnée dans la SOURCE 1.
- Adapte le vocabulaire, le rythme et la durée au niveau ${targetLevel || 'indiqué'}.
- Termine par une synthèse fidèle à la page « À retenir » de la SOURCE 1.

Avant de générer, vérifie que chaque phrase informative vient de la SOURCE 1 et que chaque visuel issu de la SOURCE 2 possède une référence explicite dans la SOURCE 1.`;
        await copyLearningText(prompt, 'Prompt vidéo copié. Colle-le dans le générateur vidéo NotebookLM.');
    };

    const copyGeminiSuperSheetPrompt = async () => {
        const selectedChapter = (chapters || []).find((chapter) => String(chapter?._id || '') === String(formData.chapterId || ''));
        const chapterTitle = String(selectedChapter?.title || 'CHAPITRE NON SÉLECTIONNÉ').trim();
        const chapterSubject = String(selectedChapter?.section || formData.subject || targetSection || '').trim();
        const isFifthOrSixthGrade = usesPlainNumberedIdeas;
        const selectedCourse = generalSheetCourses.find((course) => String(course?._id || '') === String(formData.generalSheetCourseId || ''));
        const courseTitle = String(selectedCourse?.title || formData.generalSheetCourseTitle || '').trim();
        const courseDescription = String(selectedCourse?.description || formData.generalSheetCourseDescription || '').trim();
        const slidesUrl = String(formData.presentationUrl || '').trim();
        const slidesFocus = String(formData.presentationSlidesFocus || '').trim();
        const prompt = `PROMPT CONDAWEB — FICHE GÉNÉRALE + QCM

CHAPITRE À FICHER
- Titre exact : ${chapterTitle}
- Matière : ${chapterSubject || 'non précisée'}
- Niveau : ${targetLevel || 'non précisé'}
- Nom de l'apprentissage : ${String(formData.title || '').trim() || 'non précisé'}

PRÉSENTATION À ANALYSER
- Séquence de cours sélectionnée : ${courseTitle || 'SÉQUENCE NON SÉLECTIONNÉE'}
- Détail de la séquence : ${courseDescription || 'aucun détail renseigné'}
- URL Google Slides : ${slidesUrl || 'URL NON RENSEIGNÉE DANS CONDAWEB'}
${slidesFocus ? `- Slides de trace écrite identifiées : ${slidesFocus}` : '- Repère dans la présentation les slides de trace écrite intitulées « Leçon 1 », « Leçon 2 », « Leçon 3 »…'}

Ouvre et analyse uniquement la présentation de la séquence sélectionnée ci-dessus. Produis uniquement la fiche du chapitre « ${chapterTitle} ».

RÈGLE DE PLAN PRIORITAIRE
- Les slides intitulées « Leçon 1 », « Leçon 2 », « Leçon 3 »… (ou leur équivalent explicite) définissent obligatoirement le plan de la fiche.
- Respecte leur ordre : LEÇON 1 devient la partie I, LEÇON 2 la partie II, LEÇON 3 la partie III, etc.
- Le contenu des slides de trace écrite constitue la base de chaque partie : n'invente pas de grande partie et ne mélange pas deux leçons.
- Les autres slides servent uniquement d'illustrations, documents, cartes, frises, photographies, schémas ou exemples pour éclairer la leçon correspondante. Ils peuvent enrichir une explication, mais ne doivent jamais créer une nouvelle partie ni modifier le plan des leçons.
- Ignore les diapositives appartenant à un autre chapitre.
- Ne crée aucun contenu pour NotebookLM, aucune base de vidéo, aucun Google Docs et aucun texte de prompt vidéo : l'onglet Vidéo s'en charge séparément.

LIVRABLE 1 — BLOC « FICHE CONDAWEB »

Place toute la fiche et son QCM dans un unique bloc clairement délimité par les lignes :
=== DÉBUT FICHE CONDAWEB ===
et
=== FIN FICHE CONDAWEB ===

FORMAT IMPÉRATIF — PARTIE 1 : FICHE DE COURS

Première ligne : titre général de la leçon.

Construis une fiche courte, progressive, très claire et facile à mémoriser. Adapte réellement la quantité d'informations, la longueur des phrases et le vocabulaire au niveau ${targetLevel || 'indiqué'}.

${isFifthOrSixthGrade ? `RÈGLE SPÉCIALE 5e/6e — PRÉSENTATION TRÈS LÉGÈRE
- Les seuls titres sont les grandes parties I., II., III. : elles seront mises en rouge et en gras.
- Les idées principales sont numérotées « 1- », « 2- », « 3- » et restent noires, sans gras.
- Si une idée doit être précisée, place la précision à la ligne suivante avec un tiret « - », noir et sans gras.
- N'utilise jamais « a) », « b) » ni aucun sous-sous-plan.
- Aucun texte ne doit être vert. Aucun texte ne doit être gras sauf les véritables mots-clés à apprendre.

Exemple de présentation attendue :
I. Titre de la grande partie
1- Idée essentielle avec un ou deux mots-clés en gras.
- Précision ou exemple utile.
2- Idée essentielle suivante.
II. Titre de la grande partie suivante

RÈGLES STRICTES
Après chaque élément, insère immédiatement un retour à la ligne.
Un marqueur I., 1- ou un tiret doit toujours être le premier élément de sa ligne.
Il est interdit de placer deux éléments sur une même ligne.
Les chiffres romains correspondent aux grandes parties.
Les nombres suivis de - correspondent aux idées principales.
Ne multiplie pas les niveaux de plan : une fiche de 5e ou 6e doit être courte, lisible et facile à apprendre.` : `Hiérarchie de référence :

I. Titre de la grande partie
1- Idée principale
• Précision utile ou exemple bref
2- Idée principale suivante
II. Titre de la grande partie suivante
RÈGLES STRICTES
Après chaque élément, insère immédiatement un retour à la ligne.
Un marqueur I. ou 1- doit toujours être le premier élément de sa ligne.
Il est interdit de placer deux éléments sur une même ligne.
Les chiffres romains correspondent aux grandes parties.
Les nombres suivis de - correspondent aux idées principales.
Une idée principale doit être une phrase complète (sujet + verbe + complément) ou une affirmation claire.
Ajoute des puces simples sous une idée principale seulement lorsqu'elles facilitent nettement la compréhension ou la mémorisation.
En 3e, n'utilise a), b), c)... qu'exceptionnellement, lorsqu'un découpage supplémentaire est indispensable à la compréhension. Dans tous les autres cas, préfère une idée principale courte suivie de puces simples.
Ne multiplie pas les niveaux de plan : une fiche doit pouvoir être relue et apprise facilement.`}
Mettre en gras uniquement les dates, personnages, lieux, notions, mots-clés et expressions que l'élève devra restituer dans un texte à trous.
Tous les éléments en gras doivent pouvoir être supprimés pour créer automatiquement un texte à trous.
Ne jamais mettre en gras un détail secondaire ou anecdotique.
Supprimer les informations inutiles au niveau collège.
Le contenu doit être exact, clair, synthétique et adapté à des élèves de collège.
N'ajouter aucune source, citation, commentaire ou remarque méthodologique.
FORMAT IMPÉRATIF — PARTIE 2 : QCM DE RÉVISION
Après la fiche, écrire exactement :
QCM DE RÉVISION
Créer un bloc pour chaque grande partie, dans le même ordre :
LEÇON 1 : [titre de I]
LEÇON 2 : [titre de II]
LEÇON 3 : [titre de III]
...
RÈGLES STRICTES
Chaque leçon doit comporter entre 4 et 6 questions, même si la partie contient moins ou plus d'idées principales.
Les questions doivent couvrir toutes les connaissances essentielles de la partie.
Les questions doivent être réparties entre les idées principales et leurs sous-idées importantes.
Numéroter les questions :
1-
2-
3-
...
Chaque question comporte exactement quatre propositions :
a)
b)
c)
d)
Une seule réponse est correcte.
Mettre en gras uniquement la bonne réponse, et toute la bonne réponse.
Les mauvaises réponses doivent être plausibles mais sans ambiguïté.
Les questions doivent porter sur les éléments en gras de la fiche (dates, personnages, lieux, notions, mots-clés...).
Chaque proposition (a, b, c, d) doit être écrite sur sa propre ligne.
Ne produire aucune correction séparée : la bonne réponse est uniquement identifiable grâce au gras.
À l'intérieur du bloc FICHE CONDAWEB, ne rien écrire avant le titre de la fiche.
À l'intérieur du bloc FICHE CONDAWEB, ne rien écrire après la dernière réponse du dernier QCM.

VÉRIFICATION AVANT DE RÉPONDRE
- Le titre et tout le contenu portent bien sur « ${chapterTitle} ».
- Chaque slide « Leçon n » de la trace écrite correspond à une et une seule grande partie, dans le même ordre.
- Les autres slides ont seulement servi à illustrer ou préciser la leçon concernée, sans modifier le plan.
- Chaque grande partie possède son bloc LEÇON correspondant dans le QCM.
- Le bloc FICHE CONDAWEB est directement copiable dans CondaWeb, sans introduction de Gemini, sans sources et sans conclusion ajoutée.
- La fiche et le QCM sont adaptés au niveau ${targetLevel || 'indiqué'} de l'élève.`;
        // L'ouverture doit être synchrone avec le clic pour ne pas être bloquée
        // par Safari/Chrome avant l'écriture asynchrone dans le presse-papiers.
        window.open('https://gemini.google.com/app', '_blank', 'noopener,noreferrer');
        try {
            await navigator.clipboard.writeText(prompt);
            alert('Prompt de fiche + QCM copié. Colle-le dans la nouvelle fenêtre Gemini.');
        } catch (_) {
            const textarea = document.createElement('textarea');
            textarea.value = prompt;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            alert('Prompt unique fiche + Google Docs copié. Colle-le dans la nouvelle fenêtre Gemini.');
        }
    };

    const openSourcePicker = (kind = '') => {
        if (!['video', 'sheet'].includes(String(kind || ''))) return;
        const k = String(kind);
        const inferredSheet = String(
            (Array.isArray(formData.steps) ? formData.steps : [])
                .find((s) => s?.type === 'sheet' && String(s?.sheetUrl || '').trim())?.sheetUrl || ''
        ).trim();
        const inferredVideoRow = (Array.isArray(formData.steps) ? formData.steps : [])
            .find((s) => s?.type === 'video' && String(s?.videoUrl || '').trim());
        const inferredVideo = String(inferredVideoRow?.videoUrl || '').trim();
        const inferredVideoName = String(inferredVideoRow?.videoSourceName || '').trim();
        setSourcePickerKind(k);
        if (k === 'sheet') {
            const globalUrl = String(globalSheetSourceUrl || inferredSheet || '').trim();
            setSourcePickerExistingUrl(globalUrl);
            setSourcePickerCustomUrl(globalUrl);
            setSourcePickerVideoName('');
            return;
        }
        const globalUrl = String(globalVideoSourceUrl || inferredVideo || '').trim();
        setSourcePickerExistingUrl(globalUrl);
        setSourcePickerCustomUrl(globalUrl);
        setSourcePickerVideoName(String(globalVideoSourceName || inferredVideoName || '').trim());
    };
    const closeSourcePicker = () => {
        setSourcePickerKind('');
        setSourcePickerExistingUrl('');
        setSourcePickerCustomUrl('');
        setSourcePickerVideoName('');
    };
    const openGeneralVideoEditor = async () => {
        const url = String(sourcePickerCustomUrl || sourcePickerExistingUrl || '').trim();
        if (!url) return alert("Ajoute ou choisis une URL vidéo.");
        const videoName = String(sourcePickerVideoName || '').trim();
        const existingIndex = (formData.steps || []).findIndex((row) => row?.type === 'video' && (
            String(row?.videoUrl || '').trim() === url || String(row?.segmentSourceUrl || '').trim() === url
        ));
        let targetIndex = existingIndex;
        let targetId = existingIndex >= 0 ? String(formData.steps[existingIndex]?.id || '') : '';
        if (existingIndex < 0) {
            const sections = Array.isArray(formData.sections) && formData.sections.length > 0
                ? formData.sections
                : [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
            const videoStep = {
                ...emptyStep('video'),
                sectionId: String(sections[0]?.id || 'sec_1'),
                title: videoName || 'Vidéo générale',
                videoUrl: url,
                ...(videoName ? { videoSourceName: videoName } : {})
            };
            const nextSteps = [...(formData.steps || [])];
            const firstInSection = nextSteps.findIndex((row) => String(row?.sectionId || '') === String(videoStep.sectionId || ''));
            targetIndex = firstInSection < 0 ? nextSteps.length : firstInSection;
            nextSteps.splice(targetIndex, 0, videoStep);
            targetId = String(videoStep.id || '');
            setFormData((prev) => ({ ...prev, sections, steps: nextSteps }));
        }
        setGlobalVideoSourceUrl(url);
        setGlobalVideoSourceName(videoName);
        closeSourcePicker();
        setActiveStep(Math.max(0, targetIndex));
        setPendingVideoEditorStepId(targetId);
    };
    const applySourceToAllSteps = async () => {
        const kind = String(sourcePickerKind || '');
        if (!['video', 'sheet'].includes(kind)) return;
        const url = String(sourcePickerCustomUrl || sourcePickerExistingUrl || '').trim();
        if (!url) {
            alert(kind === 'video' ? "Ajoute ou choisis une URL vidéo." : "Ajoute ou choisis une URL fiche.");
            return;
        }
        const videoName = String(sourcePickerVideoName || '').trim();

        if (kind === 'video') {
            setGlobalVideoSourceUrl(url);
            setGlobalVideoSourceName(videoName);
            const segments = await refreshKnownSegments(url, '');
            const existingVideo = (formData.steps || []).find((row) => row?.type === 'video' && (
                String(row?.videoUrl || '').trim() === url || String(row?.segmentSourceUrl || '').trim() === url
            ));
            if (segments.length > 0) {
                const structure = buildVideoSegmentStructure({
                    sourceUrl: url,
                    sourceName: videoName,
                    segments,
                    templateStep: existingVideo || { ...emptyStep('video'), videoUrl: url, videoSourceName: videoName }
                });
                if (structure) {
                    const { nextSections, nextSteps, generatedSteps } = structure;
                    setFormData((prev) => ({ ...prev, sections: nextSections, steps: nextSteps }));
                    setActiveStep(Math.max(0, nextSteps.findIndex((row) => String(row?.id || '') === String(generatedSteps[0]?.id || ''))));
                    if (formData?._id) {
                        const saveRes = await fetch(`/api/learning/${encodeURIComponent(String(formData._id))}/structure`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sections: nextSections, steps: nextSteps })
                        });
                        if (!saveRes.ok) return alert("Les séquences ont été retrouvées, mais leur attribution n'a pas pu être sauvegardée.");
                    }
                }
            } else {
                const sections = Array.isArray(formData.sections) && formData.sections.length > 0
                    ? formData.sections
                    : [{ id: 'sec_1', name: 'Section 1', order: 0, visible: true }];
                const videoStep = existingVideo
                    ? { ...existingVideo, videoUrl: url, ...(videoName ? { videoSourceName: videoName } : {}) }
                    : { ...emptyStep('video'), sectionId: String(sections[0]?.id || 'sec_1'), title: videoName || 'Vidéo générale', videoUrl: url, ...(videoName ? { videoSourceName: videoName } : {}) };
                const withoutTarget = (formData.steps || []).filter((row) => String(row?.id || '') !== String(existingVideo?.id || ''));
                const firstInSection = withoutTarget.findIndex((row) => String(row?.sectionId || '') === String(videoStep.sectionId || ''));
                if (firstInSection < 0) withoutTarget.push(videoStep);
                else withoutTarget.splice(firstInSection, 0, videoStep);
                setFormData((prev) => ({ ...prev, sections, steps: withoutTarget }));
            }
        } else {
            setGlobalSheetSourceUrl(url);
            setFormData((prev) => ({
                ...prev,
                steps: (prev.steps || []).map((s) => s?.type === 'sheet' ? { ...s, sheetUrl: url } : s)
            }));
        }
        closeSourcePicker();
    };

    const saveVideoSourceToLibrary = async () => {
        const url = String(sourcePickerCustomUrl || sourcePickerExistingUrl || '').trim();
        const chapterId = String(formData.chapterId || '').trim();
        const name = String(sourcePickerVideoName || '').trim();
        if (!url) return alert("Ajoute une URL vidéo.");
        if (!chapterId) return alert("Choisis d'abord un chapitre.");
        if (!name) return alert("Ajoute un nom pour la vidéo.");
        setSavingVideoSource(true);
        try {
            const res = await fetch('/api/learning/video-sources', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ teacherId, chapterId, url, name })
            });
            const row = res.ok ? await res.json() : null;
            if (!res.ok || !row) throw new Error(row?.error || 'Erreur sauvegarde');
            const next = {
                _id: String(row._id || ''),
                originalUrl: String(row.originalUrl || url),
                normalizedUrl: String(row.normalizedUrl || ''),
                name: String(row.name || name)
            };
            setSavedVideoSources((prev) => {
                const map = new Map((prev || []).map((x) => [String(x.normalizedUrl || x.originalUrl || ''), x]));
                map.set(String(next.normalizedUrl || next.originalUrl), next);
                return Array.from(map.values());
            });
            alert("Vidéo sauvegardée dans la bibliothèque.");
        } catch (e) {
            alert(`Sauvegarde impossible: ${e.message}`);
        } finally {
            setSavingVideoSource(false);
        }
    };

    const moveStep = (idx, dir) => {
        const to = idx + dir;
        if (to < 0 || to >= formData.steps.length) return;
        const next = [...formData.steps];
        const tmp = next[idx];
        next[idx] = next[to];
        next[to] = tmp;
        setFormData(prev => ({ ...prev, steps: next }));
        setActiveStep(to);
    };

    const moveStepInSection = (idx, dir, sectionId) => {
        const sid = String(sectionId || '');
        const steps = Array.isArray(formData.steps) ? formData.steps : [];
        const inSection = [];
        steps.forEach((row, i) => {
            const rowSid = String(row?.sectionId || getDefaultSectionId());
            if (rowSid === sid) inSection.push(i);
        });
        const pos = inSection.indexOf(idx);
        if (pos < 0) return;
        const targetPos = pos + dir;
        if (targetPos < 0 || targetPos >= inSection.length) return;
        const to = inSection[targetPos];
        moveStepTo(idx, to);
    };

    const moveStepTo = (fromIdx, toIdx) => {
        if (!Number.isInteger(fromIdx) || !Number.isInteger(toIdx)) return;
        if (fromIdx < 0 || toIdx < 0) return;
        if (fromIdx >= formData.steps.length || toIdx >= formData.steps.length) return;
        if (fromIdx === toIdx) return;
        const next = [...formData.steps];
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        setFormData((prev) => ({ ...prev, steps: next }));
        if (activeStep === fromIdx) setActiveStep(toIdx);
        else if (fromIdx < activeStep && toIdx >= activeStep) setActiveStep(activeStep - 1);
        else if (fromIdx > activeStep && toIdx <= activeStep) setActiveStep(activeStep + 1);
    };

    const removeStep = (idx) => {
        if (!window.confirm('Supprimer cette étape ?')) return;
        const removed = formData.steps[idx];
        const next = formData.steps.filter((candidate, i) => i !== idx
            && !(removed?.type === 'sheet'
                && candidate?.type === 'question'
                && String(candidate?.autoLinkedSheetId || '') === String(removed?.id || '')));
        setFormData(prev => ({ ...prev, steps: next }));
        setActiveStep(Math.max(0, Math.min(activeStep, next.length - 1)));
    };

    const loadDefaultsFromGame = () => {
        const chapterId = String(formData.chapterId || '');
        const sectionId = String(step?.sectionId || getDefaultSectionId());
        if (!chapterId) return;
        const sameChapter = (allGames || []).filter(g => String(g.chapterId || '') === chapterId);
        if (sameChapter.length === 0) return alert("Aucun jeu trouvé dans ce chapitre.");
        const game = sameChapter[0];
        const newSteps = [];
        if (game?.globalIntro?.sheetUrl) {
            newSteps.push({ id: uid(), type: 'sheet', sectionId, title: 'Fiche du chapitre', sheetUrl: game.globalIntro.sheetUrl, minReadSeconds: 25 });
        }
        if (game?.globalIntro?.videoUrl) {
            newSteps.push({ id: uid(), type: 'video', sectionId, title: 'Vidéo du chapitre', videoUrl: game.globalIntro.videoUrl, thumbnailUrl: '', mustWatchToEnd: true });
        }
        if (newSteps.length === 0) return alert("Le jeu du chapitre n'a pas encore de fiche/vidéo globale.");
        setFormData(prev => ({ ...prev, steps: [...(prev.steps || []), ...newSteps] }));
    };

    const handleSave = async () => {
        const chapterId = String(formData.chapterId || '');
        if (!formData.title.trim()) return alert("Titre requis.");
        if (!chapterId) return alert("Choisissez un chapitre.");
        if (!Array.isArray(formData.steps) || formData.steps.length === 0) return alert("Ajoutez au moins une étape.");
        const targets = Object.keys(distribution || {});
        if (targets.length === 0) return alert("Choisissez au moins une classe.");

        const chapter = (chapters || []).find(ch => String(ch._id) === chapterId);

        setLoading(true);
        try {
            const groups = {};
            targets.forEach(cls => {
                const cfg = distribution[cls] || { studentIds: [] };
                const isAllClass = !Array.isArray(cfg.studentIds) || cfg.studentIds.length === 0;
                const key = isAllClass ? 'ALL' : `SUBSET_${[...cfg.studentIds].sort().join('-')}`;
                if (!groups[key]) groups[key] = { classrooms: [], studentIds: cfg.studentIds || [], isAllClass };
                groups[key].classrooms.push(cls);
            });

            const groupKeys = Object.keys(groups);
            for (let i = 0; i < groupKeys.length; i += 1) {
                const grp = groups[groupKeys[i]];
                const payload = {
                    ...(formData._id && i === 0 ? { _id: formData._id } : {}),
                    title: formData.title.trim(),
                    subject: chapter?.section || formData.subject || targetSection || 'GÉNÉRAL',
                    chapterId,
                    presentationUrl: String(formData.presentationUrl || '').trim(),
                    presentationSourceUrl: String(formData.presentationSourceUrl || '').trim(),
                    presentationSlidesFocus: String(formData.presentationSlidesFocus || '').trim(),
                    generalSheetDocUrl: String(formData.generalSheetDocUrl || '').trim(),
                    generalSheetCourseId: String(formData.generalSheetCourseId || '').trim(),
                    generalSheetCourseTitle: String(formData.generalSheetCourseTitle || '').trim(),
                    generalSheetCourseDescription: String(formData.generalSheetCourseDescription || '').trim(),
                    teacherId: user.id || user._id,
                    targetClassrooms: grp.classrooms,
                    assignedStudents: grp.studentIds,
                    isAllClass: grp.isAllClass,
                    isEnabled: true,
                    sections: formData.sections || [],
                    steps: formData.steps
                };
                await api.post('/learning', payload);
            }
            onClose();
        } catch (e) {
            alert(`Erreur sauvegarde apprentissage: ${e.message}`);
        }
        setLoading(false);
    };

    const activeStepUsesLocalVideo = step?.type === 'video'
        && localVideoPreviewUrl
        && localVideoStepId === String(step.id || '');
    const editorVideoUrl = step?.type === 'video'
        ? (activeStepUsesLocalVideo ? localVideoPreviewUrl : resolveDriveAssetUrl(step.videoUrl || ''))
        : '';
    const editorIsDirect = isProbablyDirectVideo(editorVideoUrl);
    const editorYoutubeId = extractYoutubeId(step?.videoUrl || '');
    const editorIsYoutube = !editorIsDirect && !!editorYoutubeId;
    const segStartNum = Math.max(0, Number(segmentStart || 0));
    const segEndNum = Math.max(0, Number(segmentEnd || 0));
    const segHasEnd = segEndNum > segStartNum;
    const segDuration = segHasEnd ? Math.max(1, Math.floor(segEndNum - segStartNum)) : 0;
    const playbackStartSec = editorPlaybackMode === 'segment' ? segStartNum : 0;
    const playbackEndSec = editorPlaybackMode === 'segment' && segHasEnd ? segEndNum : 0;
    const timelineDurationSec = Math.max(1, Math.floor(editorDurationSec || 0));
    const timelineCurrentSec = Math.max(0, Math.min(timelineDurationSec, Math.floor(editorCurrentAbsSec || 0)));
    const timelineSegments = (Array.isArray(knownSegments) ? knownSegments : [])
        .map((seg, idx) => {
            const sid = String(seg?._id || seg?.id || '').trim() || `seg_${idx}`;
            const startSec = Math.max(0, Math.floor(Number(seg?.startSec || 0)));
            const rawEnd = Math.max(0, Math.floor(Number(seg?.endSec || 0)));
            const endSec = rawEnd > startSec ? rawEnd : timelineDurationSec;
            const width = Math.max(1, endSec - startSec);
            return {
                sid,
                idx,
                label: String(seg?.label || `Séquence ${idx + 1}`).trim(),
                startSec,
                endSec,
                leftPct: (startSec / timelineDurationSec) * 100,
                widthPct: (width / timelineDurationSec) * 100,
                raw: seg
            };
        })
        .sort((a, b) => a.startSec - b.startSec);
    const selectedTimelineIndex = timelineSegments.findIndex((seg) => String(seg.sid || '') === String(selectedSegmentId || ''));
    const previousTimelineSegment = selectedTimelineIndex > 0 ? timelineSegments[selectedTimelineIndex - 1] : null;
    const currentTimelineSegment = selectedTimelineIndex >= 0 ? timelineSegments[selectedTimelineIndex] : null;
    const nextTimelineSegment = selectedTimelineIndex >= 0 && selectedTimelineIndex < timelineSegments.length - 1
        ? timelineSegments[selectedTimelineIndex + 1]
        : null;
    const lockedSegmentStartSec = previousTimelineSegment
        ? Math.max(0, Number(previousTimelineSegment.endSec || 0))
        : 0;
    const saveSelectedEdge = async (edge, rawValue) => {
        if (!currentTimelineSegment) return false;
        const requested = Math.max(0, Math.floor(Number(rawValue || 0)));
        if (edge === 'start') {
            const maxStart = Math.max(0, Number(segmentEnd || currentTimelineSegment.endSec || 0) - 1);
            const minStart = previousTimelineSegment ? previousTimelineSegment.startSec + 1 : 0;
            const boundary = Math.max(minStart, Math.min(maxStart, requested));
            setSegmentStart(boundary);
            if (previousTimelineSegment) {
                return resizeBoundarySegments({
                    leftSid: previousTimelineSegment.sid,
                    rightSid: currentTimelineSegment.sid,
                    leftStartSec: previousTimelineSegment.startSec,
                    rightEndSec: Math.max(boundary + 1, Number(segmentEnd || currentTimelineSegment.endSec || 0)),
                    boundarySec: boundary
                });
            }
            return saveSelectedSegmentBounds(boundary, Math.max(boundary + 1, Number(segmentEnd || currentTimelineSegment.endSec || 0)));
        }
        const minEnd = Math.max(1, lockedSegmentStartSec + 1);
        const maxEnd = nextTimelineSegment
            ? Math.max(minEnd, nextTimelineSegment.endSec - 1)
            : timelineDurationSec;
        const boundary = Math.max(minEnd, Math.min(maxEnd, requested));
        setSegmentEnd(boundary);
        if (nextTimelineSegment) {
            return resizeBoundarySegments({
                leftSid: currentTimelineSegment.sid,
                rightSid: nextTimelineSegment.sid,
                leftStartSec: lockedSegmentStartSec,
                rightEndSec: nextTimelineSegment.endSec,
                boundarySec: boundary
            });
        }
        setSegmentStart(lockedSegmentStartSec);
        return saveSelectedSegmentBounds(lockedSegmentStartSec, boundary);
    };
    const cutMarkersSec = [...new Set(
        timelineSegments
            .map((seg) => Math.max(0, Math.floor(Number(seg?.endSec || 0))))
            .filter((x) => x > 0 && x <= timelineDurationSec)
    )].sort((a, b) => a - b);
    const embedStartForPreview = Number.isFinite(Number(embedPreviewSeekSec))
        ? Math.max(segStartNum, Number(embedPreviewSeekSec || segStartNum))
        : segStartNum;
    const embedEndForEditor = (previewSegmentMode || editorPlaybackMode === 'segment')
        ? Number(segmentEnd || 0)
        : 0;
    const editorEmbedBaseUrl = withSegmentParams(toEmbedUrl(editorVideoUrl), embedStartForPreview, embedEndForEditor);
    const editorEmbedUrl = (() => {
        if (!editorEmbedBaseUrl) return '';
        try {
            const u = new URL(editorEmbedBaseUrl, window.location.origin);
            if (previewSegmentMode) u.searchParams.set('autoplay', '1');
            if (editorEmbedReloadKey) u.searchParams.set('_segReload', String(editorEmbedReloadKey));
            return u.toString();
        } catch (_) {
            return editorEmbedBaseUrl;
        }
    })();

    useEffect(() => {
        youtubeBoundsRef.current = { start: playbackStartSec, end: playbackEndSec };
    }, [playbackStartSec, playbackEndSec]);

    useEffect(() => {
        if (!showVideoEditor || !editorIsYoutube || !editorYoutubeId) return;
        let alive = true;
        const clearTick = () => {
            if (youtubeTickRef.current) {
                clearInterval(youtubeTickRef.current);
                youtubeTickRef.current = null;
            }
        };
        const syncCurrent = () => {
            if (!youtubeEditorPlayerRef.current?.getCurrentTime) return;
            try {
                const now = Number(youtubeEditorPlayerRef.current.getCurrentTime() || 0);
                setEditorCurrentAbsSec(Math.max(0, now));
                const bounds = youtubeBoundsRef.current || { start: 0, end: 0 };
                if (Number(bounds.end || 0) > 0 && now >= Number(bounds.end || 0) - 0.1) {
                    try { youtubeEditorPlayerRef.current.seekTo(Number(bounds.end || 0), true); } catch (_) {}
                    youtubeEditorPlayerRef.current.pauseVideo?.();
                    setEditorPlaying(false);
                    setPreviewSegmentMode(false);
                }
            } catch (_) {}
        };
        const onReady = () => {
            if (!alive) return;
            try {
                const d = Number(youtubeEditorPlayerRef.current?.getDuration?.() || 0);
                setEditorDurationSec(Math.max(0, d));
                youtubeEditorPlayerRef.current?.seekTo?.(playbackStartSec, true);
            } catch (_) {}
        };
        const onStateChange = (ev) => {
            const state = Number(ev?.data);
            const playing = state === 1;
            setEditorPlaying(playing);
            clearTick();
            if (playing) youtubeTickRef.current = setInterval(syncCurrent, 180);
        };
        const boot = () => {
            if (!alive || !youtubeEditorHostRef.current || !window.YT?.Player) return;
            youtubeEditorPlayerRef.current?.destroy?.();
            youtubeEditorPlayerRef.current = new window.YT.Player(youtubeEditorHostRef.current, {
                videoId: editorYoutubeId,
                playerVars: {
                    controls: 0,
                    rel: 0,
                    modestbranding: 1,
                    iv_load_policy: 3,
                    playsinline: 1,
                    start: Math.floor(playbackStartSec)
                },
                events: { onReady, onStateChange }
            });
        };
        if (window.YT?.Player) {
            boot();
        } else {
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                try { prev?.(); } catch (_) {}
                boot();
            };
            if (!document.querySelector('script[data-yt-api="1"]')) {
                const s = document.createElement('script');
                s.src = 'https://www.youtube.com/iframe_api';
                s.async = true;
                s.setAttribute('data-yt-api', '1');
                document.body.appendChild(s);
            }
        }
        return () => {
            alive = false;
            clearTick();
            try { youtubeEditorPlayerRef.current?.destroy?.(); } catch (_) {}
            youtubeEditorPlayerRef.current = null;
            setEditorPlaying(false);
        };
    }, [showVideoEditor, editorIsYoutube, editorYoutubeId, playbackStartSec, playbackEndSec]);

    useEffect(() => {
        if (!showVideoEditor || !editorIsYoutube || !youtubeEditorPlayerRef.current?.seekTo) return;
        // En mode vidéo libre, « Suite » et la suppression d'un segment gèrent
        // eux-mêmes la position. Ne pas les renvoyer à 0 après le rendu React.
        if (editorPlaybackMode !== 'segment') return;
        try {
            youtubeEditorPlayerRef.current.pauseVideo?.();
            youtubeEditorPlayerRef.current.seekTo(playbackStartSec, true);
            setEditorCurrentAbsSec(playbackStartSec);
            setSegmentPreviewRelSec(0);
            setPreviewSegmentMode(false);
        } catch (_) {}
    }, [editorPlaybackMode, segmentStart, showVideoEditor, editorIsYoutube]);
    useEffect(() => {
        if (!showVideoEditor) return;
        if (!segmentEndFollowPlayhead) return;
        if (String(selectedSegmentId || '').trim()) return;
        setSegmentEnd(Math.max(0, Math.floor(Number(editorCurrentAbsSec || 0))));
    }, [editorCurrentAbsSec, showVideoEditor, segmentEndFollowPlayhead, selectedSegmentId]);
    const inferredSheetSource = String(
        (Array.isArray(formData.steps) ? formData.steps : [])
            .find((s) => s?.type === 'sheet' && String(s?.sheetUrl || '').trim())?.sheetUrl || ''
    ).trim();
    const inferredVideoSource = String(
        (Array.isArray(formData.steps) ? formData.steps : [])
            .find((s) => s?.type === 'video' && String(s?.videoUrl || '').trim())?.videoUrl || ''
    ).trim();
    const inferredVideoName = String(
        (Array.isArray(formData.steps) ? formData.steps : [])
            .find((s) => s?.type === 'video' && String(s?.videoUrl || '').trim())?.videoSourceName || ''
    ).trim();
    const effectiveGlobalSheetSource = String(globalSheetSourceUrl || inferredSheetSource || '').trim();
    const effectiveGlobalVideoSource = String(globalVideoSourceUrl || inferredVideoSource || '').trim();
    const effectiveGlobalVideoName = String(globalVideoSourceName || inferredVideoName || '').trim();
    const generalSheetMaster = (Array.isArray(formData.steps) ? formData.steps : [])
        .find((step) => step?.type === 'sheet' && step?.isGeneralSheetMaster === true);
    const hasGeneratedGeneralSheet = Boolean(String(generalSheetMaster?.sheetText || '').trim());
    const hasGlobalSheet = effectiveGlobalSheetSource.length > 0 || hasGeneratedGeneralSheet;
    const hasGlobalVideo = effectiveGlobalVideoSource.length > 0;
    const sheetBtnText = (() => {
        if (hasGlobalSheet && globalSlidesWarmup.active) return `✦ FICHE + VIDÉO ${globalSlidesWarmup.percent}%`;
        if (hasGlobalSheet && globalSlidesWarmup.ready) return '✦ FICHE + VIDÉO CHARGÉE';
        if (hasGlobalSheet) return '✦ FICHE + VIDÉO NOTEBOOKLM';
        return '✦ GÉNÉRER FICHE + VIDÉO';
    })();
    const videoBtnText = hasGlobalVideo ? '+ VIDÉO GÉNÉRALE CHARGÉE' : '+ AJOUTER VIDÉO GÉNÉRALE';
    const videoBtnClass = hasGlobalVideo
        ? '!bg-orange-500 !text-white !border-orange-600 hover:!bg-orange-500'
        : '';
    const sheetBtnClass = hasGlobalSheet
        ? '!bg-violet-600 !text-white !border-violet-700 hover:!bg-violet-600'
        : '';

    return (
        <div className="v84-game-container">
            <div className="v84-game-header">
                <div className="flex items-center gap-4">
                    <button
                        className={`v84-res-btn upload ${videoBtnClass}`}
                        onClick={() => openSourcePicker('video')}
                        title={hasGlobalVideo ? `Source: ${effectiveGlobalVideoName || effectiveGlobalVideoSource}` : ''}
                        style={hasGlobalVideo ? { backgroundColor: '#f97316', color: '#ffffff', borderColor: '#ea580c' } : undefined}
                    >
                        {videoBtnText}
                    </button>
                    <button
                        className={`v84-res-btn upload ${sheetBtnClass}`}
                        onClick={openGeneralSheetBuilder}
                        title={hasGeneratedGeneralSheet ? 'Une fiche générale est enregistrée dans cet apprentissage.' : (hasGlobalSheet ? `Source: ${effectiveGlobalSheetSource}` : '')}
                        style={hasGlobalSheet ? { backgroundColor: '#4f46e5', color: '#ffffff', borderColor: '#4338ca' } : undefined}
                    >
                        {sheetBtnText}
                    </button>
                    <input
                        className="v84-game-title-input"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="TITRE APPRENTISSAGE..."
                    />
                    <select
                        className="v84-res-input min-w-[260px]"
                        value={formData.chapterId}
                        onChange={(e) => {
                            const ch = (chapters || []).find(x => String(x._id) === String(e.target.value));
                            setFormData(prev => ({ ...prev, chapterId: e.target.value, subject: ch?.section || prev.subject }));
                        }}
                    >
                        <option value="">Choisir chapitre</option>
                        {availableChapters.map(ch => <option key={ch._id} value={ch._id}>{ch.title}</option>)}
                    </select>
                    <button className="v84-res-btn upload" onClick={loadDefaultsFromGame}>Charger Fiche/Vidéo du Jeu</button>
                </div>
                <button onClick={onClose} className="v84-close-btn">✕</button>
            </div>

            {sourcePickerKind && (
                <div className="fixed inset-0 z-[50020] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-xl p-5">
                        <div className="flex items-center gap-2">
                            <div className="text-[16px] font-black text-slate-800">
                                {sourcePickerKind === 'video' ? 'Ajouter une vidéo générale' : 'Ajouter une fiche générale'}
                            </div>
                            <button className="v84-close-btn ml-auto" onClick={closeSourcePicker}>✕</button>
                        </div>
                        <div className="mt-4 text-[11px] font-black uppercase text-slate-500">
                            Sources existantes
                        </div>
                        <select
                            className="v84-ans-input mt-2"
                            value={sourcePickerExistingUrl}
                            onChange={(e) => {
                                const val = String(e.target.value || '').trim();
                                setSourcePickerExistingUrl(val);
                                if (val) {
                                    setSourcePickerCustomUrl(val);
                                    const hit = (savedVideoSources || []).find((x) => String(x.originalUrl || '').trim() === val);
                                    if (hit?.name) setSourcePickerVideoName(String(hit.name || '').trim());
                                }
                            }}
                        >
                            <option value="">{sourcePickerKind === 'video' ? 'Choisir une vidéo' : 'Choisir une fiche'}</option>
                            {(sourcePickerKind === 'video' ? videoSources : getCandidateSheets()).map((item) => (
                                <option key={`${item.url}`} value={item.url}>
                                    {item.source}
                                </option>
                            ))}
                        </select>
                        <div className="mt-4 text-[11px] font-black uppercase text-slate-500">
                            Nouvelle URL
                        </div>
                        <input
                            className="v84-ans-input mt-2"
                            value={sourcePickerCustomUrl}
                            onChange={(e) => setSourcePickerCustomUrl(e.target.value)}
                            placeholder={sourcePickerKind === 'video' ? 'https://youtube.com/... ou https://drive.google.com/...' : 'https://...'}
                        />
                        {sourcePickerKind === 'video' && (
                            <>
                                <div className="mt-4 text-[11px] font-black uppercase text-slate-500">
                                    Nom de la vidéo (BDD)
                                </div>
                                <input
                                    className="v84-ans-input mt-2"
                                    value={sourcePickerVideoName}
                                    onChange={(e) => setSourcePickerVideoName(e.target.value)}
                                    placeholder="ex: Richesse et pauvreté - Leçon 4"
                                />
                                <div className="mt-4 rounded-xl border-2 border-violet-200 bg-violet-50 p-4">
                                    <div className="text-[12px] font-black uppercase text-violet-900">Préparer les sources NotebookLM</div>
                                    <div className="mt-1 text-[12px] font-bold text-violet-700">
                                        Source 1 : fiche de cours en Google Docs, sans QCM. Source 2 : copie publique des Slides sélectionnés dans la présentation générale de cet apprentissage.
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            className="v84-res-btn upload !border-indigo-300 !bg-indigo-600 !text-white"
                                            onClick={createNotebookLmGoogleDoc}
                                            disabled={creatingNotebookLmSource}
                                        >
                                            📄 Créer le Google Docs de la fiche
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload !border-sky-300 !bg-sky-600 !text-white"
                                            onClick={createNotebookLmPublicSlides}
                                            disabled={creatingNotebookLmSource}
                                        >
                                            🖼️ Créer les Google Slides publics
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload !border-emerald-300 !bg-emerald-600 !text-white"
                                            onClick={copyNotebookLmVideoPrompt}
                                        >
                                            📋 Copier le prompt vidéo
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload !border-violet-300 !bg-violet-600 !text-white"
                                            onClick={openNotebookLm}
                                        >
                                            ↗ Ouvrir NotebookLM
                                        </button>
                                    </div>
                                    <div className="mt-3 rounded-lg border border-violet-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-700">
                                        Présentation générale : {formData.presentationUrl ? 'sélectionnée dans l’apprentissage' : 'aucune présentation choisie dans l’apprentissage'}
                                    </div>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload mt-3 !border-violet-300 !bg-white !text-violet-800"
                                        onClick={() => setShowNotebookSlidesPicker((visible) => !visible)}
                                        disabled={!isGoogleSlidesUrl(formData.presentationUrl || '')}
                                    >
                                        {showNotebookSlidesPicker ? '▴ Fermer le sélecteur de Slides' : '▾ Ouvrir le sélecteur de Slides'}
                                    </button>
                                    {showNotebookSlidesPicker && <>
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="text-[11px] font-black text-violet-800">
                                            {notebookSlidesSelection.length
                                                ? `Slides sélectionnées : ${notebookSlidesSelection[0]}-${notebookSlidesSelection[notebookSlidesSelection.length - 1]}`
                                                : 'Clique une slide de début, puis une slide de fin.'}
                                        </div>
                                        {notebookSlidesSelection.length > 0 && (
                                            <button type="button" className="ml-auto text-[11px] font-black text-violet-700 underline" onClick={() => setNotebookSlidesSelection([])}>
                                                Effacer la sélection
                                            </button>
                                        )}
                                    </div>
                                    <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-violet-200 bg-white p-2">
                                        {notebookSlidesLoading ? (
                                            <div className="p-4 text-center text-[12px] font-bold text-slate-400">Chargement des slides…</div>
                                        ) : notebookSlidesError ? (
                                            <div className="p-4 text-center text-[12px] font-bold text-red-600">{notebookSlidesError}</div>
                                        ) : notebookSlides.length === 0 ? (
                                            <div className="p-4 text-center text-[12px] font-bold text-slate-400">Ajoute l’URL Google Slides pour les voir ici.</div>
                                        ) : (
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {notebookSlides.map((slide) => {
                                                    const number = Number(slide?.slideNumber || 0);
                                                    const selected = notebookSlidesSelection.includes(number);
                                                    const thumbnail = String(slide?.thumbnailProxyUrl || slide?.thumbnailUrl || '').trim();
                                                    return (
                                                        <button
                                                            key={String(slide?.objectId || number)}
                                                            type="button"
                                                            onClick={() => selectNotebookSlideRange(number)}
                                                            className={`overflow-hidden rounded-lg border-2 text-left ${selected ? 'border-violet-600 bg-violet-100' : 'border-slate-200 bg-slate-50 hover:border-violet-300'}`}
                                                            title={`Slide ${number}`}
                                                        >
                                                            {thumbnail ? <img src={thumbnail} alt={`Slide ${number}`} className="h-20 w-full object-cover" /> : <div className="grid h-20 place-items-center text-[11px] font-black text-slate-400">Slide {number}</div>}
                                                            <div className="px-2 py-1 text-[11px] font-black text-slate-700">Slide {number}{selected ? ' ✓' : ''}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    </>}
                                    {formData.generalSheetDocUrl && <div className="mt-2 text-[11px] font-bold text-emerald-800">✓ Google Docs source 1 prêt</div>}
                                    {formData.presentationSourceUrl && <div className="mt-1 text-[11px] font-bold text-sky-800">✓ Google Slides publics source 2 prêts</div>}
                                </div>
                            </>
                        )}
                        <div className="mt-4 text-[12px] font-bold text-slate-500">
                            Cette source sera appliquée à toutes les étapes {sourcePickerKind === 'video' ? 'vidéo' : 'fiche'} du module.
                        </div>
                        <div className="mt-4 flex items-center gap-2">
                            <button className="v84-res-btn upload" onClick={closeSourcePicker}>Annuler</button>
                            {sourcePickerKind === 'video' && (
                                <>
                                    <button
                                        className="v84-res-btn upload bg-slate-700 text-white border-slate-800"
                                        onClick={saveVideoSourceToLibrary}
                                        disabled={savingVideoSource}
                                    >
                                        {savingVideoSource ? 'Sauvegarde...' : 'Sauvegarder'}
                                    </button>
                                    <button
                                        className="v84-res-btn upload bg-sky-600 text-white border-sky-700"
                                        onClick={openGeneralVideoEditor}
                                    >
                                        ✂️ Éditeur de séquences
                                    </button>
                                </>
                            )}
                            <button className="v84-res-btn upload bg-violet-600 text-white border-violet-700" onClick={applySourceToAllSteps}>
                                Appliquer globalement
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showGeneralSheetBuilder && (
                <div className="fixed inset-0 z-[50030] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-violet-200 bg-white shadow-2xl">
                        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-6 py-4">
                            <div>
                                <div className="text-xl font-black text-slate-900">Générer une fiche générale</div>
                                <div className="text-sm font-bold text-slate-500">Le prompt crée la fiche et son QCM. La préparation de la vidéo se fait dans « Vidéo générale ».</div>
                            </div>
                            <button
                                type="button"
                                className="v84-res-btn upload ml-auto !border-violet-300 !bg-violet-50 !text-violet-800"
                                onClick={copyGeminiSuperSheetPrompt}
                            >📋 Copier le prompt fiche + Google Docs et ouvrir Gemini</button>
                            <button className="v84-close-btn" onClick={() => setShowGeneralSheetBuilder(false)}>✕</button>
                        </div>
                        <div className="flex-1 overflow-auto p-6">
                            <div className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-bold text-violet-800">
                                Colle uniquement le contenu situé entre <b>=== DÉBUT FICHE CONDAWEB ===</b> et <b>=== FIN FICHE CONDAWEB ===</b>. La préparation des sources NotebookLM et du prompt vidéo se fait ensuite dans <b>Vidéo générale</b>.
                            </div>
                            <div className="mb-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4">
                                <div className="font-black text-violet-900">🎵 Chanson / audio de la fiche générale</div>
                                <div className="mt-1 text-xs font-bold text-violet-700">Sans découpage, la chanson entière sera présente dans toutes les sous-fiches créées.</div>
                                <input ref={generalSheetMediaInputRef} type="file" accept=".mp3,audio/mpeg,audio/*" className="hidden" onChange={handleGeneralSheetMediaFile} />
                                <button type="button" className="v84-res-btn upload mt-3 !bg-violet-600 !text-white !border-violet-700" onClick={() => generalSheetMediaInputRef.current?.click()} disabled={uploadingSheetMedia}>
                                    {uploadingSheetMedia ? 'Import…' : (generalSheetMedia?.url ? 'Remplacer le MP3 / audio' : 'Ajouter un MP3 / audio')}
                                </button>
                                {generalSheetMedia?.url && (
                                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm font-black text-slate-700">
                                        <span>🎵 {generalSheetMedia.name || 'Média ajouté'}</span>
                                        <label>Début <input type="number" min="0" className="ml-1 w-20 rounded border p-1" value={generalSheetMedia.startSec || 0} onChange={(e) => setGeneralSheetMedia((value) => ({ ...value, startSec: Math.max(0, Number(e.target.value || 0)) }))} /></label>
                                        <label>Fin <input type="number" min="0" className="ml-1 w-20 rounded border p-1" value={generalSheetMedia.endSec || 0} onChange={(e) => setGeneralSheetMedia((value) => ({ ...value, endSec: Math.max(0, Number(e.target.value || 0)) }))} /></label>
                                        <button type="button" className="text-red-600 underline" onClick={() => setGeneralSheetMedia(null)}>Retirer</button>
                                    </div>
                                )}
                            </div>
                            <SheetRichTextEditor
                                html={generalSheetHtml}
                                plainText={generalSheetText}
                                numberedIdeasPlain={usesPlainNumberedIdeas}
                                onChange={({ html, text }) => {
                                    setGeneralSheetHtml(html);
                                    setGeneralSheetText(text);
                                }}
                            />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
                            <div className="flex gap-2">
                                <button type="button" className="v84-res-btn upload" onClick={() => {
                                    setShowGeneralSheetBuilder(false);
                                    openSourcePicker('sheet');
                                }}>
                                    Utiliser une source externe
                                </button>
                                {hasGeneratedGeneralSheet && (
                                    <button type="button" className="v84-res-btn upload !border-red-300 !bg-red-50 !text-red-700" onClick={deleteGeneralSheet}>
                                        Effacer la fiche générale
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button type="button" className="v84-res-btn upload" onClick={() => setShowGeneralSheetBuilder(false)}>Annuler</button>
                                <button
                                    type="button"
                                    className="v84-res-btn upload !bg-violet-600 !text-white !border-violet-700"
                                    onClick={generateLearningFromGeneralSheet}
                                    disabled={!String(generalSheetText || '').trim()}
                                >
                                    Valider et créer les sections
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/60 grid grid-cols-1 md:grid-cols-[minmax(240px,0.8fr)_1fr_220px] gap-3">
                <div>
                    <select
                        className="v84-ans-input !w-full !min-w-0"
                        value={formData.generalSheetCourseId || ''}
                        onChange={(event) => selectGeneralSheetCourse(event.target.value)}
                        disabled={generalSheetCoursesLoading}
                        aria-label="Séquence de cours utilisée pour la fiche générale"
                    >
                        <option value="">{generalSheetCoursesLoading ? 'Chargement des séquences…' : 'Choisir la séquence de cours'}</option>
                        {generalSheetCourses.map((course, courseIndex) => (
                            <option key={course._id} value={course._id}>
                                {`Séquence ${courseIndex + 1}`}
                            </option>
                        ))}
                    </select>
                    {formData.generalSheetCourseId && (
                        <div className="mt-1 text-[10px] font-black uppercase text-emerald-700">
                            {generalSheetCourseAutomatic ? '✓ Séquence proposée automatiquement' : '✓ Séquence choisie manuellement'}
                        </div>
                    )}
                </div>
                <input
                    className="v84-ans-input !w-full !min-w-0"
                    value={formData.presentationUrl || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, presentationUrl: e.target.value }))}
                    placeholder="URL Google Slides (trace écrite)"
                />
                <input
                    className="v84-ans-input !w-full !min-w-0"
                    value={formData.presentationSlidesFocus || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, presentationSlidesFocus: e.target.value }))}
                    placeholder="Slides TE (ex: 8-12,15)"
                />
            </div>

            <div className="v84-game-body">
                <div className="v84-q-list-sidebar custom-scrollbar">
                    <div className="mb-3">
                        <button className="v84-add-q-btn w-full" onClick={addSection}>+ SECTION</button>
                    </div>
                    <div className="max-h-[58vh] overflow-y-auto pr-1 custom-scrollbar">
                        {(formData.sections || []).map((sec) => (
                            <div
                                key={sec.id}
                                className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-2"
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                }}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const from = dragStepIdx ?? Number(e.dataTransfer.getData('text/plain'));
                                    if (Number.isInteger(from) && from >= 0 && from < (formData.steps || []).length) {
                                        assignStepToSection(from, sec.id);
                                    }
                                    setDragStepIdx(null);
                                }}
                            >
                                <div className="mb-2">
                                    <div className="flex items-center gap-2">
                                    <input
                                        className="v84-ans-input !h-9 !w-auto !min-w-0 flex-1 !text-[22px] !font-black mb-2 leading-none placeholder:!text-slate-400"
                                        value={String(sec.name || '')}
                                        onChange={(e) => renameSection(sec.id, e.target.value)}
                                        placeholder="Nouveau"
                                    />
                                    <button
                                        type="button"
                                        className="v84-del-btn mb-2 shrink-0"
                                        style={{ position: 'static', transform: 'none', width: '32px', height: '32px', fontSize: '16px', opacity: 1 }}
                                        onClick={() => removeSection(sec.id)}
                                        title="Supprimer cette partie et ses activités"
                                        aria-label={`Supprimer la partie ${sec.name || ''}`}
                                    >✕</button>
                                    </div>
                                    <button
                                        className={`v84-add-q-btn w-full !py-1 !text-[11px] ${sec.visible === false ? '!bg-slate-200 !text-slate-700 !border-slate-300' : '!bg-emerald-100 !text-emerald-800 !border-emerald-300'}`}
                                        onClick={() => toggleSectionVisible(sec.id)}
                                        title="Rendre cette section visible/masquée côté élève"
                                    >
                                        {sec.visible === false ? 'Rendre visible' : 'Masquer cette section'}
                                    </button>
                                </div>
                                {(formData.steps || []).map((s, idx) => {
                                    if (!stepBelongsToSection(s, sec.id)) return null;
                                    return (
                                        <div
                                            key={s.id || idx}
                                            className={`v84-level-header ${activeStep === idx ? 'active-lvl' : ''}`}
                                            onClick={() => setActiveStep(idx)}
                                            draggable
                                            onDragStart={(e) => {
                                                setDragStepIdx(idx);
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData('text/plain', String(idx));
                                            }}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                e.dataTransfer.dropEffect = 'move';
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                const from = dragStepIdx ?? Number(e.dataTransfer.getData('text/plain'));
                                                moveStepTo(Number(from), idx);
                                                setDragStepIdx(null);
                                            }}
                                            onDragEnd={() => setDragStepIdx(null)}
                                        >
                                            {s.type === 'sheet' ? '📄' : s.type === 'video' ? '🎬' : s.type === 'quiz' ? '🎮' : '🎤'} {s.title || `Étape ${idx + 1}`}
                                            <div className="flex ml-auto gap-1">
                                                <button className="v84-del-btn" onClick={(e) => { e.stopPropagation(); moveStepInSection(idx, -1, sec.id); }}>↑</button>
                                                <button className="v84-del-btn" onClick={(e) => { e.stopPropagation(); moveStepInSection(idx, 1, sec.id); }}>↓</button>
                                                <button className="v84-del-btn" onClick={(e) => { e.stopPropagation(); removeStep(idx); }}>✕</button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="grid grid-cols-2 gap-1 mt-2">
                                    <button className="v84-add-q-btn !py-1 !text-[11px]" onClick={() => addStep('sheet', sec.id)}>+ FICHE</button>
                                    <button className="v84-add-q-btn !py-1 !text-[11px]" onClick={() => addStep('video', sec.id)}>+ VIDÉO</button>
                                    <button className="v84-add-q-btn !py-1 !text-[11px]" onClick={() => addStep('question', sec.id)}>+ QUESTIONS IA</button>
                                    <button className="v84-add-q-btn !py-1 !text-[11px] !border-amber-300 !bg-amber-50 !text-amber-800" onClick={() => addStep('quiz', sec.id)}>+ QUIZ JEUX</button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 gap-2 mt-4">
                        <div className="text-[11px] font-black uppercase text-slate-400 px-1">
                            Crée les activités depuis une section.
                        </div>
                    </div>
                </div>

                <div className="v84-game-editor custom-scrollbar">
                    {!step && (
                        <div className="flex items-center justify-center h-full text-slate-300 font-bold uppercase">
                            Ajoutez puis sélectionnez une étape
                        </div>
                    )}
                    {step && (
                        <div className="v84-q-card">
                            <div className="hw-section-title">Nom de l'étape</div>
                            <input
                                className="v84-ans-input"
                                value={step.title || ''}
                                onChange={(e) => updateStep(activeStep, { title: e.target.value })}
                            />
                            <div className="hw-section-title mt-3">Section</div>
                            <select
                                className="v84-ans-input"
                                value={String(step.sectionId || getDefaultSectionId())}
                                onChange={(e) => updateStep(activeStep, { sectionId: String(e.target.value || getDefaultSectionId()) })}
                            >
                                {(formData.sections || []).map((sec) => (
                                    <option key={sec.id} value={sec.id}>{sec.name}</option>
                                ))}
                            </select>

                            {step.type === 'sheet' && (
                                <>
                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <div className="hw-section-title !mt-0">Source fiche (menu)</div>
                                        {(String(step.sheetUrl || '').trim() || String(step.sheetText || '').trim()) && (
                                            <button
                                                type="button"
                                                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-red-200 bg-red-50 text-[14px] font-black text-red-600 shadow-sm hover:bg-red-600 hover:text-white"
                                                onClick={confirmClearSheetStep}
                                                title="Supprimer la fiche de cette étape"
                                                aria-label="Supprimer la fiche"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        className="v84-ans-input"
                                        value={(() => {
                                            const current = String(step.sheetUrl || '').trim();
                                            const exists = getCandidateSheets().some((item) => String(item.url || '').trim() === current);
                                            return exists ? current : '';
                                        })()}
                                        onChange={(e) => updateStep(activeStep, { sheetUrl: e.target.value })}
                                    >
                                        <option value="">Choisir une fiche source</option>
                                        {getCandidateSheets().map((item) => (
                                            <option key={item.url} value={item.url}>{item.source} - {item.url.slice(0, 50)}...</option>
                                        ))}
                                    </select>
                                    <div className="hw-section-title mt-4">URL fiche</div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            className="v84-ans-input"
                                            value={step.sheetUrl || ''}
                                            onChange={(e) => updateStep(activeStep, { sheetUrl: e.target.value })}
                                            onPaste={handlePasteSheet}
                                            placeholder="/api/structure/proxy/..."
                                        />
                                        <button
                                            type="button"
                                            className="v84-res-btn upload whitespace-nowrap"
                                            onClick={() => sheetImportInputRef.current?.click()}
                                            disabled={importingSheet}
                                        >
                                            {importingSheet ? 'Import...' : 'Importer'}
                                        </button>
                                    </div>
                                    <input
                                        ref={sheetImportInputRef}
                                        type="file"
                                        accept=".pdf,.doc,.docx,.txt,.md,.rtf,.png,.jpg,.jpeg,.webp"
                                        className="hidden"
                                        onChange={handleImportSheetFile}
                                    />
                                    <div className="hw-section-title mt-4">Aperçu fiche</div>
                                    <div
                                        className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-[220px]"
                                        tabIndex={0}
                                        onPaste={handlePasteSheet}
                                        title="Clique ici puis Ctrl/Cmd+V pour coller une image ou une URL de fiche"
                                    >
                                        {!String(step.sheetUrl || '').trim() ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm text-center px-4">
                                                Ajoute une URL de fiche pour voir l'aperçu.
                                                <br />
                                                Ctrl/Cmd+V ici pour coller une image.
                                            </div>
                                        ) : isImageLike(resolveDriveAssetUrl(step.sheetUrl || '')) ? (
                                            <img
                                                src={resolveDriveAssetUrl(step.sheetUrl || '')}
                                                alt="aperçu fiche"
                                                className="w-full h-full object-contain bg-white"
                                            />
                                        ) : isGoogleSlidesUrl(step.sheetUrl || '') && buildSpecificGoogleSlidePreviewUrl(step.sheetUrl || '') ? (
                                            <img
                                                src={buildSpecificGoogleSlidePreviewUrl(step.sheetUrl || '')}
                                                alt="aperçu slide Google Slides"
                                                className="w-full h-full object-contain bg-white"
                                            />
                                        ) : (
                                            <iframe
                                                title={`sheet-preview-${step.id}`}
                                                src={isGoogleSlidesUrl(step.sheetUrl || '')
                                                    ? toGoogleSlidesReadOnlyUrl(step.sheetUrl || '')
                                                    : resolveDriveAssetUrl(step.sheetUrl || '')}
                                                className="w-full h-full bg-white"
                                            />
                                        )}
                                    </div>
                                    <div className="hw-section-title mt-4">Lecture minimale (secondes)</div>
                                    <input
                                        type="number"
                                        min="5"
                                        max="600"
                                        className="v84-ans-input"
                                        value={step.minReadSeconds || 20}
                                        onChange={(e) => updateStep(activeStep, { minReadSeconds: Number(e.target.value || 20) })}
                                    />
                                    <div className="mt-5 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4">
                                        <div className="text-base font-black text-violet-900">🎵 Chanson / audio associé à cette fiche</div>
                                        <div className="mt-1 text-xs font-bold text-violet-700">Ajoute un MP3. Le découpage début/fin est celui que les élèves écouteront.</div>
                                        <input
                                            ref={sheetMediaInputRef}
                                            type="file"
                                            accept=".mp3,audio/mpeg,audio/*"
                                            className="hidden"
                                            onChange={handleSheetMediaFile}
                                        />
                                        <button
                                            type="button"
                                            className="v84-res-btn upload mt-3 bg-violet-600 text-white border-violet-700"
                                            onClick={() => sheetMediaInputRef.current?.click()}
                                            disabled={uploadingSheetMedia}
                                        >
                                            {uploadingSheetMedia ? 'Import de la chanson…' : 'Ajouter un MP3 / audio'}
                                        </button>
                                        {(Array.isArray(step.sheetMediaItems) ? step.sheetMediaItems : (step.sheetMediaUrl ? [{ id: 'legacy', url: step.sheetMediaUrl, name: step.sheetMediaName, type: step.sheetMediaType, startSec: step.sheetMediaStartSec, endSec: step.sheetMediaEndSec }] : [])).map((media, mediaIndex) => (
                                            <div key={media.id || mediaIndex} className="mt-3 rounded-xl border border-violet-200 bg-white p-3">
                                                <div className="mb-2 text-sm font-black text-slate-700">🎵 {media.name || `Chanson ${mediaIndex + 1}`}</div>
                                                {String(media.type || '').startsWith('video/')
                                                    ? <video src={resolveBackendAssetUrl(resolveDriveAssetUrl(media.url))} controls className="w-full max-h-56 rounded-lg bg-slate-950" />
                                                    : <audio src={resolveBackendAssetUrl(resolveDriveAssetUrl(media.url))} controls className="w-full" />}
                                                <div className="mt-3 grid grid-cols-2 gap-3">
                                                    <label className="text-xs font-black text-slate-600">✂️ Début (sec)<input type="number" min="0" step="1" className="v84-ans-input mt-1" value={Number(media.startSec || 0)} onChange={(e) => updateStep(activeStep, { sheetMediaItems: step.sheetMediaItems.map((item, index) => index === mediaIndex ? { ...item, startSec: Math.max(0, Number(e.target.value || 0)) } : item) })} /></label>
                                                    <label className="text-xs font-black text-slate-600">✂️ Fin (sec, 0 = entier)<input type="number" min="0" step="1" className="v84-ans-input mt-1" value={Number(media.endSec || 0)} onChange={(e) => updateStep(activeStep, { sheetMediaItems: step.sheetMediaItems.map((item, index) => index === mediaIndex ? { ...item, endSec: Math.max(0, Number(e.target.value || 0)) } : item) })} /></label>
                                                </div>
                                                <button type="button" className="mt-3 text-xs font-black text-red-600 underline" onClick={() => updateStep(activeStep, { sheetMediaItems: step.sheetMediaItems.filter((_, index) => index !== mediaIndex) })}>Retirer cette chanson</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-2">
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-pink-600 text-white border-pink-700"
                                            onClick={openKeywordModal}
                                        >
                                            Éditer texte / zones réponses
                                        </button>
                                    </div>
                                    <div className="mt-7 border-t-4 border-slate-200 pt-6">
                                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <div className="text-lg font-black uppercase text-slate-800">Grand éditeur de texte</div>
                                                <div className="text-xs font-bold text-slate-400">Colle puis modifie librement le contenu de la fiche.</div>
                                            </div>
                                            <button
                                                type="button"
                                                className="rounded-xl border-2 border-red-300 bg-red-50 px-5 py-3 text-sm font-black uppercase text-red-700 shadow-sm transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                                onClick={confirmClearSheetStep}
                                                disabled={step.isGeneralSheetMaster === true
                                                    || (!String(step.sheetUrl || '').trim() && !String(step.sheetText || '').trim())}
                                            >
                                                {step.isGeneralSheetMaster === true
                                                    ? '🔒 Fiche générale conservée'
                                                    : '🗑️ Supprimer la fiche'}
                                            </button>
                                        </div>
                                        <SheetRichTextEditor
                                            key={`${step.id}:${step.generalSheetSyncVersion || 0}`}
                                            html={step.sheetTextHtml || ''}
                                            plainText={step.sheetText || ''}
                                            numberedIdeasPlain={usesPlainNumberedIdeas}
                                            onChange={({ html, text }) => {
                                                sheetDraftsRef.current.set(String(step.id || ''), { html, text });
                                                updateStep(activeStep, {
                                                    sheetTextHtml: html,
                                                    sheetText: text,
                                                });
                                            }}
                                        />
                                        <div className="mt-2 text-sm font-bold text-slate-400">
                                            {String(step.sheetText || '').length.toLocaleString('fr-FR')} caractère(s) — sauvegardé avec l’apprentissage.
                                        </div>
                                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                            {[
                                                { mode: 'plan', label: 'Plan', icon: '📋' },
                                                { mode: 'full', label: 'Fiche', icon: '📄' }
                                            ].map(({ mode, label, icon }) => {
                                                const exists = formData.steps.some((candidate) => candidate?.type === 'question'
                                                    && String(candidate?.autoLinkedSheetId || '') === String(step.id || '')
                                                    && (candidate?.autoLinkedSheetMode === 'plan' ? 'plan' : 'full') === mode);
                                                return (
                                                    <button
                                                        key={mode}
                                                        type="button"
                                                        className="w-full rounded-2xl border-2 border-violet-500 bg-violet-600 px-6 py-4 text-base font-black uppercase text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-violet-700"
                                                        onClick={() => createOrInspectSheetQuestion(activeStep, mode)}
                                                    >
                                                        {exists ? `👁 Inspecter ${label}` : `${icon} Créer ${label}`}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </>
                            )}

                            {step.type === 'quiz' && (
                                <div className="mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4">
                                    <div className="mb-1 text-lg font-black text-amber-900">🎮 Banque de questions pour les jeux</div>
                                    <div className="mb-4 text-xs font-bold text-amber-700">Cette étape est enregistrée avec l’apprentissage, mais reste invisible dans sa lecture côté élève.</div>
                                    <div className="space-y-4">
                                        {(Array.isArray(step.quizQuestions) ? step.quizQuestions : []).map((quizQuestion, questionIndex) => (
                                            <div key={quizQuestion.id || questionIndex} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm">
                                                <div className="mb-2 flex items-center gap-2">
                                                    <span className="font-black text-amber-800">Question {questionIndex + 1}</span>
                                                    <button
                                                        type="button"
                                                        className="v84-del-btn ml-auto"
                                                        onClick={() => updateStep(activeStep, {
                                                            quizQuestions: step.quizQuestions.filter((_, index) => index !== questionIndex)
                                                        })}
                                                    >✕</button>
                                                </div>
                                                <textarea
                                                    className="v84-ans-input min-h-[78px]"
                                                    value={quizQuestion.question || ''}
                                                    onChange={(event) => {
                                                        const quizQuestions = step.quizQuestions.map((row, index) => index === questionIndex
                                                            ? { ...row, question: event.target.value }
                                                            : row);
                                                        updateStep(activeStep, { quizQuestions });
                                                    }}
                                                    placeholder="Question du QCM"
                                                />
                                                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                                                    {(Array.isArray(quizQuestion.choices) ? quizQuestion.choices : ['', '', '', '']).map((choice, choiceIndex) => (
                                                        <label key={choiceIndex} className={`flex items-center gap-2 rounded-xl border p-2 ${Number(quizQuestion.correctIndex) === choiceIndex ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                                                            <input
                                                                type="radio"
                                                                name={`quiz-correct-${step.id}-${questionIndex}`}
                                                                checked={Number(quizQuestion.correctIndex) === choiceIndex}
                                                                onChange={() => {
                                                                    const quizQuestions = step.quizQuestions.map((row, index) => index === questionIndex
                                                                        ? { ...row, correctIndex: choiceIndex }
                                                                        : row);
                                                                    updateStep(activeStep, { quizQuestions });
                                                                }}
                                                            />
                                                            <input
                                                                className="min-w-0 flex-1 bg-transparent font-bold outline-none"
                                                                value={choice || ''}
                                                                onChange={(event) => {
                                                                    const choices = [...quizQuestion.choices];
                                                                    choices[choiceIndex] = event.target.value;
                                                                    const quizQuestions = step.quizQuestions.map((row, index) => index === questionIndex
                                                                        ? { ...row, choices }
                                                                        : row);
                                                                    updateStep(activeStep, { quizQuestions });
                                                                }}
                                                                placeholder={`Réponse ${String.fromCharCode(65 + choiceIndex)}`}
                                                            />
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        className="v84-add-q-btn mt-4 w-full !border-amber-300 !bg-white !text-amber-800"
                                        onClick={() => updateStep(activeStep, {
                                            quizQuestions: [...(step.quizQuestions || []), { id: uid(), question: '', choices: ['', '', '', ''], correctIndex: 0 }]
                                        })}
                                    >+ Ajouter une question</button>
                                </div>
                            )}

                            {step.type === 'video' && (
                                <>
                                    <div className="hw-section-title mt-4">Source vidéo</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {(() => {
                                            const currentVideoUrl = String(step.videoUrl || '').trim();
                                            const existsInSources = videoSources.some((item) => String(item.url || '').trim() === currentVideoUrl);
                                            return (
                                        <select
                                            className="v84-ans-input"
                                            value={(() => {
                                                const current = String(step.videoUrl || '').trim();
                                                const exists = videoSources.some((item) => String(item.url || '').trim() === current);
                                                return exists ? current : '';
                                            })()}
                                            onChange={(e) => {
                                                const url = String(e.target.value || '').trim();
                                                updateStep(activeStep, {
                                                    videoUrl: url,
                                                    startSec: 0,
                                                    endSec: 0,
                                                    videoTranscript: ''
                                                });
                                                setSelectedSegmentId('');
                                                setSelectedSegmentLabel('');
                                                setSelectedSegmentTranscript('');
                                                setLastSavedSegmentLabel('');
                                                setLastSavedSegmentTranscript('');
                                                setVideoSequencePreviewStepId('');
                                                if (url) refreshKnownSegments(url, step.id);
                                            }}
                                        >
                                            <option value="">Choisir une vidéo source</option>
                                            {currentVideoUrl && !existsInSources && (
                                                <option value={currentVideoUrl}>
                                                    Source actuelle
                                                </option>
                                            )}
                                            {videoSources.map((item) => (
                                                <option key={item.url} value={item.url}>{item.source}</option>
                                            ))}
                                        </select>
                                            );
                                        })()}
                                        <select
                                            className="v84-ans-input"
                                            value={selectedSegmentId}
                                            onChange={(e) => {
                                                const sid = String(e.target.value || '');
                                                if (!sid) {
                                                    setSelectedSegmentId('');
                                                    return;
                                                }
                                                const seg = knownSegments.find((s) => String(s._id || s.id || '') === sid);
                                                if (seg) applyKnownSegment(seg);
                                            }}
                                            disabled={!String(step.videoUrl || '').trim()}
                                        >
                                            <option value="">Choisir une séquence vidéo</option>
                                            {knownSegments.map((seg, i) => {
                                                const sid = String(seg._id || seg.id || '');
                                                const label = String(seg.label || `Séquence ${i + 1}`);
                                                return <option key={sid || i} value={sid}>{label} ({seg.startSec}-{seg.endSec || 'fin'})</option>;
                                            })}
                                        </select>
                                    </div>
                                    <div className="hw-section-title mt-4">URL vidéo</div>
                                    <input
                                        className="v84-ans-input"
                                        value={step.videoUrl || ''}
                                        onChange={(e) => updateStep(activeStep, { videoUrl: e.target.value })}
                                        onBlur={(e) => cloneLocalSegmentsToOnlineUrl(e.currentTarget.value)}
                                        placeholder="https://..."
                                    />
                                    <div className="mt-3 rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-3">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <label className="cursor-pointer rounded-xl bg-sky-600 px-4 py-3 text-xs font-black text-white shadow">
                                                📁 Ajouter une vidéo locale
                                                <input type="file" accept="video/mp4,video/webm,video/ogg,video/*" className="hidden" onChange={(event) => { chooseLocalVideo(event.target.files?.[0]); event.target.value = ''; }} />
                                            </label>
                                            <div className="min-w-0 text-xs font-bold text-sky-900">
                                                {activeStepUsesLocalVideo ? <><strong>{localVideoName}</strong><br />Découpage local actif. Tu pourras ensuite coller l’URL en ligne dans le champ ci-dessus.</> : 'Le fichier reste sur cet ordinateur ; seules les secondes de découpage sont enregistrées.'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-violet-600 text-white border-violet-700"
                                            onClick={openVideoEditor}
                                            disabled={!step.videoUrl && !activeStepUsesLocalVideo}
                                        >
                                            ✂️ Éditeur de séquences
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-emerald-600 text-white border-emerald-700"
                                            disabled={!selectedSegmentId}
                                            onClick={() => setVideoSequencePreviewStepId(`${String(step.id || '')}:${Date.now()}`)}
                                        >
                                            ▶ Play la séquence
                                        </button>
                                        {!selectedSegmentId && <span className="text-xs font-bold text-violet-700">Choisissez d’abord une séquence dans le sélecteur ci-dessus.</span>}
                                    </div>
                                    {videoSequencePreviewStepId.startsWith(`${String(step.id || '')}:`) && selectedSegmentId && selectedSegment && (
                                        <div className="mt-3 overflow-hidden rounded-2xl border-2 border-emerald-300 bg-black shadow-lg">
                                            <div className="flex items-center justify-between bg-emerald-50 px-4 py-2">
                                                <span className="text-xs font-black uppercase text-emerald-800">Lecture de la séquence sélectionnée</span>
                                                <button type="button" className="font-black text-red-600" onClick={() => setVideoSequencePreviewStepId('')}>✕</button>
                                            </div>
                                            <div className="h-[260px]">
                                                {activeStepUsesLocalVideo || isProbablyDirectVideo(resolveDriveAssetUrl(step.videoUrl || '')) ? (
                                                    <video
                                                        key={`compact-preview-${videoSequencePreviewStepId}`}
                                                        src={activeStepUsesLocalVideo ? localVideoPreviewUrl : resolveDriveAssetUrl(step.videoUrl || '')}
                                                        controls
                                                        autoPlay
                                                        className="h-full w-full object-contain bg-black"
                                                        onLoadedMetadata={(event) => { try { event.currentTarget.currentTime = Math.max(0, Number(selectedSegment.startSec || 0)); } catch (_) {} }}
                                                        onTimeUpdate={(event) => {
                                                            const end = Math.max(0, Number(selectedSegment.endSec || 0));
                                                            if (end > 0 && event.currentTarget.currentTime >= end) event.currentTarget.pause();
                                                        }}
                                                    />
                                                ) : (
                                                    <iframe
                                                        key={`compact-youtube-preview-${videoSequencePreviewStepId}`}
                                                        title={`compact-video-preview-${step.id}`}
                                                        src={withAutoplay(withSegmentParams(
                                                            toEmbedUrl(resolveDriveAssetUrl(step.videoUrl || '')),
                                                            Number(selectedSegment.startSec || 0),
                                                            Number(selectedSegment.endSec || 0)
                                                        ))}
                                                        className="h-full w-full bg-black"
                                                        allow="autoplay; encrypted-media; picture-in-picture"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {false && <>
                                    <div className="hw-section-title mt-4">Aperçu vidéo / séquence</div>
                                    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-[220px]">
                                        {!String(step.videoUrl || '').trim() && !activeStepUsesLocalVideo ? (
                                            <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">Ajoute une URL vidéo pour voir l'aperçu.</div>
                                        ) : activeStepUsesLocalVideo || isProbablyDirectVideo(resolveDriveAssetUrl(step.videoUrl || '')) ? (
                                            <video
                                                key={`${activeStepUsesLocalVideo ? localVideoPreviewUrl : resolveDriveAssetUrl(step.videoUrl || '')}_${Number(step.startSec || 0)}_${Number(step.endSec || 0)}`}
                                                ref={videoPreviewRef}
                                                src={activeStepUsesLocalVideo ? localVideoPreviewUrl : resolveDriveAssetUrl(step.videoUrl || '')}
                                                controls
                                                className="w-full h-full object-contain bg-black"
                                                onLoadedMetadata={(e) => {
                                                    const el = e.currentTarget;
                                                    const start = Math.max(0, Number(step.startSec || 0));
                                                    if (start > 0) {
                                                        try { el.currentTime = start; } catch (_) {}
                                                    }
                                                }}
                                                onSeeking={(e) => {
                                                    const el = e.currentTarget;
                                                    const start = Math.max(0, Number(step.startSec || 0));
                                                    const end = Math.max(0, Number(step.endSec || 0));
                                                    if (start > 0 && el.currentTime < start - 0.15) {
                                                        try { el.currentTime = start; } catch (_) {}
                                                        return;
                                                    }
                                                    if (end > 0 && end > start && el.currentTime > end) {
                                                        try { el.currentTime = Math.max(start, end - 0.1); } catch (_) {}
                                                    }
                                                }}
                                                onTimeUpdate={(e) => {
                                                    const el = e.currentTarget;
                                                    const start = Math.max(0, Number(step.startSec || 0));
                                                    const end = Math.max(0, Number(step.endSec || 0));
                                                    if (start > 0 && el.currentTime < start - 0.15) {
                                                        try { el.currentTime = start; } catch (_) {}
                                                        return;
                                                    }
                                                    if (end > 0 && end > start && el.currentTime >= end - 0.15) {
                                                        try { el.pause(); } catch (_) {}
                                                    }
                                                }}
                                            />
                                        ) : (
                                            <iframe
                                                title={`video-preview-${step.id}`}
                                                src={withSegmentParams(toEmbedUrl(resolveDriveAssetUrl(step.videoUrl || '')), Number(step.startSec || 0), Number(step.endSec || 0))}
                                                className="w-full h-full bg-black"
                                                allow="autoplay; encrypted-media; picture-in-picture"
                                            />
                                        )}
                                    </div>
                                    <div className="mt-2 text-[12px] font-bold text-slate-500">
                                        Segment actif: {Math.max(0, Number(step.startSec || 0))}s → {Math.max(0, Number(step.endSec || 0)) > 0 ? `${Math.max(0, Number(step.endSec || 0))}s` : 'fin'}
                                    </div>
                                    <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-3">
                                        <div className="hw-section-title !mt-0">Séquence vidéo utilisée par cette étape</div>
                                        <select
                                            className="v84-ans-input"
                                            value={selectedSegmentId}
                                            onFocus={() => {
                                                if (String(step.videoUrl || '').trim()) refreshKnownSegments(step.videoUrl, step.id);
                                            }}
                                            onChange={(e) => {
                                                const sid = String(e.target.value || '');
                                                if (!sid) {
                                                    setSelectedSegmentId('');
                                                    updateStep(activeStep, { startSec: 0, endSec: 0, videoTranscript: '' });
                                                    return;
                                                }
                                                const seg = knownSegments.find((s) => String(s._id || s.id || '') === sid);
                                                if (seg) applyKnownSegment(seg);
                                            }}
                                            disabled={!String(step.videoUrl || '').trim()}
                                        >
                                            <option value="">Vidéo entière / aucune séquence</option>
                                            {knownSegments.map((seg, i) => {
                                                const sid = String(seg._id || seg.id || '');
                                                const label = String(seg.label || `Séquence ${i + 1}`);
                                                return <option key={sid || i} value={sid}>{label} ({seg.startSec}-{seg.endSec || 'fin'})</option>;
                                            })}
                                        </select>
                                        <div className="mt-2 text-[11px] font-bold text-violet-700">
                                            Choisis ici une des séquences créées pour cette URL vidéo.
                                        </div>
                                    </div>
                                    <div className="hw-section-title mt-4">Nombre de questions sur cette séquence</div>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        className="v84-ans-input"
                                        value={Number(step.questionCount || 3)}
                                        onChange={(e) => updateStep(activeStep, { questionCount: Math.max(1, Math.min(20, Number(e.target.value || 3))) })}
                                    />
                                    <div className="hw-section-title mt-4">Image preview (thumbnail)</div>
                                    <input
                                        className="v84-ans-input"
                                        value={step.thumbnailUrl || ''}
                                        onChange={(e) => updateStep(activeStep, { thumbnailUrl: e.target.value })}
                                        placeholder="https://..."
                                    />
                                    <div className="grid grid-cols-2 gap-3 mt-4">
                                        <div>
                                            <div className="hw-section-title">Début segment (sec)</div>
                                            <input
                                                type="number"
                                                min="0"
                                                className="v84-ans-input"
                                                value={Number(step.startSec || 0)}
                                                onChange={(e) => updateStep(activeStep, { startSec: Math.max(0, Number(e.target.value || 0)) })}
                                                placeholder="ex: 80"
                                            />
                                        </div>
                                        <div>
                                            <div className="hw-section-title">Fin segment (sec, 0 = fin vidéo)</div>
                                            <input
                                                type="number"
                                                min="0"
                                                className="v84-ans-input"
                                                value={Number(step.endSec || 0)}
                                                onChange={(e) => updateStep(activeStep, { endSec: Math.max(0, Number(e.target.value || 0)) })}
                                                placeholder="ex: 170"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-4 p-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-bold text-slate-500">
                                        Le texte vidéo vient des segments sauvegardés dans l’éditeur de séquences.
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <button type="button" className="v84-res-btn upload" onClick={openVideoEditor} disabled={!step.videoUrl && !activeStepUsesLocalVideo}>
                                            Éditeur Séquences
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-indigo-600 text-white border-indigo-700"
                                            onClick={generateQuestionsFromCurrentResource}
                                            disabled={aiTesting || !String(step.videoUrl || '').trim()}
                                        >
                                            {aiTesting ? 'Génération...' : 'Générer questions par IA'}
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-pink-600 text-white border-pink-700"
                                            onClick={openKeywordModal}
                                        >
                                            Éditer texte / zones réponses
                                        </button>
                                    </div>
                                    </>}
                                </>
                            )}

                            {step.type === 'question' && (
                                <>
                                    <div className="hw-section-title mt-4">Source</div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        <input
                                            className="v84-ans-input"
                                            value={forcedQuestionSource ? (forcedQuestionSource.kind === 'video' ? 'Section vidéo (étape précédente)' : 'Fiche (étape précédente)') : 'Aucune source précédente'}
                                            readOnly
                                        />
                                        <input
                                            className="v84-ans-input"
                                            value={forcedQuestionSource ? forcedQuestionSource.label : 'Ajoute une fiche ou une vidéo juste avant cette Question IA'}
                                            readOnly
                                        />
                                    </div>
                                    <div className="mt-3">
                                        <div className="text-[11px] font-black uppercase text-slate-500 mb-2">Source affichée</div>
                                        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden h-[200px]">
                                            {!selectedQuestionSource?.url ? (
                                                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">
                                                    Aucune source sélectionnée.
                                                </div>
                                            ) : selectedQuestionSource.type === 'video' ? (
                                                isProbablyDirectVideo(resolveDriveAssetUrl(selectedQuestionSource.url || '')) ? (
                                                    <video
                                                        src={resolveDriveAssetUrl(selectedQuestionSource.url || '')}
                                                        controls
                                                        className="w-full h-full object-contain bg-black"
                                                    />
                                                ) : (
                                                    <iframe
                                                        title={`question-source-preview-${step.id}`}
                                                        src={toEmbedUrl(resolveDriveAssetUrl(selectedQuestionSource.url || ''))}
                                                        className="w-full h-full bg-black"
                                                        allow="autoplay; encrypted-media; picture-in-picture"
                                                    />
                                                )
                                            ) : isImageLike(resolveDriveAssetUrl(selectedQuestionSource.url || '')) ? (
                                                <img
                                                    src={resolveDriveAssetUrl(selectedQuestionSource.url || '')}
                                                    alt="aperçu source question"
                                                    className="w-full h-full object-contain bg-white"
                                                />
                                            ) : (
                                                <iframe
                                                    title={`question-source-preview-${step.id}`}
                                                    src={resolveDriveAssetUrl(selectedQuestionSource.url || '')}
                                                    className="w-full h-full bg-white"
                                                />
                                            )}
                                        </div>
                                    </div>
                                    <div className="mt-2">
                                        <button
                                            type="button"
                                            className="v84-res-btn upload whitespace-nowrap"
                                            onClick={openQuestionEditor}
                                        >
                                            Éditer
                                        </button>
                                        {!!questionSourceNotice && (
                                            <div className="mt-2 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 inline-flex items-center gap-2">
                                                <span>{questionSourceNotice}</span>
                                                <button
                                                    type="button"
                                                    className="underline text-indigo-700"
                                                    onClick={openVideoEditorFromQuestionSource}
                                                >
                                                    Ouvrir l'éditeur vidéo
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-4 rounded-2xl border-2 border-indigo-100 bg-indigo-50/50 p-3">
                                        <div className="mb-2 text-[11px] font-black uppercase text-indigo-700">Mode proposé à l’élève</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                className={`rounded-xl border-2 px-3 py-3 text-left text-[12px] font-black ${String(step.questionMode || 'easy') !== 'hard' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'}`}
                                                onClick={() => updateStep(activeStep, { questionMode: 'easy' })}
                                            >
                                                Facile · texte à trous
                                                <span className="mt-1 block text-[10px] font-bold opacity-75">Correction locale, sans IA.</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={`rounded-xl border-2 px-3 py-3 text-left text-[12px] font-black ${String(step.questionMode || '') === 'hard' ? 'border-violet-500 bg-violet-50 text-violet-800' : 'border-slate-200 bg-white text-slate-500'}`}
                                                onClick={() => updateStep(activeStep, { questionMode: 'hard' })}
                                            >
                                                Difficile · récitation GPT
                                                <span className="mt-1 block text-[10px] font-bold opacity-75">Le GPT relève les oublis puis renvoie la validation.</span>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="hw-section-title mt-4">Texte attendu et questions facultatives</div>
                                    {questionSectionsFromDb.length > 0 ? (
                                        <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-3 max-h-[440px] overflow-auto">
                                            {questionSectionsFromDb.map((section) => (
                                                <div key={`sec_db_${section.idx}`} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-2">
                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                        <div className="text-[11px] font-black uppercase text-indigo-700">
                                                            Section {section.idx + 1} · questions IA modifiables
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {section.rows.map((q, i) => renderSectionQuestionEditor(section.idx, q, i))}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                                                        <label className="text-[10px] font-black uppercase text-slate-500">Nombre</label>
                                                        <input
                                                            type="number"
                                                            min="1"
                                                            max="20"
                                                            className="v84-ans-input !w-[80px] !py-2 !text-[12px]"
                                                            value={Number(step.questionCount || 3)}
                                                            onChange={(e) => updateStep(activeStep, { questionCount: Math.max(1, Math.min(20, Number(e.target.value || 3))) })}
                                                        />
                                                        <button
                                                            type="button"
                                                            className="v84-res-btn upload !px-3 !py-2 !text-[11px]"
                                                            onClick={() => addZoneQuestion(section.idx)}
                                                        >
                                                            + Question
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
                                                <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-0 bg-slate-50 border-b border-slate-200">
                                                    <div className="px-2 py-2 text-[11px] font-black uppercase text-slate-400 text-center">↕</div>
                                                    <div className="px-3 py-2 text-[11px] font-black uppercase text-slate-500">Questions</div>
                                                    <div className="px-2 py-2 text-[11px] font-black uppercase text-slate-400 text-center">✕</div>
                                                </div>
                                                <div className="max-h-[430px] overflow-auto">
                                                    {getQuestionPairRowsForEditorOrPlaceholders().map((pair, i) => {
                                                        const isQuestionRecording = recordingQuestionCell
                                                            && Number(recordingQuestionCell.rowIdx) === Number(i)
                                                            && recordingQuestionCell.zoneIdx === null
                                                            && recordingQuestionCell.field === 'question';
                                                        const questionValue = pair?.question || '';
                                                        const expectedAnswers = Array.isArray(pair?.expectedKeywords) && pair.expectedKeywords.length > 0
                                                            ? pair.expectedKeywords
                                                            : [''];
                                                        return (
                                                            <div
                                                                key={`qa_row_${i}`}
                                                                className="grid grid-cols-[44px_minmax(0,1fr)_44px] gap-0 border-b border-slate-100 last:border-b-0"
                                                                onDragOver={(e) => {
                                                                    e.preventDefault();
                                                                    e.dataTransfer.dropEffect = 'move';
                                                                }}
                                                                onDrop={(e) => {
                                                                    e.preventDefault();
                                                                    const from = Number(e.dataTransfer.getData('text/plain'));
                                                                    moveQuestionPairRow(from, i);
                                                                }}
                                                            >
                                                                <div
                                                                    className="flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-400 font-black cursor-grab select-none"
                                                                    title="Glisse pour déplacer"
                                                                    draggable
                                                                    onDragStart={(e) => {
                                                                        e.dataTransfer.setData('text/plain', String(i));
                                                                        e.dataTransfer.effectAllowed = 'move';
                                                                    }}
                                                                >
                                                                    <span>⋮⋮</span>
                                                                    <span className={`text-[9px] px-1 rounded ${pair?.generatedByAi ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                        {pair?.generatedByAi ? 'IA' : 'PROF'}
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 border-l border-slate-100">
                                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                                        <select
                                                                            className="v84-ans-input !w-auto !py-2 !text-[11px] !font-black"
                                                                            value={pair?.validationType === 'fill_blanks' ? 'fill_blanks' : 'open'}
                                                                            onChange={(e) => updateQuestionPairRow(i, { validationType: e.target.value })}
                                                                        >
                                                                            <option value="open">Question ciblée</option>
                                                                            <option value="fill_blanks">Texte à trous</option>
                                                                        </select>
                                                                        {pair?.validationType === 'fill_blanks' && (
                                                                            <span className="text-[11px] font-bold text-indigo-600">
                                                                                Rouge : "réponse". Bleu : "mot1"+"mot2"+"mot3" (liste souple) ou "mot1+mot2+mot3" (liste complète).
                                                                            </span>
                                                                        )}
                                                                        {pair?.validationType === 'fill_blanks' && (
                                                                            <button
                                                                                type="button"
                                                                                className="ml-auto rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase text-indigo-700 hover:bg-indigo-600 hover:text-white"
                                                                                onClick={() => updateQuestionPairRow(i, { question: renumberRemainingMainPoints(questionValue) })}
                                                                            >
                                                                                1-2-3 Renuméroter
                                                                            </button>
                                                                        )}
                                                                        {pair?.validationType === 'fill_blanks' && (
                                                                            <button
                                                                                type="button"
                                                                                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1 text-[10px] font-black uppercase text-violet-700 hover:bg-violet-600 hover:text-white"
                                                                                onClick={() => setTestingFillBlankKey((current) => current === `pair-${i}` ? '' : `pair-${i}`)}
                                                                            >
                                                                                👁 Tester élève
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-1">
                                                                        {pair?.validationType === 'fill_blanks' ? (
                                                                            <FillBlankSyntaxTextarea
                                                                                rows={3}
                                                                                value={questionValue}
                                                                                onChange={(e) => updateQuestionPairRow(i, { question: e.target.value })}
                                                                                onKeyDown={(e) => keepQuestionEditorKey(
                                                                                    e,
                                                                                    questionValue,
                                                                                    (nextValue) => updateQuestionPairRow(i, { question: nextValue }),
                                                                                    (nextValue) => updateQuestionPairRow(i, { question: nextValue, validationType: 'fill_blanks' })
                                                                                )}
                                                                                placeholder={'La guerre commence en "1914" et se termine en "1918".'}
                                                                            />
                                                                        ) : (
                                                                            <textarea
                                                                                rows={3}
                                                                                className="v84-q-input !text-[13px] !leading-snug"
                                                                                value={questionValue}
                                                                                onChange={(e) => updateQuestionPairRow(i, { question: e.target.value })}
                                                                                onKeyDown={(e) => keepQuestionEditorKey(
                                                                                    e,
                                                                                    questionValue,
                                                                                    (nextValue) => updateQuestionPairRow(i, { question: nextValue }),
                                                                                    (nextValue) => updateQuestionPairRow(i, { question: nextValue, validationType: 'fill_blanks' })
                                                                                )}
                                                                                placeholder={pair?.placeholderLabel || `Question ${i + 1}`}
                                                                            />
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            className={`v84-res-btn upload !px-2 !py-1 !min-w-0 ${isQuestionRecording ? 'bg-red-500 text-white' : ''}`}
                                                                            onClick={() => startQuestionCellDictation(i, 'question')}
                                                                            title="Dicter la question"
                                                                        >
                                                                            🎙️
                                                                        </button>
                                                                    </div>
                                                                    {pair?.validationType === 'fill_blanks' && testingFillBlankKey === `pair-${i}` && (
                                                                        <FillBlankStudentTester key={`test_pair_${i}_${questionValue}`} question={questionValue} onClose={() => setTestingFillBlankKey('')} />
                                                                    )}
                                                                    {pair?.validationType !== 'fill_blanks' && <div className="mt-3">
                                                                        <div className="text-[11px] font-black uppercase text-slate-400 mb-1">Réponses attendues</div>
                                                                        <div className="space-y-2">
                                                                            {expectedAnswers.map((answerValue, answerIdx) => {
                                                                                const isAnswerRecording = recordingQuestionCell
                                                                                    && Number(recordingQuestionCell.rowIdx) === Number(i)
                                                                                    && recordingQuestionCell.zoneIdx === null
                                                                                    && recordingQuestionCell.field === 'expectedKeyword';
                                                                                return (
                                                                                    <div key={`pair_expected_${i}_${answerIdx}`} className="flex gap-1">
                                                                                        <input
                                                                                            className={`v84-ans-input !text-[13px] !py-2 ${String(answerValue || '').includes('+') ? '!font-black !text-blue-600' : ''}`}
                                                                                            value={String(answerValue || '')}
                                                                                            onChange={(e) => updatePairExpectedKeyword(i, answerIdx, e.target.value)}
                                                                                            onKeyDown={(e) => keepQuestionInputSpace(e, String(answerValue || ''), (nextValue) => updatePairExpectedKeyword(i, answerIdx, nextValue))}
                                                                                            placeholder={`Expression attendue ${answerIdx + 1}`}
                                                                                        />
                                                                                        <button
                                                                                            type="button"
                                                                                            className={`v84-res-btn upload !px-2 !py-1 !min-w-0 ${isAnswerRecording ? 'bg-red-500 text-white' : ''}`}
                                                                                            onClick={() => startQuestionCellDictation(i, `expectedKeyword:${answerIdx}`)}
                                                                                            title="Dicter cette réponse attendue"
                                                                                        >
                                                                                            🎙️
                                                                                        </button>
                                                                                        <button
                                                                                            type="button"
                                                                                            className="v84-del-btn !h-auto !w-8"
                                                                                            onClick={() => {
                                                                                                const rows = [...getQuestionPairRowsForEditor()];
                                                                                                const current = rows[i] || { question: '', answer: '', expectedKeywords: [] };
                                                                                                const kws = Array.isArray(current.expectedKeywords) ? [...current.expectedKeywords] : [];
                                                                                                kws.splice(answerIdx, 1);
                                                                                                rows[i] = { ...current, expectedKeywords: kws };
                                                                                                updateQuestionPairsDraft(rows);
                                                                                            }}
                                                                                            title="Supprimer cette réponse attendue"
                                                                                        >
                                                                                            ✕
                                                                                        </button>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            className="v84-res-btn upload !mt-2 !px-3 !py-2 !text-[11px]"
                                                                            onClick={() => addPairExpectedKeywordField(i)}
                                                                        >
                                                                            + Réponse attendue
                                                                        </button>
                                                                    </div>}
                                                                </div>
                                                                <div className="flex items-center justify-center border-l border-slate-100">
                                                                    <button
                                                                        type="button"
                                                                        className="v84-del-btn"
                                                                        onClick={() => {
                                                                            const rows = [...getQuestionPairRowsForEditor()];
                                                                            rows.splice(i, 1);
                                                                            updateQuestionPairsDraft(rows);
                                                                        }}
                                                                        title="Supprimer la ligne"
                                                                    >
                                                                        ✕
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                                <label className="text-[11px] font-black uppercase text-slate-500">Nombre</label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="20"
                                                    className="v84-ans-input !w-[90px]"
                                                    value={Number(step.questionCount || 3)}
                                                    onChange={(e) => updateStep(activeStep, { questionCount: Math.max(1, Math.min(20, Number(e.target.value || 3))) })}
                                                />
                                                <button
                                                    type="button"
                                                    className="v84-res-btn upload"
                                                    onClick={() => {
                                                        const rows = [...getQuestionPairRowsForEditor()];
                                                        rows.push({ question: '', answer: '', expectedKeywords: [], generatedByAi: false, validationType: 'fill_blanks' });
                                                        updateQuestionPairsDraft(rows);
                                                    }}
                                                >
                                                    + Ajouter ligne manuelle
                                                </button>
                                                <button
                                                    type="button"
                                                    className="v84-res-btn upload"
                                                    onClick={() => updateStep(activeStep, { customQuestion: String((step.questionAnswerPairs || [])[0]?.question || '') })}
                                                >
                                                    Utiliser Q1 pour élève
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <StudioDistributionSidebar
                    user={user}
                    allClasses={allClasses}
                    allStudents={allStudents}
                    chapters={chapters}
                    distribution={distribution}
                    setDistribution={setDistribution}
                    viewingClass={viewingClass}
                    setViewingClass={setViewingClass}
                    studentSearch={studentSearch}
                    setStudentSearch={setStudentSearch}
                    targetSection={targetSection}
                    targetLevel={targetLevel}
                    loading={loading}
                    saveLabel="PUBLIER APPRENTISSAGE 🚀"
                    onSave={handleSave}
                />
            </div>

            {showAnnotModal && step?.type === 'question' && (
                <div className="fixed inset-0 z-[50000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="text-sm font-black uppercase text-slate-700">Annotation fiche</div>
                            <select className="v84-ans-input max-w-[240px]" value={step.sourceSheetUrl || ''} onChange={(e) => updateStep(activeStep, { sourceSheetUrl: e.target.value })}>
                                <option value="">Choisir une fiche</option>
                                {getCandidateSheets().map((item) => (
                                    <option key={item.url} value={item.url}>{item.source} - {item.url.slice(0, 30)}...</option>
                                ))}
                            </select>
                            <select className="v84-ans-input max-w-[160px]" value={annotColor} onChange={(e) => setAnnotColor(e.target.value)}>
                                <option value="orange">Orange (points question)</option>
                                <option value="red">Rouge (réponses attendues)</option>
                            </select>
                            <input
                                className="v84-ans-input"
                                value={annotLabel}
                                onChange={(e) => setAnnotLabel(e.target.value)}
                                placeholder="Texte du surlignage"
                            />
                            <button className="v84-res-btn upload" onClick={pushAnnotation} disabled={!annotDraft || !annotLabel.trim()}>Valider zone</button>
                            <button className="ml-auto v84-close-btn" onClick={() => { setShowAnnotModal(false); setAnnotDraft(null); }}>✕</button>
                        </div>
                        <div className="flex-1 grid grid-cols-[1fr_280px] gap-0 min-h-0">
                            <div className="relative bg-slate-100 overflow-auto">
                                {step.sourceSheetUrl ? (
                                    <div
                                        className="relative w-full h-full min-h-[400px] cursor-crosshair"
                                        onMouseDown={handleAnnotMouseDown}
                                        onMouseMove={handleAnnotMouseMove}
                                        onMouseUp={handleAnnotMouseUp}
                                    >
                                        <img src={step.sourceSheetUrl} alt="fiche source" className="w-full h-full object-contain select-none pointer-events-none" />
                                        {(step.sheetAnnotations || []).map((a, idx) => (
                                            <button
                                                key={`${idx}_${a.label}`}
                                                type="button"
                                                onClick={() => removeAnnotation(idx)}
                                                title="Supprimer cette zone"
                                                className="absolute border-2 text-[10px] font-black px-1 py-0.5 rounded"
                                                style={{
                                                    left: `${a.x}%`,
                                                    top: `${a.y}%`,
                                                    width: `${a.w}%`,
                                                    height: `${a.h}%`,
                                                    borderColor: a.color === 'orange' ? '#f59e0b' : '#ef4444',
                                                    background: a.color === 'orange' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)',
                                                    color: a.color === 'orange' ? '#b45309' : '#b91c1c'
                                                }}
                                            >
                                                {a.label}
                                            </button>
                                        ))}
                                        {annotDraft && (
                                            <div
                                                className="absolute border-2 border-dashed"
                                                style={{
                                                    left: `${annotDraft.x}%`,
                                                    top: `${annotDraft.y}%`,
                                                    width: `${annotDraft.w}%`,
                                                    height: `${annotDraft.h}%`,
                                                    borderColor: annotColor === 'orange' ? '#f59e0b' : '#ef4444',
                                                    background: annotColor === 'orange' ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)'
                                                }}
                                            />
                                        )}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 font-black">Choisis une fiche pour annoter.</div>
                                )}
                            </div>
                            <div className="border-l border-slate-200 p-3 overflow-auto">
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Zones orange</div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(step.orangeHighlights || []).map((x, i) => <span key={`${x}_${i}`} className="px-2 py-1 rounded-full text-[11px] font-black bg-orange-100 text-orange-700">{x}</span>)}
                                </div>
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Zones rouges</div>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {(step.redHighlights || []).map((x, i) => <span key={`${x}_${i}`} className="px-2 py-1 rounded-full text-[11px] font-black bg-red-100 text-red-700">{x}</span>)}
                                </div>
                                <button className="v84-res-btn upload w-full" onClick={generateTestQuestions} disabled={aiTesting}>
                                    {aiTesting ? 'Génération...' : 'Produire questions test'}
                                </button>
                                {(step.aiPreviewQuestions || []).length > 0 && (
                                    <div className="mt-3 space-y-2">
                                        {(step.aiPreviewQuestions || []).map((q, i) => (
                                            <div key={i} className="text-[12px] font-bold text-slate-700 p-2 rounded-lg bg-slate-50 border border-slate-200">
                                                {i + 1}. {q.q || q.question || 'Question'}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showVideoEditor && step?.type === 'video' && (
                <div className="fixed inset-0 z-[50000] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] w-full max-w-5xl h-[82vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                            <div className="text-sm font-black uppercase text-slate-700">Éditeur séquences vidéo</div>
                            {activeStepUsesLocalVideo && <div className="rounded-lg bg-sky-100 px-3 py-2 text-[11px] font-black text-sky-800">📁 Local : {localVideoName}</div>}
                            <button className="v84-close-btn ml-auto" onClick={() => setShowVideoEditor(false)}>✕</button>
                        </div>
                        <div className="flex-1 grid grid-cols-[1fr_290px] min-h-0">
                            <div className="p-4 bg-slate-100 flex flex-col min-h-0">
                                <div className="flex-1 min-h-0">
                                {editorVideoUrl ? (
                                    editorIsDirect ? (
                                        <video
                                            ref={videoEditorRef}
                                            src={editorVideoUrl}
                                            controls
                                            className="w-full h-full rounded-xl bg-black"
                                            onLoadedMetadata={() => {
                                                if (!videoEditorRef.current) return;
                                                videoEditorRef.current.playbackRate = segmentRate;
                                                setEditorDurationSec(Math.max(0, Number(videoEditorRef.current.duration || 0)));
                                                setEditorCurrentAbsSec(Math.max(0, Number(videoEditorRef.current.currentTime || 0)));
                                                if (segmentStart > 0) {
                                                    try { videoEditorRef.current.currentTime = segmentStart; } catch (_) {}
                                                }
                                            }}
                                            onTimeUpdate={() => {
                                                if (!videoEditorRef.current) return;
                                                videoEditorRef.current.playbackRate = segmentRate;
                                                setEditorCurrentAbsSec(Math.max(0, Number(videoEditorRef.current.currentTime || 0)));
                                                if (previewSegmentMode && segHasEnd) {
                                                    const rel = Math.max(0, Math.min(segDuration, videoEditorRef.current.currentTime - segStartNum));
                                                    setSegmentPreviewRelSec(Math.floor(rel));
                                                }
                                                if (previewSegmentMode && segmentEnd > 0 && videoEditorRef.current.currentTime >= segmentEnd) {
                                                    videoEditorRef.current.pause();
                                                    setPreviewSegmentMode(false);
                                                }
                                            }}
                                            onPlay={() => setEditorPlaying(true)}
                                            onPause={() => { setEditorPlaying(false); setPreviewSegmentMode(false); }}
                                        />
                                    ) : editorIsYoutube ? (
                                        <div className="w-full h-full rounded-xl bg-black p-2 flex flex-col gap-2">
                                            <div ref={youtubeEditorHostRef} className="w-full flex-1 rounded-lg overflow-hidden bg-black" />
                                        </div>
                                    ) : (
                                        <iframe
                                            key={`embed_${editorEmbedReloadKey}_${Number(segmentStart || 0)}`}
                                            title="video-segment-editor"
                                            src={editorEmbedUrl}
                                            className="w-full h-full rounded-xl bg-black border-0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                            allowFullScreen
                                        />
                                    )
                                ) : (
                                    <div className="w-full h-full rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 font-black">
                                        URL vidéo invalide.
                                    </div>
                                )}
                                {previewSegmentMode && segHasEnd && !editorIsYoutube && (
                                    <div className="mt-2 p-2 rounded-xl bg-white border border-slate-200">
                                        <div className="text-[11px] font-black uppercase text-slate-500 mb-1">Curseur segment</div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={segDuration}
                                            step={1}
                                            value={Math.max(0, Math.min(segDuration, Number(segmentPreviewRelSec || 0)))}
                                            onChange={(e) => {
                                                const rel = Math.max(0, Math.min(segDuration, Number(e.target.value || 0)));
                                                setSegmentPreviewRelSec(rel);
                                                if (editorIsDirect && videoEditorRef.current) {
                                                    try { videoEditorRef.current.currentTime = segStartNum + rel; } catch (_) {}
                                                }
                                            }}
                                            onMouseUp={() => {
                                                if (editorIsDirect) return;
                                                setEmbedPreviewSeekSec(segStartNum + Math.max(0, Math.min(segDuration, Number(segmentPreviewRelSec || 0))));
                                                setEditorEmbedReloadKey(Date.now());
                                            }}
                                            onTouchEnd={() => {
                                                if (editorIsDirect) return;
                                                setEmbedPreviewSeekSec(segStartNum + Math.max(0, Math.min(segDuration, Number(segmentPreviewRelSec || 0))));
                                                setEditorEmbedReloadKey(Date.now());
                                            }}
                                            className="w-full"
                                        />
                                        <div className="text-[11px] font-bold text-slate-500 mt-1">
                                            {Math.floor(segStartNum + Number(segmentPreviewRelSec || 0))}s / {Math.floor(segEndNum)}s
                                        </div>
                                    </div>
                                )}
                                </div>
                                <div
                                    className="mt-2 p-2 rounded-xl bg-white border border-slate-200"
                                    onDoubleClick={() => clearSelectedSegment()}
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        <button
                                            className="v84-res-btn upload bg-violet-600 text-white"
                                            onClick={() => {
                                                try {
                                                    // Le bouton principal ignore toujours les séquences.
                                                    // La sélection reste affichée uniquement pour l'édition.
                                                    youtubeBoundsRef.current = { start: 0, end: 0 };
                                                    setEditorPlaybackMode('video');
                                                    setPreviewSegmentMode(false);
                                                    setEmbedPreviewSeekSec(null);
                                                    if (editorIsDirect && videoEditorRef.current) {
                                                        if (editorPlaying) videoEditorRef.current.pause();
                                                        else videoEditorRef.current.play().catch(() => {});
                                                        return;
                                                    }
                                                    if (youtubeEditorPlayerRef.current) {
                                                        if (editorPlaying) youtubeEditorPlayerRef.current.pauseVideo?.();
                                                        else {
                                                            youtubeEditorPlayerRef.current.seekTo?.(Math.max(0, Number(editorCurrentAbsSec || 0)), true);
                                                            youtubeEditorPlayerRef.current.playVideo?.();
                                                        }
                                                    }
                                                } catch (_) {}
                                            }}
                                        >
                                            {editorPlaying ? 'Pause' : 'Play'}
                                        </button>
                                        <div className="text-[12px] font-black text-slate-600">
                                            {timelineCurrentSec}s / {timelineDurationSec}s
                                        </div>
                                        <div className="ml-auto text-[11px] font-black uppercase text-slate-500">
                                            Coupures: {cutMarkersSec.length}
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <input
                                            type="range"
                                            min={0}
                                            max={timelineDurationSec}
                                            step={1}
                                            value={timelineCurrentSec}
                                            onChange={(e) => seekEditorTo(Number(e.target.value || 0), { freePlayback: true })}
                                            className="w-full"
                                        />
                                        {timelineDurationSec > 1 && cutMarkersSec.map((sec) => {
                                            const pct = Math.max(0, Math.min(100, (sec / timelineDurationSec) * 100));
                                            return (
                                                <span
                                                    key={`cut_${sec}`}
                                                    className="absolute top-0 h-full w-[2px] bg-slate-900/80 pointer-events-none"
                                                    style={{ left: `calc(${pct}% - 1px)` }}
                                                />
                                            );
                                        })}
                                    </div>
                                    {timelineSegments.length > 0 && (
                                        <div
                                            ref={timelineZonesRef}
                                            className="mt-2 relative h-7 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden"
                                            onDoubleClick={() => clearSelectedSegment()}
                                            title="Double-clic: annuler la sélection de séquence"
                                        >
                                            {timelineSegments.map((seg, i) => {
                                                const isActive = String(selectedSegmentId || '') === String(seg.sid || '');
                                                const bg = isActive ? '#4f46e5' : (i % 2 === 0 ? '#93c5fd' : '#86efac');
                                                const fg = isActive ? '#ffffff' : '#0f172a';
                                                const nextSeg = i < timelineSegments.length - 1 ? timelineSegments[i + 1] : null;
                                                return (
                                                    <button
                                                        key={`zone_${seg.sid}`}
                                                        type="button"
                                                        className="absolute top-0 h-full text-[10px] font-black truncate pl-1 pr-2"
                                                        style={{
                                                            left: `${Math.max(0, Math.min(100, seg.leftPct))}%`,
                                                            width: `${Math.max(1, Math.min(100, seg.widthPct))}%`,
                                                            background: bg,
                                                            color: fg
                                                        }}
                                                        title={`${seg.label} (${seg.startSec}-${seg.endSec || 'fin'})`}
                                                        onClick={() => {
                                                            applyKnownSegment(seg.raw);
                                                            seekEditorTo(seg.startSec);
                                                        }}
                                                    >
                                                        {seg.label}
                                                        {nextSeg && (
                                                            <span
                                                                className="absolute right-0 top-0 h-full w-[7px] cursor-ew-resize border-l border-slate-900/40"
                                                                onMouseDown={(e) => startResizeSegment(seg, nextSeg, e)}
                                                                title="Glisser pour déplacer la frontière"
                                                            />
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {selectedSegment && (
                                        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <div className="text-[11px] font-black text-slate-600 mb-1">Ajuster séquence sélectionnée</div>
                                            <div className="mb-2 rounded-md bg-blue-50 px-3 py-2 text-[11px] font-black text-blue-800">
                                                Début automatique : {Math.floor(lockedSegmentStartSec)}s
                                            </div>
                                            <div className="grid grid-cols-[56px_1fr_58px] gap-2 items-center">
                                                <div className="text-[10px] font-black text-slate-500 uppercase">Fin</div>
                                                <input
                                                    type="range"
                                                    min={Math.max(1, lockedSegmentStartSec + 1)}
                                                    max={nextTimelineSegment ? Math.max(1, nextTimelineSegment.endSec - 1) : timelineDurationSec}
                                                    step={1}
                                                    value={Math.max(0, Math.min(timelineDurationSec, Number(segmentEnd || 0)))}
                                                    onChange={(e) => {
                                                        const v = Math.max(0, Math.floor(Number(e.target.value || 0)));
                                                        const start = lockedSegmentStartSec;
                                                        setSegmentStart(start);
                                                        const maxEnd = nextTimelineSegment ? Math.max(start + 1, nextTimelineSegment.endSec - 1) : timelineDurationSec;
                                                        setSegmentEnd(Math.max(start + 1, Math.min(maxEnd, v)));
                                                    }}
                                                    onMouseUp={(e) => saveSelectedEdge('end', e.currentTarget.value)}
                                                    onTouchEnd={(e) => saveSelectedEdge('end', e.currentTarget.value)}
                                                />
                                                <div className="text-[11px] font-black text-slate-700 text-right">{Math.floor(Number(segmentEnd || 0))}s</div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="mt-2 flex items-center gap-2">
                                        <input
                                            className="v84-ans-input"
                                            value={selectedSegmentId ? selectedSegmentLabel : ''}
                                            onChange={(e) => {
                                                if (!selectedSegmentId) return;
                                                setSelectedSegmentLabel(e.target.value);
                                            }}
                                            placeholder={selectedSegmentId ? "Nom de la séquence actuelle..." : "Sélectionne une séquence pour la renommer..."}
                                            disabled={!selectedSegmentId}
                                        />
                                        {selectedSegmentId && (
                                            <button
                                                className="v84-res-btn upload bg-violet-600 text-white whitespace-nowrap"
                                                onClick={() => selectedSegment && playSelectedSegmentNow(selectedSegment)}
                                            >
                                                Play section
                                            </button>
                                        )}
                                        <button
                                            className="v84-res-btn upload bg-emerald-600 text-white whitespace-nowrap"
                                            onClick={continueAfterSelectedSegment}
                                            title="Lire la suite de la vidéo à partir de la fin de cette section ou du dernier segment"
                                        >
                                            Suite
                                        </button>
                                        {selectedSegmentId && (
                                            <button
                                                className="v84-res-btn upload bg-red-600 text-white whitespace-nowrap"
                                                onClick={() => selectedSegment && removeKnownSegment(selectedSegment)}
                                            >
                                                Supprimer section
                                            </button>
                                        )}
                                        <button className="v84-res-btn upload bg-violet-600 text-white whitespace-nowrap" onClick={cutCurrentSegment}>
                                            Couper
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 border-l border-slate-200 overflow-auto">
                                {!editorIsDirect && (
                                    <div className="text-[11px] font-black text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                                        URL embed détectée: marque début/fin manuellement via les champs.
                                    </div>
                                )}
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Segments existants</div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                                    <div className="mb-2">
                                        <button
                                            className={`v84-res-btn upload ${editorPlaybackMode === 'video' ? 'bg-violet-600 text-white border-violet-700' : ''}`}
                                            onClick={() => {
                                                setEditorPlaybackMode('video');
                                                setPreviewSegmentMode(false);
                                                setSelectedSegmentId('');
                                            }}
                                        >
                                            Vidéo
                                        </button>
                                    </div>
                                    <div className="text-[10px] font-black uppercase text-slate-400 mb-1">Section vidéo</div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <select
                                            className="v84-ans-input !h-[42px] basis-full"
                                            value={selectedSegmentId}
                                            onChange={(e) => {
                                                const sid = String(e.target.value || '');
                                                const seg = knownSegments.find((s) => String(s._id || s.id || '') === sid);
                                                if (seg) applyKnownSegment(seg);
                                            }}
                                        >
                                            <option value="">Choisir une section</option>
                                            {knownSegments.map((seg, i) => {
                                                const sid = String(seg._id || seg.id || '');
                                                const label = String(seg.label || `Séquence ${i + 1}`);
                                                return (
                                                    <option key={sid || i} value={sid}>
                                                        {label} ({seg.startSec}-{seg.endSec || 'fin'})
                                                    </option>
                                                );
                                            })}
                                        </select>
                                        <button
                                            type="button"
                                            className="v84-res-btn upload bg-red-600 text-white !h-[42px] !px-3 whitespace-nowrap"
                                            title="Supprimer uniquement la séquence sélectionnée"
                                            onClick={() => selectedSegment && removeKnownSegment(selectedSegment)}
                                            disabled={!selectedSegment}
                                        >
                                            Supprimer
                                        </button>
                                        <button
                                            type="button"
                                            className="v84-del-btn"
                                            title="Vider tous les segments de cette vidéo"
                                            onClick={clearSegmentsForCurrentVideo}
                                            disabled={!String(step?.videoUrl || '').trim()}
                                        >
                                            Vider
                                        </button>
                                    </div>
                                    {knownSegments.length === 0 && <span className="text-[11px] text-slate-400 mt-2 block">Aucun segment sauvegardé.</span>}
                                </div>
                                {selectedSegmentId && (
                                    <div className="mt-3 border-t border-slate-200 pt-3">
                                        <div className="text-[11px] font-black uppercase text-slate-400 mb-1">Texte de la section vidéo</div>
                                        <textarea
                                            rows={6}
                                            className="v84-q-input"
                                            value={selectedSegmentTranscript}
                                            onChange={(e) => setSelectedSegmentTranscript(e.target.value)}
                                            placeholder="Colle ici la transcription / résumé de cette section..."
                                        />
                                    </div>
                                )}

                                <div className="mt-4 pt-3 border-t border-slate-200">
                                    <button
                                        className="v84-res-btn upload bg-violet-600 text-white w-full"
                                        disabled={!selectedSegment || savingStepData}
                                        onClick={applySelectedSegmentToStep}
                                    >
                                        {savingStepData ? 'Sauvegarde…' : "Appliquer à l'étape"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showKeywordModal && step && (
                <div className="fixed inset-0 z-[50010] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-[24px] w-full max-w-5xl h-[84vh] flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex items-center gap-3">
                            <div className="text-sm font-black uppercase text-slate-700">Sélection zones réponses (rose)</div>
                            {step.type === 'question' ? (
                                <select
                                    className="v84-ans-input max-w-[340px] ml-auto"
                                    value={keywordMaterialSource}
                                    onChange={(e) => onKeywordSourceChange(e.target.value)}
                                >
                                    {questionTextSources.map((src) => (
                                        <option key={src.id} value={src.id}>{src.label}</option>
                                    ))}
                                </select>
                            ) : keywordSlidesMode ? (
                                <div className="ml-auto h-9 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-[12px] font-black uppercase flex items-center">
                                    Édition slides (prof)
                                </div>
                            ) : (
                                <div className="ml-auto h-9 px-4 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 text-[12px] font-black uppercase flex items-center">
                                    Texte manuel
                                </div>
                            )}
                            <button type="button" className="v84-close-btn" onClick={() => { setActiveTarget('response'); setEraseMode(false); setKeywordSelectionSpan(null); setKeywordActiveZoneIdx(null); setShowKeywordModal(false); }}>✕</button>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 min-h-0 flex-1">
                            <div className="min-h-0 flex flex-col">
                                {keywordSlidesMode && (
                                    <div className="mb-3 rounded-xl border border-slate-200 bg-white p-2">
                                        <div className="flex items-center gap-2 mb-2">
                                            <button
                                                type="button"
                                                className="h-8 min-w-[40px] px-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-black text-sm disabled:opacity-40"
                                                onClick={() => setSlidesActiveIdx((i) => Math.max(0, i - 1))}
                                                disabled={slidesManifestLoading || slidesActiveIdx <= 0}
                                            >
                                                ◀
                                            </button>
                                            <div className="min-w-[90px] text-center text-[12px] font-black text-slate-700">
                                                Slide {slidesManifest.length ? slidesActiveIdx + 1 : 0}/{slidesManifest.length || 0}
                                            </div>
                                            <button
                                                type="button"
                                                className={`h-8 px-3 rounded-lg border text-[12px] font-black ${slidesPanelMode === 'slide' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300'}`}
                                                onClick={() => setSlidesPanelMode('slide')}
                                            >
                                                Slide (lecture)
                                            </button>
                                            <button
                                                type="button"
                                                className={`h-8 px-3 rounded-lg border text-[12px] font-black ${slidesPanelMode === 'transcription' ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-white text-slate-700 border-slate-300'}`}
                                                onClick={() => setSlidesPanelMode('transcription')}
                                            >
                                                Transcription
                                            </button>
                                            <button
                                                type="button"
                                                className="h-8 min-w-[40px] px-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-black text-sm disabled:opacity-40 ml-auto"
                                                onClick={() => setSlidesActiveIdx((i) => Math.min(Math.max(0, slidesManifest.length - 1), i + 1))}
                                                disabled={slidesManifestLoading || slidesActiveIdx >= Math.max(0, slidesManifest.length - 1)}
                                            >
                                                ▶
                                            </button>
                                        </div>
                                        <div className="min-h-[300px] h-[42vh] rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                                            {slidesManifestLoading ? (
                                                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm">Chargement des slides...</div>
                                            ) : slidesManifestError ? (
                                                <div className="h-full flex items-center justify-center text-red-500 font-bold text-sm px-4 text-center">{slidesManifestError}</div>
                                            ) : slidesManifest.length === 0 ? (
                                                <div className="h-full flex items-center justify-center text-slate-400 font-bold text-sm px-4 text-center">Aucune slide trouvée.</div>
                                            ) : slidesPanelMode === 'transcription' ? (
                                                <textarea
                                                    className="w-full h-full bg-white p-3 text-[14px] leading-6 text-slate-700 outline-none resize-none"
                                                    value={keywordMaterialText}
                                                    onChange={(e) => {
                                                        const next = String(e.target.value || '').replace(/\r/g, '');
                                                        setKeywordMaterialText(next);
                                                        const objectId = String(slidesManifest[slidesActiveIdx]?.objectId || '').trim();
                                                        if (objectId && step?.type === 'sheet') {
                                                            const map = sanitizeSlideTextMap(step.sheetSlideTextMap);
                                                            map[objectId] = next;
                                                            updateStep(activeStep, { sheetSlideTextMap: map, sheetText: next });
                                                        } else if (objectId && step?.type === 'question') {
                                                            const map = sanitizeSlideTextMap(step.questionSlideTextMap);
                                                            map[objectId] = next;
                                                            updateStep(activeStep, {
                                                                questionSlideTextMap: map,
                                                                materialSource: String(step.sourceSlidesUrl || 'slides'),
                                                                materialText: next
                                                            });
                                                        }
                                                    }}
                                                    placeholder="Transcription éditable de la slide..."
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-slate-100 overflow-auto">
                                                    {buildSlideImageSrc(slidesManifest[slidesActiveIdx]) ? (
                                                        <img
                                                            src={buildSlideImageSrc(slidesManifest[slidesActiveIdx])}
                                                            alt={`Slide ${slidesManifest[slidesActiveIdx]?.slideNumber || ''}`}
                                                            className="max-h-full max-w-full w-auto h-auto object-contain bg-white"
                                                            onLoad={() => handleSlideImageLoad(slidesManifest[slidesActiveIdx])}
                                                            onError={() => handleSlideImageError(slidesManifest[slidesActiveIdx])}
                                                        />
                                                    ) : (
                                                        <div className="text-slate-400 font-bold text-sm">Chargement...</div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="mt-2 flex items-center gap-2">
                                            <select
                                                className="v84-ans-input !h-9 !text-[12px] !w-[220px]"
                                                value={currentSlideSectionId}
                                                onChange={(e) => onSlideSectionSelect(e.target.value)}
                                                disabled={!currentSlideObjectId}
                                            >
                                                <option value="">Affecter: section non définie</option>
                                                {(formData.sections || []).map((sec) => (
                                                    <option key={sec.id} value={sec.id}>
                                                        {String(sec.name || sec.id || 'Section').trim()}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                className="h-9 min-w-[34px] px-2 rounded-lg border border-rose-300 bg-rose-50 text-rose-700 font-black text-[12px] disabled:opacity-40"
                                                onClick={deleteCurrentSlideSection}
                                                disabled={!currentSlideSectionId}
                                                title="Supprimer la section sélectionnée"
                                            >
                                                X
                                            </button>
                                            <input
                                                className="v84-ans-input !h-9 !text-[12px] !w-[180px]"
                                                value={slideSectionNameDraft}
                                                onChange={(e) => setSlideSectionNameDraft(e.target.value)}
                                                onBlur={saveSlideSectionName}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        saveSlideSectionName();
                                                    }
                                                }}
                                                placeholder="Nouveau"
                                            />
                                            <button
                                                type="button"
                                                className="h-9 px-3 rounded-lg border border-indigo-500 text-indigo-600 bg-indigo-50 font-black text-[12px]"
                                                onClick={createSlideSection}
                                            >
                                                Nouveau
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Sélectionne puis clique “Repères”. Clique “Cut” pour insérer une barre, “Next” pour naviguer entre sections.</div>
                                <div
                                    ref={keywordSelectionRef}
                                    onMouseUp={captureKeywordSelection}
                                    onClick={(e) => e.currentTarget.focus()}
                                    onKeyDown={handleKeywordEditorKeyDown}
                                    tabIndex={0}
                                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[13px] leading-6 text-slate-700 overflow-auto whitespace-pre-wrap select-text focus:outline-none focus:ring-2 focus:ring-blue-300"
                                >
                                    {keywordMaterialText
                                        ? highlightTextWithPink(keywordMaterialText, getCurrentResponseRanges(), getCurrentZoneMarkers(), keywordActiveZoneIdx)
                                        : 'Aucun texte pour le moment.'}
                                </div>
                                <div className="mt-3 p-3 rounded-xl bg-pink-50 border border-pink-200 text-pink-700 text-[12px] font-bold min-h-[44px]">
                                    {keywordSelectedText || 'Sélection actuelle: vide'}
                                </div>
                                <div className="mt-3 flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={activeTarget === 'response'
                                            ? { border: '2px solid #ec4899', background: '#fff', color: '#be185d' }
                                            : { border: '2px solid transparent' }}
                                        onMouseDown={(e) => { captureKeywordSelection(); e.preventDefault(); }}
                                        onClick={() => {
                                            setActiveTarget('response');
                                            setEraseMode(false);
                                            setKeywordActiveZoneIdx(null);
                                            applyCurrentSelectionForMode('response', false);
                                        }}
                                    >
                                        Repères
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={{ border: '2px solid #dc2626', background: '#fff', color: '#dc2626' }}
                                        onMouseDown={(e) => { captureKeywordSelection(); e.preventDefault(); }}
                                        onClick={onCutAction}
                                    >
                                        Cut
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={{ border: '2px solid #111827', background: '#fff', color: '#111827' }}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={onNextAction}
                                    >
                                        Next
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        style={eraseMode
                                            ? { border: '2px solid #3b82f6', background: '#fff', color: '#1d4ed8' }
                                            : { border: '2px solid transparent' }}
                                        onMouseDown={(e) => { captureKeywordSelection(); e.preventDefault(); }}
                                        onClick={() => {
                                            const next = !eraseMode;
                                            setEraseMode(next);
                                            if (next) applyCurrentSelectionForMode(activeTarget, true);
                                        }}
                                    >
                                        ✕
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload bg-violet-600 text-white"
                                        onClick={runAutoHighlight}
                                        disabled={autoHighlighting || !keywordMaterialText.trim()}
                                    >
                                        {autoHighlighting ? 'Auto...' : 'Auto'}
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        onClick={() => {
                                            if (step.type === 'question') {
                                                updateStep(activeStep, { materialSource: keywordMaterialSource, materialText: keywordMaterialText });
                                            } else if (step.type === 'video') {
                                                updateStep(activeStep, { videoTranscript: keywordMaterialText });
                                            } else if (step.type === 'sheet') {
                                                updateStep(activeStep, { sheetText: keywordMaterialText });
                                            }
                                            setActiveTarget('response');
                                            setEraseMode(false);
                                            setKeywordSelectionSpan(null);
                                            setKeywordActiveZoneIdx(null);
                                            setShowKeywordModal(false);
                                        }}
                                    >
                                        Sauver texte
                                    </button>
                                </div>
                            </div>
                            <div className="min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white p-4">
                                <div className="text-[11px] font-black uppercase text-slate-400 mb-2">Questions par section (cuts)</div>
                                <div className="text-[11px] font-black text-slate-600 mb-2 uppercase">
                                    Total actuel: {getTotalZoneQuestions()}
                                </div>
                                <div className="flex items-center gap-2 mb-3">
                                    <label className="text-[11px] font-black text-slate-500 uppercase">Nombre</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="20"
                                        className="v84-ans-input !w-[90px]"
                                        value={zoneQuestionCount}
                                        onChange={(e) => setZoneQuestionCount(Math.max(1, Math.min(20, Number(e.target.value || 1))))}
                                    />
                                    <button
                                        type="button"
                                        className="v84-res-btn upload bg-indigo-600 text-white"
                                        onClick={generateQuestionsForActiveZone}
                                        disabled={aiTesting || !String(keywordMaterialText || '').trim()}
                                    >
                                        {aiTesting ? 'Génération...' : 'Générer IA (garde manuel)'}
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        onClick={addActiveZoneQuestion}
                                    >
                                        + Question
                                    </button>
                                    <button
                                        type="button"
                                        className="v84-res-btn upload"
                                        onClick={() => setShowBulkQuestionImport((prev) => !prev)}
                                    >
                                        Import bloc
                                    </button>
                                </div>
                                {showBulkQuestionImport && (
                                    <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
                                        <div className="text-[11px] font-black uppercase text-slate-500 mb-2">
                                            Import manuel sans IA
                                        </div>
                                        <textarea
                                            rows={8}
                                            className="v84-q-input"
                                            value={bulkQuestionImport}
                                            onChange={(e) => setBulkQuestionImport(e.target.value)}
                                            placeholder={`Question: Quelle est la capitale de la France ?\n\nQuestion: Cite un continent.`}
                                        />
                                        <div className="mt-2 flex items-center gap-2">
                                            <button
                                                type="button"
                                                className="v84-res-btn upload bg-indigo-600 text-white"
                                                onClick={() => importQuestionsForZone(Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0)}
                                            >
                                                Remplacer la section courante
                                            </button>
                                            <button
                                                type="button"
                                                className="v84-res-btn upload"
                                                onClick={() => {
                                                    setBulkQuestionImport('');
                                                    setShowBulkQuestionImport(false);
                                                }}
                                            >
                                                Annuler
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="text-[11px] font-bold text-slate-500 mb-2">
                                    Section courante: {Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx + 1 : 1}
                                </div>
                                <div className="flex-1 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                                    {Array.from({ length: getZoneCount() }).map((_, sectionIdx) => {
                                        const questions = getZoneQuestions(sectionIdx);
                                        return (
                                            <div
                                                key={`section_${sectionIdx}`}
                                                className={`rounded-xl border p-2 ${sectionIdx === (Number.isFinite(keywordActiveZoneIdx) ? keywordActiveZoneIdx : 0) ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 bg-white'}`}
                                            >
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="text-[11px] font-black uppercase text-slate-500">
                                                        Section {sectionIdx + 1}
                                                        {sectionIdx < getZoneCount() - 1 ? ` (Cut ${sectionIdx + 1})` : ' (Fin)'}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        className="v84-res-btn upload"
                                                        onClick={() => { setKeywordActiveZoneIdx(sectionIdx); addZoneQuestion(sectionIdx); }}
                                                    >
                                                        + Question
                                                    </button>
                                                </div>
                                                {questions.length === 0 ? (
                                                    <div className="text-[12px] font-bold text-slate-400 px-1 pb-1">Aucune question pour cette section.</div>
                                                ) : questions.map((q, i) => (
                                                    <div key={`${sectionIdx}_${i}`} className="text-[13px] font-bold text-slate-700 p-2 rounded-lg bg-white border border-slate-200 mb-2">
                                                <div className="flex justify-between items-center mb-1">
                                                    <div className="text-[11px] font-black uppercase text-slate-400">Question</div>
                                                    <button
                                                        type="button"
                                                        className="px-2 py-0.5 rounded-md border border-red-300 bg-red-50 text-red-600 text-[11px] font-black"
                                                        onClick={() => removeZoneQuestion(sectionIdx, i)}
                                                        title="Supprimer question"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    className="v84-q-input"
                                                    value={String(q.q || q.question || '')}
                                                    onChange={(e) => updateZoneQuestion(sectionIdx, i, { question: e.target.value, q: e.target.value })}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                    placeholder={`Question ${i + 1}`}
                                                />
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="pt-3 flex justify-end">
                                    <button
                                        type="button"
                                        className="v84-res-btn upload !bg-emerald-600 !text-white !border-emerald-700 hover:!bg-emerald-600"
                                        style={{ backgroundColor: '#16a34a', color: '#fff', borderColor: '#15803d' }}
                                        onClick={saveCurrentStepDataNow}
                                        disabled={savingStepData}
                                    >
                                        {savingStepData ? 'Enregistrement...' : 'Enregistrer'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
