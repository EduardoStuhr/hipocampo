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
        // Use the visible ink bounds, including the long Aquiline flourishes.
        const svg = intro.querySelector('svg'), text = svg.querySelector('text')
        const bounds = text.getBBox()
        const context = document.createElement('canvas').getContext('2d')
        const style = getComputedStyle(text)
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
        const ink = context.measureText(text.textContent)
        const width = ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight
        const height = ink.actualBoundingBoxAscent + ink.actualBoundingBoxDescent
        if (width > 0 && height > 0) {
          const x = bounds.x
          const y = Number(text.getAttribute('y')) - ink.actualBoundingBoxAscent
          svg.setAttribute('viewBox', `${x - 20} ${y - 20} ${bounds.width + 40} ${height + 40}`)
        } else if (bounds.width && bounds.height) {
          svg.setAttribute('viewBox', `${bounds.x - 20} ${bounds.y - 20} ${bounds.width + 40} ${bounds.height + 40}`)
        }
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
