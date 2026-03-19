/**
 * Main entry point for the parent page.
 * The reader is now hosted in sandbox.html and controlled via postMessage.
 */

import { THEMES, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_STEP } from './constants.js'
import { state, saveSettings } from './state.js'
import { initLogger, logEvent } from './logger.js'
import { applyTheme } from './theme.js'
import { buildToc, updateCurrentTocItem } from './toc.js'

const dom = {
  sandboxFrame: document.getElementById('sandbox-frame'),
  prevBtn: document.getElementById('prev-btn'),
  nextBtn: document.getElementById('next-btn'),
  slider: document.getElementById('progress-slider'),
  pctEl: document.getElementById('progress-pct'),
  titleEl: document.getElementById('top-bar-title'),
  sectionEl: document.getElementById('section-title'),
  loadingEl: document.getElementById('loading-state'),
  errorEl: document.getElementById('error-state'),
  errorMsg: document.getElementById('error-msg'),
  dropEl: document.getElementById('drop-state'),
  tocSidebar: document.getElementById('toc-sidebar'),
  tocList: document.getElementById('toc-list'),
  settingsEl: document.getElementById('settings-sidebar'),
  tocBtn: document.getElementById('toc-btn'),
  settBtn: document.getElementById('settings-btn'),
}

const sandboxURL = new URL(dom.sandboxFrame.getAttribute('src'), window.location.href)
sandboxURL.searchParams.set('parentOrigin', window.location.origin)
dom.sandboxFrame.src = sandboxURL.toString()

const sandboxOrigin = sandboxURL.origin

initLogger(document.getElementById('event-log'))

let pendingOpenRequest = null
let sandboxReady = false
let openInFlight = false

const sandboxNavigationAdapter = {
  goTo: href => sendToSandbox('NAVIGATE', { cfi: href }),
}

function sendToSandbox(type, payload = {}, transfer = []) {
  const sandboxWindow = dom.sandboxFrame?.contentWindow
  if (!sandboxWindow || !sandboxReady) return false
  sandboxWindow.postMessage({ type, payload }, sandboxOrigin, transfer)
  return true
}

function formatMetadataTitle(title) {
  if (!title) return ''
  if (typeof title === 'string') return title
  const keys = Object.keys(title)
  return keys.length ? (title[keys[0]] || '') : ''
}

function updateProgressUI(fraction) {
  const safeFraction = Number.isFinite(fraction) ? Math.max(0, Math.min(1, fraction)) : 0
  const pct = Math.round(safeFraction * 100)
  dom.slider.value = safeFraction
  dom.slider.setAttribute('aria-valuenow', String(pct))
  dom.slider.setAttribute('aria-valuetext', `${pct}%`)
  dom.pctEl.textContent = `${pct}%`
}

function setFlowButtons(flow) {
  const isPaginated = flow === 'paginated'
  document.getElementById('flow-paginated').setAttribute('aria-pressed', String(isPaginated))
  document.getElementById('flow-scrolled').setAttribute('aria-pressed', String(!isPaginated))
}

function applyFontSizeSetting(fontSize) {
  state.fontSize = fontSize
  saveSettings({ fontSize })
  document.getElementById('font-dec').disabled = (fontSize <= FONT_SIZE_MIN)
  document.getElementById('font-inc').disabled = (fontSize >= FONT_SIZE_MAX)
  logEvent('fontSize', `${fontSize}px`)
}

function showLoadStart() {
  dom.dropEl.style.display = 'none'
  dom.loadingEl.style.display = 'flex'
  dom.errorEl.style.display = 'none'
}

function showLoadSuccess() {
  state.loaded = true
  dom.loadingEl.style.display = 'none'
  dom.errorEl.style.display = 'none'
  dom.prevBtn.disabled = false
  dom.nextBtn.disabled = false
}

function showLoadError(message) {
  state.loaded = false
  dom.loadingEl.style.display = 'none'
  dom.errorEl.style.display = 'flex'
  dom.errorMsg.textContent = `Could not load this book. ${message || ''}`.trim()
}

