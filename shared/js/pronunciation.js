// Shared data helpers used by modes that need pronunciation playback.

function getWordLetter(word) {
  const match = String(word || "").match(/[a-z]/i);
  return match ? match[0].toLowerCase() : null;
}

async function loadPronunciationsForLetter(letter) {
  if (!letter) {
    return {};
  }
  try {
    const response = await fetch(`pronunciations/${letter}.json`);
    if (!response.ok) {
      return {};
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to load pronunciations for ${letter}:`, error);
    return {};
  }
}

function playAudio(url) {
  const audio = new Audio(url);
  audio.play().catch((error) => {
    console.error("Failed to play audio:", error);
  });
}

window.SharedPronunciation = {
  getWordLetter,
  loadPronunciationsForLetter,
  playAudio,
};