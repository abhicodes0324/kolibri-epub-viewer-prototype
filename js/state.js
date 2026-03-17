/**
 * State management & settings persistence.
 * Mirrors: Vue reactive state (ref()) + Lockr get/set in EpubRendererIndex.vue
 *
 * In the actual Kolibri plugin, settings are stored via Lockr.
 * This module uses localStorage with the same key for compatibility.
 */

import { SETTINGS_KEY, THEMES } from './constants.js'

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
  } catch { return {} }
}

/**
 * Module-level state object.
 * Equivalent to Vue ref() reactive state in EpubRendererIndex.vue.
 * Restored settings are spread in so persisted values survive page reloads.
 */
export const state = {
  loaded: false,
  errorLoading: false,
  tocOpen: true,
  settingsOpen: false,
  fontSize: null,
  theme: THEMES.WHITE,
  fraction: 0,
  tocItem: null,
  flow: 'paginated',
  lastCFI: null,
  savedLocation: null,
  ...loadSettings(),
}

/**
 * Persist settings to localStorage and update in-memory state.
 * Replaces Lockr.set() calls in the current plugin.
 */
export function saveSettings(updates) {
  const saved = loadSettings()
  const merged = { ...saved, ...updates }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged))
  Object.assign(state, updates)
}
