import * as THREE from './vendor/three.module.min.js'
import { buildHouseDoorway } from './house-doorway.js?v=door-fit-1'

// The archive is built in metres, at the same scale as the photographed door.
// The camera traverses its threshold and exit; no screen-space opening is used.
export function createHouseInterior({ scene, door, facade, doorway, unit, pieces, loadTexture }) {
  const width = 5.8, height = 3.65, depth = 14
  const doorW = doorway.width, doorH = doorway.height
  const floorY = doorway.floorY
  const root = new THREE.Group()
  root.name = 'house-archive'
  root.position.set(door.x, floorY, 0)
  scene.add(root)
  const shapes = new Set(), surfaces = new Set(), textures = new Set()
  const portalMaterials = new Set()
  const portalState = { stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilWriteMask: 0 }
  const mesh = (parent, geometry, material, position = [0, 0, 0], shadow = true) => {
    shapes.add(geometry)
    const m = new THREE.Mesh(geometry, material)
    m.position.set(...position)
    m.castShadow = shadow
    m.receiveShadow = true
    parent.add(m)
    return m
  }
  const mat = (options) => {
    const m = new THREE.MeshStandardMaterial({ ...portalState, ...options })
    surfaces.add(m)
    if (m.stencilWrite) portalMaterials.add(m)
    return m
  }
  const box = (parent, dimensions, material, position, shadow = true) => mesh(parent, new THREE.BoxGeometry(...dimensions), material, position, shadow)
  const basic = (color) => {
    const m = new THREE.MeshBasicMaterial({ ...portalState, color, toneMapped: false })
    surfaces.add(m)
    portalMaterials.add(m)
    return m
  }

  // Before crossing the threshold, the archive may only be seen through the
  // doorway. A stencil aperture also hides walls beyond the photo's silhouette.
  const portalMaterial = new THREE.MeshBasicMaterial({
    colorWrite: false, depthWrite: false, depthTest: false,
    stencilWrite: true, stencilRef: 1, stencilFunc: THREE.AlwaysStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  })
  surfaces.add(portalMaterial)
  const portalOutline = new THREE.Shape()
  doorway.localCorners.forEach((p, i) => i ? portalOutline.lineTo(p.x, p.y) : portalOutline.moveTo(p.x, p.y))
  portalOutline.closePath()
  const portal = mesh(root, new THREE.ShapeGeometry(portalOutline), portalMaterial, [0, 0, 0], false)
  portal.name = 'house-door-portal'
  portal.renderOrder = -30
  let portalActive = true

  // Quiet plaster grain, lit by the room rather than a painted radial gradient.
  const grainCanvas = document.createElement('canvas')
  grainCanvas.width = grainCanvas.height = 256
  const context = grainCanvas.getContext('2d')
  const image = context.createImageData(256, 256)
  let seed = 371
  for (let i = 0; i < image.data.length; i += 4) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    const n = (seed >>> 24) * .065
    image.data[i] = 224 + n
    image.data[i + 1] = 217 + n
    image.data[i + 2] = 199 + n
    image.data[i + 3] = 255
  }
  context.putImageData(image, 0, 0)
  const plasterMap = new THREE.CanvasTexture(grainCanvas)
  plasterMap.colorSpace = THREE.SRGBColorSpace
  plasterMap.wrapS = plasterMap.wrapT = THREE.RepeatWrapping
  plasterMap.repeat.set(3, 4)
  textures.add(plasterMap)
  const woodMap = loadTexture('/images/installation/walnut-albedo.webp')
  woodMap.colorSpace = THREE.SRGBColorSpace
  woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping
  woodMap.repeat.set(2, 8)
  const plaster = mat({ map: plasterMap, roughness: .98, bumpMap: plasterMap, bumpScale: .022 })
  const stone = mat({ color: '#bbb09a', roughness: .91, bumpMap: plasterMap, bumpScale: .025 })
  const wood = mat({ color: '#a49881', map: woodMap, roughness: .76, bumpMap: woodMap, bumpScale: .015 })
  const darkWood = mat({ color: '#30291f', roughness: .64 })
  const brass = mat({ color: '#ae8d50', metalness: .68, roughness: .4 })
  const card = mat({ color: '#eee5cf', roughness: 1 })
  const dark = mat({ color: '#151712', roughness: .92 })

  const ground = box(root, [width, .12, depth], wood, [0, -.065, -depth / 2], false)
  const ceiling = box(root, [width, .1, depth], plaster, [0, height, -depth / 2], false)
  const floorSeams = new THREE.Group()
  root.add(floorSeams)
  for (let i = -2; i <= 2; i++) box(floorSeams, [.007, .002, depth], darkWood, [i * .96, .001, -depth / 2], false)
  const walls = []
  const pendulums = []
  const wallPositions = [-3.4, -7.3, -11.15]
  const chosen = [3, 14, 23, 9, 19, 25].map(i => pieces[i % pieces.length])
  const framedSources = chosen.slice()
  framedSources[0] = chosen[2]
  framedSources[3] = chosen[5]
  // Client photographs occupy the last frame on each wall; the remaining
  // archive pieces and the frame motion keep their existing behaviour.
  for (const [slot, number, w, h] of [[2, 1, 1600, 900], [5, 2, 900, 1600]]) {
    const map = loadTexture(`/images/client-2026-11/foto-${number}.webp`)
    map.name = `house-client-photo-${number}`
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = pieces[0]?.mat.map.anisotropy || 1
    textures.add(map)
    framedSources[slot] = { d: { w, h, tipo: 'fotografia' }, mat: { map }, fitFrame: true }
  }
  function framedMemory(parent, source, x, y, z, rotation) {
    const ratio = source.d.w / source.d.h
    const imageHeight = Math.min(1.46, 1.06 / ratio)
    const w = source.fitFrame ? imageHeight * ratio + .16 : source.d.tipo === 'mao' ? 1.02 : 1.22
    const h = source.fitFrame ? imageHeight + .16 : 1.62
    const pivot = new THREE.Group()
    pivot.position.set(x, y + h / 2 + .065, z)
    pivot.rotation.y = rotation
    parent.add(pivot)
    const frame = new THREE.Group()
    frame.position.y = -h / 2 - .065
    pivot.add(frame)
    pendulums.push({ pivot, angle: 0, velocity: 0, limit: .075, gain: .62, direction: rotation > 0 ? 1 : -1, phase: pendulums.length * 1.7, free: false })
    box(frame, [w + .13, h + .13, .075], darkWood, [0, 0, 0], false)
    box(frame, [w, h, .025], card, [0, 0, .055], false)
    const scale = Math.min((w - (source.fitFrame ? .16 : .21)) / (source.d.w / unit), (h - (source.fitFrame ? .16 : .24)) / (source.d.h / unit))
    const material = mat({ map: source.mat.map, transparent: true, alphaTest: .05, roughness: .93, side: THREE.DoubleSide })
    mesh(frame, new THREE.PlaneGeometry(source.d.w / unit * scale, source.d.h / unit * scale), material, [0, 0, .075], false)
    // A small brass archive marker belongs to the object, not the page UI.
    box(frame, [.13, .024, .018], brass, [0, -h / 2 - .11, .005], false)
    return frame
  }
  for (const side of [-1, 1]) {
    const wall = new THREE.Group()
    wall.position.x = side * width / 2
    root.add(wall)
    walls.push({ group: wall, side })
    box(wall, [.15, height, depth], plaster, [side * .075, height / 2, -depth / 2], false)
    box(wall, [.055, .14, depth], darkWood, [-side * .04, .07, -depth / 2], false)
    for (let i = 0; i < 3; i++) {
      const z = wallPositions[i]
      framedMemory(wall, framedSources[i + (side > 0 ? 3 : 0)], -side * .07, 1.9, z, -side * Math.PI / 2)
      const light = new THREE.SpotLight('#ffe6b7', 11, 7, .55, .66, 2)
      light.position.set(-side * .95, 3.35, z + .4)
      light.target.position.set(-side * .08, 1.85, z)
      wall.add(light, light.target)
      box(wall, [.1, .025, .58], darkWood, [-side * .45, height - .09, z + .15], false)
    }
  }
  const beams = []
  for (const z of [-2, -6, -10]) {
    beams.push(box(root, [width, .14, .16], darkWood, [0, height - .08, z], false))
    const strip = box(root, [1.4, .025, .045], basic('#fff0d4'), [0, height - .18, z], false)
    strip.renderOrder = 1
  }
  const hemisphere = new THREE.HemisphereLight('#fff3db', '#4b3c2a', .9)
  root.add(hemisphere)
  const daylight = new THREE.DirectionalLight('#fff1d5', 1.1)
  daylight.position.set(-2, 5, -3)
  daylight.target.position.set(0, .5, -7)
  daylight.castShadow = true
  daylight.shadow.mapSize.set(1024, 1024)
  Object.assign(daylight.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: .2, far: 22 })
  daylight.shadow.camera.updateProjectionMatrix()
  daylight.shadow.bias = -.0003
  daylight.shadow.normalBias = .025
  root.add(daylight, daylight.target)
  const thresholdLight = new THREE.PointLight('#ffdba2', 4, 5, 2)
  thresholdLight.position.set(0, 2.35, -.5)
  root.add(thresholdLight)

  // The photographic door has a fixed architectural opening in world space.
  facade.onBeforeCompile = shader => {
    shader.uniforms.houseEdges = { value: doorway.edges }
    shader.vertexShader = 'varying vec2 houseWorldXY;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nhouseWorldXY = (modelMatrix * vec4(transformed, 1.0)).xy;')
    shader.fragmentShader = 'varying vec2 houseWorldXY;\nuniform vec3 houseEdges[4];\n' + shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nbool houseInside = true;\nfor (int i = 0; i < 4; i++) { houseInside = houseInside && dot(houseEdges[i], vec3(houseWorldXY, 1.0)) > 0.0; }\nif (houseInside) discard;')
  }
  facade.customProgramCacheKey = () => 'house-calibrated-door-v1'
  const entrance = new THREE.Group()
  entrance.name = 'house-entrance'
  entrance.matrixAutoUpdate = false
  entrance.matrix.copy(doorway.matrix)
  root.add(entrance)
  const sideW = (width - doorW) / 2
  const frontPanels = [-1, 1].map(side => box(entrance, [sideW, height, .2], plaster, [side * (doorW / 2 + sideW / 2), height / 2, -.18], false))
  box(entrance, [doorW, height - doorH, .2], plaster, [0, doorH + (height - doorH) / 2, -.18], false)
  const entryModel = buildHouseDoorway({ parent: entrance, profile: doorway, mesh, box, mat, woodMap, plasterMap, textures })
  const doors = entryModel.doors

  // A table and suspended prints create near/middle/far parallax in the archive.
  const table = new THREE.Group()
  table.position.set(.8, 0, -6.25)
  root.add(table)
  box(table, [1.4, .09, .9], wood, [0, .82, 0])
  for (const x of [-.57, .57]) for (const z of [-.31, .31]) box(table, [.07, .79, .07], darkWood, [x, .39, z])
  const photo = loadTexture('/images/trail/photo-2.webp')
  photo.colorSpace = THREE.SRGBColorSpace
  const tabletopPhoto = mat({ map: photo, roughness: .86 })
  box(table, [.61, .012, .43], card, [0, .874, 0])
  const print = mesh(table, new THREE.PlaneGeometry(.56, .38), tabletopPhoto, [0, .882, 0], false)
  print.rotation.x = -Math.PI / 2
  print.rotation.z = .13
  for (const [i, x, z] of [[0, -1.05, -4.8], [1, 1.2, -9.3]]) {
    const pivot = new THREE.Group()
    pivot.position.set(x, 2.56, z)
    pivot.rotation.y = i ? -.23 : .3
    root.add(pivot)
    const source = chosen[i + 2]
    const w = .48, h = .7
    box(pivot, [w + .04, h + .04, .012], card, [0, -h / 2, 0], false)
    const material = mat({ map: source.mat.map, transparent: true, alphaTest: .04, side: THREE.DoubleSide, roughness: .95 })
    const scale = Math.min((w - .06) / (source.d.w / unit), (h - .08) / (source.d.h / unit))
    mesh(pivot, new THREE.PlaneGeometry(source.d.w / unit * scale, source.d.h / unit * scale), material, [0, -h / 2, .009], false)
    mesh(root, new THREE.CylinderGeometry(.003, .003, height - 2.56, 6), brass, [x, (height + 2.56) / 2, z], false)
    pendulums.push({ pivot, angle: 0, velocity: 0, limit: .25, gain: 1.5, direction: i ? -1 : 1, phase: i * 1.7, free: true })
  }

  // The exit is an actual opening at the far end. Its light fills the lens as
  // the camera crosses, matching the background of the following chapter.
  const exitW = 1.58, exitH = 2.85
  const exit = new THREE.Group()
  exit.position.z = -depth
  root.add(exit)
  const backPanels = [-1, 1].map(side => box(exit, [(width - exitW) / 2, height, .22], plaster, [side * (width + exitW) / 4, height / 2, 0], false))
  box(exit, [exitW, height - exitH, .22], plaster, [0, exitH + (height - exitH) / 2, 0], false)
  for (const x of [-exitW / 2 - .07, exitW / 2 + .07]) box(exit, [.14, exitH, .5], stone, [x, exitH / 2, -.04])
  box(exit, [exitW + .28, .15, .5], stone, [0, exitH + .05, -.04])
  const exitPlaster = mat({ color: '#f5f0e4', roughness: .96 })
  for (const x of [-exitW / 2 - .04, exitW / 2 + .04]) box(exit, [.08, exitH, 2.1], exitPlaster, [x, exitH / 2, -1.05], false)
  box(exit, [exitW, .08, 2.1], exitPlaster, [0, exitH + .04, -1.05], false)
  box(exit, [exitW, .06, 2.1], stone, [0, -.03, -1.05], false)
  const exitMaterial = basic('#ffffff')
  mesh(root, new THREE.PlaneGeometry(30, 20), exitMaterial, [0, 3, -depth - 2.2], false)
  const exitLight = new THREE.PointLight('#fff1d2', 12, 10, 2)
  exitLight.position.set(0, 2.2, -depth + .1)
  root.add(exitLight)
  const outsideLight = new THREE.PointLight('#ffffff', 8, 5, 2)
  outsideLight.position.set(0, 2, -depth - 1.7)
  root.add(outsideLight)
  let lastDoorAngle = -1, currentWidth = width
  return {
    root, floorY, eyeY: floorY + 1.55, depth,
    setPaper(color) { exitMaterial.color.copy(color) },
    resize(aspect) {
      currentWidth = aspect < .8 ? 3.65 : width
      const scale = currentWidth / width
      walls.forEach(({ group, side }) => { group.position.x = side * currentWidth / 2 })
      ground.scale.x = ceiling.scale.x = floorSeams.scale.x = scale
      beams.forEach(beam => { beam.scale.x = scale })
      table.position.x = aspect < .8 ? .54 : .8
      frontPanels.forEach((m, i) => {
        const w = (currentWidth - doorW) / 2
        m.scale.x = w / sideW
        m.position.x = (i ? 1 : -1) * (doorW / 2 + w / 2)
      })
      backPanels.forEach((m, i) => {
        m.scale.x = (currentWidth - exitW) / (width - exitW)
        m.position.x = (i ? 1 : -1) * (currentWidth + exitW) / 4
      })
    },
    inspect: () => ({ portalActive, doorway: { center: [door.x, floorY + doorH / 2, 0], width: doorW, height: doorH, corners: doorway.localCorners.map(p => [door.x + p.x, floorY + p.y, 0]), modelFitResidualPx: doorway.modelFitResidualPx, leafThickness: entryModel.leafThickness, hingeDepth: entryModel.hingeDepth }, swings: pendulums.map(p => ({ angle: p.angle, velocity: p.velocity, free: p.free })) }),
    update(open, time, motion, pointer, dt, camera) {
      // Switch only after the aperture fills the view, before its near plane
      // can be clipped. The same rule applies when scrolling backwards.
      const outside = camera.position.z > .18
      if (outside !== portalActive) {
        portalActive = outside
        portal.visible = outside
        portalMaterials.forEach(m => { m.stencilFunc = outside ? THREE.EqualStencilFunc : THREE.AlwaysStencilFunc })
      }
      const angle = open * 1.48
      doors.forEach(({ pivot, side }) => { pivot.rotation.y = -side * angle })
      const impulse = Math.max(-1.4, Math.min(1.4, pointer.dx + pointer.dy * .35)) * motion
      const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps
      pendulums.forEach(p => {
        if (!motion) {
          p.angle = p.velocity = p.pivot.rotation.z = 0
          return
        }
        p.velocity += impulse * p.gain * p.direction
        const rest = motion * (Math.sin(time * .0005 + p.phase) * (p.free ? .007 : .002) + pointer.sx * (p.free ? .025 : .008))
        for (let i = 0; i < steps; i++) {
          p.velocity += ((rest - p.angle) * 18 - p.velocity * 3.4) * step
          p.angle += p.velocity * step
          if (Math.abs(p.angle) > p.limit) {
            p.angle = Math.sign(p.angle) * p.limit
            p.velocity *= .2
          }
        }
        p.pivot.rotation.z = p.angle
      })
      const changed = Math.abs(angle - lastDoorAngle) > .001
      lastDoorAngle = angle
      return changed
    },
    dispose() {
      shapes.forEach(g => g.dispose())
      surfaces.forEach(m => m.dispose())
      textures.forEach(t => t.dispose())
      root.traverse(o => { if (o.isLight) o.dispose?.() })
      root.removeFromParent()
    },
  }
}
