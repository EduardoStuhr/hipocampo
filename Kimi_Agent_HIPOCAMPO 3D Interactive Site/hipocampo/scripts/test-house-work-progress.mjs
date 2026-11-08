import assert from 'node:assert/strict'
class Element {
  constructor(tag) { this.tag=tag;this.children=[];this.attributes={};this.classes=new Set();this.classList={toggle:(key,on)=>on?this.classes.add(key):this.classes.delete(key)} }
  append(...elements) { for(const element of elements){element.parent=this;this.children.push(element)} }
  setAttribute(name,value) { this.attributes[name]=value }
  querySelector(selector) { return this.children.find(e=>selector.startsWith('.')?e.className===selector.slice(1):Object.hasOwn(e.attributes,selector.slice(1,-1)))||this.children.map(e=>e.querySelector(selector)).find(Boolean)||null }
  remove() { if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this) }
  dispatchEvent() {}
}
let pendingMutation,hiddenCallback
const doc={hidden:false,createElement:tag=>new Element(tag)}
globalThis.document=doc
globalThis.HTMLImageElement=class{}
globalThis.MutationObserver=class { constructor(fn){pendingMutation=fn}observe(){}disconnect(){pendingMutation=null} }
globalThis.window={addEventListener(){},removeEventListener(){},setTimeout(fn,ms,...args){if(ms===800){hiddenCallback=fn;return -1}return setTimeout(fn,ms,...args)},clearTimeout(id){if(id===-1)hiddenCallback=null;else clearTimeout(id)},requestIdleCallback(fn){return setTimeout(()=>fn({didTimeout:true,timeRemaining:()=>20}),0)},cancelIdleCallback:clearTimeout}
const{createHousePreparation}=await import('../public/assets/house-preparation.js')
const project=new Element('section'),api=createHousePreparation(project)
api.update('textures',2,4);assert.equal(api.inspect().value,7);assert.equal(api.inspect().mounted,false)
const copy=new Element('div');copy.className='hipocampo-page2-copy';const slot=new Element('div');slot.setAttribute('data-house-preparation-slot','');copy.append(slot);project.append(copy);pendingMutation()
assert.equal(api.inspect().mounted,true);assert.equal(slot.children.length,1)
api.update('materials',1,10);assert.equal(api.inspect().value,44)
api.update('textures',4,4);assert.equal(api.inspect().value,44)
api.update('warmup',4,4);assert.equal(api.inspect().value,99)
api.complete();assert.equal(api.inspect().value,100);hiddenCallback();assert.equal(api.inspect().faded,true)
api.retry();assert.equal(api.inspect().value,0);assert.equal(api.inspect().faded,false)
api.update('warmup',9,10);assert.equal(api.inspect().completed,false)
api.dispose();assert.equal(slot.children.length,0);assert.equal(copy.children.length,1);assert.equal(api.inspect().disposed,true)
const THREE=await import('../public/assets/vendor/three.module.min.js')
const{prepareSceneMaterials,warmScene}=await import('../public/assets/scene-preparation.js')
const scene=new THREE.Scene(),tex=new THREE.Texture(),m1=new THREE.MeshBasicMaterial({map:tex}),m2=new THREE.MeshBasicMaterial()
for(const material of[m1,m1,m2])scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material))
const gl={fenceSync:()=>({}),flush(){},isContextLost:()=>false,clientWaitSync:()=>0,deleteSync(){},TIMEOUT_EXPIRED:1,WAIT_FAILED:2}
const renderer={initTexture(){},compileAsync:()=>Promise.resolve(),getSize:v=>v.set(320,200),setSize(){},properties:{get:mat=>({currentProgram:{id:mat.id}})},shadowMap:{},render(){},getContext:()=>gl}
const calls=[],options={allowDuringScroll:true,compileBatchSize:2,batchWarmup:true,onProgress:(...args)=>calls.push(args)}
await prepareSceneMaterials(renderer,scene,new THREE.PerspectiveCamera(),[],new AbortController().signal,options)
assert.deepEqual(calls.map(row=>row.slice(1)),[[0,3],[1,3],[2,3],[3,3]])
calls.length=0
await warmScene(renderer,scene,new THREE.PerspectiveCamera(),new AbortController().signal,options)
assert.deepEqual(calls.map(row=>row.slice(1)),[[0,4],[1,4],[2,4],[3,4],[4,4]])
const controller=new AbortController();calls.length=0
await assert.rejects(warmScene(renderer,scene,new THREE.PerspectiveCamera(),controller.signal,{...options,onProgress(stage,done,total){calls.push([stage,done,total]);if(done===1)controller.abort()}}),{name:'AbortError'})
assert.equal(calls.at(-1)[1],1);assert(scene.children.every(o=>o.visible))
console.log(JSON.stringify({pendingDOM:true,monotonic:true,realCompleteOnly:true,slotReserved:true,materialTasks:3,warmupTasks:4,cancellationRestoresScene:true}))
