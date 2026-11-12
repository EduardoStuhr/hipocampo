"""Regression: five-second intro, reading-before-house and explicit overhead exit."""
import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'reading-flow';OUT.mkdir(parents=True,exist_ok=True)
async def run(browser,name,viewport):
 p=await browser.new_page(viewport=viewport);errors=[]
 p.on('pageerror',lambda e:errors.append(str(e)))
 await p.add_init_script('''window.__introLeft=null;new MutationObserver(()=>{if(document.querySelector('.hipocampo-intro.is-leaving')&&__introLeft===null)__introLeft=performance.now()}).observe(document,{childList:true,subtree:true,attributes:true,attributeFilter:['class']})''')
 await p.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
 await p.wait_for_function("document.documentElement.dataset.editorialMotionReady==='true'&&document.querySelector('#sobre')&&document.querySelector('#vestigios')")
 await p.wait_for_function("!document.querySelector('.hipocampo-intro')",timeout=9000)
 intro=await p.evaluate('__introLeft');assert 4100<=intro<7000,intro
 total=await p.evaluate('performance.now()');assert total>=5000,total
 await p.evaluate('document.fonts.ready');await p.wait_for_timeout(600)
 layout=await p.evaluate('''async()=>{
  const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');ST.refresh();__hipocampoLenis.resize();
  const c=document.querySelector('.hipocampo-page2-copy p:last-of-type'),r=c.getBoundingClientRect(),s=ST.getById('hipocampo-house')||ST.getById('hipocampo-house-preview');
  return {lastTextBottom:r.bottom+scrollY,houseStart:s.start,projectTop:document.querySelector('#projeto').getBoundingClientRect().top+scrollY};
 }''')
 assert layout['houseStart']>=layout['lastTextBottom']-2,layout
 reading=max(layout['projectTop'],layout['lastTextBottom']-viewport['height']+90)
 await p.evaluate('(y)=>__hipocampoLenis.scrollTo(y,{immediate:true,force:true})',reading);await p.wait_for_timeout(700)
 visible=await p.locator('.hipocampo-page2-copy p:last-of-type').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&r.top>=0}')
 assert visible,layout
 assert await p.locator('[data-memory-map]').get_attribute('data-house-covered')!='true'
 if viewport['width']>1100:
  rect=await p.locator('[data-memory-map]').bounding_box();assert rect['y']>=0 and rect['y']+rect['height']<=viewport['height'],rect
  await p.mouse.move(rect['x']+rect['width']/2,rect['y']+rect['height']/2)
 await p.wait_for_function("Number(getComputedStyle(document.querySelector('.hipocampo-page2-copy p:last-of-type .page2-copy-line:last-child')).opacity)>.98")
 await p.screenshot(path=str(OUT/f'{name}-last-paragraph.png'))
 await p.wait_for_function("document.querySelector('#casa').houseJourney",timeout=120000)
 await p.evaluate("async()=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-house');__hipocampoLenis.scrollTo(s.start+.10*(s.end-s.start),{immediate:true,force:true});ST.update()}")
 await p.wait_for_function("document.querySelector('[data-memory-map]').dataset.houseCovered==='true'")
 await p.screenshot(path=str(OUT/f'{name}-house-handoff.png'))
 await p.evaluate('(y)=>__hipocampoLenis.scrollTo(y,{immediate:true,force:true})',reading)
 await p.wait_for_function("document.querySelector('[data-memory-map]').dataset.houseCovered!=='true'")
 await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
 await p.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared",timeout=120000)
 await p.evaluate("__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
 if await p.locator('.installation-mobile-tools').count():
  await p.locator('.installation-mobile-tools > summary').click()
 button=p.locator('[data-action=top-view]');await button.click()
 await p.locator('#installation-topview-hint').wait_for(state='visible')
 assert await button.inner_text()=='voltar ao normal'
 assert await button.get_attribute('aria-describedby')=='installation-topview-hint'
 assert await p.locator('#instalacao').evaluate('(e)=>e.installationRoom.inspect().viewMode')=='table-top'
 await p.wait_for_timeout(300);await p.screenshot(path=str(OUT/f'{name}-overhead-exit.png'))
 await button.click();assert await p.locator('#installation-topview-hint').count()==0
 assert await p.locator('#instalacao').evaluate('(e)=>e.installationRoom.inspect().viewMode')=='room'
 assert await p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 result={'scenario':name,'introMs':intro,'layout':layout,'lastParagraphReadable':visible,'overheadExitExplained':True,'errors':errors}
 print(json.dumps(result),flush=True);await p.close();return result
async def main():
 async with async_playwright()as pw:
  b=await pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  results=[]
  for name,size in [('desktop',{'width':1366,'height':768}),('mobile',{'width':390,'height':844})]:results.append(await run(b,name,size))
  (OUT/'result.json').write_text(json.dumps(results,indent=2));await b.close()
asyncio.run(main())
