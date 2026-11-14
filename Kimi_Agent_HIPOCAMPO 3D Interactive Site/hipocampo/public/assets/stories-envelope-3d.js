import * as THREE from './vendor/three.module.min.js'

const clamp = THREE.MathUtils.clamp
const lerp = THREE.MathUtils.lerp
const radians = THREE.MathUtils.degToRad
const smooth = (from, to, value) => {
  const t = clamp((value - from) / (to - from), 0, 1)
  return t * t * (3 - 2 * t)
}

// Numerical material maps: laid cotton fibres, fine grain and soft creases.
// These are surface properties of the meshes, not a picture of an envelope.
function paperTextures() {
  const size = 512
  const colour = document.createElement('canvas')
  const relief = document.createElement('canvas')
  colour.width = relief.width = size
  colour.height = relief.height = size
  const c = colour.getContext('2d')
  const b = relief.getContext('2d')
  const pixels = c.createImageData(size, size)
  const bumps = b.createImageData(size, size)
  let seed = 14291
  const random = () => {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 4294967296
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const grain = (random() - .5) * 14
      const crease = Math.sin(x * .047 + Math.sin(y * .021) * 3) * Math.sin(y * .038) * 3
      pixels.data[i] = 239 + grain + crease
      pixels.data[i + 1] = 231 + grain + crease
      pixels.data[i + 2] = 209 + grain + crease
      pixels.data[i + 3] = 255
      const bump = 128 + grain * 3 + crease * 4
      bumps.data[i] = bumps.data[i + 1] = bumps.data[i + 2] = bump
      bumps.data[i + 3] = 255
    }
  }
  c.putImageData(pixels, 0, 0)
  b.putImageData(bumps, 0, 0)
  for (let i = 0; i < 2200; i++) {
    const x = random() * size, y = random() * size
    const length = 3 + random() * 23, angle = random() * Math.PI * 2
    for (const [context, stroke] of [[c, 'rgba(255,255,242,.19)'], [b, 'rgba(225,225,225,.30)']]) {
      context.lineWidth = .45 + random() * .75
      context.strokeStyle = stroke
      context.beginPath()
      context.moveTo(x, y)
      context.quadraticCurveTo(x + Math.cos(angle) * length * .5 + 2, y + Math.sin(angle) * length * .5, x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      context.stroke()
    }
  }
  const map = new THREE.CanvasTexture(colour)
  map.colorSpace = THREE.SRGBColorSpace
  const bump = new THREE.CanvasTexture(relief)
  for (const texture of [map, bump]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.anisotropy = 2
  }
  return { map, bump }
}

function surface(shape, face, edge, thickness = .035) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness, bevelEnabled: true, bevelThickness: .007,
    bevelSize: .008, bevelSegments: 1, curveSegments: 12,
  })
  // A consistent physical grain size on every folded panel.
  const position = geometry.attributes.position, uv = geometry.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) * .14, position.getY(i) * .14)
  uv.needsUpdate = true
  const mesh = new THREE.Mesh(geometry, [face, edge])
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

function triangle(points) {
  const shape = new THREE.Shape()
  shape.moveTo(...points[0])
  points.slice(1).forEach(point => shape.lineTo(...point))
  shape.closePath()
  return shape
}

