import React, { useState, useEffect, useRef, useCallback } from 'react';
import './RedactionWorkspace.css';
import DidakbotSidebar from './DidakbotSidebar';

export const computeSessionToken = (studentId, homeworkId, attemptNum) => {
    const raw = `${String(studentId || '')}_${String(homeworkId || '')}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
    return `CW-${hex}-T${attemptNum || 1}`;
};

export const computeInvisibleWatermark = (studentId, homeworkId) => {
    const raw = `${String(studentId || '')}_${String(homeworkId || '')}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    const binary = (Math.abs(hash) & 0xFFFF).toString(2).padStart(16, '0');
    const encoded = binary.split('').map(b => (b === '1' ? '\u200C' : '\u200B')).join('');
    return `\u200D\u200B${encoded}\u200C\u200D`;
};

export const generateCopyKey = (studentId, homeworkId, copyNum) => {
    const raw = `${String(studentId || '')}_${String(homeworkId || '')}_${copyNum}_${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i);
        hash |= 0;
    }
    const hex = Math.abs(hash).toString(16).toUpperCase().padStart(4, '0').slice(0, 4);
    return `CW-${hex}-C${copyNum || 1}`;
};

export const HOMOGLYPH_PAIRS = [
    { latin: 'e', cyrillic: '\u0435', name: 'e Cyrillique (U+0435)' },
    { latin: 'a', cyrillic: '\u0430', name: 'a Cyrillique (U+0430)' },
    { latin: 'o', cyrillic: '\u043E', name: 'o Cyrillique (U+043E)' },
    { latin: 'c', cyrillic: '\u0441', name: 'c Cyrillique (U+0441)' },
    { latin: 'p', cyrillic: '\u0440', name: 'p Cyrillique (U+0440)' }
];

export const injectHomoglyphs = (text, frequency = 2) => {
    if (!text) return '';
    let eCount = 0;
    let aCount = 0;
    let oCount = 0;
    let cCount = 0;
    let pCount = 0;

    return text.split('').map((char) => {
        if (char === 'e') {
            eCount++;
            if (eCount % frequency === 0) return '\u0435'; // Cyrillic small e
        } else if (char === 'E') {
            eCount++;
            if (eCount % frequency === 0) return '\u0415'; // Cyrillic capital E
        } else if (char === 'a') {
            aCount++;
            if (aCount % frequency === 0) return '\u0430'; // Cyrillic small a
        } else if (char === 'A') {
            aCount++;
            if (aCount % frequency === 0) return '\u0410'; // Cyrillic capital A
        } else if (char === 'o') {
            oCount++;
            if (oCount % frequency === 0) return '\u043E'; // Cyrillic small o
        } else if (char === 'O') {
            oCount++;
            if (oCount % frequency === 0) return '\u041E'; // Cyrillic capital O
        } else if (char === 'c') {
            cCount++;
            if (cCount % frequency === 0) return '\u0441'; // Cyrillic small c
        } else if (char === 'C') {
            cCount++;
            if (cCount % frequency === 0) return '\u0421'; // Cyrillic capital C
        } else if (char === 'p') {
            pCount++;
            if (pCount % frequency === 0) return '\u0440'; // Cyrillic small p
        } else if (char === 'P') {
            pCount++;
            if (pCount % frequency === 0) return '\u0420'; // Cyrillic capital P
        }
        return char;
    }).join('');
};

export const SAMPLE_HOMOGLYPH_TEXT = injectHomoglyphs(
    `La Première Guerre mondiale est une guerre totale qui bouleverse profondément les sociétés européennes. Les civils et l'économie nationale sont entièrement mobilisés pour soutenir l'effort de guerre. Dans les tranchées, les soldats endurent des souffrances physiques et psychologiques extrêmes. L'historien George Mosse démontre que cette violence de masse provoque une brutalisation durable des esprits. En 1917, face à l'enlisement du conflit, des mutineries et des grèves éclatent tant sur le front qu'à l'arrière.`,
    2
);

export const analyzeHomoglyphs = (text) => {
    if (!text) return { totalHomoglyphs: 0, matches: [], isAuthenticCondaWeb: false, breakdown: { e_cyrillic: 0, a_cyrillic: 0, o_cyrillic: 0, c_cyrillic: 0, p_cyrillic: 0, other_cyrillic: 0 } };
    
    const matches = [];
    const breakdown = {
        e_cyrillic: 0,
        a_cyrillic: 0,
        o_cyrillic: 0,
        c_cyrillic: 0,
        p_cyrillic: 0,
        other_cyrillic: 0
    };

    const words = text.split(/\s+/);
    words.forEach((word, wIdx) => {
        let hasCyrillic = false;
        const charsInWord = [];
        for (let i = 0; i < word.length; i++) {
            const code = word.charCodeAt(i);
            const ch = word[i];
            if (code >= 0x0400 && code <= 0x04FF) {
                hasCyrillic = true;
                let glyphName = `U+${code.toString(16).toUpperCase().padStart(4, '0')}`;
                if (ch === '\u0435' || ch === '\u0415') { breakdown.e_cyrillic++; glyphName = 'e/E cyrillique'; }
                else if (ch === '\u0430' || ch === '\u0410') { breakdown.a_cyrillic++; glyphName = 'a/A cyrillique'; }
                else if (ch === '\u043E' || ch === '\u041E') { breakdown.o_cyrillic++; glyphName = 'o/O cyrillique'; }
                else if (ch === '\u0441' || ch === '\u0421') { breakdown.c_cyrillic++; glyphName = 'c/C cyrillique'; }
                else if (ch === '\u0440' || ch === '\u0420') { breakdown.p_cyrillic++; glyphName = 'p/P cyrillique'; }
                else { breakdown.other_cyrillic++; }

                charsInWord.push({ char: ch, codeHex: `\\u${code.toString(16).padStart(4, '0')}`, name: glyphName, position: i });
            }
        }
        if (hasCyrillic) {
            matches.push({
                wordIndex: wIdx + 1,
                word,
                chars: charsInWord
            });
        }
    });

    const totalHomoglyphs = breakdown.e_cyrillic + breakdown.a_cyrillic + breakdown.o_cyrillic + breakdown.c_cyrillic + breakdown.p_cyrillic + breakdown.other_cyrillic;
    const isAuthenticCondaWeb = totalHomoglyphs >= 2;

    return {
        totalHomoglyphs,
        matches,
        breakdown,
        isAuthenticCondaWeb
    };
};

const samplePromptRaw = `[CLÉ OFFICIELLE CONDAWEB : CW-38B2-C1]
[SUJET DU DEVOIR : "La Première Guerre mondiale : une guerre totale"]

--- MON BROUILLON / PLAN INITIAL : ---
I. La mobilisation de toute la société (usines, femmes, civils)
II. L'expérience traumatisante des tranchées et la brutalisation
III. Les crises de 1917 et les mutineries

--- MON 1ER ESSAI RÉDIGÉ (V1) : ---
La Première Guerre mondiale est une guerre totale qui bouleverse profondément les sociétés européennes. Les civils et l'économie nationale sont entièrement mobilisés pour soutenir l'effort de guerre. Dans les tranchées, les soldats endurent des souffrances physiques et psychologiques extrêmes. L'historien George Mosse démontre que cette violence de masse provoque une brutalisation durable des esprits. En 1917, face à l'enlisement du conflit, des mutineries et des grèves éclatent tant sur le front qu'à l'arrière.

Consignes pour le tuteur :
Analyse mon plan au brouillon et ma rédaction V1. Repère les points forts et les axes d'amélioration selon la règle AEI sans jamais rédiger à ma place. Si la réponse de l'élève ne contient pas de caractères cyrilliques, ou si nous en sommes au deuxième message et que le premier message n'en contenait pas, dis uniquement : "Copie seulement CondaWeb".`;

export const SAMPLE_CONVERSATION_TEXT = `Vous avez dit :
${injectHomoglyphs(samplePromptRaw, 2)}

Gemini a dit :
[CONSEILS_APPLIQUÉS : OUI | RÉF: CW-38B2-C1]
Bonjour ! Ton travail est très solide. Tu as bien cerné la notion de guerre totale et la méthode AEI commence à être visible dans tes paragraphes.
Pour enrichir ton devoir et viser un niveau supérieur :
1. Développe davantage le concept de brutalisation formulé par George Mosse dans ta deuxième sous-partie.
2. N'oublie pas de mentionner les mutineries de 1917 pour illustrer l'usure morale des combattants.

Vous avez dit :
Comment puis-je mieux expliquer le concept de brutalisation de George Mosse sans faire de hors-sujet ?

Gemini a dit :
Pour expliquer la brutalisation selon George Mosse :
Rappelle que la violence extrême et continue des tranchées a habitué les soldats à la mort de masse. Cette violence ne s'arrête pas avec l'armistice de 1918 : elle imprègne durablement les mentalités et la vie politique d'après-guerre.`;

export const serializeAdviceBlocks = (blocks) => {
    if (!Array.isArray(blocks) || blocks.length === 0) return '';
    return blocks.map((b, idx) => {
        const title = b.title || `Conseils pour la Version ${b.versionTarget || (idx + 1)}`;
        const time = b.timestamp ? ` (${b.timestamp})` : '';
        return `=== [${title.toUpperCase()}]${time} ===\n${(b.content || '').trim()}`;
    }).join('\n\n');
};

export const parseAdviceBlocks = (text) => {
    if (!text || typeof text !== 'string') return [];
    const trimmed = text.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].content !== undefined) {
                return parsed;
            }
        } catch (e) {
            // Ignore non-JSON
        }
    }

    const regex = /===\s*\[([^\]]+)\](?:\s*\(([^)]*)\))?\s*===/gi;
    const matches = [...trimmed.matchAll(regex)];

    if (matches.length > 0) {
        const blocks = [];
        for (let i = 0; i < matches.length; i++) {
            const match = matches[i];
            const title = match[1].trim();
            const time = match[2] ? match[2].trim() : '';
            const startIndex = match.index + match[0].length;
            const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : trimmed.length;
            const content = trimmed.slice(startIndex, endIndex).trim();

            const vMatch = title.match(/VERSION\s*(\d+)|ESSAI\s*(\d+)/i);
            const versionTarget = vMatch ? parseInt(vMatch[1] || vMatch[2], 10) : (i + 1);

            blocks.push({
                id: `block_${i + 1}_${Date.now()}`,
                versionTarget,
                title,
                content,
                timestamp: time || '',
                createdAt: new Date().toISOString()
            });
        }
        return blocks;
    }

    return [{
        id: `block_1_${Date.now()}`,
        versionTarget: 1,
        title: 'Conseils Version 1',
        content: trimmed,
        timestamp: '',
        createdAt: new Date().toISOString()
    }];
};

export const getVersionProgression = (vCount) => {
    const count = Math.max(1, Number(vCount || 1));
    if (count >= 7) {
        return {
            count,
            mention: 'Très bien',
            icon: '🥇',
            badgeClass: 'conda-version-badge-very-good',
            label: `${count} versions · Très bien`
        };
    }
    if (count >= 5) {
        return {
            count,
            mention: 'Bien',
            icon: '🥈',
            badgeClass: 'conda-version-badge-good',
            label: `${count} versions · Bien`
        };
    }
    if (count >= 3) {
        return {
            count,
            mention: 'Assez bien',
            icon: '🥉',
            badgeClass: 'conda-version-badge-fair',
            label: `${count} versions · Assez bien`
        };
    }
    return {
        count,
        mention: 'En cours',
        icon: '🔴',
        badgeClass: 'conda-version-badge-initial',
        label: `${count} version${count > 1 ? 's' : ''} (vise 3+ versions)`
    };
};

export const parseConversationBlocks = (text) => {
    if (!text || !text.trim()) return [];

    let clean = text.trim();
    // Nettoie les en-têtes d'accessibilité de Gemini web s'ils ont été sélectionnés
    clean = clean.replace(/^[\s\S]*?Passer au dernier résultat Gemini\s*/i, '');
    // Nettoie le disclaimer de bas de page de Gemini s'il est présent
    clean = clean.replace(/\n*Gemini est une IA et peut se tromper\.[\s\S]*$/i, '');

    // Séparateurs de tours de parole :
    // 1. Rôles explicites ("Vous avez dit :", "Gemini a dit :", "User:", "Model:")
    // 2. Boutons d'interface de Gemini ("Afficher le raisonnement", "Masquer le raisonnement", "Modifier la requête")
    // 3. Marqueurs de protocole CondaWeb ("[CONSEILS_APPLIQUÉS", "[CLÉ OFFICIELLE", "[SUJET DU DEVOIR")
    const splitRegex = /(?:^|\n)(Vous avez dit\s*:?|Gemini a dit\s*:?|User\s*:?|Model\s*:?|Assistant\s*:?|ChatGPT(?: a dit)?\s*:?|Moi\s*:?|Afficher le raisonnement|Masquer le raisonnement|Modifier la requête|\[CONSEILS_APPLIQU[Ée]S[^\]]*\])(?:\n|$)/gi;

    let rawSegments = [];
    const matches = [];
    let match;

    while ((match = splitRegex.exec(clean)) !== null) {
        matches.push({
            delimiter: match[1].trim(),
            startIndex: match.index,
            headerLength: match[0].length,
            contentStartIndex: match.index + match[0].length
        });
    }

    if (matches.length > 0) {
        // Contenu avant le tout premier séparateur (ex: prompt initial de l'élève)
        if (matches[0].startIndex > 0) {
            const initialContent = clean.slice(0, matches[0].startIndex).trim();
            if (initialContent) {
                rawSegments.push({
                    header: 'Message initial',
                    content: initialContent
                });
            }
        }

        for (let i = 0; i < matches.length; i++) {
            const current = matches[i];
            const nextStart = (i + 1 < matches.length) ? matches[i + 1].startIndex : clean.length;
            const content = clean.slice(current.contentStartIndex, nextStart).trim();
            if (content) {
                rawSegments.push({
                    header: current.delimiter,
                    content
                });
            }
        }
    } else {
        // Fallback si aucun séparateur d'interface n'est présent : recherche de la frontière consigne -> réponse
        const promptEndMarker = /(?:sans jamais rédiger à ma place\.|Consignes pour le tuteur\s*:?[^\n]*)/i;
        const promptMatch = promptEndMarker.exec(clean);

        if (promptMatch) {
            const splitPos = promptMatch.index + promptMatch[0].length;
            const promptContent = clean.slice(0, splitPos).trim();
            const restContent = clean.slice(splitPos).trim();

            if (promptContent) {
                rawSegments.push({
                    header: 'Message Élève (Prompt CondaWeb)',
                    content: promptContent
                });
            }
            if (restContent) {
                rawSegments.push({
                    header: 'Réponse Tuteur IA',
                    content: restContent
                });
            }
        } else {
            rawSegments.push({
                header: 'Contenu collé',
                content: clean
            });
        }
    }

    // Classification précise de chaque bloc
    return rawSegments.map((seg, idx) => {
        const content = seg.content;
        const words = content.split(/\s+/).filter(Boolean).length;
        const homoglyphRes = analyzeHomoglyphs(content);
        const hasCondaTags = content.includes('[SUJET DU DEVOIR') || content.includes('--- MON BROUILLON') || content.includes('--- MON 1ER ESSAI') || content.includes('CW-');
        const isAiHeader = /^(Gemini|Model|Assistant|ChatGPT|Afficher le raisonnement|Masquer le raisonnement|\[CONSEILS_APPLIQU)/i.test(seg.header);
        const isUserHeader = /^(Vous|User|Moi|Modifier la requête)/i.test(seg.header);

        let type = 'unknown';
        let title = '';
        let badge = '';
        let badgeColor = '';
        let description = '';

        // RÈGLE 1 : Si présence d'homoglyphes (>= 2) ou balises officielles -> C'est le PROMPT CONDAWEB !
        if (homoglyphRes.isAuthenticCondaWeb || hasCondaTags) {
            type = 'conda_prompt';
            title = 'Prompt Devoir CondaWeb';
            badge = '🛡️ Authentifié CondaWeb';
            badgeColor = 'emerald';
            description = `Dépôt officiel du travail avec brouillon/copie (${homoglyphRes.totalHomoglyphs} homoglyphes invisibles certifiés).`;
        } 
        // RÈGLE 2 : Si en-tête IA ou amorce d'évaluation -> C'est la RÉPONSE DU TUTEUR IA !
        else if (isAiHeader || content.includes('[CONSEILS_APPLIQU') || content.startsWith('Ce retour d\'évaluation') || content.includes('Voici mon analyse') || content.includes('règle AEI')) {
            type = 'ai_response';
            title = 'Réponse du Tuteur IA';
            badge = '🤖 Conseil IA';
            badgeColor = 'purple';
            description = 'Conseils méthodologiques et évaluation rédigés par l\'IA.';
        } 
        // RÈGLE 3 : Question ou interaction spontanée de l'élève
        else if (isUserHeader || words < 70 || content.includes('?') || /^(comment|pourquoi|peux-tu|est-ce que|aide-moi)/i.test(content.trim())) {
            type = 'student_interaction';
            title = 'Interaction & Question libre de l\'élève';
            badge = '💬 Question Autorisée';
            badgeColor = 'indigo';
            description = 'Question spontanée pour dialoguer avec l\'IA. 100% autorisée sans besoin de clé.';
        } 
        // RÈGLE 4 : Long texte rédigé non signé -> Suspicion de triche externe
        else {
            type = 'suspicious_external';
            title = 'Bloc Rédigé Externe Non Signé';
            badge = '🚨 Suspicion Triche';
            badgeColor = 'rose';
            description = `Bloc rédigé de ${words} mots sans homoglyphes et sans balises CondaWeb. Possible copie d'un devoir externe.`;
        }

        return {
            index: idx + 1,
            rawHeader: seg.header,
            type,
            title,
            badge,
            badgeColor,
            description,
            wordsCount: words,
            homoglyphsCount: homoglyphRes.totalHomoglyphs,
            content
        };
    });
};

