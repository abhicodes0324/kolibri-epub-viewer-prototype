/**
 * Core EPUB controller - opens books and handles foliate-js events.
 * Mirrors: kolibri/plugins/epub_viewer/assets/src/views/EpubRendererIndex.vue
 *
 * This is the central module that replaces EPub.js with foliate-js.
 * Key replacements:
 *   new Epub(url) + renderTo()  →  view.open(file)
 *   book.locations.generate()   →  'relocate' event (direct fraction)
 *   rendition.themes            →  CSS injection on 'load' event
 */

import { state, saveSettings } from './state.js'
import { THEMES } from './constants.js'
import { logEvent } from './logger.js'
import { buildToc, countToc, updateCurrentTocItem } from './toc.js'
import { injectThemeCSS, applyTheme } from './theme.js'

// 30-second autosave interval (retained from EpubRendererIndex.vue)
let progressInterval = null

/**
 * Open an EPUB file or URL using foliate-view.
 * This is the core migration - replaces new Epub(url) + renderTo().
 *
 * @param {File|string} file - File object or URL to open.
 * @param {HTMLElement} view - The <foliate-view> element.
 * @param {Object} dom - DOM element references.
 */
export async function openBook(file, view, dom) {
  // Show loading (mirrors LoadingScreen.vue)
  dom.dropEl.style.display = 'none'
  dom.loadingEl.style.display = 'flex'
  dom.errorEl.style.display = 'none'

  // Clear any existing reader state
  if (progressInterval) {
    clearInterval(progressInterval)
    progressInterval = null
  }

  try {
    /*
     * THE KEY LINE:
     * Before (EPub.js):
     *   global.ePub = Epub
     *   this.book = new Epub(this.epubURL)
     *   this.rendition = this.book.renderTo(this.$refs.epubjsContainer, {
     *     view: SandboxIFrameView, ...
     *   })
     *
     * After (foliate-js):
     *   await view.open(file)
     *
     * That's the entire replacement. foliate-view handles:
     * - EPUB parsing (epub.js)
     * - Pagination (paginator.js or fixed-layout.js)
     * - CFI navigation
     * - Security (no script execution by design)
     */
    await view.open(file)

    // ── Restore TOC ──────────────────────────────────────────────────
    const { book } = view
    if (book?.toc) {
      buildToc(book.toc, dom.tocList, view)
      logEvent('toc', `${countToc(book.toc)} items`)
    }

    // ── Set book title in TopBar (mirrors TopBar.vue's title prop) ──
    const title = formatMetadata(book?.metadata?.title) || 'Untitled'
    dom.titleEl.textContent = title
    document.title = `${title} - Kolibri EPub Viewer (foliate-js)`

    // ── Restore saved location (mirrors savedLocation in extraFields)
    // In Kolibri: this.extraFields?.contentState?.savedLocation
    const savedLoc = state.savedLocation
    if (savedLoc) {
      try {
        await view.goTo(savedLoc)
        logEvent('restore', `location: ${savedLoc.slice(0, 30)}…`)
      } catch {
        // CFI could not be resolved - fall back to start of book
        logEvent('restore', 'CFI invalid - falling back to start')
      }
    }

    // ── Apply persisted settings ──────────────────────────────────────
    applyTheme(state.theme || THEMES.WHITE)
    if (state.fontSize) applyFontSize(state.fontSize, view)
    if (state.flow) view.renderer?.setAttribute('flow', state.flow)

    // ── UI ready ──────────────────────────────────────────────────────
    state.loaded = true
    dom.loadingEl.style.display = 'none'
    dom.prevBtn.disabled = false
    dom.nextBtn.disabled = false

    // ── Start 30-second progress autosave ─────────────────────────────
    // Mirrors: this.updateContentStateInterval = setInterval(this.updateProgress, 30000)
    progressInterval = setInterval(() => {
      logEvent('autosave', `fraction=${(state.fraction * 100).toFixed(1)}%`)
      saveSettings({ savedLocation: state.lastCFI, progress: state.fraction })
    }, 30000)

    logEvent('open', `"${title}"`)

  } catch (err) {
    // Mirrors: this.errorLoading = true; this.reportLoadingError(err)
    state.errorLoading = true
    dom.loadingEl.style.display = 'none'
    dom.errorEl.style.display = 'flex'
    dom.errorMsg.textContent =
      `Could not load this book. ${err?.message || ''}`
    logEvent('error', err?.message || 'unknown')
    console.error(err)
  }
}

