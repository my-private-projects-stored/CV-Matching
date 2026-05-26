/**
 * Detect language of a given text.
 * Checks for character patterns unique to Vietnamese diacritics.
 * Returns 'vi' if detected, otherwise fallback ('en').
 *
 * @param {string} text - The input text to check
 * @param {string} fallback - The fallback language if no Vietnamese is detected (default: 'en')
 * @returns {string} The detected language locale code ('vi' or 'en')
 */
export function detectLanguageOfText(text, fallback = "en") {
  if (!text || typeof text !== "string") {
    return fallback;
  }

  // Vietnamese specific accented characters pattern
  const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  
  return vietnamesePattern.test(text) ? "vi" : fallback;
}

/**
 * Detect language of a CV / Resume JSON.
 * Traverses common text fields in the CV.
 *
 * @param {Object} resumeJson - The resume JSON data
 * @param {string} fallback - The fallback language
 * @returns {string} The detected language locale code ('vi' or 'en')
 */
export function detectLanguageOfResume(resumeJson, fallback = "en") {
  if (!resumeJson) {
    return fallback;
  }

  try {
    // Stringify the entire object to perform a global search of text content.
    // This is simple, fast, and covers all sections (experience, summary, education, etc.)
    const textContent = JSON.stringify(resumeJson);
    return detectLanguageOfText(textContent, fallback);
  } catch (error) {
    return fallback;
  }
}
