import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

gsap.registerPlugin(ScrollTrigger)

const titleText = 'O Hipocampo'
const copyParagraphs = [
  'Hipocampo é um projeto de instalação audiovisual desenvolvido por estudantes de Cinema e Audiovisual do Centro Universitário SENAC. A oficina aborda a relação essencial entre memória e identidade, colocando em foco o efeito do esquecimento na preservação da história de um indivíduo. Com base nisso, Hipocampo explora a possibilidade de reconstruir narrativas a partir de recordações fragmentadas e desordenadas, ofuscadas pela amnésia.',
  'A experiência acontece em um espaço onírico, representativo de um limbo entre a lembrança e a deslembrança, no qual participantes recebem diversas fotografias, objetos e diferentes materiais que podem constituir a vida de uma pessoa. Ao analisar os fragmentos, cabe ao grupo participante ordenar e conectar os materiais escolhidos da forma que achar melhor, construindo uma história com os lapsos apresentados. No fim, o grupo nomeia a personagem que protagoniza o enredo criado, narra a história através de um áudio que será gravado no momento e o resultado é exposto neste site como um fotofilme, dialogando com uma segunda interpretação desenvolvida pelos organizadores. Não há uma narrativa pré definida ou uma resposta correta, a experiência é justamente o diálogo entre as diferentes formas de deduzir as lembranças colocadas.',
]

function titleMarkup(text) {
  return text.split(' ').map((word) => (
    `<span class="page2-title-word" aria-hidden="true">${word}</span>`
  )).join(' ')
}

function createPage2Markup() {
  const inner = document.createElement('div')
  inner.className = 'hipocampo-page2-inner'

  inner.innerHTML = `
    <h2 id="hipocampo-page2-title" class="hipocampo-page2-title" aria-label="${titleText}">
      ${titleMarkup(titleText)}
    </h2>
    <div class="hipocampo-page2-copy">
      ${copyParagraphs.map(text => `<p class="page2-copy-paragraph"><span class="page2-copy-line">${text}</span></p>`).join('')}
      <div data-house-preparation-slot></div>
    </div>
    <div class="page2-map-stage"><div class="hipocampo-memory-map" data-memory-map role="img" aria-label="Mapa de memória formado por fragmentos conectados a uma casa central"></div></div>
  `

  return inner
}

function clearLegacyProjectAnimation(project) {
  ScrollTrigger.getAll().forEach((trigger) => {
    if (trigger.trigger === project) {
      trigger.animation?.kill()
      trigger.kill(true)
    }
  })
  gsap.set(project, { clearProps: 'opacity,transform,translate,rotate,scale' })
}

function initializePage2Motion() {
  const project = document.querySelector('#projeto')
  const header = document.querySelector('body > #root > header')

  if (!project || !header) {
    return false
  }

  if (project.dataset.page2MotionReady === 'true') {
    return true
  }

  window.__hipocampoPage2Cleanup?.()
  clearLegacyProjectAnimation(project)

  const original = {
    className: project.className,
    style: project.getAttribute('style'),
    ariaLabelledby: project.getAttribute('aria-labelledby'),
    nodes: [...project.childNodes].map((node) => node.cloneNode(true)),
  }

  project.className = 'hipocampo-page2'
  project.removeAttribute('style')
  project.setAttribute('aria-labelledby', 'hipocampo-page2-title')
  project.dataset.page2MotionReady = 'true'
  project.replaceChildren(createPage2Markup())

  const titleWords = [...project.querySelectorAll('.page2-title-word')]
  const copyLineElements = [...project.querySelectorAll('.page2-copy-line')]
  const memoryMap = project.querySelector('.hipocampo-memory-map')
  const headerItems = [...header.children]
  let mapEntranceTween = null

  gsap.set(memoryMap, { opacity: 0, scale: 0.92, transformOrigin: '50% 50%' })

  const animateMemoryMap = () => {
    if (
      !memoryMap
      || memoryMap.dataset.memoryMapDecoded !== 'true'
      || project.dataset.memoryMapEntranceReady === 'true'
    ) return

    project.dataset.memoryMapEntranceReady = 'true'
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    mapEntranceTween = gsap.fromTo(memoryMap, {
      opacity: 0,
      scale: reducedMotion ? 1 : 0.92,
    }, {
      opacity: 1,
      scale: 1,
      duration: reducedMotion ? 0 : 0.9,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: project,
        start: 'top 76%',
        toggleActions: 'play none none reverse',
      },
    })
  }

  project.addEventListener('hipocampo:memory-map-ready', animateMemoryMap)

  const ctx = gsap.context(() => {
    // Safari can clip the long Aquiline flourishes on transformed inline boxes.
    // On phones, reveal the complete heading without moving individual words.
    const phoneTitle = window.matchMedia('(max-width: 767px)').matches
    gsap.from(phoneTitle ? project.querySelector('.hipocampo-page2-title') : titleWords, {
      ...(phoneTitle ? {} : { yPercent: 120, rotation: 8 }),
      opacity: 0,
      stagger: 0.08,
      duration: 1.05,
      ease: 'expo.out',
      scrollTrigger: {
        trigger: project,
        start: 'top 78%',
        toggleActions: 'play none none reverse',
      },
    })

    gsap.from(copyLineElements, {
      opacity: 0,
      y: 20,
      stagger: 0.06,
      duration: 0.85,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: project,
        start: 'top 72%',
        toggleActions: 'play none none reverse',
      },
    })

    ScrollTrigger.create({
      trigger: project,
      start: 'top top',
      end: 'bottom top',
      onEnter: () => document.documentElement.classList.add('hipocampo-on-page2'),
      onEnterBack: () => {
        document.documentElement.classList.add('hipocampo-on-page2')
        gsap.set(headerItems, { opacity: 0, y: -80 })
      },
      onLeave: () => {
        document.documentElement.classList.remove('hipocampo-on-page2')
        document.documentElement.classList.remove('hipocampo-transition-white')
        gsap.to(headerItems, {
          opacity: 1,
          y: 0,
          duration: 0.45,
          ease: 'power2.out',
          overwrite: false,
        })
      },
      onLeaveBack: () => document.documentElement.classList.remove('hipocampo-on-page2'),
    })
  }, project)

  animateMemoryMap()

  const refreshFrame = window.requestAnimationFrame(() => ScrollTrigger.refresh())

  const cleanup = () => {
    window.cancelAnimationFrame(refreshFrame)
    window.removeEventListener('pagehide', cleanup)
    project.removeEventListener('hipocampo:memory-map-ready', animateMemoryMap)
    mapEntranceTween?.kill()
    window.__hipocampoMemoryMapCleanup?.()
    ctx.revert()
    document.documentElement.classList.remove('hipocampo-on-page2')
    project.className = original.className
    if (original.style === null) project.removeAttribute('style')
    else project.setAttribute('style', original.style)
    if (original.ariaLabelledby === null) project.removeAttribute('aria-labelledby')
    else project.setAttribute('aria-labelledby', original.ariaLabelledby)
    project.replaceChildren(...original.nodes.map((node) => node.cloneNode(true)))
    delete project.dataset.page2MotionReady
    delete project.dataset.memoryMapEntranceReady
    delete window.__hipocampoPage2Cleanup
  }

  window.__hipocampoPage2Cleanup = cleanup
  window.addEventListener('pagehide', cleanup, { once: true })
  return true
}

if (!initializePage2Motion()) {
  window.__hipocampoWhenReady?.(initializePage2Motion)
}
