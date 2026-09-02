// BenbenekBuddy mode module.
// Stems-based learning: Word Within the Word (Learn / Practice) and Words of the Day.
// All DOM queries are scoped to the [data-mode="benbenekbuddy"] container so the
// page can host other modes side-by-side without ID collisions.

(function () {
  "use strict";

  const MASTERY_TARGET = 3;
  const STORAGE_KEY = "benbenekBuddy.v1.progress";
  // CSVs sit alongside index.html now (moved out of the benbenekbuddy/ folder).
  const WWTW_CSV = "modes/benbenekbuddy/wwtw.csv";
  const WOTD_CSV = "modes/benbenekbuddy/wordoftheday.csv";

  const state = {
    topMode: "wwtw",
    wwtwTab: "learn",
    wwtwEntries: [],
    wwtwByList: new Map(),
    wotdEntries: [],
    listIds: [],
    progress: loadProgress(),
    learn: {
      selectedList: "",
      currentId: null,
      submitted: false,
    },
    practice: {
      scope: "all",
      queue: [],
      index: 0,
      poolSignature: "",
      currentId: null,
      submitted: false,
    },
    wotd: {
      queue: [],
      index: 0,
      currentId: null,
      submitted: false,
    },
  };

  const root = document.querySelector('[data-mode="benbenekbuddy"]');

  const elements = {
    root,
    modeWwtw: root.querySelector("#benbenek-modeWwtw"),
    modeWotd: root.querySelector("#benbenek-modeWotd"),
    tabLearn: root.querySelector("#benbenek-tabLearn"),
    tabPractice: root.querySelector("#benbenek-tabPractice"),
    wwtwControls: root.querySelector("#benbenek-wwtwControls"),
    learnControls: root.querySelector("#benbenek-learnControls"),
    practiceControls: root.querySelector("#benbenek-practiceControls"),
    learnListSelect: root.querySelector("#benbenek-learnListSelect"),
    practiceScopeSelect: root.querySelector("#benbenek-practiceScopeSelect"),
    practiceScopeHint: root.querySelector("#benbenek-practiceScopeHint"),
    learnProgressText: root.querySelector("#benbenek-learnProgressText"),
    focusCapsule: root.querySelector("#benbenek-focusCapsule"),
    focusNote: root.querySelector("#benbenek-focusNote"),
    questionMeta: root.querySelector("#benbenek-questionMeta"),
    questionTitle: root.querySelector("#benbenek-questionTitle"),
    questionPrompt: root.querySelector("#benbenek-questionPrompt"),
    answerForm: root.querySelector("#benbenek-answerForm"),
    answerInput: root.querySelector("#benbenek-answerInput"),
    submitButton: root.querySelector("#benbenek-submitButton"),
    nextButton: root.querySelector("#benbenek-nextButton"),
    feedback: root.querySelector("#benbenek-feedback"),
    answerDetails: root.querySelector("#benbenek-answerDetails"),
    detailAnswer: root.querySelector("#benbenek-detailAnswer"),
    detailWords: root.querySelector("#benbenek-detailWords"),
    detailLanguage: root.querySelector("#benbenek-detailLanguage"),
    masterySummary: root.querySelector("#benbenek-masterySummary"),
    masteredLists: root.querySelector("#benbenek-masteredLists"),
    resetProgress: root.querySelector("#benbenek-resetProgress"),
  };

  init();

  async function init() {
    try {
      await loadData();
      buildListState();
      bindEvents();
      renderAll();
    } catch (error) {
      renderFatalError(error);
    }
  }

  function bindEvents() {
    elements.modeWwtw.addEventListener("click", () => {
      state.topMode = "wwtw";
      renderAll();
    });

    elements.modeWotd.addEventListener("click", () => {
      state.topMode = "wotd";
      renderAll();
    });

    elements.tabLearn.addEventListener("click", () => {
      state.wwtwTab = "learn";
      renderAll();
    });

    elements.tabPractice.addEventListener("click", () => {
      state.wwtwTab = "practice";
      renderAll();
    });

    elements.learnListSelect.addEventListener("change", () => {
      state.learn.selectedList = elements.learnListSelect.value;
      state.learn.currentId = null;
      state.learn.submitted = false;
      renderAll();
    });

    elements.practiceScopeSelect.addEventListener("change", () => {
      state.practice.scope = elements.practiceScopeSelect.value;
      state.practice.currentId = null;
      state.practice.submitted = false;
      state.practice.queue = [];
      state.practice.index = 0;
      state.practice.poolSignature = "";
      renderAll();
    });

    elements.answerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      handleSubmit();
    });

    elements.answerInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !elements.answerInput.disabled && elements.nextButton.disabled === false) {
        event.preventDefault();
        handleNext();
      }
    });

    elements.nextButton.addEventListener("click", () => {
      handleNext();
    });

    elements.resetProgress.addEventListener("click", () => {
      const confirmed = window.confirm("Reset all BenbenekBuddy progress?");
      if (!confirmed) {
        return;
      }
      state.progress = { stems: {} };
      saveProgress();
      state.learn.currentId = null;
      state.learn.submitted = false;
      state.practice.currentId = null;
      state.practice.submitted = false;
      state.practice.queue = [];
      state.practice.index = 0;
      state.practice.poolSignature = "";
      renderAll();
    });
  }

  async function loadData() {
    const [wwtwText, wotdText] = await Promise.all([
      fetch(WWTW_CSV).then(assertResponse).then((response) => response.text()),
      fetch(WOTD_CSV).then(assertResponse).then((response) => response.text()),
    ]);

    state.wwtwEntries = parseWwtwCsv(wwtwText);
    state.wotdEntries = parseWotdCsv(wotdText);
  }

  function assertResponse(response) {
    if (!response.ok) {
      throw new Error("Unable to load BenbenekBuddy data files.");
    }
    return response;
  }

  function parseWwtwCsv(csvText) {
    const rows = window.SharedUtils.parseCsv(csvText);
    if (!rows.length) {
      return [];
    }

    const dataRows = rows.slice(1);
    const entries = [];

    for (const row of dataRows) {
      const list = String(row[0] || "").trim();
      const stemRaw = String(row[1] || "").trim();
      const definitionRaw = String(row[2] || "").trim();
      const wordsRaw = String(row[3] || "").trim();
      const language = String(row[4] || "").trim();
      const citation = String(row[5] || "").trim();

      if (!list || !stemRaw || !definitionRaw) {
        continue;
      }

      const words = dedupeWords(wordsRaw.split(",").map((word) => word.trim()).filter(Boolean));
      const stemNorm = window.SharedUtils.normalizeText(stemRaw);

      entries.push({
        id: `${list}|${stemNorm}`,
        list,
        stemRaw,
        stemNorm,
        definitionRaw,
        definitionNorm: window.SharedUtils.normalizeText(definitionRaw),
        words,
        language: language || "Unknown",
        citation: citation || "",
      });
    }

    return entries;
  }

  function parseWotdCsv(csvText) {
    const rows = window.SharedUtils.parseCsv(csvText);
    if (!rows.length) {
      return [];
    }

    const dataRows = rows.slice(1);
    const entries = [];

    for (const row of dataRows) {
      const wordRaw = String(row[0] || "").trim();
      const definitionRaw = String(row[1] || "").trim();

      if (!wordRaw || !definitionRaw) {
        continue;
      }

      entries.push({
        id: window.SharedUtils.normalizeText(wordRaw),
        wordRaw,
        wordNorm: window.SharedUtils.normalizeText(wordRaw),
        definitionRaw,
        definitionNorm: window.SharedUtils.normalizeText(definitionRaw),
      });
    }

    return entries;
  }

  function dedupeWords(words) {
    const seen = new Set();
    const deduped = [];

    for (const word of words) {
      const norm = window.SharedUtils.normalizeText(word);
      if (!norm || seen.has(norm)) {
        continue;
      }
      seen.add(norm);
      deduped.push(word);
    }

    return deduped;
  }

  function buildListState() {
    state.wwtwByList = state.wwtwEntries.reduce((map, entry) => {
      if (!map.has(entry.list)) {
        map.set(entry.list, []);
      }
      map.get(entry.list).push(entry);
      return map;
    }, new Map());

    state.listIds = Array.from(state.wwtwByList.keys()).sort((a, b) => Number(a) - Number(b));

    if (!state.learn.selectedList && state.listIds.length) {
      state.learn.selectedList = state.listIds[0];
    }
  }

  function renderAll() {
    renderTopModeUI();
    renderTabs();
    renderSelectors();
    renderProgressPanels();
    renderQuestion();
  }

  function renderTopModeUI() {
    const inWwtw = state.topMode === "wwtw";
    elements.modeWwtw.classList.toggle("active", inWwtw);
    elements.modeWotd.classList.toggle("active", !inWwtw);
    elements.wwtwControls.hidden = !inWwtw;

    if (inWwtw) {
      elements.focusCapsule.textContent = state.wwtwTab === "learn" ? "WWTW Learn" : "WWTW Practice";
    } else {
      elements.focusCapsule.textContent = "Words of the Day";
    }
  }

  function renderTabs() {
    elements.tabLearn.classList.toggle("active", state.wwtwTab === "learn");
    elements.tabPractice.classList.toggle("active", state.wwtwTab === "practice");
    elements.learnControls.hidden = state.wwtwTab !== "learn";
    elements.practiceControls.hidden = state.wwtwTab !== "practice";
  }

  function renderSelectors() {
    renderLearnListSelect();
    renderPracticeScopeControls();
  }

  function renderLearnListSelect() {
    elements.learnListSelect.innerHTML = state.listIds
      .map((listId) => `<option value="${window.SharedUtils.escapeHtml(listId)}">List ${window.SharedUtils.escapeHtml(listId)}</option>`)
      .join("");

    elements.learnListSelect.value = state.learn.selectedList;

    const listEntries = state.wwtwByList.get(state.learn.selectedList) || [];
    const masteredCount = listEntries.filter((entry) => isStemMastered(entry.id)).length;
    const total = listEntries.length;

    elements.learnProgressText.textContent = total
      ? `${masteredCount} of ${total} stems mastered in this list.`
      : "No stems in this list.";
  }

  function renderPracticeScopeControls() {
    const masteredLists = getMasteredLists();
    const masteredSet = new Set(masteredLists);
    elements.practiceScopeSelect.value = state.practice.scope;

    const selectedLearnList = state.learn.selectedList;
    const selectedListMastered = masteredSet.has(selectedLearnList);
    if (state.practice.scope === "one") {
      elements.practiceScopeHint.textContent = selectedListMastered
        ? "Using your current Learn selection."
        : "Your current Learn selection is not mastered yet.";
    } else {
      elements.practiceScopeHint.textContent = `${masteredLists.length} mastered list(s) included.`;
    }
  }

  function renderProgressPanels() {
    const masteredLists = getMasteredLists();
    elements.masterySummary.textContent = `${masteredLists.length} of ${state.listIds.length} lists mastered.`;

    elements.masteredLists.innerHTML = state.listIds
      .map((listId) => {
        const entries = state.wwtwByList.get(listId) || [];
        const masteredCount = entries.filter((entry) => isStemMastered(entry.id)).length;
        const status = masteredCount === entries.length && entries.length > 0 ? "Mastered" : "In progress";
        return `<div class="bb-chip-row"><span>List ${window.SharedUtils.escapeHtml(listId)}</span><span>${masteredCount}/${entries.length} • ${status}</span></div>`;
      })
      .join("");
  }

  function renderQuestion() {
    clearFeedback();
    if (state.topMode === "wwtw") {
      if (state.wwtwTab === "learn") {
        renderLearnQuestion();
        return;
      }
      renderPracticeQuestion();
      return;
    }

    renderWotdQuestion();
  }

  function renderLearnQuestion() {
    const entries = state.wwtwByList.get(state.learn.selectedList) || [];
    if (!entries.length) {
      renderNoQuestion("No stems available for this list.");
      return;
    }

    if (!state.learn.currentId) {
      const pending = entries.filter((entry) => !isStemMastered(entry.id));
      const pool = pending.length ? pending : entries;
      const entry = window.SharedUtils.pickRandom(pool);
      state.learn.currentId = entry.id;
      state.learn.submitted = false;
      elements.focusNote.textContent = pending.length
        ? "Master each stem by answering correctly three times."
        : "This list is mastered. Continue reviewing to stay sharp.";
    }

    const entry = getWwtwEntryById(state.learn.currentId);
    renderPrompt({
      meta: `WWTW Learn • List ${entry.list}`,
      title: entry.stemRaw,
      prompt: "Type the definition for this stem.",
    });
    window.SharedUtils.applyRainbowText(elements.questionTitle);
    window.SharedUtils.applyRainbowText(elements.questionPrompt);

    setInputState({ submitted: state.learn.submitted });
  }

  function renderPracticeQuestion() {
    const pool = getPracticePool();

    if (!pool.length) {
      renderNoQuestion("No mastered stems available yet. Master a list in Learn mode first.");
      elements.focusNote.textContent = "Practice unlocks after at least one full list is mastered.";
      return;
    }

    const signature = pool.map((entry) => entry.id).sort().join("|");
    if (state.practice.poolSignature !== signature) {
      state.practice.poolSignature = signature;
      state.practice.queue = [];
      state.practice.index = 0;
      state.practice.currentId = null;
      state.practice.submitted = false;
    }

    if (!state.practice.queue.length || state.practice.index >= state.practice.queue.length) {
      state.practice.queue = window.SharedUtils.shuffle(pool.map((entry) => entry.id));
      state.practice.index = 0;
    }

    if (!state.practice.currentId) {
      state.practice.currentId = state.practice.queue[state.practice.index];
      state.practice.submitted = false;
    }

    const entry = getWwtwEntryById(state.practice.currentId);
    const scopeLabel = state.practice.scope === "all" ? "All mastered lists" : "Current Learn selection";

    renderPrompt({
      meta: `WWTW Practice • ${scopeLabel}`,
      title: entry.stemRaw,
      prompt: "Type the definition for this stem.",
    });
    window.SharedUtils.applyRainbowText(elements.questionTitle);
    window.SharedUtils.applyRainbowText(elements.questionPrompt);

    elements.focusNote.textContent = "Practice loops forever by reshuffling after each full run.";
    setInputState({ submitted: state.practice.submitted });
  }

  function renderWotdQuestion() {
    elements.focusNote.textContent = "You will see every word once per cycle, then a new shuffle starts.";

    if (!state.wotdEntries.length) {
      renderNoQuestion("No words available in words of the day data.");
      return;
    }

    if (!state.wotd.queue.length || state.wotd.index >= state.wotd.queue.length) {
      state.wotd.queue = window.SharedUtils.shuffle(state.wotdEntries.map((entry) => entry.id));
      state.wotd.index = 0;
    }

    if (!state.wotd.currentId) {
      state.wotd.currentId = state.wotd.queue[state.wotd.index];
      state.wotd.submitted = false;
    }

    const entry = getWotdEntryById(state.wotd.currentId);

    renderPrompt({
      meta: "Words of the Day",
      title: "Definition",
      prompt: entry.definitionRaw,
    });
    window.SharedUtils.applyRainbowText(elements.questionPrompt);

    setInputState({ submitted: state.wotd.submitted });
  }

  function renderPrompt({ meta, title, prompt }) {
    elements.questionMeta.textContent = meta;
    elements.questionTitle.textContent = title;
    elements.questionPrompt.textContent = prompt;
    window.SharedUtils.applyRainbowText(elements.questionTitle);
    window.SharedUtils.applyRainbowText(elements.questionPrompt);
  }

  function renderNoQuestion(message) {
    elements.questionMeta.textContent = "BenbenekBuddy";
    elements.questionTitle.textContent = "Ready when you are";
    elements.questionPrompt.textContent = message;
    elements.answerInput.value = "";
    elements.answerInput.disabled = true;
    elements.submitButton.disabled = true;
    elements.nextButton.disabled = true;
    elements.answerDetails.classList.remove("visible");
  }

  function handleSubmit() {
    if (state.topMode === "wwtw") {
      if (state.wwtwTab === "learn") {
        submitLearnAnswer();
        return;
      }
      submitPracticeAnswer();
      return;
    }

    submitWotdAnswer();
  }

  function submitLearnAnswer() {
    if (state.learn.submitted || !state.learn.currentId) {
      return;
    }

    const entry = getWwtwEntryById(state.learn.currentId);
    const userAnswer = window.SharedUtils.normalizeText(elements.answerInput.value);
    const correct = userAnswer === entry.definitionNorm;

    if (correct) {
      incrementMastery(entry.id);
    }

    showWwtwFeedback({ entry, correct, includeMastery: true });
    state.learn.submitted = true;
    setInputState({ submitted: true });
    renderProgressPanels();
    renderSelectors();
  }

  function submitPracticeAnswer() {
    if (state.practice.submitted || !state.practice.currentId) {
      return;
    }

    const entry = getWwtwEntryById(state.practice.currentId);
    const userAnswer = window.SharedUtils.normalizeText(elements.answerInput.value);
    const correct = userAnswer === entry.definitionNorm;

    showWwtwFeedback({ entry, correct, includeMastery: false });
    state.practice.submitted = true;
    setInputState({ submitted: true });
  }

  function submitWotdAnswer() {
    if (state.wotd.submitted || !state.wotd.currentId) {
      return;
    }

    const entry = getWotdEntryById(state.wotd.currentId);
    const userAnswer = window.SharedUtils.normalizeText(elements.answerInput.value);
    const correct = userAnswer === entry.wordNorm;

    elements.feedback.textContent = correct
      ? "Correct. Nice recall."
      : `Not quite. Correct word: ${entry.wordRaw}`;
    elements.feedback.className = `feedback ${correct ? "ok" : "bad"}`;

    elements.detailAnswer.textContent = entry.wordRaw;
    elements.detailWords.textContent = "-";
    elements.detailLanguage.textContent = "-";
    elements.answerDetails.classList.add("visible");

    state.wotd.submitted = true;
    setInputState({ submitted: true });
  }

  function handleNext() {
    if (state.topMode === "wwtw") {
      if (state.wwtwTab === "learn") {
        state.learn.currentId = null;
        state.learn.submitted = false;
        renderAll();
        return;
      }

      if (state.practice.submitted) {
        state.practice.index += 1;
        state.practice.currentId = null;
        state.practice.submitted = false;
      }
      renderAll();
      return;
    }

    if (state.wotd.submitted) {
      state.wotd.index += 1;
      state.wotd.currentId = null;
      state.wotd.submitted = false;
    }

    renderAll();
  }

  function showWwtwFeedback({ entry, correct, includeMastery }) {
    if (correct) {
      elements.feedback.textContent = "Correct.";
      elements.feedback.className = "feedback ok";
    } else {
      elements.feedback.textContent = `Incorrect. Correct definition: ${entry.definitionRaw}`;
      elements.feedback.className = "feedback bad";
    }

    const masteryCount = getMasteryCount(entry.id);
    const masteryText = includeMastery
      ? ` (${Math.min(masteryCount, MASTERY_TARGET)}/${MASTERY_TARGET} toward mastery)`
      : "";

    if (correct && includeMastery) {
      elements.feedback.textContent += masteryText;
    }

    elements.detailAnswer.textContent = entry.definitionRaw;
    elements.detailWords.textContent = entry.words.length ? entry.words.join(", ") : "No example words listed.";
    elements.detailLanguage.textContent = entry.language;
    elements.answerDetails.classList.add("visible");
  }

  function setInputState({ submitted }) {
    elements.answerInput.disabled = false;
    elements.submitButton.disabled = submitted;
    elements.nextButton.disabled = !submitted;

    if (!submitted) {
      elements.answerInput.value = "";
      elements.answerInput.focus();
      elements.answerDetails.classList.remove("visible");
    }
  }

  function clearFeedback() {
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";
  }

  function getPracticePool() {
    const masteredLists = getMasteredLists();
    if (!masteredLists.length) {
      return [];
    }

    if (state.practice.scope === "all") {
      return masteredLists.flatMap((listId) => state.wwtwByList.get(listId) || []);
    }

    const learnListId = state.learn.selectedList;
    if (!masteredLists.includes(learnListId)) {
      return [];
    }

    return state.wwtwByList.get(learnListId) || [];
  }

  function getMasteredLists() {
    return state.listIds.filter((listId) => {
      const entries = state.wwtwByList.get(listId) || [];
      return entries.length > 0 && entries.every((entry) => isStemMastered(entry.id));
    });
  }

  function getWwtwEntryById(id) {
    return state.wwtwEntries.find((entry) => entry.id === id);
  }

  function getWotdEntryById(id) {
    return state.wotdEntries.find((entry) => entry.id === id);
  }

  function isStemMastered(stemId) {
    return getMasteryCount(stemId) >= MASTERY_TARGET;
  }

  function getMasteryCount(stemId) {
    return Number(state.progress.stems[stemId]?.correctCount || 0);
  }

  function incrementMastery(stemId) {
    const current = getMasteryCount(stemId);
    state.progress.stems[stemId] = {
      correctCount: current + 1,
    };
    saveProgress();
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { stems: {} };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.stems) {
        return { stems: {} };
      }
      return parsed;
    } catch (error) {
      return { stems: {} };
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function renderFatalError(error) {
    elements.questionMeta.textContent = "BenbenekBuddy";
    elements.questionTitle.textContent = "Could not load data";
    elements.questionPrompt.textContent = error?.message || "An unknown error occurred.";
    elements.answerInput.disabled = true;
    elements.submitButton.disabled = true;
    elements.nextButton.disabled = true;
    elements.focusNote.textContent = "Check that CSV files are present and reachable.";
  }
})();