function waxSeal(material) {
  const group = new THREE.Group()
  const outline = new THREE.Shape()
  const segments = 80
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2
    const radius = .62 + Math.sin(angle * 5 + .7) * .045 + Math.sin(angle * 9) * .018
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius
    if (i === 0) outline.moveTo(x, y)
    else outline.lineTo(x, y)
  }
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(outline, {
    depth: .075, bevelEnabled: true, bevelThickness: .045,
    bevelSize: .05, bevelSegments: 3, curveSegments: 24,
  }), material)
  body.castShadow = body.receiveShadow = true
  group.add(body)
  const pressed = new THREE.Mesh(new THREE.SphereGeometry(.47, 32, 16), material)
  pressed.scale.z = .06
  pressed.position.z = .075
  group.add(pressed)
  for (const radius of [.45, .53]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius > .5 ? .035 : .012, 8, 64), material)
    ring.position.z = .135
    ring.castShadow = false
    group.add(ring)
  }
  const initial = triangle([
    [-.20, -.25], [-.20, .25], [-.10, .25], [-.10, .055],
    [.10, .055], [.10, .25], [.20, .25], [.20, -.25],
    [.10, -.25], [.10, -.045], [-.10, -.045], [-.10, -.25],
  ])
  const raisedWax = material.clone()
  raisedWax.color.offsetHSL(0, 0, .035)
  const emboss = new THREE.Mesh(new THREE.ExtrudeGeometry(initial, {
    depth: .018, bevelEnabled: true, bevelThickness: .008,
    bevelSize: .007, bevelSegments: 2,
  }), raisedWax)
  emboss.position.z = .15
  emboss.castShadow = false
  group.add(emboss)
  group.rotation.z = -.10
  return group
}

