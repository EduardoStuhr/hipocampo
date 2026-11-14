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
            <article class="stories-letter-paper" id="relatos-carta" aria-hidden="true"></article>
          </div>
          <div class="stories-envelope-front" aria-hidden="true"><span class="stories-envelope-name">Hipocampo</span></div>
          <div class="stories-envelope-flap" aria-hidden="true"></div>
          <div class="stories-envelope-seal" aria-hidden="true">H</div>
        </div>
        <article class="stories-reading-room" id="relatos-conteudo" aria-label="Relatos" aria-hidden="true"><p>Em breve, relatos</p></article>
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
  const room = section.querySelector('.stories-reading-room')
  const shell = [flap, section.querySelector('.stories-envelope-back'), section.querySelector('.stories-envelope-front')]
  let lastPhase = ''
  const setPhase = phase => {
    if (phase === lastPhase) return
    lastPhase = phase
    section.dataset.letterPhase = phase
    room.setAttribute('aria-hidden', String(phase !== 'open'))
    section.dispatchEvent(new CustomEvent('hipocampo:letter-phase', { bubbles: true }))
  }
  // Cache the camera framing on refresh, including mobile browser-bar changes.
  // No geometry reads or document-wide custom properties on scroll frames.
  let geometry = {}
  const measure = () => {
    const height = stage.clientHeight
    const paperHeight = paper.offsetHeight
    const anchor = height * .58 + scene.offsetHeight / 2 - 16
    const zoom = Math.max(stage.clientWidth / paper.offsetWidth, height / paperHeight) * 1.06
    geometry = {
      paperY: Math.max(120, height * .2) - (anchor - paperHeight),
      zoom, zoomY: (height + paperHeight * zoom) / 2 - anchor,
      shellY: Math.min(height * .22, 180),
    }
  }
  const media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    setPhase('closed')
    measure()
    let currentProgress = 0, experience = null, valid = true, loading = false
    const loader = new IntersectionObserver(async entries => {
      if (!entries.some(entry => entry.isIntersecting) || loading) return
      loading = true
      loader.disconnect()
      try {
        const { createEnvelopeExperience } = await import('./stories-envelope-3d.js?v=paper-wax-1')
        const model = await createEnvelopeExperience(stage)
        if (!valid) { model.dispose(); return }
        experience = model
        delete stage.dataset.envelopeFallback
        stage.envelopeExperience = model
        experience.setProgress(currentProgress)
      } catch {
        if (valid) stage.dataset.envelopeFallback = 'true'
      }
    }, { rootMargin: '700px' })
    loader.observe(track)
    const timeline = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'hipocampo-stories-letter', trigger: track,
        start: 'top top', end: 'bottom bottom', scrub: true,
        invalidateOnRefresh: true, onRefreshInit: measure,
        onUpdate: self => {
          currentProgress = self.progress
          experience?.setProgress(currentProgress)
          setPhase(currentProgress < .06 ? 'closed' : currentProgress < .8 ? 'opening' : 'open')
        },
      },
    })
    timeline
      .set(flap, { rotationX: 0, zIndex: 4, transformOrigin: '50% 0%' }, 0)
      .set(paper, { scaleX: .94, scaleY: .42, y: 0, rotationX: 0, rotationY: 0, transformOrigin: '50% 100%' }, 0)
      .set(pocket, { overflow: 'hidden' }, 0)
      .to(seal, { opacity: 0, scale: .65, duration: .1 }, .02)
      .to(flap, { rotationX: -180, duration: .2 }, .05)
      .to(intro, { opacity: 0, y: -24, duration: .17 }, .08)
      .set(flap, { zIndex: 0 }, .18)
      .set(pocket, { overflow: 'visible' }, .2)
      .to(paper, { scaleX: 1, scaleY: 1, y: () => geometry.paperY, rotationX: -7, rotationY: 3, duration: .24 }, .21)
      .to(shell, { y: () => geometry.shellY, opacity: 0, duration: .22 }, .4)
      .to(paper, { scaleX: () => geometry.zoom, scaleY: () => geometry.zoom, y: () => geometry.zoomY, rotationX: 0, rotationY: 0, duration: .32 }, .48)
      .to(room, { autoAlpha: 1, duration: .06 }, .8)
      .to({}, { duration: .14 }, .86)
    return () => {
      valid = false
      loader.disconnect()
      experience?.dispose()
      if (stage.envelopeExperience === experience) delete stage.envelopeExperience
    }
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
