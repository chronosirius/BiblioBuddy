// BenbenekBuddy mode module.
// Stems-based learning: Word Within the Word (Learn / Practice / Test) and
// Words of the Day. All DOM queries are scoped to the [data-mode="benbenekbuddy"]
// container so the page can host other modes side-by-side without ID collisions.

(function () {
  "use strict";

  const MASTERY_TARGET = 3;
  const STORAGE_KEY = "benbenekBuddy.v1.progress";
  // CSVs sit alongside index.html now (moved out of the benbenekbuddy/ folder).
  const WWTW_CSV = "modes/benbenekbuddy/wwtw.csv";
  const WOTD_CSV = "modes/benbenekbuddy/wordoftheday.csv";

  // Test configuration.
  const TEST_MAX_QUESTIONS = 100;
  const TEST_HIGHEST_LIST_QUOTA = 25;

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
      selectedList: "",
      queue: [],
      index: 0,
      poolSignature: "",
      currentId: null,
      submitted: false,
    },
    test: {
      upToList: "",
      queue: [],
      index: 0,
      answers: [],
      currentId: null,
      submitted: false,
      status: "ready", // ready | running | complete
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
    tabTest: root.querySelector("#benbenek-tabTest"),
    wwtwControls: root.querySelector("#benbenek-wwtwControls"),
    learnControls: root.querySelector("#benbenek-learnControls"),
    practiceControls: root.querySelector("#benbenek-practiceControls"),
    testControls: root.querySelector("#benbenek-testControls"),
    learnListSelect: root.querySelector("#benbenek-learnListSelect"),
    practiceScopeSelect: root.querySelector("#benbenek-practiceScopeSelect"),
    practiceListField: root.querySelector("#benbenek-practiceListField"),
    practiceListSelect: root.querySelector("#benbenek-practiceListSelect"),
    practiceScopeHint: root.querySelector("#benbenek-practiceScopeHint"),
    learnProgressText: root.querySelector("#benbenek-learnProgressText"),
    testUpToSelect: root.querySelector("#benbenek-testUpToSelect"),
    testUpToHint: root.querySelector("#benbenek-testUpToHint"),
    testStartButton: root.querySelector("#benbenek-testStartButton"),
    focusCapsule: root.querySelector("#benbenek-focusCapsule"),
    focusNote: root.querySelector("#benbenek-focusNote"),
    questionMeta: root.querySelector("#benbenek-questionMeta"),
    questionTitle: root.querySelector("#benbenek-questionTitle"),
    questionPrompt: root.querySelector("#benbenek-questionPrompt"),
    questionCounter: root.querySelector("#benbenek-questionCounter"),
    answerForm: root.querySelector("#benbenek-answerForm"),
    answerInput: root.querySelector("#benbenek-answerInput"),
    submitButton: root.querySelector("#benbenek-submitButton"),
    nextButton: root.querySelector("#benbenek-nextButton"),
    feedback: root.querySelector("#benbenek-feedback"),
    answerDetails: root.querySelector("#benbenek-answerDetails"),
    detailAnswer: root.querySelector("#benbenek-detailAnswer"),
    detailWords: root.querySelector("#benbenek-detailWords"),
    detailLanguage: root.querySelector("#benbenek-detailLanguage"),
    testSummary: root.querySelector("#benbenek-testSummary"),
    testSummaryScore: root.querySelector("#benbenek-testSummaryScore"),
    testSummaryEmpty: root.querySelector("#benbenek-testSummaryEmpty"),
    testSummaryList: root.querySelector("#benbenek-testSummaryList"),
    testRestartButton: root.querySelector("#benbenek-testRestartButton"),
    masterySummary: root.querySelector("#benbenek-masterySummary"),
    masteredLists: root.querySelector("#benbenek-masteredLists"),
    resetProgress: root.querySelector("#benbenek-resetProgress"),
    detailDialog: root.querySelector("#benbenek-detailDialog"),
    detailDialogTitle: root.querySelector("#benbenek-detailDialogTitle"),
    detailDialogBody: root.querySelector("#benbenek-detailDialogBody"),
    detailDialogClose: root.querySelector("#benbenek-detailDialogClose"),
  };

  // Element ref helper used while adding new behavior without
  // touching the existing elements object.
  function el(id) {
    return root.querySelector("#" + id);
  }

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

    elements.tabTest.addEventListener("click", () => {
      state.wwtwTab = "test";
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

    elements.practiceListSelect.addEventListener("change", () => {
      state.practice.selectedList = elements.practiceListSelect.value;
      state.practice.currentId = null;
      state.practice.submitted = false;
      state.practice.queue = [];
      state.practice.index = 0;
      state.practice.poolSignature = "";
      renderAll();
    });

    elements.testUpToSelect.addEventListener("change", () => {
      // Selecting a range only changes configuration; the user still
      // needs to explicitly start/restart the test.
      state.test.upToList = elements.testUpToSelect.value;
      renderTestControls();
    });

    elements.testStartButton.addEventListener("click", () => {
      startTest();
      renderAll();
    });

    elements.testRestartButton.addEventListener("click", () => {
      startTest();
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
      resetTransientState();
      renderAll();
    });

    // Modal close handlers.
    elements.detailDialogClose.addEventListener("click", () => closeDetailDialog());
    elements.detailDialog.addEventListener("close", () => {
      if (state.detailDialogReturnFocus && typeof state.detailDialogReturnFocus.focus === "function") {
        state.detailDialogReturnFocus.focus();
      }
      state.detailDialogReturnFocus = null;
    });
    elements.detailDialog.addEventListener("click", (event) => {
      // Click on the backdrop (the dialog element itself) closes it.
      if (event.target === elements.detailDialog) {
        closeDetailDialog();
      }
    });
  }

  function resetTransientState() {
    state.learn.currentId = null;
    state.learn.submitted = false;
    state.practice.currentId = null;
    state.practice.submitted = false;
    state.practice.queue = [];
    state.practice.index = 0;
    state.practice.poolSignature = "";
    state.test.queue = [];
    state.test.index = 0;
    state.test.answers = [];
    state.test.currentId = null;
    state.test.submitted = false;
    state.test.status = "ready";
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
      const label = state.wwtwTab === "learn"
        ? "WWTW Learn"
        : state.wwtwTab === "practice"
          ? "WWTW Practice"
          : "WWTW Test";
      elements.focusCapsule.textContent = label;
    } else {
      elements.focusCapsule.textContent = "Words of the Day";
    }
  }

  function renderTabs() {
    const onLearn = state.wwtwTab === "learn";
    const onPractice = state.wwtwTab === "practice";
    const onTest = state.wwtwTab === "test";
    elements.tabLearn.classList.toggle("active", onLearn);
    elements.tabPractice.classList.toggle("active", onPractice);
    elements.tabTest.classList.toggle("active", onTest);
    elements.learnControls.hidden = !onLearn;
    elements.practiceControls.hidden = !onPractice;
    elements.testControls.hidden = !onTest;
  }

  function renderSelectors() {
    renderLearnListSelect();
    renderPracticeScopeControls();
    renderTestControls();
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

    // The "List" selector is only shown for "One mastered list".
    const showList = state.practice.scope === "one";
    elements.practiceListField.hidden = !showList;
    if (showList) {
      const options = masteredLists.length
        ? masteredLists
        : state.listIds;
      const validSelection = options.includes(state.practice.selectedList)
        ? state.practice.selectedList
        : (state.learn.selectedList && options.includes(state.learn.selectedList)
            ? state.learn.selectedList
            : options[0] || "");
      state.practice.selectedList = validSelection;
      elements.practiceListSelect.innerHTML = options
        .map((listId) => `<option value="${window.SharedUtils.escapeHtml(listId)}">List ${window.SharedUtils.escapeHtml(listId)}</option>`)
        .join("");
      elements.practiceListSelect.value = state.practice.selectedList;
    }

    if (state.practice.scope === "one") {
      const selectedListMastered = masteredSet.has(state.practice.selectedList);
      elements.practiceScopeHint.textContent = selectedListMastered
        ? "Practicing the selected mastered list."
        : "Selected list is not mastered yet. Master it in Learn mode first.";
    } else {
      elements.practiceScopeHint.textContent = `${masteredLists.length} mastered list(s) included.`;
    }
  }

  function renderTestControls() {
    const eligible = getSequentiallyEligibleTestLists();
    if (!eligible.length) {
      elements.testUpToSelect.innerHTML = "";
      elements.testUpToSelect.disabled = true;
      elements.testStartButton.disabled = true;
      elements.testUpToHint.textContent = "Master List 1 in Learn mode to unlock your first test.";
      return;
    }

    // If the previously configured Up To list is no longer eligible,
    // fall back to the first eligible list.
    if (!eligible.includes(state.test.upToList)) {
      state.test.upToList = eligible[0];
    }
    elements.testUpToSelect.innerHTML = eligible
      .map((listId) => `<option value="${window.SharedUtils.escapeHtml(listId)}">List ${window.SharedUtils.escapeHtml(listId)}</option>`)
      .join("");
    elements.testUpToSelect.value = state.test.upToList;
    elements.testUpToSelect.disabled = false;
    elements.testStartButton.disabled = false;
    elements.testUpToHint.textContent = `Up to List ${eligible[eligible.length - 1]} unlocked. Choose an Up To value, then start the test.`;
  }

  // A list is sequentially eligible when every non-empty list from
  // List 1 through that list is fully mastered.
  function getSequentiallyEligibleTestLists() {
    const mastered = new Set(getMasteredLists());
    const sorted = state.listIds.slice().sort((a, b) => Number(a) - Number(b));
    const eligible = [];
    let allOk = true;
    for (const listId of sorted) {
      const entries = state.wwtwByList.get(listId) || [];
      if (entries.length === 0) {
        // Empty data lists still block progression.
        allOk = false;
        continue;
      }
      if (!allOk || !mastered.has(listId)) {
        allOk = false;
        continue;
      }
      eligible.push(listId);
    }
    return eligible;
  }

  function renderProgressPanels() {
    const masteredLists = getMasteredLists();
    elements.masterySummary.textContent = `${masteredLists.length} of ${state.listIds.length} lists mastered.`;

    // Build clickable rows for every list so users can drill in to see
    // stem-level mastery details.
    const frag = document.createDocumentFragment();
    state.listIds.forEach((listId) => {
      const entries = state.wwtwByList.get(listId) || [];
      const masteredCount = entries.filter((entry) => isStemMastered(entry.id)).length;
      const status = masteredCount === entries.length && entries.length > 0 ? "Mastered" : "In progress";
      const row = document.createElement("button");
      row.type = "button";
      row.className = "bb-list-row";
      row.setAttribute("aria-label", `Open details for List ${listId}`);
      row.innerHTML = `
        <span class="bb-list-row-label">List ${window.SharedUtils.escapeHtml(listId)}</span>
        <span class="bb-list-row-meta">${masteredCount}/${entries.length} • ${window.SharedUtils.escapeHtml(status)}</span>
      `;
      row.addEventListener("click", () => {
        openListDetails(listId, row);
      });
      frag.appendChild(row);
    });
    elements.masteredLists.replaceChildren(frag);
  }

  // ----- WWTW detail dialog (used by list rows and Test summary stems) ----

  state.detailDialogReturnFocus = null;

  function closeDetailDialog() {
    if (elements.detailDialog.open) {
      elements.detailDialog.close();
    }
  }

  function openListDetails(listId, trigger) {
    const entries = state.wwtwByList.get(listId) || [];
    elements.detailDialogTitle.textContent = `List ${listId} — stem mastery`;
    elements.detailDialogBody.replaceChildren(buildStemsTable(entries));
    state.detailDialogReturnFocus = trigger || document.activeElement;
    elements.detailDialog.showModal();
  }

  function openStemDetails(entryId, trigger, title) {
    // Stem details are now rendered inline within the list using a
    // <details> disclosure, so the dialog body simply shows the list
    // for the stem's list with the matching card auto-expanded.
    const entry = getWwtwEntryById(entryId);
    if (!entry) {
      return;
    }
    const listEntries = state.wwtwByList.get(entry.list) || [entry];
    elements.detailDialogTitle.textContent = title || `List ${entry.list} — stem mastery`;
    const list = buildStemsTable(listEntries, { expandEntryId: entry.id });
    elements.detailDialogBody.replaceChildren(list);
    state.detailDialogReturnFocus = trigger || document.activeElement;
    elements.detailDialog.showModal();
  }

  // Renders the stem list. Each row is a <details> element so clicking
  // anywhere on the card toggles the expanded panel below it. The
  // expanded panel reveals the definition, example words, and language.
  // `options.highlightEntryId` is currently unused but kept for
  // future visual emphasis on a specific stem.
  function buildStemsTable(entries, options) {
    const opts = options || {};
    const list = document.createElement("ul");
    list.className = "bb-stem-list";
    entries.forEach((entry) => {
      const count = getMasteryCount(entry.id);
      const displayed = Math.min(count, MASTERY_TARGET);
      const shouldOpen = opts.expandEntryId === entry.id;

      const li = document.createElement("li");
      li.className = "bb-stem-list-item";

      const details = document.createElement("details");
      details.className = "bb-stem-card";
      if (shouldOpen) {
        details.open = true;
      }

      const summary = document.createElement("summary");
      summary.className = "bb-stem-card-summary";

      const stemLabel = document.createElement("span");
      stemLabel.className = "bb-stem-card-stem";
      stemLabel.textContent = entry.stemRaw;
      summary.appendChild(stemLabel);

      const mastery = document.createElement("span");
      mastery.className = "bb-stem-card-mastery";
      mastery.textContent = `${displayed}/${MASTERY_TARGET}`;
      summary.appendChild(mastery);

      const track = document.createElement("div");
      track.className = "bb-progress-track";
      track.setAttribute("role", "progressbar");
      track.setAttribute("aria-valuemin", "0");
      track.setAttribute("aria-valuemax", String(MASTERY_TARGET));
      track.setAttribute("aria-valuenow", String(displayed));
      const fill = document.createElement("div");
      fill.className = "bb-progress-fill " + getMasteryColorClass(count);
      fill.style.width = `${(displayed / MASTERY_TARGET) * 100}%`;
      track.appendChild(fill);
      summary.appendChild(track);

      details.appendChild(summary);

      // The expanded panel: definition, example words, language.
      const body = document.createElement("div");
      body.className = "bb-stem-card-body";

      const definition = document.createElement("p");
      definition.className = "bb-stem-card-definition";
      definition.textContent = entry.definitionRaw;
      body.appendChild(definition);

      if (entry.words.length) {
        const words = document.createElement("p");
        words.className = "bb-stem-card-words";
        const wordsLabel = document.createElement("span");
        wordsLabel.className = "bb-stem-card-label";
        wordsLabel.textContent = "Words:";
        words.appendChild(wordsLabel);
        words.appendChild(document.createTextNode(` ${entry.words.join(", ")}`));
        body.appendChild(words);
      }

      const meta = document.createElement("p");
      meta.className = "bb-stem-card-meta";
      const metaLabel = document.createElement("span");
      metaLabel.className = "bb-stem-card-label";
      metaLabel.textContent = "Language:";
      meta.appendChild(metaLabel);
      meta.appendChild(document.createTextNode(` ${entry.language}`));
      body.appendChild(meta);

      details.appendChild(body);
      li.appendChild(details);

      list.appendChild(li);
    });
    return list;
  }

  function getMasteryColorClass(count) {
    if (count <= 0) {
      return "bb-progress-level-0";
    }
    if (count === 1) {
      return "bb-progress-level-1";
    }
    if (count === 2) {
      return "bb-progress-level-2";
    }
    return "bb-progress-level-3";
  }

  function renderQuestion() {
    clearFeedback();
    elements.testSummary.hidden = true;
    elements.testSummaryList.innerHTML = "";
    if (state.topMode === "wwtw") {
      if (state.wwtwTab === "learn") {
        elements.questionCounter.hidden = true;
        elements.answerForm.hidden = false;
        renderLearnQuestion();
        return;
      }
      if (state.wwtwTab === "practice") {
        elements.questionCounter.hidden = true;
        elements.answerForm.hidden = false;
        renderPracticeQuestion();
        return;
      }
      elements.answerForm.hidden = false;
      renderTestQuestion();
      return;
    }

    elements.questionCounter.hidden = true;
    elements.answerForm.hidden = false;
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
    const scopeLabel = state.practice.scope === "all"
      ? "All mastered lists"
      : `List ${state.practice.selectedList}`;

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

  // ----- Test mode --------------------------------------------------------

  function startTest() {
    const upTo = state.test.upToList;
    if (!upTo) {
      return;
    }
    const eligibleListIds = state.listIds
      .slice()
      .sort((a, b) => Number(a) - Number(b))
      .filter((listId) => Number(listId) <= Number(upTo));

    // Mastered stems only.
    const masteredStems = state.wwtwEntries.filter((entry) => {
      return isStemMastered(entry.id) && eligibleListIds.includes(entry.list);
    });

    const highestList = upTo;
    const highestStems = masteredStems.filter((entry) => entry.list === highestList);
    const lowerStems = masteredStems.filter((entry) => entry.list !== highestList);

    const highestQuota = Math.min(TEST_HIGHEST_LIST_QUOTA, highestStems.length);
    const highestPicks = window.SharedUtils.shuffle(highestStems).slice(0, highestQuota);
    const highestIds = new Set(highestPicks.map((entry) => entry.id));

    // Fill remaining slots with stems from lower lists, never repeating
    // any stem already chosen from the highest list.
    const remainingSlots = TEST_MAX_QUESTIONS - highestPicks.length;
    const lowerPicks = window.SharedUtils.shuffle(lowerStems)
      .filter((entry) => !highestIds.has(entry.id))
      .slice(0, Math.max(0, remainingSlots));

    const queue = highestPicks.concat(lowerPicks).map((entry) => entry.id);
    state.test.queue = queue;
    state.test.index = 0;
    state.test.answers = queue.map(() => null);
    state.test.currentId = queue[0] || null;
    state.test.submitted = false;
    state.test.status = queue.length ? "running" : "ready";
  }

  function renderTestQuestion() {
    if (state.test.status === "complete") {
      renderTestSummary();
      return;
    }

    if (!state.test.queue.length) {
      elements.questionMeta.textContent = "WWTW Test";
      elements.questionTitle.textContent = "No test available";
      elements.questionPrompt.textContent = "Configure an Up To value and press Start Test.";
      elements.questionCounter.hidden = true;
      elements.answerForm.hidden = true;
      elements.testSummary.hidden = true;
      elements.focusNote.textContent = "Up To determines the cumulative mastered range used for the test.";
      return;
    }

    if (!state.test.currentId) {
      state.test.currentId = state.test.queue[state.test.index];
    }

    const entry = getWwtwEntryById(state.test.currentId);
    if (!entry) {
      renderNoQuestion("Test data is unavailable.");
      return;
    }

    elements.questionCounter.hidden = false;
    elements.questionCounter.textContent = `Question ${state.test.index + 1} out of ${state.test.queue.length}`;

    renderPrompt({
      meta: `WWTW Test • Up to List ${state.test.upToList}`,
      title: entry.stemRaw,
      prompt: "Type the definition for this stem.",
    });
    window.SharedUtils.applyRainbowText(elements.questionTitle);
    window.SharedUtils.applyRainbowText(elements.questionPrompt);

    elements.focusNote.textContent = "Results are revealed only after the test is complete.";
    // Hide any per-question feedback/details while the test is running.
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";
    elements.answerDetails.classList.remove("visible");
    setInputState({ submitted: state.test.submitted });
  }

  function submitTestAnswer() {
    if (state.test.status !== "running") {
      return;
    }
    if (state.test.submitted || !state.test.currentId) {
      return;
    }
    const entry = getWwtwEntryById(state.test.currentId);
    if (!entry) {
      return;
    }
    const userAnswer = window.SharedUtils.normalizeText(elements.answerInput.value);
    const correct = userAnswer === entry.definitionNorm;
    state.test.answers[state.test.index] = {
      entryId: entry.id,
      stemRaw: entry.stemRaw,
      correct,
      userAnswerRaw: elements.answerInput.value,
      correctDefinition: entry.definitionRaw,
      list: entry.list,
      words: entry.words,
      language: entry.language,
    };
    state.test.submitted = true;
    // Do not reveal correctness; simply enable Next and clear feedback.
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";
    elements.answerDetails.classList.remove("visible");
    setInputState({ submitted: true });
  }

  function renderTestSummary() {
    const total = state.test.queue.length;
    const answers = state.test.answers.filter((a) => a !== null);
    const correctCount = answers.filter((a) => a.correct).length;
    const incorrect = answers.filter((a) => !a.correct);

    elements.questionCounter.hidden = true;
    elements.answerForm.hidden = true;
    elements.answerDetails.classList.remove("visible");
    elements.feedback.textContent = "";
    elements.feedback.className = "feedback";
    elements.answerInput.value = "";
    elements.answerInput.disabled = true;
    elements.submitButton.disabled = true;
    elements.nextButton.disabled = true;

    elements.testSummary.hidden = false;
    elements.testSummaryScore.textContent = total
      ? `Score: ${correctCount} of ${total} correct`
      : "Score: 0 of 0 correct";

    elements.testSummaryEmpty.hidden = incorrect.length > 0;
    elements.testSummaryList.innerHTML = "";

    incorrect.forEach((answer) => {
      const li = document.createElement("li");
      li.className = "bb-test-summary-item";

      const stemBtn = document.createElement("button");
      stemBtn.type = "button";
      stemBtn.className = "bb-test-summary-stem";
      stemBtn.textContent = answer.stemRaw;
      stemBtn.addEventListener("click", () => {
        openStemDetails(answer.entryId, stemBtn, `Stem: ${answer.stemRaw}`);
      });
      li.appendChild(stemBtn);

      const meta = document.createElement("p");
      meta.className = "bb-test-summary-meta";
      meta.textContent = `List ${answer.list}`;
      li.appendChild(meta);

      const userAnswer = document.createElement("p");
      userAnswer.className = "bb-test-summary-line";
      const userLabel = document.createElement("span");
      userLabel.className = "bb-test-summary-label";
      userLabel.textContent = "Your answer:";
      userAnswer.appendChild(userLabel);
      userAnswer.appendChild(document.createTextNode(` ${answer.userAnswerRaw || "(blank)"}`));
      li.appendChild(userAnswer);

      const correctAnswer = document.createElement("p");
      correctAnswer.className = "bb-test-summary-line";
      const correctLabel = document.createElement("span");
      correctLabel.className = "bb-test-summary-label";
      correctLabel.textContent = "Correct:";
      correctAnswer.appendChild(correctLabel);
      correctAnswer.appendChild(document.createTextNode(` ${answer.correctDefinition}`));
      li.appendChild(correctAnswer);

      elements.testSummaryList.appendChild(li);
    });

    elements.focusNote.textContent = total
      ? `Test complete: ${correctCount}/${total} correct. Review incorrect stems below.`
      : "Test complete.";
  }

  function handleSubmit() {
    if (state.topMode === "wwtw") {
      if (state.wwtwTab === "learn") {
        submitLearnAnswer();
        return;
      }
      if (state.wwtwTab === "practice") {
        submitPracticeAnswer();
        return;
      }
      submitTestAnswer();
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

      if (state.wwtwTab === "practice") {
        if (state.practice.submitted) {
          state.practice.index += 1;
          state.practice.currentId = null;
          state.practice.submitted = false;
        }
        renderAll();
        return;
      }

      if (state.test.submitted) {
        state.test.index += 1;
        state.test.submitted = false;
        if (state.test.index >= state.test.queue.length) {
          state.test.status = "complete";
          renderTestSummary();
          return;
        }
        state.test.currentId = state.test.queue[state.test.index];
        renderAll();
        return;
      }
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

    // Scope = "one": only the list selected in Practice controls.
    const target = state.practice.selectedList;
    if (!target || !masteredLists.includes(target)) {
      return [];
    }
    return state.wwtwByList.get(target) || [];
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