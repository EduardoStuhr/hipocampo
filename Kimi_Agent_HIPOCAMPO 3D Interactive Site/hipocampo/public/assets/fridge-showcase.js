import * as THREE from './vendor/three.module.min.js'

// A small, isolated model. Render only on resize, visibility or door movement.
export function mountFridgeShowcase(figure) {
  const photo = figure.querySelector('img')
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'fridge-showcase-toggle'
  button.setAttribute('aria-label', 'Abrir geladeira de memórias')
  button.setAttribute('aria-description', 'Um arquivo de lembranças: fotografias do acervo, cartas, uma chave e uma fita cassete.')
  button.setAttribute('aria-pressed', 'false')
  figure.append(button)
  let renderer, scene, camera, model, resize, observer, texture, environment, frame = 0
  let aspect = 1, projectedBounds = null
  const memoryItems = []
  let open = false, visible = false, angle = 0, target = 0, previous = 0, disposed = false
  const reduced = matchMedia('(prefers-reduced-motion: reduce)')
  const doors = [], geometries = new Set(), materials = new Set(), maps = new Set()
  const paint = () => {
    if (disposed || !renderer || !visible || document.hidden) return
    const now = performance.now(), dt = previous ? Math.min((now - previous) / 1000, .12) : 1 / 60
    previous = now
    angle = reduced.matches ? target : angle + (target - angle) * (1 - Math.exp(-7 * dt))
    if (Math.abs(target - angle) < .002) angle = target
    doors.forEach(door => { door.rotation.y = angle })
    // Fit the complete open doors as well as the closed cabinet, without clipping.
    camera.left = -2 * aspect; camera.right = 2 * aspect; camera.top = 2; camera.bottom = -2
    camera.updateProjectionMatrix(); camera.updateMatrixWorld(); model.updateMatrixWorld(true)
    const point = new THREE.Vector3()
    let min = Infinity, max = -Infinity
    model.traverse(mesh => {
      if (!mesh.isMesh) return
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const bounds = mesh.geometry.boundingBox
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        point.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera)
        min = Math.min(min, point.x); max = Math.max(max, point.x)
      }
    })
    const center = (min + max) * aspect
    const scale = Math.max(1, (max - min) / 1.8)
    camera.left = center - 2 * aspect * scale; camera.right = center + 2 * aspect * scale
    camera.top = 2 * scale; camera.bottom = -2 * scale
    camera.updateProjectionMatrix()
    projectedBounds = { min: (min - (min + max) / 2) / scale, max: (max - (min + max) / 2) / scale }
    renderer.render(scene, camera)
    frame = angle !== target ? requestAnimationFrame(paint) : 0
    if (!frame) previous = 0
  }
  const request = () => { if (renderer && doors.length && !frame && visible && !document.hidden && !disposed) frame = requestAnimationFrame(() => { frame = 0; paint() }) }
  const material = options => { const m = new THREE.MeshStandardMaterial(options); materials.add(m); return m }
  // A fine, deterministic enamel finish, not an extra photographic replacement.
  const grainData = new Uint8Array(96 * 96 * 4)
  let seed = 9431
  for (let i = 0; i < grainData.length; i += 4) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const v = 220 + (seed % 30)
    grainData[i] = grainData[i + 1] = grainData[i + 2] = v; grainData[i + 3] = 255
  }
  const grain = new THREE.DataTexture(grainData, 96, 96, THREE.RGBAFormat)
  grain.wrapS = grain.wrapT = THREE.RepeatWrapping; grain.needsUpdate = true; maps.add(grain)
  const green = material({ color: '#89934a', roughness: .26, metalness: .17, bumpMap: grain, bumpScale: .003, envMapIntensity: .7 })
  const cream = material({ color: '#e5dfc8', roughness: .43, bumpMap: grain, bumpScale: .002, envMapIntensity: .35 })
  const chrome = material({ color: '#d4d4ca', roughness: .17, metalness: .92, envMapIntensity: 1.2 })
  const dark = material({ color: '#383b2d', roughness: .82 })
  const glass = material({ color: '#c8d4cc', roughness: .12, metalness: .2, transparent: true, opacity: .28, depthWrite: false })
  const track = geometry => { geometries.add(geometry); return geometry }
  const mesh = (parent, geometry, mat, x = 0, y = 0, z = 0) => {
    const item = new THREE.Mesh(track(geometry), mat)
    item.position.set(x, y, z); item.castShadow = mat !== glass; item.receiveShadow = true
    parent.add(item); return item
  }
  const box = (parent, w, h, d, mat, x = 0, y = 0, z = 0) => mesh(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z)
  const outline = (w, h, radius) => {
    const r = Math.min(radius, w / 2, h / 2), x = -w / 2, y = -h / 2
    const shape = new THREE.Shape()
    shape.moveTo(x + r, y); shape.lineTo(x + w - r, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + r); shape.lineTo(x + w, y + h - r)
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h); shape.lineTo(x + r, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - r); shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)
    return shape
  }
  const rounded = (parent, w, h, d, radius, mat, x = 0, y = 0, z = 0) => {
    const bevel = Math.min(.025, d / 3, radius / 2)
    const g = new THREE.ExtrudeGeometry(outline(w - bevel * 2, h - bevel * 2, Math.max(.005, radius - bevel)), {
      depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 5, steps: 1,
    })
    g.translate(0, 0, -d / 2 + bevel)
    return mesh(parent, g, mat, x, y, z)
  }
  const rim = (parent, w, h, d, radius, wall, mat, x = 0, y = 0, z = 0) => {
    const shape = outline(w, h, radius)
    shape.holes.push(new THREE.Path(outline(w - wall * 2, h - wall * 2, Math.max(.025, radius - wall)).getPoints(5).reverse()))
    const g = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 5, steps: 1 })
    g.translate(0, 0, -d / 2)
    return mesh(parent, g, mat, x, y, z)
  }
  const rod = (parent, points, radius, mat) => mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 12, radius, 6, false), mat)
  const facade = (parent, w, h, map, x, z) => {
    const g = new THREE.ShapeGeometry(outline(w, h, .07), 8)
    const positions = g.attributes.position, uv = g.attributes.uv
    for (let i = 0; i < positions.count; i++) uv.setXY(i, (positions.getX(i) + w / 2) / w, (positions.getY(i) + h / 2) / h)
    // Preserve the photographed patina and reflections on the front doors.
    const face = new THREE.MeshBasicMaterial({ map, toneMapped: false })
    materials.add(face); return mesh(parent, g, face, x, 0, z)
  }
  const makeEnvironment = () => {
    const studio = new THREE.Scene(); studio.background = new THREE.Color('#a5ada4')
    const white = new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 4, 3.8), side: THREE.DoubleSide })
    materials.add(white)
    for (const [x, y, z, w, h] of [[-4, 2, 3, 3, 6], [3, 3, 1, 2, 5], [0, 5, -2, 5, 3]]) {
      const panel = mesh(studio, new THREE.PlaneGeometry(w, h), white, x, y, z); panel.lookAt(0, 0, 0)
    }
    const pmrem = new THREE.PMREMGenerator(renderer)
    environment = pmrem.fromScene(studio, .06)
    scene.environment = environment.texture; pmrem.dispose()
  }
  const addMemoryArchive = async body => {
    // Reuse the actual archive images already present on the site.
    const archiveMaps = await Promise.all(['/images/trail/photo-1.webp', '/images/trail/photo-2.webp', '/images/sobre/gif-3.webp'].map(async url => {
      try {
        const map = await new THREE.TextureLoader().loadAsync(url)
        if (disposed) { map.dispose(); return null }
        map.colorSpace = THREE.SRGBColorSpace; maps.add(map); return map
      } catch { return null }
    }))
    if (disposed) return
    const paper = material({ color: '#e9ddc2', roughness: .88, bumpMap: grain, bumpScale: .001 })
    const cardBack = material({ color: '#ad9370', roughness: .9 })
    const brass = material({ color: '#b89c61', metalness: .76, roughness: .3 })
    const tapeCase = material({ color: '#3a3027', roughness: .38, metalness: .06 })
    const twine = material({ color: '#9a7c50', roughness: .96 })
    const card = (parent, map, w, h, x, y, z, tilt = 0, reverse = false) => {
      const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.z = tilt
      if (reverse) group.rotation.y = Math.PI
      parent.add(group)
      rounded(group, w, h, .016, .012, paper)
      box(group, w - .025, h - .025, .005, cardBack, 0, 0, -.01)
      if (map) {
        const print = material({ map, roughness: .84, metalness: 0, envMapIntensity: .2 })
        mesh(group, new THREE.PlaneGeometry(w * .86, h * .76), print, 0, h * .035, .009)
      }
      return group
    }
    // Photographs stand on the upper rack like a small album of suspended time.
    card(body, archiveMaps[0], .66, .47, -.20, 1.145, .18, -.08)
    card(body, archiveMaps[1], .35, .33, .36, 1.10, .10, .1)
    card(body, archiveMaps[1], .43, .38, -.30, -.16, .17, -.12)
    memoryItems.push('fotografias do acervo')
    // A tied bundle of letters, on the first shelf.
    const letters = new THREE.Group(); letters.position.set(-.22, .18, .04); letters.rotation.y = -.12; body.add(letters)
    for (let i = 0; i < 4; i++) {
      const sheet = rounded(letters, .62, .018, .39, .007, paper, (i % 2) * .013, i * .019, 0)
      sheet.rotation.y = i % 2 ? .035 : -.025
    }
    if (archiveMaps[2]) {
      const letter = material({ map: archiveMaps[2], roughness: .94 })
      const top = mesh(letters, new THREE.PlaneGeometry(.56, .34), letter, 0, .078, 0); top.rotation.x = -Math.PI / 2
    }
    rod(letters, [[0, -.005, -.205], [0, .09, -.205], [0, .09, .205], [0, -.005, .205], [0, -.005, -.205]], .007, twine)
    memoryItems.push('cartas guardadas')
    // The key hints at the house and the cassette at a remembered voice.
    const key = new THREE.Group(); key.position.set(.30, .19, .12); body.add(key)
    const ring = mesh(key, new THREE.TorusGeometry(.05, .011, 6, 16), brass); ring.rotation.x = Math.PI / 2
    box(key, .19, .016, .017, brass, .13)
    for (const x of [.18, .215]) box(key, .025, .016, .04, brass, x, 0, .018)
    memoryItems.push('chave da casa')
    const jar = new THREE.Group(); jar.position.set(.36, -.19, -.015); body.add(jar)
    mesh(jar, new THREE.CylinderGeometry(.125, .13, .31, 20, 1, true), glass)
    mesh(jar, new THREE.CylinderGeometry(.14, .14, .026, 20), chrome, 0, .17)
    for (const [x, z, a] of [[-.037, -.025, -.15], [.04, .035, .14]]) {
      const roll = mesh(jar, new THREE.CylinderGeometry(.024, .024, .23, 10), paper, x, 0, z); roll.rotation.z = a
    }
    memoryItems.push('frasco de lembranças')
    const cassette = new THREE.Group(); cassette.position.set(.06, -.69, .18); cassette.rotation.z = .05; body.add(cassette)
    rounded(cassette, .65, .33, .07, .025, tapeCase)
    rounded(cassette, .55, .22, .006, .012, paper, 0, .015, .039)
    for (const x of [-.15, .15]) {
      mesh(cassette, new THREE.TorusGeometry(.052, .012, 6, 16), dark, x, .03, .047)
      mesh(cassette, new THREE.CircleGeometry(.022, 12), chrome, x, .03, .048)
    }
    box(cassette, .45, .025, .006, tapeCase, 0, -.07, .047)
    memoryItems.push('fita cassete')
    // The original handwriting also appears among the papers in the door rack.
    return { card, map: archiveMaps[2] }
  }
  const setSize = () => {
    if (!renderer) return
    const width = button.clientWidth, height = Math.max(1, button.clientHeight)
    renderer.setSize(width, height, false)
    aspect = width / height
    camera.left = -2 * aspect; camera.right = 2 * aspect
    camera.top = 2; camera.bottom = -2
    camera.updateProjectionMatrix()
    request()
  }
  const fallback = () => {
    figure.classList.remove('is-3d-ready')
    button.disabled = true
    button.setAttribute('aria-label', 'Geladeira antiga verde')
  }
  const build = async () => {
    if (renderer || disposed) return
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.25))
      renderer.outputColorSpace = THREE.SRGBColorSpace
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
      renderer.setClearColor(0xffffff, 0)
      renderer.domElement.className = 'fridge-showcase-canvas'
      renderer.domElement.setAttribute('aria-hidden', 'true')
      button.prepend(renderer.domElement)
      scene = new THREE.Scene()
      camera = new THREE.OrthographicCamera(-1.5, 1.5, 2, -2, .1, 30)
      camera.position.set(2.5, 1.1, 7)
      camera.lookAt(0, 0, .35)
      makeEnvironment()
      scene.add(new THREE.HemisphereLight(0xe8efff, 0x716b52, .75))
      const light = new THREE.DirectionalLight(0xfff1d9, 3)
      light.position.set(-3, 5, 6); light.castShadow = true
      light.shadow.mapSize.set(512, 512)
      Object.assign(light.shadow.camera, { left: -3, right: 3, top: 4, bottom: -3, near: .5, far: 15 })
      light.shadow.normalBias = .025; light.shadow.bias = -.00015
      scene.add(light)
      const fill = new THREE.DirectionalLight(0xc9dcff, .5); fill.position.set(3, 1, 1); scene.add(fill)
      const body = new THREE.Group(); model = body; scene.add(body)
      // Rounded cabinet and continuous inner liner replace the flat box walls.
      rim(body, 1.52, 3.02, .94, .15, .095, green)
      rim(body, 1.32, 2.82, .79, .10, .035, cream, 0, 0, .015)
      rounded(body, 1.33, 2.83, .10, .11, green, 0, 0, -.45)
      // Baked corner shading combines with real light/shadows inside the cavity.
      const aoData = new Uint8Array(128 * 256 * 4)
      for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
        const edge = Math.min(x / 128, 1 - x / 128, y / 256, 1 - y / 256)
        const v = Math.round(175 + 70 * Math.min(1, edge / .13)), i = (y * 128 + x) * 4
        aoData[i] = v; aoData[i + 1] = v - 3; aoData[i + 2] = v - 12; aoData[i + 3] = 255
      }
      const backMap = new THREE.DataTexture(aoData, 128, 256, THREE.RGBAFormat)
      backMap.colorSpace = THREE.SRGBColorSpace; backMap.needsUpdate = true; maps.add(backMap)
      const back = material({ map: backMap, roughness: .58 })
      mesh(body, new THREE.PlaneGeometry(1.25, 2.73), back, 0, 0, -.385)
      rounded(body, 1.30, .075, .77, .025, cream, 0, .43, .015)
      // Frost compartment: wire rack and its mounting points.
      for (let x = -.55; x <= .56; x += .11) rod(body, [[x, .89, -.3], [x, .89, .34]], .009, chrome)
      for (const z of [-.29, .33]) box(body, 1.22, .018, .018, chrome, 0, .89, z)
      // Glass shelves with polished front edges and individual supports.
      for (const y of [-.88, -.37, .14]) {
        rounded(body, 1.25, .022, .70, .006, glass, 0, y, .015)
        rounded(body, 1.25, .025, .025, .008, chrome, 0, y, .365)
        for (const x of [-.61, .61]) rounded(body, .045, .09, .25, .012, cream, x, y - .04, -.03)
      }
      // Separate translucent crisper drawers, with lips and pull handles.
      for (const x of [-.315, .315]) {
        rounded(body, .59, .34, .61, .04, glass, x, -1.23, .02)
        rounded(body, .59, .045, .045, .013, cream, x, -1.06, .34)
        rounded(body, .21, .025, .025, .008, chrome, x, -1.16, .35)
      }
      const knob = mesh(body, new THREE.CylinderGeometry(.065, .065, .04, 16), cream, .60, .28, -.03)
      knob.rotation.z = Math.PI / 2
      box(body, .008, .012, .06, dark, .626, .30, -.03)
      const bulb = material({ color: '#fff1c5', emissive: '#ffe6a5', emissiveIntensity: .8, roughness: .35 })
      rounded(body, .11, .075, .09, .025, bulb, .57, .34, .14)
      const insideLight = new THREE.PointLight(0xffedc9, .18, 1.6, 2)
      insideLight.position.set(.48, .28, .12); body.add(insideLight)
      for (const x of [-.57, .57]) rounded(body, .10, .13, .38, .02, dark, x, -1.55, -.1)
      for (const y of [-1.31, .53, 1.32]) mesh(body, new THREE.CylinderGeometry(.028, .028, .14, 12), chrome, -.76, y, .43)
      // Soft contact shadow fades to transparency instead of a clipped floor edge.
      const shadowData = new Uint8Array(64 * 64 * 4)
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5), i = (y * 64 + x) * 4
        shadowData[i] = shadowData[i + 1] = shadowData[i + 2] = 255
        shadowData[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - radius), 1.5))
      }
      const shadowMap = new THREE.DataTexture(shadowData, 64, 64, THREE.RGBAFormat)
      shadowMap.magFilter = THREE.LinearFilter; shadowMap.needsUpdate = true; maps.add(shadowMap)
      const shadowMaterial = new THREE.MeshBasicMaterial({ map: shadowMap, color: '#48402d', transparent: true, opacity: .3, depthWrite: false })
      materials.add(shadowMaterial)
      const floor = mesh(scene, new THREE.PlaneGeometry(2.6, 1.8), shadowMaterial, 0, -1.62, .06)
      floor.rotation.x = -Math.PI / 2; floor.castShadow = false
      texture = await new THREE.TextureLoader().loadAsync(photo.src)
      if (disposed) { texture.dispose(); return }
      texture.colorSpace = THREE.SRGBColorSpace
      maps.add(texture)
      const memoryArchive = await addMemoryArchive(body)
      if (disposed) return
      for (const [y, h, imageTop, imageHeight] of [[.97, 1, 20, 79], [-.51, 1.9, 99, 143]]) {
        const map = texture.clone()
        map.repeat.set(108 / 146, imageHeight / 248)
        map.offset.set(13 / 146, (248 - imageTop - imageHeight) / 248)
        map.needsUpdate = true; maps.add(map)
        const hinge = new THREE.Group(); hinge.position.set(-.72, y, .49)
        body.add(hinge); doors.push(hinge)
        rounded(hinge, 1.44, h, .17, .10, green, .72)
        facade(hinge, 1.405, h - .025, map, .72, .101)
        rim(hinge, 1.37, h - .075, .024, .075, .022, dark, .72, 0, -.094)
        rim(hinge, 1.31, h - .13, .018, .065, .014, cream, .72, 0, -.111)
        rounded(hinge, 1.26, h - .17, .08, .075, cream, .72, 0, -.13)
        // Rounded door pockets: inner floor, sides and a retaining rail.
        for (const shelfY of h > 1.5 ? [-.66, -.10, .46] : [-.32]) {
          rounded(hinge, 1.1, .035, .21, .012, cream, .72, shelfY, -.24)
          rounded(hinge, 1.1, .12, .035, .014, cream, .72, shelfY + .055, -.34)
          for (const x of [.18, 1.26]) rounded(hinge, .035, .13, .21, .012, cream, x, shelfY + .05, -.24)
          rounded(hinge, 1.09, .018, .025, .006, chrome, .72, shelfY + .12, -.34)
        }
        if (h > 1.5) memoryArchive.card(hinge, memoryArchive.map, .49, .30, .72, .73, -.20, .05, true)
        const handleY = h > 1.5 ? .74 : -.35
        rod(hinge, [[.16, handleY, .11], [.21, handleY + .018, .19], [.57, handleY + .018, .19], [.62, handleY, .11]], .025, chrome)
      }
      renderer.domElement.addEventListener('webglcontextlost', lost)
      resize = new ResizeObserver(setSize); resize.observe(button)
      figure.classList.add('is-3d-ready')
      setSize(); request()
    } catch { fallback() }
  }
  const click = () => {
    if (button.disabled) return
    open = !open; target = open ? -1.8 : 0
    button.setAttribute('aria-pressed', String(open))
    button.setAttribute('aria-label', open ? 'Fechar geladeira de memórias' : 'Abrir geladeira de memórias')
    figure.dataset.fridgeOpen = String(open)
    request()
  }
  const lost = event => { event.preventDefault(); cancelAnimationFrame(frame); frame = 0; fallback() }
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; previous = 0 } else request() }
  figure.fridgeShowcase = { getDiagnostics: () => ({ open, angle, target, visible, frames: renderer?.info.render.frame || 0, triangles: renderer?.info.render.triangles || 0, ready: figure.classList.contains('is-3d-ready'), projectedBounds, memoryItems: [...memoryItems] }) }
  const cleanup = () => {
    if (disposed) return
    disposed = true; delete figure.fridgeShowcase; cancelAnimationFrame(frame)
    observer?.disconnect(); resize?.disconnect()
    document.removeEventListener('visibilitychange', visibility)
    button.removeEventListener('click', click)
    renderer?.domElement.removeEventListener('webglcontextlost', lost)
    maps.forEach(map => map.dispose()); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose())
    scene?.traverse(item => { if (item.isLight && item.shadow) item.shadow.dispose() })
    environment?.dispose(); renderer?.dispose()
    window.removeEventListener('pagehide', cleanup)
  }
  observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting)
    if (visible) { build(); request() } else { cancelAnimationFrame(frame); frame = 0; previous = 0 }
  }, { rootMargin: '100px 0px' })
  observer.observe(figure)
  button.addEventListener('click', click)
  document.addEventListener('visibilitychange', visibility)
  window.addEventListener('pagehide', cleanup, { once: true })
  return cleanup
}
