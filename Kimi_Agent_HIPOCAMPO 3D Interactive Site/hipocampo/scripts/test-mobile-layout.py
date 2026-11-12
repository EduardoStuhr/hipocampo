"""Phone layout + real touch gestures; run with PORT=4173 npm run dev."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'mobile-layout';OUT.mkdir(parents=True,exist_ok=True)
async def touch_drag(page,x,y,dx,dy):
 cdp=await page.context.new_cdp_session(page)
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for i in range(1,13):
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+dx*i/12,'y':y+dy*i/12}]});await page.wait_for_timeout(25)
 await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await cdp.detach();await page.wait_for_timeout(300)
async def check(browser,w,h,full=False):
 p=await browser.new_page(viewport={'width':w,'height':h},is_mobile=True,has_touch=True,device_scale_factor=1)
 errors=[];missing=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('response',lambda r:missing.append(r.url)if r.status>=400 and '127.0.0.1' in r.url else None)
 await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
 await p.wait_for_function("document.documentElement.dataset.editorialMotionReady==='true'&&document.querySelector('[data-action=mobile-navigation]')&&document.querySelector('.memory-char')")
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=10000)
 await p.evaluate('document.fonts.ready');await p.wait_for_timeout(600)
 async def go(selector,offset=-90):
  await p.evaluate('([s,o])=>{__hipocampoLenis.resize();__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true,offset:o})}',[selector,offset]);await p.wait_for_timeout(950)
 # Hero rows fit; header controls are reachable with a finger.
 assert await p.locator('.hipocampo-memory-line').first.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}')
 menu=p.locator('header > button');await menu.tap()
 nav=p.locator('#site-nav');await p.wait_for_timeout(400)
 assert await nav.is_visible()
 assert await nav.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}')
 for a in await nav.locator('a').all():assert (await a.bounding_box())['height']>=44
 await nav.locator('[href="#sobre"]').tap();assert await menu.get_attribute('aria-expanded')=='false'
 await go('#sobre')
 assert await p.locator('.page4-text').evaluate('(e)=>parseFloat(getComputedStyle(e).lineHeight)>=26')
 envelope=p.locator('.page4-photo--envelope');old=await envelope.locator('.page4-envelope-photo').get_attribute('src')
 await envelope.tap();assert await envelope.locator('.page4-envelope-photo').get_attribute('src')!=old
 await go('.page5-camera-control',-160)
 await p.locator('.page5-shutter').tap();await p.locator('.page5-generated-photo').first.wait_for()
 await p.wait_for_function("document.querySelector('.page5-generated-photo img')?.naturalWidth>0")
 assert await p.locator('.page5-generated-photo').first.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=-2&&r.right<=innerWidth+2}')
 await p.wait_for_function("document.querySelectorAll('.page5-generated-photo').length===0",timeout=7500)
 await go('#instalacao .installation-stage',-260)
 await p.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared",timeout=120000)
 await go('#instalacao .installation-stage',-260)
 root=p.locator('#instalacao')
 state=lambda:root.evaluate('(e)=>e.installationRoom.inspect()')
 mode=root.locator('[data-action=mobile-navigation]')
 await mode.tap();assert (await state())['navigating']
 assert await mode.inner_text()=='voltar à rolagem'
 assert (await state())['scrollReserved']
 if full:
  await p.screenshot(path=str(OUT/f'after-{w}-3d-touch.png'))
  canvas=await root.locator('canvas').bounding_box();before=(await state())['camera']
  await touch_drag(p,canvas['x']+canvas['width']*.9, min(h-60,canvas['y']+canvas['height']*.65),-70,0)
  assert (await state())['camera']!=before,'Touch did not rotate camera'
 await mode.tap();assert not (await state())['navigating'] and not (await state())['scrollReserved']
 # Controls do not cover the sticky touch row, including overhead mode.
 await root.locator('[data-action=top-view]').tap();assert (await state())['viewMode']=='table-top'
 await root.locator('#installation-topview-hint').wait_for(state='visible')
 r=await root.locator('.installation-zoom').bounding_box();t=await root.locator('.installation-toolbar').bounding_box()
 assert r['y']>=t['y']+t['height']-1,(r,t)
 await root.locator('[data-action=top-view]').tap()
 await root.locator('.installation-accessible summary').tap()
 await root.locator('.installation-search').fill('Relógio')
 await root.locator('.installation-accessible').get_by_role('button',name='Relógio',exact=True).tap()
 await p.wait_for_timeout(850)
 assert any(o['atTable'] for o in (await state())['objects'])
 if full:
  await go('#instalacao .installation-stage',-260)
  async with p.expect_download()as download:await root.locator('[data-action=take-photo]').tap()
  assert (await download.value).suggested_filename.endswith('.png')
 await root.locator('[data-action=reset]').tap()
 await go('#fragmentos > div:nth-child(2)',-110)
 cards=p.locator('#fragmentos [data-fragment]')
 await p.wait_for_function("[...document.querySelectorAll('#fragmentos [data-fragment] img')].every(i=>i.complete&&i.naturalWidth)")
 assert await cards.nth(1).locator('img').evaluate('(e)=>getComputedStyle(e).mixBlendMode')=='normal'
 assert await p.locator('#fragmentos > div:nth-child(2) > p').evaluate('(e)=>{const r=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return r.top>b.top+b.height/2}')
 for card in await cards.all():
  assert await card.evaluate('(e)=>{const r=e.getBoundingClientRect(),b=e.parentElement.getBoundingClientRect();return r.left>=b.left-12&&r.right<=b.right+12}')
 await cards.nth(0).tap();await cards.nth(1).tap();assert await p.locator('#fragmentos svg line').count()==1
 if full:
  card=cards.nth(2);r=await card.bounding_box();old=await card.get_attribute('style')
  await touch_drag(p,r['x']+r['width']/2,r['y']+r['height']/2,20,-55)
  assert await card.get_attribute('style')!=old,'Touch did not move fragment'
  await p.screenshot(path=str(OUT/f'after-{w}-fragment-board.png'))
 # Natural vertical touch scroll works outside draggable cards.
 await go('#projeto',-90)
 y=await p.evaluate('scrollY');await touch_drag(p,w/2,h*.75,0,-100)
 assert await p.evaluate('scrollY')>y+30,'Page touch scroll was blocked'
 for selector in ['#abertura','#projeto','#sobre','#vestigios','#instalacao','#fragmentos','#fotofilmes','#relatos','#informacoes']:
  await go(selector)
  assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),selector
  if full:await p.screenshot(path=str(OUT/f'after-{w}-{selector[1:]}.png'))
 assert not errors,errors
 assert not missing,missing
 result={'size':[w,h],'touchMenu':True,'envelope':True,'camera':True,'sceneTouchMode':True,'topView':True,'collection':True,'fragments':True,'scroll':True,'overflow':False,'errors':errors}
 if full:
  # A rotated phone and return to desktop must release the scene and adapters.
  await p.set_viewport_size({'width':667,'height':375});await p.wait_for_timeout(800)
  await go('#instalacao .installation-stage',-180)
  await mode.tap();assert (await state())['navigating']
  await mode.tap();assert not (await state())['navigating']
  assert await p.locator('.installation-zoom').evaluate('(e)=>e.getBoundingClientRect().bottom<innerHeight')
  await p.screenshot(path=str(OUT/'after-landscape.png'))
  await p.set_viewport_size({'width':1366,'height':768});await p.wait_for_timeout(800)
  assert await p.locator('.installation-mobile-navigation').count()==0
  assert not (await state())['scrollReserved']
  await p.set_viewport_size({'width':w,'height':h});await p.wait_for_timeout(600)
  assert await p.locator('.installation-mobile-navigation').count()==1
 print(json.dumps(result),flush=True);await p.close();return result
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for w,h in [(390,844),(375,667),(320,640),(430,932)]:results.append(await check(b,w,h,w==390))
  (OUT/'mobile-results.json').write_text(json.dumps(results,indent=2));await b.close()
if __name__=='__main__':asyncio.run(main())
