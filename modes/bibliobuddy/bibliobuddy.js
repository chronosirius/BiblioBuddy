// BiblioBuddy mode module.
// Quiz modes: Definitions, Synonyms, Fill in the Blank.
// All DOM queries are scoped to the [data-mode="bibliobuddy"] container so
// the page can host other modes side-by-side without ID collisions.

(function () {
  "use strict";

  const DEFINITIONS_DIR = "definitions";
  const SYNONYMS_DIR = "synonyms";
  const STORAGE_PREFIX = "biblioBuddy.v1";
  const MAX_ACTIVE_NON_MASTERED = 50;

  const MODES = {
    definitions: {
      label: "Definitions",
      prompt: "Choose the correct definition.",
    },
    synonyms: {
      label: "Synonyms",
      prompt: "Choose the closest synonym.",
    },
    fitb: {
      label: "Fill in the Blank",
      prompt: "Choose the word that best fits the sentence.",
    },
  };

  const categoryLabels = {
    "not-encountered": "Not encountered yet",
    "work-needed": "Work needed",
    "keep-trying": "Keep trying",
    "getting-there": "Getting there",
    "nearly-mastered": "Nearly mastered",
    mastered: "Mastered",
  };

  const root = document.querySelector('[data-mode="bibliobuddy"]');

  const elements = {
    root,
    modeButtons: Array.from(root.querySelectorAll(".mode-button")),
    modeCapsule: root.querySelector("#biblio-modeCapsule"),
    capNotice: root.querySelector("#biblio-capNotice"),
    reviewMastered: root.querySelector("#biblio-reviewMastered"),
    resetMode: root.querySelector("#biblio-resetMode"),
    settingsPanel: root.querySelector("#biblio-settingsPanel"),
    saveData: root.querySelector("#biblio-saveData"),
    loadData: root.querySelector("#biblio-loadData"),
    loadInput: root.querySelector("#biblio-loadInput"),
    questionCard: root.querySelector(".question-card"),
    questionMeta: root.querySelector("#biblio-questionMeta"),
    questionTitle: root.querySelector("#biblio-questionTitle"),
    questionPrompt: root.querySelector("#biblio-questionPrompt"),
    options: root.querySelector("#biblio-options"),
    answerDetails: root.querySelector("#biblio-answerDetails"),
    detailWord: root.querySelector("#biblio-detailWord"),
    detailDefinitions: root.querySelector("#biblio-detailDefinitions"),
    detailPronunciation: root.querySelector("#biblio-detailPronunciation"),
    detailSynonyms: root.querySelector("#biblio-detailSynonyms"),
    detailSentences: root.querySelector("#biblio-detailSentences"),
    feedback: root.querySelector("#biblio-feedback"),
    nextButton: root.querySelector("#biblio-nextButton"),
    statsGrid: root.querySelector("#biblio-statsGrid"),
    statsAside: root.querySelector("#biblio-statsAside"),
    limitSummary: root.querySelector("#biblio-limitSummary"),
    settingsTabButton: root.querySelector("#biblio-settingsTabButton"),
  };

  const state = {
    entries: [],
    entriesByPos: new Map(),
    synonymsData: {},
    mode: "definitions",
    current: null,
  };

  init();

  async function init() {
    await loadData();
    bindEvents();
    setMode("definitions");
  }

  function bindEvents() {
    elements.modeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const mode = button.dataset.mode;
        if (mode === "settings") {
          toggleSettings();
        } else {
          setMode(mode);
        }
      });
    });

    elements.reviewMastered.addEventListener("change", () => {
      const modeState = getModeState(state.mode);
      modeState.reviewMastered = elements.reviewMastered.checked;
      saveModeState(state.mode, modeState);
      renderQuestion();
    });

    elements.resetMode.addEventListener("click", () => {
      const confirmed = window.confirm("Are you sure you want to reset?");
      if (!confirmed) {
        return;
      }
      localStorage.removeItem(getStorageKey(state.mode));
      setMode(state.mode);
    });

    elements.saveData.addEventListener("click", () => {
      downloadUserData();
    });

    elements.loadData.addEventListener("click", () => {
      elements.loadInput.click();
    });

    elements.loadInput.addEventListener("change", (event) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }
      readUserData(file);
      event.target.value = "";
    });

    elements.nextButton.addEventListener("click", () => {
      renderQuestion();
    });
  }

  async function loadData() {
    const lettersToTry = "abcdefghijklmnopqrstuvwxyz".split("");
    const definitionsData = await loadDefinitionsByLetters(lettersToTry);
    const words = definitionsData;

    const letters = getLettersFromWords(words);
    const synonymsData = await loadSynonymsByLetters(letters);

    state.synonymsData = synonymsData || {};
    state.entries = Object.entries(words)
      .filter(([word, data]) => word && data && Array.isArray(data.def) && data.def.length > 0)
      .map(([word, data]) => {
        const firstDef = data.def[0];
        return {
          word: word.trim(),
          definitions: data.def || [],
          definition: firstDef?.definition || "",
          pos: normalizePos(firstDef?.type || ""),
          rawType: firstDef?.type || "",
          forms: data.forms || [],
        };
      });

    state.entriesByPos = state.entries.reduce((map, entry) => {
      if (!map.has(entry.pos)) {
        map.set(entry.pos, []);
      }
      map.get(entry.pos).push(entry);
      return map;
    }, new Map());
  }

  function getLettersFromWords(words) {
    const letters = new Set();
    Object.keys(words).forEach((word) => {
      const letter = window.SharedPronunciation.getWordLetter(word);
      if (letter) {
        letters.add(letter);
      }
    });
    return Array.from(letters).sort();
  }

  async function loadDefinitionsByLetters(letters) {
    const requests = letters.map((letter) =>
      fetch(`${DEFINITIONS_DIR}/${letter}.json`)
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({}))
    );

    const results = await Promise.all(requests);
    return Object.assign({}, ...results);
  }

  async function loadSynonymsByLetters(letters) {
    const requests = letters.map((letter) =>
      fetch(`${SYNONYMS_DIR}/${letter}.json`)
        .then((response) => (response.ok ? response.json() : {}))
        .catch(() => ({}))
    );

    const results = await Promise.all(requests);
    return results.reduce((acc, data) => Object.assign(acc, data), {});
  }

  function setMode(mode) {
    state.mode = mode;
    elements.modeButtons.forEach((button) => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });

    elements.settingsPanel.setAttribute("hidden", "");
    elements.questionCard.style.display = "";
    elements.statsAside.style.display = "";
    elements.resetMode.style.display = "";

    const modeState = getModeState(mode);
    elements.reviewMastered.checked = Boolean(modeState.reviewMastered);
    elements.modeCapsule.textContent = MODES[mode].label;
    renderQuestion();
  }

  function toggleSettings() {
    const isHidden = elements.settingsPanel.hasAttribute("hidden");
    if (isHidden) {
      elements.settingsPanel.removeAttribute("hidden");
      elements.questionCard.style.display = "none";
      elements.statsAside.style.display = "none";
      elements.resetMode.style.display = "none";
      elements.modeButtons.forEach((button) => {
        if (button.dataset.mode !== "settings") {
          button.classList.remove("active");
        } else {
          button.classList.add("active");
        }
      });
    } else {
      elements.settingsPanel.setAttribute("hidden", "");
      elements.questionCard.style.display = "";
      elements.statsAside.style.display = "";
      elements.resetMode.style.display = "";
      elements.modeButtons.forEach((button) => {
        button.classList.remove("active");
      });
      setMode(state.mode);
    }
  }

  function renderQuestion() {
    const modeState = getModeState(state.mode);
    const selection = selectWordForMode(state.mode, modeState);

    if (selection && selection.special) {
      elements.questionMeta.textContent = MODES[state.mode].label;
      elements.questionTitle.textContent = "";
      elements.options.innerHTML = "";
      elements.answerDetails.classList.remove("visible");
      elements.questionCard.classList.remove("correct", "incorrect");
      elements.nextButton.disabled = true;

      if (selection.special === "no-mastered") {
        elements.questionPrompt.textContent = "No mastered words to review.";
      } else if (selection.special === "not-enough-mastered") {
        elements.questionPrompt.textContent = "Not enough mastered words to review.";
      }

      updateStats(
        modeState,
        selection.eligible || [],
        selection.trackedCount || 0,
        selection.masteredCount || 0
      );
      return;
    }

    if (!selection) {
      elements.questionMeta.textContent = "No words available";
      elements.questionTitle.textContent = "";
      elements.questionPrompt.textContent = "";
      elements.options.innerHTML = "";
      elements.feedback.textContent = "";
      elements.nextButton.disabled = true;
      updateStats(modeState, [], 0, 0);
      return;
    }

    state.current = selection;
    const { entry, question } = selection;

    elements.questionMeta.textContent = MODES[state.mode].label;
    elements.questionTitle.textContent =
      state.mode === "fitb" ? "Complete the sentence" : entry.word;
    window.SharedUtils.applyRainbowText(elements.questionTitle);
    elements.questionPrompt.textContent = question.prompt;
    window.SharedUtils.applyRainbowText(elements.questionPrompt);
    elements.feedback.textContent = "";
    elements.nextButton.disabled = true;
    elements.answerDetails.classList.remove("visible");
    elements.questionCard.classList.remove("correct", "incorrect");

    renderOptions(question.options, entry, modeState);
    updateStats(modeState, selection.eligible, selection.trackedCount, selection.masteredCount);
  }

  function renderOptions(options, entry, modeState) {
    elements.options.innerHTML = "";

    options.forEach((option) => {
      const button = document.createElement("button");
      button.className = "option-button";
      button.textContent = option.text;
      window.SharedUtils.applyRainbowText(button);
      button.dataset.correct = option.isCorrect ? "true" : "false";
      button.addEventListener("click", () => {
        handleAnswer(button, option.isCorrect, entry, modeState);
      });
      elements.options.appendChild(button);
    });
  }

  function handleAnswer(button, isCorrect, entry, modeState) {
    updateScore(entry.word, isCorrect, modeState);
    const resultLabel = isCorrect ? "Correct" : "Incorrect";

    elements.feedback.textContent = resultLabel;
    elements.nextButton.disabled = false;
    elements.questionCard.classList.add(isCorrect ? "correct" : "incorrect");

    Array.from(elements.options.children).forEach((child) => {
      child.disabled = true;
      const isCorrectOption = child.dataset.correct === "true";
      if (isCorrectOption) {
        child.classList.add("correct");
      }
      if (child === button && !isCorrect) {
        child.classList.add("incorrect");
      }
    });

    renderAnswerDetails(entry);
    elements.answerDetails.classList.add("visible");

    saveModeState(state.mode, modeState);
    updateStats(
      modeState,
      getEligibleEntries(state.mode),
      countTrackedNonMastered(modeState, state.mode),
      countMastered(modeState, state.mode)
    );
  }

  function updateScore(word, isCorrect, modeState) {
    if (modeState.scores[word] === undefined) {
      modeState.scores[word] = 0;
    }

    modeState.scores[word] += isCorrect ? 1 : -1;
    modeState.lastSeen[word] = Date.now();
    return modeState.scores[word];
  }

  function selectWordForMode(mode, modeState) {
    const eligible = getEligibleEntries(mode);
    const tracked = eligible.filter((entry) => isTrackedNonMastered(entry.word, modeState));
    const mastered = eligible.filter((entry) => isMastered(entry.word, modeState));
    const unencountered = eligible.filter((entry) => modeState.scores[entry.word] === undefined);

    const capReached = tracked.length >= MAX_ACTIVE_NON_MASTERED;

    if (modeState.reviewMastered) {
      if (mastered.length === 0) {
        return { special: "no-mastered" };
      }
      if (mastered.length < 10) {
        return { special: "not-enough-mastered", count: mastered.length };
      }
      const entry = mastered[Math.floor(Math.random() * mastered.length)];
      const question = buildQuestion(mode, entry);
      if (!question) {
        return null;
      }

      elements.capNotice.textContent = capReached
        ? "Cap reached: new words paused"
        : "";

      return {
        entry,
        question,
        eligible,
        trackedCount: tracked.length,
        masteredCount: mastered.length,
      };
    }

    let pool = capReached ? tracked.slice() : tracked.concat(unencountered);

    if (pool.length === 0) {
      return null;
    }

    const entry = pool[Math.floor(Math.random() * pool.length)];
    const question = buildQuestion(mode, entry);
    if (!question) {
      return null;
    }

    elements.capNotice.textContent = capReached
      ? "Cap reached: new words paused"
      : "";

    return {
      entry,
      question,
      eligible,
      trackedCount: tracked.length,
      masteredCount: mastered.length,
    };
  }

  function buildQuestion(mode, entry) {
    if (mode === "definitions") {
      return buildDefinitionQuestion(entry);
    }
    if (mode === "synonyms") {
      return buildSynonymQuestion(entry);
    }
    return buildFitbQuestion(entry);
  }

  function buildDefinitionQuestion(entry) {
    const samePos = state.entriesByPos.get(entry.pos) || [];
    const correctDef = entry.definitions[Math.floor(Math.random() * entry.definitions.length)];
    const correctText = correctDef?.definition || "";

    const defPool = samePos.flatMap((item) => item.definitions.map((def) => def.definition));

    const options = buildUniqueOptions(correctText, defPool, 5);

    return {
      prompt: MODES.definitions.prompt,
      options: window.SharedUtils.shuffle(options).map((text) => ({
        text,
        isCorrect: text === correctText,
      })),
    };
  }

  function buildSynonymQuestion(entry) {
    const data = state.synonymsData[entry.word];
    const synonyms = data?.synonyms || [];
    if (synonyms.length === 0) {
      return null;
    }

    const correct = synonyms[Math.floor(Math.random() * synonyms.length)];
    const samePosEntries = state.entriesByPos.get(entry.pos) || [];
    const distractorWords = samePosEntries
      .map((item) => item.word)
      .filter((word) => word !== entry.word && word !== correct && !synonyms.includes(word));

    const options = buildUniqueOptions(correct, distractorWords, 5);

    return {
      prompt: MODES.synonyms.prompt,
      options: window.SharedUtils.shuffle(options).map((text) => ({
        text,
        isCorrect: text === correct,
      })),
    };
  }

  function buildFitbQuestion(entry) {
    const data = state.synonymsData[entry.word];
    const sentences = data?.sentences || [];
    if (sentences.length === 0) {
      return null;
    }

    const sentence = sentences[Math.floor(Math.random() * sentences.length)];
    const blanked = blankSentence(sentence, entry.word, entry.forms);
    const samePosEntries = state.entriesByPos.get(entry.pos) || [];
    const distractors = samePosEntries
      .map((item) => item.word)
      .filter((word) => word !== entry.word);

    const options = buildUniqueOptions(entry.word, distractors, 5);

    return {
      prompt: blanked,
      options: window.SharedUtils.shuffle(options).map((text) => ({
        text,
        isCorrect: text === entry.word,
      })),
    };
  }

  function buildUniqueOptions(correct, pool, count) {
    const unique = new Set();
    unique.add(correct);

    const shuffled = window.SharedUtils.shuffle(pool.slice());
    for (const item of shuffled) {
      if (unique.size >= count) {
        break;
      }
      if (!unique.has(item)) {
        unique.add(item);
      }
    }

    return Array.from(unique).slice(0, count);
  }

  function updateStats(modeState, eligible, trackedCount, masteredCount) {
    const counts = countCategories(modeState, eligible);
    const rows = Object.keys(categoryLabels).map((key) => {
      const count = counts[key] || 0;
      return `<div class="stats-row stats-${key}"><span>${categoryLabels[key]}</span><span>${count}</span></div>`;
    });
    elements.statsGrid.innerHTML = rows.join("");

    elements.limitSummary.textContent = `Active non-mastered: ${trackedCount}/${MAX_ACTIVE_NON_MASTERED}. Mastered: ${masteredCount}.`;
  }

  function renderAnswerDetails(entry) {
    const data = state.synonymsData[entry.word] || {};
    const synonyms = Array.isArray(data.synonyms) ? data.synonyms : [];
    const sentences = Array.isArray(data.sentences) ? data.sentences : [];
    const limitedSynonyms = window.SharedUtils.pickRandomSubset(synonyms, 10);
    const limitedSentences = window.SharedUtils.pickRandomSubset(sentences, 10);

    elements.detailWord.textContent = entry.word;

    const definitionsList = elements.detailDefinitions;
    definitionsList.innerHTML = "";
    const definitions = Array.isArray(entry.definitions) ? entry.definitions : [];

    if (definitions.length > 0) {
      const groupedDefs = {};
      definitions.forEach((def) => {
        const pos = def.type || "Other";
        if (!groupedDefs[pos]) {
          groupedDefs[pos] = [];
        }
        groupedDefs[pos].push(def.definition || "");
      });

      Object.entries(groupedDefs).forEach(([pos, defs]) => {
        const groupDiv = document.createElement("div");
        groupDiv.style.marginBottom = "1em";

        const posHeader = document.createElement("p");
        posHeader.style.fontWeight = "bold";
        posHeader.style.marginBottom = "0.25em";
        posHeader.textContent = pos;
        groupDiv.appendChild(posHeader);

        const ol = document.createElement("ol");
        ol.style.margin = "0";
        ol.style.paddingLeft = "0";
        ol.style.listStylePosition = "inside";
        defs.forEach((defText) => {
          const li = document.createElement("li");
          li.textContent = defText;
          ol.appendChild(li);
        });

        groupDiv.appendChild(ol);
        definitionsList.appendChild(groupDiv);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = entry.definition || "No definition available.";
      definitionsList.appendChild(li);
    }

    loadAndRenderPronunciations(entry.word);

    fillList(elements.detailSynonyms, limitedSynonyms, "No synonyms available.");
    fillList(elements.detailSentences, limitedSentences, "No example sentences available.");
  }

  async function loadAndRenderPronunciations(word) {
    const letter = window.SharedPronunciation.getWordLetter(word);
    if (!letter) {
      elements.detailPronunciation.innerHTML =
        '<p class="pronunciation-empty">No pronunciation available.</p>';
      return;
    }

    const pronunciationsData = await window.SharedPronunciation.loadPronunciationsForLetter(letter);
    const wordPronunciations = pronunciationsData[word];

    if (!wordPronunciations || !Array.isArray(wordPronunciations.pronunciations)) {
      elements.detailPronunciation.innerHTML =
        '<p class="pronunciation-empty">No pronunciation available.</p>';
      return;
    }

    elements.detailPronunciation.innerHTML = "";
    wordPronunciations.pronunciations.forEach((pron, index) => {
      const div = document.createElement("div");
      div.className = "pronunciation-item";

      const syllablesSpan = document.createElement("span");
      syllablesSpan.className = "pronunciation-text";
      syllablesSpan.textContent = pron.syllables || "";

      div.appendChild(syllablesSpan);

      if (pron.audio) {
        const audioBtn = document.createElement("button");
        audioBtn.className = "audio-btn";
        audioBtn.setAttribute("aria-label", `Play pronunciation ${index + 1}`);
        audioBtn.innerHTML = "🔊";
        audioBtn.addEventListener("click", () => window.SharedPronunciation.playAudio(pron.audio));
        div.appendChild(audioBtn);
      }

      elements.detailPronunciation.appendChild(div);
    });
  }

  function fillList(listEl, items, emptyMessage) {
    listEl.innerHTML = "";
    if (!items || items.length === 0) {
      const item = document.createElement("li");
      item.textContent = emptyMessage;
      listEl.appendChild(item);
      return;
    }

    items.forEach((value) => {
      const item = document.createElement("li");
      item.textContent = value;
      listEl.appendChild(item);
    });
  }

  function countCategories(modeState, eligible) {
    return eligible.reduce((acc, entry) => {
      const score = modeState.scores[entry.word];
      const category = getCategory(score);
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
  }

  function countTrackedNonMastered(modeState, mode) {
    return getEligibleEntries(mode).filter((entry) => isTrackedNonMastered(entry.word, modeState)).length;
  }

  function countMastered(modeState, mode) {
    return getEligibleEntries(mode).filter((entry) => isMastered(entry.word, modeState)).length;
  }

  function getEligibleEntries(mode) {
    if (mode === "definitions") {
      return state.entries;
    }

    if (mode === "synonyms") {
      return state.entries.filter((entry) => {
        const data = state.synonymsData[entry.word];
        return Array.isArray(data?.synonyms) && data.synonyms.length > 0;
      });
    }

    return state.entries.filter((entry) => {
      const data = state.synonymsData[entry.word];
      return Array.isArray(data?.sentences) && data.sentences.length > 0;
    });
  }

  function isTrackedNonMastered(word, modeState) {
    const score = modeState.scores[word];
    return score !== undefined && score <= 10;
  }

  function isMastered(word, modeState) {
    const score = modeState.scores[word];
    return score !== undefined && score > 10;
  }

  function getCategory(score) {
    if (score === undefined) {
      return "not-encountered";
    }
    if (score < 0) {
      return "work-needed";
    }
    if (score <= 2) {
      return "keep-trying";
    }
    if (score <= 5) {
      return "getting-there";
    }
    if (score <= 10) {
      return "nearly-mastered";
    }
    return "mastered";
  }

  function getModeState(mode) {
    const stored = localStorage.getItem(getStorageKey(mode));
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        scores: parsed.scores || {},
        lastSeen: parsed.lastSeen || {},
        reviewMastered: parsed.reviewMastered || false,
      };
    }
    return { scores: {}, lastSeen: {}, reviewMastered: false };
  }

  function saveModeState(mode, modeState) {
    localStorage.setItem(getStorageKey(mode), JSON.stringify(modeState));
  }

  function getStorageKey(mode) {
    return `${STORAGE_PREFIX}.${mode}`;
  }

  function downloadUserData() {
    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      data: collectUserData(),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `biblioBuddy-data-${payload.savedAt.slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function collectUserData() {
    const data = {};
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        data[key] = localStorage.getItem(key);
      }
    });
    return data;
  }

  function readUserData(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        const stored = payload?.data || {};
        Object.entries(stored).forEach(([key, value]) => {
          if (key.startsWith(STORAGE_PREFIX) && typeof value === "string") {
            localStorage.setItem(key, value);
          }
        });
        setMode(state.mode);
      } catch (error) {
        console.error("Failed to load user data:", error);
      }
    };
    reader.readAsText(file);
  }

  function normalizePos(type) {
    const value = String(type).toLowerCase();
    if (value.includes("v.")) return "verb";
    if (value.includes("n.")) return "noun";
    if (value.includes("adj.")) return "adj";
    if (value.includes("adv.")) return "adv";
    return "other";
  }

  function blankSentence(sentence, word, forms = []) {
    const wordsToCheck = [word, ...(forms || [])];

    for (const wordToCheck of wordsToCheck) {
      const escaped = window.SharedUtils.escapeRegExp(wordToCheck);
      const regex = new RegExp(`\\b${escaped}(?:['']s|s)?\\b`, "i");
      if (regex.test(sentence)) {
        return sentence.replace(regex, "____");
      }
    }

    return `${sentence} ____`;
  }

  // Expose reset/stats helpers for the host page to call.
  window.BiblioBuddyMode = {
    getStatsSnapshot() {
      const modeState = getModeState(state.mode);
      const eligible = getEligibleEntries(state.mode);
      return {
        mode: state.mode,
        modeLabel: MODES[state.mode].label,
        counts: countCategories(modeState, eligible),
        trackedCount: countTrackedNonMastered(modeState, state.mode),
        masteredCount: countMastered(modeState, state.mode),
      };
    },
  };
})();