async function buildOpenPayload(file) {
  const basePayload = {
    savedCFI: state.savedLocation,
    theme: state.theme,
    fontSize: state.fontSize,
    flow: state.flow,
  }

  if (typeof file === 'string') {
    return {
      payload: { ...basePayload, url: file },
      transfer: [],
    }
  }

  const buffer = await file.arrayBuffer()
  return {
    payload: {
      ...basePayload,
      buffer,
      fileType: file.type || 'application/epub+zip',
      fileName: file.name || 'book.epub',
    },
    transfer: [buffer],
  }
}

async function openBook(file) {
  if (openInFlight && pendingOpenRequest === file) return
  showLoadStart()
  pendingOpenRequest = file
  openInFlight = true

  try {
    const { payload, transfer } = await buildOpenPayload(file)

    if (sendToSandbox('OPEN', payload, transfer)) {
      logEvent('open', 'OPEN sent to sandbox')
      pendingOpenRequest = null
    }
  } catch (err) {
    showLoadError(err?.message || 'Failed to prepare EPUB input')
    logEvent('error', err?.message || 'open payload error')
  } finally {
    openInFlight = false
  }
}

dom.sandboxFrame.addEventListener('load', () => {
  sandboxReady = true
  if (!pendingOpenRequest || openInFlight) return
  const request = pendingOpenRequest
  openBook(request)
})

window.addEventListener('message', ({ data, source, origin }) => {
  if (source !== dom.sandboxFrame.contentWindow) return
  if (origin !== sandboxOrigin) return
  if (!data || typeof data !== 'object') return

  const { type, payload = {} } = data

  if (type === 'SANDBOX_READY') {
    sandboxReady = true
    if (pendingOpenRequest && !openInFlight) {
      const request = pendingOpenRequest
      openBook(request)
    }
    return
  }

  if (type === 'RELOCATE') {
    state.fraction = payload.fraction
    state.lastCFI = payload.cfi
    if (payload.tocItem) {
      state.tocItem = payload.tocItem
      dom.sectionEl.textContent = payload.tocItem.label?.trim?.() || ''
      updateCurrentTocItem(payload.tocItem.href)
    }

    updateProgressUI(payload.fraction)

    if (Number.isFinite(payload.fraction)) {
      logEvent('relocate', `fraction=${payload.fraction.toFixed(3)}`)
    }
  }

  if (type === 'TOC_READY') {
    buildToc(payload.toc || [], dom.tocList, sandboxNavigationAdapter)
    const title = formatMetadataTitle(payload.metadata?.title)
    if (title) {
      dom.titleEl.textContent = title
      document.title = `${title} - Kolibri EPub Viewer (foliate-js)`
    }
    showLoadSuccess()
    logEvent('toc', `${payload.toc?.length || 0} top-level items`)
  }

  if (type === 'LOAD_ERROR') {
    showLoadError(payload.message)
    logEvent('error', payload.message || 'unknown')
  }

  if (type === 'AUTOSAVE') {
    saveSettings({ savedLocation: state.lastCFI, progress: state.fraction })
    logEvent('autosave', `fraction=${(state.fraction * 100).toFixed(1)}%`)
  }

  if (type === 'SECTION_LOADED') {
    showLoadSuccess()
  }
})

dom.slider.addEventListener('input', () => {
  const fraction = parseFloat(dom.slider.value)
  sendToSandbox('NAVIGATE', { fraction })
  logEvent('goToFraction', `${(fraction * 100).toFixed(1)}%`)
})

dom.prevBtn.addEventListener('click', () => {
  sendToSandbox('NAVIGATE', { direction: 'prev' })
  logEvent('prev', '<-')
})

dom.nextBtn.addEventListener('click', () => {
  sendToSandbox('NAVIGATE', { direction: 'next' })
  logEvent('next', '->')
})

