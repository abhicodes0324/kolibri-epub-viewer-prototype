/**
 * Theme system for the EPUB reader.
 * Mirrors: SettingsSideBar.vue theme section + EpubConstants.js THEMES
 *
 * Before (EPub.js): rendition.themes.register(name, cssObj); rendition.themes.select(name)
 * After (foliate-js): inject CSS into each section's Document via the 'load' event
 */

import { state, saveSettings } from './state.js'
import { logEvent } from './logger.js'

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
