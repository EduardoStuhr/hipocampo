import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

// Event-based contrast for the two background fields. The original photo
// layout and the portrait crossing the section boundary stay untouched.
export function mountStoryPalette(about, camera) {
  const header = document.querySelector('body > #root > header')
  const media = gsap.matchMedia()
  let disposed = false
  media.add({ all: '(min-width: 0px)', mobile: '(max-width: 760px)' }, context => {
    const { mobile } = context.conditions
    const ranges = { about: null, camera: null, paper: null }
    const syncHeader = () => {
      if (disposed || !header) return
      let tone = null
      if (ranges.camera?.isActive) tone = mobile ? (ranges.paper?.isActive ? 'paper' : 'dark') : 'split'
      else if (ranges.about?.isActive) tone = 'paper'
      if (tone) header.dataset.storyTone = tone
      else header.removeAttribute('data-story-tone')
    }
    ranges.about = ScrollTrigger.create({ trigger: about, start: 'top 72px', end: 'bottom -80px', onToggle: syncHeader, onRefresh: syncHeader })
    ranges.camera = ScrollTrigger.create({
      trigger: camera,
      start: 'top 72px',
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
