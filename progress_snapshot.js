// Progress Snapshot page: browse words by category and revisit any word card.
// Reuses utilities shared with the main modes via window.SharedUtils and
// window.SharedPronunciation.

const DEFINITIONS_DIR = "definitions";
const SYNONYMS_DIR = "synonyms";
const STORAGE_PREFIX = "biblioBuddy.v1";

const MODES = {
  definitions: {
    label: "Definitions",
  },
  synonyms: {
    label: "Synonyms",
  },
  fitb: {
    label: "Fill in the Blank",
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

const elements = {
  modeButtons: Array.from(document.querySelectorAll(".mode-button")),
  modeCapsule: document.getElementById("modeCapsule"),
  categoryColumn: document.getElementById("categoryColumn"),
  cardWord: document.getElementById("cardWord"),
  cardDefinitions: document.getElementById("cardDefinitions"),
  cardPronunciation: document.getElementById("cardPronunciation"),
  cardSynonyms: document.getElementById("cardSynonyms"),
  cardSentences: document.getElementById("cardSentences"),
};

const state = {
  entries: [],
  entryMap: new Map(),
  synonymsData: {},
  mode: "definitions",
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
      setMode(button.dataset.mode);
    });
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

  state.entryMap = state.entries.reduce((map, entry) => {
    map.set(entry.word, entry);
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
  elements.modeCapsule.textContent = MODES[mode].label;
  renderCategories();
}

function renderCategories() {
  const modeState = getModeState(state.mode);
  const eligible = getEligibleEntries(state.mode);
  const categories = Object.keys(categoryLabels).reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {});

  eligible.forEach((entry) => {
    const score = modeState.scores[entry.word];
    const category = getCategory(score);
    categories[category].push(entry.word);
  });

  elements.categoryColumn.innerHTML = "";
  Object.entries(categories).forEach(([key, words]) => {
    const details = document.createElement("details");
    details.className = "category-block";
    details.open = key === "work-needed";

    details.addEventListener("toggle", () => {
      if (!details.open) {
        renderWordCard(null);
      }
    });

    const summary = document.createElement("summary");
    summary.textContent = `${categoryLabels[key]} (${words.length})`;
    details.appendChild(summary);

    const list = document.createElement("ul");
    list.className = "word-list";

    words.sort().forEach((word) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.className = "word-chip";
      button.textContent = word;
      button.addEventListener("click", () => {
        renderWordCard(word);
      });
      item.appendChild(button);
      list.appendChild(item);
    });

    details.appendChild(list);
    elements.categoryColumn.appendChild(details);
  });
}

function renderWordCard(word) {
  if (!word) {
    elements.cardWord.textContent = "Select a word";
    elements.cardDefinitions.innerHTML = "";
    elements.cardPronunciation.innerHTML = "";
    fillList(elements.cardSynonyms, [], "");
    fillList(elements.cardSentences, [], "");
    return;
  }

  const entry = state.entryMap.get(word);
  if (!entry) {
    return;
  }
  const data = state.synonymsData[word] || {};
  const synonyms = Array.isArray(data.synonyms) ? data.synonyms : [];
  const sentences = Array.isArray(data.sentences) ? data.sentences : [];

  elements.cardWord.textContent = entry.word;
  renderDefinitionsList(elements.cardDefinitions, entry.definitions, entry.definition);
  loadAndRenderPronunciations(entry.word);
  fillList(elements.cardSynonyms, window.SharedUtils.pickRandomSubset(synonyms, 10), "No synonyms available.");
  fillList(elements.cardSentences, window.SharedUtils.pickRandomSubset(sentences, 10), "No example sentences available.");
}

function renderDefinitionsList(listEl, definitions, fallbackDefinition) {
  listEl.innerHTML = "";
  const items = Array.isArray(definitions) ? definitions : [];

  if (items.length > 0) {
    const groupedDefs = {};
    items.forEach((def) => {
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
      listEl.appendChild(groupDiv);
    });
    return;
  }

  const item = document.createElement("li");
  item.textContent = fallbackDefinition || "No definition available.";
  listEl.appendChild(item);
}

async function loadAndRenderPronunciations(word) {
  const letter = window.SharedPronunciation.getWordLetter(word);
  if (!letter) {
    elements.cardPronunciation.innerHTML =
      '<p class="pronunciation-empty">No pronunciation available.</p>';
    return;
  }

  const pronunciationsData = await window.SharedPronunciation.loadPronunciationsForLetter(letter);
  const wordPronunciations = pronunciationsData[word];

  if (!wordPronunciations || !Array.isArray(wordPronunciations.pronunciations)) {
    elements.cardPronunciation.innerHTML =
      '<p class="pronunciation-empty">No pronunciation available.</p>';
    return;
  }

  elements.cardPronunciation.innerHTML = "";
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

    elements.cardPronunciation.appendChild(div);
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

function getStorageKey(mode) {
  return `${STORAGE_PREFIX}.${mode}`;
}

function normalizePos(type) {
  const value = String(type).toLowerCase();
  if (value.includes("v.")) return "verb";
  if (value.includes("n.")) return "noun";
  if (value.includes("adj.")) return "adj";
  if (value.includes("adv.")) return "adv";
  return "other";
}