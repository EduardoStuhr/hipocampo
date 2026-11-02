import * as THREE from './vendor/three.module.min.js'

// One WebGL context, two scenes. Only render both during the paper opening;
// the facade and the room never have to intersect or share a physical doorway.
export function createPaperTransition(renderer) {
  const exterior = new THREE.WebGLRenderTarget(1, 1)
  const interior = new THREE.WebGLRenderTarget(1, 1)
  const uniforms = {
    exterior: { value: exterior.texture },
    interior: { value: interior.texture },
    resolution: { value: new THREE.Vector2(1, 1) },
    center: { value: new THREE.Vector2(0.5, 0.5) },
    doorway: { value: new THREE.Vector2(20, 50) },
    entrance: { value: 0 },
    exit: { value: 0 },
    paper: { value: new THREE.Color('#ffffff') },
  }
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 uvPaper;
      void main() {
        uvPaper = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D exterior, interior;
      uniform vec2 resolution, center, doorway;
      uniform float entrance, exit;
      uniform vec3 paper;
      varying vec2 uvPaper;

      float opening(vec2 origin, vec2 initialSize, float progress) {
        if (progress <= 0.0) return 0.0;
        if (progress >= 1.0) return 1.0;
        vec2 reach = max(origin, 1.0 - origin) * resolution * 1.22;
        vec2 halfSize = mix(initialSize, reach, pow(progress, 1.65));
        vec2 point = (uvPaper - origin) * resolution;
        vec2 normalized = point / halfSize;
        float angle = atan(normalized.y, normalized.x);
        // Fixed fibers: no time-based noise or crawling edges while scrubbing.
        float fibers = sin(angle * 19.0 + 0.8) * 0.014
          + sin(angle * 43.0) * 0.009 + sin(angle * 97.0 + 1.4) * 0.004;
        float contour = pow(pow(abs(normalized.x), 6.0)
          + pow(abs(normalized.y), 6.0), 1.0 / 6.0);
        float edge = 1.5 / min(halfSize.x, halfSize.y);
        float mask = 1.0 - smoothstep(1.0 + fibers - edge, 1.0 + fibers + edge, contour);
        return mask * smoothstep(0.0, 0.08, progress);
      }

      void main() {
        vec4 outside = texture2D(exterior, uvPaper);
        vec4 inside = texture2D(interior, uvPaper);
        float reveal = opening(center, doorway, entrance);
        vec4 scene = mix(outside, inside, reveal);
        float light = opening(vec2(0.5, 0.52), vec2(7.0, 20.0), exit);
        gl_FragColor = mix(scene, vec4(paper, 1.0), light);
        #include <colorspace_fragment>
      }
    `,
  })
  const scene = new THREE.Scene()
  const camera = new THREE.Camera()
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
  plane.frustumCulled = false
  scene.add(plane)

  return {
    uniforms,
    resize(width, height) {
      // CSS-pixel targets keep the brief overlap affordable on high-DPI phones.
      exterior.setSize(width, height)
      interior.setSize(width, height)
      uniforms.resolution.value.set(width, height)
    },
    render(outside, outsideCamera, inside, insideCamera, enter, leave) {
      uniforms.entrance.value = enter
      uniforms.exit.value = leave
      renderer.setRenderTarget(null)
      if (leave >= 1) {
        renderer.setClearColor(uniforms.paper.value, 1)
        renderer.clear()
        return
      }
      if (enter <= 0) { renderer.render(outside, outsideCamera); return }
      if (enter >= 1 && leave <= 0) { renderer.render(inside, insideCamera); return }
      if (enter < 1) {
        renderer.setRenderTarget(exterior)
        renderer.render(outside, outsideCamera)
      }
      renderer.setRenderTarget(interior)
      renderer.render(inside, insideCamera)
      renderer.setRenderTarget(null)
      renderer.render(scene, camera)
    },
    dispose() {
      exterior.dispose()
      interior.dispose()
      plane.geometry.dispose()
      material.dispose()
    },
  }
}
