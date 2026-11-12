"""Touch-only immersion, stable viewport painting and explicit page lock."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'mobile-immersion';OUT.mkdir(parents=True,exist_ok=True)
async def swipe(p,x,y,dx=0,dy=-90):
 c=await p.context.new_cdp_session(p)
 await c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for i in range(1,10):
  await c.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/9,'y':y+dy*i/9}]});await p.wait_for_timeout(25)
 await c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await c.detach();await p.wait_for_timeout(250)
async def check(b,w,h):
 p=await b.new_page(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,device_scale_factor=1)
 errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
 await p.wait_for_function("document.querySelector('.installation-mobile-tools')&&window.__hipocampoLenis")
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=10000)
 await p.evaluate('document.fonts.ready');await p.wait_for_timeout(500)
 async def go(s,offset=0):
  await p.evaluate('([s,o])=>__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true,offset:o})',[s,offset]);await p.wait_for_timeout(550)
 async def timeline(id,progress):
  await p.evaluate("async([id,p])=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const t=ST.getById(id);__hipocampoLenis.scrollTo(t.start+p*(t.end-t.start),{immediate:true,force:true});ST.update()}",[id,progress]);await p.wait_for_timeout(700)
 async def full(s):
  r=await p.locator(s).bounding_box()
  assert abs(r['y'])<2 and r['height']>=p.viewport_size['height']-1,(s,r,p.viewport_size)
 # Fresh opening: complete blue viewport, one collapsed mobile menu.
 await full('#abertura')
 assert await p.locator('#site-nav').is_hidden()
 assert (await p.locator('header > button').inner_text()).lower()=='menu'
 await p.locator('header > button').tap();assert await p.locator('#site-nav').is_visible()
 await p.locator('header > button').tap();assert await p.locator('#site-nav').is_hidden()
 line=await p.locator('.hipocampo-memory-line').nth(3).bounding_box()
 c=await p.context.new_cdp_session(p)
 await c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':w*.4,'y':line['y']+line['height']/2}]})
 await p.wait_for_timeout(100)
 assert await p.locator('.hipocampo-trail-photo.is-active').count()>0,'Tap did not create a photograph'
 assert await p.locator('.memory-char').evaluate_all('(es)=>es.some(e=>e.getAnimations().length>0)'), 'Letters ignore touch'
 await p.screenshot(path=str(OUT/f'{w}-hero-touch.png'))
 await c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await c.detach()
 # Browser bars expand/collapse during a pinned transition.
 for height in [h-100,h]:
  await p.set_viewport_size({'width':w,'height':height});await p.wait_for_timeout(700)
  await timeline('hipocampo-page1-page2',.16);await full('#abertura')
  await p.screenshot(path=str(OUT/f'{w}-hero-{height}.png'))
 await go('[data-memory-map]',-250)
 await p.wait_for_function("document.querySelector('[data-memory-map]').dataset.memoryMapDecoded==='true'")
 assert await p.locator('[data-memory-map]').get_attribute('data-house-covered')!='true'
 frames=p.locator('.memory-map-piece')
 before=await frames.evaluate_all('(es)=>es.map(e=>getComputedStyle(e).transform)')
 r=await p.locator('[data-memory-map]').bounding_box();c=await p.context.new_cdp_session(p)
 await c.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':r['x']+r['width']*.3,'y':r['y']+r['height']*.3}]})
 await p.wait_for_timeout(350)
 after=await frames.evaluate_all('(es)=>es.map(e=>getComputedStyle(e).transform)')
 assert before!=after,'Map ignores touch'
 await p.screenshot(path=str(OUT/f'{w}-map-touch.png'))
 await c.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await c.detach()
 await p.wait_for_function("document.querySelector('#casa').houseJourney",timeout=120000)
 for progress in [.08,.35,.65]:
  await timeline('hipocampo-house',progress);await full('.page3-stage')
  await p.screenshot(path=str(OUT/f'{w}-house-{progress}.png'))
 await p.wait_for_selector('#casa.has-house-look')
 await p.locator('.page3-canvas').tap(position={'x':w*.5,'y':h*.5})
 await p.wait_for_function("document.documentElement.classList.contains('mobile-scroll-locked')")
 y=await p.evaluate('scrollY');await swipe(p,w*.9,h*.6,dy=-100)
 assert abs(await p.evaluate('scrollY')-y)<2,'House page lock leaked'
 assert await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().view.active')
 await p.locator('.page3-look-toggle').tap()
 assert not await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 await go('#instalacao .installation-stage')
 await p.wait_for_function("document.querySelector('#instalacao').installationRoom?.inspect().prepared",timeout=120000)
 await go('#instalacao .installation-stage')
 await full('.installation-stage')
 state=lambda:p.locator('#instalacao').evaluate('(e)=>e.installationRoom.inspect()')
 await p.locator('[data-action=mobile-navigation]').tap()
 assert (await state())['navigating']
 assert await p.locator('.installation-mobile-tools').get_attribute('open') is None
 assert await p.locator('.installation-toolbar').is_hidden()
 await p.set_viewport_size({'width':w,'height':h-80});await p.wait_for_timeout(900)
 await full('.installation-stage')
 assert await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 await p.set_viewport_size({'width':w,'height':h});await p.wait_for_timeout(900)
 await full('.installation-stage')
 y=await p.evaluate('scrollY')
 await swipe(p,w*.9,h*.4,dx=-50,dy=-50)
 assert abs(await p.evaluate('scrollY')-y)<2
 # Opening controls, overhead/reset actions and blur must retain the page lock.
 await p.locator('.installation-mobile-tools > summary').tap()
 await p.locator('[data-action=top-view]').tap();await p.wait_for_timeout(200)
 assert await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 await p.evaluate("window.dispatchEvent(new Event('blur'))");await p.wait_for_timeout(150)
 assert await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 await swipe(p,w*.1,h*.25,dy=-60)
 assert abs(await p.evaluate('scrollY')-y)<2
 await p.locator('[data-action=top-view]').tap()
 await p.locator('.installation-mobile-tools > summary').tap()
 await p.screenshot(path=str(OUT/f'{w}-room-immersive.png'))
 await p.locator('[data-action=mobile-navigation]').tap()
 assert not await p.evaluate("document.documentElement.classList.contains('mobile-scroll-locked')")
 assert not (await state())['navigating']
 await p.wait_for_timeout(200)
 await swipe(p,8,h*.3,dy=-100)
 assert await p.evaluate('scrollY')>y+20,await p.evaluate("({y:scrollY,html:document.documentElement.className,touch:getComputedStyle(document.querySelector('.installation-canvas')).touchAction,stopped:__hipocampoLenis.isStopped})")
 assert not errors,errors
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 print(json.dumps({'viewport':[w,h],'fullHeroAndHouse':True,'touchPhotosAndLetters':True,'touchMap':True,'houseLock':True,'roomLockPersists':True,'explicitUnlock':True,'errors':errors}),flush=True)
 await p.close()
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for size in [(390,844),(375,667)]:await check(b,*size)
  await b.close()
if __name__=='__main__':asyncio.run(main())
