import * as THREE from './vendor/three.module.min.js'
import { FRAGMENTS } from './installation-collection.js?v=client-audio-1'
import { createCollectionBuilder } from './installation-props.js?v=client-audio-1'
import { createRenderBudget } from './render-budget.js?v=island-gpu-2'
import { batchStaticMeshes } from './static-mesh-batch.js?v=fps-1'
import { yieldScenePreparation, prepareSceneMaterials, warmScene } from './scene-preparation.js?v=scroll-start-1'
export { FRAGMENTS } from './installation-collection.js?v=client-audio-1'

const clamp = THREE.MathUtils.clamp
const BASE_LAYOUT = {
  past: [-4.65, 0, -.1], present: [4.65, 0, -.1], future: [0, 0, 3.8], fridge: [0, 0, -4.2],
}
const MOBILE_LAYOUT = {
  past: [-2.15, 0, -.1], present: [2.15, 0, -.1], future: [0, 0, 3.8], fridge: [0, 0, -3.8],
}

export async function createInstallationRoom(root, callbacks, { signal } = {}) {
  const buildStarted = performance.now()
  const stage = root.querySelector('.installation-stage')
  const canvas = root.querySelector('.installation-canvas')
  const navigationBar = root.querySelector('.installation-zoom')
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')
  scene.fog = new THREE.Fog('#000000', 25, 55)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false
  const renderBudget = createRenderBudget(renderer, { maxPixelRatio: 1, minPixelRatio: .65 })

  const camera = new THREE.PerspectiveCamera(35, 1, .1, 90)
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.7)
  const intersection = new THREE.Vector3()
  const projected = new THREE.Vector3()
  const worldPosition = new THREE.Vector3()
  const groups = Object.fromEntries(Object.keys(BASE_LAYOUT).map(id => {
    const group = new THREE.Group()
    group.name = id
    scene.add(group)
    return [id, group]
  }))
  const objects = new Map()
  const pickables = []
  const removers = []
  const textures = new Set()
  const materials = new Set()
  const geometries = new Set()
  const shadowLights = []
  const shadowObjects = new Map()
  const dirtyShadowObjects = new Set()
  const overlayState = new WeakMap()
  const overlayCameraMatrix = new THREE.Matrix4()
  const overlayProjectionMatrix = new THREE.Matrix4()
  let overlayCameraReady = false
  const performanceStats = { overlayPasses: 0, overlayProjections: 0, overlayWrites: 0, shadowBatches: 0, shadowMapsRequested: 0, lastShadowMaps: 0, staticMeshes: 0, batchedMeshes: 0 }
  let allShadowsDirty = true
  const textureReady = []
  const motions = new Map()
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let disposed = false
  let prepared = false
  let preparationMs = 0
  let observer = null
  let resizeObserver = null
  let api = null
  let visible = false
  let contextLost = false
  let raf = 0
  let controlsFrame = 0
  let controlsDocumentTop = 0
  let controlsHeight = 0
  let dirty = true
  let shadowsDirty = true
  let mobile = false
  let view = { yaw: 0, pitch: .38, distance: 16.8, panX: 0, panY: 0, panZ: 0 }
  let renderedView = { ...view }
  let navigating = false
  let topView = false
  let previousView = null
  const cameraKeys = new Set()
  const cameraRight = new THREE.Vector3()
  const cameraUp = new THREE.Vector3()
  const gesturePan = new THREE.Vector3()
  const touchPoints = new Map()
  let pinch = null
  let drag = null
  let orbit = null
  let fridgeOpen = true
  let doorAngle = Math.PI * .56
  let doorTarget = doorAngle
  let selectedId = null
  let lastFrame = 0
  let previousFrameRendered = false
  let width = 1
  let height = 1
  const cachedRect = { left: 0, top: 0, width: 1, height: 1 }

  async function buildYield() {
    await yieldScenePreparation(signal)
    if (disposed || signal?.aborted) {
      disposeRoom()
      throw new DOMException('Preparação cancelada', 'AbortError')
    }
  }
  if (signal) {
    signal.addEventListener('abort', disposeRoom, { once: true })
    removers.push(() => signal.removeEventListener('abort', disposeRoom))
  }

  function listen(target, event, listener, options) {
    target.addEventListener(event, listener, options)
    removers.push(() => target.removeEventListener(event, listener, options))
  }
  function material(options) {
    const result = new THREE.MeshStandardMaterial(options)
    materials.add(result)
    return result
  }
  function geometry(item) { geometries.add(item); return item }
  function mesh(parent, shape, surface, position = [0, 0, 0], shadow = true) {
    const item = new THREE.Mesh(geometry(shape), surface)
    item.position.set(...position)
    item.castShadow = shadow
    item.receiveShadow = true
    parent.add(item)
    return item
  }
  function box(parent, w, h, d, surface, position, radius = 0) {
    let shape
    if (radius > 0) {
      // Real bevelled geometry, including sidewalls and normals, rather than
      // flat silhouettes; shared materials keep the scene inexpensive.
      const r = Math.min(radius, w / 3, h / 3, d / 3)
      const x = -w / 2 + r, y = -h / 2 + r
      const ww = w - 2 * r, hh = h - 2 * r
      const outline = new THREE.Shape()
      outline.moveTo(x, y)
      outline.lineTo(x + ww, y)
      outline.lineTo(x + ww, y + hh)
      outline.lineTo(x, y + hh)
      outline.closePath()
      shape = new THREE.ExtrudeGeometry(outline, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, steps: 1, curveSegments: 3 })
      shape.translate(0, 0, -d / 2 + r)
    } else shape = new THREE.BoxGeometry(w, h, d)
    return mesh(parent, shape, surface, position)
  }
  function tube(parent, points, radius, surface) {
    return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 20, radius, 8, false), surface)
  }
  function loadTexture(url) {
    let loaded
    textureReady.push(new Promise(resolve => { loaded = resolve }))
    const texture = new THREE.TextureLoader().load(url, () => { loaded(); invalidate(false) }, undefined, () => {
      // Furniture retains its base PBR colour if a texture fails.
      invalidate(false)
      loaded()
    })
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy())
    textures.add(texture)
    return texture
  }
  const woodMap = loadTexture('/images/installation/walnut-albedo.webp')
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping
  woodMap.repeat.set(1, 2)
  const wood = material({ color: '#bba18a', map: woodMap, roughness: .76, bumpMap: woodMap, bumpScale: .035 })
  const darkWood = material({ color: '#82705e', map: woodMap, roughness: .68, bumpMap: woodMap, bumpScale: .028 })
  const brass = material({ color: '#a28043', roughness: .43, metalness: .72 })
  const chrome = material({ color: '#a7aa9e', roughness: .29, metalness: .78 })
  const enamelMap = loadTexture('/images/installation/enamel-albedo.webp')
  const cream = material({ color: '#ffffff', map: enamelMap, bumpMap: enamelMap, bumpScale: .012, roughness: .52, metalness: .1 })
  const inner = material({ color: '#a59981', roughness: .66 })
  const black = material({ color: '#11100e', roughness: .73 })
  const paper = material({ color: '#c8bb9c', roughness: .96 })
  // The broad, matte floor highlights do not need a full GGX material over
  // the entire viewport. Keep live lights and per-light PCF object shadows.
  const floorMaterial = new THREE.MeshPhongMaterial({ color: '#171818', specular: '#333333', shininess: 2 })
  materials.add(floorMaterial)
  const floor = mesh(scene, new THREE.PlaneGeometry(150, 150), floorMaterial, [0, -.025, 0], false)
  floor.name = 'installation-floor'
  floor.rotation.x = -Math.PI / 2
  scene.add(new THREE.HemisphereLight('#b5c5d1', '#3b2617', .42))
  await buildYield()

  function spotlight(parent, color, intensity, position, targetPosition, angle, shadows = true) {
    const light = new THREE.SpotLight(color, intensity, 20, angle, .11, 1.65)
    light.position.set(...position)
    light.target.position.set(...targetPosition)
    light.castShadow = shadows
    if (shadows) {
      light.shadow.autoUpdate = false
      light.shadow.needsUpdate = true
      shadowLights.push(light)
    }
    light.shadow.mapSize.set(1024, 1024)
    light.shadow.bias = -.00015
    light.shadow.normalBias = .018
    light.shadow.camera.near = .2
    light.shadow.camera.far = 20
    parent.add(light, light.target)
    return light
  }
  spotlight(groups.past, '#8bbce2', 84, [-1, 5.8, 1.8], [-.3, 1.1, 0], .48)
  spotlight(groups.present, '#ffd799', 68, [-.6, 6, 1.5], [0, .6, 0], .43)
  spotlight(groups.future, '#ffe9bb', 64, [-1, 5.4, 1.2], [0, .5, 0], .58)
  spotlight(groups.fridge, '#ffd9a6', 45, [-.6, 5.8, 1.8], [0, 1.1, 0], .36)
  // A broad, non-shadow-casting photographic fill reveals the front surfaces
  // without lighting the infinite floor or washing out the black background.
  spotlight(scene, '#b8c2d2', 24, [0, 7, 9], [0, 1.2, 0], .68, false)
  spotlight(groups.past, '#c8d4df', 32, [-1.2, 3.4, 4], [-.5, 1.7, 0], .42, false)
  spotlight(groups.future, '#e8cfaa', 35, [0, 2, 4], [0, .7, 0], .9, false)
  spotlight(groups.present, '#e8cfaa', 24, [1, 2.5, 3], [0, .8, 0], .75, false)

  // A low-density scattering surface makes the direction of the hard gallery
  // lights visible. It is real scene geometry with depth testing, not a flat
  // drawn lamp or an opaque cone covering the furniture.
  function lightBeam(parent, color, position, target, angle, opacity) {
    const start = new THREE.Vector3(...position)
    const end = new THREE.Vector3(...target)
    const length = start.distanceTo(end)
    const surface = new THREE.ShaderMaterial({
      uniforms: { tint: { value: new THREE.Color(color) }, density: { value: opacity } },
      vertexShader: `
        varying vec3 viewNormal;
        varying vec3 viewDirection;
        varying float beamHeight;
        void main() {
          viewNormal = normalize(normalMatrix * normal);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          viewDirection = normalize(-p.xyz);
          beamHeight = uv.y;
          gl_Position = projectionMatrix * p;
        }
      `,
      fragmentShader: `
        uniform vec3 tint;
        uniform float density;
        varying vec3 viewNormal;
        varying vec3 viewDirection;
        varying float beamHeight;
        void main() {
          float facing = pow(abs(dot(normalize(viewNormal), normalize(viewDirection))), 2.2);
          float falloff = pow(beamHeight, 1.25) * (1.0 - smoothstep(0.84, 1.0, beamHeight));
          gl_FragColor = vec4(tint, facing * falloff * density);
        }
      `,
      transparent: true, depthWrite: false, side: THREE.FrontSide,
    })
    materials.add(surface)
    const cone = mesh(parent, new THREE.ConeGeometry(Math.tan(angle) * length * .82, length, 48, 1, true), surface, start.clone().lerp(end, .5).toArray(), false)
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), start.clone().sub(end).normalize())
    cone.renderOrder = 3
  }
  lightBeam(groups.past, '#779dc1', [-1, 5.8, 1.8], [-.3, .2, 0], .4, .065)
  lightBeam(groups.present, '#d6a85d', [-.6, 6, 1.5], [0, .2, 0], .37, .055)
  lightBeam(groups.fridge, '#b08b56', [-.6, 5.8, 1.8], [0, .2, 0], .31, .04)

  function table(parent, w, d, h, topMaterial = wood) {
    box(parent, w, .13, d, topMaterial, [0, h - .065, 0], .024)
    for (const x of [-w / 2 + .16, w / 2 - .16]) {
      for (const z of [-d / 2 + .14, d / 2 - .14]) {
        box(parent, .13, h - .1, .13, darkWood, [x, (h - .1) / 2, z], .018)
        box(parent, .15, .045, .15, darkWood, [x, .035, z], .01)
      }
    }
    for (const z of [-d / 2 + .075, d / 2 - .075]) box(parent, w - .12, .22, .09, darkWood, [0, h - .22, z], .012)
    for (const x of [-w / 2 + .075, w / 2 - .075]) box(parent, .09, .22, d - .18, darkWood, [x, h - .22, 0], .012)
  }
  await buildYield()

  // Past: a small table and a turned wood coat rack with a draped, folded coat.
  const pastTable = new THREE.Group()
  pastTable.position.set(.65, 0, .22)
  groups.past.add(pastTable)
  table(pastTable, 1.32, .94, 1.42)
  const rack = new THREE.Group()
  rack.position.set(-.78, 0, -.1)
  groups.past.add(rack)
  mesh(rack, new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(.13, .02), new THREE.Vector2(.14, .12),
    new THREE.Vector2(.07, .3), new THREE.Vector2(.055, 2.7), new THREE.Vector2(.095, 2.82),
    new THREE.Vector2(.045, 2.93), new THREE.Vector2(.08, 3.04), new THREE.Vector2(0, 3.13),
  ], 24), darkWood)
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + .35
    const v = (r, y) => [Math.cos(a) * r, y, Math.sin(a) * r]
    tube(rack, [v(.05, .5), v(.18, .25), v(.4, .09), v(.55, .06)], .047, darkWood)
    tube(rack, [v(.03, 2.55), v(.24, 2.6), v(.42, 2.78), v(.43, 2.94)], .026, darkWood)
    mesh(rack, new THREE.SphereGeometry(.048, 12, 8), wood, v(.43, 2.94))
  }
  const coat = new THREE.Group()
  coat.position.set(-.25, .82, .15)
  coat.rotation.set(.02, -.1, -.12)
  rack.add(coat)
  const fabric = material({ color: '#4b3a2a', roughness: .95, bumpMap: woodMap, bumpScale: .012, side: THREE.DoubleSide })
  const folds = []
  const uv = []
  const indices = []
  const rows = 30, cols = 44
  for (let y = 0; y <= rows; y++) {
    const t = y / rows
    const breadth = .29 - .05 * Math.sin(t * Math.PI) - .13 * Math.max(0, (t - .8) * 5)
    for (let j = 0; j <= cols; j++) {
      const angle = .13 + (Math.PI * 2 - .26) * j / cols
      const ripple = .012 * Math.sin(angle * 5 + t * 2) + .006 * Math.sin(angle * 9 - t * 4)
      folds.push(Math.sin(angle) * (breadth + ripple), t * 1.58 + .018 * Math.sin(angle * 7) * (1 - t), Math.cos(angle) * (.13 + ripple))
      uv.push(j / cols, t)
      if (y < rows && j < cols) {
        const a = y * (cols + 1) + j, b = a + cols + 1
        indices.push(a, b, a + 1, b, b + 1, a + 1)
      }
    }
  }
  const coatGeometry = new THREE.BufferGeometry()
  coatGeometry.setAttribute('position', new THREE.Float32BufferAttribute(folds, 3))
  coatGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  coatGeometry.setIndex(indices)
  coatGeometry.computeVertexNormals()
  mesh(coat, coatGeometry, fabric)
  for (const side of [-1, 1]) {
    const sleeve = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .18, 1.3, 0), new THREE.Vector3(side * .35, 1.08, .02),
      new THREE.Vector3(side * .4, .68, .08), new THREE.Vector3(side * .38, .22, .13),
    ]), 24, .11, 12, false)
    const positions = sleeve.attributes.position
    for (let i = 0; i < positions.count; i++) positions.setZ(i, positions.getZ(i) + .006 * Math.sin(positions.getY(i) * 13))
    sleeve.computeVertexNormals()
    mesh(coat, sleeve, fabric)
    const lapel = new THREE.Shape()
    lapel.moveTo(side * .04, 1.48)
    lapel.lineTo(side * .16, 1.56)
    lapel.lineTo(side * .23, 1.37)
    lapel.lineTo(side * .07, 1.08)
    lapel.closePath()
    mesh(coat, new THREE.ExtrudeGeometry(lapel, { depth: .015, bevelEnabled: false }), fabric, [0, 0, .145])
    tube(coat, [[side * .14, .66, .137], [side * .24, .69, .12]], .009, fabric)
  }
  for (const y of [.53, .78, 1.03]) mesh(coat, new THREE.SphereGeometry(.018, 8, 6), brass, [.045, y, .148])
  await buildYield()

  // Present: a proper writing desk, drawers, hardware, shelf and bound books.
  table(groups.present, 2.8, 1.22, 1.56)
  box(groups.present, .82, 1.11, 1.06, darkWood, [-.83, .9, -.01], .022)
  for (let i = 0; i < 3; i++) {
    const y = .54 + i * .35
    box(groups.present, .74, .31, .045, wood, [-.83, y, .55], .014)
    tube(groups.present, [[-.95, y, .595], [-.95, y - .025, .64], [-.71, y - .025, .64], [-.71, y, .595]], .015, brass)
  }
  box(groups.present, 2.24, .065, .38, wood, [0, 2.78, -.42], .015)
  for (const x of [-.82, .82]) tube(groups.present, [[x, 2.79, -.54], [x, 2.51, -.54], [x, 2.78, -.27]], .018, brass)
  await buildYield()

  // Future: luminous opal glass set into a thick, bevelled wooden light table.
  table(groups.future, 4.6, 2.6, 1.58)
  box(groups.future, 4.25, .13, 2.28, material({ color: '#e9d6a8', emissive: '#ffdea0', emissiveIntensity: .9, roughness: .4 }), [0, 1.56, 0], .022)
  for (const z of [-1.24, 1.24]) box(groups.future, 4.6, .1, .12, wood, [0, 1.61, z], .018)
  for (const x of [-2.24, 2.24]) box(groups.future, .12, .1, 2.4, wood, [x, 1.61, 0], .018)
  const tableBounce = new THREE.PointLight('#ffce83', 3.2, 4.4, 2)
  tableBounce.position.set(0, 1.95, 0)
  groups.future.add(tableBounce)
  await buildYield()

  // Temporal island: hollow refrigerator cabinet, shelves and a hinged door.
  const fridge = groups.fridge
  box(fridge, 1.46, 3.12, .12, cream, [0, 1.64, -.5], .045)
  for (const x of [-.685, .685]) box(fridge, .15, 3.1, 1.12, cream, [x, 1.64, 0], .04)
  for (const y of [.16, 2.24, 3.12]) box(fridge, 1.4, .15, 1.13, cream, [0, y, 0], .035)
  for (const x of [-.54, .54]) for (const z of [-.36, .38]) box(fridge, .13, .12, .16, black, [x, .06, z], .018)
  box(fridge, 1.25, 1.91, .04, inner, [0, 1.2, -.405], .02)
  for (const y of [.45, 1.07, 1.68]) {
    box(fridge, 1.19, .028, .91, inner, [0, y, .04], .005)
    box(fridge, 1.2, .035, .035, chrome, [0, y, .505], .006)
  }
  box(fridge, 1.38, .79, .19, cream, [0, 2.7, .57], .065)
  tube(fridge, [[-.51, 2.4, .7], [-.55, 2.45, .77], [-.55, 2.88, .77], [-.51, 2.94, .7]], .026, chrome)
  const magnetBlue = material({ color: '#3982ad', roughness: .7 })
  const magnetGold = material({ color: '#edbd3c', roughness: .7 })
  box(fridge, .19, .2, .035, magnetGold, [.13, 2.88, .69], .008).rotation.z = -.07
  box(fridge, .18, .17, .035, magnetBlue, [.39, 2.6, .69], .008).rotation.z = .06
  // Small enamel wear follows the cabinet edges, rather than a noisy overlay.
  const wear = material({ color: '#614b31', roughness: 1 })
  for (let i = 0; i < 22; i++) {
    const x = i % 2 ? -.75 : .75
    box(fridge, .008, .012 + (i % 3) * .012, .018, wear, [x, .4 + (i * .137) % 2.65, .38 - (i % 4) * .13])
  }
  const door = new THREE.Group()
  door.position.set(.735, 1.22, .59)
  door.rotation.y = doorAngle
  fridge.add(door)
  box(door, 1.43, 2.02, .17, cream, [-.715, 0, .04], .058)
  box(door, 1.22, 1.79, .09, inner, [-.715, 0, -.08], .035)
  for (const y of [-.56, .08]) {
    box(door, 1.05, .055, .16, inner, [-.715, y, -.19], .012)
    tube(door, [[-1.22, y, -.28], [-1.22, y + .12, -.28], [-.21, y + .12, -.28], [-.21, y, -.28]], .018, inner)
  }
  tube(door, [[-1.25, .18, .15], [-1.29, .23, .23], [-1.29, .71, .23], [-1.25, .76, .15]], .028, chrome)
  const redLight = new THREE.PointLight('#ff160b', 5.5, 4.4, 1.5)
  redLight.position.set(0, 1.85, .18)
  fridge.add(redLight)
  const redBulb = box(fridge, .47, .04, .07, material({ color: '#ff3422', emissive: '#ff1004', emissiveIntensity: 4 }), [0, 2.12, .02], .01)
  const redSpill = spotlight(fridge, '#ff1c0e', 6, [0, 1.4, .25], [0, .05, 1.4], .7, false)

  const photoTextures = [1, 2, 3, 4].map(n => loadTexture(`/images/trail/photo-${n}.webp`))
  await buildYield()
  function photo(parent, n, scale = 1) {
    const w = .66 * scale, d = .47 * scale
    box(parent, w, .013, d, paper, [0, .008, 0], .004)
    const image = mesh(parent, new THREE.PlaneGeometry(w - .055, d - .065), material({ map: photoTextures[n - 1], roughness: .85, color: '#eee2cd' }), [0, .016, -.005])
    image.rotation.x = -Math.PI / 2
    return parent
  }
  function bottle(parent, color, size = 1) {
    const glass = material({ color, roughness: .18, metalness: .08, transparent: true, opacity: .84, side: THREE.DoubleSide })
    const shape = new THREE.LatheGeometry([
      new THREE.Vector2(0, 0), new THREE.Vector2(.14, 0), new THREE.Vector2(.16, .025),
      new THREE.Vector2(.16, .4), new THREE.Vector2(.145, .46), new THREE.Vector2(.07, .51),
      new THREE.Vector2(.065, .63), new THREE.Vector2(.08, .64),
    ], 24)
    const vessel = mesh(parent, shape, glass, [0, 0, 0])
    vessel.scale.setScalar(size)
    mesh(parent, new THREE.CylinderGeometry(.078 * size, .078 * size, .09 * size, 20), black, [0, .655 * size, 0])
    box(parent, .2 * size, .2 * size, .006, paper, [0, .25 * size, .161 * size], .002)
    for (const y of [.2, .25, .29]) box(parent, .12 * size, .006 * size, .004, darkWood, [0, y * size, .166 * size])
  }
  const buildCollectionObject = createCollectionBuilder({ mesh, box, tube, material, textures, loadTexture, photo, bottle, photoTextures, wood, darkWood, brass, chrome, black, paper })
  function localBounds(object) {
    object.updateWorldMatrix(true, true)
    const inverse = object.matrixWorld.clone().invert(), bounds = new THREE.Box3()
    object.traverse(child => {
      if (!child.isMesh) return
      child.geometry.computeBoundingBox()
      bounds.union(child.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld)))
    })
    return bounds
  }
  if (FRAGMENTS.find(item => item.number === 1)?.image) coat.removeFromParent()
  for (const definition of FRAGMENTS) {
    const onRack = definition.number === 1 && !definition.image
    const object = onRack ? coat : new THREE.Group()
    object.name = definition.id
    object.userData.fragmentId = definition.id
    buildCollectionObject(definition, object)
    if (!onRack) {
      const sourceRotation = definition.image ? (definition.position[1] > 2.7 ? [Math.PI / 2, 0, 0] : [0, definition.angle || 0, 0]) : (definition.sourceRotation || [0, definition.angle || 0, 0])
      object.rotation.set(...sourceRotation)
      object.scale.setScalar(definition.sourceScale || 1)
      object.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(object)
      object.position.set(definition.position[0], definition.position[1] - bounds.min.y, definition.position[2])
      groups[definition.island].add(object)
    }
    object.userData.home = object.position.clone()
    object.userData.homeRotation = object.rotation.clone()
    object.userData.homeScale = object.scale.clone()
    object.userData.homeParent = object.parent
    const button = root.querySelector(`[data-object="${definition.id}"]`)
    const bounds = localBounds(object), center = bounds.getCenter(new THREE.Vector3())
    const tableRotation = new THREE.Euler(...(definition.image ? [0, definition.angle || 0, 0] : (definition.tableRotation || [0, 0, 0])))
    tableRotation.y += definition.image ? 0 : (definition.angle || 0)
    const tableBounds = bounds.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(tableRotation))
    const size = tableBounds.getSize(new THREE.Vector3()), tableScale = Math.min(1, .86 / Math.max(size.x, size.z))
    tableBounds.min.multiplyScalar(tableScale); tableBounds.max.multiplyScalar(tableScale)
    const tableCenter = tableBounds.getCenter(new THREE.Vector3())
    objects.set(definition.id, { object, button, definition, center, tableRotation, tableScale, tableSize: tableBounds.getSize(new THREE.Vector3()), tableOffset: new THREE.Vector3(-tableCenter.x, -tableBounds.min.y + .006, -tableCenter.z), atTable: false, tableSlot: null, tablePosition: null })
    trackShadowObject(object, bounds)
    object.traverse(child => {
      if (!child.isMesh) return
      child.userData.sourceShadow = onRack
      child.castShadow = onRack
      pickables.push(child)
    })
    if (objects.size % 4 === 0) await buildYield()
  }
  // Merge only immutable siblings with identical material/shadow flags. The
  // movable Groups and their fragment IDs remain the raycast/pose boundaries.
  const batching = batchStaticMeshes(scene)
  performanceStats.batchedMeshes = batching.savedMeshes
  const usedGeometries = new Set()
  scene.traverse(object => { if (object.geometry) usedGeometries.add(object.geometry) })
  for (const shape of geometries) {
    if (usedGeometries.has(shape)) continue
    shape.dispose()
    geometries.delete(shape)
  }
  for (const shape of batching.geometries) geometries.add(shape)
  // Release references to removed meshes/buffers after rebuilding the picker.
  pickables.length = 0
  for (const entry of objects.values()) entry.object.traverse(object => { if (object.isMesh) pickables.push(object) })
  batching.removed.length = batching.geometries.length = 0
  const fridgeButton = root.querySelector('.installation-fridge-hit')
  trackShadowObject(door, localBounds(door))
  // Only the object/door Groups move. Their child meshes retain their built
  // local transforms, avoiding hundreds of redundant matrix compositions.
  scene.traverse(object => {
    if (!object.isMesh) return
    object.updateMatrix()
    object.matrixAutoUpdate = false
    performanceStats.staticMeshes++
  })

  function trackShadowObject(object, bounds) {
    object.updateWorldMatrix(true, false)
    const local = bounds.getBoundingSphere(new THREE.Sphere())
    shadowObjects.set(object, { local, current: new THREE.Sphere(), previous: local.clone().applyMatrix4(object.matrixWorld) })
  }
  function markShadowsDirty(object = null) {
    shadowsDirty = true
    if (object && shadowObjects.has(object)) dirtyShadowObjects.add(object)
    else allShadowsDirty = true
  }
  function prepareShadowUpdates(forceAll = false) {
    if (!shadowsDirty && !forceAll) return
    const all = forceAll || allShadowsDirty
    if (all) shadowLights.forEach(light => { light.shadow.needsUpdate = true })
    const changed = all ? shadowObjects.keys() : dirtyShadowObjects
    for (const object of changed) {
      const tracker = shadowObjects.get(object)
      object.updateWorldMatrix(true, false)
      const current = tracker.current.copy(tracker.local).applyMatrix4(object.matrixWorld)
      if (!all) {
        for (const light of shadowLights) {
          // A bounding sphere deliberately overestimates the caster: both its
          // previous and current footprint must be covered to erase old shadows.
          const frustum = light.shadow.getFrustum()
          if (!light.shadow.map || frustum.intersectsSphere(tracker.previous) || frustum.intersectsSphere(current)) light.shadow.needsUpdate = true
        }
      }
      tracker.previous.copy(current)
    }
    const requested = shadowLights.filter(light => light.visible && light.shadow.needsUpdate).length
    renderer.shadowMap.needsUpdate = requested > 0
    performanceStats.shadowBatches++
    performanceStats.shadowMapsRequested += requested
    performanceStats.lastShadowMaps = requested
    dirtyShadowObjects.clear()
    allShadowsDirty = shadowsDirty = false
  }
  function invalidate(withShadows = true, object = null) {
    if (disposed) return
    dirty = true
    if (withShadows) markShadowsDirty(object)
    requestFrame()
  }
  function requestFrame() {
    if (prepared && visible && !document.hidden && !contextLost && !raf) { lastFrame = 0; previousFrameRendered = false; renderBudget.reset(); raf = requestAnimationFrame(frame) }
  }
  function updateCamera() {
    const v = renderedView
    if (topView) {
      // Looking straight down needs a stable screen-up vector, not an orbit
      // clamped just short of the pole. Picking still uses this same camera.
      camera.up.set(0, 0, -1)
      camera.position.set(v.panX, v.panY + .8 + v.distance, v.panZ + .2)
      camera.lookAt(v.panX, v.panY + .8, v.panZ + .2)
      camera.updateMatrixWorld()
      return
    }
    camera.up.set(0, 1, 0)
    const horizontal = Math.cos(v.pitch) * v.distance
    camera.position.set(v.panX + Math.sin(v.yaw) * horizontal, v.panY + 1.2 + Math.sin(v.pitch) * v.distance, v.panZ + Math.cos(v.yaw) * horizontal)
    camera.lookAt(v.panX, v.panY + (mobile ? 1.2 : .8), v.panZ + .2)
    camera.updateMatrixWorld()
  }
  function toScreen(position) {
    projected.copy(position).project(camera)
    return { x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, inside: projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 }
  }
  function setOverlayVisibility(element, inside) {
    const state = overlayState.get(element) || {}
    if (state.inside !== inside) {
      element.style.opacity = inside ? '1' : '0'
      element.style.visibility = inside ? 'visible' : 'hidden'
      performanceStats.overlayWrites += 2
      state.inside = inside
    }
    const tabIndex = inside ? 0 : -1
    if (state.tabIndex !== tabIndex) {
      element.tabIndex = tabIndex
      performanceStats.overlayWrites++
      state.tabIndex = tabIndex
    }
    overlayState.set(element, state)
    return state
  }
  function place(element, point) {
    const p = toScreen(point)
    performanceStats.overlayProjections++
    const state = setOverlayVisibility(element, p.inside)
    if (p.inside) {
      if (state.x !== p.x) { element.style.left = `${p.x}px`; state.x = p.x; performanceStats.overlayWrites++ }
      if (state.y !== p.y) { element.style.top = `${p.y}px`; state.y = p.y; performanceStats.overlayWrites++ }
    }
    return p.inside
  }
  function projectOverlay(element, localPoint, matrix, cameraChanged) {
    const previous = overlayState.get(element)
    if (!cameraChanged && !previous?.occluded && previous?.matrix?.equals(matrix)) return
    place(element, worldPosition.copy(localPoint).applyMatrix4(matrix))
    const state = overlayState.get(element)
    state.occluded = false
    state.matrix ||= new THREE.Matrix4()
    state.matrix.copy(matrix)
  }
  const fridgeOverlayPoint = new THREE.Vector3(-.71, .05, .1)
  function updateOverlays() {
    // The renderer just updated world matrices; localToWorld would repeatedly
    // recompute every object's ancestor chain, after another full scene walk.
    performanceStats.overlayPasses++
    const cameraChanged = !overlayCameraReady || !overlayCameraMatrix.equals(camera.matrixWorld) || !overlayProjectionMatrix.equals(camera.projectionMatrix)
    for (const entry of objects.values()) {
      const inFridge = entry.definition.island === 'fridge' && !entry.atTable
      if (inFridge && doorAngle < .55) {
        setOverlayVisibility(entry.button, false).occluded = true
        continue
      }
      projectOverlay(entry.button, entry.center, entry.object.matrixWorld, cameraChanged)
    }
    projectOverlay(fridgeButton, fridgeOverlayPoint, door.matrixWorld, cameraChanged)
    overlayCameraMatrix.copy(camera.matrixWorld)
    overlayProjectionMatrix.copy(camera.projectionMatrix)
    overlayCameraReady = true
  }
  function cacheRect() {
    const rect = canvas.getBoundingClientRect()
    Object.assign(cachedRect, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  }
  function positionControls() {
    controlsFrame = 0
    if (disposed) return
    // Leave the mark and the sticky room actions their own vertical space.
    const top = clamp(184 - (controlsDocumentTop - window.scrollY), 12, Math.max(12, height - controlsHeight - 12))
    navigationBar.style.top = `${Math.round(top)}px`
  }
  function resize() {
    if (disposed) return
    // Cache document geometry on layout changes, not on every scroll frame.
    controlsDocumentTop = stage.getBoundingClientRect().top + window.scrollY
    controlsHeight = navigationBar.offsetHeight
    positionControls()
    const nextWidth = stage.clientWidth, nextHeight = stage.clientHeight
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return
    const previousMobile = mobile
    const firstSize = width === 1
    width = nextWidth
    height = nextHeight
    overlayCameraReady = false
    mobile = width < 650
    const relayout = firstSize || mobile !== previousMobile
    if (relayout) {
      const layout = mobile ? MOBILE_LAYOUT : BASE_LAYOUT
      for (const [id, group] of Object.entries(groups)) {
        group.position.set(...layout[id])
        group.scale.setScalar(mobile ? (id === 'fridge' ? .9 : id === 'future' ? .82 : .65) : 1)
      }
    }
    camera.aspect = width / Math.max(1, height)
    camera.fov = mobile ? 40 : 35
    camera.updateProjectionMatrix()
    renderBudget.resize(width, height)
    cacheRect()
    positionControls()
    if (relayout) markShadowsDirty()
    if (topView) frameTableFromAbove()
    else if (relayout) resetView()
    else invalidate(false)
  }
  function frameTableFromAbove() {
    scene.updateMatrixWorld(true)
    const center = groups.future.localToWorld(new THREE.Vector3(0, 1.64, 0))
    const scale = groups.future.scale.x
    const distance = Math.max(5.2 * scale / camera.aspect, 3.25 * scale) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))
    view = { yaw: 0, pitch: Math.PI / 2, distance, panX: center.x, panY: center.y - .8, panZ: center.z - .2 }
    renderedView = { ...view }
    updateCamera()
    invalidate(false)
  }
  function setTopView(enabled) {
    if (!prepared || disposed || contextLost || !!enabled === topView) return
    setNavigation(false)
    cancelGestures()
    topView = !!enabled
    if (topView) {
      previousView = { ...view }
      frameTableFromAbove()
    } else {
      view = { ...previousView }
      renderedView = { ...view }
      previousView = null
      updateCamera()
      invalidate(false)
    }
    callbacks.onViewChange?.(topView)
  }
  function resetView() {
    topView = false
    previousView = null
    callbacks.onViewChange?.(false)
    view = { yaw: 0, pitch: mobile ? .45 : .38, distance: mobile ? 18.5 : 16.8, panX: 0, panY: 0, panZ: 0 }
    renderedView = { ...view }
    updateCamera()
    invalidate(false)
  }
  function frame(time) {
    raf = 0
    if (disposed || !visible || document.hidden || contextLost) return
    if (renderBudget.sample(time, previousFrameRendered)) dirty = true
    previousFrameRendered = false
    const elapsed = Math.max(0, (time - (lastFrame || time - 16)) / 1000)
    const dt = Math.min(.15, elapsed)
    const dampingTime = Math.min(.5, elapsed)
    lastFrame = time
    let moving = false
    if (navigating && cameraKeys.size) {
      const speed = Math.max(1.6, view.distance * .27) * dt
      const lateral = Number(cameraKeys.has('d')) - Number(cameraKeys.has('a'))
      const forward = Number(cameraKeys.has('w')) - Number(cameraKeys.has('s'))
      view.panX = clamp(view.panX + (Math.cos(view.yaw) * lateral - Math.sin(view.yaw) * forward) * speed, -12, 12)
      view.panZ = clamp(view.panZ + (-Math.sin(view.yaw) * lateral - Math.cos(view.yaw) * forward) * speed, -12, 12)
      view.panY = clamp(view.panY + (Number(cameraKeys.has('e')) - Number(cameraKeys.has('q'))) * speed, -.5, 4)
      view.yaw += (Number(cameraKeys.has('arrowright')) - Number(cameraKeys.has('arrowleft'))) * dt * 1.6
      view.pitch = clamp(view.pitch + (Number(cameraKeys.has('arrowup')) - Number(cameraKeys.has('arrowdown'))) * dt, .07, 1.4)
      moving = dirty = true
    }
    for (const key of Object.keys(view)) {
      const next = reducedMotion.matches ? view[key] : THREE.MathUtils.damp(renderedView[key], view[key], 16, dampingTime)
      const settled = Math.abs(next - view[key]) < .0003
      renderedView[key] = settled ? view[key] : next
      if (!settled) moving = dirty = true
    }
    if (Math.abs(doorAngle - doorTarget) > .001) {
      doorAngle = reducedMotion.matches ? doorTarget : THREE.MathUtils.damp(doorAngle, doorTarget, 9, dampingTime)
      if (Math.abs(doorAngle - doorTarget) < .005) doorAngle = doorTarget
      door.rotation.y = doorAngle
      const lightFactor = clamp(doorAngle / 1.1, 0, 1)
      redLight.intensity = 5.5 * lightFactor
      redSpill.intensity = 6 * lightFactor
      redBulb.material.emissiveIntensity = 4 * lightFactor
      dirty = true
      markShadowsDirty(door)
      moving = true
    }
    for (const [id, motion] of motions) {
      const progress = reducedMotion.matches ? 1 : clamp((time - motion.startedAt) / 650, 0, 1)
      const t = 1 - Math.pow(1 - progress, 3)
      motion.object.position.lerpVectors(motion.start, motion.end, t)
      motion.object.position.y += Math.sin(Math.PI * progress) * .5
      if (progress === 1) motions.delete(id)
      dirty = true
      markShadowsDirty(motion.object)
      moving = true
    }
    if (dirty || moving) {
      updateCamera()
      prepareShadowUpdates()
      renderer.render(scene, camera)
      previousFrameRendered = true
      updateOverlays()
      dirty = shadowsDirty = false
    }
    // Keep one sampling sequence during a held gesture. A drag moves the
    // object directly, so it may have no interpolation motion; ending its RAF
    // after each pointer event used to reset the quality controller every time.
    // Unchanged gesture frames remain cheap: the render stays guarded by dirty.
    if (moving || motions.size || drag || orbit || pinch) raf = requestAnimationFrame(frame)
  }
  function select(entry) {
    selectedId = entry.definition.id
    callbacks.onSelect(entry.definition, entry.atTable)
  }
  function animateObject(entry, parent, target) {
    motions.delete(entry.definition.id)
    parent.attach(entry.object)
    if (reducedMotion.matches || !visible || document.hidden || contextLost) entry.object.position.copy(target)
    else {
      const start = entry.object.position.clone()
      motions.set(entry.definition.id, { object: entry.object, start, end: target.clone(), startedAt: performance.now() })
    }
    invalidate(true, entry.object)
  }
  const tableSlots = [[0, 0], [-.88, 0], [.88, 0], [0, -.6], [0, .6], [-.88, -.6], [.88, -.6], [-.88, .6], [.88, .6], [-1.65, 0], [1.65, 0], [-1.65, -.6], [1.65, -.6], [-1.65, .6], [1.65, .6]]
  function tablePosition(entry) {
    if (entry.tableSlot === null) {
      const used = new Set([...objects.values()].filter(e => e !== entry && e.atTable).map(e => e.tableSlot))
      let slot = 0
      while (used.has(slot)) slot++
      entry.tableSlot = slot
    }
    const [x, z] = tableSlots[entry.tableSlot % tableSlots.length]
    return new THREE.Vector3(x, 1.64 + Math.floor(entry.tableSlot / tableSlots.length) * .02, z).add(entry.tableOffset)
  }
  function tablePose(entry) {
    entry.object.rotation.copy(entry.tableRotation)
    entry.object.scale.setScalar(entry.tableScale)
    entry.object.traverse(child => { if (child.isMesh) child.castShadow = true })
  }
  function homePose(entry) {
    entry.object.rotation.copy(entry.object.userData.homeRotation)
    entry.object.scale.copy(entry.object.userData.homeScale)
    entry.object.traverse(child => { if (child.isMesh) child.castShadow = child.userData.sourceShadow })
  }
  function moveToTable(id) {
    const entry = objects.get(id)
    if (!entry) return
    if (entry.definition.island === 'fridge' && !fridgeOpen) toggleFridge()
    entry.atTable = true
    const target = entry.tablePosition || tablePosition(entry)
    entry.tablePosition = target.clone()
    animateObject(entry, groups.future, target)
    tablePose(entry)
    select(entry)
  }
  function returnToIsland(id) {
    const entry = objects.get(id)
    if (!entry) return
    animateObject(entry, entry.object.userData.homeParent, entry.object.userData.home)
    homePose(entry)
    entry.atTable = false
    entry.tableSlot = entry.tablePosition = null
    if (entry.definition.island === 'fridge' && !fridgeOpen) toggleFridge()
    select(entry)
  }
  function setRay(event) {
    pointer.set((event.clientX - cachedRect.left) / cachedRect.width * 2 - 1, -(event.clientY - cachedRect.top) / cachedRect.height * 2 + 1)
    raycaster.setFromCamera(pointer, camera)
  }
  function beginDrag(event, entry) {
    if (event.button !== 0 || event.shiftKey || contextLost || !prepared || drag) return
    view = { ...renderedView }
    event.preventDefault()
    event.stopPropagation()
    cacheRect()
    setRay(event)
    // Expanded touch targets can overlap on a small screen. Prefer the actual
    // 3D surface under the finger before falling back to the expanded target.
    const hit = raycaster.intersectObjects(pickables, false)[0]
    let grabbed = null
    if (hit) {
      let object = hit.object
      while (object && !object.userData.fragmentId) object = object.parent
      const candidate = object && objects.get(object.userData.fragmentId)
      if (candidate && (candidate.object.parent !== fridge || doorAngle > .55)) { entry = candidate; grabbed = hit.point.clone() }
    }
    motions.delete(entry.definition.id)
    scene.updateMatrixWorld(true)
    entry.object.getWorldPosition(worldPosition)
    grabbed ||= entry.object.localToWorld(entry.center.clone())
    const bottom = new THREE.Box3().setFromObject(entry.object).min.y
    const tableTop = groups.future.localToWorld(new THREE.Vector3(0, 1.64, 0)).y
    scene.attach(entry.object)
    plane.constant = -Math.max(grabbed.y + .12, tableTop + .08 + grabbed.y - bottom)
    drag = {
      entry, pointerId: event.pointerId, target: event.currentTarget,
      startX: event.clientX, startY: event.clientY, moved: false,
      offset: entry.object.position.clone().sub(grabbed),
      startParent: entry.object.userData.homeParent,
    }
    select(entry)
    event.currentTarget.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
    invalidate(true, entry.object)
  }
  function panCamera(dx, dy, start) {
    const units = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * start.distance / height
    cameraRight.setFromMatrixColumn(camera.matrixWorld, 0)
    cameraUp.setFromMatrixColumn(camera.matrixWorld, 1)
    gesturePan.copy(cameraRight).multiplyScalar(-dx * units).addScaledVector(cameraUp, dy * units)
    view.panX = clamp(start.panX + gesturePan.x, -12, 12)
    view.panY = clamp(start.panY + gesturePan.y, -.5, 4)
    view.panZ = clamp(start.panZ + gesturePan.z, -12, 12)
  }
  function beginCamera(event, mode = 'orbit') {
    if (topView) mode = 'pan'
    if (drag || !prepared || contextLost) return
    event.preventDefault()
    cacheRect()
    canvas.setPointerCapture(event.pointerId)
    if (event.pointerType === 'touch') {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (touchPoints.size > 1) {
        const [a, b] = [...touchPoints.values()]
        pinch = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y), view: { ...view } }
        orbit = null
        return
      }
    }
    orbit = { target: canvas, pointerId: event.pointerId, x: event.clientX, y: event.clientY, view: { ...view }, mode }
    canvas.classList.add('is-dragging')
  }
  function movePointer(event) {
    if (drag && event.pointerId === drag.pointerId) {
      event.preventDefault()
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
      drag.moved ||= distance > 5
      if (!drag.moved) return
      setRay(event)
      if (raycaster.ray.intersectPlane(plane, intersection)) {
        drag.entry.object.position.copy(intersection).add(drag.offset)
        drag.entry.object.position.x = clamp(drag.entry.object.position.x, mobile ? -4.5 : -7, mobile ? 4.5 : 7)
        drag.entry.object.position.z = clamp(drag.entry.object.position.z, -5, 6.3)
        invalidate(true, drag.entry.object)
      }
      return
    }
    if (touchPoints.has(event.pointerId)) {
      touchPoints.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch && touchPoints.size > 1) {
        event.preventDefault()
        const [a, b] = [...touchPoints.values()]
        view.distance = clamp(pinch.view.distance * pinch.distance / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), 2.8, 36)
        panCamera((a.x + b.x) / 2 - pinch.x, (a.y + b.y) / 2 - pinch.y, pinch.view)
        invalidate(false)
        return
      }
    }
    if (orbit && event.pointerId === orbit.pointerId) {
      event.preventDefault()
      const dx = event.clientX - orbit.x, dy = event.clientY - orbit.y
      if (orbit.mode === 'pan') panCamera(dx, dy, orbit.view)
      else {
        view.yaw = orbit.view.yaw - dx * .006
        view.pitch = clamp(orbit.view.pitch + dy * .003, .07, 1.4)
      }
      invalidate(false)
    }
  }
  function endPointer(event, cancelled = false) {
    if (drag && event.pointerId === drag.pointerId) {
      const { entry, target, pointerId, moved } = drag
      const position = entry.object.getWorldPosition(new THREE.Vector3())
      drag = null
      if (target.hasPointerCapture(pointerId)) target.releasePointerCapture(pointerId)
      canvas.classList.remove('is-dragging')
      // Drop against the actual light-table surface, independently of the
      // source's height and the temporary plane used to hold the object.
      let onTable = false
      if (!cancelled && moved) {
        setRay(event)
        const top = groups.future.localToWorld(new THREE.Vector3(0, 1.64, 0)).y
        onTable = !!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -top), position)
      }
      const local = groups.future.worldToLocal(position)
      if (!cancelled && moved && onTable && Math.abs(local.x) < 2.35 && Math.abs(local.z) < 1.38) {
        entry.atTable = true
        tablePosition(entry)
        local.x = clamp(local.x, -2.05 + entry.tableSize.x / 2, 2.05 - entry.tableSize.x / 2) + entry.tableOffset.x
        local.y = 1.64 + entry.tableOffset.y
        local.z = clamp(local.z, -1.04 + entry.tableSize.z / 2, 1.04 - entry.tableSize.z / 2) + entry.tableOffset.z
        entry.tablePosition = local.clone()
        animateObject(entry, groups.future, local)
        tablePose(entry)
        select(entry)
      } else if (moved || cancelled) {
        if (entry.atTable) moveToTable(entry.definition.id)
        else returnToIsland(entry.definition.id)
      } else {
        // A simple click reads the memory, leaving the object where it was.
        const parent = entry.atTable ? groups.future : entry.object.userData.homeParent
        parent.attach(entry.object)
        invalidate(false)
      }
    }
    if (touchPoints.has(event.pointerId)) {
      touchPoints.delete(event.pointerId)
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      pinch = null
      if (touchPoints.size === 1) {
        const [id, point] = [...touchPoints.entries()][0]
        orbit = { target: canvas, pointerId: id, x: point.x, y: point.y, view: { ...view }, mode: topView ? 'pan' : 'orbit' }
      } else orbit = null
      if (!touchPoints.size) canvas.classList.remove('is-dragging')
    } else if (orbit && event.pointerId === orbit.pointerId) {
      const target = orbit.target, id = orbit.pointerId
      orbit = null
      if (target.hasPointerCapture(id)) target.releasePointerCapture(id)
      canvas.classList.remove('is-dragging')
    }
  }
  function cancelGestures() {
    if (drag) endPointer({ pointerId: drag.pointerId }, true)
    if (orbit?.target.hasPointerCapture(orbit.pointerId)) orbit.target.releasePointerCapture(orbit.pointerId)
    for (const id of touchPoints.keys()) if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id)
    orbit = pinch = null
    touchPoints.clear()
    cameraKeys.clear()
    canvas.classList.remove('is-dragging')
  }
  function setNavigation(active) {
    active = !!active && prepared && visible && !contextLost
    if (!active) cancelGestures()
    if (navigating === active) return
    navigating = active
    stage.classList.toggle('is-exploring', active)
    stage.toggleAttribute('data-lenis-prevent', active)
    callbacks.onNavigationChange?.(active)
    if (active) canvas.focus({ preventScroll: true })
    else if (document.activeElement === canvas) canvas.blur()
    invalidate(false)
  }
  for (const entry of objects.values()) {
    listen(entry.button, 'pointerdown', event => beginDrag(event, entry))
    listen(entry.button, 'click', event => {
      // Keyboard and assistive-technology activation generates detail === 0.
      if (event.detail === 0) moveToTable(entry.definition.id)
    })
    listen(entry.button, 'keydown', event => {
      if (event.key === 'Escape') {
        event.preventDefault()
        returnToIsland(entry.definition.id)
      } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault()
        const motion = motions.get(entry.definition.id)
        if (motion) entry.object.position.copy(motion.end)
        motions.delete(entry.definition.id)
        const object = entry.object
        object.position.x = clamp(object.position.x + (event.key === 'ArrowLeft' ? -.12 : event.key === 'ArrowRight' ? .12 : 0), entry.atTable ? -1.8 : -1, entry.atTable ? 1.8 : 1)
        object.position.z = clamp(object.position.z + (event.key === 'ArrowUp' ? -.12 : event.key === 'ArrowDown' ? .12 : 0), -.9, .9)
        if (entry.atTable) {
          const cx = clamp(object.position.x - entry.tableOffset.x, -2.05 + entry.tableSize.x / 2, 2.05 - entry.tableSize.x / 2)
          const cz = clamp(object.position.z - entry.tableOffset.z, -1.04 + entry.tableSize.z / 2, 1.04 - entry.tableSize.z / 2)
          object.position.x = cx + entry.tableOffset.x
          object.position.z = cz + entry.tableOffset.z
          entry.tablePosition = object.position.clone()
        }
        select(entry)
        invalidate(true, entry.object)
      }
    })
  }
  listen(stage, 'pointerdown', event => {
    if (event.target.closest('.installation-zoom')) return
    if (event.button === 1 || event.button === 2 || (event.button === 0 && event.shiftKey)) {
      event.stopPropagation()
      beginCamera(event, 'pan')
    }
  }, { capture: true })
  listen(canvas, 'contextmenu', event => event.preventDefault())
  listen(root.querySelector('.installation-hit-targets'), 'contextmenu', event => event.preventDefault())
  listen(canvas, 'pointerdown', event => {
    if (event.button !== 0 || (event.pointerType === 'touch' && !navigating)) return
    cacheRect()
    setRay(event)
    const hit = raycaster.intersectObjects(pickables, false)[0]
    if (hit) {
      let object = hit.object
      while (object && !object.userData.fragmentId) object = object.parent
      if (object) {
        const entry = objects.get(object.userData.fragmentId)
        if (entry.object.parent !== fridge || doorAngle > .55) return beginDrag(event, entry)
      }
    }
    beginCamera(event)
  })
  listen(window, 'pointermove', movePointer, { passive: false })
  listen(window, 'pointerup', event => endPointer(event))
  listen(window, 'pointercancel', event => endPointer(event, true))
  listen(canvas, 'dblclick', event => {
    event.preventDefault()
    setNavigation(!navigating)
  })
  listen(stage, 'wheel', event => {
    // Outside explicit exploration the wheel always belongs to the document.
    // No body lock, global preventDefault or scroll pin is introduced.
    if (!navigating || event.ctrlKey || event.target.closest('.installation-zoom')) return
    event.preventDefault()
    event.stopPropagation()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
    view.distance = clamp(view.distance * Math.exp(clamp(delta, -600, 600) * .0013), 2.8, 36)
    invalidate(false)
  }, { passive: false })
  listen(canvas, 'keydown', event => {
    const key = event.key.toLowerCase()
    if (key === 'enter') {
      event.preventDefault()
      setNavigation(!navigating)
      return
    }
    if (navigating && ['w', 'a', 's', 'd', 'q', 'e', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
      event.preventDefault()
      cameraKeys.add(key)
      invalidate(false)
    }
  })
  listen(window, 'keyup', event => cameraKeys.delete(event.key.toLowerCase()))
  listen(window, 'keydown', event => {
    if (event.key === 'Escape' && (navigating || drag || orbit)) {
      setNavigation(false)
      cancelGestures()
    }
  })
  listen(canvas, 'blur', () => cameraKeys.clear())
  listen(window, 'blur', () => setNavigation(false))
  listen(window, 'pagehide', () => setNavigation(false))
  listen(window, 'scroll', () => {
    if (!controlsFrame) controlsFrame = requestAnimationFrame(positionControls)
  }, { passive: true })
  listen(fridgeButton, 'click', toggleFridge)
  listen(document, 'visibilitychange', () => {
    if (document.hidden) {
      setNavigation(false)
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    }
    else invalidate(false)
  })
  listen(canvas, 'webglcontextlost', event => {
    event.preventDefault()
    contextLost = true
    setNavigation(false)
    if (raf) cancelAnimationFrame(raf)
    if (controlsFrame) cancelAnimationFrame(controlsFrame)
    raf = 0
    callbacks.onUnavailable()
  })
  listen(canvas, 'webglcontextrestored', () => window.location.reload())
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting
    if (!visible || entry.intersectionRect.height < 100) setNavigation(false)
    if (visible) { positionControls(); requestFrame() }
    else if (raf) { cancelAnimationFrame(raf); raf = 0 }
  }, { threshold: [0, .15, .3] })
  observer.observe(stage)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(stage)
  resizeObserver.observe(navigationBar)
  const main = root.closest('main')
  if (main) resizeObserver.observe(main)
  function toggleFridge() {
    fridgeOpen = !fridgeOpen
    doorTarget = fridgeOpen ? Math.PI * .56 : 0
    if (reducedMotion.matches) {
      doorAngle = doorTarget
      door.rotation.y = doorAngle
      redLight.intensity = fridgeOpen ? 5.5 : 0
      redSpill.intensity = fridgeOpen ? 6 : 0
      redBulb.material.emissiveIntensity = fridgeOpen ? 4 : 0
    }
    callbacks.onFridgeChange(fridgeOpen)
    invalidate(true, door)
  }
  async function photographTable() {
    if (!prepared || disposed || contextLost) throw new Error('Aguarde a sala ficar pronta para fotografar.')
    cancelGestures()
    // An object travelling onto the table belongs to the completed arrangement.
    for (const [id, motion] of motions) {
      if (!objects.get(id)?.atTable) continue
      motion.object.position.copy(motion.end)
      motions.delete(id)
    }
    scene.updateMatrixWorld(true)
    const center = groups.future.localToWorld(new THREE.Vector3(0, 1.64, 0))
    const scale = groups.future.scale.x
    const shotCamera = new THREE.OrthographicCamera(-2.6 * scale, 2.6 * scale, 1.625 * scale, -1.625 * scale, .1, 50)
    shotCamera.up.set(0, 0, -1)
    shotCamera.position.set(center.x, center.y + 12, center.z)
    shotCamera.lookAt(center)
    const photograph = document.createElement('canvas')
    photograph.width = 1600
    photograph.height = 1000
    const context = photograph.getContext('2d')
    if (!context) throw new Error('Não foi possível preparar a fotografia.')
    const ratio = renderer.getPixelRatio()
    const visibility = Object.values(groups).map(group => [group, group.visible])
    try {
      // Reuse the warmed renderer for one frame. Copy immediately, before WebGL
      // clears its drawing buffer; no permanent preserveDrawingBuffer overhead.
      for (const group of Object.values(groups)) if (group !== groups.future) group.visible = false
      renderer.setPixelRatio(1)
      renderer.setSize(1600, 1000, false)
      prepareShadowUpdates(true)
      renderer.render(scene, shotCamera)
      context.drawImage(canvas, 0, 0)
    } finally {
      for (const [group, wasVisible] of visibility) group.visible = wasVisible
      renderer.setPixelRatio(ratio)
      renderer.setSize(width, height, false)
      prepareShadowUpdates(true)
      renderer.render(scene, camera)
      overlayCameraReady = false
      invalidate(false)
    }
    return new Promise((resolve, reject) => photograph.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Não foi possível gerar a fotografia. Tente novamente.'))
    }, 'image/png'))
  }
  function reset() {
    cancelGestures()
    motions.clear()
    for (const entry of objects.values()) {
      entry.object.userData.homeParent.add(entry.object)
      entry.object.position.copy(entry.object.userData.home)
      homePose(entry)
      entry.atTable = false
      entry.tableSlot = entry.tablePosition = null
    }
    selectedId = null
    fridgeOpen = true
    doorAngle = doorTarget = Math.PI * .56
    door.rotation.y = doorAngle
    redLight.intensity = 5.5
    redSpill.intensity = 6
    redBulb.material.emissiveIntensity = 4
    callbacks.onFridgeChange(true)
    markShadowsDirty()
    resetView()
  }
  resize()
  try {
    await Promise.all(textureReady)
    await buildYield()
    updateCamera()
    scene.updateMatrixWorld(true)
    await prepareSceneMaterials(renderer, scene, camera, textures, signal)
    await buildYield()
    // The first material uploads, shadow maps and draw happen offscreen while
    // the reader is still in earlier chapters, rather than on the entry frame.
    // Use the actual drawing buffer at a tiny resolution. A render target has
    // a different colour pipeline and required a second full-resolution draw.
    await warmScene(renderer, scene, camera, signal)
    resize()
    dirty = true
    for (const [object, tracker] of shadowObjects) tracker.previous.copy(tracker.local).applyMatrix4(object.matrixWorld)
    allShadowsDirty = shadowsDirty = false
    dirtyShadowObjects.clear()
    await buildYield()
    prepared = true
    preparationMs = Math.round(performance.now() - buildStarted)
  } catch (error) {
    disposeRoom()
    throw error
  }

  // A read-only inspector enables behavioural checks without using the DOM as
  // the source of truth. It also helps diagnose lost WebGL contexts in support.
  api = {
    moveToTable, returnToIsland, reset, resetView, toggleFridge, setNavigation, setTopView, photographTable,
    zoom(direction) { view.distance = clamp(view.distance * Math.exp(direction * .17), 2.8, 36); invalidate(false) },
    inspect() {
      return {
        renderer: 'WebGL', prepared, preparationMs, visible, contextLost, framePending: !!raf, fridgeOpen, doorAngle, redLightIntensity: redLight.intensity, redSpillIntensity: redSpill.intensity,
        viewMode: topView ? 'table-top' : 'room', cameraPosition: camera.position.toArray(), cameraDirection: camera.getWorldDirection(new THREE.Vector3()).toArray(), camera: { ...view }, renderedCamera: { ...renderedView }, navigating, gesturesActive: !!drag || !!orbit || !!pinch, scrollReserved: stage.hasAttribute('data-lenis-prevent'), mobile, selectedId,
        lightTable: toScreen(groups.future.localToWorld(new THREE.Vector3(0, 1.64, 0))),
        objects: [...objects.values()].map(entry => ({ id: entry.definition.id, number: entry.definition.number || null, island: entry.definition.island, kind: entry.definition.kind, parent: entry.object.parent.name, position: entry.object.position.toArray(), scale: entry.object.scale.toArray(), atTable: entry.atTable, footprint: entry.atTable ? { x: entry.object.position.x - entry.tableOffset.x, z: entry.object.position.z - entry.tableOffset.z, width: entry.tableSize.x, depth: entry.tableSize.z } : null })),
        performance: { ...performanceStats }, renderedFrames: renderer.info.render.frame, movingObjects: motions.size, renderBudget: renderBudget.inspect(),
        drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
      }
    },
    dispose: disposeRoom,
  }
  function disposeRoom() {
    if (disposed) return
    setNavigation(false)
    disposed = true
    if (raf) cancelAnimationFrame(raf)
    if (controlsFrame) cancelAnimationFrame(controlsFrame)
    raf = 0
    observer?.disconnect()
    resizeObserver?.disconnect()
    for (const remove of removers) remove()
    for (const texture of textures) texture.dispose()
    for (const surface of materials) surface.dispose()
    for (const shape of geometries) shape.dispose()
    scene.traverse(object => { if (object.isLight) object.dispose?.() })
    renderer.dispose()
    if (root.installationRoom === api) delete root.installationRoom
  }
  root.installationRoom = api
  callbacks.onReady()
  updateOverlays()
  requestFrame()
  return api
}
