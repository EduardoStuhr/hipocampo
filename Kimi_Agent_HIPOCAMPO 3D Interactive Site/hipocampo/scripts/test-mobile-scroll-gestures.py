"""Regression: native vertical scrolling and repeated house look/exit cycles."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'mobile-gestures';OUT.mkdir(parents=True,exist_ok=True)
async def swipe(p,x,y,dx=0,dy=-100):
 c=await p.context.new_cdp_session(p)
 await c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for i in range(1,11):
  await c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/10,'y':y+dy*i/10}]});await p.wait_for_timeout(25)
 await c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await c.detach();await p.wait_for_timeout(300)
async def check(b,w,h):
 p=await b.new_page(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,device_scale_factor=1)
 errors=[];warnings=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('console',lambda m:warnings.append(m.text)if any(s in m.text.lower()for s in ['unable to preventdefault','ignored attempt to cancel','passive event listener'])else None)
 await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
 await p.wait_for_function("document.querySelector('.installation-mobile-tools')&&window.__hipocampoLenis")
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=10000)
 await p.evaluate('document.fonts.ready');await p.wait_for_timeout(700)
 # A tap still reveals a photograph, but an ordinary vertical swipe must not.
 line=await p.locator('.hipocampo-memory-line').nth(3).bounding_box()
 await p.touchscreen.tap(w*.45,line['y']+line['height']/2);await p.wait_for_timeout(100)
 assert await p.locator('.hipocampo-trail-photo.is-active').count()>0
 await p.screenshot(path=str(OUT/f'{w}-hero-tap.png'))
 await p.wait_for_timeout(1500)
 assert await p.locator('#abertura').evaluate('(e)=>getComputedStyle(e).userSelect')=='none'
 y=await p.evaluate('scrollY');await swipe(p,w*.5,h*.65)
 assert await p.evaluate('scrollY')>y+30
 assert not await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 assert await p.locator('.hipocampo-trail-photo.is-active').count()==0
 await swipe(p,w*.5,h*.35,dy=90)
 assert await p.evaluate('scrollY')<y+150
 assert await p.evaluate('getSelection().toString()')==''
 assert await p.locator('#abertura').evaluate('(e)=>!e.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,cancelable:true}))')
 # Height-only browser resize events do not refresh the scroll timelines.
 await p.evaluate('''async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');window.__qaRefresh=0;ST.addEventListener('refresh',()=>__qaRefresh++)}''')
 await p.wait_for_timeout(500)
 await p.evaluate('__qaRefresh=0;for(let i=0;i<6;i++)window.dispatchEvent(new Event("resize"))')
 await p.wait_for_timeout(650)
 assert await p.evaluate('__qaRefresh')==0,'Height-only resize refreshed all pins'
 await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#projeto'),{immediate:true,force:true})")
 await p.wait_for_function("document.querySelector('#casa').houseJourney",timeout=120000)
 async def progress(v):
  await p.evaluate("async v=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const t=ST.getById('hipocampo-house');__hipocampoLenis.scrollTo(t.start+v*(t.end-t.start),{immediate:true,force:true});ST.update()}",v)
  await p.wait_for_timeout(650)
 async def state():return await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect()')
 for cycle in range(3):
  await progress(.65)
  await p.locator('.page3-look-toggle').tap()
  await p.wait_for_function("document.documentElement.classList.contains('mobile-scroll-locked')")
  assert (await state())['view']['active']
  y=await p.evaluate('scrollY');await swipe(p,w*.6,h*.5,dx=50,dy=10)
  assert abs(await p.evaluate('scrollY')-y)<2
  assert abs((await state())['view']['targetYaw'])>.1
  await p.locator('.page3-look-toggle').tap();await p.wait_for_timeout(100)
  assert not (await state())['view']['active']
  assert not await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
  assert not await p.evaluate('__hipocampoLenis.isStopped')
  # This exact first swipe used to re-enable looking and trap the visitor.
  await swipe(p,w*.6,h*.5,dy=-85)
  assert await p.evaluate('scrollY')>y+25,'First swipe after exit was trapped'
  assert not (await state())['view']['active']
  assert not await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 await progress(.65);await p.wait_for_timeout(1000)
 await p.evaluate('''()=>{window.__qaCanvasWrites=0;window.__qaCanvasObserver=new MutationObserver(es=>__qaCanvasWrites+=es.length);__qaCanvasObserver.observe(document.querySelector('.page3-canvas'),{attributes:true,attributeFilter:['width','height']})}''')
 await p.evaluate('for(let i=0;i<6;i++)window.dispatchEvent(new Event("resize"))');await p.wait_for_timeout(800)
 assert await p.evaluate('__qaCanvasWrites')==0,'Browser resize cleared the WebGL canvas'
 await p.evaluate('__qaCanvasObserver.disconnect()')
 for v in [.12,.35,.66,.8,.66,.35,.12]:
  await progress(v)
  r=await p.locator('.page3-stage').bounding_box();assert abs(r['y'])<2 and r['height']>=h-1,r
  assert (await state())['visible']
 await p.screenshot(path=str(OUT/f'{w}-house-return.png'))
 # Leaving the phone breakpoint while looking must also release all mobile
 # locks and restore the desktop control, without a stale "return" label.
 await progress(.65);await p.locator('.page3-look-toggle').tap()
 await p.set_viewport_size({'width':1366,'height':768});await p.wait_for_timeout(500)
 assert not await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 assert not (await state())['view']['active']
 assert await p.locator('.page3-look-toggle').inner_text()=='olhar ao redor'
 assert not errors,errors
 assert not warnings,warnings
 result={'viewport':[w,h],'tapPhotos':True,'nativeSwipeBothWays':True,'houseUnlockCycles':3,'resizeRefreshes':0,'canvasClearsOnResize':0,'houseForwardAndBack':True,'errors':errors,'gestureWarnings':warnings}
 print(json.dumps(result),flush=True);await p.close();return result
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for size in [(390,844),(375,667)]:results.append(await check(b,*size))
  (OUT/'results.json').write_text(json.dumps(results,indent=2));await b.close()
if __name__=='__main__':asyncio.run(main())
