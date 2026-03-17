/**
 * Main entry point - wires everything together.
 * Mirrors: setup() in EpubRendererIndex.vue (Vue Composition API)
 *
 * Architecture mapping:
 *   constants.js       → EpubConstants.js
 *   state.js           → Vue ref() reactive state + Lockr
 *   toc.js             → TableOfContentsSideBar.vue
 *   theme.js           → SettingsSideBar.vue (theme section)
 *   epub-controller.js → EpubRendererIndex.vue (core logic)
 *   main.js            → setup() lifecycle + event wiring
 */

import '../lib/view.js'
import { THEMES, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from './constants.js'
import { state, saveSettings } from './state.js'
import { initLogger, logEvent } from './logger.js'
import { applyTheme } from './theme.js'
import { openBook, setupViewEvents, applyFontSize, cleanup } from './epub-controller.js'

// ── DOM refs (equivalent to Vue template refs) ────────────────────────
const dom = {
  view:       document.getElementById('epub-view'),
  prevBtn:    document.getElementById('prev-btn'),
  nextBtn:    document.getElementById('next-btn'),
  slider:     document.getElementById('progress-slider'),
  pctEl:      document.getElementById('progress-pct'),
  titleEl:    document.getElementById('top-bar-title'),
  sectionEl:  document.getElementById('section-title'),
  loadingEl:  document.getElementById('loading-state'),
  errorEl:    document.getElementById('error-state'),
  errorMsg:   document.getElementById('error-msg'),
  dropEl:     document.getElementById('drop-state'),
  tocSidebar: document.getElementById('toc-sidebar'),
  tocList:    document.getElementById('toc-list'),
  settingsEl: document.getElementById('settings-sidebar'),
  tocBtn:     document.getElementById('toc-btn'),
  settBtn:    document.getElementById('settings-btn'),
}

// ── Initialize event logger (demo-only) ──────────────────────────────
initLogger(document.getElementById('event-log'))

// ── Setup foliate-js view events ─────────────────────────────────────
setupViewEvents(dom.view, dom)

// ── Progress slider ──────────────────────────────────────────────────
// Mirrors handleSliderChanged in EpubRendererIndex.vue
// Before: this.locations[Math.floor((locations.length-1) * (val/100))]
// After: view.goToFraction(val) - direct, no locations array needed
dom.slider.addEventListener('input', async () => {
  const frac = parseFloat(dom.slider.value)
  try {
    await dom.view.goToFraction(frac)
    logEvent('goToFraction', `${(frac * 100).toFixed(1)}%`)
  } catch { /* noop */ }
})

// ── Navigation buttons (mirrors PreviousButton.vue / NextButton.vue) ─
dom.prevBtn.addEventListener('click', async () => {
  try { await dom.view.prev(); logEvent('prev', '←') } catch { /* noop */ }
})

dom.nextBtn.addEventListener('click', async () => {
  try { await dom.view.next(); logEvent('next', '→') } catch { /* noop */ }
})

// Keyboard navigation (mirrors handleKeyUps in EpubRendererIndex.vue)
document.addEventListener('keydown', async (e) => {
  if (!state.loaded) return
  if (e.key === 'ArrowLeft')  { await dom.view.prev(); logEvent('key', '← prev') }
  if (e.key === 'ArrowRight') { await dom.view.next(); logEvent('key', '→ next') }
})

// ── Toolbar: TOC toggle ──────────────────────────────────────────────
dom.tocBtn.addEventListener('click', () => {
  state.tocOpen = !state.tocOpen
  dom.tocSidebar.classList.toggle('hidden', !state.tocOpen)
  dom.tocBtn.classList.toggle('active', state.tocOpen)
  dom.tocBtn.setAttribute('aria-expanded', String(state.tocOpen))
})

// ── Toolbar: Settings toggle ─────────────────────────────────────────
dom.settBtn.addEventListener('click', () => {
  state.settingsOpen = !state.settingsOpen
  dom.settingsEl.classList.toggle('visible', state.settingsOpen)
  dom.settBtn.classList.toggle('active', state.settingsOpen)
  dom.settBtn.setAttribute('aria-expanded', String(state.settingsOpen))
})

// ── Toolbar: Debug log toggle ────────────────────────────────────────
document.getElementById('debug-btn').addEventListener('click', () => {
  document.getElementById('event-log').classList.toggle('visible')
})

// ── Theme buttons ────────────────────────────────────────────────────
Object.entries(THEMES).forEach(([key, theme]) => {
  document.getElementById(`theme-${key.toLowerCase()}`)
    ?.addEventListener('click', () => applyTheme(theme))
})

// ── Font size buttons ────────────────────────────────────────────────
document.getElementById('font-dec').addEventListener('click', () => {
  const current = state.fontSize || 16
  applyFontSize(Math.max(current - FONT_SIZE_STEP, FONT_SIZE_MIN), dom.view)
})

document.getElementById('font-inc').addEventListener('click', () => {
  const current = state.fontSize || 16
  applyFontSize(Math.min(current + FONT_SIZE_STEP, FONT_SIZE_MAX), dom.view)
})

// ── Flow mode buttons ────────────────────────────────────────────────
document.getElementById('flow-paginated').addEventListener('click', () => {
  dom.view.renderer?.setAttribute('flow', 'paginated')
  state.flow = 'paginated'
  saveSettings({ flow: 'paginated' })
  document.getElementById('flow-paginated').setAttribute('aria-pressed', 'true')
  document.getElementById('flow-scrolled').setAttribute('aria-pressed', 'false')
  logEvent('flow', 'paginated')
})

document.getElementById('flow-scrolled').addEventListener('click', () => {
  dom.view.renderer?.setAttribute('flow', 'scrolled')
  state.flow = 'scrolled'
  saveSettings({ flow: 'scrolled' })
  document.getElementById('flow-paginated').setAttribute('aria-pressed', 'false')
  document.getElementById('flow-scrolled').setAttribute('aria-pressed', 'true')
  logEvent('flow', 'scrolled')
})

// ── File open ────────────────────────────────────────────────────────
document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0]
  if (file) openBook(file, dom.view, dom)
})

document.getElementById('url-open-btn').addEventListener('click', () => {
  const url = document.getElementById('url-input').value.trim()
  if (url) openBook(url, dom.view, dom)
})

// Drag and drop
const dropZone = document.getElementById('drop-zone')
document.body.addEventListener('dragover', e => e.preventDefault())
document.body.addEventListener('drop', e => {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (file?.name.endsWith('.epub')) openBook(file, dom.view, dom)
})
dropZone.addEventListener('click', () => document.getElementById('file-input').click())
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-input').click()
})

// ── URL params - open EPUB from ?url= query param ────────────────────
const urlParam = new URLSearchParams(location.search).get('url')
if (urlParam) openBook(urlParam, dom.view, dom)

// ── Cleanup (mirrors onUnmounted / beforeDestroy in EpubRendererIndex.vue)
window.addEventListener('beforeunload', () => cleanup())
