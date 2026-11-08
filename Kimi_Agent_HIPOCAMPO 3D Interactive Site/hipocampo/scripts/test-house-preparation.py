"""Regression for real preparation progress, idle rendering and responsive bake.
Requires running app on port4173, Python Playwright, Chromium and Pillow.
"""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'house-gpu';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  p=await b.new_page(viewport={'width':1366,'height':768});errors=[]
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('console',lambda m:errors.append(m.text)if m.type=='error'and 'Shader Error' in m.text else None)
  await p.add_init_script('''window.__progress=[];new MutationObserver(()=>{const e=document.querySelector('.house-preparation-bar');if(e&&__progress.at(-1)?.value!==e.value)__progress.push({value:e.value,state:document.querySelector('#casa')?.dataset.houseState})}).observe(document,{subtree:true,childList:true,attributes:true,attributeFilter:['value']})''')
  async def delay(route):await asyncio.sleep(9);await route.continue_()
  await p.route('**/images/client-2026-11/foto-1.webp',delay)
  await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
  await p.wait_for_selector('.house-preparation-bar')
  await p.wait_for_function('window.__hipocampoLenis')
  await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#projeto'),{immediate:true,force:true,offset:-5})")
  slot=p.locator('[data-house-preparation-slot]');height=await slot.evaluate('(e)=>e.getBoundingClientRect().height')
  value=await p.locator('.house-preparation-bar').evaluate('(e)=>e.value');assert value<100,value
  await p.wait_for_timeout(1200)
  assert await slot.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}')
  await p.screenshot(path=str(OUT/'progress-pending.png'))
  await p.wait_for_function("document.querySelector('#casa')?.houseJourney&&document.querySelector('.house-preparation-bar').value===100",timeout=120000)
  await p.wait_for_timeout(1200)
  assert height==await slot.evaluate('(e)=>e.getBoundingClientRect().height')
  assert await p.locator('.house-preparation').evaluate('(e)=>e.classList.contains("is-concealed")')
  progress=await p.evaluate('__progress');assert all(a['value']<=b['value']for a,b in zip(progress,progress[1:])),progress
  assert all(e['state']=='ready'for e in progress if e['value']==100),progress
  assert len(progress)>5,progress
  async def go(v):
   await p.evaluate("async v=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-house');__hipocampoLenis.scrollTo(s.start+v*(s.end-s.start),{immediate:true,force:true});ST.update()}",v)
  async def state():return await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect()')
  await go(.65)
  await p.wait_for_function("document.querySelector('#casa').houseJourney.inspect().visible")
  await p.wait_for_function("!document.querySelector('#casa').houseJourney.inspect().framePending",timeout=30000)
  idle=await state();await p.wait_for_timeout(700);assert (await state())['renderedFrames']==idle['renderedFrames']
  for x,y in [(700,230),(800,500),(500,300)]:await p.mouse.move(x,y);await p.wait_for_timeout(150)
  await p.wait_for_function("document.querySelector('#casa').houseJourney.inspect().renderedFrames>"+str(idle['renderedFrames']))
  moved=await state();assert any(abs(s['angle'])>.0001 for s in moved['interior']['swings']),moved
  await p.mouse.move(650,350);await p.mouse.down();await p.mouse.move(820,360,steps=5);await p.mouse.up();await p.wait_for_timeout(300)
  assert abs((await state())['view']['targetYaw'])>.1
  await go(.2);await p.wait_for_timeout(200);await go(.65)
  await p.set_viewport_size({'width':390,'height':844})
  await p.wait_for_function("document.querySelector('#casa').houseJourney.inspect().interior.staticLighting.revision>0&&document.querySelector('#casa').houseJourney.inspect().interior.staticLighting.prepared",timeout=30000)
  await p.wait_for_timeout(300);await p.screenshot(path=str(OUT/'mobile-room.png'))
  assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  mobile=await state();assert mobile['interior']['staticLighting']['prepared']
  await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#sobre'),{immediate:true,force:true})")
  await p.wait_for_timeout(800)
  assert await p.locator('#sobre').evaluate('(e)=>e.getBoundingClientRect().top<innerHeight')
  assert not errors,errors
  result={'progress':progress,'slotHeight':height,'idleFrames':idle['renderedFrames'],'mouseResumes':moved['renderedFrames'],'mobileLighting':mobile['interior']['staticLighting'],'errors':errors}
  (OUT/'regression.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
  await b.close()
asyncio.run(main())
