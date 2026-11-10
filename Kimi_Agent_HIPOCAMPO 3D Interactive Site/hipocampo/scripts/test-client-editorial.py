"""Browser regression for the approved audio requests. App must run on :4173."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'client-editorial';OUT.mkdir(parents=True,exist_ok=True)
async def scenario(browser,name,size,reduced=False):
 p=await browser.new_page(viewport=size,reduced_motion='reduce' if reduced else 'no-preference');errors=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
 if not reduced:await p.screenshot(path=str(OUT/f'{name}-intro.png'))
 await p.wait_for_function("document.documentElement.dataset.editorialMotionReady==='true'&&document.querySelector('#sobre')&&document.querySelector('#vestigios')")
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=6000)
 await p.wait_for_timeout(900)
 await p.evaluate('__hipocampoLenis.scrollTo(0,{immediate:true,force:true})')
 circle=await p.locator('.hipocampo-transition-circle').evaluate('(e)=>getComputedStyle(e).clipPath')
 assert circle.startswith('circle(0px'),circle
 await p.screenshot(path=str(OUT/f'{name}-hero.png'))
 assert await p.locator('#site-nav a').count()==7
 assert await p.locator('#site-nav a[href="#sobre"]').count()==1
 assert await p.locator('#site-nav a[href="#relatos"]').count()==1
 assert 'sobre nós' in (await p.locator('#site-nav').text_content()).lower()
 assert await p.locator('#fotofilmes h3').first.inner_text()=='Yolanda'
 if not reduced and size['width']>767:
  for x,y in [(150,280),(350,330),(550,400),(800,320)]:await p.mouse.move(x,y);await p.wait_for_timeout(90)
  squares=await p.locator('.hipocampo-trail-photo.is-active').evaluate_all('(es)=>es.map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height,fit:getComputedStyle(e).objectFit,shape:e.className}))')
  assert squares and all(abs(s['w']-s['h'])<1 and s['fit']=='cover' and 'square' in s['shape']for s in squares),squares
  await p.screenshot(path=str(OUT/f'{name}-square-photos.png'))
 await p.evaluate("async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-page1-page2');__hipocampoLenis.scrollTo(s.start+.06*(s.end-s.start),{immediate:true,force:true});ST.update()}")
 await p.wait_for_timeout(150)
 grown=await p.locator('.hipocampo-transition-circle').evaluate('(e)=>getComputedStyle(e).clipPath')
 assert grown!=circle,(circle,grown)
 await p.evaluate('__hipocampoLenis.scrollTo(0,{immediate:true,force:true})');await p.wait_for_timeout(150)
 assert (await p.locator('.hipocampo-transition-circle').evaluate('(e)=>getComputedStyle(e).clipPath')).startswith('circle(0px')
 async def visit(selector):
  await p.evaluate('(s)=>__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true})',selector);await p.wait_for_timeout(400)
 await visit('#sobre')
 if size['width']<768:
  toggle=p.locator('header button[aria-controls=site-nav]');await toggle.click()
  assert await toggle.get_attribute('aria-expanded')=='true'
  await p.locator('#site-nav a[href="#relatos"]').click()
  await p.wait_for_timeout(1600)
  assert await toggle.get_attribute('aria-expanded')=='false'
  assert await p.locator('#relatos').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0}')
 await visit('#sobre')
 header=await p.locator('header').evaluate('(e)=>({theme:e.dataset.navTheme,color:getComputedStyle(e.querySelector(":scope>a")).color,bg:getComputedStyle(e).backgroundColor,logoOpacity:getComputedStyle(e.querySelector(":scope>a")).opacity,logoTop:e.querySelector(":scope>a").getBoundingClientRect().top})')
 assert header['theme']=='light',header
 assert header['color']=='rgb(107, 49, 28)',header
 assert header['bg']=='rgba(0, 0, 0, 0)',header
 assert float(header['logoOpacity'])>.99 and header['logoTop']>=0,header
 await p.screenshot(path=str(OUT/f'{name}-about.png'))
 for n in [1,2]:
  await visit(f'#fotofilmes article:nth-of-type({n})')
  await p.wait_for_timeout(1000)
  await p.screenshot(path=str(OUT/f'{name}-film-{n}.png'))
  theme=await p.locator('header').get_attribute('data-nav-theme')
  assert theme==('yellow' if n==1 else 'dark'),(name,n,theme)
  assert await p.locator(f'#fotofilmes article:nth-of-type({n})').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 result={'scenario':name,'circleAtRest':circle,'circleAfterScroll':grown,'headerOnWhite':header,'errors':errors}
 print(json.dumps(result),flush=True)
 await p.close();return result
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for args in [('desktop',{'width':1366,'height':768}),('mobile',{'width':390,'height':844}),('reduced',{'width':1366,'height':768},True)]:results.append(await scenario(b,*args))
  (OUT/'result.json').write_text(json.dumps(results,indent=2));await b.close()
asyncio.run(main())
