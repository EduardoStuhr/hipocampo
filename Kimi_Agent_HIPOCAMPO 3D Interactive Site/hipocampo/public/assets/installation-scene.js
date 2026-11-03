import * as THREE from './vendor/three.module.min.js'

export const FRAGMENTS = [
  { id: 'retrato', label: 'Fotografia de família', island: 'past', islandLabel: 'ilha do passado', kind: 'photo', photo: 1, position: [-.23, 1.43, .04], angle: -.18, memory: 'Ninguém escreveu os nomes no verso. Ainda assim, alguém se lembra do gesto.' },
  { id: 'paisagem', label: 'Fotografia de uma paisagem', island: 'past', islandLabel: 'ilha do passado', kind: 'photo', photo: 2, position: [.22, 1.44, -.12], angle: .22, memory: 'Um cartão-postal de um lugar que talvez só exista na memória de quem partiu.' },
  { id: 'montanha', label: 'Fotografia da montanha', island: 'present', islandLabel: 'ilha do presente', kind: 'photo', photo: 3, position: [.62, 1.57, .12], angle: -.14, memory: 'A montanha permaneceu no mesmo lugar. Quem a fotografou já era outra pessoa.' },
  { id: 'frasco-ambar', label: 'Frasco de revelador', island: 'present', islandLabel: 'ilha do presente', kind: 'bottle', position: [-.8, 1.57, -.12], color: '#653115', size: .8, memory: 'No vidro âmbar, a promessa de uma imagem que ainda não apareceu.' },
  { id: 'frasco-claro', label: 'Frasco de fixador', island: 'present', islandLabel: 'ilha do presente', kind: 'bottle', position: [-.24, 1.57, .04], color: '#8eafa8', size: .62, memory: 'Fixar uma imagem não impede que a lembrança continue mudando.' },
  { id: 'negativo', label: 'Tira de negativos', island: 'future', islandLabel: 'ilha dos futuros', kind: 'film', position: [.58, 1.64, .16], angle: -.12, memory: 'Doze fotogramas de uma tarde que ninguém conseguiu datar. Que história você enxerga aqui?' },
  { id: 'aves', label: 'Fotografia das aves', island: 'future', islandLabel: 'ilha dos futuros', kind: 'photo', photo: 4, position: [-.65, 1.64, .15], angle: .16, memory: 'Talvez seja uma despedida. Talvez seja apenas o começo de um voo.' },
  { id: 'filme', label: 'Rolo de filme guardado', island: 'fridge', islandLabel: 'ilha da temporalidade', kind: 'canister', position: [.22, .49, .26], memory: 'O frio conserva a matéria. O que conserva o tempo vivido?' },
]

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
  const navigationBar = root.querySelector('.installation-navigation-bar')
  const scene = new THREE.Scene()
  scene.background = new THREE.Color('#000000')
  scene.fog = new THREE.Fog('#000000', 25, 55)
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  renderer.shadowMap.autoUpdate = false

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
  let width = 1
  let height = 1
  const cachedRect = { left: 0, top: 0, width: 1, height: 1 }

  async function buildYield() {
    await new Promise(resolve => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(resolve, { timeout: 100 })
      else window.setTimeout(resolve, 0)
    })
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
  const floor = mesh(scene, new THREE.PlaneGeometry(150, 150), material({ color: '#171818', roughness: .96 }), [0, -.025, 0], false)
  floor.rotation.x = -Math.PI / 2
  scene.add(new THREE.HemisphereLight('#b5c5d1', '#3b2617', .42))
  await buildYield()

  function spotlight(parent, color, intensity, position, targetPosition, angle, shadows = true) {
    const light = new THREE.SpotLight(color, intensity, 20, angle, .11, 1.65)
    light.position.set(...position)
    light.target.position.set(...targetPosition)
    light.castShadow = shadows
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
  box(pastTable, .55, .018, .38, material({ color: '#9c7847', roughness: .96 }), [.06, 1.435, -.05]).rotation.y = -.15
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
  const bookColors = ['#283f4b', '#50392b', '#3b3428', '#293f47']
  bookColors.forEach((color, i) => {
    const x = -.69 + i * .19, height = [.52, .62, .44, .57][i]
    const cover = material({ color, roughness: .95 })
    box(groups.present, .14, height, .29, paper, [x, 2.82 + height / 2, -.42], .004)
    box(groups.present, .036, height + .025, .315, cover, [x - .072, 2.82 + height / 2, -.42], .005)
    box(groups.present, .036, height + .025, .315, cover, [x + .072, 2.82 + height / 2, -.42], .005)
    box(groups.present, .17, height + .02, .035, cover, [x, 2.82 + height / 2, -.25], .008)
    for (const f of [.18, .77]) box(groups.present, .14, .011, .008, brass, [x, 2.82 + height * f, -.227])
  })
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
  function canister(parent) {
    mesh(parent, new THREE.CylinderGeometry(.15, .15, .32, 24), black, [0, .16, 0])
    mesh(parent, new THREE.CylinderGeometry(.165, .165, .035, 24), chrome, [0, .332, 0])
    box(parent, .19, .15, .012, magnetGold, [0, .15, .144], .003)
  }
  function film(parent) {
    const frame = material({ color: '#53301a', roughness: .32, metalness: .1, side: THREE.DoubleSide })
    // Sprocket perforations are gaps between narrow connecting strips.
    for (let i = 0; i < 4; i++) {
      const x = -.48 + i * .32
      const image = mesh(parent, new THREE.PlaneGeometry(.27, .21), material({ map: photoTextures[i % 3], color: '#8a6130', roughness: .45 }), [x, .02, 0])
      image.rotation.x = -Math.PI / 2
      for (const z of [-.126, .126]) box(parent, .32, .012, .035, frame, [x, .014, z])
      box(parent, .035, .012, .25, frame, [x + .157, .014, 0])
    }
    for (const z of [-.18, .18]) {
      box(parent, 1.3, .012, .018, frame, [0, .014, z])
      for (let i = 0; i <= 22; i++) box(parent, .024, .012, .055, frame, [-.64 + i * .058, .014, z * .9])
    }
  }
  for (const definition of FRAGMENTS) {
    const object = new THREE.Group()
    object.name = definition.id
    object.userData.fragmentId = definition.id
    object.rotation.y = definition.angle || 0
    if (definition.kind === 'photo') photo(object, definition.photo)
    if (definition.kind === 'bottle') bottle(object, definition.color, definition.size)
    if (definition.kind === 'film') film(object)
    if (definition.kind === 'canister') canister(object)
    const position = [...definition.position]
    if (definition.island === 'past') position[0] += .65
    object.position.set(...position)
    groups[definition.island].add(object)
    object.userData.home = object.position.clone()
    object.userData.homeRotation = object.rotation.clone()
    object.userData.homeParent = object.parent
    const button = root.querySelector(`[data-object="${definition.id}"]`)
    objects.set(definition.id, { object, button, definition, atTable: definition.island === 'future' })
    object.traverse(child => { if (child.isMesh) pickables.push(child) })
    await buildYield()
  }
  for (const x of [-.36, .02, .37]) {
    const object = new THREE.Group()
    object.position.set(x, 1.1, .06)
    bottle(object, '#69271b', .65)
    fridge.add(object)
  }
  const storedBottle = new THREE.Group()
  storedBottle.position.set(-.26, .48, .08)
  bottle(storedBottle, '#918f7c', .58)
  fridge.add(storedBottle)

  const labelPoints = {
    passado: { parent: groups.past, point: new THREE.Vector3(0, 0, 1.25) },
    presente: { parent: groups.present, point: new THREE.Vector3(0, 0, 1.02) },
    futuros: { parent: groups.future, point: new THREE.Vector3(0, 0, 1.65) },
    temporalidade: { parent: fridge, point: new THREE.Vector3(0, 0, 1.1) },
  }
  const labels = Object.entries(labelPoints).map(([id, value]) => ({ ...value, element: root.querySelector(`[data-island="${id}"]`) }))
  const fridgeButton = root.querySelector('.installation-fridge-hit')

  function invalidate(withShadows = true) {
    if (disposed) return
    dirty = true
    shadowsDirty ||= withShadows
    requestFrame()
  }
  function requestFrame() {
    if (prepared && visible && !document.hidden && !contextLost && !raf) raf = requestAnimationFrame(frame)
  }
  function updateCamera() {
    const v = renderedView
    const horizontal = Math.cos(v.pitch) * v.distance
    camera.position.set(v.panX + Math.sin(v.yaw) * horizontal, v.panY + 1.2 + Math.sin(v.pitch) * v.distance, v.panZ + Math.cos(v.yaw) * horizontal)
    camera.lookAt(v.panX, v.panY + (mobile ? 1.2 : .8), v.panZ + .2)
    camera.updateMatrixWorld()
  }
  function toScreen(position) {
    projected.copy(position).project(camera)
    return { x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, inside: projected.z < 1 && projected.z > -1 && Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 }
  }
  function place(element, point) {
    const p = toScreen(point)
    element.style.left = `${p.x}px`
    element.style.top = `${p.y}px`
    element.style.opacity = p.inside ? '1' : '0'
    element.style.visibility = p.inside ? 'visible' : 'hidden'
    return p.inside
  }
  function updateOverlays() {
    scene.updateMatrixWorld(true)
    for (const label of labels) {
      worldPosition.copy(label.point)
      // On narrow screens the side furniture sits just behind the light table.
      // Put those two labels above it so the script never crosses bright glass.
      if (mobile && (label.parent === groups.past || label.parent === groups.present)) worldPosition.set(0, 4.8, .3)
      place(label.element, label.parent.localToWorld(worldPosition))
    }
    for (const entry of objects.values()) {
      entry.object.getWorldPosition(worldPosition)
      const inFridge = entry.object.parent === fridge
      if (inFridge && doorAngle < .55) {
        entry.button.style.visibility = 'hidden'
        entry.button.tabIndex = -1
        continue
      }
      worldPosition.y += entry.definition.kind === 'bottle' ? .23 : .035
      entry.button.tabIndex = place(entry.button, worldPosition) ? 0 : -1
    }
    place(fridgeButton, door.localToWorld(worldPosition.set(-.71, .05, .1)))
  }
  function cacheRect() {
    const rect = canvas.getBoundingClientRect()
    Object.assign(cachedRect, { left: rect.left, top: rect.top, width: rect.width, height: rect.height })
  }
  function positionControls() {
    controlsFrame = 0
    if (disposed) return
    const top = clamp(96 - (controlsDocumentTop - window.scrollY), 12, Math.max(12, height - controlsHeight - 12))
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
    renderer.setSize(width, height, false)
    cacheRect()
    positionControls()
    if (relayout) { shadowsDirty = true; resetView() }
    else invalidate(false)
  }
  function resetView() {
    view = { yaw: 0, pitch: mobile ? .45 : .38, distance: mobile ? 18.5 : 16.8, panX: 0, panY: 0, panZ: 0 }
    renderedView = { ...view }
    updateCamera()
    invalidate(false)
  }
  function frame(time) {
    raf = 0
    if (disposed || !visible || document.hidden || contextLost) return
    const dt = Math.min(.05, (time - (lastFrame || time - 16)) / 1000)
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
      const next = reducedMotion.matches ? view[key] : THREE.MathUtils.damp(renderedView[key], view[key], 16, dt)
      const settled = Math.abs(next - view[key]) < .0003
      renderedView[key] = settled ? view[key] : next
      if (!settled) moving = dirty = true
    }
    if (Math.abs(doorAngle - doorTarget) > .001) {
      doorAngle = reducedMotion.matches ? doorTarget : THREE.MathUtils.damp(doorAngle, doorTarget, 9, dt)
      if (Math.abs(doorAngle - doorTarget) < .005) doorAngle = doorTarget
      door.rotation.y = doorAngle
      const lightFactor = clamp(doorAngle / 1.1, 0, 1)
      redLight.intensity = 5.5 * lightFactor
      redSpill.intensity = 6 * lightFactor
      redBulb.material.emissiveIntensity = 4 * lightFactor
      dirty = shadowsDirty = true
      moving = true
    }
    for (const [id, motion] of motions) {
      motion.elapsed += dt
      const progress = reducedMotion.matches ? 1 : clamp(motion.elapsed / .65, 0, 1)
      const t = 1 - Math.pow(1 - progress, 3)
      motion.object.position.lerpVectors(motion.start, motion.end, t)
      motion.object.position.y += Math.sin(Math.PI * progress) * .5
      if (progress === 1) motions.delete(id)
      dirty = shadowsDirty = true
      moving = true
    }
    if (dirty || moving) {
      updateCamera()
      scene.updateMatrixWorld(true)
      if (shadowsDirty) renderer.shadowMap.needsUpdate = true
      renderer.render(scene, camera)
      updateOverlays()
      dirty = shadowsDirty = false
    }
    if (moving || motions.size) raf = requestAnimationFrame(frame)
  }
  function select(entry) {
    selectedId = entry.definition.id
    callbacks.onSelect(entry.definition, entry.atTable)
  }
  function animateObject(entry, parent, target) {
    motions.delete(entry.definition.id)
    parent.attach(entry.object)
    if (reducedMotion.matches) entry.object.position.copy(target)
    else {
      const start = entry.object.position.clone()
      motions.set(entry.definition.id, { object: entry.object, start, end: target.clone(), elapsed: 0 })
    }
    invalidate()
  }
  function tablePosition(entry, i) {
    const index = i ?? FRAGMENTS.findIndex(item => item.id === entry.definition.id)
    return new THREE.Vector3(-1.45 + (index % 4) * .91, 1.64, -.56 + Math.floor(index / 4) * .92)
  }
  function moveToTable(id) {
    const entry = objects.get(id)
    if (!entry) return
    entry.atTable = true
    animateObject(entry, groups.future, tablePosition(entry))
    entry.object.rotation.set(0, entry.definition.angle || 0, 0)
    entry.object.scale.setScalar(1)
    select(entry)
  }
  function returnToIsland(id) {
    const entry = objects.get(id)
    if (!entry) return
    animateObject(entry, entry.object.userData.homeParent, entry.object.userData.home)
    entry.object.rotation.copy(entry.object.userData.homeRotation)
    entry.object.scale.setScalar(1)
    entry.atTable = entry.definition.island === 'future'
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
    if (hit) {
      let object = hit.object
      while (object && !object.userData.fragmentId) object = object.parent
      const candidate = object && objects.get(object.userData.fragmentId)
      if (candidate && (candidate.object.parent !== fridge || doorAngle > .55)) entry = candidate
    }
    motions.delete(entry.definition.id)
    scene.updateMatrixWorld(true)
    entry.object.getWorldPosition(worldPosition)
    scene.attach(entry.object)
    plane.constant = -Math.max(worldPosition.y + .12, mobile ? 1.45 : 1.8)
    setRay(event)
    raycaster.ray.intersectPlane(plane, intersection)
    drag = {
      entry, pointerId: event.pointerId, target: event.currentTarget,
      startX: event.clientX, startY: event.clientY, moved: false,
      offset: entry.object.position.clone().sub(intersection),
      startParent: entry.object.userData.homeParent,
    }
    select(entry)
    event.currentTarget.setPointerCapture(event.pointerId)
    canvas.classList.add('is-dragging')
    invalidate()
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
        drag.entry.object.position.y = -plane.constant
        invalidate()
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
      const local = groups.future.worldToLocal(position.clone())
      if (!cancelled && moved && Math.abs(local.x) < 2.7 && Math.abs(local.z) < 1.8) {
        entry.atTable = true
        local.x = clamp(local.x, -1.75, 1.75)
        local.y = 1.64
        local.z = clamp(local.z, -.9, .9)
        animateObject(entry, groups.future, local)
        entry.object.scale.setScalar(1)
        entry.object.rotation.set(0, entry.definition.angle || 0, 0)
        select(entry)
      } else if (moved || cancelled) {
        if (entry.atTable) moveToTable(entry.definition.id)
        else returnToIsland(entry.definition.id)
      } else {
        // A simple click reads the memory, leaving the object where it was.
        const parent = entry.atTable ? groups.future : entry.object.userData.homeParent
        parent.attach(entry.object)
        invalidate()
      }
    }
    if (touchPoints.has(event.pointerId)) {
      touchPoints.delete(event.pointerId)
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      pinch = null
      if (touchPoints.size === 1) {
        const [id, point] = [...touchPoints.entries()][0]
        orbit = { target: canvas, pointerId: id, x: point.x, y: point.y, view: { ...view }, mode: 'orbit' }
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
        select(entry)
        invalidate()
      }
    })
  }
  listen(stage, 'pointerdown', event => {
    if (event.target.closest('.installation-navigation, .installation-zoom')) return
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
  listen(stage, 'wheel', event => {
    // Outside explicit exploration the wheel always belongs to the document.
    // No body lock, global preventDefault or scroll pin is introduced.
    if (!navigating || event.ctrlKey || event.target.closest('.installation-navigation')) return
    event.preventDefault()
    event.stopPropagation()
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1)
    view.distance = clamp(view.distance * Math.exp(clamp(delta, -600, 600) * .0013), 2.8, 36)
    invalidate(false)
  }, { passive: false })
  listen(canvas, 'keydown', event => {
    const key = event.key.toLowerCase()
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
    invalidate()
  }
  function reset() {
    cancelGestures()
    motions.clear()
    for (const entry of objects.values()) {
      entry.object.userData.homeParent.add(entry.object)
      entry.object.position.copy(entry.object.userData.home)
      entry.object.rotation.copy(entry.object.userData.homeRotation)
      entry.object.scale.setScalar(1)
      entry.atTable = entry.definition.island === 'future'
    }
    selectedId = null
    fridgeOpen = true
    doorAngle = doorTarget = Math.PI * .56
    door.rotation.y = doorAngle
    redLight.intensity = 5.5
    redSpill.intensity = 6
    redBulb.material.emissiveIntensity = 4
    callbacks.onFridgeChange(true)
    resetView()
  }
  resize()
  try {
    await Promise.all(textureReady)
    await buildYield()
    updateCamera()
    scene.updateMatrixWorld(true)
    await renderer.compileAsync(scene, camera)
    await buildYield()
    // The first material uploads, shadow maps and draw happen offscreen while
    // the reader is still in earlier chapters, rather than on the entry frame.
    const warmup = new THREE.WebGLRenderTarget(64, 64)
    try {
      renderer.setRenderTarget(warmup)
      renderer.shadowMap.needsUpdate = true
      renderer.render(scene, camera)
    } finally {
      renderer.setRenderTarget(null)
      warmup.dispose()
    }
    await buildYield()
    // Warm the actual drawing buffer too: drivers may create a different
    // pipeline for the onscreen colour space. Await a GPU fence asynchronously
    // so the first visible frame does not pay that cost or block the CPU.
    renderer.shadowMap.needsUpdate = false
    renderer.render(scene, camera)
    dirty = shadowsDirty = false
    const gl = renderer.getContext()
    if (gl.fenceSync) {
      await new Promise((resolve, reject) => {
        const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        gl.flush()
        const poll = () => {
          if (disposed || signal?.aborted || gl.isContextLost()) {
            gl.deleteSync(fence)
            reject(new DOMException('Preparação cancelada', 'AbortError'))
            return
          }
          const status = gl.clientWaitSync(fence, 0, 0)
          if (status === gl.TIMEOUT_EXPIRED) window.setTimeout(poll, 16)
          else {
            gl.deleteSync(fence)
            if (status === gl.WAIT_FAILED) reject(new Error('Falha ao preparar o contexto 3D'))
            else resolve()
          }
        }
        poll()
      })
    }
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
    moveToTable, returnToIsland, reset, resetView, toggleFridge, setNavigation,
    zoom(direction) { view.distance = clamp(view.distance * Math.exp(direction * .17), 2.8, 36); invalidate(false) },
    inspect() {
      return {
        renderer: 'WebGL', prepared, preparationMs, visible, contextLost, framePending: !!raf, fridgeOpen, doorAngle, redLightIntensity: redLight.intensity, redSpillIntensity: redSpill.intensity,
        camera: { ...view }, renderedCamera: { ...renderedView }, navigating, gesturesActive: !!drag || !!orbit || !!pinch, scrollReserved: stage.hasAttribute('data-lenis-prevent'), mobile, selectedId,
        objects: [...objects.values()].map(entry => ({ id: entry.definition.id, parent: entry.object.parent.name, position: entry.object.position.toArray(), atTable: entry.atTable })),
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
