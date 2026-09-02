// Shared utility helpers used across modes.

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function pickRandomSubset(items, maxCount) {
  if (!Array.isArray(items) || items.length <= maxCount) {
    return items || [];
  }
  return shuffle(items.slice()).slice(0, maxCount);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// Decorative rainbow coloring applied to text mentioning "biblio".
function applyRainbowText(element) {
  if (!element || element.closest("h1") || element.closest("title")) {
    return;
  }

  const textNodes = [];
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode);
  }

  textNodes.forEach((node) => {
    const value = node.textContent || "";
    const matches = [...value.matchAll(/biblio/gi)];

    if (!matches.length) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const colors = ["#ff4d4d", "#ff8a3d", "#f7c948", "#53d769", "#4ca3ff", "#5b4dff"];
    let lastIndex = 0;

    matches.forEach((match) => {
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(value.slice(lastIndex, start)));
      }

      Array.from(match[0]).forEach((char, index) => {
        const span = document.createElement("span");
        span.textContent = char;
        span.style.color = colors[index % colors.length];
        span.style.fontWeight = "700";
        fragment.appendChild(span);
      });

      lastIndex = end;
    });

    if (lastIndex < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
    }

    node.replaceWith(fragment);
  });
}

// Decorative rainbow coloring for the static page chrome.
// Uses CSS class (.biblio-rainbow) so the color sequence is consistent.
function recolorBiblioText(root) {
  const rainbowColors = ["#ff4d4d", "#ff8a3d", "#f7c948", "#53d769", "#4ca3ff", "#5b4dff"];

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodesToReplace = [];

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.textContent || !/biblio/gi.test(node.textContent)) {
      continue;
    }

    const parent = node.parentElement;
    if (!parent || parent.closest("h1") || parent.closest("title") || parent.closest(".biblio-rainbow")) {
      continue;
    }

    nodesToReplace.push(node);
  }

  nodesToReplace.forEach((node) => {
    const fragment = document.createDocumentFragment();
    const value = node.textContent;
    let lastIndex = 0;
    const regex = /biblio/gi;

    for (const match of value.matchAll(regex)) {
      const start = match.index;
      const end = start + match[0].length;

      if (start > lastIndex) {
        fragment.appendChild(document.createTextNode(value.slice(lastIndex, start)));
      }

      Array.from(match[0]).forEach((char, index) => {
        const span = document.createElement("span");
        span.textContent = char;
        span.className = "biblio-rainbow";
        span.style.color = rainbowColors[index % rainbowColors.length];
        fragment.appendChild(span);
      });

      lastIndex = end;
    }

    if (lastIndex < value.length) {
      fragment.appendChild(document.createTextNode(value.slice(lastIndex)));
    }

    node.replaceWith(fragment);
  });
}

window.SharedUtils = {
  shuffle,
  escapeHtml,
  escapeRegExp,
  normalizeText,
  pickRandom,
  pickRandomSubset,
  parseCsv,
  applyRainbowText,
  recolorBiblioText,
};