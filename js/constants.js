/**
 * Constants for the Kolibri EPub Viewer prototype.
 * Mirrors: kolibri/plugins/epub_viewer/assets/src/views/EpubConstants.js
 */

// localStorage key - same as the current plugin's Lockr usage
export const SETTINGS_KEY = 'kolibriEpubRendererSettings'

// Font size bounds (mirrors decreaseFontSizeDisabled / increaseFontSizeDisabled)
export const FONT_SIZE_MIN = 8
export const FONT_SIZE_MAX = 32
export const FONT_SIZE_STEP = 4

/**
 * Reader themes - hardcoded deliberately.
 * In EpubConstants.js the comment reads:
 *   "colors are hardcoded deliberately since Epub Reader themes
 *    are meant to be independent of Kolibri themes"
 * Only the chrome UI (TopBar, BottomBar) uses $themeTokens.
 */
export const THEMES = {
  WHITE:  { name: 'WHITE',  bg: '#ffffff', text: '#212121' },
  BEIGE:  { name: 'BEIGE',  bg: '#efebe9', text: '#4e342e' },
  GREY:   { name: 'GREY',   bg: '#424242', text: '#ffffff' },
  BLACK:  { name: 'BLACK',  bg: '#212121', text: '#bdbdbd' },
  YELLOW: { name: 'YELLOW', bg: '#212121', text: '#fff176' },
  BLUE:   { name: 'BLUE',   bg: '#ffffff', text: '#1565c0' },
}
