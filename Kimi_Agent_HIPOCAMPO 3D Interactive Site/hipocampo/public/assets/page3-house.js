// A continuous camera passes through a physical doorway, crosses the archive
// and leaves through its far opening. The original memory map stays aligned.
import * as THREE from './vendor/three.module.min.js'
import { createHousePreparation } from './house-preparation.js?v=house-gpu-2'
import { createRenderBudget } from './render-budget.js?v=fps-1'
import { createHouseInterior } from './house-interior.js?v=door-open-2'
import { fitHouseDoorway } from './house-doorway.js?v=door-fit-1'
import { createHouseLook } from './house-look.js?v=house-gpu-2'
import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'
import { yieldScenePreparation, prepareSceneMaterials, warmScene } from './scene-preparation.js?v=house-gpu-2'

gsap.registerPlugin(ScrollTrigger)

const MANIFEST_URL = '/images/map/manifest.json'
let manifestRequest
function loadManifest() {
  return manifestRequest ||= fetch(MANIFEST_URL).then(response => {
    if (!response.ok) throw new Error('Não foi possível carregar o mapa da casa')
    return response.json()
  }).catch(error => { manifestRequest = null; throw error })
}
// Fetch metadata while module dependencies and the opening chapter settle.
loadManifest().catch(() => {})
// Slightly widen the opening interval without extending the whole journey.
const DOOR_OPEN_START = .28, DOOR_OPEN_END = .51
const UNIT = 16 // the photographed doorway is approximately 1 × 2.3 metres
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const lerp = (a, b, t) => a + (b - a) * t
const setOpacity = (element, value) => { const opacity = String(value); if (element.style.opacity !== opacity) element.style.opacity = opacity }

function buildSection() {
  const section = document.createElement('section')
  section.id = 'casa'
  section.className = 'hipocampo-page3'
  section.setAttribute('aria-label', 'Transição: entrando na casa da memória')
  section.innerHTML = `
    <div class="page3-stage">
      <div class="page3-preview" aria-hidden="true"></div>
      <div class="page3-render"><canvas class="page3-canvas" aria-hidden="true"></canvas></div>
      <p class="page3-caption page3-caption--a">cada fragmento aponta para um lugar</p>
      <p class="page3-caption page3-caption--b">entre na casa</p>
      <p class="page3-description">Uma passagem tridimensional pela casa da memória: atravesse a porta, percorra a galeria de fotografias e siga a luz até a próxima seção. O caminho se recompõe ao rolar de volta.</p>
    </div>`
  return section
}

function untilAborted(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason)
    if (signal.aborted) return abort()
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

