// A continuous camera passes through a physical doorway, crosses the archive
// and leaves through its far opening. The original memory map stays aligned.
import * as THREE from './vendor/three.module.min.js'
import { createHouseInterior } from './house-interior.js?v=depth-1'
import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

gsap.registerPlugin(ScrollTrigger)

const MANIFEST_URL = '/images/map/manifest.json'
const UNIT = 16 // the photographed doorway is approximately 1 × 2.3 metres
const DOOR_PX = { x: 277, y: 527 } // porta da casa (coordenadas da imagem fonte)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t) }
const lerp = (a, b, t) => a + (b - a) * t

function buildSection() {
  const section = document.createElement('section')
  section.id = 'casa'
  section.className = 'hipocampo-page3'
  section.setAttribute('aria-label', 'Transição: entrando na casa da memória')
  section.innerHTML = `
    <div class="page3-stage">
      <canvas class="page3-canvas" aria-hidden="true"></canvas>
      <p class="page3-caption page3-caption--a">cada fragmento aponta para um lugar</p>
      <p class="page3-caption page3-caption--b">entre na casa</p>
      <p class="page3-description">Uma passagem tridimensional pela casa da memória: atravesse a porta, percorra a galeria de fotografias e siga a luz até a próxima seção. O caminho se recompõe ao rolar de volta.</p>
    </div>`
  return section
}

