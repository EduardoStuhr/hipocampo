import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

// Local colour motion and event-based header contrast. No new pinned runway,
// scroll interception, or document-wide progress property on every frame.
export function mountStoryPalette(about, camera) {
  const header = document.querySelector('body > #root > header')
  const band = about.querySelector('.page4-color-band')
  const media = gsap.matchMedia()
  let disposed = false
  media.add({ all: '(min-width: 0px)', mobile: '(max-width: 760px)', reduced: '(prefers-reduced-motion: reduce)' }, context => {
    const { mobile, reduced } = context.conditions
    const ranges = { about: null, band: null, camera: null, paper: null }
    const syncHeader = () => {
      if (disposed || !header) return
      let tone = null
      if (ranges.camera?.isActive) tone = mobile ? (ranges.paper?.isActive ? 'paper' : 'dark') : 'split'
      else if (ranges.about?.isActive) tone = ranges.band?.isActive ? 'dark' : 'paper'
      if (tone) header.dataset.storyTone = tone
      else header.removeAttribute('data-story-tone')
    }
    if (reduced) gsap.set(band, { scaleX: 1 })
    else gsap.fromTo(band, { scaleX: 0 }, {
      scaleX: 1, ease: 'none',
      scrollTrigger: { id: 'hipocampo-color-band', trigger: about.querySelector('.page4-photos'), start: 'top 95%', end: 'top 65%', scrub: true },
    })
    ranges.about = ScrollTrigger.create({ trigger: about, start: 'top 72px', end: 'bottom -80px', onToggle: syncHeader, onRefresh: syncHeader })
    ranges.band = ScrollTrigger.create({ id: 'hipocampo-blue-band-header', trigger: band, start: 'top 72px', end: 'bottom -80px', onToggle: syncHeader, onRefresh: syncHeader })
    ranges.camera = ScrollTrigger.create({
      trigger: camera,
      start: () => `top -${parseFloat(getComputedStyle(camera).borderTopWidth) || 0}px`,
      end: 'bottom top', onToggle: syncHeader, onRefresh: syncHeader,
    })
    if (mobile) ranges.paper = ScrollTrigger.create({ trigger: camera.querySelector('.page5-right'), start: () => `top -${innerWidth * .08}px`, end: 'bottom top', onToggle: syncHeader, onRefresh: syncHeader })
    syncHeader()
    return () => header?.removeAttribute('data-story-tone')
  })
  window.addEventListener('pagehide', () => {
    disposed = true
    media.revert()
    header?.removeAttribute('data-story-tone')
  }, { once: true })
}
