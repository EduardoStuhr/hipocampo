import { TEAM } from './team-members.js?v=credits-grid-1'
import { t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

function mount() {
  const section = document.querySelector('#informacoes')
  if (!section || document.documentElement.dataset.editorialMotionReady !== 'true') return false
  if (section.dataset.teamFinale === 'true') return true
  // Preserve navigation and reading progress on the existing section.
  ScrollTrigger.getAll().forEach(trigger => {
    if (trigger.trigger !== section && trigger.trigger instanceof Element && section.contains(trigger.trigger)) trigger.kill(true)
  })
  section.dataset.teamFinale = 'true'
  section.classList.add('team-finale')
  section.setAttribute('aria-labelledby', 'team-finale-title')
  section.replaceChildren()

  const header = document.createElement('header')
  header.className = 'team-finale-top'
  const title = document.createElement('h2')
  title.id = 'team-finale-title'
  title.textContent = 'Sobre nós'
  header.append(title)
  const intro = document.createElement('div')
  intro.className = 'team-intro'
  intro.innerHTML = '<p>Uma memória também se faz de encontros.</p><p>Direções, olhares e escutas que dão forma ao Hipocampo.</p>'
  const grid = document.createElement('ul')
  grid.className = 'team-credit-grid'
  grid.setAttribute('aria-label', 'Equipe em ordem alfabética')
  TEAM.forEach((member, i) => {
    const item = document.createElement('li')
    item.className = 'team-credit'
    item.style.setProperty('--member-angle', `${[-8, 5, -6, 9][i % 4]}deg`)
    item.style.setProperty('--member-delay', `${i % 4 * 70}ms`)
    item.style.setProperty('--member-phase', `${i * -.65}s`)
    const portrait = document.createElement(member.portrait ? 'button' : 'div')
    portrait.className = 'team-photo-window'
    if (member.portrait) {
      portrait.type = 'button'
      portrait.setAttribute('aria-label', `Animar foto de ${member.name}`)
      portrait.setAttribute('aria-pressed', 'false')
      const float = document.createElement('span')
      float.className = 'team-photo-float'
      const image = document.createElement('img')
      image.src = member.portrait
      image.alt = `Retrato de ${member.name}`
      image.loading = 'lazy'
      image.decoding = 'async'
      image.width = 720
      image.height = 960
      image.draggable = false
      float.append(image)
      portrait.append(float)
      portrait.addEventListener('click', () => {
        const active = item.classList.toggle('is-active')
        portrait.setAttribute('aria-pressed', String(active))
      })
      item.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
          item.classList.remove('is-active')
          portrait.setAttribute('aria-pressed', 'false')
        }
      })
    } else {
      // Credit is complete; no unrelated or invented portrait for Marcos.
      portrait.classList.add('team-photo-unavailable')
      portrait.setAttribute('aria-hidden', 'true')
    }
    const name = document.createElement('h3')
    name.textContent = member.name
    const roles = document.createElement('p')
    roles.className = 'team-credit-roles'
    roles.textContent = member.roles.join(' + ')
    item.append(portrait, name, roles)
    grid.append(item)
  })
  const bottom = document.createElement('footer')
  bottom.className = 'team-finale-bottom'
  bottom.innerHTML = '<p>Hipocampo — uma história em construção.</p><a href="mailto:contato@projetohipocampo.art">Entre em contato</a>'
  section.append(header, intro, grid, bottom)

  // Each row enters when reached. Only visible portraits keep floating.
  const observer = new IntersectionObserver(entries => {
    entries.forEach(({ target, isIntersecting }) => {
      target.classList.toggle('team-in-view', isIntersecting && !document.hidden)
      if (isIntersecting) target.classList.add('team-revealed')
    })
  }, { threshold: .08 })
  grid.querySelectorAll('.team-credit').forEach(item => observer.observe(item))
  const visibility = () => {
    if (document.hidden) grid.querySelectorAll('.team-in-view').forEach(item => item.classList.remove('team-in-view'))
    else grid.querySelectorAll('.team-credit').forEach(item => {
      const rect = item.getBoundingClientRect()
      item.classList.toggle('team-in-view', rect.bottom > 0 && rect.top < innerHeight)
    })
  }
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', () => {
    observer.disconnect()
    document.removeEventListener('visibilitychange', visibility)
    grid.querySelectorAll('.team-in-view').forEach(item => item.classList.remove('team-in-view'))
  }, { once: true })
  window.__hipocampoLenis?.resize()
  ScrollTrigger.refresh()
  return true
}

if (!mount()) window.__hipocampoWhenReady?.(mount)
