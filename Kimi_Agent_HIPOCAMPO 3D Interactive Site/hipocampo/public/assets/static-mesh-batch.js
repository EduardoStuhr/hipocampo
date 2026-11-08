import * as THREE from './vendor/three.module.min.js'

// Only combine immutable siblings. Their parent's transform (a door hinge,
// suspended frame or responsive wall) remains independent and may still move.
export function batchStaticMeshes(root, { exclude = new Set() } = {}) {
  const parents = []
  root.traverse(object => { if (object.children.length) parents.push(object) })
  const removed = [], geometries = []
  for (const parent of parents) {
    const buckets = new Map()
    for (const object of parent.children) {
      const material = object.material, geometry = object.geometry
      if (!object.isMesh || object.isSkinnedMesh || object.isInstancedMesh || object.children.length || exclude.has(object)) continue
      if (!geometry?.isBufferGeometry || !material || Array.isArray(material) || material.transparent || !material.colorWrite) continue
      if (!object.visible || object.renderOrder !== 0 || geometry.morphAttributes.position || geometry.morphAttributes.normal) continue
      if (geometry.drawRange.start !== 0 || Number.isFinite(geometry.drawRange.count)) continue
      if (object.matrixAutoUpdate) object.updateMatrix()
      // Flipped local transforms need reversed winding; leave them separate.
      if (object.matrix.determinant() <= 0) continue
      const attributes = Object.keys(geometry.attributes).sort()
      if (!attributes.includes('position') || attributes.some(name => geometry.attributes[name].isInterleavedBufferAttribute)) continue
      const signature = attributes.map(name => {
        const attribute = geometry.attributes[name]
        return `${name}:${attribute.itemSize}:${attribute.array.constructor.name}:${attribute.normalized}`
      }).join('|')
      const key = [material.id, signature, !!geometry.index, object.castShadow, object.receiveShadow, object.frustumCulled, object.layers.mask, object.userData.sourceShadow].join(';')
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key).push(object)
    }
    for (const objects of buckets.values()) {
      if (objects.length < 2) continue
      const combined = new THREE.BufferGeometry()
      const source = objects.map(object => object.geometry.clone().applyMatrix4(object.matrix))
      for (const name of Object.keys(source[0].attributes)) {
        const first = source[0].attributes[name]
        const array = new first.array.constructor(source.reduce((total, geometry) => total + geometry.attributes[name].array.length, 0))
        let offset = 0
        for (const geometry of source) {
          array.set(geometry.attributes[name].array, offset)
          offset += geometry.attributes[name].array.length
        }
        combined.setAttribute(name, new THREE.BufferAttribute(array, first.itemSize, first.normalized))
      }
      if (source[0].index) {
        const count = source.reduce((total, geometry) => total + geometry.index.count, 0)
        const vertices = combined.attributes.position.count
        const indices = vertices > 65535 ? new Uint32Array(count) : new Uint16Array(count)
        let indexOffset = 0, vertexOffset = 0
        for (const geometry of source) {
          for (let i = 0; i < geometry.index.count; i++) indices[indexOffset++] = geometry.index.getX(i) + vertexOffset
          vertexOffset += geometry.attributes.position.count
        }
        combined.setIndex(new THREE.BufferAttribute(indices, 1))
      }
      source.forEach(geometry => geometry.dispose())
      combined.computeBoundingBox()
      combined.computeBoundingSphere()
      const first = objects[0]
      const mesh = new THREE.Mesh(combined, first.material)
      mesh.name = `static-batch-${first.material.id}`
      mesh.castShadow = first.castShadow
      mesh.receiveShadow = first.receiveShadow
      mesh.frustumCulled = first.frustumCulled
      mesh.layers.mask = first.layers.mask
      mesh.userData.sourceShadow = first.userData.sourceShadow
      for (const object of objects) { parent.remove(object); removed.push(object) }
      parent.add(mesh)
      geometries.push(combined)
    }
  }
  return { removed, geometries, savedMeshes: removed.length - geometries.length }
}
