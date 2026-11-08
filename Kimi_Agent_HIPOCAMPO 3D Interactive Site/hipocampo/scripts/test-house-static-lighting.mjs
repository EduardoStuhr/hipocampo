import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from '../public/assets/vendor/three.module.min.js'
import { createHouseStaticLighting, houseDistanceAttenuation, houseSpotAttenuation } from '../public/assets/house-static-lighting.js'
import { createHouseInterior } from '../public/assets/house-interior.js'
import { fitHouseDoorway } from '../public/assets/house-doorway.js'

// The grain canvas needs no browser for numerical lighting/geometry checks.
globalThis.document = {
  hidden: false,
  createElement: () => ({ getContext: () => ({
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }) }),
}

assert.equal(houseDistanceAttenuation(2, 0, 2), .25)
assert.equal(houseDistanceAttenuation(5, 5, 2), 0)
assert.equal(houseDistanceAttenuation(6, 5, 2), 0)
assert.equal(houseSpotAttenuation(.5, 1, .5), 0)
assert.equal(houseSpotAttenuation(.5, 1, .75), .5)
assert.equal(houseSpotAttenuation(.5, 1, 1), 1)

const root = new THREE.Group()
const sun = new THREE.DirectionalLight(0xffffff, 2)
sun.position.set(0, 5, 0)
sun.target.position.set(0, 0, 0)
sun.castShadow = true
root.add(sun, sun.target)
const source = new THREE.MeshStandardMaterial({
  color: 0xeeeeee, stencilWrite: true, stencilRef: 1,
  stencilFunc: THREE.EqualStencilFunc, stencilWriteMask: 0,
})
const lighting = createHouseStaticLighting(root)
const material = lighting.material(source)
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1, 2, 2, 2), material)
root.add(mesh)
await lighting.prepare()
assert.equal(lighting.isDirty(), false)
assert.equal(material.stencilFunc, source.stencilFunc)
assert.equal(material.stencilWriteMask, source.stencilWriteMask)
const attribute = mesh.geometry.attributes.houseSunLight
assert.equal(attribute.count, mesh.geometry.attributes.position.count)
assert.equal(Math.max(...attribute.array), 2, 'HDR irradiance must not be clamped to one')
const shader = { vertexShader: THREE.ShaderLib.lambert.vertexShader, fragmentShader: THREE.ShaderLib.lambert.fragmentShader }
material.onBeforeCompile(shader)
assert(!shader.fragmentShader.includes('#include <lights_fragment_begin>'))
assert(!shader.fragmentShader.includes('#include <lights_fragment_end>'))
assert(shader.fragmentShader.includes('getShadowMask'))
lighting.invalidate()
assert(lighting.isDirty())
await lighting.prepare()
assert(!lighting.isDirty())

const manifest = JSON.parse(fs.readFileSync(new URL('../public/images/map/manifest.json', import.meta.url)))
const toWorld = (x, y) => new THREE.Vector3((x - manifest.width / 2) / 16, -(y - manifest.height / 2) / 16, 0)
const house = manifest.pieces.find(piece => piece.tipo === 'casa')
const doorway = fitHouseDoorway(house, 16, toWorld)
const room = createHouseInterior({
  scene: new THREE.Scene(), door: doorway.center,
  facade: new THREE.MeshBasicMaterial(), doorway, unit: 16,
  pieces: manifest.pieces.filter(piece => piece !== house).map(d => ({ d, mat: { map: new THREE.Texture() } })),
  loadTexture: () => new THREE.Texture(),
})
const controller = new AbortController()
await assert.rejects(room.prepareStaticLighting(controller.signal, () => controller.abort()), { name: 'AbortError' })
assert(room.staticLightingDirty(), 'aborted bake must not be published as ready')
room.resize(.5)
const progress = []
await room.prepareStaticLighting(undefined, (done, total) => progress.push([done, total]))
assert(!room.staticLightingDirty())
let vertices = 0
room.root.traverse(object => {
  if (!object.material?.userData.houseStaticLighting) return
  const staticLight = object.geometry.attributes.houseStaticLight
  const sunLight = object.geometry.attributes.houseSunLight
  assert(staticLight && sunLight)
  assert.equal(staticLight.count, object.geometry.attributes.position.count)
  assert.equal(sunLight.count, staticLight.count)
  for (const value of staticLight.array) assert(Number.isFinite(value) && value >= 0)
  for (const value of sunLight.array) assert(Number.isFinite(value) && value >= 0)
  vertices += staticLight.count
})
assert(vertices > 1000)
assert.equal(progress[0][0], 0)
assert.equal(progress.at(-1)[0], progress.at(-1)[1])
room.resize(1.5)
assert(room.staticLightingDirty(), 'width change must invalidate the baked irradiance')
await room.prepareStaticLighting()
assert(!room.staticLightingDirty())
const report = { vertices, progressEvents: progress.length, hdrPreserved: true, shaderLoopsRemoved: true, abortSafe: true, resizeRebaked: true }
room.dispose()
console.log(JSON.stringify(report))
