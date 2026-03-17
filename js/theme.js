/**
 * Theme system for the EPUB reader.
 * Mirrors: SettingsSideBar.vue theme section + EpubConstants.js THEMES
 *
 * Before (EPub.js): rendition.themes.register(name, cssObj); rendition.themes.select(name)
 * After (foliate-js): inject CSS into each section's Document via the 'load' event
 */

import { state, saveSettings } from './state.js'
import { THEMES } from './constants.js'
import { logEvent } from './logger.js'

/**
 * Generate a CSS string for the given reader theme.
 * This CSS is injected into each EPUB section document.
 */
export function getThemeCSS(theme) {
  return `
    html, body {
      background-color: ${theme.bg} !important;
      color: ${theme.text} !important;
    }
    p, li, blockquote, dd {
      color: ${theme.text} !important;
      line-height: 1.4em !important;
    }
    h1, h2, h3, h4, h5, h6 { color: ${theme.text} !important; }
    p:first-of-type::first-letter { color: ${theme.text} !important; }
    img, video { max-width: 100%; }
  `
}

/**
 * Inject theme CSS into a section document.
 * Called on every 'load' event from foliate-view.
 * @param {Document} doc - The section's Document object.
 */
export function injectThemeCSS(doc) {
  const existing = doc.getElementById('kolibri-theme')
  if (existing) existing.remove()
  const style = doc.createElement('style')
  style.id = 'kolibri-theme'
  style.textContent = getThemeCSS(state.theme || THEMES.WHITE)
  doc.head?.appendChild(style)
}

/**
 * Apply a theme: persist it, update button UI, and log the change.
 * Re-injection into loaded sections happens via the 'load' event handler.
 * @param {Object} theme - One of the THEMES entries.
 */
export function applyTheme(theme) {
  state.theme = theme
  saveSettings({ theme })

  // Update theme button UI
  document.querySelectorAll('.theme-btn').forEach(btn => {
    const isSelected = btn.id === `theme-${theme.name.toLowerCase()}`
    btn.classList.toggle('selected', isSelected)
    btn.setAttribute('aria-pressed', String(isSelected))
  })

  logEvent('theme', theme.name)
}
