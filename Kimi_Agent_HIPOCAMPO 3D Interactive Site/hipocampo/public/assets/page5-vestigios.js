// Página 5 — "vestígios": entra logo após a página 4 (#sobre).
import { n as gsap } from './index-BXEErpTi.js?v=perf-1'
import { mountStoryPalette } from './story-palette.js?v=layout-restore-1'
import { measurePhotoLayout, positionPhoto } from './camera-photo-layout.js?v=layout-restore-1'

const PHOTO_LIFETIME = 5000
const PHOTO_FADE = 450

const PHOTOGRAPHS = Array.from({ length: 9 }, (_, i) => ({
  src: `/images/trail/photo-${i + 1}.webp`,
  alt: ['Fotografia de uma família', 'Fotografia de rochas junto ao mar', 'Fotografia de uma cadeia de montanhas', 'Fotografia de pássaros em voo'][i] || `Fotografia ${i + 1} do acervo do Hipocampo`,
}))
const SHAPES = [
  { name: 'círculo', clip: 'circle(48% at 50% 50%)' },
  { name: 'triângulo', clip: 'polygon(50% 3%, 97% 94%, 3% 94%)' },
  { name: 'quadrado', clip: 'polygon(6% 6%, 94% 6%, 94% 94%, 6% 94%)' },
  { name: 'hexágono', clip: 'polygon(25% 6%, 75% 6%, 99% 50%, 75% 94%, 25% 94%, 1% 50%)' },
  { name: 'losango', clip: 'polygon(50% 1%, 99% 50%, 50% 99%, 1% 50%)' },
  { name: 'pentágono', clip: 'polygon(50% 2%, 98% 38%, 80% 96%, 20% 96%, 2% 38%)' },
  { name: 'octógono', clip: 'polygon(30% 2%, 70% 2%, 98% 30%, 98% 70%, 70% 98%, 30% 98%, 2% 70%, 2% 30%)' },
  { name: 'trapézio', clip: 'polygon(22% 9%, 78% 9%, 98% 91%, 2% 91%)' },
]

// A shuffled bag visits every choice before repeating, including at its seam.
function createPicker(choices) {
  let remaining = [], previous = null
  return () => {
    if (!remaining.length) {
      remaining = [...choices]
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[remaining[i], remaining[j]] = [remaining[j], remaining[i]]
      }
      if (remaining[0] === previous) [remaining[0], remaining[1]] = [remaining[1], remaining[0]]
    }
    previous = remaining.shift()
    return previous
  }
}

