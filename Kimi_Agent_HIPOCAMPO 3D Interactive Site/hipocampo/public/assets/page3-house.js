// Página 3 — transição em three.js: o mapa de memória vira cena 3D,
// a casa se abre em papel, revela as memórias e se funde à página seguinte.
import * as THREE from './vendor/three.module.min.js'
import { createPaperTransition } from './paper-transition.js?v=1'
import { n as gsap, t as ScrollTrigger } from './index-BXEErpTi.js?v=perf-1'

gsap.registerPlugin(ScrollTrigger)

const MANIFEST_URL = '/images/map/manifest.json'
const UNIT = 100 // 100 px da imagem fonte = 1 unidade 3D
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
      <p class="page3-description">Dentro da casa, fragmentos de fotografias e lembranças ficam suspensos nas paredes.</p>
    </div>`
  return section
}

function roomTexture(paper, ink) {
  const c = document.createElement('canvas'); c.width = c.height = 512
  const g = c.getContext('2d')
  g.fillStyle = paper; g.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 9000; i++) { // grão de papel
    g.fillStyle = `rgba(80,70,50,${Math.random() * 0.05})`
    g.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5)
  }
  const v = g.createRadialGradient(256, 256, 80, 256, 256, 360)
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, ink)
  g.fillStyle = v; g.fillRect(0, 0, 512, 512)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

async function mount(section) {
  const manifest = await (await fetch(MANIFEST_URL)).json()
  const canvas = section.querySelector('.page3-canvas')
  const stage = section.querySelector('.page3-stage')
  const capA = section.querySelector('.page3-caption--a')
  const capB = section.querySelector('.page3-caption--b')
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false })
  renderer.setPixelRatio(clamp(window.devicePixelRatio || 1, 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  const scene = new THREE.Scene()
  const paper = new THREE.Color('#ffffff')
  scene.fog = new THREE.Fog(paper, 14, 30)
  const camera = new THREE.PerspectiveCamera(42, 1, 0.02, 80)
  const roomScene = new THREE.Scene()
  const roomCamera = camera.clone()
  const transition = createPaperTransition(renderer)
  const maxAniso = renderer.capabilities.getMaxAnisotropy()
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
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.02, depthWrite: d.tipo === 'casa', fog: true })
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
  const glowMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, fog: false })
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(manifest.width / UNIT * 0.84, manifest.height / UNIT * 0.72), glowMat)
  glow.position.set(0, 0, -0.05); glow.renderOrder = -1
  scene.add(glow)

  // ---------- fios ----------
  const linePositions = new Float32Array(others.length * 6)
  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
  const lineMat = new THREE.LineBasicMaterial({ color: manifest.lineColor, transparent: true })
  scene.add(new THREE.LineSegments(lineGeo, lineMat))

  // ---------- interior da casa ----------
  const room = new THREE.Group()
  const roomDepth = 9, roomW = 5.2, roomH = 3.4
  const wallTex = roomTexture('#efe6d2', 'rgba(60,45,25,0.55)')
  const wallMat = new THREE.MeshBasicMaterial({ map: wallTex, side: THREE.BackSide, fog: false })
  const box = new THREE.Mesh(new THREE.BoxGeometry(roomW, roomH, roomDepth), wallMat)
  room.add(box)
  // memórias penduradas nas paredes do interior
  const swingers = []
  others.forEach((p, i) => {
    const side = i % 3 // 0 esquerda, 1 direita, 2 fundo
    const m = new THREE.Mesh(p.mesh.geometry.clone().scale(1.3, 1.3, 1), new THREE.MeshBasicMaterial({ map: p.mat.map, transparent: true, alphaTest: 0.02, fog: false }))
    const along = (i / others.length) * (roomDepth - 2) - (roomDepth / 2 - 1.5)
    const hgt = Math.sin(i * 2.3) * 0.9
    if (side === 0) { m.position.set(-roomW / 2 + 0.02, hgt, along); m.rotation.y = Math.PI / 2 }
    else if (side === 1) { m.position.set(roomW / 2 - 0.02, hgt, along); m.rotation.y = -Math.PI / 2 }
    else { m.position.set(((i % 7) - 3) * 0.65, hgt * 1.1, -roomDepth / 2 + 0.02) }
    // pendurado pelo topo: o pivô fica na borda superior para balançar
    const hh = p.d.h / UNIT * 1.3
    const pivot = new THREE.Group()
    pivot.position.copy(m.position); pivot.position.y += hh / 2
    pivot.rotation.y = m.rotation.y
    m.position.set(0, -hh / 2, 0); m.rotation.set(0, 0, 0)
    pivot.add(m)
    room.add(pivot)
    swingers.push({ pivot, angle: 0, vel: 0, phase: i * 1.37, mass: 0.6 + Math.sin(i * 7.1) * 0.25 + 0.25, side })
  })
  const door = toWorld(DOOR_PX.x, DOOR_PX.y)
  room.position.set(door.x, door.y + roomH / 2 - 0.25, -roomDepth / 2 - 0.05)
  roomScene.add(room)

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
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 }

  const domMap = document.querySelector('#projeto [data-memory-map]')
  let startRect = null
  const measureStart = () => {
    if (!domMap) return
    const r = domMap.getBoundingClientRect(), s0 = section.getBoundingClientRect()
    if (r.width) startRect = { cx: r.left + r.width / 2, cy: r.top - s0.top + r.height / 2, h: r.height }
  }
  let viewportW = 1, viewportH = 1
  const updatePaperColor = () => {
    // #sobre is inserted by another module after mount has started.
    const next = document.querySelector('#sobre') || section.nextElementSibling
    const color = next && getComputedStyle(next).backgroundColor
    transition.uniforms.paper.value.set(color && color !== 'rgba(0, 0, 0, 0)' ? color : '#ffffff')
  }
  const resize = () => {
    measureStart()
    viewportW = Math.max(1, stage.clientWidth)
    viewportH = Math.max(1, stage.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, viewportW < 760 ? 1.5 : 2))
    renderer.setSize(viewportW, viewportH, false)
    camera.aspect = roomCamera.aspect = viewportW / viewportH
    camera.updateProjectionMatrix()
    roomCamera.updateProjectionMatrix()
    transition.resize(viewportW, viewportH)
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
  let lastPX = null, pointerVel = 0
  const onPointerMove = (e) => {
    if (lastPX !== null) pointerVel += (e.clientX - lastPX) / viewportW
    lastPX = e.clientX
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
      lastPX = null
      pointer.x = pointer.y = pointer.sx = pointer.sy = pointerVel = 0
    }
  }

  const tmp = new THREE.Vector3()
  const projectedDoor = new THREE.Vector3()
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
    const p = reduced ? 0.72 : progress
    const motion = reduced ? 0 : 1
    pointer.sx += (pointer.x - pointer.sx) * 0.05
    pointer.sy += (pointer.y - pointer.sy) * 0.05

    // fases do scroll
    const focus = smooth(0.0, 0.44, p) // aproxima da casa
    const enter = smooth(0.46, 0.66, p) // o papel revela o interior
    const explode = smooth(0.0, 0.46, p) // fragmentos se espalham em profundidade
    const leave = reduced ? 0 : smooth(0.86, 0.98, p)

    // peças: movimento de respiração original (mantido) + dispersão 3D
    others.forEach((pc) => {
      const idleX = Math.sin(t * 0.00042 + pc.phase) * 0.028 * motion
      const idleY = Math.cos(t * 0.00036 + pc.phase * 1.17) * 0.024 * motion
      const idleR = Math.sin(t * 0.00025 + pc.phase) * 0.38 * motion
      const spread = explode * (1.2 + pc.seed * 2.4)
      pc.group.position.set(
        pc.center.x + idleX + pc.dir.x * spread * 0.9,
        pc.center.y + idleY + pc.dir.y * spread * 0.9,
        explode * (1.5 + pc.seed * 6.5),
      )
      pc.group.rotation.z = THREE.MathUtils.degToRad(idleR) + explode * (pc.seed - 0.5) * 0.6
      pc.group.rotation.y = explode * (pc.seed - 0.5) * 0.9
      pc.mat.opacity = 1 - enter
    })
    // casa: leve respiração própria
    housePiece.group.position.set(housePos.x, housePos.y + Math.sin(t * 0.0003) * 0.01 * motion, 0)

    // fios: da casa até a âncora de cada peça (acompanham o movimento)
    others.forEach((pc, i) => {
      pc.group.updateMatrix(); tmp.copy(pc.anchorLocal).applyMatrix4(pc.group.matrix)
      linePositions.set([pc.house.x, pc.house.y, 0, tmp.x, tmp.y, tmp.z], i * 6)
    })
    lineGeo.attributes.position.needsUpdate = true
    lineMat.opacity = 1 - enter
    glowMat.opacity = 1 - focus

    scene.fog.near = lerp(400, 6, focus); scene.fog.far = lerp(800, 18, focus)

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
    const toDoor = smooth(0.2, 0.44, p)
    const parallax = focus * (1 - enter) * 0.035 * motion
    camPos.set(
      lerp(lerp(sx0, housePos.x, focus), door.x, toDoor) + pointer.sx * parallax,
      lerp(lerp(sy0, housePos.y, focus), door.y + 0.05, toDoor) - pointer.sy * parallax,
      lerp(z0, 1.8, focus),
    )
    camera.position.copy(camPos)
    lookAt.set(camPos.x, camPos.y, camPos.z - 5)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld()
    projectedDoor.copy(door).project(camera)
    transition.uniforms.center.value.set((projectedDoor.x + 1) / 2, (projectedDoor.y + 1) / 2)
    const pixelsPerUnit = vh / (2 * camPos.z * tanH)
    transition.uniforms.doorway.value.set(0.12 * pixelsPerUnit, 0.325 * pixelsPerUnit)

    // An independent camera is already inside the room. It never crosses a wall.
    const travel = reduced ? 0.3 : smooth(0.66, 0.86, p)
    roomCamera.position.set(door.x, room.position.y - 0.15, lerp(-0.9, -4.8, travel))
    roomCamera.rotation.set(-pointer.sy * 0.035 * motion, -pointer.sx * 0.06 * motion, 0)

    // pêndulos: as memórias penduradas balançam com o movimento do mouse
    pointerVel *= 0.85
    swingers.forEach((sw) => {
      if (reduced) { sw.angle = sw.vel = sw.pivot.rotation.z = 0; return }
      const dir = sw.side === 1 ? -1 : 1
      sw.vel += (-sw.angle * 0.012 + pointerVel * 0.05 * dir / sw.mass) * motion
      sw.vel *= 0.965
      sw.angle += sw.vel
      sw.pivot.rotation.z = sw.angle + Math.sin(t * 0.0009 + sw.phase) * 0.035 * motion
    })

    renderer.setClearColor(0xffffff, reduced ? 1 : smooth(0.0, 0.05, p))

    capA.style.opacity = String(reduced ? 0 : smooth(0.01, 0.08, p) * (1 - smooth(0.2, 0.3, p)))
    capB.style.opacity = String(reduced ? 0 : smooth(0.31, 0.39, p) * (1 - smooth(0.44, 0.49, p)))
    transition.render(scene, camera, roomScene, roomCamera, enter, leave)
    if (reduced || target > 0.0005) {
      canvas.style.opacity = '1'
      if (domMap && !reduced) domMap.style.visibility = 'hidden'
    }
  }

  // Do not replace the DOM map with a frame whose images are still loading.
  try {
    await Promise.all(textureReady)
  } catch (error) {
    scroll.kill()
    resizeObserver.disconnect()
    transition.dispose()
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
    transition.dispose()
    if (domMap) domMap.style.visibility = ''
    section.hidden = true
    ScrollTrigger.refresh()
  })
  ScrollTrigger.refresh()
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