document.addEventListener('keydown', e => {
  if (!state.loaded) return
  if (e.key === 'ArrowLeft') {
    sendToSandbox('NAVIGATE', { direction: 'prev' })
    logEvent('key', '<- prev')
  }
  if (e.key === 'ArrowRight') {
    sendToSandbox('NAVIGATE', { direction: 'next' })
    logEvent('key', '-> next')
  }
})

dom.tocBtn.addEventListener('click', () => {
  state.tocOpen = !state.tocOpen
  dom.tocSidebar.classList.toggle('hidden', !state.tocOpen)
  dom.tocBtn.classList.toggle('active', state.tocOpen)
  dom.tocBtn.setAttribute('aria-expanded', String(state.tocOpen))
})

dom.settBtn.addEventListener('click', () => {
  state.settingsOpen = !state.settingsOpen
  dom.settingsEl.classList.toggle('visible', state.settingsOpen)
  dom.settBtn.classList.toggle('active', state.settingsOpen)
  dom.settBtn.setAttribute('aria-expanded', String(state.settingsOpen))
})

document.getElementById('debug-btn').addEventListener('click', () => {
  document.getElementById('event-log').classList.toggle('visible')
})

Object.entries(THEMES).forEach(([key, theme]) => {
  document.getElementById(`theme-${key.toLowerCase()}`)?.addEventListener('click', () => {
    applyTheme(theme)
    sendToSandbox('SET_THEME', { theme })
  })
})

document.getElementById('font-dec').addEventListener('click', () => {
  const current = state.fontSize || 16
  const nextSize = Math.max(current - FONT_SIZE_STEP, FONT_SIZE_MIN)
  applyFontSizeSetting(nextSize)
  sendToSandbox('SET_FONT_SIZE', { fontSize: nextSize })
})

document.getElementById('font-inc').addEventListener('click', () => {
  const current = state.fontSize || 16
  const nextSize = Math.min(current + FONT_SIZE_STEP, FONT_SIZE_MAX)
  applyFontSizeSetting(nextSize)
  sendToSandbox('SET_FONT_SIZE', { fontSize: nextSize })
})

document.getElementById('flow-paginated').addEventListener('click', () => {
  state.flow = 'paginated'
  saveSettings({ flow: 'paginated' })
  setFlowButtons('paginated')
  sendToSandbox('SET_FLOW', { flow: 'paginated' })
  logEvent('flow', 'paginated')
})

document.getElementById('flow-scrolled').addEventListener('click', () => {
  state.flow = 'scrolled'
  saveSettings({ flow: 'scrolled' })
  setFlowButtons('scrolled')
  sendToSandbox('SET_FLOW', { flow: 'scrolled' })
  logEvent('flow', 'scrolled')
})

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0]
  if (file) {
    openBook(file)
  }
})

document.getElementById('url-open-btn').addEventListener('click', () => {
  const url = document.getElementById('url-input').value.trim()
  if (url) {
    openBook(url)
  }
})

const dropZone = document.getElementById('drop-zone')
document.body.addEventListener('dragover', e => e.preventDefault())
document.body.addEventListener('drop', e => {
  e.preventDefault()
  const file = e.dataTransfer.files[0]
  if (file?.name?.endsWith('.epub')) {
    openBook(file)
  }
})
dropZone.addEventListener('click', () => document.getElementById('file-input').click())
dropZone.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') document.getElementById('file-input').click()
})

const urlParam = new URLSearchParams(location.search).get('url')
if (urlParam) {
  openBook(urlParam)
}

// Initialize persisted UI state.
applyTheme(state.theme || THEMES.WHITE)
if (state.fontSize) applyFontSizeSetting(state.fontSize)
setFlowButtons(state.flow || 'paginated')
updateProgressUI(state.fraction || 0)

window.addEventListener('beforeunload', () => {
  saveSettings({ savedLocation: state.lastCFI, progress: state.fraction })
})