export async function createEnvelopeExperience(stage) {
  const canvas = document.createElement('canvas')
  canvas.className = 'stories-envelope-canvas'
  canvas.setAttribute('aria-hidden', 'true')
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' })
  if (!context) throw new Error('WebGL2 unavailable')
  const renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true, powerPreference: 'low-power' })
  renderer.setClearColor(0x000000, 0)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const coarse = matchMedia('(pointer: coarse)').matches
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.25 : 1.5))
  stage.append(canvas)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100)
  const envelope = new THREE.Group()
  scene.add(envelope)
  const textures = paperTextures()
  const paper = new THREE.MeshStandardMaterial({
    map: textures.map, bumpMap: textures.bump, bumpScale: .085,
    color: '#fff9e9', roughness: .94, metalness: 0, side: THREE.DoubleSide,
  })
  paper.shadowSide = THREE.FrontSide
  const edge = new THREE.MeshStandardMaterial({ color: '#b9ab8c', roughness: 1 })
  const inside = new THREE.MeshStandardMaterial({ color: '#fffefa', bumpMap: textures.bump, bumpScale: .009, roughness: .96, side: THREE.DoubleSide })
  inside.shadowSide = THREE.FrontSide
  const wax = new THREE.MeshPhysicalMaterial({ color: '#8f3542', roughness: .29, metalness: 0, clearcoat: .75, clearcoatRoughness: .17, bumpMap: textures.bump, bumpScale: .006 })
  const w = 8.8, h = 5.8
  const backShape = new THREE.Shape()
  backShape.moveTo(-w / 2, -h / 2)
  backShape.lineTo(w / 2, -h / 2)
  backShape.lineTo(w / 2, h / 2)
  backShape.lineTo(-w / 2, h / 2)
  backShape.closePath()
  const back = surface(backShape, inside, edge)
  envelope.add(back)
  function fold(points, x, y, z) {
    const hinge = new THREE.Group()
    hinge.position.set(x, y, z)
    hinge.add(surface(triangle(points), paper, edge))
    envelope.add(hinge)
    return hinge
  }
  const left = fold([[0, -h / 2], [w / 2 + .05, 0], [0, h / 2]], -w / 2, 0, .06)
  const right = fold([[0, -h / 2], [0, h / 2], [-w / 2 - .05, 0]], w / 2, 0, .10)
  const bottom = fold([[-w / 2, 0], [w / 2, 0], [0, h * .55]], 0, -h / 2, .14)
  const top = fold([[-w / 2, 0], [0, -h * .60], [w / 2, 0]], 0, h / 2, .20)
  const seal = waxSeal(wax)
  seal.position.set(0, -h * .54, .08)
  top.add(seal)

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: '#1b0a05', opacity: .24 }))
  ground.position.z = -.4
  ground.receiveShadow = true
  scene.add(ground)
  scene.add(new THREE.HemisphereLight('#fff8ec', '#8a7761', 1.5))
  const key = new THREE.DirectionalLight('#fff3df', 3)
  key.position.set(-5, 7, 12)
  key.castShadow = true
  key.shadow.mapSize.set(coarse ? 512 : 1024, coarse ? 512 : 1024)
  Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 35 })
  key.shadow.bias = -.001
  key.shadow.normalBias = .04
  key.shadow.radius = 3
  scene.add(key)

  let disposed = false, ready = false, contextLost = false, intersecting = false, visible = false
  let progress = 0, frame = 0, frames = 0, lastDrawn = -1
  let closedZ = 20, closedY = -1, width = 1, height = 1
  const updateModel = () => {
    top.rotation.x = radians(-170) * smooth(.055, .32, progress)
    left.rotation.y = radians(-155) * smooth(.24, .55, progress)
    right.rotation.y = radians(155) * smooth(.26, .57, progress)
    bottom.rotation.x = radians(155) * smooth(.29, .60, progress)
    const travel = smooth(.38, .80, progress)
    camera.position.set(0, 0, lerp(closedZ, 2.8, travel))
    camera.lookAt(0, 0, 0)
    envelope.position.y = lerp(closedY, 0, travel)
    envelope.rotation.set(lerp(-.025, 0, travel), lerp(.025, 0, travel), lerp(-.012, 0, travel))
  }
  const requestRender = (force = false) => {
    if (disposed || contextLost || frame || (!visible && !force)) return
    frame = requestAnimationFrame(() => {
      frame = 0
      if (disposed || contextLost || (!visible && !force)) return
      updateModel()
      renderer.render(scene, camera)
      frames++
      lastDrawn = progress
      if (!ready) { ready = true; stage.classList.add('stories-three-ready') }
    })
  }
  const resize = () => {
    if (disposed) return
    width = stage.clientWidth
    height = stage.clientHeight
    camera.aspect = width / height
    camera.updateProjectionMatrix()
    const tangent = Math.tan(radians(camera.fov / 2))
    const coverage = Math.min(.88, 640 / width)
    closedZ = Math.max(w / (2 * tangent * camera.aspect * coverage), h / (2 * tangent * .40))
    closedY = -.08 * (2 * closedZ * tangent)
    renderer.setSize(width, height, false)
    requestRender()
  }
  const observer = new IntersectionObserver(entries => {
    intersecting = entries[0].isIntersecting
    visible = intersecting && !document.hidden
    if (visible) requestRender()
    else { cancelAnimationFrame(frame); frame = 0 }
  }, { threshold: .01 })
  const resizeObserver = new ResizeObserver(resize)
  const visibility = () => {
    visible = intersecting && !document.hidden
    if (visible) requestRender()
    else { cancelAnimationFrame(frame); frame = 0 }
  }
  const lost = event => {
    event.preventDefault()
    ready = false
    contextLost = true
    cancelAnimationFrame(frame); frame = 0
    stage.classList.remove('stories-three-ready')
  }
  const restored = () => { contextLost = false; requestRender(true) }
  canvas.addEventListener('webglcontextlost', lost)
  canvas.addEventListener('webglcontextrestored', restored)
  document.addEventListener('visibilitychange', visibility)
  resize()
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera)
  observer.observe(stage)
  resizeObserver.observe(stage)
  requestRender(true)

  return {
    setProgress(value) {
      const previous = progress
      progress = clamp(value, 0, 1)
      // The opaque reading room already covers the canvas in this interval.
      if (progress < .87 || previous < .87 || lastDrawn < .87) requestRender()
    },
    getDiagnostics() {
      return { ready, visible, contextLost, progress, frames, width, height,
        pixelRatio: renderer.getPixelRatio(), drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        topAngle: top.rotation.x, leftAngle: left.rotation.y, cameraZ: camera.position.z }
    },
    dispose() {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      resizeObserver.disconnect()
      document.removeEventListener('visibilitychange', visibility)
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
      const geometries = new Set(), materials = new Set()
      scene.traverse(object => {
        if (object.geometry) geometries.add(object.geometry)
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material))
      })
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      textures.map.dispose(); textures.bump.dispose()
      key.shadow.map?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
      stage.classList.remove('stories-three-ready')
    },
  }
}
