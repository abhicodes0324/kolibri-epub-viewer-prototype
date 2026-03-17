/**
 * Event log panel - demo-only module for proposal evidence.
 * Shows foliate-js events mapping to Kolibri tracking calls.
 * Not part of the actual Kolibri plugin migration.
 */

let logContainer = null

/**
 * Initialize the logger with a DOM container.
 * @param {HTMLElement} container - The event log panel element.
 */
export function initLogger(container) {
  logContainer = container
}

/**
 * Log a foliate-js event to the on-screen event log.
 * @param {string} event - Event name (e.g. 'relocate', 'load').
 * @param {string} detail - Human-readable detail string.
 */
export function logEvent(event, detail) {
  if (!logContainer) return
  const line = document.createElement('div')
  line.className = 'log-line'
  line.innerHTML =
    `<span class="log-event">[${event}]</span> <span class="log-val">${detail}</span>`
  logContainer.insertBefore(line, logContainer.children[1])
  if (logContainer.children.length > 20) logContainer.removeChild(logContainer.lastChild)
}
