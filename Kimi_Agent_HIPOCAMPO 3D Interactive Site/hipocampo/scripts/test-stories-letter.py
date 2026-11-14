"""Verify the immersive scroll envelope, full-screen white room and requested fonts."""
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
 root=p.locator('#relatos');paper=root.locator('.stories-letter-paper');track=root.locator('.stories-scroll-track');room=root.locator('.stories-reading-room')
 assert await p.locator('#team-finale-title').inner_text()=='SOBRE NÓS'
 assert await p.locator('#team-finale-title').evaluate('(e)=>getComputedStyle(e).fontFamily.includes("AquilineTwo")')
 assert await p.locator('.team-credit h3').first.evaluate('(e)=>getComputedStyle(e).fontFamily.includes("SquidBoy")')
 assert await p.locator('.team-credit-roles').first.evaluate('(e)=>getComputedStyle(e).fontFamily.includes("SquidBoy")')
 assert await p.evaluate('document.fonts.check(\'400 48px "AquilineTwo"\') && document.fonts.check(\'400 18px "SquidBoy"\')')
 assert (await room.text_content()).strip()=='Em breve, relatos'
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
  assert await root.locator('.stories-envelope-scene').evaluate('(e)=>getComputedStyle(e).display')=='none'
  assert await room.get_attribute('aria-hidden')=='false'
  assert await track.evaluate('(e)=>e.offsetHeight')<h*1.6
  assert await root.locator('.stories-envelope-canvas').count()==0
  await p.screenshot(path=str(OUT/f'reduced-{w}.png'),style=style)
 else:
  states=[]
  for fraction in (0,.2,.45,.7,1):
   await go(fraction)
   if fraction==0:
    await p.wait_for_function("document.querySelector('.stories-correspondence').envelopeExperience?.getDiagnostics().ready",timeout=45000)
    await p.wait_for_timeout(150)
    initial=await p.locator('.stories-correspondence').evaluate('(e)=>e.envelopeExperience.getDiagnostics()')
    assert initial['triangles']>1000 and initial['triangles']<10000 and initial['drawCalls']<=25,initial
    assert initial['pixelRatio']<=1.5,initial
    await p.wait_for_timeout(600)
    idle=await p.locator('.stories-correspondence').evaluate('(e)=>e.envelopeExperience.getDiagnostics()')
    assert idle['frames']<=initial['frames']+1,(initial,idle)
   state=await root.evaluate('''e=>{const p=e.querySelector('.stories-letter-paper'),f=e.querySelector('.stories-envelope-flap'),front=e.querySelector('.stories-envelope-front');return {phase:e.dataset.letterPhase,scaleY:new DOMMatrix(getComputedStyle(p).transform).m22,flap:getComputedStyle(f).transform,frontOpacity:Number(getComputedStyle(front).opacity)}}''')
   states.append(state)
   await p.screenshot(path=str(OUT/f'scroll-{w}-{int(fraction*100)}.png'),style=style)
  assert states[0]['phase']=='closed',states
  assert states[0]['scaleY']<.5,states
  assert states[-1]['phase']=='open',states
  assert states[-1]['scaleY']>1.5 and states[-1]['frontOpacity']<.01,states
  assert states[1]['flap']!=states[0]['flap'],states
  finalModel=await p.locator('.stories-correspondence').evaluate('(e)=>e.envelopeExperience.getDiagnostics()')
  assert finalModel['topAngle']<-2 and finalModel['leftAngle']<-2,finalModel
  assert finalModel['cameraZ']<initial['cameraZ']/2,finalModel
  assert await root.locator('.stories-envelope-canvas').count()==1
  assert await room.get_attribute('aria-hidden')=='false'
  rect=await paper.bounding_box()
  assert rect['x']<=0 and rect['x']+rect['width']>=w-1,rect
  assert rect['y']<=0 and rect['y']+rect['height']>=h-1,rect
  roomRect=await room.bounding_box()
  assert abs(roomRect['x'])<1 and abs(roomRect['y'])<1 and abs(roomRect['width']-w)<1 and abs(roomRect['height']-h)<1,roomRect
  assert await p.locator('#root > header').get_attribute('data-nav-theme')=='light'
  await go(0)
  assert await root.get_attribute('data-letter-phase')=='closed'
  assert await room.get_attribute('aria-hidden')=='true'
  assert await p.locator('#root > header').get_attribute('data-nav-theme')=='dark'
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
 if not reduced:
  offscreen=await p.locator('.stories-correspondence').evaluate('(e)=>e.envelopeExperience.getDiagnostics()')
  await p.wait_for_timeout(600)
  stopped=await p.locator('.stories-correspondence').evaluate('(e)=>e.envelopeExperience.getDiagnostics()')
  assert stopped['frames']<=offscreen['frames']+1,(offscreen,stopped)
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert await p.locator('#informacoes .team-credit').count()==10
 assert await p.locator('#informacoes .team-credit img').count()==10
 if w==1440 and not reduced:
  await go(.45)
  canRestore=await p.evaluate('''()=>{const canvas=document.querySelector('.stories-envelope-canvas');window.__letterTestContext=canvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!window.__letterTestContext)return false;window.__letterTestContext.loseContext();return true}''')
  if canRestore:
   await p.wait_for_timeout(300)
   assert await p.locator('.stories-correspondence').evaluate('(e)=>e.envelopeExperience.getDiagnostics().contextLost')
   assert not await p.locator('.stories-correspondence').evaluate('(e)=>e.classList.contains("stories-three-ready")')
   await p.evaluate('window.__letterTestContext.restoreContext()')
   await p.wait_for_function("document.querySelector('.stories-correspondence').envelopeExperience?.getDiagnostics().ready",timeout=15000)
   await p.evaluate('delete window.__letterTestContext')
  await p.emulate_media(reduced_motion='reduce');await p.wait_for_timeout(400)
  assert await root.locator('.stories-envelope-canvas').count()==0
  assert await root.get_attribute('data-letter-phase')=='open'
  await p.emulate_media(reduced_motion='no-preference');await p.wait_for_timeout(400)
  await p.set_viewport_size({'width':390,'height':844});await p.wait_for_timeout(500)
  await p.evaluate("async()=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');ST.refresh()}")
  await go(1)
  resized=await paper.bounding_box()
  assert resized['x']<=0 and resized['x']+resized['width']>=389 and resized['y']<=0 and resized['y']+resized['height']>=843,resized
  assert await p.evaluate("async()=>{const {t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');return ST.getAll().filter(t=>t.vars.id==='hipocampo-stories-letter').length}")==1
  await go(0);assert await root.get_attribute('data-letter-phase')=='closed'
 assert not errors,errors
 assert not missing,missing
 print(json.dumps({'viewport':[w,h],'reducedMotion':reduced,'fullScreenWhite':True,'fontsLoaded':True,'scrollReversible':not reduced,'nativeWheelOrTouch':not reduced,'aboutTitle':True,'noOverflow':True,'errors':errors,'missingFiles':missing}),flush=True)
 await p.close()
