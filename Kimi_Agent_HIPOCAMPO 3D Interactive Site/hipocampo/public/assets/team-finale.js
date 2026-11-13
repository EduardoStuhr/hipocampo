import { TEAM } from './team-members.js?v=team-fan-1'
import { t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

const POSES = [
  [8, 23, -32], [20, 9, -15], [32, 18, 6], [44, 2, -12],
  [56, 10, 15], [68, 17, -7], [80, 11, 21], [92, 25, 34],
]

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
    tile.textContent = `[${letter}]`
    title.append(tile)
  }
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
  bottom.innerHTML = '<p>Oito olhares. Uma história em construção.</p><a href="mailto:contato@projetohipocampo.art">Entre em contato</a>'
  section.append(top, stage, names, live, bottom)
  const escape = event => {
    if (event.key === 'Escape') { selected = preview = null; live.textContent = 'Equipe completa.'; sync() }
  }
  section.addEventListener('keydown', escape)
  const observer = new IntersectionObserver(entries => {
    const visible = entries[0].isIntersecting
    section.classList.toggle('team-in-view', visible && !document.hidden)
    if (visible) section.classList.add('team-revealed')
  }, { threshold: .08 })
  observer.observe(section)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) section.classList.remove('team-in-view')
    else {
      const r = section.getBoundingClientRect()
      section.classList.toggle('team-in-view', r.bottom > 0 && r.top < innerHeight)
    }
  })
  window.addEventListener('pagehide', () => { section.classList.remove('team-in-view'); observer.disconnect() }, { once: true })
  window.__hipocampoLenis?.resize()
  ScrollTrigger.refresh()
  return true
}

if (!mount()) window.__hipocampoWhenReady?.(mount)
