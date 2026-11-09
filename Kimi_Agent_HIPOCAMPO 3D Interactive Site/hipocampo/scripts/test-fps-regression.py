"""Chromium/Playwright integration checks for selective shadows and overlay caches.
Start PORT=4173 npm run dev; run python scripts/test-fps-regression.py.
Tests use reduced motion to compare identical, settled scene states.
"""
import asyncio,json,base64,io,os
from pathlib import Path
from PIL import Image,ImageChops,ImageStat
from playwright.async_api import async_playwright
OUT=Path(__file__).resolve().parents[1]/'artifacts'/'fps';OUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright()as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
  page=await browser.new_page(viewport={'width':900,'height':650},reduced_motion='reduce')
  errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  console_errors=[];page.on('console',lambda m:console_errors.append(m.text)if m.type=='error'else None)
  failed_requests=[];page.on('requestfailed',lambda r:failed_requests.append({'url':r.url,'failure':r.failure}))
  await page.add_init_script('''
   window.__fpsStartup=[];
   const Original=window.IntersectionObserver;
   window.IntersectionObserver=class extends Original {
    constructor(callback,options){
     super((entries,observer)=>{
      for(const e of entries)if(e.target.id==='instalacao'||e.target.classList.contains('installation-stage')){
       window.__fpsStartup.push({at:performance.now(),event:'intersection',target:e.target.id||e.target.className,margin:options?.rootMargin,intersects:e.isIntersecting,top:e.boundingClientRect.top,height:e.boundingClientRect.height});
      }
      callback(entries,observer);
     },options);
    }
   };
  ''')
  async def expose(route):
   response=await route.fetch();source=(await response.text()).replace('  root.installationRoom = api','  window.__qaRoom={scene,renderer,camera,refreshOverlays:updateOverlays};\n  root.installationRoom = api')
   source=source.replace('  const buildStarted = performance.now()',"  window.__fpsStartup.push({event:'scene-start',at:performance.now()});\n  const buildStarted = performance.now()")
   source=source.replace('  root.installationRoom = api',"  window.__fpsStartup.push({event:'scene-ready',at:performance.now()});\n  root.installationRoom = api")
   await route.fulfill(response=response,body=source)
  await page.route('**/assets/installation-scene.js?*',expose)
  try:
   await page.goto('http://127.0.0.1:4173/',wait_until='domcontentloaded')
   # The recovered app mounts before the editorial scripts finish replacing
   # legacy sections/pin spacers. Scrolling as soon as Lenis exists can use a
   # target over 2000px away from its final position and miss the lazy room IO.
   # Require measured layout stability, then perform one deliberate scroll.
   await page.wait_for_function('''()=>{
    const stage=document.querySelector('#instalacao .installation-stage');
    if(!window.__hipocampoLenis||!stage)return false;
    const r=stage.getBoundingClientRect(),now=performance.now();
    const key=[document.documentElement.scrollHeight,r.top+scrollY,r.width,r.height].map(v=>Math.round(v)).join(':');
    const state=window.__fpsLayout||(window.__fpsLayout={key:null,since:now,changes:[]});
    if(key!==state.key){state.key=key;state.since=now;state.changes.push({at:now,key,scrollY});}
    return document.readyState==='complete'&&document.fonts.status==='loaded'&&document.documentElement.dataset.editorialMotionReady==='true'&&document.querySelector('#casa')&&r.height>0&&now-state.since>=750;
   }''',timeout=30000)
   await page.evaluate("__fpsStartup.push({event:'test-scroll',at:performance.now(),scrollY});__hipocampoLenis.resize();__hipocampoLenis.scrollTo(document.querySelector('#instalacao .installation-stage'),{immediate:true,force:true,offset:-110})")
   await page.wait_for_function("document.querySelector('#instalacao')?.installationRoom?.inspect().prepared",timeout=120000)
  except Exception:
   diagnostic=await page.evaluate('''()=>{
    const root=document.querySelector('#instalacao'),stage=root?.querySelector('.installation-stage'),r=stage?.getBoundingClientRect();
    return {scrollY,height:document.documentElement.scrollHeight,stage:r?{top:r.top,height:r.height,documentTop:r.top+scrollY}:null,busy:stage?.getAttribute('aria-busy'),room:root?.installationRoom?.inspect(),layout:window.__fpsLayout,startup:window.__fpsStartup};
   }''')
   diagnostic.update({'pageErrors':errors,'consoleErrors':console_errors,'failedRequests':failed_requests})
   (OUT/'startup-failure.json').write_text(json.dumps(diagnostic,indent=2))
   print(json.dumps({'startupFailure':diagnostic}),flush=True)
   await browser.close()
   raise
  root=page.locator('#instalacao')
  async def state():return await root.evaluate('(el)=>el.installationRoom.inspect()')
  async def settle():
   # A fixed delay can expire before the demand-driven RAF under software GPU
   # load. Compare the actual completed scene, not a pending shadow update.
   await page.wait_for_function("(()=>{const s=document.querySelector('#instalacao')?.installationRoom?.inspect();return s?.visible&&!s.framePending})()",timeout=30000)
  await settle()
  async def change(code):
   await root.evaluate('(el)=>{const api=el.installationRoom;'+code+'}')
   await settle()
  async def compare(label):
   await settle()
   images=await page.evaluate('''()=>{
    const{scene,renderer:r,camera}=__qaRoom;
    r.render(scene,camera);const cached=r.domElement.toDataURL();
    scene.traverse(o=>{if(o.isLight&&o.castShadow)o.shadow.needsUpdate=true});r.shadowMap.needsUpdate=true;
    r.render(scene,camera);return [cached,r.domElement.toDataURL()];
   }''')
   a,b=[Image.open(io.BytesIO(base64.b64decode(x.split(',')[1]))).convert('RGB')for x in images]
   diff=ImageChops.difference(a,b);mean=sum(ImageStat.Stat(diff).mean)
   a.save(OUT/f'shadows-{label}.png')
   assert mean<.01,(label,mean)
   return {'state':label,'meanPixelDifference':mean}
  checks=[await compare('initial')]
  await change("api.moveToTable('objeto-02');api.moveToTable('objeto-36');api.moveToTable('objeto-39')")
  checks.append(await compare('three-objects'))
  s=await state();assert sum(o['atTable']for o in s['objects'])==3
  await change("api.returnToIsland('objeto-02')")
  checks.append(await compare('returned-print'))
  await change('api.toggleFridge()');checks.append(await compare('closed-fridge'))
  await change('api.toggleFridge()');checks.append(await compare('open-fridge'))
  await change('api.setTopView(true)');checks.append(await compare('overhead'))
  # Equivalent-aspect resize must still reproject HTML hit targets.
  target=root.locator('[data-object="objeto-36"]')
  await page.set_viewport_size({'width':1100,'height':800})
  await root.locator('.installation-stage').evaluate("el=>{el.style.width='800px';el.style.height='600px'}")
  await page.wait_for_timeout(350)
  before=await target.bounding_box()
  await root.locator('.installation-stage').evaluate("el=>{el.style.width='900px';el.style.height='675px'}")
  await page.wait_for_timeout(350)
  after=await target.bounding_box();assert before!=after,(before,after)
  async with page.expect_download()as download:
   await root.locator('[data-action=take-photo]').click()
  file=await download.value;path=OUT/'fps-regression-table.png';await file.save_as(str(path));assert Image.open(path).size==(1600,1000)
  checks.append(await compare('after-photo'))
  await change('api.reset()');checks.append(await compare('reset'))
  # An unchanged scene should not cause DOM rewrites or per-object reprojections.
  s=await state()
  await page.evaluate('__qaRoom.refreshOverlays();__qaRoom.refreshOverlays()')
  cached=await state()
  assert cached['performance']['overlayWrites']==s['performance']['overlayWrites']
  assert cached['performance']['overlayProjections']==s['performance']['overlayProjections']
  await change('api.zoom(-1)');await change('api.zoom(1)')
  settled=await state();assert settled['viewMode']=='room'and not any(o['atTable']for o in settled['objects'])
  assert not errors,errors
  result={'checks':checks,'performance':settled['performance'],'renderBudget':settled['renderBudget'],'errors':errors,'startup':await page.evaluate('({layout:window.__fpsLayout,events:window.__fpsStartup})'),'consoleErrors':console_errors,'failedRequests':failed_requests}
  (OUT/'regression.json').write_text(json.dumps(result,indent=2));print(json.dumps(result),flush=True)
  await browser.close()
asyncio.run(main())
