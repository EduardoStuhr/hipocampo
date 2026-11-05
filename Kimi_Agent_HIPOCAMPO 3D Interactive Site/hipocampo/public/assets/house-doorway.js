import * as THREE from './vendor/three.module.min.js'

// Inner stone opening measured on peca-16-hd.webp (1712 x 1408).
// Clockwise from the top left. Keep the photographed stone surround intact.
const PHOTO_SIZE = [1712, 1408]
const PHOTO_CORNERS = [[462, 1038], [571, 1045], [553, 1345], [447, 1343]]

export function fitHouseDoorway(houseData, unit, toWorld) {
  const corners = PHOTO_CORNERS.map(([x, y]) => toWorld(
    houseData.x + x / PHOTO_SIZE[0] * houseData.w,
    houseData.y + y / PHOTO_SIZE[1] * houseData.h,
  ))
  const center = corners.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(.25)
  const bottom = corners[2].clone().add(corners[3]).multiplyScalar(.5)
  const top = corners[0].clone().add(corners[1]).multiplyScalar(.5)
  const width = ((corners[1].x - corners[0].x) + (corners[2].x - corners[3].x)) / 2
  const height = top.y - bottom.y
  const horizontal = corners[1].clone().sub(corners[0]).add(corners[2].clone().sub(corners[3])).multiplyScalar(.5 / width)
  const vertical = top.clone().sub(bottom).multiplyScalar(1 / height)
  const matrix = new THREE.Matrix4().set(
    horizontal.x, vertical.x, 0, bottom.x - center.x,
    horizontal.y, vertical.y, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  )
  const localCorners = corners.map(p => new THREE.Vector3(p.x - center.x, p.y - bottom.y, 0))
  const edges = corners.map((p, i) => {
    const next = corners[(i + 1) % corners.length]
    const normal = new THREE.Vector3(-(next.y - p.y), next.x - p.x, 0).normalize()
    normal.z = -(normal.x * p.x + normal.y * p.y)
    if (normal.x * center.x + normal.y * center.y + normal.z < 0) normal.negate()
    return normal
  })
  const modelCorners = [[-width / 2, height], [width / 2, height], [width / 2, 0], [-width / 2, 0]]
  const residual = Math.max(...modelCorners.map(([x, y], i) => new THREE.Vector3(x, y, 0).applyMatrix4(matrix).distanceTo(localCorners[i])))
  return { center, width, height, floorY: bottom.y, localCorners, edges, matrix, modelFitResidualPx: residual * unit * PHOTO_SIZE[0] / houseData.w }
}

function chamferedBox(width, height, depth, bevel = .003) {
  const b = Math.min(bevel, width / 4, height / 4, depth / 4)
  const w = width / 2 - b, h = height / 2 - b
  const outline = new THREE.Shape()
  outline.moveTo(-w, -h)
  outline.lineTo(w, -h)
  outline.lineTo(w, h)
  outline.lineTo(-w, h)
  outline.closePath()
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: depth - 2 * b, steps: 1, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 })
  geometry.translate(0, 0, -(depth - 2 * b) / 2)
  return geometry
}

export function buildHouseDoorway({ parent, profile, mesh, box, mat, woodMap, plasterMap, textures }) {
  const { width: w, height: h } = profile
  const grain = woodMap.clone()
  grain.repeat.set(.8, 1.6)
  grain.center.set(.5, .5)
  grain.rotation = Math.PI / 2
  grain.needsUpdate = true
  textures.add(grain)
  const material = options => mat({ stencilWrite: false, ...options })
  const oak = material({ color: '#a59173', map: grain, bumpMap: grain, bumpScale: .006, roughness: .78 })
  const insetOak = material({ color: '#756750', map: grain, bumpMap: grain, bumpScale: .004, roughness: .86 })
  const endGrain = material({ color: '#61513b', roughness: .88 })
  const limestone = material({ color: '#dedbd2', bumpMap: plasterMap, bumpScale: .012, roughness: .98 })
  const thresholdStone = material({ color: '#929083', bumpMap: plasterMap, bumpScale: .012, roughness: .99 })
  const agedBrass = material({ color: '#9c8053', metalness: .55, roughness: .6 })
  const iron = material({ color: '#39362e', metalness: .45, roughness: .72 })
  const chamfer = (group, dimensions, surface, at, bevel = .003) => mesh(group, chamferedBox(...dimensions, bevel), surface, at)

  // Recessed lining: its front stays behind the stone photographed at z=0.
  // No oversized black frame or projecting yellow platform covers that stone.
  for (const side of [-1, 1]) {
    box(parent, [.016, h, .3], limestone, [side * (w / 2 - .008), h / 2, -.16])
    chamfer(parent, [.025, h - .04, .075], endGrain, [side * (w / 2 - .04), h / 2, -.079])
  }
  box(parent, [w, .016, .3], limestone, [0, h - .008, -.16])
  chamfer(parent, [w - .07, .025, .075], endGrain, [0, h - .043, -.079])
  chamfer(parent, [w, .03, .28], thresholdStone, [0, .007, -.145], .004)

  const openingW = w - .094, leafH = h - .092, leafW = openingW / 2 - .003
  const doors = []
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group()
    pivot.name = side < 0 ? 'house-door-left' : 'house-door-right'
    pivot.position.set(side * openingW / 2, h / 2, -.115)
    parent.add(pivot)
    const leaf = new THREE.Group()
    leaf.position.x = -side * leafW / 2
    pivot.add(leaf)
    // Raised stiles/rails and genuinely recessed panels catch moving light.
    chamfer(leaf, [leafW, leafH, .035], insetOak, [0, 0, -.015], .004)
    const stileW = .041, railH = .064
    for (const x of [-leafW / 2 + stileW / 2, leafW / 2 - stileW / 2]) chamfer(leaf, [stileW, leafH, .028], oak, [x, 0, .009])
    const panelH = (leafH - railH * 4) / 3
    for (let i = 0; i < 4; i++) {
      const y = -leafH / 2 + railH / 2 + i * (panelH + railH)
      chamfer(leaf, [leafW - 2 * stileW, railH, .028], oak, [0, y, .009])
    }
    for (let i = 0; i < 3; i++) {
      const y = -leafH / 2 + railH + panelH / 2 + i * (panelH + railH)
      chamfer(leaf, [leafW - 2 * stileW - .012, panelH - .012, .014], oak, [0, y, -.004], .005)
    }
    const handleX = -side * (leafW / 2 - .047)
    chamfer(leaf, [.027, .2, .008], iron, [handleX, -.12, .028], .002)
    for (const y of [-.174, -.066]) {
      const bracket = mesh(leaf, new THREE.CylinderGeometry(.0045, .0045, .025, 8), agedBrass, [handleX, y, .042])
      bracket.rotation.x = Math.PI / 2
    }
    mesh(leaf, new THREE.CylinderGeometry(.009, .009, .13, 10), agedBrass, [handleX, -.12, .055])
    for (const y of [-leafH * .33, leafH * .33]) {
      chamfer(leaf, [.055, .08, .006], iron, [side * (leafW / 2 - .024), y, .025], .0015)
      mesh(leaf, new THREE.CylinderGeometry(.009, .009, .084, 10), iron, [side * leafW / 2, y, .018])
    }
    doors.push({ pivot, side })
  }
  // Light the physical front surfaces; the photographic facade stays unlit.
  const porchLight = new THREE.PointLight('#f8ead2', 7, 6, 2)
  porchLight.position.set(-.9, 3.1, 2.6)
  parent.add(porchLight)
  return { doors, leafThickness: .056, hingeDepth: -.115 }
}
