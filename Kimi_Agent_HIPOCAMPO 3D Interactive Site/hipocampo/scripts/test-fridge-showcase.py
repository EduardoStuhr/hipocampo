import asyncio,json,os
from pathlib import Path
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'fridge-showcase'
OUT.mkdir(parents=True,exist_ok=True)
from playwright.async_api import async_playwright
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for w,h in [(1440,900),(390,844)]:
   p=await b.new_page(viewport={'width':w,'height':h},is_mobile=w<768,has_touch=w<768);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
   await p.goto(os.environ.get('HIPOCAMPO_TEST_URL','http://127.0.0.1:4173/'),wait_until='domcontentloaded');await p.wait_for_selector('.team-credit-grid');await p.keyboard.press('Escape');await p.wait_for_function("!document.querySelector('.hipocampo-intro')")
   async def go(sel):
    await p.evaluate('(s)=>{__hipocampoLenis.resize();__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true,offset:-180})}',sel);await p.wait_for_timeout(400)
   await go('.page4-photo--geladeira')
   await p.wait_for_selector('.page4-photo--geladeira.is-3d-ready')
   fig=p.locator('.page4-photo--geladeira');button=fig.locator('button')
   assert await button.get_attribute('aria-pressed')=='false'
   fridgeBounds=await fig.bounding_box();letterBounds=await p.locator('.page4-photo--envelope').bounding_box()
   assert fridgeBounds['x']-letterBounds['x']-letterBounds['width']>=24,(fridgeBounds,letterBounds)
   await fig.screenshot(path=str(OUT/f'closed-{w}.png'))
   await button.click();await p.wait_for_function("Math.abs(document.querySelector('.page4-photo--geladeira').fridgeShowcase.getDiagnostics().angle + 1.8) < .002")
   d=await fig.evaluate('e=>e.fridgeShowcase.getDiagnostics()');assert d['open'] and abs(d['angle']+1.8)<.01,d
   assert d['triangles']<25000,d
   assert d['projectedBounds']['min']>=-.95 and d['projectedBounds']['max']<=.95,d
   await fig.screenshot(path=str(OUT/f'open-{w}.png'))
   a=await fig.evaluate('e=>e.fridgeShowcase.getDiagnostics().frames');await p.wait_for_timeout(250);z=await fig.evaluate('e=>e.fridgeShowcase.getDiagnostics().frames');assert a==z,(a,z)
   await button.focus();await p.keyboard.press('Space');await p.wait_for_function("document.querySelector('.page4-photo--geladeira').fridgeShowcase.getDiagnostics().angle === 0")
   assert await button.get_attribute('aria-pressed')=='false'
   await go('#vestigios')
   if w<768:
    text=await p.locator('.page5-text').bounding_box();camera=await p.locator('.page5-camera-control').bounding_box()
    assert abs(text['x']+text['width']/2-camera['x']-camera['width']/2)<1,(text,camera)
    assert abs(text['width']/camera['width']-16.5/21)<.01,(text,camera)
    assert text['x']>=32
   a=await fig.evaluate('e=>e.fridgeShowcase.getDiagnostics().frames');await p.wait_for_timeout(250);z=await fig.evaluate('e=>e.fridgeShowcase.getDiagnostics().frames');assert a==z
   assert not errors,errors
   print(w,d,'idle/offscreen okay',flush=True)
   await p.close()
  await b.close()
asyncio.run(main())