async function mount(section, controller, onFailure, onProgress) {
  const disposers = []
  let disposed = false, ready = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    disposers.reverse().forEach(cleanup => cleanup())
    delete section.houseJourney
  }
  const cancelled = () => {
    // A lost context is an error even though cancellation stops the pending work.
    dispose()
    if (ready && controller.signal.reason?.name !== 'AbortError') onFailure(controller.signal.reason)
  }
  controller.signal.addEventListener('abort', cancelled, { once: true })
  try {
  const manifest = await untilAborted(loadManifest(), controller.signal)
  await yieldScenePreparation(controller.signal, { allowDuringScroll: true })
  const canvas = section.querySelector('.page3-canvas')
  const stage = section.querySelector('.page3-stage')
  const capA = section.querySelector('.page3-caption--a')
  const capB = section.querySelector('.page3-caption--b')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, stencil: true, premultipliedAlpha: false, powerPreference: 'high-performance' })
  // Install recovery before textures, shaders or GPU warm-up can fail.
  const contextLost = event => {
    event.preventDefault()
    controller.abort(new Error('A conexão gráfica da casa foi interrompida'))
  }
  canvas.addEventListener('webglcontextlost', contextLost)
  disposers.push(() => {
    canvas.removeEventListener('webglcontextlost', contextLost)
    renderer.dispose()
    renderer.forceContextLoss()
  })
  const renderBudget = createRenderBudget(renderer)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = .95
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const scene = new THREE.Scene()
  disposers.push(() => {
    const resources = new Set()
    scene.traverse(object => {
      if (object.geometry) resources.add(object.geometry)
      const materials = Array.isArray(object.material) ? object.material : [object.material]
      materials.filter(Boolean).forEach(material => {
        resources.add(material)
        Object.values(material).forEach(value => { if (value?.isTexture) resources.add(value) })
      })
      if (object.isLight) object.dispose?.()
    })
    resources.forEach(resource => resource.dispose())
  })
  const paper = new THREE.Color('#ffffff')
  scene.fog = new THREE.Fog(paper, 100, 200)
  const camera = new THREE.PerspectiveCamera(42, 1, .025, 300)
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy())
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = motionPreference.matches
  section.classList.toggle('is-reduced-motion', reduced)

  const cx = manifest.width / 2, cy = manifest.height / 2
  const toWorld = (px, py) => new THREE.Vector3((px - cx) / UNIT, -(py - cy) / UNIT, 0)
  const textureReady = []
  let loadedTextures = 0
  const loader = new THREE.TextureLoader()
  const loadTexture = (url) => {
    let texture
    textureReady.push(new Promise((resolve, reject) => {
      texture = loader.load(url, () => {
        if (disposed) texture.dispose()
        loadedTextures++
        if (!controller.signal.aborted) onProgress('textures', loadedTextures, textureReady.length)
        resolve(texture)
      }, undefined, () => reject(new Error(`Não foi possível carregar a imagem ${url}`)))
    }))
    return texture
  }

  // ---------- peças do mapa ----------
  const pieces = manifest.pieces.map((d, i) => {
    const tex = loadTexture(d.src.replace('.webp', '-hd.webp')); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso
    // The facade is a depth-writing cutout, so door/interior ordering cannot
    // change as the camera approaches its transparent photographic silhouette.
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: d.tipo !== 'casa', alphaTest: 0.02, alphaToCoverage: d.tipo === 'casa', depthWrite: d.tipo === 'casa', fog: true, toneMapped: false })
    const w = d.w / UNIT, h = d.h / UNIT
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
    if (d.tipo === 'casa') mesh.renderOrder = -20
    const center = toWorld(d.center.xPct / 100 * manifest.width, d.center.yPct / 100 * manifest.height)
    const rectCenter = toWorld(d.x + d.w / 2, d.y + d.h / 2)
    const group = new THREE.Group()
    group.position.copy(center)
    mesh.position.copy(rectCenter.clone().sub(center)) // gira em torno do centro original
    group.add(mesh)
    scene.add(group)
    const anchorLocal = toWorld(d.anchorPiece.xPct / 100 * manifest.width, d.anchorPiece.yPct / 100 * manifest.height).sub(center)
    const house = toWorld(d.anchorHouse.xPct / 100 * manifest.width, d.anchorHouse.yPct / 100 * manifest.height)
    const dir = center.clone().sub(new THREE.Vector3(0, 0, 0)); dir.z = 0
    const seed = Math.sin(i * 91.7) * 0.5 + 0.5
    return { d, group, mesh, mat, center, anchorLocal, house, dir: dir.normalize(), phase: i * 0.73, seed }
  })
  const housePiece = pieces.find((p) => p.d.tipo === 'casa')
  const others = pieces.filter((p) => p !== housePiece)

  // ---------- brilho de fundo (mesmo ::before do mapa da página 2) ----------
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 256
  const gg = glowC.getContext('2d'); const gr = gg.createRadialGradient(128, 128, 0, 128, 128, 128)
  gr.addColorStop(0, 'rgba(241,237,226,0.74)'); gr.addColorStop(0.72, 'rgba(241,237,226,0)')
  gg.fillStyle = gr; gg.fillRect(0, 0, 256, 256)
  const glowTex = new THREE.CanvasTexture(glowC); glowTex.colorSpace = THREE.SRGBColorSpace
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false, toneMapped: false })
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(manifest.width / UNIT * 0.84, manifest.height / UNIT * 0.72), glowMat)
  glow.position.set(0, 0, -0.05); glow.renderOrder = -1
  scene.add(glow)

  // ---------- fios ----------
  const linePositions = new Float32Array(others.length * 6)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const lineMat = new THREE.LineBasicMaterial({ color: manifest.lineColor, transparent: true, toneMapped: false })
  const lines = new THREE.LineSegments(lineGeo, lineMat)
  lines.frustumCulled = false
  scene.add(lines)

  const doorway = fitHouseDoorway(housePiece.d, UNIT, toWorld)
  const door = doorway.center
  const archive = createHouseInterior({ scene, door, facade: housePiece.mat, doorway, unit: UNIT, pieces: others, loadTexture })

  // ---------- câmera ----------
  const mapH = manifest.height / UNIT
  const fitZ = () => {
    const vFov = THREE.MathUtils.degToRad(camera.fov)
    const zH = (mapH * 1.08) / (2 * Math.tan(vFov / 2))
    const zW = (manifest.width / UNIT * 1.15) / (2 * Math.tan(vFov / 2) * camera.aspect)
    return Math.max(zH, zW)
  }
  const housePos = housePiece.center
  const camPos = new THREE.Vector3(), lookAt = new THREE.Vector3()
  const pathPoint = new THREE.Vector3()
  const passage = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.55, 4.8),
    new THREE.Vector3(.035, 1.55, 1.8),
    new THREE.Vector3(-.035, 1.55, -.6),
    new THREE.Vector3(-.45, 1.59, -3.4),
    new THREE.Vector3(-.64, 1.55, -6.25),
    new THREE.Vector3(.3, 1.56, -9.4),
    new THREE.Vector3(.12, 1.55, -12),
    new THREE.Vector3(0, 1.55, -15.4),
  ], false, 'centripetal')
  const pointer = { x: 0, y: 0, sx: 0, sy: 0, dx: 0, dy: 0, known: false }

  const domMap = document.querySelector('#projeto [data-memory-map]')
  const setMapCovered = covered => {
    if (!domMap) return
    if (domMap.dataset.houseCovered === String(covered)) return
    domMap.style.visibility = covered ? 'hidden' : ''
    domMap.dataset.houseCovered = String(covered)
    domMap.dispatchEvent(new Event('hipocampo:map-coverage'))
  }
  let startRect = null
  const measureStart = () => {
    if (!domMap) return
    const r = domMap.getBoundingClientRect(), s0 = section.getBoundingClientRect()
    // The DOM map has its own entrance scale. Its final layout height keeps
    // the camera handoff stable after a refresh and when scrolling backwards.
    if (r.width) startRect = { cx: r.left + r.width / 2, cy: r.top - s0.top + r.height / 2, h: domMap.clientHeight || r.height }
  }
  let viewportW = 1, viewportH = 1
  const exitPaper = new THREE.Color('#ffffff')
  const updatePaperColor = () => {
    // #sobre is inserted by another module after mount has started.
    const next = document.querySelector('#sobre') || section.nextElementSibling
    const color = next && getComputedStyle(next).backgroundColor
    exitPaper.set(color && color !== 'rgba(0, 0, 0, 0)' ? color : '#ffffff')
    archive.setPaper(exitPaper)
  }
  const resize = () => {
    if (disposed) return
    measureStart()
    viewportW = Math.max(1, stage.clientWidth)
    viewportH = Math.max(1, stage.clientHeight)
    renderBudget.resize(viewportW, viewportH)
    camera.aspect = viewportW / viewportH
    camera.updateProjectionMatrix()
    archive.resize(camera.aspect)
    if (prepared && archive.staticLightingDirty()) {
      archive.prepareStaticLighting(controller.signal).then(wake).catch(error => { if (!controller.signal.aborted) controller.abort(error) })
    }
    renderer.shadowMap.needsUpdate = true
    updatePaperColor()
    staticDirty = true
    if (visible && !raf) raf = requestAnimationFrame(frame)
  }

  let target = 0, progress = 0, visible = false, raf = 0, lastFrame = 0
  let page3Intersecting = false, staticDirty = true, prepared = false
  let lastInteraction = performance.now()
  const wake = () => {
    staticDirty = true
    lastInteraction = performance.now()
    if (visible && !raf) {
      lastFrame = 0
      renderBudget.reset()
      raf = requestAnimationFrame(frame)
    }
  }
  const look = createHouseLook({ THREE, section, stage, canvas, camera, invalidate: wake })
  disposers.push(() => { look.dispose(); section.classList.remove('has-house-look', 'is-house-looking', 'is-house-dragging') })
  const heroFinished = () => (ScrollTrigger.getById('hipocampo-page1-page2')?.progress ?? 1) >= .999
  const scroll = ScrollTrigger.create({
    id: 'hipocampo-house',
    trigger: section, start: 'top top', end: 'bottom bottom',
    onUpdate: (st) => {
      target = st.progress
      if (prepared) updateRenderActivity()
      if (target <= 0.0005 && !reduced) {
        setMapCovered(false)
        canvas.style.opacity = '0'
      }
    },
    onRefresh: () => {
      measureStart()
      updatePaperColor()
    },
  })
  disposers.push(() => { scroll.kill(); cancelAnimationFrame(raf); setMapCovered(false) })
  target = progress = scroll.progress
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(stage)
  disposers.push(() => resizeObserver.disconnect())
  const onPointerMove = (e) => {
    if (e.pointerType === 'touch') return
    const x = (e.clientX / window.innerWidth) * 2 - 1
    const y = (e.clientY / window.innerHeight) * 2 - 1
    if (pointer.known) {
      pointer.dx += x - pointer.x
      pointer.dy += y - pointer.y
    }
    pointer.x = x
    pointer.y = y
    pointer.known = true
    wake()
  }
  let pointerListening = false
  const setPointerListening = (enabled) => {
    if (enabled === pointerListening) return
    pointerListening = enabled
    if (enabled) window.addEventListener('pointermove', onPointerMove, { passive: true })
    else {
      window.removeEventListener('pointermove', onPointerMove)
      pointer.x = pointer.y = pointer.sx = pointer.sy = 0
      pointer.dx = pointer.dy = 0
      pointer.known = false
    }
  }

  disposers.push(() => setPointerListening(false))
  let piecesWereVisible = true
  const tmp = new THREE.Vector3()
  canvas.style.opacity = '0'
  const frame = (now) => {
    if (disposed) return
    raf = visible && !reduced ? requestAnimationFrame(frame) : 0
    if (!reduced && renderBudget.sample(now)) staticDirty = true
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.1)
    lastFrame = now
    if (reduced && !staticDirty) return
    staticDirty = false
    progress += (target - progress) * (1 - Math.exp(-dt * 16))
    if (Math.abs(target - progress) < 0.0001) progress = target
    const p = reduced ? .69 : progress
    const insideRoom = p >= .5 && p <= .88
    // Freeze only the idle rest phase after input stops. Springs still settle,
    // and any mouse, keyboard, resize or scroll resumes rendering immediately.
    const t = reduced ? 0 : insideRoom ? Math.min(now, lastInteraction + 1000) : now
    const motion = reduced ? 0 : 1
    const pointerDamping = 1 - Math.exp(-dt * 3.1)
    pointer.sx += (pointer.x - pointer.sx) * pointerDamping
    pointer.sy += (pointer.y - pointer.sy) * pointerDamping

    // fases do scroll
    const focus = smooth(0, .34, p)
    const travel = clamp((p - .34) / .66, 0, 1)
    const enter = travel < .12 ? travel * smooth(0, .12, travel) : travel > .96 ? 1 - (1 - travel) * smooth(0, .04, 1 - travel) : travel
    const open = smooth(DOOR_OPEN_START, DOOR_OPEN_END, p)
    const explode = smooth(.02, .35, p)
    const vanish = smooth(.24, .42, p)
    const leave = reduced ? 0 : smooth(.87, .995, p)
    const interiorMotion = motion * smooth(.47, .55, p) * (1 - smooth(.88, .97, p))
    const fov = lerp(42, viewportW < 760 ? 64 : 48, smooth(.12, .43, p))
    if (Math.abs(camera.fov - fov) > .001) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // peças: movimento de respiração original (mantido) + dispersão 3D
    const piecesVisible = vanish < .999
    if (piecesVisible) others.forEach((pc) => {
      const idleX = Math.sin(t * 0.00042 + pc.phase) * 0.028 * motion
      const idleY = Math.cos(t * 0.00036 + pc.phase * 1.17) * 0.024 * motion
      const idleR = Math.sin(t * 0.00025 + pc.phase) * 0.38 * motion
      const spread = explode * (1.2 + pc.seed * 2.4) * (100 / UNIT)
      pc.group.position.set(
        pc.center.x + idleX + pc.dir.x * spread * 0.9,
        pc.center.y + idleY + pc.dir.y * spread * 0.9,
        explode * (1.5 + pc.seed * 6.5) * (100 / UNIT),
      )
      pc.group.rotation.z = THREE.MathUtils.degToRad(idleR) + explode * (pc.seed - 0.5) * 0.6
      pc.group.rotation.y = explode * (pc.seed - 0.5) * 0.9
      pc.mat.opacity = 1 - vanish
      pc.group.visible = true
    })
    else if (piecesWereVisible) others.forEach(pc => { pc.group.visible = false })
    piecesWereVisible = piecesVisible
    // casa: leve respiração própria
    housePiece.group.position.set(housePos.x, housePos.y + Math.sin(t * 0.0003) * .01 * motion * (1 - smooth(.12, .26, p)), 0)

    // fios: da casa até a âncora de cada peça (acompanham o movimento)
    lineMat.opacity = 1 - smooth(.14, .32, p)
    lines.visible = lineMat.opacity > .001
    if (lines.visible) {
    others.forEach((pc, i) => {
      pc.group.updateMatrix(); tmp.copy(pc.anchorLocal).applyMatrix4(pc.group.matrix)
      const offset = i * 6
      linePositions[offset] = pc.house.x; linePositions[offset + 1] = pc.house.y; linePositions[offset + 2] = 0
      linePositions[offset + 3] = tmp.x; linePositions[offset + 4] = tmp.y; linePositions[offset + 5] = tmp.z
    })
    lineGeo.attributes.position.needsUpdate = true
    }
    glowMat.opacity = 1 - focus
    glow.visible = glowMat.opacity > .001

    scene.fog.near = lerp(500, 5, focus); scene.fog.far = lerp(1200, 24, focus)

    // trajetória da câmera
    // enquadramento inicial idêntico ao mapa da página 2 (mesma posição e tamanho na tela)
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const vh = viewportH, vw = viewportW
    let z0 = fitZ(), sx0 = 0, sy0 = 0
    if (startRect) {
      z0 = mapH * vh / (startRect.h * 2 * tanH)
      const wpp = (2 * z0 * tanH) / vh
      sx0 = -(startRect.cx - vw / 2) * wpp
      sy0 = (startRect.cy - vh / 2) * wpp
    }
    const toDoor = smooth(.11, .34, p)
    const parallax = focus * (1 - smooth(.23, .32, p)) * .025 * motion
    camPos.set(
      lerp(lerp(sx0, housePos.x, focus), door.x, toDoor) + pointer.sx * parallax,
      lerp(lerp(sy0, housePos.y, focus), archive.eyeY, toDoor) - pointer.sy * parallax,
      lerp(z0, 4.8, focus),
    )
    if (p >= .34) {
      passage.getPointAt(enter, pathPoint)
      camPos.set(door.x + pathPoint.x * (viewportW < 760 ? .7 : 1), archive.floorY + pathPoint.y, pathPoint.z)
    }
    camera.position.copy(camPos)
    const glance = (viewportW < 760 ? .95 : .68) * Math.sin(enter * Math.PI * 2 + .4) * smooth(.12, .3, enter) * (1 - smooth(.76, .92, enter))
    lookAt.set(p < .34 ? camPos.x : door.x + glance + pointer.sx * .025 * interiorMotion, camPos.y - smooth(.38, .6, p) * .065, camPos.z - 3.4)
    camera.lookAt(lookAt)
    look.update({ progress: p, visible, reduced, dt })
    if (archive.update(open, t, interiorMotion, pointer, dt, camera)) renderer.shadowMap.needsUpdate = true
    pointer.dx = pointer.dy = 0

    renderer.setClearColor(0xffffff, reduced ? 1 : smooth(0.0, 0.05, p))

    // Disjoint intervals prevent the two phrases from cross-fading over each other.
    setOpacity(capA, reduced ? 0 : smooth(.015, .05, p) * (1 - smooth(.15, .20, p)))
    setOpacity(capB, reduced ? 0 : smooth(.23, .27, p) * (1 - smooth(.31, .34, p)))
    renderer.toneMappingExposure = lerp(.95, 1.35, leave)
    if (!reduced && p >= .995) {
      renderer.setClearColor(exitPaper, 1)
      renderer.clear()
    } else renderer.render(scene, camera)
    if (reduced || target > 0.0005) {
      setOpacity(canvas, reduced ? 1 : 1 - smooth(.97, 1, p))
      if (!reduced) setMapCovered(true)
    }
    const background = leave > 0 ? exitPaper.getStyle() : 'transparent'
    if (stage.style.backgroundColor !== background) stage.style.backgroundColor = background
    if (insideRoom && now - lastInteraction > 1000 && Math.abs(target - progress) < .0001
      && Math.abs(pointer.x - pointer.sx) < .0001 && Math.abs(pointer.y - pointer.sy) < .0001
      && look.isSettled() && archive.isSettled()) {
      cancelAnimationFrame(raf)
      raf = 0
    }
  }

  // Race all preparation against cancellation, including a hung image or shader.
  await untilAborted((async () => {
    onProgress('textures', loadedTextures, textureReady.length)
    await Promise.all(textureReady)
    await archive.prepareStaticLighting(controller.signal, (done, total) => onProgress('lighting', done, total))
    await prepareSceneMaterials(renderer, scene, camera, [], controller.signal, { allowDuringScroll: true, priority: true, compileBatchSize: 4, onProgress })
    await yieldScenePreparation(controller.signal, { allowDuringScroll: true })
    camera.position.set(0, 0, fitZ())
    camera.lookAt(0, 0, 0)
    scene.updateMatrixWorld(true)
    await warmScene(renderer, scene, camera, controller.signal, { allowDuringScroll: true, priority: true, batchWarmup: true, onProgress })
  })(), controller.signal)
  controller.signal.throwIfAborted()
  resize()
  prepared = true
  const updateRenderActivity = () => {
    const wasVisible = visible
    visible = prepared && page3Intersecting && !document.hidden && heroFinished() && (reduced || target > .0005)
    setPointerListening(visible && !reduced)
    if (visible && !wasVisible) {
      progress = target = scroll.progress
      lastFrame = 0
      lastInteraction = performance.now()
      renderBudget.reset()
      staticDirty = true
    }
    if (visible && !raf) raf = requestAnimationFrame(frame)
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
    if (!visible) look.suspend()
    if (!visible || reduced) setMapCovered(false)
  }
  const page3Observer = new IntersectionObserver((entries) => {
    page3Intersecting = entries[0].isIntersecting
    updateRenderActivity()
  }, { threshold: 0 })
  page3Observer.observe(section)
  disposers.push(() => page3Observer.disconnect())
  document.addEventListener('visibilitychange', updateRenderActivity)
  disposers.push(() => document.removeEventListener('visibilitychange', updateRenderActivity))
  window.addEventListener('hipocampo:hero-pin-state', updateRenderActivity)
  disposers.push(() => window.removeEventListener('hipocampo:hero-pin-state', updateRenderActivity))
  const changeMotion = () => {
    reduced = motionPreference.matches
    look.suspend()
    section.classList.toggle('is-reduced-motion', reduced)
    staticDirty = true
    setPointerListening(visible && !reduced)
    setMapCovered(false)
    resize()
    ScrollTrigger.refresh()
  }
  motionPreference.addEventListener('change', changeMotion)
  disposers.push(() => motionPreference.removeEventListener('change', changeMotion))
  // Preparation changes no document geometry. Refreshing all pinned sections
  // here used to force layout in the middle of the first scroll.
  ScrollTrigger.update()
  ready = true
  section.dataset.houseState = 'ready'
  section.houseJourney = {
    inspect: () => ({ prepared, progress, target, camera: camera.position.toArray(), cameraHeight: camera.position.y - archive.floorY, cameraRotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z], view: look.inspect(), doorOpen: smooth(DOOR_OPEN_START, DOOR_OPEN_END, reduced ? .69 : progress), interior: archive.inspect(), reduced, visible, framePending: !!raf, continuousCamera: true, physicalInterior: true, renderBudget: renderBudget.inspect(), exteriorActive: piecesWereVisible, linesActive: lines.visible, renderedFrames: renderer.info.render.frame, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  }
  } catch (error) {
    dispose()
    throw controller.signal.aborted ? controller.signal.reason : error
  }
}

