"""Check the original portraits, white letterforms and team interactions."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'team-finale';OUT.mkdir(parents=True,exist_ok=True)
NAMES=['Mariana','Heitor','Guilherme','Heloiza','Gabriel','Lara','Tiago','Raphael','Beatriz']
async def check(b,w,h,reduced=False):
 p=await b.new_page(viewport={'width':w,'height':h},is_mobile=w<768,has_touch=w<768,reduced_motion='reduce'if reduced else'no-preference')
 errors=[];missing=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 p.on('response',lambda r:missing.append(r.url)if r.status>=400 and '127.0.0.1' in r.url else None)
 await p.goto(os.environ.get('HIPOCAMPO_TEST_URL', 'http://127.0.0.1:4173/'),wait_until='domcontentloaded')
 await p.wait_for_selector('.team-finale');await p.keyboard.press('Escape')
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')")
 await p.evaluate('document.fonts.ready')
 async def go(s):
  await p.evaluate('(s)=>{__hipocampoLenis.resize();__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true})}',s);await p.wait_for_timeout(600)
 await go('#informacoes');await p.wait_for_timeout(1100)
 root=p.locator('#informacoes')
 assert await root.locator('.team-letter').all_text_contents()==list('HIPOCAMPO')
 assert await root.locator('.team-letter').first.evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
 assert await root.locator('.team-finale-title').evaluate('(e)=>getComputedStyle(e).color')=='rgb(255, 255, 255)'
 assert await p.evaluate('document.fonts.check(\'700 80px "HipocampoFinale"\')')
 assert await root.locator('.team-finale-title').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}')
 assert await root.locator('.team-portrait-card').count()==9
 chips=root.locator('.team-name-list button')
 assert await chips.all_text_contents()==NAMES
 await p.wait_for_function("[...document.querySelectorAll('.team-portrait-card img')].every(i=>i.complete&&i.naturalWidth)")
 assert await root.locator('.team-portrait-card img').count()==9
 assert await root.locator('.team-portrait-card img').evaluate_all('(es)=>es.map(e=>e.getAttribute("src"))')==[f'/images/team/{n.lower()}.webp'for n in NAMES]
 assert await p.locator('header').get_attribute('data-nav-theme')=='dark'
 for i,name in enumerate(NAMES):
  chip=chips.nth(i)
  if w<768:await chip.tap()
  else:await chip.click()
  await p.wait_for_timeout(400)
  assert await chip.get_attribute('aria-pressed')=='true'
  assert await root.locator('.team-portrait-slot.is-active').count()==1
  if w<768:
   assert await root.locator('.team-portrait-slot.is-active').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth}'),name
  await chip.press('Escape')
  assert await root.locator('.team-portrait-slot.is-active').count()==0
  assert await chip.get_attribute('aria-pressed')=='false'
 await go('#informacoes')
 title=root.locator('.team-finale-title');letters=root.locator('.team-letter')
 before=await title.bounding_box()
 if w>=768:
  a=await letters.nth(0).bounding_box()
  await p.mouse.move(a['x']+a['width']/2,before['y']+before['height']/2);await p.wait_for_timeout(400)
  shifts=await letters.evaluate_all('(es)=>es.map(e=>new DOMMatrix(getComputedStyle(e).transform).m42)')
  if reduced:assert all(abs(v)<.01 for v in shifts),shifts
  else:
   assert min(shifts)<-5 and shifts.index(min(shifts))<=1,shifts
   a=await letters.nth(8).bounding_box()
   await p.mouse.move(a['x']+a['width']/2,before['y']+before['height']/2);await p.wait_for_timeout(400)
   shifts=await letters.evaluate_all('(es)=>es.map(e=>new DOMMatrix(getComputedStyle(e).transform).m42)')
   assert min(shifts)<-5 and shifts.index(min(shifts))>=7,shifts
   await p.screenshot(path=str(OUT/'word-hover.png'))
  await p.mouse.move(5,5);await p.wait_for_timeout(450)
 assert await letters.evaluate_all('(es)=>es.every(e=>!e.style.transform)')
 after=await title.bounding_box();assert abs(after['width']-before['width'])<1
 assert await title.get_attribute('data-interacting') is None
 if w>=768:
  r=await root.locator('.team-portrait-card').nth(3).bounding_box()
  await p.mouse.move(r['x']+r['width']/2,r['y']+35);await p.wait_for_timeout(100)
  assert await root.locator('.team-portrait-slot.is-active').count()==1
  await p.mouse.move(5,5)
 name=f'{w}'+('-reduced'if reduced else'')
 await p.screenshot(path=str(OUT/f'checked-{name}.png'),full_page=False)
 if reduced:assert await root.locator('.team-portrait-slot').first.evaluate('(e)=>getComputedStyle(e).animationName')=='none'
 else:assert await root.locator('.team-portrait-slot').first.evaluate('(e)=>getComputedStyle(e).animationPlayState')=='running'
 await go('#sobre')
 assert await root.locator('.team-portrait-slot').first.evaluate('(e)=>getComputedStyle(e).animationPlayState')=='paused' or reduced
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 assert not missing,missing
 result={'viewport':[w,h],'reducedMotion':reduced,'originalPortraits':9,'whiteLetterforms':'HIPOCAMPO','selectionAllNine':True,'wordHoverVerified':w>=768,'offscreenPaused':True,'errors':errors,'missingLocalFiles':missing}
 print(json.dumps(result),flush=True);await p.close();return result
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for args in [(1440,900),(390,844),(375,667),(320,640),(390,844,True),(1440,900,True)]:results.append(await check(b,*args))
  (OUT/'results.json').write_text(json.dumps(results,indent=2));await b.close()
if __name__=='__main__':asyncio.run(main())