/**
 * Set up foliate-js event listeners on the view element.
 * Called once during initialization.
 */
export function setupViewEvents(view, dom) {
  // ── 'relocate' event handler ──────────────────────────────────────
  // CRITICAL: This replaces the entire visitedPages/locations tracking
  //
  // Before (EPub.js):
  //   this.rendition.on(EVENTS.RENDITION.RELOCATED, location => {
  //     this.sliderValue = location.start.percentage * 100
  //     this.storeVisitedPage(this.locations[locationIndex])
  //     this.$emit('updateProgress', Object.keys(visitedPages).length / locations.length)
  //   })
  //
  // After (foliate-js):
  //   view.addEventListener('relocate', ({ detail }) => {
  //     const fraction = detail.fraction  // direct 0–1 progress
  //     this.$emit('updateProgress', fraction)
  //   })
  //
  view.addEventListener('relocate', ({ detail }) => {
    const { fraction, tocItem, cfi } = detail

    state.fraction = fraction
    state.lastCFI = cfi
    if (tocItem) state.tocItem = tocItem

    // Update progress slider (mirrors BottomBar.vue's sliderValue prop)
    const pct = Math.round(fraction * 100)
    dom.slider.value = fraction
    dom.slider.setAttribute('aria-valuenow', pct)
    dom.slider.setAttribute('aria-valuetext', `${pct}%`)
    dom.pctEl.textContent = `${pct}%`

    // Update section title in BottomBar (mirrors bottomBarHeading computed)
    if (tocItem?.label) {
      dom.sectionEl.textContent = tocItem.label.trim()
      updateCurrentTocItem(tocItem.href)
    }

    // Emit to Kolibri progress tracking
    // In Vue: this.$emit('updateProgress', fraction)
    logEvent('relocate', `fraction=${fraction.toFixed(3)} cfi=${(cfi || '').slice(0, 25)}…`)
  })

  // ── 'load' event handler ────────────────────────────────────────────
  // Replaces: rendition.themes.register(name, cssObj) + rendition.themes.select(name)
  // Called each time a section document loads
  view.addEventListener('load', ({ detail: { doc } }) => {
    injectThemeCSS(doc)
    logEvent('load', `section doc loaded, theme=${state.theme?.name}`)
  })
}

/**
 * Font size system.
 * Before: rendition.themes.register + rendition.themes.select
 * After: view.renderer.setStyles(css) - injected on 'load' event
 */
export function applyFontSize(fontSize, view) {
  state.fontSize = fontSize
  saveSettings({ fontSize })

  // renderer.setStyles() is the foliate-js way to inject persistent CSS
  const fontCSS = `html { font-size: ${fontSize}px !important; }`
  view.renderer?.setStyles?.(fontCSS)

  // Update button disabled states
  // (mirrors decreaseFontSizeDisabled / increaseFontSizeDisabled)
  document.getElementById('font-dec').disabled = (fontSize <= 8)
  document.getElementById('font-inc').disabled = (fontSize >= 32)

  logEvent('fontSize', `${fontSize}px`)
}

/**
 * Cleanup - mirrors onUnmounted / beforeDestroy in EpubRendererIndex.vue.
 * Saves final state and clears the autosave interval.
 */
export function cleanup() {
  if (state.lastCFI) {
    saveSettings({ savedLocation: state.lastCFI, progress: state.fraction })
  }
  if (progressInterval) clearInterval(progressInterval)
  logEvent('cleanup', 'unmounted - interval cleared, state saved')
}

// ── Helper ──────────────────────────────────────────────────────────────
function formatMetadata(x) {
  if (!x) return ''
  if (typeof x === 'string') return x
  const keys = Object.keys(x)
  return x[keys[0]] || ''
}