function populatePreview(section, manifest) {
  const preview = section.querySelector('.page3-preview')
  const map = document.createElement('div')
  map.className = 'page3-preview-map'
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('viewBox', `0 0 ${manifest.width} ${manifest.height}`)
  svg.setAttribute('preserveAspectRatio', 'none')
  for (const piece of manifest.pieces) {
    if (piece.tipo !== 'casa') {
      const line = document.createElementNS(svg.namespaceURI, 'line')
      for (const [name, value] of Object.entries({
        x1: piece.anchorHouse.xPct * manifest.width / 100,
        y1: piece.anchorHouse.yPct * manifest.height / 100,
        x2: piece.anchorPiece.xPct * manifest.width / 100,
        y2: piece.anchorPiece.yPct * manifest.height / 100,
        stroke: manifest.lineColor, 'stroke-width': manifest.lineWidthPct * manifest.width / 100,
      })) line.setAttribute(name, String(value))
      svg.append(line)
    }
    const image = document.createElement('img')
    image.src = piece.src
    image.alt = ''
    image.decoding = 'async'
    image.draggable = false
    Object.assign(image.style, {
      left: `${piece.x / manifest.width * 100}%`, top: `${piece.y / manifest.height * 100}%`,
      width: `${piece.w / manifest.width * 100}%`, height: `${piece.h / manifest.height * 100}%`,
    })
    map.append(image)
  }
  map.prepend(svg)
  preview.replaceChildren(map)
}

