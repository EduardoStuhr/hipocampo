import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

gsap.registerPlugin(ScrollTrigger)

export function prepareStoriesLetter(section) {
  if (section.dataset.letterReady) return
  section.dataset.letterReady = 'true'
  section.classList.add('stories-letter-section')
  section.innerHTML = `
    <div class="stories-scroll-track">
      <div class="stories-correspondence">
        <div class="stories-introduction">
          <p class="stories-eyebrow">06 — Relatos</p>
          <h2 id="relatos-title">Relatos</h2>
          <p class="stories-invitation">Role para abrir a carta</p>
        </div>
        <div class="stories-envelope-scene">
          <div class="stories-envelope-back" aria-hidden="true"></div>
          <div class="stories-paper-pocket">
            <article class="stories-letter-paper" id="relatos-carta" aria-label="Espaço reservado para os relatos" aria-hidden="true"></article>
          </div>
          <div class="stories-envelope-front" aria-hidden="true"><span class="stories-envelope-name">Hipocampo</span></div>
          <div class="stories-envelope-flap" aria-hidden="true"></div>
          <div class="stories-envelope-seal" aria-hidden="true">H</div>
        </div>
      </div>
    </div>`

  const track = section.querySelector('.stories-scroll-track')
  const scene = section.querySelector('.stories-envelope-scene')
  const stage = section.querySelector('.stories-correspondence')
  const intro = section.querySelector('.stories-introduction')
  const flap = section.querySelector('.stories-envelope-flap')
  const seal = section.querySelector('.stories-envelope-seal')
  const pocket = section.querySelector('.stories-paper-pocket')
  const paper = section.querySelector('.stories-letter-paper')
  const shell = [flap, section.querySelector('.stories-envelope-back'), section.querySelector('.stories-envelope-front')]
  let lastPhase = ''
  const setPhase = phase => {
    if (phase === lastPhase) return
    lastPhase = phase
    section.dataset.letterPhase = phase
    paper.setAttribute('aria-hidden', String(phase !== 'open'))
  }
  // Geometry is read only when the timeline is created/refreshed, never in
  // wheel/touch handlers. Normal page scrolling drives the reversible scene.
  const paperY = () => {
    const height = window.innerHeight
    const naturalTop = stage.clientHeight * .58 + scene.offsetHeight / 2 - 16 - paper.offsetHeight
    return Math.max(120, height * .2) - naturalTop
  }
  const media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    setPhase('closed')
    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'hipocampo-stories-letter', trigger: track,
        start: 'top top', end: 'bottom bottom', scrub: true,
        invalidateOnRefresh: true,
        onUpdate: self => setPhase(self.progress < .06 ? 'closed' : self.progress < .82 ? 'opening' : 'open'),
      },
    })
    timeline
      .set(flap, { rotationX: 0, zIndex: 4, transformOrigin: '50% 0%' }, 0)
      .set(paper, { scaleX: .94, scaleY: .42, y: 0, transformOrigin: '50% 100%' }, 0)
      .set(pocket, { overflow: 'hidden' }, 0)
      .to(seal, { opacity: 0, scale: .65, duration: .12 }, .02)
      .to(flap, { rotationX: -180, duration: .28 }, .07)
      .to(intro, { opacity: 0, y: -24, duration: .22 }, .12)
      .set(flap, { zIndex: 0 }, .24)
      .set(pocket, { overflow: 'visible' }, .28)
      .to(paper, { scaleX: 1, scaleY: 1, y: paperY, duration: .36 }, .29)
      .to(shell, { y: () => Math.min(window.innerHeight * .22, 180), opacity: 0, duration: .24 }, .58)
      .to({}, { duration: .18 }, .82)
  })
  media.add('(prefers-reduced-motion: reduce)', () => setPhase('open'))

  const frame = requestAnimationFrame(() => {
    window.__hipocampoLenis?.resize()
    ScrollTrigger.refresh()
  })
  window.addEventListener('pagehide', event => {
    cancelAnimationFrame(frame)
    if (!event.persisted) media.revert()
  }, { once: true })
}
