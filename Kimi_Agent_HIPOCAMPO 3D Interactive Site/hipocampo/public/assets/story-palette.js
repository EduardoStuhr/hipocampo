import { t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

// Readable header over the white introduction and camera sections.
export function mountStoryPalette(about, camera) {
  const header = document.querySelector('body > #root > header')
  if (!header) return
  const syncHeader = range => {
    if (range.isActive) header.dataset.storyTone = 'paper'
    else header.removeAttribute('data-story-tone')
  }
  const range = ScrollTrigger.create({
    trigger: about, endTrigger: camera,
    start: 'top 72px', end: 'bottom top',
    onToggle: syncHeader, onRefresh: syncHeader,
  })
  syncHeader(range)
  window.addEventListener('pagehide', () => {
    range.kill()
    header.removeAttribute('data-story-tone')
  }, { once: true })
}