async def check_fallback(browser):
 p=await browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 await p.add_init_script("""(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(this.classList.contains('stories-envelope-canvas')&&type.startsWith('webgl'))return null;return original.call(this,type,...args)}})()""")
 await p.goto(os.environ.get('HIPOCAMPO_TEST_URL','http://127.0.0.1:4180/'),wait_until='domcontentloaded')
 await p.wait_for_selector('#relatos[data-letter-ready]');await p.keyboard.press('Escape')
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')")
 await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#relatos'),{immediate:true,force:true})")
 await p.wait_for_function("document.querySelector('.stories-correspondence').dataset.envelopeFallback==='true'",timeout=20000)
 assert await p.locator('.stories-envelope-canvas').count()==0
 assert await p.locator('.stories-envelope-scene').evaluate('(e)=>getComputedStyle(e).opacity')=='1'
 await p.evaluate("()=>{const e=document.querySelector('.stories-scroll-track');__hipocampoLenis.scrollTo(e.getBoundingClientRect().top+scrollY+e.offsetHeight-innerHeight,{immediate:true,force:true})}")
 await p.wait_for_timeout(500)
 assert await p.locator('.stories-reading-room').get_attribute('aria-hidden')=='false'
 assert await p.locator('.stories-reading-room').inner_text()=='Em breve, relatos'
 assert not errors,errors
 print(json.dumps({'webglUnavailableFallback':True,'scrollAndReadingPreserved':True,'errors':errors}),flush=True)
 await p.close()

async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for args in [(1440,1000),(1366,768),(390,844),(320,640),(390,844,True)]:await check(b,*args)
  await check_fallback(b)
  await b.close()
if __name__=='__main__':asyncio.run(main())
