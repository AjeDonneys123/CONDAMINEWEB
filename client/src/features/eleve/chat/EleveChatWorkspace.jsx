import React, { useEffect, useMemo, useRef, useState } from "react";
import "./EleveChatWorkspace.css";

const EMPTY_ANSWERS = {
  error1: "",
  error2: "",
  agreements: "",
  difference: "",
};
const stripHtml = (html = "") =>
  String(html)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function RichNotes({ initialHtml, onChange, onBlocked }) {
  const editorRef = useRef(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== initialHtml)
      editorRef.current.innerHTML = initialHtml || "";
  }, []); // only hydrate the uncontrolled editor once so typing never loses its caret

  const format = (command, value) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    onChange(editorRef.current?.innerHTML || "");
  };

  return (
    <div className="research-rich-wrap">
      <div className="research-rich-tools" aria-label="Mise en forme des notes">
        <button type="button" onClick={() => format("bold")}>
          <b>B</b>
        </button>
        <button type="button" onClick={() => format("insertUnorderedList")}>
          • Liste
        </button>
        {["#172033", "#dc2626", "#2563eb", "#0b9c6c", "#7c3aed", "#ea580c"].map(
          (color) => (
            <button
              className="research-color"
              style={{ background: color }}
              type="button"
              aria-label={`Couleur ${color}`}
              key={color}
              onClick={() => format("foreColor", color)}
            />
          ),
        )}
        <button type="button" onClick={() => format("removeFormat")}>
          Effacer format
        </button>
      </div>
      <div
        ref={editorRef}
        className="research-rich-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={(event) => onChange(event.currentTarget.innerHTML)}
        onPaste={onBlocked}
        onDrop={onBlocked}
        data-placeholder="Note ici les faits, dates, arguments et différences avec tes propres mots…"
      />
    </div>
  );
}

const paragraphs = (text = "") =>
  String(text)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

