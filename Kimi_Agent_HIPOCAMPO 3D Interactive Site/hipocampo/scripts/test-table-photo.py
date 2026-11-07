"""Run with the app on PORT=4173 and Python Playwright/Chromium installed.
Checks real PNG downloads, live table arrangements and overhead camera controls.
Evidence is saved under artifacts/table-photo; no production response is mocked.
"""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image,ImageChops,ImageStat
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'table-photo'
OUT.mkdir(parents=True,exist_ok=True)
async def check(browser,name,viewport,touch=False,reduced=False):
 context=await browser.new_context(viewport=viewport,has_touch=touch,is_mobile=touch,accept_downloads=True,reduced_motion='reduce' if reduced else 'no-preference')
 page=await context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 await page.goto(os.getenv('HOUSE_TEST_URL','http://127.0.0.1:4173/'),wait_until='domcontentloaded')
 await page.wait_for_selector('#instalacao')
 await page.wait_for_function('window.__hipocampoLenis')
 async def visit():
  await page.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
  await page.wait_for_timeout(350)
 await visit()
 await page.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared",timeout=120000)
 await visit()
 root=page.locator('#instalacao')
 assert await root.locator('.installation-intro').count()==0
 assert await root.locator('.installation-toolbar > p').count()==0
 assert 'gire 360' not in await root.locator('.installation-caption').inner_text()
 async def state():return await root.evaluate('(el)=>el.installationRoom.inspect()')
 async def photo(label):
  before=await state()
  async with page.expect_download()as event:
   await root.locator('[data-action=take-photo]').click()
  download=await event.value
  assert download.suggested_filename.startswith('hipocampo-minha-mesa-')
  assert download.suggested_filename.endswith('.png')
  assert await download.failure()is None
  path=OUT/f'{name}-{label}.png';await download.save_as(str(path))
  im=Image.open(path).convert('RGB')
  assert im.size==(1600,1000),im.size
  assert max(ImageStat.Stat(im).stddev)>10,'blank photo'
  after=await state()
  assert before['viewMode']==after['viewMode']
  assert before['camera']==after['camera'],'photo changed viewing position'
  assert await root.locator('.installation-photo-result a[download]').is_visible()
  return path
 initial=await state()
 await root.locator('[data-action=top-view]').click()
 await page.wait_for_timeout(200)
 top=await state();assert top['viewMode']=='table-top'
 assert top['cameraDirection'][1]<-.9999,top['cameraDirection']
 assert await root.locator('[data-action=top-view]').get_attribute('aria-pressed')=='true'
 await root.locator('.installation-zoom').get_by_role('button',name='aproximar',exact=True).click()
 zoom=await state();assert zoom['camera']['distance']<top['camera']['distance']
 await root.locator('[data-action=top-view]').click()
 restored=await state();assert restored['viewMode']=='room'
 assert restored['camera']==initial['camera'],'return failed to restore room view'
 empty=await photo('empty')
 await root.locator('.installation-accessible summary').click()
 for label in ['Cartão-postal 1','Relógio','Câmera']:
  await root.locator('.installation-accessible').get_by_role('button',name=label,exact=True).click()
 await visit();await page.wait_for_timeout(800)
 assert len([o for o in (await state())['objects']if o['atTable']])==3
 await root.locator('[data-action=top-view]').click()
 await page.wait_for_timeout(250)
 await page.screenshot(path=str(OUT/f'{name}-top-view.png'))
 filled=await photo('filled')
 diff=ImageChops.difference(Image.open(empty).convert('RGB'),Image.open(filled).convert('RGB'))
 assert sum(ImageStat.Stat(diff).mean)>1,'photo ignores arrangement'
 # Move one print in the overhead view and verify its stored placement changes.
 target=root.locator('[data-object="objeto-02"]')
 bounds=await target.bounding_box()
 before=next(o for o in (await state())['objects']if o['id']=='objeto-02')
 x=bounds['x']+bounds['width']/2;y=bounds['y']+bounds['height']/2
 if touch:
  cdp=await context.new_cdp_session(page)
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
  for delta in [8,16,24]:await cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+delta,'y':y+12}]})
  await cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 else:
  await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+35,y+15,steps=6);await page.mouse.up()
 await page.wait_for_timeout(800)
 after=next(o for o in (await state())['objects']if o['id']=='objeto-02')
 assert after['atTable'] and before['position']!=after['position'],(before,after)
 await photo('rearranged')
 await root.locator('[data-action=top-view]').click()
 # Taking a picture also works directly from the room and preserves its camera.
 await photo('from-room')
 await root.get_by_role('button',name='fechar geladeira',exact=True).click()
 assert not (await state())['fridgeOpen']
 await root.locator('[data-action=reset]').click()
 reset=await state();assert reset['viewMode']=='room'and not any(o['atTable']for o in reset['objects'])
 assert reset['fridgeOpen']
 await page.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao').nextElementSibling,{immediate:true,force:true})")
 await page.wait_for_timeout(350)
 assert not (await state())['scrollReserved']
 assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 result={'scenario':name,'photos':4,'overheadPicking':True,'restoresRoomCamera':True,'errors':errors}
 (OUT/f'{name}.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
 await context.close()
async def main():
 async with async_playwright()as p:
  browser=await p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  for args in [('desktop',{'width':1366,'height':768},False,False),('mobile',{'width':390,'height':844},True,False),('reduced',{'width':1366,'height':768},False,True)]:await check(browser,*args)
  await browser.close()
asyncio.run(main())