function mountCamera(section) {
  const shutter = section.querySelector('.page5-shutter')
  const gallery = section.querySelector('.page5-revealed-photos')
  const status = section.querySelector('.page5-camera-status')
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  const choosePhoto = createPicker(PHOTOGRAPHS), chooseShape = createPicker(SHAPES)
  const loaded = new Map(), prints = new Set()
  let queue = Promise.resolve(), requests = 0, revealed = 0, destroyed = false, visible = false
  let shutterMotion = null

  const load = photo => {
    if (!loaded.has(photo.src)) {
      const image = new Image()
      image.decoding = 'async'
      image.src = photo.src
      loaded.set(photo.src, image.decode().then(() => image).catch(error => {
        loaded.delete(photo.src)
        throw error
      }))
    }
    return loaded.get(photo.src)
  }
  const near = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    if (visible) load(PHOTOGRAPHS[0]).catch(() => {})
  }, { rootMargin: '200px 0px' })
  near.observe(section)

  const remove = print => {
    if (!prints.delete(print)) return
    window.clearTimeout(print.fadeTimer)
    window.clearTimeout(print.removeTimer)
    print.enter?.kill()
    print.exit?.kill()
    print.element.remove()
  }
  const fade = print => {
    if (!prints.has(print)) return
    const remaining = print.expiresAt - performance.now()
    if (remaining <= 0) return remove(print)
    if (reduced.matches || document.hidden || !visible) return
    print.element.dataset.state = 'fading'
    print.exit = gsap.to(print.element, { opacity: 0, duration: remaining / 1000, ease: 'power1.out', onComplete: () => { print.exit = null } })
  }
  const layoutPrints = () => {
    if (!prints.size) return
    const layout = measurePhotoLayout(section, gallery), occupied = []
    prints.forEach(print => {
      if (performance.now() >= print.expiresAt) return remove(print)
      print.enter?.kill()
      print.enter = null
      if (print.element.dataset.state !== 'fading') print.element.dataset.state = 'visible'
      print.size = print.element.offsetWidth
      const point = positionPhoto(layout, print.size, print.angle, occupied, print.number - 1)
      print.bounds = point.bounds
      occupied.push(point.bounds)
      print.element.style.left = `${point.x}px`
      print.element.style.top = `${point.y}px`
      gsap.set(print.element, { x: 0, y: 0, scale: 1, rotation: print.angle, ...(print.element.dataset.state === 'fading' ? {} : { opacity: 1 }) })
      gsap.set(print.image, { opacity: 1 })
    })
  }
  const resize = new ResizeObserver(layoutPrints)
  resize.observe(gallery)
  const onVisibility = () => {
    prints.forEach(print => { if (performance.now() >= print.expiresAt) remove(print) })
  }
  document.addEventListener('visibilitychange', onVisibility)
  const reveal = (photo, shape, image) => {
    const quiet = reduced.matches || document.hidden || !visible
    revealed++
    const element = document.createElement('figure')
    element.className = 'page5-generated-photo'
    element.dataset.shape = shape.name
    element.dataset.photoNumber = String(revealed)
    element.dataset.state = quiet ? 'visible' : 'entering'
    element.style.setProperty('--photo-shape', shape.clip)
    const paper = document.createElement('span')
    paper.className = 'page5-photo-paper'
    const printImage = image.cloneNode()
    printImage.alt = `${photo.alt}, recorte em ${shape.name}`
    paper.append(printImage)
    element.append(paper)
    gallery.append(element)
    const angle = -8 + Math.random() * 15
    const size = element.offsetWidth
    const layout = measurePhotoLayout(section, gallery)
    const point = positionPhoto(layout, size, angle, [...prints].map(print => print.bounds), revealed - 1)
    element.style.left = `${point.x}px`
    element.style.top = `${point.y}px`
    const print = { element, image: printImage, angle, number: revealed, size, bounds: point.bounds, enter: null, exit: null, expiresAt: performance.now() + PHOTO_LIFETIME, fadeTimer: 0, removeTimer: 0 }
    prints.add(print)
    gsap.set(element, { xPercent: -50, yPercent: -50 })
    const pose = { x: 0, y: 0, scale: 1, rotation: angle, opacity: 1 }
    if (quiet) gsap.set(element, pose)
    else {
      const from = shutter.getBoundingClientRect()
      const x = (from.left + from.width / 2 - layout.rect.left) / layout.sx - point.x
      const y = (from.top + from.height / 2 - layout.rect.top) / layout.sy - point.y
      print.enter = gsap.timeline({ onComplete: () => { print.enter = null; element.dataset.state = 'visible' } })
        .fromTo(element, { x, y, scale: .12, rotation: angle - 15, opacity: 0 }, { ...pose, duration: .8, ease: 'power3.out' }, 0)
        .fromTo(printImage, { opacity: 0 }, { opacity: 1, duration: .65, ease: 'power2.out' }, .12)
    }
    print.fadeTimer = window.setTimeout(() => fade(print), PHOTO_LIFETIME - PHOTO_FADE)
    print.removeTimer = window.setTimeout(() => remove(print), PHOTO_LIFETIME)
    status.textContent = `Fotografia ${revealed} revelada em forma de ${shape.name}, visível por cinco segundos. Clique no disparador para gerar outra.`
  }
  const generate = () => {
    if (destroyed) return
    const photo = choosePhoto(), shape = chooseShape()
    requests++
    shutter.setAttribute('aria-busy', 'true')
    shutterMotion?.kill()
    if (!reduced.matches) shutterMotion = gsap.fromTo(shutter, { scale: .88 }, { scale: 1, duration: .2, ease: 'power2.out', onComplete: () => { shutterMotion = null } })
    // Keep rapid clicks in order. Each print owns its five-second deadline.
    queue = queue.then(async () => {
      if (destroyed) return
      try {
        const image = await load(photo)
        if (!destroyed) reveal(photo, shape, image)
      } catch {
        if (!destroyed) status.textContent = 'Não foi possível revelar esta fotografia. Clique no disparador para tentar outra.'
      } finally {
        requests--
        if (!destroyed) shutter.setAttribute('aria-busy', String(requests > 0))
      }
    })
  }
  const cleanup = () => {
    destroyed = true
    near.disconnect()
    resize.disconnect()
    document.removeEventListener('visibilitychange', onVisibility)
    shutter.removeEventListener('click', generate)
    shutterMotion?.kill()
    prints.forEach(remove)
    loaded.clear()
  }
  shutter.addEventListener('click', generate)
  window.addEventListener('pagehide', cleanup, { once: true })
}

