// Página 4 — "Simulação 3D": texto de apresentação + fotos que, ao passar o mouse,
// alternam entre quadros como um gif.
const FRAMES = [1, 2, 3, 4].map((i) => `/images/sobre/gif-${i}.webp`)
const PHOTOS = [
  ['retrato', 'Retrato de uma mulher na moldura oval rendada enviada', '/images/sobre/moldura-b2a620ab905d.png'],
  ['envelope', 'Envelope antigo com fotografias'],
  ['geladeira', 'Geladeira antiga verde', '/images/sobre/geladeira-9fa54f4430b6.png'],
]

function buildSection() {
  const s = document.createElement('section')
  s.id = 'sobre'
  s.className = 'hipocampo-page4'
  s.setAttribute('aria-label', 'Simulação 3D')
  s.innerHTML = `
    <h2 class="page4-title">Simulação 3D</h2>
    <div class="page4-text">
      <p><strong>A simulação mostra as quatro ilhas componentes da oficina:</strong> A ilha do pas&shy;sado, da temporalidade, do presente e dos futuros, respectivamente representadas por um cabideiro, uma geladeira, uma escrivaninha e uma mesa branca centralizada. O usuário pode selecionar qualquer objeto e arrastá-lo para a ilha dos futuros, e a história é criada a partir da ordem em que os objetos são posicionados.<br />Também é possível aproximar ou afastar a visão, direcioná-la com o mouse e obser&shy;var a ilha de cima. Ao finalizar, há a opção de tirar uma foto mostrando os fragmentos escolhidos, que é salva automaticamente no computador do usuário.</p>
    </div>
    <div class="page4-photos">
      ${PHOTOS.map(([n, alt, src]) => `
        <figure class="page4-photo page4-photo--${n}" ${n === 'envelope' ? 'tabindex="0" aria-label="Envelope com fotografias: mova o mouse ou use as setas para explorar"' : ''}>
          <img src="${src || `/images/sobre/${n}.webp`}" alt="${alt}" loading="lazy" />
          ${n === 'envelope' ? `<span class="page4-envelope-window" aria-hidden="true"><img class="page4-envelope-photo" src="${FRAMES[0]}" alt="" /></span>` : ''}
        </figure>`).join('')}
    </div>`
  // Anchor the portrait to the actual section boundary, half on each page.
  s.append(s.querySelector('.page4-photo--retrato'))
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
  const section = buildSection()
  casa.after(section)
  const fridge = section.querySelector('.page4-photo--geladeira')
  const near = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return
    near.disconnect()
    import('./fridge-showcase.js?v=memory-archive-3').then(({ mountFridgeShowcase }) => mountFridgeShowcase(fridge)).catch(() => {})
  }, { rootMargin: '500px 0px' })
  near.observe(fridge)
  window.dispatchEvent(new Event('resize'))
  return true
}

if (!init()) {
  const iv = setInterval(() => { if (init()) clearInterval(iv) }, 200)
}
