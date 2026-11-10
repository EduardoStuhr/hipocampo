"""Verify the cover slides down, reveals a stationary hero and stays skippable."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'intro-slide';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for name,viewport in [('desktop',{'width':1366,'height':768}),('mobile',{'width':390,'height':844})]:
   p=await b.new_page(viewport=viewport);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
   await p.wait_for_selector('.hipocampo-intro.is-leaving',state='attached',timeout=8000)
   started=await p.evaluate('performance.now()');assert 4100<=started<7000,started
   await p.wait_for_timeout(230)
   sample=await p.locator('.hipocampo-intro').evaluate('(e)=>({top:e.getBoundingClientRect().top,opacity:getComputedStyle(e).opacity})')
   assert 0<sample['top']<viewport['height'],sample
   assert sample['opacity']=='1',sample
   assert await p.evaluate('scrollY')==0
   assert await p.locator('#abertura').evaluate('(e)=>Math.abs(e.getBoundingClientRect().top)<1')
   await p.screenshot(path=str(OUT/f'{name}-revealing.png'))
   await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=2500)
   finished=await p.evaluate('performance.now()');assert 5000<=finished<8500,finished
   assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert not errors,errors
   results.append({'scenario':name,'slideStartedMs':started,'finishedMs':finished,'movingCover':sample,'heroStayedStill':True,'errors':errors})
   await p.close()
  for name,reduced in [('skip',False),('reduced',True)]:
   p=await b.new_page(reduced_motion='reduce' if reduced else 'no-preference')
   await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
   if not reduced:await p.keyboard.press('Escape')
   await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=1500)
   results.append({'scenario':name,'noForcedSlide':True});await p.close()
  (OUT/'result.json').write_text(json.dumps(results,indent=2));print(json.dumps(results),flush=True);await b.close()
asyncio.run(main())
