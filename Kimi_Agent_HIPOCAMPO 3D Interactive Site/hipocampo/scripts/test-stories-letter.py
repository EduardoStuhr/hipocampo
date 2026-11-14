"""Verify the reversible scroll envelope and deliberately blank story sheet."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'stories-scroll'
OUT.mkdir(parents=True,exist_ok=True)
async def check(browser,w,h,reduced=False):
 p=await browser.new_page(viewport={'width':w,'height':h},is_mobile=w<768,has_touch=w<768,reduced_motion='reduce'if reduced else'no-preference')
 errors=[];missing=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('response',lambda r:missing.append(r.url)if r.status>=400 and '127.0.0.1' in r.url else None)
 await p.goto(os.environ.get('HIPOCAMPO_TEST_URL','http://127.0.0.1:4180/'),wait_until='domcontentloaded')
 await p.wait_for_selector('#relatos[data-letter-ready]');await p.wait_for_selector('.team-credit-grid');await p.keyboard.press('Escape')
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')")
 await p.evaluate('document.fonts.ready');await p.wait_for_timeout(600)
 await p.evaluate("async()=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');ST.refresh()}")
 root=p.locator('#relatos');paper=root.locator('.stories-letter-paper');track=root.locator('.stories-scroll-track')
 assert await p.locator('#team-finale-title').inner_text()=='SOBRE NÓS'
 assert await root.locator('button,blockquote,.stories-voices,.stories-empty,.stories-letter-signoff').count()==0
 assert (await paper.inner_text()).strip()==''
 assert await paper.locator('*').count()==0
 assert await paper.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgb(255, 255, 255)'
 async def go(fraction):
  await p.evaluate('''r=>{const e=document.querySelector('.stories-scroll-track'),top=e.getBoundingClientRect().top+scrollY;__hipocampoLenis.resize();__hipocampoLenis.scrollTo(top+Math.max(0,e.offsetHeight-innerHeight)*r,{immediate:true,force:true})}''',fraction)
  await p.wait_for_timeout(250)
 style='#root > header, #root > header *, #root > a { visibility:hidden!important }'
 if reduced:
  await go(0)
  assert await root.get_attribute('data-letter-phase')=='open'
  assert await root.locator('.stories-envelope-flap').evaluate('(e)=>getComputedStyle(e).display')=='none'
  assert await track.evaluate('(e)=>e.offsetHeight')<h*1.6
  await p.screenshot(path=str(OUT/f'reduced-{w}.png'),style=style)
 else:
  states=[]
  for fraction in (0,.2,.45,.7,1):
   await go(fraction)
   state=await root.evaluate('''e=>{const p=e.querySelector('.stories-letter-paper'),f=e.querySelector('.stories-envelope-flap'),front=e.querySelector('.stories-envelope-front');return {phase:e.dataset.letterPhase,scaleY:new DOMMatrix(getComputedStyle(p).transform).m22,flap:getComputedStyle(f).transform,frontOpacity:Number(getComputedStyle(front).opacity)}}''')
   states.append(state)
   await p.screenshot(path=str(OUT/f'scroll-{w}-{int(fraction*100)}.png'),style=style)
  assert states[0]['phase']=='closed',states
  assert states[0]['scaleY']<.5,states
  assert states[-1]['phase']=='open',states
  assert abs(states[-1]['scaleY']-1)<.01 and states[-1]['frontOpacity']<.01,states
  assert states[1]['flap']!=states[0]['flap'],states
  assert await paper.get_attribute('aria-hidden')=='false'
  rect=await paper.bounding_box()
  assert rect['x']>=0 and rect['x']+rect['width']<=w+1,rect
  assert rect['y']>=100 and rect['y']+rect['height']<=h+1,rect
  await go(0)
  assert await root.get_attribute('data-letter-phase')=='closed'
  assert await paper.get_attribute('aria-hidden')=='true'
  if w>=768:
   before=await p.evaluate('scrollY');await p.mouse.move(w/2,h*.7);await p.mouse.wheel(0,400);await p.wait_for_timeout(800)
   assert await p.evaluate('scrollY')>before+50
   await p.keyboard.press('PageDown');await p.wait_for_timeout(500)
   assert await p.evaluate('scrollY')>before+100
  else:
   before=await p.evaluate('scrollY')
   cdp=await p.context.new_cdp_session(p)
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':w/2,'y':h*.8}]})
   for i in range(1,9):await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':w/2,'y':h*(.8-.05*i)}]});await p.wait_for_timeout(20)
   await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});await p.wait_for_timeout(700)
   assert await p.evaluate('scrollY')>before+30
   await cdp.detach()
  await go(1)
  await p.mouse.wheel(0,h*2);await p.wait_for_timeout(900)
  assert await p.evaluate("document.querySelector('#informacoes').getBoundingClientRect().top<innerHeight")
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert await p.locator('#informacoes .team-credit').count()==10
 assert await p.locator('#informacoes .team-credit img').count()==9
 if w==1440 and not reduced:
  await p.emulate_media(reduced_motion='reduce');await p.wait_for_timeout(400)
  assert await root.get_attribute('data-letter-phase')=='open'
  await p.emulate_media(reduced_motion='no-preference');await p.wait_for_timeout(400)
  await p.set_viewport_size({'width':390,'height':844});await p.wait_for_timeout(500)
  await p.evaluate("async()=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');ST.refresh()}")
  await go(1)
  resized=await paper.bounding_box()
  assert resized['x']>=0 and resized['x']+resized['width']<=391 and resized['y']>=100 and resized['y']+resized['height']<=845,resized
  assert await p.evaluate("async()=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');return ST.getAll().filter(t=>t.vars.id==='hipocampo-stories-letter').length}")==1
  await go(0);assert await root.get_attribute('data-letter-phase')=='closed'
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'viewport':[w,h],'reducedMotion':reduced,'blankPaper':True,'scrollReversible':not reduced,'nativeWheelOrTouch':not reduced,'aboutTitle':True,'noOverflow':True,'errors':errors,'missingFiles':missing}),flush=True)
 await p.close()
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for args in [(1440,1000),(1366,768),(390,844),(320,640),(390,844,True)]:await check(b,*args)
  await b.close()
if __name__=='__main__':asyncio.run(main())