function HighlightedParagraph({ text, excerpts = [] }) {
  const ranges = excerpts
    .map((excerpt) => {
      const start = String(text)
        .toLocaleLowerCase("fr")
        .indexOf(String(excerpt).toLocaleLowerCase("fr"));
      return start >= 0 ? { start, end: start + String(excerpt).length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
  if (!ranges.length) return <p>{text}</p>;
  const nodes = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start < cursor) return;
    if (range.start > cursor) nodes.push(text.slice(cursor, range.start));
    nodes.push(
      <mark className="research-missing-angle" key={`${range.start}-${index}`}>
        {text.slice(range.start, range.end)}
      </mark>,
    );
    cursor = range.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <p>{nodes}</p>;
}

export default function EleveChatWorkspace({ user, onQuit }) {
  const studentId = String(user?._id || user?.id || "").trim();
  const level = String(
    user?.currentClass || user?.className || user?.level || "",
  ).trim();
  const storageKey = `condaweb-research-workshop-v4-${studentId || "student"}`;
  const [phase, setPhase] = useState("topic");
  const [topic, setTopic] = useState("");
  const [base, setBase] = useState(null);
  const [questions, setQuestions] = useState("");
  const [feedback, setFeedback] = useState("");
  const [documents, setDocuments] = useState(null);
  const [activeSource, setActiveSource] = useState(1);
  const [answers, setAnswers] = useState(EMPTY_ANSWERS);
  const [review, setReview] = useState(null);
  const [notesHtml, setNotesHtml] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [visibleSourceText, setVisibleSourceText] = useState("");
  const [uncoveredThreadIds, setUncoveredThreadIds] = useState([]);
  const [researchSetup, setResearchSetup] = useState(null);
  const [group, setGroup] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([studentId]);
  const [memberSearch, setMemberSearch] = useState("");
  const [groupTopic, setGroupTopic] = useState("");
  const [groupNotes, setGroupNotes] = useState({});
  const [characterOpen, setCharacterOpen] = useState(false);
  const [researchDraft, setResearchDraft] = useState("");
  const [researchSending, setResearchSending] = useState(false);
  const notesSaveTimerRef = useRef(null);
  const researchMessagesRef = useRef(null);
  const articleRepairRef = useRef("");

  useEffect(() => {
    if (!studentId) return undefined;
    let active = true;
    fetch(`/api/eleve/chat/research-setup/${encodeURIComponent(studentId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(data.error || "Chargement impossible.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setResearchSetup(data);
        if (data.activeGroup) setGroup(data.activeGroup);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      });
    return () => {
      active = false;
    };
  }, [studentId]);

  useEffect(() => {
    if (!group?._id) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(
          `/api/eleve/chat/research-group/${encodeURIComponent(group._id)}?studentId=${encodeURIComponent(studentId)}`,
          { cache: "no-store" },
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok && active) {
          setGroup(data.group);
          setGroupNotes(data.group?.notesByStudent?.[studentId] || {});
        }
      } catch (_) {}
    };
    void refresh();
    const timer = window.setInterval(refresh, group?.generatingArticles ? 700 : 7000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [group?._id, group?.generatingArticles, studentId]);

  const createResearchGroup = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/eleve/chat/research-group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          memberIds: selectedMembers,
          topic: groupTopic,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Création du groupe impossible.");
      setGroup({
        ...data.group,
        botUrl: data.botUrl,
        characterBotUrl: data.characterBotUrl,
      });
    } catch (createError) {
      setError(createError.message);
    } finally {
      setPending(false);
    }
  };

  const updateGroupNotes = (value) => {
    const next = { ...groupNotes, [activeSource]: value };
    setGroupNotes(next);
    window.clearTimeout(notesSaveTimerRef.current);
    notesSaveTimerRef.current = window.setTimeout(
      () =>
        fetch(
          `/api/eleve/chat/research-group/${encodeURIComponent(group._id)}/notes`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId,
              articleIndex: activeSource,
              notes: value,
            }),
          },
        ),
      500,
    );
  };

  const closeResearchGroup = async () => {
    if (!group?._id || !window.confirm("Terminer cette recherche pour tout le groupe ? Les articles et les notes resteront enregistrés.")) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/eleve/chat/research-group/${encodeURIComponent(group._id)}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Fermeture impossible.");
      setGroup(null);
      setGroupTopic("");
      setSelectedMembers([studentId]);
      setGroupNotes({});
      setActiveSource(1);
    } catch (closeError) {
      setError(closeError.message);
    } finally {
      setPending(false);
    }
  };

  const sendGroupMessage = async (messageOverride = "") => {
    const message = String(messageOverride || researchDraft).trim();
    if (!message || !group?._id || researchSending) return;
    setResearchSending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/eleve/chat/research-group/${encodeURIComponent(group._id)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentId, message }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data.error || "Cyclopédia ne répond pas.");
      setGroup(data.group);
      setResearchDraft("");
      setNotice("Cyclopédia a répondu ↓");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setResearchSending(false);
    }
  };

  useEffect(() => {
    const container = researchMessagesRef.current;
    if (!container || !group?.chatMessages?.length) return;
    window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [group?.chatMessages?.length, researchSending]);

  useEffect(() => {
    const documents = Array.isArray(group?.documents) ? group.documents : [];
    if (!group?._id || documents.length === 0 || documents.length >= 3 || group.generatingArticles) return;
    const repairKey = `${group._id}:${documents.map((document) => document.index).sort().join(",")}`;
    if (articleRepairRef.current === repairKey) return;
    articleRepairRef.current = repairKey;
    let active = true;
    fetch(`/api/eleve/chat/research-group/${group._id}/articles/retry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || "Reprise impossible");
        return payload;
      })
      .then((payload) => {
        if (active && payload.group) setGroup(payload.group);
        if (payload.pending) articleRepairRef.current = "";
      })
      .catch(() => { articleRepairRef.current = ""; });
    return () => { active = false; };
  }, [group, studentId]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(storageKey) || "null",
      );
      if (!saved || typeof saved !== "object") return;
      setPhase(saved.phase || "topic");
      setTopic(saved.topic || "");
      setBase(saved.base || null);
      setQuestions(saved.questions || "");
      setFeedback(saved.feedback || "");
      setDocuments(saved.documents || null);
      setAnswers(saved.answers || EMPTY_ANSWERS);
      setReview(saved.review || null);
      setNotesHtml(saved.notesHtml || "");
      setUncoveredThreadIds(
        Array.isArray(saved.uncoveredThreadIds) ? saved.uncoveredThreadIds : [],
      );
    } catch (_) {}
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          phase,
          topic,
          base,
          questions,
          feedback,
          documents,
          answers,
          review,
          notesHtml,
          uncoveredThreadIds,
        }),
      );
    } catch (_) {}
  }, [
    storageKey,
    phase,
    topic,
    base,
    questions,
    feedback,
    documents,
    answers,
    review,
    notesHtml,
    uncoveredThreadIds,
  ]);

  const source = useMemo(
    () => documents?.[`article${activeSource}`] || null,
    [documents, activeSource],
  );
  const progress =
    phase === "topic"
      ? 1
      : phase === "questions"
        ? 2
        : phase === "documents"
          ? 3
          : 4;
  const missingExcerpts = useMemo(
    () =>
      (Array.isArray(base?.openThreads) ? base.openThreads : [])
        .map((thread, index) =>
          typeof thread === "string"
            ? { id: `T${index + 1}`, excerpt: thread }
            : thread,
        )
        .filter((thread) => uncoveredThreadIds.includes(String(thread?.id)))
        .map((thread) => String(thread?.excerpt || ""))
        .filter(Boolean),
    [base, uncoveredThreadIds],
  );

  useEffect(() => {
    const completeText = String(source?.content || "");
    setVisibleSourceText("");
    if (!completeText) return undefined;
    let cursor = 0;
    let frame = 0;
    const reveal = () => {
      cursor = Math.min(completeText.length, cursor + 22);
      setVisibleSourceText(completeText.slice(0, cursor));
      if (cursor < completeText.length)
        frame = window.requestAnimationFrame(reveal);
    };
    frame = window.requestAnimationFrame(reveal);
    return () => window.cancelAnimationFrame(frame);
  }, [source?.content]);

  const callResearch = async (requestedPhase, payload = {}) => {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/eleve/chat/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          phase: requestedPhase,
          level,
          ...payload,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(data?.error || `Erreur HTTP ${response.status}`);
      return data;
    } catch (requestError) {
      setError(
        requestError.message ||
          "L’atelier de recherche est momentanément indisponible.",
      );
      return null;
    } finally {
      setPending(false);
    }
  };

  const submitTopic = async () => {
    if (!topic.trim()) return;
    const data = await callResearch("topic", { topic: topic.trim() });
    if (!data) return;
    setBase(data.base);
    setUncoveredThreadIds([]);
    setFeedback(
      "Lis cette première base. Elle laisse volontairement plusieurs points à éclaircir : à toi de les transformer en questions de recherche.",
    );
    setPhase("questions");
  };

  const submitQuestions = async () => {
    if (!questions.trim()) return;
    const data = await callResearch("questions", { topic, base, questions });
    if (!data) return;
    setUncoveredThreadIds(
      Array.isArray(data.uncoveredThreadIds)
        ? data.uncoveredThreadIds.map(String)
        : [],
    );
    setFeedback(data.feedback || "Reformule tes questions.");
    if (data.ready && data.documents) {
      setQuestions((data.acceptedQuestions || []).join("\n") || questions);
      setDocuments(data.documents);
      setPhase("documents");
    }
  };

  const submitReview = async () => {
    const data = await callResearch("review", {
      topic,
      questions,
      documents,
      answers: { ...answers, questions },
    });
    if (!data) return;
    setReview(data);
    if (data.complete) setPhase("complete");
  };

  const blockImportedText = (event) => {
    event.preventDefault();
    setNotice(
      "Le copier-coller est bloqué dans les notes : reformule les informations avec tes propres mots.",
    );
    window.setTimeout(() => setNotice(""), 3500);
  };

  const prepareCanva = async () => {
    await callResearch("complete", {
      topic,
      questions,
      notes: stripHtml(notesHtml),
      review,
    });
    window.open("https://www.canva.com/", "_blank", "noopener,noreferrer");
  };

  const restart = () => {
    if (
      !window.confirm(
        "Commencer une nouvelle recherche et effacer ce brouillon sur cet appareil ?",
      )
    )
      return;
    window.localStorage.removeItem(storageKey);
    setPhase("topic");
    setTopic("");
    setBase(null);
    setQuestions("");
    setFeedback("");
    setDocuments(null);
    setActiveSource(1);
    setAnswers(EMPTY_ANSWERS);
    setReview(null);
    setNotesHtml("");
    setError("");
    setUncoveredThreadIds([]);
  };

  if (!group) {
    const candidates = (researchSetup?.students || []).filter((student) =>
      student.name
        .toLocaleLowerCase("fr")
        .includes(memberSearch.toLocaleLowerCase("fr")),
    );
    return (
      <div className="research-overlay">
        <header className="research-header">
          <div>
            <div className="research-kicker">Travail collaboratif</div>
            <h1>🔎 Atelier Recherche</h1>
          </div>
          <div className="research-header-actions">
            <button className="research-close" type="button" onClick={onQuit}>
              ×
            </button>
          </div>
        </header>
        <main className="research-group-setup">
          <section>
            <h2>Membres du groupe</h2>
            <p>
              Sélectionne les élèves réellement présents. Vos trois articles
              seront ensuite partagés automatiquement.
            </p>
            <input
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Rechercher un élève…"
              className="research-member-search"
            />
            <div className="research-member-list">
              {candidates.map((student) => (
                <label key={student.id}>
                  <input
                    type="checkbox"
                    disabled={student.id === studentId}
                    checked={selectedMembers.includes(student.id)}
                    onChange={() =>
                      setSelectedMembers((current) =>
                        current.includes(student.id)
                          ? current.filter((id) => id !== student.id)
                          : [...current, student.id],
                      )
                    }
                  />
                  <span>{student.name}</span>
                </label>
              ))}
            </div>
            <label className="research-topic-label">
              Sujet du groupe
              <input
                value={groupTopic}
                onChange={(event) => setGroupTopic(event.target.value)}
                placeholder="Ex. Cléopâtre"
              />
            </label>
            {!researchSetup?.botReady && (
              <div className="research-error">
                Le professeur doit choisir le bot Cyclopédia dans l’onglet Bots.
              </div>
            )}
            {researchSetup?.botReady && !researchSetup?.characterBotReady && (
              <div className="research-error">
                Le professeur doit aussi choisir le bot « Personnage historique
                ».
              </div>
            )}
            {error && <div className="research-error">{error}</div>}
            <button
              type="button"
              onClick={createResearchGroup}
              disabled={
                pending ||
                !researchSetup?.botReady ||
                !researchSetup?.characterBotReady ||
                !groupTopic.trim()
              }
            >
              {pending ? "Création…" : "Commencer avec Cyclopédia"}
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!Array.isArray(group.documents) || group.documents.length === 0) {
    const rawChatMessages = Array.isArray(group.chatMessages)
      ? group.chatMessages
      : [];
    const chatMessages = rawChatMessages.filter(
      (message, index) =>
        !(
          index > 0 &&
          rawChatMessages[index - 1]?.role === message.role &&
          String(rawChatMessages[index - 1]?.content || "").trim() ===
            String(message.content || "").trim()
        ),
    );
    const introIndex = chatMessages.findIndex(
      (message) =>
        message.role !== "user" && String(message.content || "").trim(),
    );
    const introduction = introIndex >= 0 ? chatMessages[introIndex] : null;
    const discussion = chatMessages.filter(
      (message, index) =>
        index !== introIndex &&
        !(
          message.role === "user" &&
          /^Notre sujet de recherche est\s*:/i.test(
            String(message.content || ""),
          )
        ),
    );
    return (
      <div className="research-overlay">
        <header className="research-header">
          <div>
            <div className="research-kicker">
              Groupe ·{" "}
              {(group.members || []).map((member) => member.name).join(", ")}
            </div>
            <h1>🔎 Cyclopédia · {group.topic || "Recherche"}</h1>
          </div>
          <div className="research-header-actions">
            <button className="research-close" type="button" onClick={onQuit}>
              ×
            </button>
          </div>
        </header>
        <main className="research-bot-stage">
          <div className="research-sync-info">
            <b>Construisez votre plan</b>
            <span>
              Le sujet a été envoyé automatiquement. Cyclopédia évalue vos
              propositions jusqu’à validation, puis partage les trois articles.
            </span>
          </div>
          <section className="research-intro-and-chat">
            {introduction ? (
              <article className="research-intro-article">
                <div className="research-generated-label">
                  Mini-article d’introduction
                </div>
                <h2>{group.topic}</h2>
                <p>{introduction.content}</p>
              </article>
            ) : (
              <div className="research-inline-empty">
                <p>Cyclopédia n’a pas encore fourni l’introduction.</p>
                <button
                  type="button"
                  disabled={researchSending}
                  onClick={() =>
                    sendGroupMessage(
                      `Notre sujet de recherche est : ${group.topic}. Présente le mini-article d’introduction et demande-nous de proposer un plan en trois axes.`,
                    )
                  }
                >
                  Relancer l’introduction
                </button>
              </div>
            )}
            <section className="research-inline-chat">
              <header>
                <h3>💬 Faire évaluer le plan et les questions</h3>
                <p>
                  Échangez avec Cyclopédia jusqu’à ce qu’il valide vos trois
                  axes.
                </p>
              </header>
              <div className="research-inline-messages" ref={researchMessagesRef}>
                {!discussion.length && (
                  <div className="research-inline-empty">
                    <p>Proposez maintenant votre plan en trois parties.</p>
                  </div>
                )}
                {discussion.map((message) => (
                  <article
                    key={message.id}
                    className={
                      message.role === "user" ? "student" : "assistant"
                    }
                  >
                    <b>
                      {message.role === "user" ? "Le groupe" : "Cyclopédia"}
                    </b>
                    <p>{message.content}</p>
                  </article>
                ))}
                {researchSending && (
                  <article className="assistant">
                    <b>Cyclopédia</b>
                    <p>J’examine votre proposition…</p>
                  </article>
                )}
              </div>
              {error && <div className="research-error">{error}</div>}
              {notice && <div className="research-reply-notice">{notice}</div>}
              <div className="research-plan-entry">
                <label>Votre plan et vos questions</label>
                <textarea
                  value={researchDraft}
                  onChange={(event) => setResearchDraft(event.target.value)}
                  placeholder="I. …\nII. …\nIII. …\nNos questions : …"
                />
                <button
                  type="button"
                  disabled={!researchDraft.trim() || researchSending}
                  onClick={() => sendGroupMessage()}
                >
                  {researchSending ? "Analyse en cours…" : "Faire évaluer"}
                </button>
              </div>
            </section>
          </section>
        </main>
      </div>
    );
  }

  if (Array.isArray(group.documents) && group.documents.length > 0) {
    const availableDocuments = [...group.documents].sort((a, b) => Number(a.index) - Number(b.index));
    const article = availableDocuments.find((document) => Number(document.index) === activeSource) || availableDocuments[0];
    const noteText = String(groupNotes[activeSource] || "");
    const filledLines = noteText
      .split("\n")
      .filter((line) => line.trim().length > 2).length;
    return (
      <div className="research-overlay">
        <header className="research-header">
          <div>
            <div className="research-kicker">
              Articles disponibles {availableDocuments.length}/3 ·{" "}
              {(group.members || []).map((member) => member.name).join(", ")}
            </div>
            <h1>📚 {group.topic}</h1>
          </div>
          <div className="research-header-actions">
            <button className="research-restart" type="button" onClick={closeResearchGroup} disabled={pending}>
              Terminer cette recherche
            </button>
            <button className="research-close" type="button" onClick={onQuit}>
              ×
            </button>
          </div>
        </header>
        <main className="research-shared-stage">
          <nav>
            {availableDocuments.map((document, index) => (
              <button
                type="button"
                key={document.index || index}
                className={activeSource === Number(document.index) ? "active" : ""}
                onClick={() => setActiveSource(Number(document.index))}
              >
                Article {document.index || index + 1}
              </button>
            ))}
          </nav>
          <div className="research-shared-grid">
            <article>
              <div className="research-generated-label">
                Document partagé avec tout le groupe · une erreur volontaire s’y
                cache
              </div>
              <h2>{article.title}</h2>
              {paragraphs(article.content).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {article.sourceNote && <footer>{article.sourceNote}</footer>}
            </article>
            <aside>
              <h2>📝 Mes notes personnelles</h2>
              <p>Écris au moins quatre lignes avec tes propres mots.</p>
              <textarea
                value={noteText}
                onChange={(event) => updateGroupNotes(event.target.value)}
                onPaste={blockImportedText}
                placeholder="1. Information importante…\n2. Date ou personnage…\n3. Explication…\n4. Erreur repérée…"
              />
              {notice && <div className="research-notice">{notice}</div>}
              <small>{filledLines}/4 lignes minimum</small>
            </aside>
          </div>
          {filledLines >= 4 && (
            <div
              className={`research-character-drawer ${characterOpen ? "open" : ""}`}
            >
              <button
                type="button"
                onClick={() => setCharacterOpen((value) => !value)}
              >
                🎭 Parler au personnage
              </button>
              {characterOpen && (
                <div>
                  <h3>Dialogue avec le personnage</h3>
                  <iframe
                    title="Personnage historique"
                    src={
                      group.characterBotUrl ||
                      `https://novapeda.eu/didakbot3.php?bot=${encodeURIComponent(group.historicalCharacterShareLink || "")}&pseudo=${encodeURIComponent(group.sessionPseudo)}-PERSO`
                    }
                  />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="research-overlay">
      <header className="research-header">
        <div>
          <div className="research-kicker">
            Entraînement à la recherche · {level || "collège"}
          </div>
          <h1>🔎 Atelier Recherche</h1>
        </div>
        <div
          className="research-progress"
          aria-label={`Étape ${progress} sur 4`}
        >
          {["Sujet", "Questions", "Sources", "Bilan"].map((label, index) => (
            <span className={progress >= index + 1 ? "done" : ""} key={label}>
              {index + 1}. {label}
            </span>
          ))}
        </div>
        <div className="research-header-actions">
          <button type="button" className="research-restart" onClick={restart}>
            Nouveau sujet
          </button>
          <button
            className="research-close"
            type="button"
            onClick={onQuit}
            aria-label="Quitter"
          >
            ×
          </button>
        </div>
      </header>

      <main className={`research-workspace phase-${phase}`}>
        <section className="research-coach">
          {phase === "topic" ? (
            <div className="research-welcome">
              <div className="research-avatar">C</div>
              <div className="research-bubble">
                <strong>Bienvenue ! Quel est ton sujet ?</strong>
                <p>
                  Ma mission est de t’entraîner à chercher, questionner et
                  confronter des documents. Je ne ferai pas l’exposé à ta place.
                </p>
              </div>
              <textarea
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Ex. Cléopâtre, les volcans, l’intelligence artificielle…"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    submitTopic();
                  }
                }}
              />
              <button
                type="button"
                onClick={submitTopic}
                disabled={!topic.trim() || pending}
              >
                {pending ? "Préparation…" : "Découvrir le sujet"}
              </button>
            </div>
          ) : (
            <>
              <div className="research-coach-head">
                <span className="research-avatar">C</span>
                <div>
                  <strong>Cyclopédia</strong>
                  <small>
                    Document pédagogique d’entraînement adapté à ton niveau
                  </small>
                </div>
              </div>
              <article className="research-base">
                <h2>{base?.title || topic}</h2>
                {paragraphs(base?.article).map((p, i) => (
                  <HighlightedParagraph
                    text={p}
                    excerpts={missingExcerpts}
                    key={i}
                  />
                ))}
                {missingExcerpts.length > 0 && (
                  <div className="research-missing-hint">
                    Les passages rouges montrent des aspects importants qui ne
                    sont pas encore couverts par tes questions. Ajoute une
                    question qui les explore.
                  </div>
                )}
              </article>
              <div className="research-question-box">
                <h3>Ta problématique et tes questions</h3>
                <p>
                  Pose une ou plusieurs questions assez larges pour nécessiter
                  une vraie recherche. Évite les questions auxquelles une seule
                  ligne suffit.
                </p>
                <textarea
                  value={questions}
                  onChange={(event) => setQuestions(event.target.value)}
                  placeholder="Pourquoi… ? Comment… ? Dans quelle mesure… ?"
                />
                {feedback && (
                  <div className="research-feedback">💬 {feedback}</div>
                )}
                <button
                  type="button"
                  onClick={submitQuestions}
                  disabled={!questions.trim() || pending}
                >
                  {pending
                    ? "Analyse…"
                    : documents
                      ? "Régénérer les sources"
                      : "Faire vérifier mes questions"}
                </button>
              </div>
            </>
          )}
          {error && <div className="research-error">{error}</div>}
        </section>

        <section className="research-dossier">
          {!documents ? (
            <div className="research-dossier-empty">
              <span>📚</span>
              <h2>Ton dossier documentaire apparaîtra ici</h2>
              <p>
                Il sera créé quand tes questions seront assez ouvertes et
                intéressantes.
              </p>
            </div>
          ) : (
            <>
              <div className="research-source-tabs">
                <button
                  type="button"
                  className={activeSource === 1 ? "active" : ""}
                  onClick={() => setActiveSource(1)}
                >
                  Source 1
                </button>
                <button
                  type="button"
                  className={activeSource === 2 ? "active" : ""}
                  onClick={() => setActiveSource(2)}
                >
                  Source 2
                </button>
                <span>{documents.sharedTension}</span>
              </div>
              <div className="research-source-and-notes">
                <article
                  className="research-article research-article-shielded"
                  onCopy={(event) => event.preventDefault()}
                  onCut={(event) => event.preventDefault()}
                  onDragStart={(event) => event.preventDefault()}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div className="research-generated-label">
                    Document pédagogique généré · une coquille factuelle s’y
                    cache
                  </div>
                  <h2>{source?.title}</h2>
                  <h3>{source?.angle}</h3>
                  {paragraphs(visibleSourceText).map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                  {visibleSourceText.length <
                    String(source?.content || "").length && (
                    <span
                      className="research-writing-caret"
                      aria-hidden="true"
                    />
                  )}
                  <footer>{source?.sourceNote}</footer>
                  <div className="research-reading-shield" aria-hidden="true" />
                </article>
                <div className="research-notes-panel">
                  <div className="research-notes-title">
                    <div>
                      <h3>📝 Mes notes</h3>
                      <span>
                        {stripHtml(notesHtml).length} caractères · collage
                        bloqué
                      </span>
                    </div>
                  </div>
                  <RichNotes
                    initialHtml={notesHtml}
                    onChange={setNotesHtml}
                    onBlocked={blockImportedText}
                  />
                  {notice && <div className="research-notice">{notice}</div>}
                </div>
              </div>
            </>
          )}
        </section>

        {documents && (
          <section className="research-comparison">
            <div className="research-comparison-head">
              <div>
                <h2>Confronte les deux sources</h2>
                <p>
                  Les deux angles peuvent être défendables. Repère aussi
                  l’unique coquille cachée dans chaque texte.
                </p>
              </div>
              {review && (
                <div
                  className={`research-score ${review.complete ? "ok" : ""}`}
                >
                  {review.score ?? 0}/4
                </div>
              )}
            </div>
            <div className="research-comparison-grid">
              <label>
                Coquille de la source 1
                <textarea
                  value={answers.error1}
                  onChange={(e) =>
                    setAnswers({ ...answers, error1: e.target.value })
                  }
                />
              </label>
              <label>
                Coquille de la source 2
                <textarea
                  value={answers.error2}
                  onChange={(e) =>
                    setAnswers({ ...answers, error2: e.target.value })
                  }
                />
              </label>
              <label>
                Ce que les deux sources confirment
                <textarea
                  value={answers.agreements}
                  onChange={(e) =>
                    setAnswers({ ...answers, agreements: e.target.value })
                  }
                />
              </label>
              <label>
                Leur différence de point de vue
                <textarea
                  value={answers.difference}
                  onChange={(e) =>
                    setAnswers({ ...answers, difference: e.target.value })
                  }
                />
              </label>
            </div>
            {review && (
              <div className={`research-review ${review.complete ? "ok" : ""}`}>
                <strong>
                  {review.complete ? "Mission réussie" : "À approfondir"}
                </strong>
                <span>{review.feedback}</span>
                {review.missing?.length > 0 && (
                  <small>À revoir : {review.missing.join(" · ")}</small>
                )}
              </div>
            )}
            <div className="research-actions">
              <button type="button" onClick={submitReview} disabled={pending}>
                {pending ? "Vérification…" : "Valider ma confrontation"}
              </button>
              <button
                className="research-canva"
                type="button"
                onClick={prepareCanva}
              >
                Préparer Canva ↗
              </button>
              <span>
                <b>Écran partagé :</b> Mac <kbd>⌘</kbd> + <kbd>⌥</kbd> +{" "}
                <kbd>N</kbd> · Windows/Linux <kbd>Shift</kbd> + <kbd>Alt</kbd> +{" "}
                <kbd>N</kbd>
              </span>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
