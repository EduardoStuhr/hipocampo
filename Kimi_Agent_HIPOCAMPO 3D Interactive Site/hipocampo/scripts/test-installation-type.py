"""Check requested typefaces and real controls at desktop/mobile widths."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'installation-type';OUT.mkdir(parents=True,exist_ok=True)
async def run(browser,name,size):
 page=await browser.new_page(viewport=size);errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 await page.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
 await page.wait_for_function("document.documentElement.dataset.editorialMotionReady==='true'&&document.querySelector('#sobre')&&document.querySelector('#vestigios')&&document.readyState==='complete'")
 await page.evaluate('document.fonts.ready');await page.wait_for_timeout(800)
 async def go(s,offset=-100):
  await page.evaluate('([s,offset])=>{__hipocampoLenis.resize();__hipocampoLenis.scrollTo(document.querySelector(s),{immediate:true,force:true,offset})}',[s,offset]);await page.wait_for_timeout(500)
 await go('#instalacao')
 await page.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared",timeout=120000)
 await go('#instalacao',-110);await page.wait_for_timeout(800)
 root=page.locator('#instalacao')
 assert await root.locator('#installation-title').inner_text()=='Instalação virtual'
 assert await root.locator('.installation-caption').count()==0
 assert 'uma sala, muitas vidas' not in (await root.inner_text()).lower()
 assert await root.locator('.installation-memory-label').count()==1
 fonts=await page.evaluate('''()=>({
  nav:getComputedStyle(document.querySelector('#site-nav a')).fontFamily,
  title:getComputedStyle(document.querySelector('#installation-title')).fontFamily,
  control:getComputedStyle(document.querySelector('[data-action=fridge]')).fontFamily,
  color:getComputedStyle(document.querySelector('[data-action=fridge]')).color,
  accessible:getComputedStyle(document.querySelector('.installation-accessible summary')).fontFamily,
  loaded:document.fonts.check('14px "SquidBoy"')&&document.fonts.check('48px "AquilineTwo"')})''')
 assert fonts['loaded'] and 'SquidBoy' in fonts['nav'] and 'SquidBoy' in fonts['control'] and 'SquidBoy' in fonts['accessible'],fonts
 assert 'AquilineTwo' in fonts['title'] and fonts['color']=='rgb(255, 255, 255)',fonts
 await page.screenshot(path=str(OUT/f'{name}-heading.png'))
 if await root.locator('.installation-mobile-tools').count():
  await root.locator('.installation-mobile-tools > summary').click()
 await root.locator('[data-action=fridge]').click()
 await page.wait_for_function("!document.querySelector('#instalacao').installationRoom.inspect().fridgeOpen")
 await root.locator('[data-action=fridge]').click()
 await page.wait_for_function("document.querySelector('#instalacao').installationRoom.inspect().fridgeOpen")
 await go('#instalacao .installation-stage',-180)
 top=root.locator('[data-action=top-view]');await top.click()
 await root.locator('#installation-topview-hint').wait_for(state='visible')
 await page.screenshot(path=str(OUT/f'{name}-controls.png'))
 assert await root.locator('.installation-zoom').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.right<=innerWidth&&r.left>=0}')
 await top.click()
 assert await root.evaluate('(e)=>e.installationRoom.inspect().viewMode')=='room'
 await root.locator('.installation-accessible summary').click()
 await root.locator('.installation-search').fill('Relógio')
 await root.locator('.installation-accessible').get_by_role('button',name='Relógio',exact=True).click()
 await root.locator('[data-action=reset]').click()
 assert not any(o['atTable']for o in await root.evaluate('(e)=>e.installationRoom.inspect().objects'))
 assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 result={'scenario':name,'fonts':fonts,'controlsAndAccessibleCollection':True,'errors':errors}
 print(json.dumps(result),flush=True);await page.close();return result
async def main():
 async with async_playwright()as p:
  b=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for args in [('desktop',{'width':1366,'height':768}),('mobile',{'width':390,'height':844})]:results.append(await run(b,*args))
  (OUT/'result.json').write_text(json.dumps(results,indent=2));await b.close()
asyncio.run(main())
