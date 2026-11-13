import { TEAM } from './team-members.js?v=beatriz-2'
import { t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

const POSES = [
  [7, 25, -34], [18, 12, -21], [29, 20, 6], [40, 5, -10],
  [50, 14, 12], [61, 18, -6], [72, 10, 16], [82, 19, 26], [93, 28, 34],
]

function mountTitleHover(title) {
  const enabled = matchMedia('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)')
  const letters = [...title.querySelectorAll('.team-letter')]
  let geometry = null, frame = 0, x = 0, y = 0
  const last = letters.map(() => '')
  const reset = () => {
    cancelAnimationFrame(frame); frame = 0; geometry = null
    title.removeAttribute('data-interacting')
    letters.forEach((letter, i) => { if (last[i]) letter.style.removeProperty('transform'); last[i] = '' })
  }
  const measure = () => {
    const rect = title.getBoundingClientRect()
    geometry = { rect, centers: letters.map(letter => rect.left + letter.offsetLeft + letter.offsetWidth / 2) }
  }
  const render = () => {
    frame = 0
    if (!enabled.matches) return reset()
    if (!geometry) measure()
    const { rect, centers } = geometry
    const radius = rect.width / letters.length * 1.5
    const vertical = Math.max(0, 1 - Math.abs(y - rect.top - rect.height / 2) / rect.height)
    title.setAttribute('data-interacting', '')
    letters.forEach((letter, i) => {
      const direction = (x - centers[i]) / radius
      const influence = Math.max(0, 1 - Math.abs(direction)) ** 2 * vertical
      const lift = -Math.min(25, rect.height * .15) * influence
      const pose = `translateY(${lift.toFixed(2)}px) rotate(${(direction * influence * 10).toFixed(2)}deg) scaleY(${(1 + .1 * influence).toFixed(3)})`
      if (last[i] !== pose) { letter.style.transform = pose; last[i] = pose }
    })
  }
  const move = event => {
    if (!enabled.matches || event.pointerType === 'touch') return
    x = event.clientX; y = event.clientY
    if (!frame) frame = requestAnimationFrame(render)
  }
  title.addEventListener('pointermove', move, { passive: true })
  title.addEventListener('pointerleave', reset)
  enabled.addEventListener('change', reset)
  window.addEventListener('scroll', reset, { passive: true })
  const resize = new ResizeObserver(reset)
  resize.observe(title)
  return {
    reset,
    dispose() {
      reset(); resize.disconnect()
      title.removeEventListener('pointermove', move)
      title.removeEventListener('pointerleave', reset)
      enabled.removeEventListener('change', reset)
      window.removeEventListener('scroll', reset)
    },
  }
}

function mount() {
  const section = document.querySelector('#informacoes')
  if (!section || document.documentElement.dataset.editorialMotionReady !== 'true') return false
  if (section.dataset.teamFinale === 'true') return true
  // Retain the section itself: navigation, colour theme and reading progress
  // keep their original anchors. Retire only animations on its old children.
  ScrollTrigger.getAll().forEach(trigger => {
    if (trigger.trigger !== section && trigger.trigger instanceof Element && section.contains(trigger.trigger)) trigger.kill(true)
  })
  section.dataset.teamFinale = 'true'
  section.classList.add('team-finale')
  section.setAttribute('aria-labelledby', 'team-finale-title')
  section.replaceChildren()

  const top = document.createElement('div')
  top.className = 'team-finale-top'
  top.innerHTML = '<p class="team-eyebrow">07 — Sobre nós</p><p>Uma memória também se faz de encontros.</p>'
  const stage = document.createElement('div')
  stage.className = 'team-fan-stage'
  const title = document.createElement('h2')
  title.className = 'team-finale-title'
  title.id = 'team-finale-title'
  title.setAttribute('aria-label', 'Hipocampo')
  for (const letter of 'HIPOCAMPO') {
    const tile = document.createElement('span')
    tile.className = 'team-letter'
    tile.setAttribute('aria-hidden', 'true')
    tile.textContent = letter
    title.append(tile)
  }
  const titleHover = mountTitleHover(title)
  const fan = document.createElement('div')
  fan.className = 'team-portrait-fan'
  fan.setAttribute('role', 'group')
  fan.setAttribute('aria-label', 'Pessoas do Hipocampo')
  const names = document.createElement('div')
  names.className = 'team-name-list'
  names.setAttribute('role', 'group')
  names.setAttribute('aria-label', 'Destacar pessoa da equipe')
  const cards = [], chips = []
  let selected = null, preview = null
  const live = document.createElement('p')
  live.className = 'team-live'
  live.setAttribute('role', 'status')
  const sync = () => {
    const current = preview ?? selected
    cards.forEach((card, i) => {
      card.parentElement.parentElement.classList.toggle('is-active', current === i)
      card.setAttribute('aria-pressed', String(selected === i))
      chips[i].setAttribute('aria-pressed', String(selected === i))
    })
    stage.classList.toggle('has-active-member', current !== null)
  }
  const select = i => {
    selected = selected === i ? null : i
    preview = null
    live.textContent = selected === null ? 'Equipe completa.' : TEAM[selected].name
    sync()
  }
  TEAM.forEach((member, i) => {
    const slot = document.createElement('div')
    slot.className = 'team-portrait-slot'
    slot.style.setProperty('--member-x', `${POSES[i][0]}%`)
    slot.style.setProperty('--member-y', `${POSES[i][1]}%`)
    slot.style.setProperty('--member-angle', `${POSES[i][2]}deg`)
    slot.style.setProperty('--member-index', String(i))
    const entrance = document.createElement('div')
    entrance.className = 'team-portrait-entrance'
    const card = document.createElement('button')
    card.className = 'team-portrait-card'
    card.type = 'button'
    card.setAttribute('aria-label', `Destacar ${member.name}`)
    card.setAttribute('aria-pressed', 'false')
    if (member.portrait) {
      const image = document.createElement('img')
      image.src = member.portrait
      image.alt = `Retrato de ${member.name}`
      image.loading = 'lazy'
      image.decoding = 'async'
      image.draggable = false
      card.append(image)
      card.classList.add('has-portrait')
    }
    const label = document.createElement('span')
    label.className = 'team-portrait-name'
    label.textContent = member.name
    card.append(label)
    card.addEventListener('click', () => select(i))
    slot.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') { preview = i; sync() } })
    slot.addEventListener('pointerleave', () => { preview = null; sync() })
    entrance.append(card); slot.append(entrance); fan.append(slot)
    cards.push(card)
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.textContent = member.name
    chip.setAttribute('aria-pressed', 'false')
    chip.addEventListener('click', () => select(i))
    names.append(chip); chips.push(chip)
  })
  stage.append(fan, title)
  const bottom = document.createElement('div')
  bottom.className = 'team-finale-bottom'
  bottom.innerHTML = '<p>Nove olhares. Uma história em construção.</p><a href="mailto:contato@projetohipocampo.art">Entre em contato</a>'
  section.append(top, stage, names, live, bottom)
  const escape = event => {
    if (event.key === 'Escape') { selected = preview = null; live.textContent = 'Equipe completa.'; sync() }
  }
  section.addEventListener('keydown', escape)
  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting
    section.classList.toggle('team-in-view', visible && !document.hidden)
    if (!visible) titleHover.reset()
    if (visible) section.classList.add('team-revealed')
  }, { threshold: .08 })
  observer.observe(section)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { section.classList.remove('team-in-view'); titleHover.reset() }
    else {
      const r = section.getBoundingClientRect()
      section.classList.toggle('team-in-view', r.bottom > 0 && r.top < innerHeight)
    }
  })
  window.addEventListener('pagehide', () => { section.classList.remove('team-in-view'); observer.disconnect(); titleHover.dispose() }, { once: true })
  window.__hipocampoLenis?.resize()
  ScrollTrigger.refresh()
  return true
}

if (!mount()) window.__hipocampoWhenReady?.(mount)
