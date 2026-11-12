import { t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'
// Mounted exclusively by mobile-layout.js at phone widths.
export function mountMobileImmersion(root) {
  const disposers = []
  const listen = (target, type, handler, options) => {
    target.addEventListener(type, handler, options)
    disposers.push(() => target.removeEventListener(type, handler, options))
  }
  const html = document.documentElement
  const stage = root.querySelector('.installation-stage')
  const toolbar = root.querySelector('.installation-toolbar')
  const actions = root.querySelector('.installation-actions')
  const zoom = root.querySelector('.installation-zoom')
  const zoomNext = zoom.nextSibling
  const canvas = stage.querySelector('canvas')
  const description = canvas.getAttribute('aria-label')
  canvas.setAttribute('aria-label', 'Sala 3D. Toque nos objetos. Ative explorar em tela inteira para girar com o dedo. A página só volta a rolar ao tocar em voltar à rolagem.')

  const tools = document.createElement('details')
  tools.className = 'installation-mobile-tools'
  const summary = document.createElement('summary')
  summary.textContent = 'controles'
  const panel = document.createElement('div')
  panel.className = 'installation-mobile-tools-panel'
  panel.dataset.mobileToolsScroll = ''
  panel.append(actions, zoom)
  tools.append(summary, panel)
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
  stage.append(controls, tools)

  let lockOwner = null, lockY = 0, roomLocked = false, houseProgress = 0, resizeTimer = 0
  const freeze = owner => {
    if (lockOwner === owner) return
    lockOwner = owner
    lockY = scrollY
    if (owner === 'house') houseProgress = document.querySelector('#casa').houseJourney?.inspect().target || 0
    html.classList.add('mobile-scroll-locked')
    window.__hipocampoLenis?.stop()
  }
  const release = owner => {
    if (owner && owner !== lockOwner) return
    lockOwner = null
    html.classList.remove('mobile-scroll-locked')
    window.__hipocampoLenis?.start()
  }
  const sync = () => {
    const ready = stage.getAttribute('aria-busy') !== 'true' && !root.querySelector('.installation-fallback')
    toggle.disabled = !ready
    toggle.setAttribute('aria-pressed', String(roomLocked))
    toggle.textContent = roomLocked ? 'voltar à rolagem' : 'explorar em tela inteira'
    hint.textContent = roomLocked
      ? 'Rolagem bloqueada. Toque em “voltar à rolagem” para sair.'
      : 'Toque nos objetos ou ative a exploração para girar a sala.'
    // Top view, browser focus and visibility may suspend Three's gestures.
    // They must never implicitly release the phone's explicit page lock.
    if (roomLocked && ready && !document.hidden && !stage.classList.contains('is-exploring')) root.installationRoom?.setNavigation(true)
  }
  listen(toggle, 'click', () => {
    if (!root.installationRoom) return
    if (!roomLocked) {
      tools.open = false
      window.__hipocampoLenis?.scrollTo(stage, { immediate: true, force: true })
      roomLocked = true
      freeze('room')
      root.installationRoom.setNavigation(true)
    } else {
      roomLocked = false
      root.installationRoom.setNavigation(false)
      release('room')
    }
    sync()
  })
  const state = new MutationObserver(sync)
  state.observe(stage, { attributes: true, attributeFilter: ['class', 'aria-busy'] })
  listen(document, 'visibilitychange', sync)
  listen(window, 'focus', sync)
  listen(stage, 'dblclick', event => {
    if (event.target === canvas) { event.preventDefault(); event.stopImmediatePropagation() }
  }, true)
  sync()

  // Prevent scrolling from the canvas, controls, header or page edges while
  // locked. A controls panel may still scroll internally on a short phone.
  listen(document, 'touchmove', event => {
    if (lockOwner && !event.target.closest('[data-mobile-tools-scroll]')) event.preventDefault()
  }, { passive: false })
  listen(window, 'wheel', event => { if (lockOwner && !event.target.closest('[data-mobile-tools-scroll]')) event.preventDefault() }, { passive: false })
  listen(document, 'click', event => {
    if (lockOwner && event.target.closest('a[href^="#"]')) { event.preventDefault(); event.stopPropagation() }
  }, true)
  listen(window, 'scroll', () => {
    if (lockOwner && Math.abs(scrollY - lockY) > 1) window.scrollTo(0, lockY)
  }, { passive: true })
  const reanchor = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!lockOwner) return
      const scene = lockOwner === 'room' ? stage : document.querySelector('#casa')
      lockY = scene.getBoundingClientRect().top + scrollY
      if (lockOwner === 'house') {
        const journey = ScrollTrigger.getById('hipocampo-house')
        if (journey) lockY = journey.start + houseProgress * (journey.end - journey.start)
      }
      window.__hipocampoLenis?.resize()
      window.__hipocampoLenis?.scrollTo(lockY, { immediate: true, force: true })
    }, 300)
  }
  let viewportWidth = innerWidth
  listen(window, 'resize', () => {
    if (viewportWidth === innerWidth) return
    viewportWidth = innerWidth
    reanchor()
  }, { passive: true })
  // A real orientation / viewport change resizes the stable lvh scene.
  // Chrome's address-bar motion only moves controls and never clears WebGL.
  const sceneResize = new ResizeObserver(() => { if (lockOwner) reanchor() })
  sceneResize.observe(stage)
  sceneResize.observe(document.querySelector('.page3-stage'))

  const house = document.querySelector('#casa')
  const houseCanvas = house.querySelector('canvas')
  const houseToggle = () => house.querySelector('.page3-look-toggle')
  let houseLocked = false
  const commandHouse = active => house.dispatchEvent(new CustomEvent('hipocampo:house-look-command', { detail: { active } }))
  const houseSync = () => {
    const toggle = houseToggle(), hint = house.querySelector('#house-look-hint')
    if (toggle) toggle.textContent = houseLocked ? 'voltar à rolagem' : 'olhar ao redor'
    if (hint) hint.textContent = houseLocked ? 'Rolagem bloqueada. Toque em “voltar à rolagem” para seguir.' : 'Para girar, toque em olhar ao redor. Para seguir, deslize na tela.'
  }
  listen(house, 'click', event => {
    if (!event.target.closest('.page3-look-toggle, .page3-look-reset')) return
    event.preventDefault()
    event.stopImmediatePropagation()
    houseLocked = !event.target.closest('.page3-look-reset') && !houseLocked
    if (houseLocked) freeze('house')
    else release('house')
    commandHouse(houseLocked)
    houseSync()
  }, true)
  // Explicit commands, rather than synthetic clicks and class observers,
  // keep browser suspension and the page lock from toggling one another.
  listen(house, 'hipocampo:house-look-state', event => {
    if (houseLocked && event.detail.available && !event.detail.active && !document.hidden) commandHouse(true)
    houseSync()
  })
  listen(houseCanvas, 'contextmenu', event => event.preventDefault())

  const sceneObserver = new IntersectionObserver(entries => {
    const entry = entries[0]
    html.classList.toggle('mobile-in-scene', entry.isIntersecting)
  }, { rootMargin: '-15% 0px -15% 0px', threshold: 0 })
  sceneObserver.observe(stage)

  // Native sticky and stable lvh scene sizes keep Chrome's moving browser
  // bars from rebuilding the animation or clearing the WebGL buffer.
  const hero = document.querySelector('#abertura')
  let touchChars = [], restoreTimer = 0, lastCharFrame = 0, touch = null, holdTimer = 0
  const charAnimations = new Map()
  const restoreChars = () => {
    touchChars = []
    charAnimations.forEach(animation => animation.cancel())
    charAnimations.clear()
  }
  const revealTouch = point => {
    hero.dispatchEvent(new CustomEvent('hipocampo:hero-touch', { detail: { clientX: point.clientX, clientY: point.clientY, start: !touch?.revealed } }))
    if (touch) touch.revealed = true
    moveChars(point)
  }
  listen(hero, 'contextmenu', event => event.preventDefault())
  listen(hero, 'dragstart', event => event.preventDefault())
  listen(document.querySelector('[data-memory-map]'), 'contextmenu', event => event.preventDefault())
  listen(hero, 'pointerdown', event => {
    if (event.pointerType !== 'touch' || event.target.closest('a,button')) return
    clearTimeout(restoreTimer); clearTimeout(holdTimer)
    restoreChars()
    lastCharFrame = 0
    touch = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, pointerType: 'touch', mode: 'pending', revealed: false }
    touchChars = [...hero.querySelectorAll('.memory-char')].map(char => {
      const r = char.getBoundingClientRect()
      return { char, x: r.left + r.width / 2, y: r.top + r.height / 2, visible: r.width > 0 }
    }).filter(item => item.visible)
    holdTimer = setTimeout(() => { if (touch?.mode === 'pending') revealTouch(touch) }, 220)
  }, { passive: true })
  const moveChars = event => {
    if (event.pointerType !== 'touch' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const now = performance.now()
    if (now - lastCharFrame < 32) return
    lastCharFrame = now
    touchChars.map(item => ({ ...item, dx: item.x - event.clientX, dy: item.y - event.clientY }))
      .filter(item => Math.hypot(item.dx, item.dy) < 95)
      .sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy)).slice(0, 16)
      .forEach(({ char, dx, dy }) => {
        const d = Math.max(1, Math.hypot(dx, dy)), push = 26 * (1 - d / 95)
        charAnimations.get(char)?.cancel()
        const animation = char.animate([
          { transform: `translate(${dx / d * push}px,${dy / d * push}px) rotate(${dx / d * 12}deg)` },
          { transform: 'translate(0,0) rotate(0deg)' },
        ], { duration: 900, easing: 'cubic-bezier(.2,.8,.2,1)' })
        charAnimations.set(char, animation)
      })
  }
  listen(hero, 'pointermove', event => {
    if (!touch || event.pointerId !== touch.id) return
    const dx = event.clientX - touch.clientX, dy = event.clientY - touch.clientY
    if (touch.mode === 'pending' && Math.hypot(dx, dy) > 8) {
      clearTimeout(holdTimer)
      touch.mode = Math.abs(dy) >= Math.abs(dx) ? 'scroll' : 'effect'
    }
    if (touch.mode === 'scroll') { restoreChars(); return }
    if (touch.mode === 'effect') revealTouch(event)
  }, { passive: true })
  listen(hero, 'pointerup', event => {
    clearTimeout(holdTimer)
    if (touch?.id === event.pointerId && touch.mode === 'pending' && !touch.revealed) revealTouch(event)
    touch = null
    clearTimeout(restoreTimer); restoreTimer = setTimeout(restoreChars, 1000)
  }, { passive: true })
  listen(hero, 'pointercancel', () => {
    clearTimeout(holdTimer); touch = null; restoreChars()
  }, { passive: true })

  return () => {
    roomLocked = false
    root.installationRoom?.setNavigation(false)
    houseLocked = false
    commandHouse(false)
    if (houseToggle()) houseToggle().textContent = 'olhar ao redor'
    release()
    state.disconnect(); sceneObserver.disconnect(); sceneResize.disconnect()
    disposers.forEach(dispose => dispose())
    clearTimeout(restoreTimer); clearTimeout(holdTimer); clearTimeout(resizeTimer); restoreChars()
    toolbar.append(actions)
    stage.insertBefore(zoom, zoomNext)
    controls.remove(); tools.remove()
    canvas.setAttribute('aria-label', description)
    html.classList.remove('mobile-in-scene')
  }
}
