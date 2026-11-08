import * as THREE from './vendor/three.module.min.js'

const clamp01 = value => Math.max(0, Math.min(1, value))

// Mirror the distance/cone attenuation used by r169 lights_pars_begin. The
// diffuse shell is static; only the directional shadow remains per fragment.
export function houseDistanceAttenuation(distance, cutoff, decay) {
  let attenuation = 1 / Math.max(Math.pow(distance, decay), .01)
  if (cutoff > 0) attenuation *= Math.pow(clamp01(1 - Math.pow(distance / cutoff, 4)), 2)
  return attenuation
}
export function houseSpotAttenuation(coneCos, penumbraCos, angleCos) {
  if (penumbraCos - coneCos < 1e-8) return angleCos >= coneCos ? 1 : 0
  const t = clamp01((angleCos - coneCos) / (penumbraCos - coneCos))
  return t * t * (3 - 2 * t)
}

function yieldToPaint(signal) {
  return new Promise((resolve, reject) => {
    let frame = 0, timer = 0
    const cleanup = () => {
      if (frame && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
    const abort = () => { cleanup(); reject(signal.reason) }
    const done = () => { cleanup(); resolve() }
    if (signal?.aborted) return abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (typeof requestAnimationFrame === 'function' && !document.hidden) frame = requestAnimationFrame(() => { frame = 0; timer = setTimeout(done, 0) })
    else timer = setTimeout(done, 0)
  })
}

export function createHouseStaticLighting(root) {
  let revision = 0, preparedRevision = -1, pending = null
  let vertexCount = 0, meshCount = 0, bakeMs = 0

  function material(source) {
    const result = new THREE.MeshLambertMaterial()
    // Material.copy preserves stencil, blending, side, clipping and depth flags
    // without copying Standard-only shader parameters into Lambert.
    THREE.Material.prototype.copy.call(result, source)
    result.color.copy(source.color)
    result.map = source.map
    result.emissive.copy(source.emissive)
    result.emissiveIntensity = source.emissiveIntensity
    result.name = `house-static-diffuse-${source.id}`
    result.userData.houseStaticLighting = true
    result.onBeforeCompile = shader => {
      shader.vertexShader = `attribute vec3 houseStaticLight;
attribute vec3 houseSunLight;
varying vec3 vHouseStaticLight;
varying vec3 vHouseSunLight;
` + shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vHouseStaticLight = houseStaticLight;
vHouseSunLight = houseSunLight;`)
      shader.fragmentShader = `varying vec3 vHouseStaticLight;
varying vec3 vHouseSunLight;
` + shader.fragmentShader
        .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
        .replace('#include <lights_lambert_fragment>', '')
        .replace('#include <lights_fragment_begin>', 'float houseShadow = max( max( vHouseSunLight.r, vHouseSunLight.g ), vHouseSunLight.b ) > 0.00001 ? getShadowMask() : 1.0;\nreflectedLight.directDiffuse = ( vHouseStaticLight + vHouseSunLight * houseShadow ) * diffuseColor.rgb * RECIPROCAL_PI;')
        .replace('#include <lights_fragment_maps>', '')
        .replace('#include <lights_fragment_end>', '')
    }
    result.customProgramCacheKey = () => 'house-static-diffuse-v1'
    return result
  }

  function collectLights() {
    const records = [], position = new THREE.Vector3(), target = new THREE.Vector3()
    root.traverse(light => {
      if (!light.isLight || !light.visible) return
      light.getWorldPosition(position)
      const color = light.color.clone().multiplyScalar(light.intensity)
      if (light.isHemisphereLight) {
        // WebGLLights uses the world POSITION as a direction, including root's
        // translation. Assuming +Y here would change this room's current light.
        records.push({ kind: 'hemisphere', direction: position.clone().normalize(), sky: color, ground: light.groundColor.clone().multiplyScalar(light.intensity) })
      } else if (light.isDirectionalLight || light.isSpotLight) {
        light.target.getWorldPosition(target)
        records.push({
          kind: light.isDirectionalLight ? 'directional' : 'spot', color,
          position: position.clone(), direction: position.clone().sub(target).normalize(),
          cutoff: light.distance, decay: light.decay,
          coneCos: light.isSpotLight ? Math.cos(light.angle) : 0,
          penumbraCos: light.isSpotLight ? Math.cos(light.angle * (1 - light.penumbra)) : 0,
          shadow: !!light.castShadow,
        })
      } else if (light.isPointLight) records.push({ kind: 'point', position: position.clone(), color, cutoff: light.distance, decay: light.decay })
      else if (light.isAmbientLight) records.push({ kind: 'ambient', color })
    })
    return records
  }

  async function bake(signal, onProgress) {
    while (preparedRevision !== revision) {
      signal?.throwIfAborted()
      const generation = revision, started = performance.now()
      root.updateWorldMatrix(true, true)
      const lights = collectLights(), jobs = []
      let total = 0, completed = 0
      root.traverse(mesh => {
        if (!mesh.isMesh || !mesh.material?.userData.houseStaticLighting) return
        const count = mesh.geometry.attributes.position.count
        jobs.push({ mesh, count, matrix: mesh.matrixWorld.clone(), normalMatrix: new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld), staticLight: new Float32Array(count * 3), sunLight: new Float32Array(count * 3) })
        total += count
      })
      onProgress?.(0, total)
      await yieldToPaint(signal)
      let slice = performance.now()
      const position = new THREE.Vector3(), normal = new THREE.Vector3(), toLight = new THREE.Vector3()
      for (const job of jobs) {
        const positions = job.mesh.geometry.attributes.position, normals = job.mesh.geometry.attributes.normal
        for (let i = 0; i < job.count; i++) {
          position.fromBufferAttribute(positions, i).applyMatrix4(job.matrix)
          normal.fromBufferAttribute(normals, i).applyNormalMatrix(job.normalMatrix)
          let r = 0, g = 0, b = 0, sr = 0, sg = 0, sb = 0
          for (const light of lights) {
            if (light.kind === 'hemisphere') {
              const weight = .5 * normal.dot(light.direction) + .5
              r += light.ground.r + (light.sky.r - light.ground.r) * weight
              g += light.ground.g + (light.sky.g - light.ground.g) * weight
              b += light.ground.b + (light.sky.b - light.ground.b) * weight
              continue
            }
            if (light.kind === 'ambient') { r += light.color.r; g += light.color.g; b += light.color.b; continue }
            let factor
            if (light.kind === 'directional') factor = Math.max(0, normal.dot(light.direction))
            else {
              toLight.copy(light.position).sub(position)
              const distance = toLight.length()
              if (distance < 1e-8 || (light.cutoff > 0 && distance >= light.cutoff)) continue
              toLight.multiplyScalar(1 / distance)
              factor = Math.max(0, normal.dot(toLight)) * houseDistanceAttenuation(distance, light.cutoff, light.decay)
              if (light.kind === 'spot') factor *= houseSpotAttenuation(light.coneCos, light.penumbraCos, toLight.dot(light.direction))
            }
            if (light.kind === 'directional' && light.shadow) {
              sr += light.color.r * factor; sg += light.color.g * factor; sb += light.color.b * factor
            } else { r += light.color.r * factor; g += light.color.g * factor; b += light.color.b * factor }
          }
          const offset = i * 3
          job.staticLight[offset] = r; job.staticLight[offset + 1] = g; job.staticLight[offset + 2] = b
          job.sunLight[offset] = sr; job.sunLight[offset + 1] = sg; job.sunLight[offset + 2] = sb
          completed++
          if (completed % 128 === 0 && performance.now() - slice >= 4) {
            onProgress?.(completed, total)
            await yieldToPaint(signal)
            signal?.throwIfAborted()
            slice = performance.now()
          }
        }
      }
      signal?.throwIfAborted()
      if (generation !== revision) continue
      // Publish all attributes together so resize cannot reveal a partial bake.
      for (const job of jobs) {
        job.mesh.geometry.setAttribute('houseStaticLight', new THREE.BufferAttribute(job.staticLight, 3))
        job.mesh.geometry.setAttribute('houseSunLight', new THREE.BufferAttribute(job.sunLight, 3))
      }
      vertexCount = total; meshCount = jobs.length; bakeMs = Math.round(performance.now() - started)
      preparedRevision = generation
      onProgress?.(total, total)
    }
  }

  return {
    material,
    invalidate() { revision++ },
    isDirty: () => preparedRevision !== revision,
    prepare(signal, onProgress) {
      if (pending) return pending
      pending = bake(signal, onProgress).finally(() => { pending = null })
      return pending
    },
    inspect: () => ({ prepared: preparedRevision === revision, revision, vertexCount, meshCount, bakeMs }),
  }
}
