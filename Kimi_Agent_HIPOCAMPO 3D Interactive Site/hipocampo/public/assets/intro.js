// A short opening for the document itself. Never wait for either WebGL scene
// and never stop Lenis or consume the visitor's scroll input.
const intro = document.querySelector('.hipocampo-intro')
if (intro) {
  const started = performance.now()
  let finished = false, timer = 0
  const leave = (skip = false) => {
    if (finished) return
    finished = true
    clearTimeout(timer)
    intro.classList.add(skip ? 'is-skipped' : 'is-leaving')
    setTimeout(() => intro.remove(), skip ? 140 : 820)
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.removeEventListener(type, leave)
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced || scrollY > 32 || location.hash) leave(true)
  else {
    // The last .8 seconds reveal the page by sliding the cover down.
    timer = setTimeout(leave, 4300)
    Promise.all([
      document.fonts.load('230px "AquilineTwo"').then(() => {
        // Aquiline's H extends beyond its advance width. Centre its actual ink
        // rather than the text anchor, including on a narrow phone viewport.
        const svg = intro.querySelector('svg'), bounds = svg.querySelector('text').getBBox()
        if (bounds.width && bounds.height) svg.setAttribute('viewBox', `${bounds.x - 20} ${bounds.y - 20} ${bounds.width + 40} ${bounds.height + 40}`)
      }).catch(() => {}),
      new Promise(resolve => {
        const ready = () => {
          if (!document.querySelector('#abertura[data-redesigned="true"]')) return false
          resolve(); return true
        }
        if (!ready()) window.__hipocampoWhenReady?.(ready)
      }),
    ]).then(() => {
      if (finished) return
      clearTimeout(timer)
      timer = setTimeout(leave, Math.max(0, 4300 - (performance.now() - started)))
    })
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(type, leave, { passive: true, once: true })
  }
}
