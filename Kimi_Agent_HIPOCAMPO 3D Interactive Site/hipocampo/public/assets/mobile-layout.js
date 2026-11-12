// Mobile adapters use the existing React/Three APIs; desktop keeps its DOM.
const phone = matchMedia('(max-width: 767px)')
let cleanup = () => {}

function mountPhone(root) {
  const disposers = []
  const listen = (target, event, callback, options) => {
    target.addEventListener(event, callback, options)
    disposers.push(() => target.removeEventListener(event, callback, options))
  }
  const stage = root.querySelector('.installation-stage')
  const canvas = stage.querySelector('canvas')
  const oldDescription = canvas.getAttribute('aria-label')
  canvas.setAttribute('aria-label', 'Sala 3D. Toque nos objetos ou use explorar sem arrastar. Ative girar a sala para mover a câmera com o dedo; volte à rolagem para continuar a página.')
  const controls = document.createElement('div')
  controls.className = 'installation-mobile-navigation'
  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.dataset.action = 'mobile-navigation'
  toggle.setAttribute('aria-describedby', 'installation-mobile-hint')
  const hint = document.createElement('p')
  hint.id = 'installation-mobile-hint'
  hint.setAttribute('role', 'status')
  controls.append(toggle, hint)
  // Put the exit in the sticky toolbar, reachable even while touch scroll is off.
  root.querySelector('.installation-toolbar').append(controls)
  const sync = () => {
    const active = stage.classList.contains('is-exploring')
    toggle.disabled = stage.getAttribute('aria-busy') === 'true' || !!root.querySelector('.installation-fallback')
    toggle.setAttribute('aria-pressed', String(active))
    toggle.textContent = active ? 'voltar à rolagem' : 'girar a sala'
    hint.textContent = active ? 'Arraste para olhar ao redor. Volte à rolagem para seguir a página.' : 'Toque nos objetos. Para olhar ao redor, ative “girar a sala”.'
  }
  sync()
  listen(toggle, 'click', () => {
    const api = root.installationRoom
    if (!api) return
    api.setNavigation(!api.inspect().navigating)
    sync()
  })
  const state = new MutationObserver(sync)
  state.observe(stage, { attributes: true, attributeFilter: ['class', 'aria-busy'] })
  const envelope = document.querySelector('.page4-photo--envelope')
  const envelopeLabel = envelope?.getAttribute('aria-label')
  if (envelope) {
    envelope.setAttribute('role', 'button')
    envelope.setAttribute('aria-label', 'Envelope com fotografias: toque para ver a próxima fotografia')
    listen(envelope, 'click', () => envelope.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })))
    listen(envelope, 'keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); envelope.click() }
    })
  }
  const menuToggle = document.querySelector('header > button[aria-controls="site-nav"]')
  const closeMenu = () => {
    if (menuToggle?.getAttribute('aria-expanded') === 'true') menuToggle.click()
  }
  listen(document, 'keydown', event => { if (event.key === 'Escape') closeMenu() })
  listen(document, 'pointerdown', event => { if (!event.target.closest('header')) closeMenu() })

  // The recovered board initializes percentage values as pixels. Spread the
  // cards on phones, while leaving selection, relationships and dragging to React.
  const board = document.querySelector('#fragmentos > div:nth-child(2)')
  const cards = [...board.querySelectorAll('[data-fragment]')]
  const originalStyles = new Map(cards.map(card => [card, card.getAttribute('style')]))
  const positions = new Map()
  const sources = []
  let dragged = null, moving = false
  const arrange = () => {
    const w = board.clientWidth, h = board.clientHeight
    cards.forEach((card, i) => {
      positions.set(card, { left: Math.round((i % 2 ? .53 : .04) * w), top: Math.round((i < 2 ? .08 : .43) * h) })
    })
  }
  const restore = () => cards.forEach(card => {
    if (moving && dragged === card) {
      positions.set(card, { left: parseFloat(card.style.left), top: parseFloat(card.style.top) })
      return
    }
    const p = positions.get(card)
    if (card.style.left !== `${p.left}px`) card.style.left = `${p.left}px`
    if (card.style.top !== `${p.top}px`) card.style.top = `${p.top}px`
  })
  arrange()
  restore()
  listen(board, 'pointerdown', event => { dragged = event.target.closest('[data-fragment]'); moving = false }, true)
  listen(board, 'pointermove', () => { if (dragged) moving = true }, true)
  const finish = () => { dragged = null; moving = false }
  listen(window, 'pointerup', finish)
  listen(window, 'pointercancel', finish)
  const mutations = new MutationObserver(restore)
  mutations.observe(board, { subtree: true, attributes: true, attributeFilter: ['style'] })
  let lastWidth = board.clientWidth
  const resize = new ResizeObserver(() => {
    if (lastWidth === board.clientWidth) return
    const ratio = board.clientWidth / lastWidth
    lastWidth = board.clientWidth
    positions.forEach(p => { p.left = Math.round(p.left * ratio); p.top = Math.round(p.top * ratio) })
    restore()
  })
  resize.observe(board)
  // Mobile uses local archive files, so the board remains usable on slow data
  // connections. Restore exact originals when returning to desktop width.
  cards.forEach((card, i) => {
    const img = card.querySelector('img')
    sources.push([img, img.getAttribute('src'), img.getAttribute('alt')])
    img.src = `/images/trail/photo-${i + 1}.webp`
    img.alt = `Fotografia do acervo Hipocampo, fragmento ${i + 1}`
  })
  return () => {
    root.installationRoom?.setNavigation(false)
    state.disconnect(); mutations.disconnect(); resize.disconnect()
    disposers.forEach(dispose => dispose())
    controls.remove()
    canvas.setAttribute('aria-label', oldDescription)
    if (envelope) { envelope.removeAttribute('role'); envelope.setAttribute('aria-label', envelopeLabel) }
    originalStyles.forEach((style, card) => card.setAttribute('style', style))
    sources.forEach(([img, src, alt]) => { img.setAttribute('src', src); img.setAttribute('alt', alt) })
  }
}

function update() {
  cleanup()
  cleanup = () => {}
  if (!phone.matches) return
  const ready = () => document.querySelector('#instalacao .installation-stage') && document.querySelector('#fragmentos [data-fragment]') && document.querySelector('#vestigios')
  const mount = () => { cleanup = mountPhone(document.querySelector('#instalacao')) }
  if (ready()) mount()
  else {
    const observer = new MutationObserver(() => {
      if (ready()) { observer.disconnect(); mount() }
    })
    observer.observe(document.querySelector('#root'), { subtree: true, childList: true })
    cleanup = () => observer.disconnect()
  }
}
phone.addEventListener('change', update)
update()