export const TARGET_WATERMARK_SENTENCES = [1, 3, 8];

export const SAMPLE_WATERMARK_TEXT = `La Première Guerre mondiale est une guerre totale qui bouleverse les sociétés.  Les civils et l'économie sont entièrement mobilisés pour l'effort de guerre. Les tranchées deviennent le symbole des souffrances extrêmes endurées par les soldats.  En 1917, le moral faiblit et des mutineries éclatent sur le front. La propagande et la censure s'intensifient pour maintenir la cohésion nationale. Les femmes jouent un rôle clé dans les usines d'armement et les travaux agricoles. Les pertes humaines et les traumatismes physiques ou psychologiques sont sans précédent. L'historien George Mosse théorise ainsi le concept de brutalisation des sociétés européennes.  L'armistice du 11 novembre 1918 laisse un continent profondément meurtri.`;

export const injectSentenceSpacing = (text, targetIndices = TARGET_WATERMARK_SENTENCES) => {
    if (!text) return '';
    let sentenceCount = 0;
    return text.replace(/([.!?])([ \t\r\n]+|$)/g, (match, punct, spaces) => {
        sentenceCount++;
        const isTarget = targetIndices.includes(sentenceCount);
        if (spaces.includes('\n')) {
            return isTarget ? `${punct}  \n` : `${punct}\n`;
        }
        return isTarget ? `${punct}  ` : `${punct} `;
    });
};

export const analyzeSentenceSpacing = (text, expectedIndices = TARGET_WATERMARK_SENTENCES) => {
    if (!text) {
        return {
            sentences: [],
            totalSentences: 0,
            markedIndices: [],
            applicableExpected: [],
            matchedExpected: [],
            missingExpected: [],
            isValidSignature: false
        };
    }

    const sentences = [];
    let sentenceCount = 0;
    const regex = /([^.!?]+[.!?])([ \t\r\n]*)/g;
    let match;

    while ((match = regex.exec(text)) !== null) {
        sentenceCount++;
        const sentenceText = match[1].trim();
        const trailing = match[2];
        const spaceCount = (trailing.match(/ /g) || []).length;
        const hasDoubleSpace = trailing.startsWith('  ') || trailing.includes('  ') || (trailing.startsWith(' \n') && spaceCount >= 1);
        const isExpected = expectedIndices.includes(sentenceCount);

        let status = 'NORMAL';
        if (hasDoubleSpace && isExpected) {
            status = 'MATCH';
        } else if (hasDoubleSpace && !isExpected) {
            status = 'UNEXPECTED_DOUBLE';
        } else if (!hasDoubleSpace && isExpected) {
            status = 'MISSING_MARK';
        }

        sentences.push({
            index: sentenceCount,
            text: sentenceText,
            trailingRaw: trailing,
            spaceCount,
            hasDoubleSpace,
            isExpected,
            status
        });
    }

    const markedIndices = sentences.filter(s => s.hasDoubleSpace).map(s => s.index);
    const applicableExpected = expectedIndices.filter(exp => exp <= sentences.length);
    const matchedExpected = applicableExpected.filter(exp => markedIndices.includes(exp));
    const missingExpected = applicableExpected.filter(exp => !markedIndices.includes(exp));
    const isValidSignature = applicableExpected.length > 0 && applicableExpected.length === matchedExpected.length;

    return {
        sentences,
        totalSentences: sentences.length,
        markedIndices,
        applicableExpected,
        matchedExpected,
        missingExpected,
        isValidSignature
    };
};

export const injectParagraphZwnj = (text) => {
    if (!text) return '';
    const zwnj = '\u200C';
    return text.split('\n').map(line => (line.trim() ? `${zwnj}${line}${zwnj}` : line)).join('\n');
};

export const analyzeZwnjText = (text) => {
    if (!text) return { paragraphs: [], totalZwnj: 0, totalZws: 0, totalZwj: 0, condaCount: 0, externalCount: 0 };
    const rawParagraphs = text.split(/\n+/).filter(p => p.trim().length > 0);
    let totalZwnj = 0;
    let totalZws = 0;
    let totalZwj = 0;
    let condaCount = 0;
    let externalCount = 0;

    const paragraphs = rawParagraphs.map((p, idx) => {
        const zwnjMatches = p.match(/\u200C/g) || [];
        const zwsMatches = p.match(/\u200B/g) || [];
        const zwjMatches = p.match(/\u200D/g) || [];
        
        const zwnjCount = zwnjMatches.length;
        const zwsCount = zwsMatches.length;
        const zwjCount = zwjMatches.length;

        totalZwnj += zwnjCount;
        totalZws += zwsCount;
        totalZwj += zwjCount;

        const isConda = zwnjCount > 0 || zwsCount > 0 || zwjCount > 0;
        if (isConda) condaCount++; else externalCount++;

        return {
            index: idx + 1,
            text: p.replace(/[\u200B\u200C\u200D]/g, '').trim(),
            rawLength: p.length,
            visibleLength: p.replace(/[\u200B\u200C\u200D]/g, '').trim().length,
            zwnjCount,
            zwsCount,
            zwjCount,
            isConda
        };
    });

    return {
        paragraphs,
        totalZwnj,
        totalZws,
        totalZwj,
        condaCount,
        externalCount
    };
};

