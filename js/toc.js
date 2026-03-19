/**
 * Table of Contents builder.
 * Mirrors: kolibri/plugins/epub_viewer/assets/src/views/TableOfContentsSideBar.vue
 *
 * book.toc has the same .label / .href / .subitems structure in
 * both EPub.js and foliate-js, making migration straightforward.
 */

import { logEvent } from './logger.js'

/**
 * Build the TOC list from the book's table of contents.
 * @param {Array} toc - book.toc array from foliate-js.
 * @param {HTMLElement} container - DOM element to populate.
 * @param {HTMLElement} view - The <foliate-view> element.
 */
export function buildToc(toc, container, view) {
  container.innerHTML = ''

  function addItems(items, el, lvl) {
    for (const item of items) {
      const btn = document.createElement('button')
      btn.className = `toc-item level-${Math.min(lvl, 2)}`
      btn.textContent = item.label
      btn.dataset.href = item.href || ''
      btn.setAttribute('role', 'listitem')

      btn.addEventListener('click', async () => {
        try {
          // Mirrors handleTocNavigation in EpubRendererIndex.vue:
          //   this.jumpToLocation(item.href)
          //     .catch(() => this.jumpToLocation(`xhtml/${item.href}`))
          await view.goTo(item.href)
          logEvent('goTo (toc)', item.label.slice(0, 30))
        } catch {
          try { await view.goTo(`xhtml/${item.href}`) } catch { /* noop */ }
        }
      })

      el.appendChild(btn)
      if (item.subitems?.length) addItems(item.subitems, el, lvl + 1)
    }
  }

  addItems(toc, container, 0)
}

/**
 * Recursively count all TOC items (including sub-items).
 */
export function countToc(toc) {
  return toc.reduce(
    (n, item) => n + 1 + (item.subitems ? countToc(item.subitems) : 0),
    0,
  )
}

/**
 * Highlight the current TOC item matching the given href.
 */
export function updateCurrentTocItem(href) {
  const currentHref = typeof href === 'string' ? href : ''

  document.querySelectorAll('.toc-item').forEach(btn => {
    const buttonHref = typeof btn.dataset.href === 'string' ? btn.dataset.href : ''
    const isCurrent = currentHref && buttonHref
      && (currentHref.endsWith(buttonHref) || buttonHref.endsWith(currentHref))
    btn.setAttribute('aria-current', String(!!isCurrent))
  })
}
