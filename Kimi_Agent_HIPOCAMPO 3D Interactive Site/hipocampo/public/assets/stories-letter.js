import { t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

// Presentation copy, not a participant testimonial. Keep future stories separate.
export function prepareStoriesLetter(section) {
  if (section.dataset.letterReady) return
  section.dataset.letterReady = 'true'
  section.classList.add('stories-letter-section')
  section.innerHTML = `
    <div class="stories-correspondence">
      <div class="stories-introduction">
        <p class="stories-eyebrow">06 — Relatos</p>
        <h2 id="relatos-title">Uma carta para você</h2>
        <p class="stories-invitation">Antes dos relatos, algumas palavras.</p>
      </div>
      <div class="stories-envelope">
        <article class="stories-letter-paper" id="relatos-carta" aria-labelledby="stories-letter-greeting" tabindex="-1" hidden>
          <dl class="stories-letter-address"><div><dt>De</dt><dd>Hipocampo</dd></div><div><dt>Para</dt><dd>Quem chegou até aqui</dd></div></dl>
          <h3 id="stories-letter-greeting">A quem chegou até aqui,</h3>
          <p>No Hipocampo, uma memória se constrói a partir de fragmentos: uma fotografia, um objeto guardado, uma história que volta a ser contada.</p>
          <p>Cada encontro aproxima essas peças de um jeito diferente. Entre o que lembramos e o que imaginamos, surgem novas formas de olhar para uma vida.</p>
          <p>Esta carta abre espaço para as palavras de quem atravessou o projeto. Os relatos que vierem depois guardarão um pouco desses encontros — e das memórias que continuam se formando.</p>
          <p class="stories-letter-signoff">Com afeto,<span>Hipocampo</span></p>
        </article>
        <button class="stories-envelope-toggle" type="button" aria-expanded="false" aria-controls="relatos-carta">
          <span class="stories-envelope-art" aria-hidden="true"><img src="/images/sobre/envelope.webp" alt="" width="736" height="736" loading="lazy" decoding="async" draggable="false" /></span>
          <span class="stories-envelope-action">Abrir carta<span aria-hidden="true"> ↗</span></span>
        </button>
      </div>
    </div>
    <div class="stories-voices" aria-labelledby="stories-voices-title">
      <div class="stories-voices-heading"><p class="stories-eyebrow">Palavras que ficam</p><h3 id="stories-voices-title">Relatos</h3></div>
      <div class="stories-voices-content"><p class="stories-voices-intro">Cada pessoa leva uma memória.<br>Cada relato abre outra possibilidade.</p><p class="stories-empty">Relatos em breve.</p></div>
    </div>`

  const button = section.querySelector('.stories-envelope-toggle')
  const paper = section.querySelector('.stories-letter-paper')
  const action = button.querySelector('.stories-envelope-action')
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0
  const setOpen = open => {
    section.classList.toggle('stories-is-open', open)
    button.setAttribute('aria-expanded', String(open))
    paper.hidden = !open
    action.replaceChildren(open ? 'Fechar carta' : 'Abrir carta')
    if (open) paper.focus({ preventScroll: true })
    else button.focus({ preventScroll: true })
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      window.__hipocampoLenis?.resize()
      ScrollTrigger.refresh()
      const target = open ? paper : button
      if (window.__hipocampoLenis) {
        window.__hipocampoLenis.scrollTo(target, { offset: -120, immediate: reduced.matches, duration: .7 })
      } else target.scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' })
    })
  }
  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'))
  section.addEventListener('keydown', event => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') setOpen(false)
  })
  window.addEventListener('pagehide', () => cancelAnimationFrame(frame), { once: true })
}
