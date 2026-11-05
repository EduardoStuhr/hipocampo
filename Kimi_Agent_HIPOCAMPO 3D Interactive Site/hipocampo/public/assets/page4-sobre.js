// Página 4 — "o Hipocampo": texto de apresentação + fotos que, ao passar o mouse,
// alternam entre quadros como um gif.
const FRAMES = [1, 2, 3, 4].map((i) => `/images/sobre/gif-${i}.webp`)
const PHOTOS = [
  ['retrato', 'Retrato antigo de uma mulher em moldura oval'],
  ['envelope', 'Envelope antigo com fotografias'],
  ['montanha', 'Fotografia antiga de montanhas', '/images/sobre/montanha-restaurada-v1.webp'],
]

function buildSection() {
  const s = document.createElement('section')
  s.id = 'sobre'
  s.className = 'hipocampo-page4'
  s.setAttribute('aria-label', 'Sobre o Hipocampo')
  s.innerHTML = `
    <h2 class="page4-title"><small>o</small>Hipocampo</h2>
    <div class="page4-text">
      <p>Hipocampo é uma instalação e oficina experimental que investiga as relações entre memória, imagem e narrativa.</p>
      <p>A partir de fotografias, objetos, negativos e outros vestígios de uma história desconhecida, os participantes exploram a instalação e constroem suas próprias interpretações.</p>
      <p>Sem respostas definitivas, cada narrativa criada revela uma nova forma de compreender o passado, transformando a memória em uma experiência coletiva de imaginação e descoberta.</p>
    </div>
    <div class="page4-photos">
      ${PHOTOS.map(([n, alt, src]) => `
        <figure class="page4-photo page4-photo--${n}" ${n === 'envelope' ? 'tabindex="0" aria-label="Envelope com fotografias: mova o mouse ou use as setas para explorar"' : ''}>
          <img src="${src || `/images/sobre/${n}.webp`}" alt="${alt}" loading="lazy" />
          ${n === 'envelope' ? `<span class="page4-envelope-window" aria-hidden="true"><img class="page4-envelope-photo" src="${FRAMES[0]}" alt="" /></span>` : ''}
        </figure>`).join('')}
    </div>`
  FRAMES.forEach((f) => { const i = new Image(); i.src = f })
  s.querySelectorAll('.page4-photo').forEach((fig) => {
    // o efeito de gif com o mouse fica apenas na carta (envelope)
    if (!fig.classList.contains('page4-photo--envelope')) return
    const frame = fig.querySelector('.page4-envelope-photo')
    let index = 0, lastX = null, lastY = null, distance = 0, lastChange = -Infinity
    const reset = () => {
      lastX = lastY = null
      distance = 0
      fig.style.setProperty('--envelope-photo-x', '0%')
      fig.style.setProperty('--envelope-photo-y', '0%')
    }
    fig.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return
      const rect = fig.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
      if (lastX !== null) distance += Math.hypot(event.clientX - lastX, event.clientY - lastY)
      lastX = event.clientX
      lastY = event.clientY
      if (distance >= 8 && event.timeStamp - lastChange >= 70) {
        index = (index + 1) % FRAMES.length
        frame.src = FRAMES[index]
        distance = 0
        lastChange = event.timeStamp
      }
      fig.style.setProperty('--envelope-photo-x', `${(x - 0.5) * 5}%`)
      fig.style.setProperty('--envelope-photo-y', `${-y * 6}%`)
    }, { passive: true })
    fig.addEventListener('pointerleave', reset)
    fig.addEventListener('blur', reset)
    fig.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
      event.preventDefault()
      index = (index + (event.key === 'ArrowRight' ? 1 : -1) + FRAMES.length) % FRAMES.length
      frame.src = FRAMES[index]
    })
  })
  return s
}

function init() {
  const casa = document.querySelector('#casa')
  if (!casa) return false
  if (document.querySelector('#sobre')) return true
  casa.after(buildSection())
  window.dispatchEvent(new Event('resize'))
  return true
}

if (!init()) {
  const iv = setInterval(() => { if (init()) clearInterval(iv) }, 200)
}
