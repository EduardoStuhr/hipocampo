import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as THREE from '../public/assets/vendor/three.module.min.js'
import { batchStaticMeshes } from '../public/assets/static-mesh-batch.js'
import { fitHouseDoorway } from '../public/assets/house-doorway.js'
import { createHouseInterior } from '../public/assets/house-interior.js'
const root=new THREE.Group(),mat=new THREE.MeshStandardMaterial(), expected=[]
for(let i=0;i<4;i++){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(.2+i,.5,1),mat)
 mesh.position.set(i,.2*i,-i);mesh.rotation.set(.2*i,.1*i,0);mesh.scale.set(1,.8+i*.1,1)
 mesh.updateMatrix();expected.push(mesh.geometry.clone().applyMatrix4(mesh.matrix));root.add(mesh)
}
const untouched=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),mat);root.add(untouched)
const result=batchStaticMeshes(root,{exclude:new Set([untouched])})
assert.equal(result.savedMeshes,3)
assert.equal(root.children.length,2)
const merged=result.geometries[0]
for(const name of ['position','normal','uv']){
 const actual=merged.attributes[name].array
 let offset=0
 for(const g of expected){for(let j=0;j<g.attributes[name].array.length;j++)assert.equal(actual[offset+j],g.attributes[name].array[j]);offset+=g.attributes[name].array.length}
}
assert.equal(merged.index.count,4*36)
assert.equal(untouched.parent,root)
// Construct the real room without rendering, checking responsive and hinge refs.
globalThis.document={createElement:()=>({getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}})})}
const manifest=JSON.parse(fs.readFileSync(new URL('../public/images/map/manifest.json', import.meta.url)))
const toWorld=(x,y)=>new THREE.Vector3((x-manifest.width/2)/16,-(y-manifest.height/2)/16,0)
const house=manifest.pieces.find(d=>d.tipo==='casa'),doorway=fitHouseDoorway(house,16,toWorld),scene=new THREE.Scene()
const pieces=manifest.pieces.filter(d=>d!==house).map(d=>({d,mat:{map:new THREE.Texture()}}))
const room=createHouseInterior({scene,door:doorway.center,facade:new THREE.MeshBasicMaterial(),doorway,unit:16,pieces,loadTexture:()=>new THREE.Texture()})
room.resize(.5);room.resize(1.7)
room.update(.5,1000,1,{dx:.3,dy:.1,sx:.1},.016,{position:new THREE.Vector3(0,2,-4)})
let meshes=0;room.root.traverse(o=>{if(o.isMesh)meshes++})
assert(room.inspect().batchedMeshes>=30)
assert(room.root.getObjectByName('house-front-wall').geometry.attributes.position.count>0)
assert.equal(room.root.getObjectByName('house-door-left').rotation.y,.5*1.48)
console.log(JSON.stringify({savedMeshes:room.inspect().batchedMeshes,meshes,geometryAttributesExact:true,resizeAndHingeReferences:true}))
room.dispose()

// Fragment identity, source shadow flags and picker hits survive batching.
{
const scene = new THREE.Scene(), object = new THREE.Group(), material = new THREE.MeshBasicMaterial()
object.userData.fragmentId = 'objeto-teste'
object.position.set(2, 1, -3); object.rotation.y = .28; object.scale.setScalar(.8); scene.add(object)
for (let i=0; i<4; i++) {
 const mesh = new THREE.Mesh(new THREE.BoxGeometry(.6,.4,.3), material)
 mesh.position.set(i-.9, .3, i % 2 * .2); mesh.rotation.y = i*.15
 mesh.userData.sourceShadow = i < 2; mesh.castShadow = true; mesh.receiveShadow = true
 object.add(mesh)
}
scene.updateMatrixWorld(true)
const before = new THREE.Box3().setFromObject(object, true)
const target = object.localToWorld(new THREE.Vector3(-.9,.3,0))
const ray = new THREE.Raycaster(target.clone().add(new THREE.Vector3(0,5,0)),new THREE.Vector3(0,-1,0))
const firstBefore=ray.intersectObject(object,true)[0].distance
const result=batchStaticMeshes(scene)
scene.updateMatrixWorld(true)
assert.equal(result.savedMeshes,2)
assert.equal(object.children.length,2)
assert.deepEqual(new Set(object.children.map(x=>x.userData.sourceShadow)),new Set([true,false]))
const after=new THREE.Box3().setFromObject(object, true)
assert.ok(before.min.distanceTo(after.min)<1e-6&&before.max.distanceTo(after.max)<1e-6)
const hit=ray.intersectObject(object,true)[0]
assert.ok(Math.abs(hit.distance-firstBefore)<1e-6)
assert.equal(hit.object.parent.userData.fragmentId,'objeto-teste')
console.log(JSON.stringify({savedMeshes:result.savedMeshes,sourceShadowPreserved:true,boundsPreserved:true,raycastPreserved:true}))
}