function init() {
  const project = document.querySelector('#projeto')
  if (!project || !project.nextElementSibling) return false
  if (document.querySelector('#casa')) return true
  const section = buildSection()
  project.after(section)
  let preparation = createHousePreparation(project)
  // Keep the existing artwork on screen until WebGL can take over. This layer
  // uses cached small map images; it never blocks scrolling or adds UI copy.
  let previewGeometry = null
  const positionPreview = progress => {
    const map = section.querySelector('.page3-preview-map')
    if (!map || !previewGeometry) return
    const g = previewGeometry, t = smooth(0, .18, progress)
    const scale = Math.min(innerWidth * .72, innerHeight * .8 * 671 / 960) / g.width
    map.style.transform = `translate(${(innerWidth / 2 - g.left - g.width / 2) * t}px, ${(innerHeight / 2 - g.top - g.height / 2) * t}px) scale(${lerp(1, scale, t)})`
  }
  const measurePreview = () => {
    const previewMap = section.querySelector('.page3-preview-map')
    const source = project.querySelector('[data-memory-map]')
    if (!previewMap || !source) return
    const r = source.getBoundingClientRect()
    const height = source.clientHeight || r.height
    if (!r.width || !height) return
    const width = source.clientWidth || r.width
    const left = r.left + (r.width - width) / 2
    const top = r.top - section.getBoundingClientRect().top + (r.height - height) / 2
    previewGeometry = { width, height, left, top }
    Object.assign(previewMap.style, { width: `${width}px`, height: `${height}px`, left: `${left}px`, top: `${top}px` })
    positionPreview(previewScroll?.progress || 0)
  }
  const updatePreviewRange = st => {
    section.classList.toggle('is-house-outside', st.progress <= .0005 || st.progress >= .97)
    if (section.dataset.houseState !== 'ready') positionPreview(st.progress)
  }
  let previewScroll
  const ensurePreviewScroll = () => {
    if (previewScroll) return
    previewScroll = ScrollTrigger.create({
      id: 'hipocampo-house-preview', trigger: section, start: 'top top', end: 'bottom bottom',
      onUpdate: updatePreviewRange, onRefresh: st => { measurePreview(); updatePreviewRange(st) },
    })
    updatePreviewRange(previewScroll)
  }
  let active, retryTimer = 0, deadline = 0, attempt = 0, suspended = false
  const start = () => {
    window.clearTimeout(retryTimer)
    window.clearTimeout(deadline)
    active?.abort()
    if (preparation.inspect().disposed) preparation = createHousePreparation(project)
    preparation.retry()
    section.innerHTML = buildSection().innerHTML
    section.dataset.houseState = 'loading'
    const controller = active = new AbortController()
    loadManifest().then(manifest => {
      if (active !== controller || controller.signal.aborted) return
      populatePreview(section, manifest)
      measurePreview()
    }).catch(() => {})
    ensurePreviewScroll()
    // A finite deadline covers stalled fetches, image decoding and shader compilation.
    deadline = window.setTimeout(() => controller.abort(new Error('O carregamento da casa demorou mais que o esperado')), 45000)
    let failureHandled = false
    const failed = error => {
      if (failureHandled || active !== controller || (controller.signal.aborted && controller.signal.reason?.name === 'AbortError')) return
      failureHandled = true
      window.clearTimeout(deadline)
      controller.abort(error)
      section.querySelector('.page3-canvas').style.opacity = '0'
      section.dataset.houseState = 'error'
      if (attempt++ < 1) retryTimer = window.setTimeout(start, 600)
      else preparation.dispose()
    }
    const reportProgress = (stage, done, total) => {
      if (active === controller && !controller.signal.aborted) preparation.update(stage, done, total)
    }
    mount(section, controller, failed, reportProgress).then(() => {
      if (active !== controller || controller.signal.aborted) return
      window.clearTimeout(deadline)
      preparation.complete()
    }, failed)
  }
  window.addEventListener('pagehide', () => {
    suspended = true
    window.clearTimeout(retryTimer)
    window.clearTimeout(deadline)
    active?.abort()
    preparation.dispose()
    previewScroll?.kill()
    previewScroll = null
  })
  window.addEventListener('pageshow', () => {
    if (suspended) { suspended = false; attempt = 0; start() }
  })
  window.addEventListener('resize', measurePreview, { passive: true })
  start()
  return true
}

if (!init()) {
  window.__hipocampoWhenReady?.(init)
}
