import { prepareStoriesLetter } from './stories-letter.js?v=scroll-blank-1'

// Adapt the recovered editorial entry without editing its bundled React code.
export function prepareClientNavigation(header) {
  const nav = header.querySelector('nav')
  if (!nav || nav.dataset.clientNavigation) return
  nav.dataset.clientNavigation = 'true'
  const about = nav.querySelector('a[href="#oficina"]')
  if (about) {
    about.href = '#sobre'
    about.lastChild.textContent = 'sobre o projeto'
  }
  const team = nav.querySelector('a[href="#informacoes"]')
  if (team) team.lastChild.textContent = 'sobre nós'
  const stories = document.createElement('a')
  stories.href = '#relatos'
  stories.className = team?.className || ''
  stories.innerHTML = '<span class="text-brown-soft md:hidden">06</span>relatos'
  nav.insertBefore(stories, team)
  team?.querySelector('span')?.replaceChildren('07')
  // The added link participates in the existing mobile disclosure too.
  stories.addEventListener('click', () => {
    const toggle = header.querySelector('button[aria-controls="site-nav"]')
    if (toggle?.getAttribute('aria-expanded') === 'true') toggle.click()
  })
}

export function prepareClientEditorial() {
  const films = document.querySelector('#fotofilmes')
  if (!films || films.dataset.clientEditorial) return
  films.dataset.clientEditorial = 'true'
  films.classList.add('client-films')
  const heading = films.querySelector('h2')
  if (heading) heading.textContent = 'Fotofilmes'
  const eyebrow = films.querySelector('.eyebrow')
  if (eyebrow) eyebrow.textContent = '05 —'
  films.querySelectorAll('article').forEach((article, index) => {
    article.classList.add('client-film', `client-film--${index + 1}`)
    const label = article.querySelector('.film-index')
    if (label) label.textContent = 'Fotofilme'
    const title = article.querySelector('h3')
    if (index === 0 && title) title.textContent = 'Yolanda'
    article.querySelectorAll(':scope > div:first-child > p:not(.film-index)').forEach(p => { p.hidden = true })
  })
  const spacer = films.querySelector(':scope > .script')
  if (spacer) spacer.hidden = true
  // Keep the existing media first; local archive images cover unavailable
  // external previews until the client supplies the final film files.
  films.querySelectorAll('img').forEach((image, i) => {
    const fallback = () => {
      image.removeEventListener('error', fallback)
      image.alt = 'Fotografia de arquivo — prévia do fotofilme'
      image.src = `/images/trail/photo-${i % 9 + 1}.webp`
    }
    image.addEventListener('error', fallback, { once: true })
    if (image.complete && !image.naturalWidth) fallback()
  })
  const cover = films.querySelector('article:first-of-type > div:nth-child(2)')
  if (cover?.style.background) {
    cover.style.backgroundImage += ', url("/images/trail/photo-2.webp")'
    cover.style.backgroundSize = 'cover'
    cover.style.backgroundPosition = 'center'
    cover.style.backgroundRepeat = 'no-repeat'
  }
  if (!document.querySelector('#relatos')) {
    const stories = document.createElement('section')
    stories.id = 'relatos'
    stories.className = 'client-stories'
    stories.setAttribute('aria-labelledby', 'relatos-title')
    films.after(stories)
  }
  prepareStoriesLetter(document.querySelector('#relatos'))
  const info = document.querySelector('#informacoes')
  const teamHeading = info?.querySelector('h2')
  if (teamHeading) teamHeading.textContent = 'Sobre nós'
  const teamEyebrow = info?.querySelector('.eyebrow')
  if (teamEyebrow) teamEyebrow.textContent = '07 — Sobre nós'
}
