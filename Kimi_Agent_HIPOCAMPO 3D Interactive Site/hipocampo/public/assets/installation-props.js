import * as THREE from './vendor/three.module.min.js'

// Study volumes, replaced by a single photographic print when item.image exists.
// No personal names, letters or memories are fabricated for the client's archive.
export function createCollectionBuilder({ mesh, box, tube, material, textures, loadTexture, photo, bottle, photoTextures, wood, darkWood, brass, chrome, black, paper }) {
  const cloth = material({ color: '#85755b', roughness: .98, side: THREE.DoubleSide })
  const leather = material({ color: '#49382b', roughness: .88 })
  const ivory = material({ color: '#d1c6a8', roughness: .94 })
  const blue = material({ color: '#344b55', roughness: .85 })
  const red = material({ color: '#713a2e', roughness: .82 })
  const palette = [blue, red, darkWood, cloth]
  const cylinder = (p, r, h, m, at, rb = r) => mesh(p, new THREE.CylinderGeometry(r, rb, h, 16), m, at)
  const sphere = (p, r, m, at, scale = [1, 1, 1]) => { const o = mesh(p, new THREE.SphereGeometry(r, 12, 8), m, at); o.scale.set(...scale); return o }
  const ring = (p, r, t, m, at, horizontal = true) => { const o = mesh(p, new THREE.TorusGeometry(r, t, 6, 20), m, at); if (horizontal) o.rotation.x = Math.PI / 2; return o }

  function labelMap(item) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320
    const g = c.getContext('2d')
    g.fillStyle = '#d6c8a8'; g.fillRect(0, 0, 512, 320)
    g.strokeStyle = '#82715a'; g.strokeRect(18, 18, 476, 284)
    g.fillStyle = '#4b4031'; g.font = '22px Georgia'; g.fillText(item.label, 34, 57, 440)
    g.strokeStyle = '#8e8067'; g.lineWidth = 1
    for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(36, 90 + i * 24); g.lineTo(340 + ((i * 31 + (item.number || 0) * 7) % 120), 90 + i * 24); g.stroke() }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; textures.add(t)
    return t
  }
  function print(p, map, aspect = 1.4) {
    const w = .66, d = w / aspect
    box(p, w, .009, d, paper, [0, .005, 0], .002)
    const face = mesh(p, new THREE.PlaneGeometry(w - .03, d - .03), material({ map, roughness: .94 }), [0, .011, 0], false)
    face.rotation.x = -Math.PI / 2
  }
  function book(p, item) {
    const surface = palette[(item.number || 0) % palette.length]
    box(p, .53, .059, .38, paper, [0, .038, 0], .003)
    for (const y of [.005, .074]) box(p, .56, .012, .41, surface, [0, y, 0], .003)
    box(p, .018, .08, .41, surface, [-.277, .04, 0], .003)
    const cover = mesh(p, new THREE.PlaneGeometry(.42, .26), material({ map: labelMap(item), color: '#a89674', roughness: .95 }), [0, .081, 0], false)
    cover.rotation.x = -Math.PI / 2
  }
  function camera(p, item) {
    box(p, .48, .28, .19, item.number === 11 ? blue : chrome, [0, .14, 0], .018)
    box(p, .15, .29, .22, black, [-.16, .145, .01], .016)
    const lens = cylinder(p, .105, .17, black, [.045, .145, .14]); lens.rotation.x = Math.PI / 2
    const glass = cylinder(p, .079, .008, blue, [.045, .145, .231]); glass.rotation.x = Math.PI / 2
    box(p, .13, .07, .13, black, [.02, .3, -.015], .007)
    cylinder(p, .027, .025, brass, [-.14, .295, 0])
  }
  function disc(p, item, cd = false) {
    const r = cd ? .23 : .29
    const face = mesh(p, new THREE.RingGeometry(.021, r, 40), material({ color: cd ? '#b4b4aa' : '#181715', metalness: cd ? .8 : .1, roughness: cd ? .28 : .48, side: THREE.DoubleSide }), [0, .007, 0], false)
    face.rotation.x = -Math.PI / 2
    ring(p, r, .003, cd ? chrome : black, [0, .006, 0])
    if (!cd) { cylinder(p, .075, .004, palette[item.number % 4], [0, .01, 0]); for (const a of [.17, .22, .26]) ring(p, a, .001, black, [0, .011, 0]) }
  }
  function cassette(p) {
    box(p, .48, .066, .3, black, [0, .034, 0], .012)
    box(p, .42, .006, .19, ivory, [0, .07, -.025], .003)
    for (const x of [-.12, .12]) { cylinder(p, .062, .009, black, [x, .077, -.025]); cylinder(p, .026, .013, chrome, [x, .079, -.025]) }
    box(p, .2, .005, .035, leather, [0, .075, .1])
  }
  function shoes(p) {
    for (const x of [-.125, .125]) {
      box(p, .19, .026, .39, black, [x, .015, 0], .012)
      sphere(p, .1, leather, [x, .077, .01], [.93, .66, 1.72])
      ring(p, .055, .012, leather, [x, .12, -.1])
      for (const z of [-.015, .035, .085]) box(p, .074, .006, .006, ivory, [x, .14, z])
    }
  }
  function clothes(p) {
    const shirtMaterial = material({ color: '#aaa793', roughness: .99, side: THREE.DoubleSide })
    const shirt = new THREE.LatheGeometry([new THREE.Vector2(.16, 0), new THREE.Vector2(.155, .25), new THREE.Vector2(.18, .36), new THREE.Vector2(.08, .47), new THREE.Vector2(.065, .48)], 24)
    const positions = shirt.attributes.position
    for (let i = 0; i < positions.count; i++) positions.setZ(i, positions.getZ(i) * .38 + Math.sin(positions.getY(i) * 24 + positions.getX(i) * 28) * .005)
    shirt.computeVertexNormals()
    mesh(p, shirt, shirtMaterial, [.16, .17, .2])
    for (const side of [-1, 1]) {
      const sleeve = mesh(p, new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(side * .13, .57, .2), new THREE.Vector3(side * .22, .5, .2), new THREE.Vector3(side * .25, .43, .2)]), 8, .057, 10, false), shirtMaterial, [.16, 0, 0])
      sleeve.scale.z = .7
    }
    box(p, .3, .28, .12, leather, [-.23, .16, .25], .018)
    tube(p, [[-.35, .28, .25], [-.35, .49, .25], [-.12, .49, .25], [-.12, .28, .25]], .014, leather)
  }
  function apron(p) {
    const outline = new THREE.Shape()
    outline.moveTo(-.22, 0); outline.lineTo(.22, 0); outline.lineTo(.18, .39); outline.lineTo(.1, .45); outline.lineTo(.1, .66); outline.lineTo(-.1, .66); outline.lineTo(-.1, .45); outline.lineTo(-.18, .39); outline.closePath()
    mesh(p, new THREE.ExtrudeGeometry(outline, { depth: .012, bevelEnabled: false }), cloth)
    tube(p, [[-.08, .64, 0], [-.1, .79, 0], [.1, .79, 0], [.08, .64, 0]], .012, ivory)
    box(p, .23, .16, .006, ivory, [0, .24, .016])
  }
  function cup(p, x) {
    mesh(p, new THREE.LatheGeometry([new THREE.Vector2(.055, .012), new THREE.Vector2(.073, .025), new THREE.Vector2(.098, .16), new THREE.Vector2(.085, .16), new THREE.Vector2(.06, .035), new THREE.Vector2(.02, .035)], 20), ivory, [x, .008, 0])
    const handle = ring(p, .05, .012, ivory, [x + .108, .1, 0], false); handle.rotation.y = Math.PI / 2
    cylinder(p, .145, .009, ivory, [x, .004, 0])
  }

  return function build(item, p) {
    if (item.image) { print(p, loadTexture(item.image), item.imageAspect || 1.4); return }
    const k = item.kind, surface = palette[(item.number || 0) % palette.length]
    if (k === 'chemical') { bottle(p, item.color, item.size); return }
    if (k === 'photo' || k === 'postcard') { photo(p, ((item.number || 1) % 4) + 1); return }
    if (['letter', 'document', 'drawing', 'newspaper', 'poster', 'holy-card'].includes(k)) { print(p, labelMap(item), k === 'holy-card' ? .72 : 1.4); return }
    if (k === 'book' || k === 'magazine') { book(p, item); return }
    if (k === 'clothes') { clothes(p); return }
    if (k === 'apron') { apron(p); return }
    if (k === 'shoes') { shoes(p); return }
    if (k === 'camera') { camera(p, item); return }
    if (k === 'vinyl' || k === 'cd') { disc(p, item, k === 'cd'); return }
    if (k === 'cassette') { cassette(p); return }
    if (k === 'frame') {
      box(p, .54, .67, .038, darkWood, [0, .335, 0], .009)
      box(p, .48, .61, .008, paper, [0, .335, .025])
      mesh(p, new THREE.PlaneGeometry(.41, .53), material({ map: photoTextures[item.number % 4], color: '#d6c6a7', roughness: .9 }), [0, .335, .031], false)
      tube(p, [[0, .5, -.02], [0, .015, -.18], [0, .015, .005]], .012, darkWood); return
    }
    if (k === 'turntable') {
      box(p, .7, .11, .48, wood, [0, .06, 0], .016)
      cylinder(p, .19, .025, chrome, [-.08, .128, 0]); cylinder(p, .17, .009, black, [-.08, .145, 0]); cylinder(p, .047, .003, red, [-.08, .151, 0])
      tube(p, [[.24, .14, -.15], [.24, .22, -.15], [.09, .22, .13]], .011, chrome); return
    }
    if (k === 'player' || k === 'radio') {
      box(p, .63, .31, .26, k === 'radio' ? wood : black, [0, .16, 0], .018)
      for (const x of [-.17, .17]) { const speaker = cylinder(p, .1, .012, black, [x, .16, .139]); speaker.rotation.x = Math.PI / 2 }
      box(p, .18, .085, .012, ivory, [0, .19, .143]); for (let i = 0; i < 4; i++) box(p, .042, .018, .04, chrome, [-.08 + i * .055, .327, .03], .003)
      if (k === 'radio') tube(p, [[.22, .3, -.08], [.28, .65, -.08]], .005, chrome); return
    }
    if (k === 'tin') { cylinder(p, .15, .31, surface, [0, .16, 0]); for (const y of [.015, .32]) cylinder(p, .155, .015, chrome, [0, y, 0]); return }
    if (k === 'bottle') { bottle(p, '#7c754e', .8); return }
    if (k === 'perfume') { box(p, .21, .27, .13, material({ color: '#a59365', roughness: .22, metalness: .15 }), [0, .14, 0], .014); cylinder(p, .046, .07, brass, [0, .315, 0]); return }
    if (k === 'pencils' || k === 'pencil') {
      if (k === 'pencils') cylinder(p, .115, .23, wood, [0, .12, 0])
      for (let i = 0; i < (k === 'pencils' ? 4 : 2); i++) { const o = cylinder(p, .009, .44, i % 2 ? blue : wood, [i * .025 - .04, k === 'pencils' ? .29 : .014, 0]); if (k === 'pencil') o.rotation.z = Math.PI / 2 }
      return
    }
    if (k === 'clock') {
      const body = cylinder(p, .22, .065, brass, [0, .25, 0]); body.rotation.x = Math.PI / 2
      const face = cylinder(p, .198, .009, paper, [0, .25, .039]); face.rotation.x = Math.PI / 2
      for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; const tick = box(p, .009, .022, .005, black, [Math.sin(a) * .17, .25 + Math.cos(a) * .17, .047]); tick.rotation.z = -a }
      const hand = box(p, .009, .14, .006, black, [0, .3, .053]); hand.rotation.z = -.8
      box(p, .12, .009, .006, black, [.045, .25, .055]); for (const x of [-.12, .12]) box(p, .06, .05, .08, brass, [x, .025, 0]); return
    }
    if (k === 'plush' || k === 'doll') {
      sphere(p, .13, k === 'plush' ? leather : cloth, [0, .17, 0], [.9, 1.2, .7]); sphere(p, .096, ivory, [0, .37, 0])
      for (const side of [-1, 1]) { sphere(p, .045, cloth, [side * .11, .1, .05]); sphere(p, .035, cloth, [side * .09, .42, 0]); sphere(p, .008, black, [side * .032, .38, .088]) } return
    }
    if (k === 'sewing') { box(p, .43, .012, .27, cloth, [0, .008, 0]); cylinder(p, .075, .16, ivory, [-.11, .09, 0]); for (const y of [.018, .17]) cylinder(p, .086, .012, wood, [-.11, y, 0]); tube(p, [[.08, .025, -.08], [.2, .025, .09]], .003, chrome); return }
    if (k === 'chalk' || k === 'peg') {
      if (k === 'chalk') for (let i = 0; i < 3; i++) { const o = cylinder(p, .015, .25, ivory, [0, .017, i * .055]); o.rotation.z = Math.PI / 2 }
      else { for (const z of [-.025, .025]) box(p, .31, .026, .035, wood, [0, .015, z]); ring(p, .03, .006, chrome, [0, .04, 0]) } return
    }
    if (k === 'wallet') { box(p, .3, .034, .23, leather, [0, .018, 0], .008); box(p, .26, .012, .21, leather, [.012, .041, 0], .005); return }
    if (k === 'brush') { sphere(p, .1, wood, [0, .035, .055], [1, .3, 1.3]); box(p, .046, .022, .18, wood, [0, .025, -.12], .008); for (const x of [-.045, 0, .045]) for (const z of [0, .045, .09]) cylinder(p, .004, .05, black, [x, .075, z]); return }
    if (k === 'glasses') { for (const x of [-.105, .105]) ring(p, .082, .007, brass, [x, .015, 0]); tube(p, [[-.03, .015, 0], [0, .02, 0], [.03, .015, 0]], .005, brass); for (const x of [-.19, .19]) tube(p, [[x, .015, 0], [x, .025, -.2]], .005, brass); return }
    if (k === 'brooch') { ring(p, .1, .016, brass, [0, .02, 0]); for (let i = 0; i < 5; i++) sphere(p, .025, ivory, [Math.sin(i * 1.26) * .08, .035, Math.cos(i * 1.26) * .08]); return }
    if (k === 'lighter') { box(p, .13, .23, .064, chrome, [0, .12, 0], .009); box(p, .13, .065, .064, brass, [0, .268, 0], .007); return }
    if (k === 'lamp') { cylinder(p, .14, .022, black, [0, .013, 0]); tube(p, [[0, .02, 0], [0, .44, -.06], [.08, .53, .03]], .012, brass); mesh(p, new THREE.ConeGeometry(.14, .16, 20, 1, true), blue, [.08, .49, .03]); return }
    if (k === 'cutlery') { for (const x of [-.11, .02, .14]) box(p, .02, .008, .31, chrome, [x, .01, 0], .003); sphere(p, .045, chrome, [-.11, .015, .18], [.8, .16, 1.5]); for (const x of [-.001, .019, .039]) box(p, .007, .008, .1, chrome, [x, .01, .17]); box(p, .045, .009, .15, chrome, [.15, .01, .17]); return }
    if (k === 'cups') { cup(p, -.17); cup(p, .17); return }
    if (k === 'ashtray') { cylinder(p, .15, .024, chrome, [0, .013, 0]); ring(p, .13, .018, chrome, [0, .035, 0]); return }
    if (k === 'keys') { box(p, .36, .022, .14, wood, [0, .014, 0], .008); for (const x of [-.08, .08]) { ring(p, .032, .005, chrome, [x, .03, 0]); box(p, .015, .006, .1, chrome, [x, .03, .07]); } return }
    if (k === 'ukulele') { sphere(p, .14, wood, [0, .04, .13], [1, .25, 1.4]); sphere(p, .11, wood, [0, .04, -.07], [1, .3, 1.1]); box(p, .055, .025, .42, darkWood, [0, .053, -.28], .008); cylinder(p, .043, .005, black, [0, .08, .03]); for (let i = 0; i < 4; i++) tube(p, [[-.012 + i * .008, .085, .2], [-.012 + i * .008, .085, -.48]], .001, chrome); return }
    if (k === 'statue') { cylinder(p, .12, .025, black, [0, .014, 0]); sphere(p, .075, brass, [0, .19, 0], [.7, 1.8, .7]); sphere(p, .05, brass, [0, .36, 0]); return }
    box(p, .39, .14, .25, item.number === 52 ? wood : ivory, [0, .072, 0], .01)
    box(p, .4, .018, .26, surface, [0, .15, 0], .006)
  }
}
