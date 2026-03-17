# Kolibri EPub Viewer - foliate-js Migration Prototype

> **GSoC 2026 Proposal Prototype**
> *"Update EPub rendering to a safely sandboxed viewer, using the maintained foliate-js library"*
>
> Author: Abhiswant Chaudhary • Mentor: Richard Tibbles - [Learning Equality](https://learningequality.org/)

## What is this?

A self-contained proof-of-concept demonstrating the migration of Kolibri's `epub_viewer` plugin from **EPub.js** to **[foliate-js](https://github.com/johnfactotum/foliate-js)**. It proves that foliate-js can replace every EPub.js API call used in the current plugin while being more secure, accessible, and maintainable.

### Key things demonstrated

| # | Feature | EPub.js (before) | foliate-js (after) |
|---|---------|-------------------|--------------------|
| 1 | Open a book | `new Epub(url)` + `renderTo()` | `view.open(file)` |
| 2 | Progress tracking | `visitedPages` / `locations.length` ratio | `relocate` event → `detail.fraction` |
| 3 | Theme injection | `rendition.themes.register()` + `.select()` | CSS injection on `load` event |
| 4 | Font size | `rendition.themes.register(css)` | `renderer.setStyles(css)` |
| 5 | TOC | `book.navigation.toc` | `book.toc` (same structure) |
| 6 | Slider seek | `locations[index]` array lookup | `goToFraction(0–1)` |
| 7 | Cleanup | manual event unbinding | `clearInterval` + `beforeunload` |
| 8 | Settings persistence | Lockr | `localStorage` (same key) |
| 9 | Error handling | `errorLoading` state | identical pattern |
| 10 | Security | CSP headers only | foliate-js refuses to run EPUB scripts by design |

## Quick start

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/kolibri-epub-viewer-prototype.git
cd kolibri-epub-viewer-prototype

# 2. Serve (no build step needed - native ES modules)
npx serve .

# 3. Open in browser
open http://localhost:3000
```

Then drop any `.epub` file onto the viewer, or paste a URL.

## Architecture

This prototype is split into modules that map **1:1** to Kolibri's Vue components:

```
kolibri-epub-viewer-prototype/
├── index.html              ← HTML shell (mirrors EpubRendererIndex.vue template)
├── styles.css              ← All CSS (mirrors Kolibri Design System tokens)
├── js/                     ← Prototype modules (map 1:1 to Kolibri components)
│   ├── constants.js        → EpubConstants.js
│   ├── state.js            → Vue ref() reactive state + Lockr persistence
│   ├── logger.js           → Demo-only event log (not in final plugin)
│   ├── toc.js              → TableOfContentsSideBar.vue
│   ├── theme.js            → SettingsSideBar.vue (theme section)
│   ├── epub-controller.js  → EpubRendererIndex.vue (core book logic)
│   └── main.js             → setup() lifecycle wiring
└── lib/                    ← foliate-js library (vendored)
    ├── view.js, epub.js, paginator.js, ...
    └── vendor/             ← zip.js, fflate, pdf.js
```

### Module dependency graph

```
main.js
  ├── lib/view.js (foliate-js library)
  ├── constants.js
  ├── state.js ← constants.js
  ├── logger.js
  ├── theme.js ← state.js, constants.js, logger.js
  └── epub-controller.js
        ├── state.js
        ├── constants.js
        ├── logger.js
        ├── toc.js ← logger.js
        └── theme.js
```

## Browser compatibility

foliate-js uses modern web APIs. For Kolibri's minimum browser targets (Chrome 49, Firefox 52), these polyfills are needed:

| API | Polyfill | Status |
|-----|----------|--------|
| Custom Elements v1 | `@webcomponents/custom-elements` | Available |
| `ResizeObserver` | `resize-observer-polyfill` | Available |
| `Intl.Segmenter` | - | Not polyfillable; used only by search (optional) |
| ES Modules | - | Supported in Chrome 61+, Firefox 60+ |

> **Note:** This prototype targets modern browsers for demonstration. Polyfills would be added to `buildConfig.js` in the actual Kolibri plugin.

## Security model

- **foliate-js does NOT execute JavaScript found in EPUB files** - this is a design-level decision, not dependent on CSP headers.
- Current Kolibri CSP (`default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:`) is compatible with foliate-js requirements (`script-src 'self'`; `frame-src blob:`).
- The security improvement is *architectural*, not just a header change.

## What's NOT in this prototype (but planned for the full GSoC project)

- [ ] Integration with Kolibri's `kolibri-sandbox` iframe
- [ ] Vue.js component wrappers (this is vanilla JS to show the API surface)
- [ ] EPUB3 SMIL (Media Overlays) for synchronized audio
- [ ] Search integration using foliate-js `search.js`
- [ ] TTS using foliate-js `tts.js` (SSML generation)
- [ ] Annotation/highlighting with `overlayer.js`
- [ ] Comprehensive automated test suite

## License

MIT - prototype code.
foliate-js is [MIT licensed](https://github.com/johnfactotum/foliate-js/blob/master/LICENSE).
