import '../lib/view.js'

const view = document.getElementById('epub-view')
let currentTheme = { bg: '#ffffff', text: '#212121' }
let fontSize = null
let progressInterval = null

const parentOrigin = (() => {
  const fromQuery = new URLSearchParams(window.location.search).get('parentOrigin')
  if (fromQuery) return fromQuery

  try {
    return new URL(document.referrer).origin
  } catch {
    return window.location.origin
  }
})()

function postToParent(type, payload = {}) {
  window.parent.postMessage({ type, payload }, parentOrigin)
}

function clearProgressInterval() {
  if (!progressInterval) return
  clearInterval(progressInterval)
  progressInterval = null
}

window.addEventListener('message', async ({ data, origin }) => {
  if (origin !== parentOrigin) return
  if (!data || typeof data !== 'object') return

  const { type, payload = {} } = data

  if (type === 'OPEN') {
    const { url, buffer, fileType, fileName, savedCFI, theme, fontSize: fs, flow } = payload

    if (theme) currentTheme = theme
    if (fs) fontSize = fs

    clearProgressInterval()

    try {
      const openInput = buffer instanceof ArrayBuffer
        ? new File([buffer], fileName || 'book.epub', { type: fileType || 'application/epub+zip' })
        : url

      if (!openInput) {
        throw new Error('Missing EPUB input data')
      }

      // On HTTP deployments where SubtleCrypto is unavailable, wire a custom
      // SHA-1 implementation via foliate-js open options for font deobfuscation.
      await view.open(openInput)

      if (flow) view.renderer?.setAttribute('flow', flow)

      if (savedCFI) {
        try {
          await view.goTo(savedCFI)
        } catch {
          // Fall back to start when saved location cannot be resolved.
        }
      }

      if (fontSize) {
        view.renderer?.setStyles?.(`html { font-size: ${fontSize}px !important; }`)
      }

      postToParent('TOC_READY', {
        toc: view.book?.toc ?? [],
        landmarks: view.book?.landmarks ?? [],
        metadata: view.book?.metadata ?? {},
      })

      progressInterval = setInterval(() => {
        postToParent('AUTOSAVE')
      }, 30000)
    } catch (err) {
      postToParent('LOAD_ERROR', {
        message: err?.message || 'Unknown load error',
      })
    }
  }

  if (type === 'NAVIGATE') {
    const { direction, cfi, fraction } = payload
    try {
      if (direction === 'prev') await view.prev()
      else if (direction === 'next') await view.next()
      else if (cfi) await view.goTo(cfi)
      else if (fraction !== undefined) await view.goToFraction(fraction)
    } catch {
      // Ignore navigation errors from stale or unresolved locations.
    }
  }

  if (type === 'SET_THEME') {
    currentTheme = payload.theme
    const docs = view.renderer?.getContents?.() ?? []
    docs.forEach(content => injectTheme(content?.doc))
  }

  if (type === 'SET_FONT_SIZE') {
    fontSize = payload.fontSize
    view.renderer?.setStyles?.(`html { font-size: ${fontSize}px !important; }`)
    const docs = view.renderer?.getContents?.() ?? []
    docs.forEach(content => injectTheme(content?.doc))
  }

  if (type === 'SET_FLOW') {
    view.renderer?.setAttribute('flow', payload.flow)
  }
})

view.addEventListener('relocate', ({ detail }) => {
  postToParent('RELOCATE', {
    fraction: detail.fraction,
    cfi: detail.cfi,
    tocItem: detail.tocItem,
  })
})

view.addEventListener('load', ({ detail: { doc } }) => {
  injectTheme(doc)
  postToParent('SECTION_LOADED')
})

function injectTheme(doc) {
  if (!doc) return

  const existing = doc.getElementById('kolibri-theme')
  if (existing) existing.remove()

  const style = doc.createElement('style')
  style.id = 'kolibri-theme'
  style.textContent = `
    html, body { background: ${currentTheme.bg} !important; color: ${currentTheme.text} !important; }
    p, li { color: ${currentTheme.text} !important; line-height: 1.4em !important; }
    img, video { max-width: 100%; }
    ${fontSize ? `html { font-size: ${fontSize}px !important; }` : ''}
  `
  doc.head?.appendChild(style)
}

window.addEventListener('beforeunload', () => {
  clearProgressInterval()
  postToParent('STOPPED')
})

postToParent('SANDBOX_READY')
