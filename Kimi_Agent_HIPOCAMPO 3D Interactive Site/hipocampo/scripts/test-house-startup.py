"""Browser regression checks for house startup and recovery.

Requires Python Playwright and Chromium. Start the app with PORT=4173 npm run dev,
then run python scripts/test-house-startup.py. Screenshots and JSON are written
under artifacts/startup-recovery. HOUSE_TEST_URL and CHROMIUM_PATH can override
local defaults. WebGL failures are injected only in test browser responses.
"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'startup-recovery'
OUT.mkdir(parents=True,exist_ok=True)
async def run(browser,name,mode='',mobile=False,reduced=False,cpu=1):
 c=await browser.new_context(viewport={'width':390 if mobile else 1366,'height':844 if mobile else 768},reduced_motion='reduce' if reduced else 'no-preference')
 p=await c.new_page();errors=[];p.on('pageerror',lambda e: errors.append(str(e)))
 await p.add_init_script("window.__renderers=[]")
 async def instrument(route):
  res=await route.fetch();body=(await res.text()).replace('  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))','  window.__renderers.push(renderer);\n  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25))',1)
  if mode=='abort-error': body=body.replace('    await prepareSceneMaterials(', "    if (!window.__abortOnce) { window.__abortOnce = true; throw new DOMException('Injected preparation abort', 'AbortError') }\n    await prepareSceneMaterials(",1)
  await route.fulfill(response=res,body=body)
 await p.route('**/assets/page3-house.js?*',instrument)
 calls=0;allow=False
 async def texture(route):
  nonlocal calls
  calls+=1
  if mode in ['slow','timeout'] and calls==1:await asyncio.sleep(12 if mode=='slow' else 8)
  if mode=='once' and calls==1 or mode=='persistent' and not allow: await route.fulfill(status=503,body='Injected texture error')
  else:await route.continue_()
 if mode in ['slow','timeout','once','persistent']:await p.route('**/images/client-2026-11/foto-1.webp',texture)
 if mode=='timeout':
  await p.add_init_script('''(()=>{let used=false;const original=window.setTimeout;window.setTimeout=function(fn,ms,...args){if(ms===45000&&!used){used=true;ms=1800}return original.call(this,fn,ms,...args)}})()''')
 if mode=='loss':
  await p.add_init_script('''(()=>{let used=false;const P=WebGL2RenderingContext.prototype,original=P.clientWaitSync;P.clientWaitSync=function(...args){if(!used&&this.canvas.className==='page3-canvas'){used=true;setTimeout(()=>this.getExtension('WEBGL_lose_context').loseContext(),0);return this.TIMEOUT_EXPIRED}return original.apply(this,args)}})()''')
 if cpu!=1:
  cd=await c.new_cdp_session(p);await cd.send('Emulation.setCPUThrottlingRate',{'rate':cpu})
 await p.goto(os.getenv('HOUSE_TEST_URL','http://127.0.0.1:4173/'),wait_until='domcontentloaded')
 await p.wait_for_function("window.__hipocampoLenis&&document.querySelector('#sobre')&&document.querySelector('#casa')")
 async def go(progress):
  await p.evaluate('''async progress=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const st=ST.getById('hipocampo-house')||ST.getById('hipocampo-house-preview');if(st){__hipocampoLenis.scrollTo(st.start+progress*(st.end-st.start),{immediate:true,force:true});ST.update()}}''',progress)
 await p.wait_for_function("window.__renderers.length>0")
 await p.wait_for_timeout(500);await go(.6)
 if mode=='slow':
  await p.wait_for_timeout(1000)
  assert await p.locator('#casa').get_attribute('data-house-state')=='loading'
  assert await p.locator('.page3-preview').is_visible()
  assert await p.locator('.page3-preview-map').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}')
  await p.screenshot(path=str(OUT/(name+'-loading.png')))
 if mode=='persistent':
  await p.wait_for_function("__renderers.length>=2&&document.querySelector('#casa').dataset.houseState==='error'")
  await go(.6)
  assert await p.locator('.page3-status').count()==0
  assert await p.locator('.page3-preview').is_visible()
  assert await p.locator('.page3-preview-map').evaluate('(el)=>{const r=el.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0&&r.left<innerWidth&&r.right>0}')
  assert await p.locator('.page3-preview img').count()>10
  await p.screenshot(path=str(OUT/(name+'-fallback.png')))
  assert not errors,errors
  result={'name':name,'renderers':await p.evaluate('__renderers.length'),'fallback':True,'errors':errors}
  (OUT/(name+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
  await c.close()
  return
 await p.wait_for_function("document.querySelector('#casa').dataset.houseState==='ready'",timeout=60000)
 await go(.6);await p.wait_for_timeout(500)
 assert await p.locator('.page3-status').count()==0
 if mode=='runtime':
  before=await p.evaluate('__renderers.length')
  await p.evaluate("__renderers.at(-1).getContext().getExtension('WEBGL_lose_context').loseContext()")
  await p.wait_for_function('(before)=>__renderers.length>before',arg=before)
  await p.wait_for_function("document.querySelector('#casa').dataset.houseState==='ready'",timeout=60000)
  await go(.6);await p.wait_for_timeout(500)
 state=await p.locator('#casa').evaluate('(el)=>el.houseJourney.inspect()')
 assert state['prepared'] and state['visible'],state
 assert await p.locator('.page3-canvas').evaluate('(el)=>getComputedStyle(el).opacity')=='1'
 await p.screenshot(path=str(OUT/(name+'-ready.png')))
 for v in [.1,.8,.6]:await go(v);await p.wait_for_timeout(120)
 if not reduced:
  await p.locator('.page3-canvas').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'mouse','clientX':650,'clientY':350,'button':0})
  await p.mouse.move(700,350);await p.mouse.down();await p.mouse.move(850,375,steps=5);await p.mouse.up()
 await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#sobre'),{immediate:true,force:true})")
 await p.wait_for_timeout(400)
 assert await p.locator('#sobre').evaluate('(el)=>el.getBoundingClientRect().top<innerHeight')
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 triggers=await p.evaluate("async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');return ST.getAll().filter(t=>t.vars.id==='hipocampo-house').length}")
 assert triggers==1,triggers
 assert not errors,errors
 result={'name':name,'renderers':await p.evaluate('__renderers.length'),'textureRequests':calls,'prepared':state['prepared'],'visible':state['visible'],'errors':errors,'houseTriggers':triggers}
 (OUT/(name+'.json')).write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
 await c.close()
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for name,opts in [('normal',{}),('unexpected-abort',{'mode':'abort-error'}),('timeout',{'mode':'timeout'}),('slow',{'mode':'slow'}),('texture-once',{'mode':'once'}),('persistent-fallback',{'mode':'persistent'}),('loss-warmup',{'mode':'loss'}),('loss-runtime',{'mode':'runtime'}),('mobile',{'mobile':True}),('reduced',{'reduced':True}),('cpu4x',{'cpu':4})]:
   if not os.getenv('HOUSE_TEST_CASES') or name in os.environ['HOUSE_TEST_CASES'].split(','): await run(b,name,**opts)
  await b.close()
asyncio.run(main())
