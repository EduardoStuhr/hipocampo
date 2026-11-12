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
  let startY = 0
  listen(document, 'touchstart', event => { startY = event.touches[0]?.clientY || 0 }, { passive: true })
  listen(document, 'touchmove', event => {
    if (lockOwner && !event.target.closest('[data-mobile-tools-scroll]')) event.preventDefault()
    else if (!lockOwner && scrollY <= 0 && (event.touches[0]?.clientY || 0) > startY + 4) event.preventDefault()
  }, { passive: false })
  listen(window, 'wheel', event => { if (lockOwner && !event.target.closest('[data-mobile-tools-scroll]')) event.preventDefault() }, { passive: false })
  listen(document, 'click', event => {
    if (lockOwner && event.target.closest('a[href^="#"]')) { event.preventDefault(); event.stopPropagation() }
  }, true)
  listen(window, 'scroll', () => {
    if (lockOwner && Math.abs(scrollY - lockY) > 1) window.scrollTo(0, lockY)
  }, { passive: true })
  listen(window, 'resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      if (!lockOwner) return
      const scene = lockOwner === 'room' ? stage : document.querySelector('#casa')
      lockY = scene.getBoundingClientRect().top + scrollY
      if (lockOwner === 'house') lockY += houseProgress * Math.max(0, scene.offsetHeight - innerHeight)
      window.__hipocampoLenis?.resize()
      window.__hipocampoLenis?.scrollTo(lockY, { immediate: true, force: true })
    }, 300)
  }, { passive: true })

  const house = document.querySelector('#casa')
  const houseCanvas = house.querySelector('canvas')
  const houseToggle = () => house.querySelector('.page3-look-toggle')
  let houseLocked = false
  const houseSync = () => {
    const active = houseLocked
    if (active && !document.hidden && house.classList.contains('has-house-look') && !house.classList.contains('is-house-looking')) houseToggle()?.click()
    const toggle = houseToggle(), hint = house.querySelector('#house-look-hint')
    if (toggle) toggle.textContent = active ? 'voltar à rolagem' : 'olhar ao redor'
    if (hint) hint.textContent = active ? 'Rolagem bloqueada. Toque em “voltar à rolagem” para seguir.' : 'Toque e arraste para olhar ao redor.'
  }
  const houseState = new MutationObserver(houseSync)
  houseState.observe(house, { attributes: true, attributeFilter: ['class'], childList: true, subtree: false })
  listen(houseCanvas, 'pointerdown', event => {
    if (event.pointerType !== 'touch' || !house.classList.contains('has-house-look')) return
    if (!house.classList.contains('is-house-looking')) houseToggle()?.click()
  }, true)
  // Delegation handles the look controls even if WebGL finishes preparing late.
  listen(house, 'click', event => {
    if (!event.target.closest('.page3-look-toggle, .page3-look-reset')) return
    // Capture explicit intent before the look controller changes its class;
    // its MutationObserver must not interpret a reset as an auto-suspension.
    houseLocked = !event.target.closest('.page3-look-reset') && !house.classList.contains('is-house-looking')
    if (houseLocked) freeze('house')
    else release('house')
  }, true)
  listen(document, 'visibilitychange', houseSync)

  const sceneObserver = new IntersectionObserver(entries => {
    const entry = entries[0]
    html.classList.toggle('mobile-in-scene', entry.isIntersecting)
  }, { rootMargin: '-15% 0px -15% 0px', threshold: 0 })
  sceneObserver.observe(stage)

  // Native sticky replaces the mobile fixed-pin paint path. Address-bar
  // resizing gets a full dynamic viewport without rebuilding the animation.
  const hero = document.querySelector('#abertura')
  let touchChars = [], restoreTimer = 0, lastCharFrame = 0
  const charAnimations = new Map()
  const restoreChars = () => {
    touchChars = []
    charAnimations.forEach(animation => animation.cancel())
    charAnimations.clear()
  }
  listen(hero, 'pointerdown', event => {
    if (event.pointerType !== 'touch' || event.target.closest('a,button')) return
    clearTimeout(restoreTimer)
    restoreChars()
    lastCharFrame = 0
    touchChars = [...hero.querySelectorAll('.memory-char')].map(char => {
      const r = char.getBoundingClientRect()
      return { char, x: r.left + r.width / 2, y: r.top + r.height / 2, visible: r.width > 0 }
    }).filter(item => item.visible)
    moveChars(event)
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
  listen(hero, 'pointermove', moveChars, { passive: true })
  const endChars = () => { clearTimeout(restoreTimer); restoreTimer = setTimeout(restoreChars, 1000) }
  listen(hero, 'pointerup', endChars, { passive: true })
  listen(hero, 'pointercancel', endChars, { passive: true })

  return () => {
    roomLocked = false
    root.installationRoom?.setNavigation(false)
    if (house.classList.contains('is-house-looking')) houseToggle()?.click()
    release()
    state.disconnect(); houseState.disconnect(); sceneObserver.disconnect()
    disposers.forEach(dispose => dispose())
    clearTimeout(restoreTimer); clearTimeout(resizeTimer); restoreChars()
    toolbar.append(actions)
    stage.insertBefore(zoom, zoomNext)
    controls.remove(); tools.remove()
    canvas.setAttribute('aria-label', description)
    html.classList.remove('mobile-in-scene')
  }
}
