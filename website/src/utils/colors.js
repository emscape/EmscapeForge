// Default color if language not found
const DEFAULT_COLOR = '#6c757d'; // Gray

// Map language names (lowercase) to hex color codes
const LANGUAGE_COLORS = {
  javascript: '#f1e05a', // Yellow
  typescript: '#3178c6', // Blue
  python: '#3572A5', // Blue
  html: '#e34c26', // Orange
  css: '#563d7c', // Purple
  scss: '#c6538c', // Pink
  astro: '#ff5a00', // Orange (Astro's brand color)
  shell: '#89e051', // Green
  powershell: '#012456', // Dark Blue
  go: '#00ADD8', // Cyan
  rust: '#dea584', // Brownish
  java: '#b07219', // Brown
  csharp: '#178600', // Green
  cpp: '#f34b7d', // Pink
  php: '#4F5D95', // Indigo
};

/**
 * Gets a color code for a given programming language.
 * @param {string | null | undefined} language The programming language name.
 * @returns {string} The hex color code.
 */
export function getLanguageColor(language) {
  if (!language) {
    return DEFAULT_COLOR;
  }
  const langLower = language.toLowerCase();
  return LANGUAGE_COLORS[langLower] || DEFAULT_COLOR;
}