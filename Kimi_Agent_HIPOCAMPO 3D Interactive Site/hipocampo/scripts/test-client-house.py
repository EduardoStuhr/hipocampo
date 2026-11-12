"""Check restored house captions/daylight and the devotional card on the table."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
MOBILE=os.getenv('CLIENT_HOUSE_MOBILE')=='1'
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'client-house'/('mobile' if MOBILE else 'desktop');OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  p=await b.new_page(viewport={'width':390 if MOBILE else 1366,'height':844 if MOBILE else 768});errors=[]
  p.on('pageerror',lambda e:errors.append(str(e)))
  p.on('console',lambda m:errors.append(m.text)if m.type=='error'and 'Shader Error' in m.text else None)
  await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
  await p.wait_for_function("document.documentElement.dataset.editorialMotionReady==='true'&&document.querySelector('#sobre')&&document.querySelector('#vestigios')")
  await p.wait_for_timeout(1000)
  await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#projeto'),{immediate:true,force:true})")
  await p.wait_for_function("document.querySelector('#casa')?.houseJourney",timeout=120000)
  async def go(v):
   await p.evaluate("async v=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-house');__hipocampoLenis.scrollTo(s.start+v*(s.end-s.start),{immediate:true,force:true});ST.update()}",v)
   await p.wait_for_function('(v)=>Math.abs(document.querySelector("#casa").houseJourney.inspect().progress-v)<.003',arg=v,timeout=30000)
  async def captions():return await p.locator('.page3-caption').evaluate_all('(es)=>es.map(e=>Number(getComputedStyle(e).opacity))')
  await go(.10);a=await captions();assert a[0]>.9 and a[1]<.01,a
  await p.screenshot(path=str(OUT/'house-caption-a.png'))
  await go(.275);a=await captions();assert a[0]<.01 and a[1]>.9,a
  assert await p.locator('header').get_attribute('data-nav-theme')=='light'
  light=await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().interior.entranceDaylight')
  assert not light['visible'] and light['opacity']==0,light
  assert (await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().doorOpen'))==0
  await p.screenshot(path=str(OUT/'house-door-closed.png'))
  opening=[]
  for progress in [.34,.39,.48,.51]:
   await go(progress)
   current=await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect()')
   opening.append({'progress':progress,'open':current['doorOpen'],'light':current['interior']['entranceDaylight']})
   if progress==.39:await p.screenshot(path=str(OUT/'house-door-opening.png'))
  assert all(a['open']<b['open']for a,b in zip(opening,opening[1:])),opening
  assert opening[2]['open']<.97 and opening[3]['open']>.999,opening
  assert max(e['light']['opacity']for e in opening)<=.22,opening

  await go(.65);a=await captions();assert max(a)<.01,a
  state=await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect()')
  assert not state['interior']['entranceDaylight']['visible'],state
  assert await p.locator('header').get_attribute('data-nav-theme')=='dark'
  await p.screenshot(path=str(OUT/'house-room.png'))
  x=180 if MOBILE else 700
  await p.mouse.move(x,300);await p.mouse.down();await p.mouse.move(x+100,320,steps=5);await p.mouse.up()
  await p.wait_for_timeout(400)
  assert abs(await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().view.targetYaw'))>.1
  await p.wait_for_function('!document.querySelector("#casa").houseJourney.inspect().framePending',timeout=30000)
  before=await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().renderedFrames');await p.wait_for_timeout(700)
  assert before==await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().renderedFrames')
  if MOBILE and await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().view.active'):
   await p.locator('.page3-look-toggle').click()
  await go(.275);assert (await captions())[1]>.9
  assert not (await p.locator('#casa').evaluate('(e)=>e.houseJourney.inspect().interior.entranceDaylight.visible'))
  await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
  await p.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared",timeout=120000)
  await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
  await p.locator('#instalacao').evaluate("e=>{e.installationRoom.moveToTable('objeto-67');e.installationRoom.moveToTable('objeto-68');e.installationRoom.moveToTable('objeto-45')}")
  await p.wait_for_function("document.querySelector('#instalacao').installationRoom.inspect().movingObjects===0")
  if await p.locator('.installation-mobile-tools').count():
   await p.locator('.installation-mobile-tools > summary').click()
  async with p.expect_download()as event:await p.locator('#instalacao [data-action=take-photo]').click()
  photo=await event.value;await photo.save_as(str(OUT/'holy-cards-table.png'));assert await photo.failure()is None
  await p.locator('#instalacao [data-action=reset]').click()
  assert not any(o['atTable']for o in await p.locator('#instalacao').evaluate('(e)=>e.installationRoom.inspect().objects'))
  assert not errors,errors
  result={'captionsDisjoint':True,'closedDoorUncovered':True,'opening':opening,'mobile':MOBILE,'daylightHiddenInside':True,'rotationAndIdle':True,'devotionalCardsPhotographed':True,'errors':errors}
  print(json.dumps(result),flush=True);(OUT/'result.json').write_text(json.dumps(result,indent=2));await b.close()
asyncio.run(main())