async function mount(section) {
  const manifest = await (await fetch(MANIFEST_URL)).json()
  const canvas = section.querySelector('.page3-canvas')
  const stage = section.querySelector('.page3-stage')
  const capA = section.querySelector('.page3-caption--a')
  const capB = section.querySelector('.page3-caption--b')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = .95
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const scene = new THREE.Scene()
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
  const loader = new THREE.TextureLoader()
  const loadTexture = (url) => {
    let texture
    textureReady.push(new Promise((resolve, reject) => {
      texture = loader.load(url, resolve, undefined, reject)
    }))
    return texture
  }

  // ---------- peças do mapa ----------
  const pieces = manifest.pieces.map((d, i) => {
    const tex = loadTexture(d.src.replace('.webp', '-hd.webp')); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = maxAniso
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: d.tipo === 'casa', fog: true, toneMapped: false })
    const w = d.w / UNIT, h = d.h / UNIT
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat)
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
  scene.add(new THREE.LineSegments(lineGeo, lineMat))

  const door = toWorld(DOOR_PX.x, DOOR_PX.y)
  const archive = createHouseInterior({ scene, door, facade: housePiece.mat, houseData: housePiece.d, unit: UNIT, pieces: others, loadTexture })

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
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }

  const domMap = document.querySelector('#projeto [data-memory-map]')
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
    measureStart()
    viewportW = Math.max(1, stage.clientWidth)
    viewportH = Math.max(1, stage.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
    renderer.setSize(viewportW, viewportH, false)
    camera.aspect = viewportW / viewportH
    camera.updateProjectionMatrix()
    archive.resize(camera.aspect)
    renderer.shadowMap.needsUpdate = true
    updatePaperColor()
    staticDirty = true
    if (visible && !raf) raf = requestAnimationFrame(frame)
  }

  let target = 0, progress = 0, visible = false, raf = 0, lastFrame = 0
  let page3Intersecting = false, staticDirty = true
  const scroll = ScrollTrigger.create({
    id: 'hipocampo-house',
    trigger: section, start: 'top top', end: 'bottom bottom',
    onUpdate: (st) => {
      target = st.progress
      if (target <= 0.0005 && !reduced) {
        if (domMap) domMap.style.visibility = ''
        canvas.style.opacity = '0'
      }
    },
    onRefresh: () => {
      measureStart()
      updatePaperColor()
    },
  })
  target = progress = scroll.progress
  resize()
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(stage)
  const onPointerMove = (e) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1
  }
  let pointerListening = false
  const setPointerListening = (enabled) => {
    if (enabled === pointerListening) return
    pointerListening = enabled
    if (enabled) window.addEventListener('pointermove', onPointerMove, { passive: true })
    else {
      window.removeEventListener('pointermove', onPointerMove)
      pointer.x = pointer.y = pointer.sx = pointer.sy = 0
    }
  }

  const tmp = new THREE.Vector3()
  canvas.style.opacity = '0'
  const frame = (now) => {
    raf = visible && !reduced ? requestAnimationFrame(frame) : 0
    const dt = Math.min((now - (lastFrame || now)) / 1000, 0.05)
    lastFrame = now
    if (reduced && !staticDirty) return
    staticDirty = false
    const t = reduced ? 0 : now
    progress += (target - progress) * (1 - Math.exp(-dt * 16))
    if (Math.abs(target - progress) < 0.0001) progress = target
    const p = reduced ? .69 : progress
    const motion = reduced ? 0 : 1
    pointer.sx += (pointer.x - pointer.sx) * 0.05
    pointer.sy += (pointer.y - pointer.sy) * 0.05

    // fases do scroll
    const focus = smooth(0, .34, p)
    const travel = clamp((p - .34) / .66, 0, 1)
    const enter = travel < .12 ? travel * smooth(0, .12, travel) : travel > .96 ? 1 - (1 - travel) * smooth(0, .04, 1 - travel) : travel
    const open = smooth(.29, .48, p)
    const explode = smooth(.02, .35, p)
    const vanish = smooth(.24, .42, p)
    const leave = reduced ? 0 : smooth(.87, .995, p)
    const fov = lerp(42, viewportW < 760 ? 64 : 48, smooth(.12, .43, p))
    if (Math.abs(camera.fov - fov) > .001) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }

    // peças: movimento de respiração original (mantido) + dispersão 3D
    others.forEach((pc) => {
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
      pc.group.visible = vanish < .999
    })
    // casa: leve respiração própria
    housePiece.group.position.set(housePos.x, housePos.y + Math.sin(t * 0.0003) * .01 * motion * (1 - focus), 0)

    // fios: da casa até a âncora de cada peça (acompanham o movimento)
    others.forEach((pc, i) => {
      pc.group.updateMatrix(); tmp.copy(pc.anchorLocal).applyMatrix4(pc.group.matrix)
      linePositions.set([pc.house.x, pc.house.y, 0, tmp.x, tmp.y, tmp.z], i * 6)
    })
    lineGeo.attributes.position.needsUpdate = true
    lineMat.opacity = 1 - smooth(.14, .32, p)
    glowMat.opacity = 1 - focus

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
    const parallax = focus * (1 - open) * .025 * motion
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
    lookAt.set(p < .34 ? camPos.x : door.x + glance + pointer.sx * .025 * motion, camPos.y - smooth(.38, .6, p) * .065, camPos.z - 3.4)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld()
    if (archive.update(open, t, motion, pointer.sx)) renderer.shadowMap.needsUpdate = true

    renderer.setClearColor(0xffffff, reduced ? 1 : smooth(0.0, 0.05, p))

    capA.style.opacity = String(reduced ? 0 : smooth(0.01, 0.08, p) * (1 - smooth(0.2, 0.3, p)))
    capB.style.opacity = String(reduced ? 0 : smooth(.22, .29, p) * (1 - smooth(.37, .43, p)))
    renderer.toneMappingExposure = lerp(.95, 1.35, leave)
    if (!reduced && p >= .995) {
      renderer.setClearColor(exitPaper, 1)
      renderer.clear()
    } else renderer.render(scene, camera)
    if (reduced || target > 0.0005) {
      canvas.style.opacity = String(reduced ? 1 : 1 - smooth(.97, 1, p))
      if (domMap && !reduced) domMap.style.visibility = 'hidden'
    }
    stage.style.backgroundColor = leave > 0 ? exitPaper.getStyle() : 'transparent'
  }

  // Do not replace the DOM map with a frame whose images are still loading.
  try {
    await Promise.all(textureReady)
  } catch (error) {
    scroll.kill()
    resizeObserver.disconnect()
    archive.dispose()
    renderer.dispose()
    throw error
  }
  let contextLost = false
  const updateRenderActivity = () => {
    const wasVisible = visible
    visible = page3Intersecting && !document.hidden && !contextLost
    setPointerListening(visible && !reduced)
    if (visible && !wasVisible) {
      progress = target = scroll.progress
      lastFrame = 0
      staticDirty = true
    }
    if (visible && !raf) raf = requestAnimationFrame(frame)
    if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
    if (domMap && (!visible || reduced)) domMap.style.visibility = ''
  }
  const page3Observer = new IntersectionObserver((entries) => {
    page3Intersecting = entries[0].isIntersecting
    updateRenderActivity()
  }, { threshold: 0 })
  page3Observer.observe(section)
  document.addEventListener('visibilitychange', updateRenderActivity)
  motionPreference.addEventListener('change', () => {
    if (contextLost) return
    reduced = motionPreference.matches
    section.classList.toggle('is-reduced-motion', reduced)
    staticDirty = true
    setPointerListening(visible && !reduced)
    if (domMap) domMap.style.visibility = ''
    resize()
    ScrollTrigger.refresh()
  })
  // Context loss falls back to ordinary page navigation instead of a blank runway.
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    contextLost = true
    visible = false
    cancelAnimationFrame(raf)
    raf = 0
    setPointerListening(false)
    page3Observer.disconnect()
    resizeObserver.disconnect()
    scroll.kill()
    archive.dispose()
    if (domMap) domMap.style.visibility = ''
    section.hidden = true
    ScrollTrigger.refresh()
  })
  ScrollTrigger.refresh()
  section.houseJourney = {
    inspect: () => ({ progress, target, camera: camera.position.toArray(), cameraHeight: camera.position.y - archive.floorY, cameraRotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z], doorOpen: smooth(.29, .48, reduced ? .69 : progress), reduced, visible, framePending: !!raf, continuousCamera: true, physicalInterior: true, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
  }
}

function init() {
  const project = document.querySelector('#projeto')
  if (!project || !project.nextElementSibling) return false
  if (document.querySelector('#casa')) return true
  const section = buildSection()
  project.after(section)
  mount(section).catch((e) => {
    console.error('[hipocampo page3]', e)
    section.hidden = true
    const map = document.querySelector('#projeto [data-memory-map]')
    if (map) map.style.visibility = ''
    ScrollTrigger.refresh()
  })
  return true
}

if (!init()) {
  window.__hipocampoWhenReady?.(init)
}