export default function RedactionWorkspace({ homework, user, onQuit }) {
    // 1. Text & Undo/Redo State
    const [essayText, setEssayText] = useState('');
    const [history, setHistory] = useState(['']);
    const [historyIdx, setHistoryIdx] = useState(0);

    // 2. Draft & AI Notes State (Persists across attempts)
    const [draftText, setDraftText] = useState('');
    const [aiNotesText, setAiNotesText] = useState('');
    const [aiAdviceBlocks, setAiAdviceBlocks] = useState([]);
    const [editingBlockId, setEditingBlockId] = useState(null);
    const [editingNoteText, setEditingNoteText] = useState('');
    const [editingChatText, setEditingChatText] = useState('');
    const [memoSheetText, setMemoSheetText] = useState('');
    const [showAiNotes, setShowAiNotes] = useState(false);
    const [attemptsCount, setAttemptsCount] = useState(1);
    const versionProgression = getVersionProgression(attemptsCount);
    const [attemptsHistory, setAttemptsHistory] = useState([]);
    const [copyTargetMode, setCopyTargetMode] = useState('both'); // 'both' | 'draft' | 'essay'
    const [aiCopiedToast, setAiCopiedToast] = useState(false);
    const [isNotesFocusMode, setIsNotesFocusMode] = useState(false);
    const [pinnedAiNotes, setPinnedAiNotes] = useState('');
    const [finalPlanText, setFinalPlanText] = useState('');
    const [finalLessonsText, setFinalLessonsText] = useState('');
    const [registeredKeys, setRegisteredKeys] = useState([]);
    const [showZwnjLabModal, setShowZwnjLabModal] = useState(false);
    const [zwnjTestInput, setZwnjTestInput] = useState('');
    const [labActiveTab, setLabActiveTab] = useState('conversation'); // 'conversation' | 'homoglyph' | 'spacing' | 'zwnj'
    const copyCountRef = useRef(0);

    // Floating windows state (transportables, redimensionnables, rétractables)
    const [showAdviceWindow, setShowAdviceWindow] = useState(false);
    const [adviceCollapsed, setAdviceCollapsed] = useState(false);
    const [showDraftWindow, setShowDraftWindow] = useState(false);
    const [showResponseWindow, setShowResponseWindow] = useState(false);
    const [showDidakbotPanel, setShowDidakbotPanel] = useState(false);

    const [windows, setWindows] = useState({
        advice: {
            x: Math.max(20, Math.round(((typeof window !== 'undefined' ? window.innerWidth : 1200) - 660) / 2)),
            y: 85,
            w: 660,
            h: 380
        },
        draft: {
            x: Math.max(30, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 540),
            y: 120,
            w: 510,
            h: 460
        },
        response: {
            x: 40,
            y: 120,
            w: 640,
            h: 500
        }
    });
    const [windowZ, setWindowZ] = useState({ advice: 19100, draft: 19050, response: 19060 });
    const [windowAction, setWindowAction] = useState(null);

    // 3. Timing & Anti-Cheat Telemetry
    const [sessionSeconds, setSessionSeconds] = useState(0);
    const [pasteAttemptCount, setPasteAttemptCount] = useState(0);
    const [toastMessage, setToastMessage] = useState('');
    const toastTimerRef = useRef(null);

    // 4. Modals State
    const [showShortWarning, setShowShortWarning] = useState(false);
    const [tooShortWarned, setToShortWarned] = useState(false);
    const [showFinalModal, setShowFinalModal] = useState(false);
    const [aiConversationText, setAiConversationText] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submittedResult, setSubmittedResult] = useState(null);
    const [showProgressionGuide, setShowProgressionGuide] = useState(true);
    const [showPreFinalWarning, setShowPreFinalWarning] = useState(false);

    // 5. Reopening & Continuous Perfection State
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [lastSubmittedBonus, setLastSubmittedBonus] = useState(null);
    const [currentGrade, setCurrentGrade] = useState('');
    const [initialGrade, setInitialGrade] = useState('');
    const [revisedGrade, setRevisedGrade] = useState('');
    const [reevaluating, setReevaluating] = useState(false);
    const [reevaluationFeedback, setReevaluationFeedback] = useState(null);
    const [showIntermediateEvalModal, setShowIntermediateEvalModal] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [lastAutoSavedAt, setLastAutoSavedAt] = useState('');
    const [isAutoSaving, setIsAutoSaving] = useState(false);

    // Homework configuration
    const minTimeMinutes = Number(homework?.minTimeMinutes || 25);
    const topicText = String(homework?.promptTopic || homework?.levels?.[0]?.instruction || homework?.title || 'Sujet de rédaction');

    const getStorageKey = () => {
        const sid = String(user?._id || user?.id || '');
        const hwId = String(homework?._id || '');
        return (sid && hwId) ? `conda_hw_draft_${hwId}_${sid}` : null;
    };

    const saveToLocalStorage = (data = {}) => {
        try {
            const key = getStorageKey();
            if (!key) return;
            const payload = {
                essayText: data.essayText !== undefined ? data.essayText : essayText,
                draftText: data.draftText !== undefined ? data.draftText : draftText,
                aiNotesText: data.aiNotesText !== undefined ? data.aiNotesText : aiNotesText,
                aiConversationText: data.aiConversationText !== undefined ? data.aiConversationText : aiConversationText,
                sessionSeconds: data.sessionSeconds !== undefined ? data.sessionSeconds : sessionSeconds,
                attemptsCount: data.attemptsCount !== undefined ? data.attemptsCount : attemptsCount,
                savedAt: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (_) {}
    };

    // Mutable ref to always have latest state without triggering re-renders/timer resets
    const latestDataRef = useRef({
        essayText,
        draftText,
        aiNotesText,
        aiConversationText,
        sessionSeconds,
        attemptsCount,
        attemptsHistory
    });

    useEffect(() => {
        latestDataRef.current = {
            essayText,
            draftText,
            aiNotesText,
            aiConversationText,
            sessionSeconds,
            attemptsCount,
            attemptsHistory
        };
    });

    // Sauvegarde locale immédiate à chaque frappe dans le brouillon ou la copie
    useEffect(() => {
        if (!initialLoading) {
            saveToLocalStorage({ essayText, draftText, aiNotesText, aiAdviceBlocks, aiConversationText, sessionSeconds, attemptsCount });
        }
    }, [essayText, draftText, aiNotesText, aiAdviceBlocks, aiConversationText]);

    // Fetch previous submission if student reopens an already-submitted homework or draft
    useEffect(() => {
        let isMounted = true;
        const sid = String(user?._id || user?.id || '');
        const hwId = String(homework?._id || '');
        if (!sid || !hwId) {
            setInitialLoading(false);
            return;
        }

        // Check local storage backup first
        let localBackup = null;
        try {
            const key = `conda_hw_draft_${hwId}_${sid}`;
            const raw = localStorage.getItem(key);
            if (raw) localBackup = JSON.parse(raw);
        } catch (_) {}

        fetch(`/api/eleve/homework/submission/${hwId}/${sid}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((sub) => {
                if (!isMounted) return;
                
                if (!sub) {
                    // No server submission yet, check if we can restore from local backup
                    if (localBackup && (localBackup.essayText || localBackup.draftText)) {
                        let initialText = localBackup.essayText || '';
                        if (localBackup.draftText && localBackup.draftText.trim()) {
                            if (!initialText) {
                                initialText = localBackup.draftText.trim();
                            } else if (!initialText.includes(localBackup.draftText.trim())) {
                                initialText = `${localBackup.draftText.trim()}\n\n${initialText}`;
                            }
                        }
                        if (initialText) {
                            setEssayText(initialText);
                            setHistory([initialText]);
                            setHistoryIdx(0);
                        }
                        if (localBackup.aiAdviceBlocks && Array.isArray(localBackup.aiAdviceBlocks)) {
                            setAiAdviceBlocks(localBackup.aiAdviceBlocks);
                            setAiNotesText(serializeAdviceBlocks(localBackup.aiAdviceBlocks));
                            const lastContent = localBackup.aiAdviceBlocks[localBackup.aiAdviceBlocks.length - 1]?.content || '';
                            setPinnedAiNotes(lastContent);
                        } else if (localBackup.aiNotesText) {
                            const blocks = parseAdviceBlocks(localBackup.aiNotesText);
                            setAiAdviceBlocks(blocks);
                            setAiNotesText(localBackup.aiNotesText);
                            setPinnedAiNotes(localBackup.aiNotesText);
                        }
                        if (localBackup.aiConversationText) setAiConversationText(localBackup.aiConversationText);
                        if (localBackup.attemptsCount) setAttemptsCount(localBackup.attemptsCount);
                        showToast("💾 Votre travail précédent a été restauré depuis ce navigateur !");
                    }
                    setInitialLoading(false);
                    return;
                }

                const isRealFinalSubmission = Boolean(sub.grade || (sub.feedback && sub.feedback !== 'Brouillon sauvegardé automatiquement.'));
                setAlreadySubmitted(isRealFinalSubmission);

                const bonus = sub.examBonusPoints ?? sub.learningEfficiency?.examBonusPoints ?? null;
                setLastSubmittedBonus(bonus);
                if (sub.grade) setCurrentGrade(sub.grade);
                if (sub.initialGrade) setInitialGrade(sub.initialGrade);
                if (sub.revisedGrade) setRevisedGrade(sub.revisedGrade);

                // Recover best content (prefer server if populated, fallback to local backup)
                const resolvedEssay = sub.content || localBackup?.essayText || '';
                const resolvedDraft = sub.draftContent || localBackup?.draftText || '';
                const resolvedNotes = sub.aiNotes || localBackup?.aiNotesText || '';
                const resolvedChat = sub.aiConversationLog || localBackup?.aiConversationText || '';

                let initialText = resolvedEssay;
                if (resolvedDraft && resolvedDraft.trim()) {
                    if (!initialText) {
                        initialText = resolvedDraft.trim();
                    } else if (!initialText.includes(resolvedDraft.trim())) {
                        initialText = `${resolvedDraft.trim()}\n\n${initialText}`;
                    }
                }

                if (initialText) {
                    setEssayText(initialText);
                    setHistory([initialText]);
                    setHistoryIdx(0);
                }
                if (resolvedNotes) {
                    let blocks = [];
                    if (localBackup?.aiAdviceBlocks && Array.isArray(localBackup.aiAdviceBlocks) && localBackup.aiAdviceBlocks.length > 0) {
                        blocks = localBackup.aiAdviceBlocks;
                    } else {
                        blocks = parseAdviceBlocks(resolvedNotes);
                    }
                    setAiAdviceBlocks(blocks);
                    setAiNotesText(resolvedNotes);
                    const lastContent = blocks.length > 0 ? blocks[blocks.length - 1].content : resolvedNotes;
                    setPinnedAiNotes(lastContent);
                    if (isRealFinalSubmission) setShowAiNotes(true);
                }
                if (resolvedChat) setAiConversationText(resolvedChat);

                if (sub.memoSheet) {
                    setMemoSheetText(sub.memoSheet);
                    const parts = sub.memoSheet.split('--- CONSEILS ET PIÈGES RETENUS POUR LE DS ---');
                    if (parts[0]) setFinalPlanText(parts[0].replace('--- PLAN CONSOLIDÉ AU BROUILLON ---', '').trim());
                    if (parts[1]) setFinalLessonsText(parts[1].trim());
                }
                if (sub.attemptsCount) {
                    setAttemptsCount(Math.max(1, Number(sub.attemptsCount)));
                } else if (localBackup?.attemptsCount) {
                    setAttemptsCount(Math.max(1, Number(localBackup.attemptsCount)));
                }

                if (Array.isArray(sub.learningEfficiency?.attemptsHistory) && sub.learningEfficiency.attemptsHistory.length > 0) {
                    setAttemptsHistory(sub.learningEfficiency.attemptsHistory);
                }
                if (Array.isArray(sub.learningEfficiency?.generatedKeys) && sub.learningEfficiency.generatedKeys.length > 0) {
                    setRegisteredKeys(sub.learningEfficiency.generatedKeys);
                } else if (sub.sessionToken) {
                    setRegisteredKeys([sub.sessionToken]);
                }
                if (sub.timeSpentSeconds) {
                    setSessionSeconds(Number(sub.timeSpentSeconds));
                }

                if (isRealFinalSubmission) {
                    setShowProgressionGuide(false);
                }
                setInitialLoading(false);
            })
            .catch(() => {
                if (isMounted) {
                    if (localBackup && (localBackup.essayText || localBackup.draftText)) {
                        let initialText = localBackup.essayText || '';
                        if (localBackup.draftText && localBackup.draftText.trim()) {
                            if (!initialText) initialText = localBackup.draftText.trim();
                            else if (!initialText.includes(localBackup.draftText.trim())) {
                                initialText = `${localBackup.draftText.trim()}\n\n${initialText}`;
                            }
                        }
                        if (initialText) setEssayText(initialText);
                    }
                    setInitialLoading(false);
                }
            });

        return () => { isMounted = false; };
    }, [homework?._id, user?._id, user?.id]);

    // Live timer (ticks every 1s)
    useEffect(() => {
        const interval = setInterval(() => {
            setSessionSeconds((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Sauvegarde automatique et résiliente (Local + Serveur)
    const triggerAutoSave = async (isManual = false) => {
        const cur = latestDataRef.current;
        const cleanDraft = (cur.draftText || '').trim();
        const cleanEssay = (cur.essayText || '').trim();
        const cleanNotes = (cur.aiNotesText || '').trim();
        const cleanChat = (cur.aiConversationText || '').trim();
        const hwId = homework?._id;
        const sid = user?._id || user?.id;
        if (!hwId || !sid) return;
        if (!cleanDraft && !cleanEssay && !cleanNotes && !cleanChat) return;

        // Sauvegarde immédiate en localStorage
        saveToLocalStorage(cur);

        try {
            setIsAutoSaving(true);
            const res = await fetch('/api/eleve/homework/autosave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify({
                    homeworkId: hwId,
                    playerId: sid,
                    userText: cur.essayText || '',
                    draftContent: cur.draftText || '',
                    aiNotes: cur.aiNotesText || '',
                    aiConversationLog: cur.aiConversationText || '',
                    timeSpentSeconds: cur.sessionSeconds || 0,
                    attemptsCount: cur.attemptsCount || 1,
                    attemptsHistory: cur.attemptsHistory || []
                })
            });
            const data = await res.json();
            setIsAutoSaving(false);
            if (data?.ok && data.savedAt) {
                setLastAutoSavedAt(data.savedAt);
                if (isManual) {
                    showToast(`✅ Brouillon sauvegardé à ${data.savedAt}`);
                }
            }
        } catch (e) {
            setIsAutoSaving(false);
            console.warn('Autosave server warning:', e);
            if (isManual) {
                showToast(`💾 Sauvegardé en mémoire sur ce navigateur`);
            }
        }
    };

    // Sauvegarde serveur périodique toutes les 30 secondes (timer stable)
    useEffect(() => {
        const THIRTY_SECONDS = 30 * 1000;
        const timer = setInterval(() => {
            triggerAutoSave(false);
        }, THIRTY_SECONDS);
        return () => clearInterval(timer);
    }, [homework?._id, user?._id, user?.id]);

    // Sauvegarde debouncée 4 secondes après une pause d'écriture
    useEffect(() => {
        const cleanDraft = (draftText || '').trim();
        const cleanEssay = (essayText || '').trim();
        if (!cleanDraft && !cleanEssay) return;

        const timer = setTimeout(() => {
            triggerAutoSave(false);
        }, 4000);
        return () => clearTimeout(timer);
    }, [draftText, essayText]);

    // Sauvegarde au changement d'onglet ou fermeture de fenêtre
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                triggerAutoSave(false);
            }
        };
        const handleBeforeUnload = () => {
            triggerAutoSave(false);
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    const formatTimer = (totalSec) => {
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const showToast = (msg) => {
        setToastMessage(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            setToastMessage('');
        }, 3200);
    };

    const draftWarnedRef = useRef(false);

    // Automatically display advice window when pinnedAiNotes is populated
    useEffect(() => {
        if (pinnedAiNotes && pinnedAiNotes.trim().length > 0) {
            setShowAdviceWindow(true);
            setAdviceCollapsed(false);
        }
    }, [pinnedAiNotes]);

    const bringWindowToFront = (name) => {
        setWindowZ((prev) => {
            const highest = Math.max(...Object.values(prev), 19000);
            return { ...prev, [name]: highest + 1 };
        });
    };

    const startWindowMove = (e, name) => {
        e.preventDefault();
        bringWindowToFront(name);
        setWindowAction({
            name,
            type: 'move',
            startX: e.clientX,
            startY: e.clientY,
            startRect: { ...windows[name] }
        });
    };

    const startWindowResize = (e, name, dir) => {
        e.preventDefault();
        e.stopPropagation();
        bringWindowToFront(name);
        setWindowAction({
            name,
            type: 'resize',
            dir,
            startX: e.clientX,
            startY: e.clientY,
            startRect: { ...windows[name] }
        });
    };

    useEffect(() => {
        if (!windowAction) return;

        const onMouseMove = (e) => {
            const dx = e.clientX - windowAction.startX;
            const dy = e.clientY - windowAction.startY;
            const rect = windowAction.startRect;

            if (windowAction.type === 'move') {
                const nextX = Math.max(10, Math.min(window.innerWidth - 120, rect.x + dx));
                const nextY = Math.max(70, Math.min(window.innerHeight - 80, rect.y + dy));
                setWindows((prev) => ({
                    ...prev,
                    [windowAction.name]: { ...prev[windowAction.name], x: nextX, y: nextY }
                }));
            } else if (windowAction.type === 'resize') {
                const minW = 280;
                const minH = 160;
                const maxW = Math.min(1100, window.innerWidth - 30);
                const maxH = Math.min(900, window.innerHeight - 80);

                let nextW = rect.w;
                let nextH = rect.h;
                let nextX = rect.x;
                let nextY = rect.y;

                if (windowAction.dir.includes('e')) nextW = Math.min(maxW, Math.max(minW, rect.w + dx));
                if (windowAction.dir.includes('s')) nextH = Math.min(maxH, Math.max(minH, rect.h + dy));
                if (windowAction.dir.includes('w')) {
                    const proposedW = rect.w - dx;
                    if (proposedW >= minW && proposedW <= maxW) {
                        nextW = proposedW;
                        nextX = rect.x + dx;
                    }
                }
                if (windowAction.dir.includes('n')) {
                    const proposedH = rect.h - dy;
                    if (proposedH >= minH && proposedH <= maxH) {
                        nextH = proposedH;
                        nextY = rect.y + dy;
                    }
                }

                setWindows((prev) => ({
                    ...prev,
                    [windowAction.name]: { x: nextX, y: nextY, w: nextW, h: nextH }
                }));
            }
        };

        const onMouseUp = () => {
            setWindowAction(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
    }, [windowAction]);

    // Text edition with Undo/Redo tracking
    const handleTextChange = (e) => {
        const newText = e.target.value;
        setEssayText(newText);
        // Truncate future history and push new state
        const updated = history.slice(0, historyIdx + 1);
        if (updated[updated.length - 1] !== newText) {
            updated.push(newText);
            if (updated.length > 60) updated.shift();
            setHistory(updated);
            setHistoryIdx(updated.length - 1);
        }
    };

    const handleDraftChange = (e) => {
        setDraftText(e.target.value);
    };

    const handleAiNotesChange = (e) => {
        setAiNotesText(e.target.value);
    };

    // Copier-coller autorisé : Ctrl+C / Cmd+C sur le devoir effectue un clic virtuel sur "Copier mon devoir pour l'IA"
    const handleTextareaCopy = (e) => {
        e.preventDefault();
        handleCopyForAI();
    };

    const handleBlockedPaste = (e) => {
        e.preventDefault();
        showToast('Coller dans le brouillon-devoir est interdit.');
    };

    const handleBlockedCopy = (e) => {
        // Copie standard dans les champs secondaires
    };

    // Raccourcis clavier (Ctrl+C déclenche la copie officielle avec injection)
    const handleKeyDown = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
            e.preventDefault();
            handleCopyForAI();
        }
    };

    // Interception globale de Ctrl+C / Cmd+C et clic droit Copier depuis la page vers l'IA
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
                const activeEl = document.activeElement;
                const activeTag = activeEl?.tagName?.toLowerCase();
                const activeClass = activeEl?.className || '';
                // Si l'élève est dans un champ secondaire d'une modale (ex: prise de notes, chat), on le laisse copier son texte
                if ((activeTag === 'textarea' || activeTag === 'input') && !String(activeClass).includes('conda-redaction-textarea')) {
                    return;
                }
                if (!isNotesFocusMode && !showFinalModal && !showShortWarning && !showPreFinalWarning && !showIntermediateEvalModal) {
                    e.preventDefault();
                    handleCopyForAI();
                }
            }
        };

        const handleGlobalCopy = (e) => {
            const activeEl = document.activeElement;
            const activeTag = activeEl?.tagName?.toLowerCase();
            const activeClass = activeEl?.className || '';
            if ((activeTag === 'textarea' || activeTag === 'input') && !String(activeClass).includes('conda-redaction-textarea')) {
                return;
            }
            if (!isNotesFocusMode && !showFinalModal && !showShortWarning && !showPreFinalWarning && !showIntermediateEvalModal) {
                e.preventDefault();
                handleCopyForAI();
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        window.addEventListener('copy', handleGlobalCopy);
        return () => {
            window.removeEventListener('keydown', handleGlobalKeyDown);
            window.removeEventListener('copy', handleGlobalCopy);
        };
    }, [essayText, topicText, registeredKeys, aiNotesText, isNotesFocusMode, showFinalModal, showShortWarning, showPreFinalWarning, showIntermediateEvalModal]);

    const handleUndo = () => {
        if (historyIdx > 0) {
            const nextIdx = historyIdx - 1;
            setHistoryIdx(nextIdx);
            setEssayText(history[nextIdx]);
        }
    };

    const handleRedo = () => {
        if (historyIdx < history.length - 1) {
            const nextIdx = historyIdx + 1;
            setHistoryIdx(nextIdx);
            setEssayText(history[nextIdx]);
        }
    };

    // Helper to evaluate an attempt (at least 20 lines or 150 words)
    const formatAttemptData = (num, text, draft, mode) => {
        const clean = String(text || '').trim();
        const cleanDraft = String(draft || '').trim();
        const words = clean ? clean.split(/\s+/).filter(Boolean).length : 0;
        const rawLines = clean ? clean.split('\n').filter(l => l.trim().length > 0).length : 0;
        const lines = Math.max(rawLines, Math.round(words / 9));
        const isSubstantial = lines >= 20 || words >= 150;
        return {
            attemptNumber: num,
            text: clean,
            draft: cleanDraft,
            targetMode: mode || 'both',
            wordsCount: words,
            linesCount: lines,
            isSubstantial,
            savedAt: new Date().toLocaleTimeString()
        };
    };

    // Save or update an attempt in history
    const archiveAttempt = (num, text, draft, mode) => {
        const entry = formatAttemptData(num, text, draft, mode);
        setAttemptsHistory((prev) => {
            const idx = prev.findIndex((a) => a.attemptNumber === num);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = entry;
                return next;
            }
            return [...prev, entry];
        });
        return entry;
    };

    // "Copier pour l'IA" handler with smart instruction prompt & unique session token
    const handleCopyForAI = async () => {
        const cleanEssay = (essayText || '').trim();

        if (!cleanEssay) {
            showToast("⚠️ Écris ton travail (brouillon ou devoir) avant de copier pour l'IA.");
            return;
        }

        copyCountRef.current += 1;
        const currentKey = generateCopyKey(user?._id || user?.id, homework?._id, copyCountRef.current);
        setRegisteredKeys(prev => (prev.includes(currentKey) ? prev : [...prev, currentKey]));

        const currentToken = currentKey;
        const watermark = computeInvisibleWatermark(user?._id || user?.id, homework?._id);

        const studentFullName = String(user?.name || user?.username || `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Élève').trim();

        const aiPromptHeader = `Sujet du devoir : "${topicText || homework?.title || 'Devoir'}"
Élève : ${studentFullName}

Consignes pour le Tuteur Didak'bot (Histoire-Géographie 2nde) :
1. AVIS GÉNÉRAL :
   - Si le travail est en cours ou perfectible : commence par "C'est bien, il te reste une bonne marge de progression !" et propose 2 ou 3 axes d'amélioration méthodologiques concrets (méthode AEI : Affirmer, Expliquer, Illustrer, équilibre du plan, notions clés).
   - Si le travail est déjà solide : commence par "Excellente base, ton travail est déjà solide !" et propose 1 ou 2 pistes d'approfondissement historique (historiens de référence, faits précis).

2. RÈGLES STRICTES :
   ⛔ INTERDICTION ABSOLUE : Ne donne JAMAIS d'exemple rédigé ni de paragraphe que l'élève pourrait recopier. Guide sa réflexion par des questions, mais ne rédige RIEN à sa place.
   ⛔ Ne dis JAMAIS "c'est parfait, tu n'as plus rien à faire". En Histoire, il y a toujours une nuance à apporter.`;

        const preparedEssay = injectParagraphZwnj(injectSentenceSpacing(injectHomoglyphs(cleanEssay)));

        let textToCopy = `${aiPromptHeader}

--- MON TRAVAIL RÉDIGÉ SUR CONDAMINEWEB (BROUILLON & DEVOIR) : ---
${watermark}${preparedEssay}

${aiNotesText.trim() ? `--- MES DERNIÈRES NOTES DE CONSEILS : ---\n${aiNotesText.trim()}\n\n` : ''}Consignes pour Didak'bot :
Analyse mon travail selon les règles ci-dessus sans jamais rédiger à ma place.`;

        const modeLabel = 'Brouillon & Devoir';

        // Injecte les homoglyphes invisibles sur l'ENSEMBLE du texte copié
        textToCopy = injectHomoglyphs(textToCopy, 2);

        let copiedOk = false;
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(textToCopy);
                copiedOk = true;
            }
        } catch (clipErr) {
            console.warn('navigator.clipboard direct write failed, trying fallback execCommand:', clipErr);
        }

        if (!copiedOk) {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = textToCopy;
                textArea.style.position = 'fixed';
                textArea.style.top = '-9999px';
                textArea.style.left = '-9999px';
                textArea.setAttribute('readonly', '');
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                copiedOk = document.execCommand('copy');
                document.body.removeChild(textArea);
            } catch (fallbackErr) {
                console.error('Fallback execCommand copy failed:', fallbackErr);
            }
        }

        openAddNotesModal();
        setAiCopiedToast(true);
        if (copiedOk) {
            showToast("📋 Devoir copié ! Collez-le dans Didak'bot.");
        } else {
            showToast("ℹ️ Devoir prêt à être collé dans Didak'bot.");
        }
    };

    const openDidakbot = () => {
        if (!homework?.didakbotUrl) return;
        const studentFullName = String(user?.name || user?.username || `${user?.prenom || ''} ${user?.nom || ''}`.trim() || 'Élève').trim();
        const didakbotHref = `/?didakbot=${encodeURIComponent(homework.didakbotUrl)}&student=${encodeURIComponent(studentFullName)}&title=${encodeURIComponent(homework.title || '')}`;
        window.open(didakbotHref, '_blank');
    };

    // Helper handlers pour la modale de notes
    const openAddNotesModal = () => {
        setEditingBlockId(null);
        setEditingNoteText('');
        setEditingChatText('');
        setIsNotesFocusMode(true);
    };

    const handleToggleDidakbot = () => {
        setShowDidakbotPanel(prev => {
            const next = !prev;
            if (next) {
                // Quand le bot s'ouvre, la page pour prendre des notes sur l'IA s'ouvre aussi
                openAddNotesModal();
            }
            return next;
        });
    };

    const openEditNotesModal = (block) => {
        setEditingBlockId(block.id);
        setEditingNoteText(block.content || '');
        setEditingChatText('');
        setIsNotesFocusMode(true);
    };

    const handleDeleteAdviceBlock = (blockId) => {
        if (!window.confirm("Voulez-vous supprimer ce bloc de conseils ?")) return;
        const nextBlocks = aiAdviceBlocks.filter(b => b.id !== blockId);
        setAiAdviceBlocks(nextBlocks);
        const serialized = serializeAdviceBlocks(nextBlocks);
        setAiNotesText(serialized);
        const lastContent = nextBlocks.length > 0 ? nextBlocks[nextBlocks.length - 1].content : '';
        setPinnedAiNotes(lastContent);
        showToast("🗑️ Bloc de conseils supprimé.");
    };

    // Validation des deux espaces obligatoires pour la prise de notes / consultation IA
    const isNotesFilled = (editingNoteText || '').trim().length >= 10;
    const isChatFilled = (editingChatText || '').trim().length >= 5;
    const isBothNotesSpacesFilled = Boolean(editingBlockId ? isNotesFilled : (isNotesFilled && isChatFilled));

    // Fermeture de la fenêtre : impossible tant que les deux espaces ne sont pas remplis
    const handleCancelOrCloseNotesModal = () => {
        if (!isBothNotesSpacesFilled && !editingBlockId) {
            showToast("⚠️ Les deux espaces doivent être remplis pour continuer (vos notes + la réponse de l'IA).");
            return;
        }
        setIsNotesFocusMode(false);
        setShowDidakbotPanel(false);
        setEditingBlockId(null);
        setEditingNoteText('');
        setEditingChatText('');
    };

    // "J'ai fini de prendre mes notes" handler: consigne dans un bloc distinct et enregistre la réponse de l'IA
    const handleFinishNotes = () => {
        const cleanNotes = (editingNoteText || '').trim();
        const cleanChat = (editingChatText || '').trim();

        if (!cleanNotes || cleanNotes.length < 10) {
            showToast("⚠️ Rédigez d'abord vos notes personnelles dans le 1er espace (au moins quelques mots).");
            return;
        }

        if (!editingBlockId && (!cleanChat || cleanChat.length < 5)) {
            showToast("⚠️ Collez la réponse reçue de l'IA dans le 2e espace pour enregistrer et valider.");
            return;
        }

        let nextBlocks = [...aiAdviceBlocks];
        let targetVer = attemptsCount;

        if (editingBlockId) {
            // Mode modification d'un bloc existant
            nextBlocks = nextBlocks.map((b) => {
                if (b.id === editingBlockId) {
                    return {
                        ...b,
                        content: cleanNotes,
                        updatedAt: new Date().toISOString()
                    };
                }
                return b;
            });
            showToast("✏️ Bloc de conseils mis à jour avec succès !");
        } else {
            // Mode consignation d'un NOUVEAU bloc distinct
            targetVer = attemptsCount === 1 && aiAdviceBlocks.length === 0 ? 2 : (aiAdviceBlocks.length + 1);
            const newBlock = {
                id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                versionTarget: targetVer,
                title: `Conseils pour la Version ${targetVer}`,
                content: cleanNotes,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                createdAt: new Date().toISOString()
            };
            nextBlocks.push(newBlock);

            // Archive automatiquement l'essai actuel et passe à la version supérieure
            archiveAttempt(attemptsCount, essayText, draftText, copyTargetMode);
            setAttemptsCount((prev) => Math.max(prev + 1, targetVer));

            showToast(`✨ Conseils consignés dans un bloc distinct pour la Version ${targetVer} !`);
        }

        // Sauvegarde au fur et à mesure de la réponse IA
        if (cleanChat && cleanChat.length > 0) {
            setAiConversationText((prev) => {
                if (!prev) return cleanChat;
                if (prev.includes(cleanChat)) return prev;
                return `${prev}\n\n--- RÉPONSE IA (VERSION ${targetVer}) ---\n${cleanChat}`;
            });
        }

        setAiAdviceBlocks(nextBlocks);
        const serialized = serializeAdviceBlocks(nextBlocks);
        setAiNotesText(serialized);
        setPinnedAiNotes(cleanNotes);

        setIsNotesFocusMode(false);
        // Ferme automatiquement Didak'bot quand l'élève clique sur "J'ai fini de prendre mes notes"
        setShowDidakbotPanel(false);
        setEditingBlockId(null);
        setEditingNoteText('');
        setEditingChatText('');
        setShowAiNotes(true);
        setShowAdviceWindow(true);
        setAdviceCollapsed(false);
        bringWindowToFront('advice');


        // Déclenche une sauvegarde automatique en arrière-plan
        setTimeout(() => triggerAutoSave(false), 500);
    };

    // "Nouvelle tentative" handler
    const handleNewAttempt = () => {
        if (!confirm("Voulez-vous démarrer une nouvelle tentative ? Votre brouillon et vos notes sur l'IA seront conservés pour guider votre écriture.")) {
            return;
        }
        archiveAttempt(attemptsCount, essayText, draftText, copyTargetMode);
        setAttemptsCount((prev) => prev + 1);
        setAiCopiedToast(false);
        showToast(`🔄 Tentative ${attemptsCount + 1} démarrée. Gardez vos notes de l'IA sous les yeux !`);
    };

    const handleValidateClick = () => {
        const cleanEssay = essayText.trim();
        if (!cleanEssay) {
            alert("⚠️ Veuillez saisir du texte dans votre devoir avant de valider.");
            return;
        }
        const minTimeSec = minTimeMinutes * 60;
        if (sessionSeconds < minTimeSec && !tooShortWarned) {
            setShowShortWarning(true);
            return;
        }
        setShowPreFinalWarning(true);
    };

    const handleConfirmValidateAnyway = () => {
        setToShortWarned(true);
        setShowShortWarning(false);
        setShowPreFinalWarning(true);
    };

    // Final submission
    const handleFinalSubmit = async () => {
        const cleanEssay = essayText.trim();
        if (!cleanEssay) {
            showToast("⚠️ Veuillez saisir du texte dans votre devoir avant de valider.");
            return;
        }

        setSubmitting(true);
        const finalEntry = formatAttemptData(attemptsCount, cleanEssay, '', 'essay');
        const historyToSend = attemptsHistory.filter(a => a.attemptNumber !== attemptsCount);
        historyToSend.push(finalEntry);

        const currentToken = registeredKeys[registeredKeys.length - 1] || computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
        const planText = finalPlanText.trim();
        const lessonsText = finalLessonsText.trim();
        const combinedMemoSheet = (planText || lessonsText)
            ? `--- PLAN CONSOLIDÉ AU BROUILLON ---\n${planText}\n\n--- CONSEILS ET PIÈGES RETENUS POUR LE DS ---\n${lessonsText}`
            : '';

        const payload = {
            homeworkId: homework._id,
            levelIndex: 0,
            playerId: user._id || user.id,
            userText: cleanEssay,
            draftContent: '',
            aiNotes: aiNotesText,
            memoSheet: combinedMemoSheet,
            sessionToken: currentToken,
            registeredKeys,
            aiConversationLog: aiConversationText,
            timeSpentSeconds: sessionSeconds,
            attemptsCount,
            attemptsHistory: historyToSend
        };

        try {
            const res = await fetch('/api/eleve/homework/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            setSubmitting(false);
            setShowFinalModal(false);
            if (data.error) {
                alert(`Erreur: ${data.error}`);
                return;
            }
            if (data.grade) setCurrentGrade(data.grade);
            if (data.initialGrade) setInitialGrade(data.initialGrade);
            if (data.revisedGrade) setRevisedGrade(data.revisedGrade);
            setSubmittedResult(data);
        } catch (err) {
            setSubmitting(false);
            setShowFinalModal(false);
            alert(`Erreur réseau: ${err.message}`);
        }
    };

    // AI Re-evaluation handler (conçu pour progresser sur plusieurs séances)
    const handleReevaluateWork = async (customChat) => {
        const cleanEssay = essayText.trim();
        const chatToSave = typeof customChat === 'string' ? customChat : aiConversationText;

        if (!cleanEssay) {
            showToast("⚠️ Votre devoir est vide. Écrivez du texte pour le faire corriger.");
            return;
        }
        setReevaluating(true);
        setShowIntermediateEvalModal(false);
        try {
            const res = await fetch('/api/eleve/homework/reevaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    homeworkId: homework._id,
                    playerId: user._id || user.id,
                    userText: cleanEssay,
                    draftContent: '',
                    aiNotes: aiNotesText,
                    aiConversationLog: chatToSave,
                    attemptsCount: attemptsCount
                })
            });
            const data = await res.json();
            setReevaluating(false);
            if (!res.ok || !data.ok) {
                alert(`Erreur réévaluation : ${data.error || 'Erreur inconnue'}`);
                return;
            }
            if (data.grade) setCurrentGrade(data.grade);
            if (data.initialGrade) setInitialGrade(data.initialGrade);
            if (data.revisedGrade) setRevisedGrade(data.revisedGrade);
            setAlreadySubmitted(true);
            setReevaluationFeedback(data);
            showToast(`🎯 Note IA actualisée : ${data.grade} / 20 !`);
        } catch (err) {
            setReevaluating(false);
            alert(`Erreur réseau lors de la réévaluation: ${err.message}`);
        }
    };

    const wordsCount = essayText.trim() ? essayText.trim().split(/\s+/).filter(Boolean).length : 0;

    // Render completion confirmation
    if (submittedResult) {
        const eff = submittedResult.learningEfficiency;
        const bonus = submittedResult.examBonusPoints ?? eff?.examBonusPoints ?? 0.5;
        const studentMsg = eff?.studentMessage || "Bravo pour votre investissement et votre rigueur !";
        const attemptsEval = eff?.attemptsEvaluation || [];

        return (
            <div className="conda-redaction-container flex items-center justify-center p-6 text-center">
                <div className="bg-slate-900 border border-amber-500/50 rounded-3xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
                    <div className="text-5xl">🎟️</div>
                    <div className="space-y-1">
                        <div className="text-[11px] font-black uppercase text-amber-400 tracking-widest">Récompense d'Apprentissage</div>
                        <h2 className="text-2xl font-black text-white uppercase tracking-wider">Devoir Terminé & Transmis !</h2>
                    </div>

                    {/* Gold Bonus Banner or Blocked Banner */}
                    {bonus > 0 ? (
                        <div className="bg-gradient-to-r from-amber-500/20 via-amber-400/30 to-amber-500/20 border-2 border-amber-400/60 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                            <div className="text-xs font-black uppercase tracking-widest text-amber-300">Bonus pour le Prochain Contrôle sur Table</div>
                            <div className="text-5xl font-black text-amber-300 my-2 drop-shadow-md">
                                +{bonus} <span className="text-2xl font-bold text-amber-200">pt{bonus > 1 ? 's' : ''}</span>
                            </div>
                            <p className="text-xs text-amber-100/90 font-medium max-w-lg mx-auto">
                                Ce bonus sera ajouté par votre professeur à votre note du prochain contrôle sur table (applicable jusqu'au plafond de 15,5/20).
                            </p>
                        </div>
                    ) : (
                        <div className="bg-rose-950/40 border-2 border-rose-500/60 rounded-2xl p-6 text-center shadow-lg relative overflow-hidden">
                            <div className="text-xs font-black uppercase tracking-widest text-rose-400">Bonus Bloqué</div>
                            <div className="text-4xl font-black text-rose-300 my-2">
                                0 pt
                            </div>
                            <p className="text-xs text-rose-200 font-bold max-w-lg mx-auto">
                                ❌ Échec : tu as caché une partie de la conversation avec l'IA. Ton bonus d'examen est bloqué pour cette session.
                            </p>
                        </div>
                    )}

                    {/* Personal Encouragement / Feedback */}
                    <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-5 text-left space-y-3">
                        <div className="text-[11px] font-black uppercase text-indigo-400 tracking-wider">Diagnostic Pédagogique</div>
                        <p className="text-sm text-slate-200 font-medium leading-relaxed">
                            {studentMsg}
                        </p>

                        {/* Breakdown per attempt */}
                        {attemptsEval.length > 0 && (
                            <div className="pt-3 border-t border-slate-700 space-y-2 text-xs">
                                <div className="text-[10px] font-bold text-slate-400 uppercase">Détail des versions évaluées :</div>
                                {attemptsEval.map((att, idx) => (
                                    <div key={idx} className="flex items-start justify-between bg-slate-900/60 p-2.5 rounded-xl border border-slate-700/60">
                                        <div>
                                            <span className="font-bold text-slate-200">Essai n°{att.attemptNumber || idx + 1} :</span>{' '}
                                            <span className="text-slate-300">{att.comment || (att.isSubstantial ? 'Essai consistant' : 'Essai court')}</span>
                                        </div>
                                        {att.adviceStatus && (
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                att.adviceStatus === 'OUI' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            }`}>
                                                Conseils : {att.adviceStatus}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Note Progressive IA */}
                    {(submittedResult.grade || currentGrade) && (
                        <div className="bg-gradient-to-r from-indigo-950/60 via-slate-900 to-indigo-950/60 border-2 border-indigo-500/50 rounded-2xl p-5 text-center shadow-lg">
                            <div className="text-xs font-black uppercase tracking-widest text-indigo-300">
                                🎯 Note d'Évaluation Progressive IA
                            </div>
                            <div className="text-4xl font-black text-indigo-200 my-1 drop-shadow-md">
                                {submittedResult.grade || currentGrade} <span className="text-xl font-bold text-indigo-400">/ 20</span>
                            </div>
                            {(submittedResult.initialGrade || initialGrade) && (submittedResult.revisedGrade || revisedGrade) ? (
                                <p className="text-xs text-indigo-200/90 font-medium max-w-lg mx-auto mt-1">
                                    🌱 Note initiale : <strong>{submittedResult.initialGrade || initialGrade}/20</strong> ➔ 🚀 Note après révision : <strong>{submittedResult.revisedGrade || revisedGrade}/20</strong>
                                </p>
                            ) : (
                                <p className="text-xs text-indigo-200/90 font-medium max-w-lg mx-auto mt-1">
                                    Première note fixée à <strong>{submittedResult.grade || currentGrade}/20</strong>. Perfectionne ton devoir pour voir ta deuxième note s'ajouter (ex: 15-16) !
                                </p>
                            )}
                        </div>
                    )}

                    <div className="inline-block bg-slate-800 border border-slate-700 px-6 py-2.5 rounded-2xl text-slate-300 font-semibold text-xs">
                        ✍️ Copie enregistrée • Note progressive actualisée et transmise au professeur
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => {
                                setAlreadySubmitted(true);
                                setLastSubmittedBonus(bonus);
                                setSubmittedResult(null);
                                showToast("✨ Devoir réouvert ! Tu peux continuer à perfectionner ta rédaction avec l'IA.");
                            }}
                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm px-6 py-3.5 rounded-xl shadow-xl transition flex items-center justify-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
                        >
                            <span>✨</span>
                            <span>Continuer à perfectionner mon devoir avec l'IA</span>
                        </button>
                        <button
                            type="button"
                            onClick={onQuit}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-sm px-6 py-3.5 rounded-xl transition cursor-pointer"
                        >
                            Retour à la liste des devoirs
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="conda-redaction-container">
            {/* Header */}
            <header className="conda-redaction-header">
                <div className="conda-redaction-header-left">
                    <span className="conda-redaction-badge">✍️ Rédaction</span>
                    <h1 className="conda-redaction-title">{homework.title || 'Devoir Rédaction'}</h1>

                    {/* Progression des versions : Rouge (<3), Vert clair (3-4 Assez bien), Vert foncé (5-6 Bien), Vert très soutenu (7+ Très bien) */}
                    <div
                        className={`conda-version-progression-badge ${versionProgression.badgeClass}`}
                        title={`Version ${attemptsCount}. Barème : <3 = Rouge, 3-4 = Vert clair (Assez bien), 5-6 = Vert foncé (Bien), 7+ = Très bien.`}
                    >
                        <span>{versionProgression.icon}</span>
                        <span>{versionProgression.label}</span>
                    </div>

                    {alreadySubmitted && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-sm">
                            <span>✨</span>
                            <span>Perfectionnement IA</span>
                        </span>
                    )}
                </div>
                <div className="conda-redaction-header-right">
                    <span className="text-[11px] font-mono text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-lg border border-amber-500/30 hidden sm:inline-flex items-center gap-1.5" title="Jeton de session authentifiant vos échanges avec l'IA">
                        <span>🛡️</span>
                        <span>#{computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount)}</span>
                    </span>
                    <div className="conda-redaction-timer" title="Temps de travail actif">
                        <span>⏱️</span>
                        <span>{formatTimer(sessionSeconds)}</span>
                        <span className="text-[10px] font-bold text-slate-400">/ min {minTimeMinutes}m</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                        {isAutoSaving ? (
                            <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl flex items-center gap-1.5 animate-pulse" title="Sauvegarde en cours sur le serveur">
                                <span>💾</span>
                                <span>Sauvegarde...</span>
                            </span>
                        ) : lastAutoSavedAt ? (
                            <span className="text-[11px] font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl hidden md:flex items-center gap-1.5" title="Dernière sauvegarde réussie (local + serveur)">
                                <span>☁️</span>
                                <span>Sauvegardé {lastAutoSavedAt}</span>
                            </span>
                        ) : null}
                        <button
                            type="button"
                            onClick={() => triggerAutoSave(true)}
                            className="text-[11px] font-bold text-slate-200 hover:text-white bg-slate-800/90 hover:bg-slate-700 active:scale-95 px-2.5 py-1 rounded-xl border border-slate-700/80 flex items-center gap-1 transition shadow-sm"
                            title="Forcer la sauvegarde immédiate de votre travail"
                        >
                            <span>💾</span>
                            <span>Sauvegarder</span>
                        </button>
                    </div>

                    <button
                        type="button"
                        className="conda-rules-header-btn"
                        onClick={() => setShowProgressionGuide(true)}
                        title="Afficher les règles du jeu"
                    >
                        <span>🎯</span>
                        <span>Règles du jeu</span>
                    </button>
                    <button type="button" className="conda-redaction-quit-btn" onClick={onQuit}>
                        Quitter
                    </button>
                </div>
            </header>

            {/* Modal d'explication DEVANT l'épreuve : Règles du jeu & Évaluation sur la progression */}
            {showProgressionGuide && !alreadySubmitted && (
                <div className="conda-rules-modal-overlay" onClick={() => setShowProgressionGuide(false)}>
                    <div className="conda-rules-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setShowProgressionGuide(false)}
                            className="conda-rules-modal-close"
                            title="Fermer (✕)"
                        >
                            ✕
                        </button>

                        <div className="conda-rules-badge">
                            <span>🎯</span>
                            <span>Règles du jeu · Consignes officielles</span>
                        </div>

                        <h2 className="conda-rules-title">
                            Seule votre progression sera évaluée !
                        </h2>

                        <p className="conda-rules-main-desc">
                            Durant ce travail, vous devrez réaliser plusieurs versions de votre devoir. <strong>Seule votre progression entre la première et la dernière version sera prise en compte.</strong>
                        </p>

                        <div className="conda-rules-steps-grid">
                            <div className="conda-rules-step-row">
                                <span className="conda-rules-step-badge">1</span>
                                <span>✍️ <strong>Réalisez une version</strong> (brouillon + premier jet)</span>
                            </div>
                            <div className="conda-rules-step-row">
                                <span className="conda-rules-step-badge">2</span>
                                <span>📋 <strong>Copiez</strong> grâce au bouton officiel</span>
                            </div>
                            <div className="conda-rules-step-row">
                                <span className="conda-rules-step-badge">3</span>
                                <span>🤖 <strong>Collez</strong> dans l'agent IA (demandez à Gemini)</span>
                            </div>
                            <div className="conda-rules-step-row">
                                <span className="conda-rules-step-badge">4</span>
                                <span>📝 <strong>Prenez des notes</strong> sur ses conseils</span>
                            </div>
                            <div className="conda-rules-step-row highlight">
                                <span className="conda-rules-step-badge">5</span>
                                <span>🔄 <strong>Recommencez</strong> une nouvelle version</span>
                            </div>
                        </div>

                        <div className="conda-rules-goal-card">
                            💡 <strong>Objectif :</strong> Réaliser plusieurs versions et avoir une <strong>forte progression</strong> entre la première et la dernière version. L'IA vous aidera toujours à vous améliorer.
                        </div>

                        <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-3 text-xs text-amber-200 flex items-start gap-2.5 text-left">
                            <span className="text-base flex-shrink-0">⚠️</span>
                            <span><strong>Attention :</strong> S'il y a une trop grande différence de niveau entre votre travail final et votre prochain devoir, cette note ne sera pas prise en compte.</span>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowProgressionGuide(false)}
                            className="conda-rules-btn-start"
                        >
                            <span>🚀</span>
                            <span>J'ai compris les règles, commencer l'épreuve</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Fixed Topic Banner */}
            <section className="conda-redaction-topic-banner">
                <div className="conda-redaction-topic-label">
                    <span>📌</span>
                    <span>Sujet de la Rédaction</span>
                </div>
                <p className="conda-redaction-topic-text">{topicText}</p>
            </section>

            {/* Mention d'avertissement en haut du devoir */}
            <div className="conda-redaction-integrity-alert">
                <span className="conda-alert-icon">⚠️</span>
                <p className="conda-alert-text">
                    <strong>Attention :</strong> S'il y a une trop grande différence de niveau entre votre travail final et votre prochain devoir, cette note ne sera pas prise en compte.
                </p>
            </div>

            {/* Continuous AI Perfection Banner (Displayed if previously submitted) */}
            {alreadySubmitted && (
                <section className="conda-perfectionnement-banner">
                    <div className="conda-perfectionnement-left">
                        <span className="conda-perfectionnement-icon">🏆</span>
                        <div className="conda-perfectionnement-info">
                            <div className="conda-perfectionnement-tags">
                                <span className="conda-tag-rendered">✅ Devoir déjà rendu définitivement</span>
                                {currentGrade && (
                                    <span className="conda-tag-grade">
                                        🎯 Note IA : {currentGrade}/20
                                    </span>
                                )}
                                {lastSubmittedBonus !== null && (
                                    <span className="conda-tag-bonus">
                                        +{lastSubmittedBonus} pt{lastSubmittedBonus > 1 ? 's' : ''} bonus
                                    </span>
                                )}
                                <span className="conda-tag-mode">🚀 Mode Perfectionnement IA</span>
                            </div>
                            <p className="conda-perfectionnement-desc">
                                Tu peux continuer à perfectionner ce devoir sans aucune limite ! Crée une nouvelle version, demande de nouveaux conseils à l'IA et soumets à nouveau pour enregistrer tes progrès.
                            </p>
                        </div>
                    </div>
                    <div className="conda-perfectionnement-actions">
                        <button
                            type="button"
                            onClick={handleCopyForAI}
                            className="conda-btn-ia-copy"
                            title="Consulter l'IA pour obtenir de nouveaux conseils et enrichir votre devoir"
                        >
                            <span>📋</span>
                            <span>Consulter l'IA pour perfectionner</span>
                        </button>
                        {homework?.didakbotUrl && (
                            <button
                                type="button"
                                className={`conda-btn-ia-didakbot ${showDidakbotPanel ? 'is-open' : ''}`}
                                onClick={handleToggleDidakbot}
                                title={showDidakbotPanel ? "Masquer le volet Chatbot" : "Ouvrir le chatbot Didak'bot dans le volet latéral"}
                            >
                                <span>🤖</span>
                                <span>{showDidakbotPanel ? 'Masquer Chatbot' : 'Ouvrir Chatbot'}</span>
                            </button>
                        )}
                    </div>
                </section>
            )}

            {/* Pinned AI Notes Status Strip */}
            {aiAdviceBlocks.length > 0 && (
                <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900 to-indigo-950/90 border-b border-indigo-500/40 py-2 px-6 flex items-center justify-between gap-4 sticky top-[65px] z-30 shadow-md">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base flex-shrink-0">📌</span>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black uppercase text-indigo-300 tracking-wider flex-shrink-0">
                                {aiAdviceBlocks[aiAdviceBlocks.length - 1]?.title || 'Derniers conseils IA'} :
                            </span>
                            <p className="text-xs text-slate-200 font-medium truncate m-0 max-w-md lg:max-w-xl">
                                {aiAdviceBlocks[aiAdviceBlocks.length - 1]?.content || ''}
                            </p>
                            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40 font-mono flex-shrink-0">
                                {aiAdviceBlocks.length} bloc{aiAdviceBlocks.length > 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                setShowAdviceWindow(true);
                                setAdviceCollapsed(false);
                                bringWindowToFront('advice');
                            }}
                            className="text-xs text-indigo-200 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5"
                            title="Ouvrir ou afficher la fenêtre des conseils"
                        >
                            <span>🪟</span>
                            <span>{showAdviceWindow ? (adviceCollapsed ? "Déplier fenêtre" : "Fenêtre ouverte") : "Ouvrir fenêtre"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={openAddNotesModal}
                            className="text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1 rounded-lg font-bold transition flex items-center gap-1.5"
                        >
                            <span>➕</span>
                            <span>Ajouter des notes</span>
                        </button>
                    </div>
                </div>
            )}

            {/* FLOATING WINDOWS LAYER (Transportables, Redimensionnables & Rétractables) */}
            <div className="v8-windows-layer">
                {/* 1. Fenêtre Flottante des CONSEILS DU TUTEUR IA */}
                {showAdviceWindow && (
                    <div
                        className={`v8-layer-panel conda-floating-advice-panel${adviceCollapsed ? ' is-collapsed' : ''}${windowAction?.name === 'advice' ? ' is-moving' : ''}`}
                        style={{
                            left: windows.advice.x,
                            top: windows.advice.y,
                            width: adviceCollapsed ? 'auto' : windows.advice.w,
                            height: adviceCollapsed ? 'auto' : windows.advice.h,
                            minWidth: adviceCollapsed ? '340px' : '440px',
                            zIndex: windowZ.advice
                        }}
                        onMouseDown={() => bringWindowToFront('advice')}
                    >
                        <div className="v8-layer-head v8-window-head" onMouseDown={(e) => startWindowMove(e, 'advice')}>
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-base">📌</span>
                                <strong className="truncate">CONSEILS DU TUTEUR IA</strong>
                                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/40 font-mono">
                                    {aiAdviceBlocks.length > 0 ? `${aiAdviceBlocks.length} bloc${aiAdviceBlocks.length > 1 ? 's' : ''}` : `Essai ${attemptsCount}`}
                                </span>
                            </div>
                            <div className="flex items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
                                <button
                                    type="button"
                                    onClick={openAddNotesModal}
                                    className="conda-win-head-btn"
                                    title="Prendre de nouvelles notes pour la prochaine version"
                                >
                                    ➕
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAdviceCollapsed(!adviceCollapsed)}
                                    className="conda-win-head-btn"
                                    title={adviceCollapsed ? "Déplier la fenêtre" : "Réduire la fenêtre"}
                                >
                                    {adviceCollapsed ? "▼" : "▲"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAdviceWindow(false)}
                                    className="conda-win-head-btn conda-win-head-close"
                                    title="Fermer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {!adviceCollapsed ? (
                            <div className="v8-layer-body conda-advice-body">
                                {aiAdviceBlocks.length > 0 ? (
                                    <div className="conda-advice-thread">
                                        {aiAdviceBlocks.map((block, idx) => {
                                            const isLatest = idx === aiAdviceBlocks.length - 1;
                                            const targetNum = block.versionTarget || (idx + 1);
                                            return (
                                                <React.Fragment key={block.id || idx}>
                                                    {idx > 0 && (
                                                        <div className="conda-advice-separator">
                                                            <span>⬇️ Conseils pour la Version suivante ⬇️</span>
                                                        </div>
                                                    )}
                                                    <div className={`conda-advice-block ${isLatest ? 'is-latest' : ''}`}>
                                                        <div className="conda-advice-block-header">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="text-sm">🤖</span>
                                                                <strong className="conda-advice-block-title truncate">
                                                                    {block.title || `Conseils pour la Version ${targetNum}`}
                                                                </strong>
                                                                {isLatest && (
                                                                    <span className="conda-advice-latest-badge">
                                                                        🎯 Version active
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                                {block.timestamp && (
                                                                    <span className="conda-advice-time">
                                                                        🕒 {block.timestamp}
                                                                    </span>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => openEditNotesModal(block)}
                                                                    className="conda-advice-edit-btn"
                                                                    title="Modifier ce bloc"
                                                                >
                                                                    ✏️ Modifier
                                                                </button>
                                                                {aiAdviceBlocks.length > 1 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteAdviceBlock(block.id)}
                                                                        className="conda-advice-delete-btn"
                                                                        title="Supprimer ce bloc"
                                                                    >
                                                                        🗑️
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="conda-advice-block-content">
                                                            {block.content}
                                                        </div>
                                                    </div>
                                                </React.Fragment>
                                            );
                                        })}

                                        <div className="conda-advice-thread-footer">
                                            <span className="text-[11px] text-slate-400 font-medium">
                                                {aiAdviceBlocks.length} bloc{aiAdviceBlocks.length > 1 ? 's' : ''} consigné{aiAdviceBlocks.length > 1 ? 's' : ''}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={openAddNotesModal}
                                                className="conda-advice-add-btn"
                                            >
                                                <span>➕</span>
                                                <span>Prendre des notes (V{attemptsCount === 1 && aiAdviceBlocks.length === 0 ? 2 : (aiAdviceBlocks.length + 1)})</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6 px-4 space-y-3">
                                        <div className="text-3xl">🤖</div>
                                        <div className="text-sm font-bold text-slate-300">
                                            Aucun conseil IA noté pour l'instant.
                                        </div>
                                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                                            Copiez votre devoir avec le bouton « Copier pour l'IA », échangez avec Gemini / ChatGPT, puis notez les conseils reçus pour guider votre réécriture.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={openAddNotesModal}
                                            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition inline-flex items-center gap-2"
                                        >
                                            <span>✏️</span>
                                            <span>Prendre des notes sur l'IA</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div
                                className="px-3 py-2 bg-slate-900/90 text-xs text-indigo-200 flex items-center justify-between cursor-pointer"
                                onClick={() => setAdviceCollapsed(false)}
                            >
                                <span className="truncate font-medium">
                                    {aiAdviceBlocks.length > 0
                                        ? `${aiAdviceBlocks[aiAdviceBlocks.length - 1].title} : ${aiAdviceBlocks[aiAdviceBlocks.length - 1].content.slice(0, 50)}...`
                                        : 'Cliquez pour déplier les conseils...'}
                                </span>
                                <span className="text-[10px] text-indigo-400 font-bold ml-2">Déplier ▼</span>
                            </div>
                        )}

                        {!adviceCollapsed && (
                            <>
                                <div className="v8-win-resize n" onMouseDown={(e) => startWindowResize(e, 'advice', 'n')} />
                                <div className="v8-win-resize s" onMouseDown={(e) => startWindowResize(e, 'advice', 's')} />
                                <div className="v8-win-resize e" onMouseDown={(e) => startWindowResize(e, 'advice', 'e')} />
                                <div className="v8-win-resize w" onMouseDown={(e) => startWindowResize(e, 'advice', 'w')} />
                                <div className="v8-win-resize ne" onMouseDown={(e) => startWindowResize(e, 'advice', 'ne')} />
                                <div className="v8-win-resize nw" onMouseDown={(e) => startWindowResize(e, 'advice', 'nw')} />
                                <div className="v8-win-resize se" onMouseDown={(e) => startWindowResize(e, 'advice', 'se')} />
                                <div className="v8-win-resize sw" onMouseDown={(e) => startWindowResize(e, 'advice', 'sw')} />
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Main Area: Unique Workspace (Brouillon + Devoir) */}
            <main className="conda-redaction-main">
                {/* Writing Sheet */}
                <div className="conda-redaction-editor-panel">
                    <div className="conda-redaction-toolbar">
                        <div className="conda-redaction-tool-group">
                            <button
                                type="button"
                                className="conda-redaction-tool-btn"
                                onClick={handleUndo}
                                disabled={historyIdx <= 0}
                                title="Annuler la dernière saisie (Ctrl+Z)"
                            >
                                <span>↶</span>
                                <span>Annuler</span>
                            </button>
                            <button
                                type="button"
                                className="conda-redaction-tool-btn"
                                onClick={handleRedo}
                                disabled={historyIdx >= history.length - 1}
                                title="Rétablir (Ctrl+Y)"
                            >
                                <span>↷</span>
                                <span>Rétablir</span>
                            </button>
                            <div
                                className={`conda-version-progression-badge small ${versionProgression.badgeClass} ml-2`}
                                title="Progression de vos versions"
                            >
                                <span>{versionProgression.icon}</span>
                                <span>{versionProgression.label}</span>
                            </div>
                            {attemptsHistory && attemptsHistory.length > 0 && (
                                <div className="flex items-center gap-1 ml-2 overflow-x-auto">
                                    {attemptsHistory.map((att) => (
                                        <button
                                            key={att.attemptNumber}
                                            type="button"
                                            onClick={() => {
                                                if (att.text && window.confirm(`Charger le texte de la version ${att.attemptNumber} dans votre éditeur ?`)) {
                                                    setEssayText(att.text);
                                                    showToast(`Version ${att.attemptNumber} chargée !`);
                                                }
                                            }}
                                            className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                                            title={`Charger la version ${att.attemptNumber} (${att.wordsCount || 0} mots)`}
                                        >
                                            V{att.attemptNumber}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="conda-redaction-words-counter">
                            {wordsCount} mot{wordsCount > 1 ? 's' : ''}
                        </div>
                    </div>

                    {/* Hint / Consigne espace unique */}
                    <div className="conda-single-workspace-hint">
                        <span className="conda-hint-icon">💡</span>
                        <div className="conda-hint-text">
                            <strong>Commence par un brouillon, en dessous écris ton devoir.</strong>
                            <span className="text-slate-300"> Grâce aux fonctions de l’ordinateur (effacer, réécrire, réorganiser), tout se fait facilement dans ce même espace.</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-red-400/60 bg-red-950/40 px-4 py-2 text-center text-xs font-black uppercase tracking-wide text-red-300">
                        Coller dans le brouillon-devoir est interdit
                    </div>

                    <textarea
                        className="conda-redaction-textarea"
                        placeholder="Commence par un brouillon, en dessous écris ton devoir..."
                        value={essayText}
                        onChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        onCopy={handleTextareaCopy}
                        onCut={handleTextareaCopy}
                        onPaste={handleBlockedPaste}
                        onDrop={handleBlockedPaste}
                    />

                    <div className="conda-redaction-actions-bar">
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                className="conda-btn-ia-copy"
                                onClick={handleCopyForAI}
                                title="Copie l'ensemble de votre travail (brouillon et devoir rédigé) pour le soumettre à l'IA"
                            >
                                <span>📋</span>
                                <span>Copier mon devoir pour l'IA</span>
                            </button>

                            {homework?.didakbotUrl && (
                                <button
                                    type="button"
                                    className={`conda-btn-ia-didakbot ${showDidakbotPanel ? 'is-open' : ''}`}
                                    onClick={handleToggleDidakbot}
                                    title={showDidakbotPanel ? "Masquer le volet Chatbot" : "Ouvrir le chatbot Didak'bot dans le volet latéral"}
                                >
                                    <span>🤖</span>
                                    <span>{showDidakbotPanel ? 'Masquer Chatbot' : 'Chatbot'}</span>
                                </button>
                            )}

                            {/* Window Toggle Buttons */}
                            <div className="flex items-center gap-2 border-l border-slate-700/80 pl-2">
                                <button
                                    type="button"
                                    className={`conda-window-toggle-btn ${showAdviceWindow ? 'active' : ''}`}
                                    onClick={() => {
                                        setShowAdviceWindow((prev) => !prev);
                                        if (!showAdviceWindow) {
                                            setAdviceCollapsed(false);
                                            bringWindowToFront('advice');
                                        }
                                    }}
                                    title="Ouvrir / fermer la fenêtre flottante des conseils IA"
                                >
                                    <span>📌</span>
                                    <span>Conseils IA</span>
                                    {pinnedAiNotes.trim() && <span className="conda-badge-dot" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="conda-btn-validate"
                            onClick={handleValidateClick}
                            title="Transmettre votre devoir au professeur (vous pourrez continuer à créer de nouvelles versions et vous améliorer sans limite !)"
                        >
                            <span>📤</span>
                            <span>Transmettre au professeur</span>
                        </button>
                    </div>
                </div>
            </main>

            {/* FOCUS MODE: Prise de Notes IA Dédiée */}
            {isNotesFocusMode && (
                <div
                    className={`conda-redaction-modal-overlay ${showDidakbotPanel ? 'has-didakbot-sidebar' : ''}`}
                    style={showDidakbotPanel ? { right: 'min(500px, 95vw)', width: 'auto' } : {}}
                >
                    <div className="bg-slate-900 border-2 border-indigo-500 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl flex flex-col max-h-[90vh] text-left">
                        {/* Header: fixé en haut */}
                        <div className="flex items-center justify-between border-b border-slate-700 pb-3 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <span className="text-2xl">🤖</span>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                                        {editingBlockId ? "Modifier un bloc de conseils" : "Phase de Consultation & Prise de Notes IA"}
                                    </h3>
                                    <span className="text-[11px] font-bold text-indigo-400">
                                        {editingBlockId
                                            ? (aiAdviceBlocks.find((b) => b.id === editingBlockId)?.title || "Bloc sélectionné")
                                            : `Conseils pour la Version ${attemptsCount === 1 && aiAdviceBlocks.length === 0 ? 2 : (attemptsCount + 1)}`
                                        }
                                    </span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded border border-amber-500/30">
                                    Jeton : #{computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount)}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCancelOrCloseNotesModal}
                                    className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg transition leading-none cursor-pointer"
                                    title="Fermer"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Corps défilable : Consignes + Notes + Chat IA */}
                        <div className="overflow-y-auto flex-1 min-h-0 py-3 space-y-4 pr-1 sm:pr-2">
                            <div className="bg-indigo-950/40 border border-indigo-500/40 rounded-2xl p-3.5 text-xs text-indigo-200/90 leading-relaxed space-y-1.5">
                                <div className="font-bold text-white flex items-center gap-1.5">
                                    <span>📋</span>
                                    <span>Consigne de travail :</span>
                                </div>
                                <p className="m-0">
                                    1. Votre texte a été copié dans votre presse-papier. Collez-le (Ctrl+V) dans Gemini ou ChatGPT.
                                </p>
                                <p className="m-0">
                                    2. Lisez attentivement les remarques et conseils du tuteur.
                                </p>
                                <p className="m-0 font-semibold text-amber-300">
                                    💡 Rédigez d'abord vos notes personnelles (1er espace), puis copiez et collez la réponse de l'IA (2e espace). L'échange s'enregistre ainsi au fur et à mesure (plus fluide et plus sûr) et vos notes guident votre prochaine version !
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-300 block">
                                        {editingBlockId ? "Modifier le contenu de ce bloc de conseils :" : "Mes notes sur les conseils reçus pour cette prochaine version :"}
                                    </label>
                                    <span className="text-[10.5px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
                                        <span>✍️</span> Saisie manuelle (copier-coller désactivé)
                                    </span>
                                </div>
                                <textarea
                                    className="w-full h-28 sm:h-32 p-3.5 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                    placeholder="Résumez ici avec vos propres mots :&#10;- Ce que l'IA a trouvé réussi&#10;- Les erreurs de méthode, vocabulaire ou structure signalées&#10;- Ce que vous devez modifier dans votre prochaine version..."
                                    value={editingNoteText}
                                    onChange={(e) => setEditingNoteText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
                                            e.preventDefault();
                                            showToast("🚫 Le copier-coller est désactivé dans vos notes ! Rédigez avec vos propres mots.");
                                        }
                                    }}
                                    onPaste={(e) => {
                                        e.preventDefault();
                                        showToast("🚫 Le copier-coller est désactivé dans vos notes ! Rédigez avec vos propres mots.");
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        showToast("🚫 Le glisser-déposer est désactivé ici ! Rédigez avec vos propres mots.");
                                    }}
                                    autoFocus
                                />
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className={isNotesFilled ? "text-emerald-400 font-semibold" : "text-amber-400/90"}>
                                        {isNotesFilled ? `✅ Notes rédigées (${editingNoteText.trim().length} car.)` : "⚠️ 1er espace obligatoire (au moins 10 car. rédigés)"}
                                    </span>
                                    <span className="text-slate-500 text-[10px]">
                                        Synthèse personnelle
                                    </span>
                                </div>
                            </div>

                            {/* Champ pour coller la réponse de l'IA */}
                            <div className="space-y-1.5 pt-2 border-t border-slate-700/60">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                                        <span>💬</span>
                                        <span>Collez ici la réponse de l'IA (Gemini / ChatGPT) :</span>
                                    </label>
                                    <span className="text-[10.5px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                                        <span>📋</span> Copier-coller autorisé
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 m-0">
                                    Copiez la réponse de l'IA et collez-la ci-dessous. On enregistre ainsi le chat au fur et à mesure : c'est plus fluide et plus sûr.
                                </p>
                                <textarea
                                    className="w-full h-24 sm:h-28 p-3.5 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                    placeholder="Collez ici (Ctrl+V) la réponse reçue de Gemini / ChatGPT..."
                                    value={editingChatText}
                                    onChange={(e) => setEditingChatText(e.target.value)}
                                />
                                <div className="flex items-center justify-between text-[11px]">
                                    <span className={isChatFilled ? "text-emerald-400 font-semibold" : "text-amber-400/90"}>
                                        {isChatFilled ? `✅ Réponse IA collée (${editingChatText.trim().length} car.)` : "⚠️ 2e espace obligatoire (collez la réponse de l'IA)"}
                                    </span>
                                    <span className="text-slate-500 text-[10px]">
                                        Enregistrement au fur et à mesure
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Boutons d'action : toujours visibles en bas */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-700/60 flex-shrink-0 bg-slate-900 mt-1">
                            <button
                                type="button"
                                className={`text-xs flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg transition ${
                                    !isBothNotesSpacesFilled && !editingBlockId
                                        ? "text-slate-500 cursor-not-allowed bg-slate-800/40 border border-slate-700/50"
                                        : "text-slate-400 hover:text-slate-200 cursor-pointer"
                                }`}
                                onClick={handleCancelOrCloseNotesModal}
                                title={!isBothNotesSpacesFilled && !editingBlockId ? "Les 2 espaces doivent être remplis pour continuer" : "Revenir au devoir"}
                            >
                                {!isBothNotesSpacesFilled && !editingBlockId && <span>🔒</span>}
                                <span>Revenir au devoir</span>
                            </button>
                            <button
                                type="button"
                                className={`font-bold text-xs px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg transition flex items-center justify-center gap-2 ${
                                    isBothNotesSpacesFilled
                                        ? "bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                                        : "bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-700"
                                }`}
                                onClick={handleFinishNotes}
                                title={!isBothNotesSpacesFilled ? "Remplissez les 2 espaces pour continuer" : "Enregistrer et continuer"}
                            >
                                <span>{isBothNotesSpacesFilled ? "✅" : "🔒"}</span>
                                <span>
                                    {editingBlockId
                                        ? "Enregistrer les modifications de ce bloc"
                                        : isBothNotesSpacesFilled
                                            ? "J'ai fini de prendre mes notes ➔ Consigner ce bloc et améliorer mon devoir"
                                            : "Remplissez les 2 espaces pour continuer (Notes + Réponse IA)"
                                    }
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Modal: Short Working Time */}
            {showShortWarning && (
                <div className="conda-redaction-modal-overlay">
                    <div className="conda-redaction-modal">
                        <div className="conda-redaction-warning-icon">⏱️</div>
                        <h3 className="conda-redaction-modal-title">C'est un peu court...</h3>
                        <p className="conda-redaction-modal-text">
                            Vous n'avez passé que <strong>{Math.max(1, Math.round(sessionSeconds / 60))} minute(s)</strong> sur cette rédaction, alors qu'un travail approfondi de Seconde demande au minimum <strong>{minTimeMinutes} minutes</strong>.
                            <br /><br />
                            Avez-vous bien relu votre texte, exploité les conseils de l'IA dans votre brouillon et développé tous vos arguments ?
                        </p>
                        <div className="conda-redaction-modal-actions">
                            <button
                                type="button"
                                className="conda-modal-btn-cancel"
                                onClick={() => setShowShortWarning(false)}
                            >
                                ✏️ Reprendre et enrichir mon travail
                            </button>
                            <button
                                type="button"
                                className="conda-modal-btn-danger"
                                onClick={handleConfirmValidateAnyway}
                            >
                                ⚠️ Valider quand même (signalé au professeur)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Pré-Validation : Avertissement sur la récitation du brouillon et des conseils */}
            {showPreFinalWarning && (
                <div className="conda-rules-modal-overlay" onClick={() => setShowPreFinalWarning(false)}>
                    <div className="conda-prefinal-modal-card" onClick={(e) => e.stopPropagation()}>
                        <button
                            type="button"
                            onClick={() => setShowPreFinalWarning(false)}
                            className="conda-rules-modal-close"
                            title="Fermer (✕)"
                        >
                            ✕
                        </button>

                        <div className="conda-rules-badge">
                            <span>⚠️</span>
                            <span>Dernière étape · Épreuve de restitution</span>
                        </div>

                        <h2 className="conda-rules-title">
                            Attention avant de passer à la suite !
                        </h2>

                        <p className="conda-rules-main-desc">
                            À la prochaine étape, tu devras <strong>réciter ton brouillon</strong> et <strong>résumer les conseils principaux que tu as reçus pour progresser</strong>.
                        </p>

                        <div className="conda-rules-steps-grid">
                            <div className="conda-rules-step-row">
                                <span className="conda-rules-step-badge">1</span>
                                <span>📝 <strong>Réciter ton brouillon :</strong> tu devras réécrire la structure de ton plan au propre de mémoire (copier-coller désactivé).</span>
                            </div>
                            <div className="conda-rules-step-row">
                                <span className="conda-rules-step-badge">2</span>
                                <span>🤖 <strong>Résumer les conseils reçus :</strong> tu devras formuler les 2 ou 3 conseils clés que l'IA t'a donnés pour progresser.</span>
                            </div>
                        </div>

                        <div className="conda-rules-goal-card" style={{ borderLeftColor: '#f59e0b' }}>
                            👀 <strong>Regarde-les bien maintenant</strong> sur ton écran avant de passer à la suite pour ne rien oublier !
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowPreFinalWarning(false)}
                                className="conda-prefinal-btn-review flex-1"
                            >
                                <span>👀</span>
                                <span>Regarder mon brouillon & mes conseils</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowPreFinalWarning(false);
                                    setShowFinalModal(true);
                                }}
                                className="conda-prefinal-btn-start flex-1"
                            >
                                <span>🚀</span>
                                <span>Je suis prêt, passer à la suite</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Final Submission Modal: Assimilation Step + Collapsible Chat Paste */}
            {showFinalModal && (() => {
                const currentToken = computeSessionToken(user?._id || user?.id, homework?._id, attemptsCount);
                const baseToken = computeSessionToken(user?._id || user?.id, homework?._id, 1);
                const allKeysToCheck = registeredKeys.length > 0 ? registeredKeys : [currentToken, baseToken];
                const chatUpper = aiConversationText.toUpperCase();
                const matchedKeys = allKeysToCheck.filter(k => k && chatUpper.includes(String(k).toUpperCase()));
                const hasEchoTag = chatUpper.includes('CONSEILS_APPLIQU') || chatUpper.includes('CONSEIL_APPLIQU');
                const isAuthentic = matchedKeys.length > 0 || hasEchoTag;
                const hasChat = aiConversationText.trim().length > 20;

                return (
                    <div className="conda-redaction-modal-overlay">
                        <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 text-left max-h-[92vh] overflow-y-auto">
                            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
                                <span className="text-2xl">🧠</span>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                                        Validation Finale & Fiche Mémo DS
                                    </h3>
                                    <p className="text-xs text-slate-400 m-0">
                                        Prouvez ce que vous avez appris pour débloquer votre bonus (jusqu'à <strong>+2.5 pts</strong>, applicable jusqu'au palier de 15,5/20) !
                                    </p>
                                </div>
                            </div>

                            {/* Section 1: Refaire le plan au brouillon */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200">
                                        1. Refais ton plan au brouillon (Plan consolidé) :
                                    </label>
                                    <span className="text-[10px] text-amber-400 font-bold">Obligatoire</span>
                                </div>
                                <textarea
                                    className="w-full h-20 p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                    placeholder="I. Une démocratie directe (Ecclésia, magistrats)...&#10;II. Les limites réelles (exclusion femmes, métèques, esclaves)..."
                                    value={finalPlanText}
                                    onChange={(e) => setFinalPlanText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onCopy={handleBlockedCopy}
                                    onCut={handleBlockedCopy}
                                    onPaste={handleBlockedPaste}
                                />
                            </div>

                            {/* Section 2: Conseils & pièges retenus */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-bold text-slate-200">
                                        2. Les 2 ou 3 conseils majeurs que tu as appris de l'IA pour le DS :
                                    </label>
                                    <span className="text-[10px] text-amber-400 font-bold">Obligatoire</span>
                                </div>
                                <textarea
                                    className="w-full h-18 p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                    placeholder="1. Bien définir la Misthophorie dès le début&#10;2. Soigner la transition entre fonctionnement et limites..."
                                    value={finalLessonsText}
                                    onChange={(e) => setFinalLessonsText(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onCopy={handleBlockedCopy}
                                    onCut={handleBlockedCopy}
                                    onPaste={handleBlockedPaste}
                                />
                            </div>

                            {/* Section 3: Échange avec l'IA (collapsible dès collage) */}
                            <div className="space-y-1 pt-1 border-t border-slate-800">
                                <label className="text-xs font-bold text-slate-200 block">
                                    3. Échange avec l'IA (Tutorat) :
                                </label>

                                {!hasChat ? (
                                    <textarea
                                        className="w-full h-24 p-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                        placeholder="Collez ici votre conversation complète avec Gemini (Ctrl+V / Cmd+V autorisé)..."
                                        value={aiConversationText}
                                        onChange={(e) => setAiConversationText(e.target.value)}
                                    />
                                ) : (
                                    <div>
                                        {isAuthentic ? (
                                            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xl">✅</span>
                                                    <div>
                                                        <div className="text-xs font-bold text-emerald-300">
                                                            {matchedKeys.length > 0 ? `${matchedKeys.length} clé(s) CondaWeb validée(s)` : 'Échange tuteur authentifié'}
                                                        </div>
                                                        <div className="text-[10px] text-emerald-400/80">
                                                            {matchedKeys.length > 0 ? matchedKeys.join(' • ') : 'Validation officielle CondaWeb'} • Bonus débloqué
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAiConversationText('')}
                                                    className="text-xs text-slate-400 hover:text-white underline font-medium"
                                                >
                                                    Remplacer
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/60 flex items-center justify-between">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="text-xl">⚠️</span>
                                                    <div>
                                                        <div className="text-xs font-bold text-amber-300">
                                                            Clé de session ({allKeysToCheck.join(', ')}) non détectée
                                                        </div>
                                                        <div className="text-[10px] text-amber-400/90">
                                                            Veille à coller la réponse de l'IA (commençant par [CONSEILS_APPLIQUÉS...]) ou le message officiel copié depuis CondaWeb.
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setAiConversationText('')}
                                                    className="text-xs text-slate-400 hover:text-white underline font-medium"
                                                >
                                                    Recoller
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="conda-redaction-modal-actions pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    className="conda-modal-btn-cancel"
                                    onClick={() => setShowFinalModal(false)}
                                    disabled={submitting}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="button"
                                    className="conda-modal-btn-confirm"
                                    onClick={handleFinalSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Envoi en cours...' : alreadySubmitted ? 'Transmettre ma nouvelle version perfectionnée' : 'Envoyer définitivement mon devoir'}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Modal d'Évaluation Intermédiaire avec Sauvegarde de l'état actuel du Chat IA */}
            {showIntermediateEvalModal && (
                <div className="conda-redaction-modal-overlay" onClick={() => setShowIntermediateEvalModal(false)}>
                    <div
                        className="bg-slate-900 border-2 border-indigo-500/70 rounded-3xl p-6 sm:p-7 max-w-xl w-full shadow-2xl space-y-4 text-left max-h-[92vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🎯</span>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                                        Évaluation Intermédiaire par l'IA
                                    </h3>
                                    <span className="text-[11px] text-indigo-300 font-medium">
                                        {currentGrade ? `Note actuelle : ${currentGrade}/20 (peut évoluer)` : 'Première évaluation de votre travail'}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowIntermediateEvalModal(false)}
                                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg transition"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-3.5 text-xs text-indigo-200/90 leading-relaxed space-y-1.5">
                            <div className="font-bold text-white flex items-center gap-1.5">
                                <span>💬</span>
                                <span>Sauvegarde de l'état actuel de votre échange avec l'IA :</span>
                            </div>
                            <p className="m-0">
                                Pour évaluer précisément vos progrès et prendre en compte les conseils reçus, collez ci-dessous l'état actuel de votre conversation avec le tuteur IA.
                            </p>
                            <p className="m-0 text-[11px] text-amber-300 font-medium">
                                💡 Ce devoir est conçu pour progresser sur plusieurs séances : votre texte et votre échange sont enregistrés pour faire évoluer votre note à chaque étape !
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                                <span>État actuel de la conversation avec l'IA :</span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    {aiConversationText.trim().length > 0 ? `${aiConversationText.trim().length} car.` : 'Optionnel mais vivement conseillé'}
                                </span>
                            </label>
                            <textarea
                                className="w-full h-36 p-3 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                placeholder="Collez ici l'échange récent avec l'IA (Ctrl+V)..."
                                value={aiConversationText}
                                onChange={(e) => setAiConversationText(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                            <span>✍️ Travail saisi : <strong>{wordsCount} mots</strong></span>
                            <span>📝 Espace unique : <strong>Brouillon + Devoir</strong></span>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
                            <button
                                type="button"
                                onClick={() => setShowIntermediateEvalModal(false)}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-200 transition"
                            >
                                Revenir à la rédaction
                            </button>
                            <button
                                type="button"
                                onClick={() => handleReevaluateWork(aiConversationText)}
                                disabled={reevaluating || !essayText.trim()}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 disabled:opacity-50"
                            >
                                {reevaluating ? (
                                    <>
                                        <span className="animate-spin">⏳</span>
                                        <span>Correction en cours...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>🎯</span>
                                        <span>Lancer la correction & sauvegarder</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Résultat de Réévaluation IA */}
            {reevaluationFeedback && (
                <div className="conda-redaction-modal-overlay" onClick={() => setReevaluationFeedback(null)}>
                    <div className="bg-slate-900 border border-indigo-500/60 rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-2xl space-y-5 text-left max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-3xl">🎯</span>
                                <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                                        Réévaluation IA Terminée !
                                    </h3>
                                    <span className="text-[11px] text-indigo-300 font-medium">
                                        Nouvelle note progressive enregistrée
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReevaluationFeedback(null)}
                                className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg transition"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Grade Card */}
                        <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-indigo-950/80 border-2 border-indigo-400/60 rounded-2xl p-5 text-center shadow-lg">
                            <div className="text-[11px] font-black uppercase tracking-widest text-indigo-300">
                                Note Progressive Compte Élève & Professeur
                            </div>
                            <div className="text-4xl font-black text-indigo-200 my-1 drop-shadow-md">
                                {reevaluationFeedback.grade || currentGrade} <span className="text-xl font-bold text-indigo-400">/ 20</span>
                            </div>
                            {reevaluationFeedback.initialGrade && reevaluationFeedback.revisedGrade ? (
                                <p className="text-xs text-indigo-200 font-medium mt-1">
                                    🌱 Note initiale : <strong>{reevaluationFeedback.initialGrade}/20</strong> ➔ 🚀 Nouvelle note après révision : <strong>{reevaluationFeedback.revisedGrade}/20</strong>
                                </p>
                            ) : (
                                <p className="text-xs text-indigo-200 font-medium mt-1">
                                    Note actuelle : <strong>{reevaluationFeedback.grade}/20</strong>
                                </p>
                            )}
                        </div>

                        {/* Feedback message */}
                        {reevaluationFeedback.studentMessage && (
                            <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 text-xs text-slate-200 space-y-2 leading-relaxed">
                                <div className="font-bold text-indigo-300 flex items-center gap-1.5 uppercase text-[10px] tracking-wider">
                                    <span>🤖</span>
                                    <span>Retour pédagogique de l'IA</span>
                                </div>
                                <p className="m-0 whitespace-pre-line">
                                    {reevaluationFeedback.studentMessage}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end pt-2">
                            <button
                                type="button"
                                onClick={() => setReevaluationFeedback(null)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
                            >
                                Continuer à travailler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Laboratoire Expérimental Anti-Triche */}
            {showZwnjLabModal && (() => {
                const conversationBlocks = parseConversationBlocks(zwnjTestInput);
                const homoglyphAnalysis = analyzeHomoglyphs(zwnjTestInput);
                const spacingAnalysis = analyzeSentenceSpacing(zwnjTestInput, TARGET_WATERMARK_SENTENCES);
                const zwnjAnalysis = analyzeZwnjText(zwnjTestInput);

                const promptBlocksCount = conversationBlocks.filter(b => b.type === 'conda_prompt').length;
                const aiBlocksCount = conversationBlocks.filter(b => b.type === 'ai_response').length;
                const interactionBlocksCount = conversationBlocks.filter(b => b.type === 'student_interaction').length;
                const suspiciousBlocksCount = conversationBlocks.filter(b => b.type === 'suspicious_external').length;

                return (
                    <div className="conda-redaction-modal-overlay">
                        <div className="bg-slate-900 border border-blue-500/60 rounded-3xl p-6 max-w-3xl w-full shadow-2xl space-y-4 text-left max-h-[92vh] overflow-y-auto">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-3xl">🔬</span>
                                    <div>
                                        <h3 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
                                            <span>Laboratoire Expérimental Anti-Triche</span>
                                        </h3>
                                        <p className="text-xs text-slate-400 m-0">
                                            Découpez et qualifiez chaque message : Prompts CondaWeb, Réponses de l'IA et Questions libres de l'élève.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowZwnjLabModal(false)}
                                    className="text-slate-400 hover:text-white text-lg font-bold p-1 rounded-lg cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>

                            {/* Mode Tabs */}
                            <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => setLabActiveTab('conversation')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                        labActiveTab === 'conversation'
                                            ? 'bg-blue-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span>💬</span>
                                    <span>Découpeur Conversation (Nouveau)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLabActiveTab('homoglyph')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                        labActiveTab === 'homoglyph'
                                            ? 'bg-emerald-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span>🛡️</span>
                                    <span>Homoglyphes Invisibles</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLabActiveTab('spacing')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                        labActiveTab === 'spacing'
                                            ? 'bg-indigo-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span>📐</span>
                                    <span>Espaces (1, 3, 8)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLabActiveTab('zwnj')}
                                    className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                                        labActiveTab === 'zwnj'
                                            ? 'bg-purple-600 text-white shadow-md'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span>👻</span>
                                    <span>Code \u200C</span>
                                </button>
                            </div>

                            {/* TAB: Découpeur de Conversation */}
                            {labActiveTab === 'conversation' && (
                                <div className="space-y-3">
                                    {/* Action bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-950/30 border border-blue-500/30 rounded-2xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-blue-300">Générateur test :</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(SAMPLE_CONVERSATION_TEXT);
                                                    showToast("📋 Conversation test complète copiée (Prompt + Réponse Gemini + Question élève) !");
                                                }}
                                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                                            >
                                                <span>📋</span>
                                                <span>Copier 1 conversation complète test (Prompt + Réponse + Question)</span>
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setZwnjTestInput('')}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                                        >
                                            🧹 Vider la zone
                                        </button>
                                    </div>

                                    {/* Explanation note */}
                                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 m-0 leading-relaxed">
                                        💡 <strong>Règle pédagogique :</strong> L'élève a le droit de poser toutes ses questions à l'IA (<span className="text-indigo-300 font-bold">💬 Dialogue Pédagogique libre</span>). 
                                        Seul le bloc de dépôt du travail (<span className="text-emerald-300 font-bold">🟦 Prompt Devoir</span>) doit être authentifié par CondaWeb. Si un bloc rédigé externe arrive sans signature (<span className="text-rose-400 font-bold">🚨 Fraude</span>), il est immédiatement isolé !
                                    </p>

                                    {/* Input zone */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                                            <span>Collez ici l'échange complet avec l'IA (sélectionné depuis Gemini ou ChatGPT) :</span>
                                            <span className="text-[10px] text-blue-400 font-mono">Segmentation automatique</span>
                                        </label>
                                        <textarea
                                            className="w-full h-32 p-3 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-blue-500 resize-y placeholder:text-slate-600"
                                            placeholder="Collez ici l'échange complet de discussion avec l'IA. Le système va automatiquement segmenter et classifier chaque message..."
                                            value={zwnjTestInput}
                                            onChange={(e) => setZwnjTestInput(e.target.value)}
                                        />
                                    </div>

                                    {/* Live breakdown counters */}
                                    {zwnjTestInput.trim() && (
                                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                                            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Total Blocs</div>
                                                <div className="text-lg font-black text-white">{conversationBlocks.length}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-teal-400">🛡️ Homoglyphes</div>
                                                <div className="text-lg font-black text-teal-300">{homoglyphAnalysis.totalHomoglyphs}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-emerald-400">🟦 Prompts Conda</div>
                                                <div className="text-lg font-black text-emerald-300">{promptBlocksCount}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-purple-400">🟪 Réponses IA</div>
                                                <div className="text-lg font-black text-purple-300">{aiBlocksCount}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-indigo-400">🟩 Questions Élève</div>
                                                <div className="text-lg font-black text-indigo-300">{interactionBlocksCount}</div>
                                            </div>
                                            <div className={`p-2.5 rounded-xl border text-center ${
                                                suspiciousBlocksCount === 0
                                                    ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                                                    : 'bg-rose-950/50 border-rose-500 text-rose-300'
                                            }`}>
                                                <div className="text-[10px] uppercase font-bold">🚨 Blocs Suspects</div>
                                                <div className="text-lg font-black">{suspiciousBlocksCount}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Block-by-block visual rendering */}
                                    {zwnjTestInput.trim() && (
                                        <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                                            <div className="text-xs font-bold text-slate-300 sticky top-0 bg-slate-900 py-1">
                                                Décomposition chronologique de la conversation :
                                            </div>
                                            {conversationBlocks.map((b) => (
                                                <div
                                                    key={b.index}
                                                    className={`p-3 rounded-2xl border text-xs space-y-1.5 transition ${
                                                        b.type === 'conda_prompt'
                                                            ? 'bg-emerald-950/30 border-emerald-500/60'
                                                            : b.type === 'ai_response'
                                                            ? 'bg-purple-950/30 border-purple-500/60'
                                                            : b.type === 'student_interaction'
                                                            ? 'bg-indigo-950/30 border-indigo-500/60'
                                                            : 'bg-rose-950/40 border-rose-500'
                                                    }`}
                                                >
                                                    <div className="flex flex-wrap items-center justify-between gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-black text-sm">
                                                                {b.type === 'conda_prompt' && '🟦'}
                                                                {b.type === 'ai_response' && '🟪'}
                                                                {b.type === 'student_interaction' && '🟩'}
                                                                {b.type === 'suspicious_external' && '🚨'}
                                                                {' '}Message #{b.index} : {b.title}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {b.homoglyphsCount > 0 && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/40">
                                                                    🛡️ {b.homoglyphsCount} homoglyphes
                                                                </span>
                                                            )}
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                                b.badgeColor === 'emerald'
                                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                                                    : b.badgeColor === 'purple'
                                                                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                                                                    : b.badgeColor === 'indigo'
                                                                    ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                                                                    : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                                            }`}>
                                                                {b.badge}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                                                                {b.wordsCount} mots
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <p className="text-[11px] text-slate-300 m-0">
                                                        {b.description}
                                                    </p>

                                                    <div className="bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80 text-[11px] font-mono text-slate-200 max-h-36 overflow-y-auto whitespace-pre-wrap break-words">
                                                        {b.content}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 0: Homoglyphes Invisibles (Cyrillique) */}
                            {labActiveTab === 'homoglyph' && (
                                <div className="space-y-3">
                                    {/* Action bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-2xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-emerald-300">Générateur test :</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(SAMPLE_HOMOGLYPH_TEXT);
                                                    showToast("📋 Texte test avec Homoglyphes invisibles (Cyrillique) copié dans le presse-papier !");
                                                }}
                                                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                                            >
                                                <span>📋</span>
                                                <span>Copier 1 extrait test avec Homoglyphes invisibles</span>
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setZwnjTestInput('')}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                                        >
                                            🧹 Vider la zone
                                        </button>
                                    </div>

                                    {/* Explanation note */}
                                    <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-2xl border border-slate-800 m-0 leading-relaxed">
                                        💡 <strong>Principe :</strong> Certaines lettres 'e' et 'a' sont remplacées par leur jumeau cyrillique (U+0435, U+0430). 
                                        Visuellement à l'écran, c'est <strong>strictement indiscernable</strong> pour l'élève. Mais comme ce sont de vraies lettres de l'alphabet, aucun navigateur ni presse-papier ne peut les effacer !
                                    </p>

                                    {/* Input zone */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                                            <span>Collez ici le texte copié depuis CondaWeb, ou revenant de Gemini / ChatGPT :</span>
                                            <span className="text-[10px] text-emerald-400 font-mono">Scan Unicode temps réel</span>
                                        </label>
                                        <textarea
                                            className="w-full h-28 p-3 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-emerald-500 resize-y placeholder:text-slate-600"
                                            placeholder="Collez ici le texte à tester. Le laboratoire va scanner chaque caractère à la recherche de lettres homoglyphes..."
                                            value={zwnjTestInput}
                                            onChange={(e) => setZwnjTestInput(e.target.value)}
                                        />
                                    </div>

                                    {/* Live homoglyph counters */}
                                    {zwnjTestInput.trim() && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Total Mots Scannés</div>
                                                <div className="text-lg font-black text-white">{zwnjTestInput.trim().split(/\s+/).length}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-emerald-400">Homoglyphes Trouvés</div>
                                                <div className="text-lg font-black text-emerald-300">{homoglyphAnalysis.totalHomoglyphs}</div>
                                                <div className="text-[9px] text-emerald-400 font-mono">
                                                    е: {homoglyphAnalysis.breakdown.e_cyrillic} | а: {homoglyphAnalysis.breakdown.a_cyrillic} | о: {homoglyphAnalysis.breakdown.o_cyrillic}
                                                </div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-purple-400">Mots Signés</div>
                                                <div className="text-lg font-black text-purple-300">{homoglyphAnalysis.matches.length}</div>
                                            </div>
                                            <div className={`p-2.5 rounded-xl border text-center ${
                                                homoglyphAnalysis.isAuthenticCondaWeb
                                                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                                                    : 'bg-rose-950/50 border-rose-500 text-rose-300'
                                            }`}>
                                                <div className="text-[10px] uppercase font-bold">Authentification</div>
                                                <div className="text-xs font-black mt-1">
                                                    {homoglyphAnalysis.isAuthenticCondaWeb
                                                        ? '🟢 AUTHENTIFIÉ CONDAWEB'
                                                        : '🔴 NON SIGNÉ / EXTERNE'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Breakdown of detected words */}
                                    {zwnjTestInput.trim() && (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            <div className="text-xs font-bold text-slate-300 sticky top-0 bg-slate-900 py-1">
                                                Détail des mots contenant l'empreinte invisible :
                                            </div>
                                            {homoglyphAnalysis.matches.length > 0 ? (
                                                homoglyphAnalysis.matches.map((m, idx) => (
                                                    <div key={idx} className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/50 text-xs flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-emerald-400 font-bold">Mot n°{m.wordIndex} :</span>
                                                            <span className="font-mono text-white bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                                                                {m.word}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {m.chars.map((c, cIdx) => (
                                                                <span key={cIdx} className="text-[10px] font-mono bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-500/40">
                                                                    Lettre: <strong>{c.char}</strong> ({c.name} {c.codeHex})
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/40 text-rose-300 text-xs text-center">
                                                    ❌ Aucun homoglyphe cyrillique détecté dans ce texte. Ce texte utilise 100% de caractères latins ordinaires (soit il provient directement d'une autre IA sans passer par CondaWeb, soit l'échange complet n'a pas été collé).
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 1: Code Espaces (Phrases 1, 3, 8) */}
                            {labActiveTab === 'spacing' && (
                                <div className="space-y-3">
                                    {/* Action bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-2xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-indigo-300">Générateur test :</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    await navigator.clipboard.writeText(SAMPLE_WATERMARK_TEXT);
                                                    showToast("📋 Texte test officiel (8 phrases avec double-espace sur 1, 3 et 8) copié !");
                                                }}
                                                className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                                            >
                                                <span>📋</span>
                                                <span>Copier 1 extrait test officiel (Phrases 1, 3, 8)</span>
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setZwnjTestInput('')}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                                        >
                                            🧹 Vider la zone
                                        </button>
                                    </div>

                                    {/* Input zone */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                                            <span>Collez ici le texte copié depuis CondaWeb, ou revenant de Gemini / ChatGPT :</span>
                                            <span className="text-[10px] text-indigo-400 font-mono">Détection temps réel</span>
                                        </label>
                                        <textarea
                                            className="w-full h-28 p-3 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-indigo-500 resize-y placeholder:text-slate-600"
                                            placeholder="Collez ici le texte à tester. Le laboratoire va analyser le nombre d'espaces après chaque point..."
                                            value={zwnjTestInput}
                                            onChange={(e) => setZwnjTestInput(e.target.value)}
                                        />
                                    </div>

                                    {/* Live spacing diagnostic counters */}
                                    {zwnjTestInput.trim() && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Total Phrases</div>
                                                <div className="text-lg font-black text-white">{spacingAnalysis.totalSentences}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-indigo-400">Doubles Espaces</div>
                                                <div className="text-lg font-black text-indigo-300">{spacingAnalysis.markedIndices.length}</div>
                                                <div className="text-[9px] text-indigo-400 font-mono">Phrases : {spacingAnalysis.markedIndices.join(', ') || 'Aucune'}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-amber-400">Cibles 1, 3, 8 Détectées</div>
                                                <div className="text-lg font-black text-amber-300">
                                                    {spacingAnalysis.matchedExpected.length} / {spacingAnalysis.applicableExpected.length}
                                                </div>
                                                <div className="text-[9px] text-amber-400 font-mono">Attendues : {spacingAnalysis.applicableExpected.join(', ') || '1, 3, 8'}</div>
                                            </div>
                                            <div className={`p-2.5 rounded-xl border text-center ${
                                                spacingAnalysis.isValidSignature
                                                    ? 'bg-emerald-950/50 border-emerald-500 text-emerald-300'
                                                    : spacingAnalysis.matchedExpected.length > 0
                                                    ? 'bg-amber-950/50 border-amber-500 text-amber-300'
                                                    : 'bg-rose-950/50 border-rose-500 text-rose-300'
                                            }`}>
                                                <div className="text-[10px] uppercase font-bold">Diagnostic</div>
                                                <div className="text-xs font-black mt-1">
                                                    {spacingAnalysis.isValidSignature
                                                        ? '🟢 SIGNATURE 1, 3, 8 VALIDÉE !'
                                                        : spacingAnalysis.matchedExpected.length > 0
                                                        ? '🟡 PARTIELLEMENT PRÉSERVÉ'
                                                        : '🔴 ÉCHEC : ESPACES EFFACÉS'}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Sentence-by-sentence breakdown */}
                                    {zwnjTestInput.trim() && (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            <div className="text-xs font-bold text-slate-300 sticky top-0 bg-slate-900 py-1">
                                                Analyse détaillée phrase par phrase :
                                            </div>
                                            {spacingAnalysis.sentences.map((s) => (
                                                <div
                                                    key={s.index}
                                                    className={`p-2.5 rounded-xl border text-xs space-y-1.5 transition ${
                                                        s.status === 'MATCH'
                                                            ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-100'
                                                            : s.status === 'MISSING_MARK'
                                                            ? 'bg-rose-950/30 border-rose-500/60 text-rose-100'
                                                            : s.status === 'UNEXPECTED_DOUBLE'
                                                            ? 'bg-amber-950/30 border-amber-500/60 text-amber-100'
                                                            : 'bg-slate-950/40 border-slate-800 text-slate-300'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold">
                                                                {s.status === 'MATCH' && '🟢'}
                                                                {s.status === 'MISSING_MARK' && '🔴'}
                                                                {s.status === 'UNEXPECTED_DOUBLE' && '🟡'}
                                                                {s.status === 'NORMAL' && '⚪'}
                                                                {' '}Phrase n°{s.index}
                                                                {s.isExpected && <span className="ml-1 text-[10px] uppercase font-bold text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded border border-indigo-800">Cible officielle</span>}
                                                            </span>
                                                            <span className="text-[11px] font-medium">
                                                                {s.status === 'MATCH' && 'Double espace PRÉSERVÉ après le point (.  )'}
                                                                {s.status === 'MISSING_MARK' && 'ÉCHEC : L\'espace supplémentaire a été EFFACÉ (1 seul espace trouvé)'}
                                                                {s.status === 'NORMAL' && 'Standard (1 seul espace après le point)'}
                                                                {s.status === 'UNEXPECTED_DOUBLE' && `Double espace inattendu (${s.spaceCount} espaces)`}
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
                                                            Espaces après le point : <strong className={s.hasDoubleSpace ? 'text-emerald-400' : 'text-slate-400'}>{s.spaceCount}</strong>
                                                        </span>
                                                    </div>
                                                    <p className="text-slate-300 font-mono text-[11px] bg-slate-950/80 p-2 rounded-lg border border-slate-800/80 m-0 break-words">
                                                        {s.text}
                                                        <span className={`ml-1 font-bold px-1.5 py-0.2 rounded text-[10px] ${
                                                            s.hasDoubleSpace
                                                                ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50'
                                                                : 'bg-slate-800 text-slate-400'
                                                        }`}>
                                                            [{s.spaceCount} {s.spaceCount > 1 ? 'espaces' : 'espace'}]
                                                        </span>
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* TAB 2: Invisible ZWNJ (\u200C) */}
                            {labActiveTab === 'zwnj' && (
                                <div className="space-y-3">
                                    {/* Action bar */}
                                    <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-purple-950/30 border border-purple-500/30 rounded-2xl">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-purple-300">Générer un extrait test :</span>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const sample = `\u200CCeci est un paragraphe test officiel généré depuis CondaWeb avec l'empreinte invisible U+200C.\u200C`;
                                                    await navigator.clipboard.writeText(sample);
                                                    showToast("📋 Paragraphe test CondaWeb (avec \\u200C) copié dans le presse-papier !");
                                                }}
                                                className="text-xs bg-purple-600 hover:bg-purple-500 text-white font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shadow cursor-pointer"
                                            >
                                                <span>📋</span>
                                                <span>Copier 1 paragraphe test avec \u200C</span>
                                            </button>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setZwnjTestInput('')}
                                            className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-xl font-medium transition cursor-pointer"
                                        >
                                            🧹 Vider la zone
                                        </button>
                                    </div>

                                    {/* Textarea for pasting */}
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-200 flex items-center justify-between">
                                            <span>Collez ici votre texte mixte (paragraphes CondaWeb et/ou paragraphes d'une autre IA) :</span>
                                            <span className="text-[10px] text-purple-400 font-mono">Ctrl+V / Cmd+V autorisé</span>
                                        </label>
                                        <textarea
                                            className="w-full h-28 p-3 rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 text-xs font-mono outline-none focus:border-purple-500 resize-y placeholder:text-slate-600"
                                            placeholder="Collez ici du texte provenant de CondaWeb, Gemini, ChatGPT, etc. Le laboratoire va analyser chaque paragraphe en direct..."
                                            value={zwnjTestInput}
                                            onChange={(e) => setZwnjTestInput(e.target.value)}
                                        />
                                    </div>

                                    {/* Live Analysis Counters */}
                                    {zwnjTestInput.trim() && (
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                                                <div className="text-[10px] uppercase font-bold text-slate-400">Total Paragraphes</div>
                                                <div className="text-lg font-black text-white">{zwnjAnalysis.paragraphs.length}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-emerald-400">🟢 CondaWeb</div>
                                                <div className="text-lg font-black text-emerald-300">{zwnjAnalysis.condaCount}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-rose-400">🔴 Autre IA / Externe</div>
                                                <div className="text-lg font-black text-rose-300">{zwnjAnalysis.externalCount}</div>
                                            </div>
                                            <div className="p-2.5 rounded-xl bg-purple-950/40 border border-purple-500/50 text-center">
                                                <div className="text-[10px] uppercase font-bold text-purple-400">Total \u200C trouvés</div>
                                                <div className="text-lg font-black text-purple-300">{zwnjAnalysis.totalZwnj}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Paragraph-by-paragraph breakdown */}
                                    {zwnjTestInput.trim() && (
                                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                            <div className="text-xs font-bold text-slate-300 sticky top-0 bg-slate-900 py-1">
                                                Analyse détaillée par bloc de texte :
                                            </div>
                                            {zwnjAnalysis.paragraphs.map((p) => (
                                                <div
                                                    key={p.index}
                                                    className={`p-3 rounded-xl border text-xs space-y-1.5 transition ${
                                                        p.isConda
                                                            ? 'bg-emerald-950/30 border-emerald-500/60 text-emerald-100'
                                                            : 'bg-rose-950/30 border-rose-500/60 text-rose-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base">{p.isConda ? '🟢' : '🔴'}</span>
                                                            <span className="font-bold">
                                                                Paragraphe {p.index} : {p.isConda ? 'Origine CondaWeb confirmée' : 'Origine Externe / Autre IA (Non marqué)'}
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/80 border border-slate-700">
                                                            \u200C: <strong className={p.zwnjCount > 0 ? 'text-emerald-400' : 'text-slate-500'}>{p.zwnjCount}</strong> | \u200B: {p.zwsCount} | \u200D: {p.zwjCount}
                                                        </div>
                                                    </div>
                                                    <p className="text-slate-300 font-mono text-[11px] bg-slate-950/70 p-2 rounded-lg border border-slate-800 m-0 break-words">
                                                        {p.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex justify-end pt-2 border-t border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setShowZwnjLabModal(false)}
                                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
                                >
                                    Fermer le laboratoire
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Toast Alert */}
            {toastMessage && (
                <div className="conda-redaction-toast">
                    {toastMessage}
                </div>
            )}

            {/* VOLET LATÉRAL INTÉGRÉ DIDAK'BOT */}
            {showDidakbotPanel && (
                <DidakbotSidebar
                    homework={homework}
                    user={user}
                    essayText={essayText}
                    topicText={topicText}
                    onCopyForAI={handleCopyForAI}
                    onClose={() => setShowDidakbotPanel(false)}
                />
            )}
        </div>
    );
}