function buildSection() {
  const s = document.createElement('section')
  s.id = 'vestigios'
  s.className = 'hipocampo-page5'
  s.setAttribute('aria-label', 'A memória desaparecida')
  s.innerHTML = `
    <div class="page5-color-panel" aria-hidden="true"></div>
    <div class="page5-left">
      <p class="page5-text">Ao chegar ao Hipocampo, cada participante recebe uma sinopse que apresenta os primeiros vestígios de uma memória desaparecida, marcada por ausências e perguntas sem resposta, nova possibilidade de memória, revelando como atribuímos significado às imagens e aos objetos que sobrevivem ao tempo.</p>
      <div class="page5-camera-control">
        <img class="page5-camera" draggable="false" src="/images/vestigios/camera-topo.webp" width="1259" height="717" alt="Câmera fotográfica antiga prateada" loading="lazy" />
        <button class="page5-shutter" type="button" aria-label="Gerar fotografia pelo disparador" aria-describedby="page5-camera-hint" aria-controls="page5-revealed-photos" title="Gerar fotografia"></button>
      </div>
      <p id="page5-camera-hint" class="page5-camera-hint">gerar fotografia</p>
      <p class="page5-camera-status" role="status" aria-live="polite" aria-atomic="true">Clique no disparador da câmera para revelar fotografias do acervo em formas diferentes, visíveis por cinco segundos.</p>
    </div>
    <div class="page5-right">
      <img class="page5-colagem" src="/images/vestigios/colagem.webp" alt="Colagem de fotografias em preto e branco com recorte laranja" loading="lazy" />
      <img class="page5-filme" src="/images/vestigios/filme.webp" alt="Duas mulheres com rostos cobertos por círculos vermelhos, sob uma tira de filme com carta manuscrita" loading="lazy" />
      <p class="page5-brand" aria-hidden="true">Hipocampo</p>
    </div>
    <div id="page5-revealed-photos" class="page5-revealed-photos" role="group" aria-label="Fotografias reveladas"></div>`
  return s
}

function init() {
  const sobre = document.querySelector('#sobre')
  if (!sobre) return false
  if (document.querySelector('#vestigios')) return true
  sobre.after(buildSection())
  mountCamera(document.querySelector('#vestigios'))
  mountStoryPalette(sobre, document.querySelector('#vestigios'))
  window.dispatchEvent(new Event('resize'))
  return true
}

if (!init()) {
  const iv = setInterval(() => { if (init()) clearInterval(iv) }, 200)
}
