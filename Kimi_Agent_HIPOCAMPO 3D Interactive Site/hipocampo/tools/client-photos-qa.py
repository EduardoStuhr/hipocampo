"""Real pointer trail and client textures in the house renderer."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('artifacts/client-photos');OUT.mkdir(parents=True,exist_ok=True)
r={'checks':[],'errors':[],'assets':[]}
def check(name,ok,detail=None):
 r['checks'].append({'name':name,'passed':bool(ok),'detail':detail});print(name,ok,detail,flush=True);assert ok,name
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
 for w,h in [(1600,900),(390,844)]:
  c=b.new_context(viewport={'width':w,'height':h});page=c.new_page();page.on('pageerror',lambda e:r['errors'].append(str(e)))
  page.on('response',lambda response:r['assets'].append(response.url)if response.status>=400 and response.url.startswith('http://127.0.0.1:4173')else None)
  def instrument(route):
   response=route.fetch();body=response.text();route.fulfill(response=response,body=body.replace('  const maxAniso =','  window.__clientQA={scene,renderer,camera};\n  const maxAniso =',1))
  page.route('**/assets/page3-house.js?*',instrument)
  page.goto('http://127.0.0.1:4173/',wait_until='networkidle');page.locator('.hipocampo-photo-trail').wait_for(state='attached');page.evaluate('document.fonts.ready')
  if w==1600:
   seen=set()
   for i in range(16):
    page.mouse.move(250 if i%2 else 1000,450 if i%2 else 600);page.wait_for_timeout(90)
    seen.update(page.locator('.hipocampo-trail-photo[src]').evaluate_all('els=>els.map(e=>e.getAttribute("src"))'))
   check('mouse mostra as nove imagens anteriores e as três novas',len(seen)==12 and all(f'/images/client-2026-11/foto-{n}.webp'in seen for n in [3,4,5]),sorted(seen))
   check('rastro não intercepta cliques',page.locator('.hipocampo-photo-trail').evaluate('e=>getComputedStyle(e).pointerEvents')=='none')
   page.screenshot(path=str(OUT/'hero-1600.png'))
  page.wait_for_function('document.querySelector("#casa")?.houseJourney?.inspect().prepared',timeout=60000)
  textures=page.evaluate('''()=>{const a=[];__clientQA.scene.traverse(o=>{const map=o.material?.map;if(o.isMesh&&map?.name?.startsWith('house-client-photo-'))a.push({src:map.name,ratio:o.geometry.parameters.width/o.geometry.parameters.height,loaded:map.image.width>0})});return a}''')
  check(f'{w}: duas fotos carregadas em duas molduras',len(textures)==2 and all(t['loaded']for t in textures),textures)
  check(f'{w}: fotos sem distorção de proporção',all(abs(t['ratio']-(1600/900 if t['src']=='house-client-photo-1'else 900/1600))<.001 for t in textures))
  check(f'{w}: seis molduras e dois pendentes mantêm o balanço',page.locator('#casa').evaluate('e=>e.houseJourney.inspect().interior.swings.length')==8)
  for progress in [.2,.51,.6,.72,.97,.5,.2]:
   page.evaluate('''async p=>{const{t:ST}=await import('/assets/index-BXEErpTi.js?v=perf-1');const s=ST.getById('hipocampo-house');__hipocampoLenis.scrollTo(s.start+p*(s.end-s.start),{immediate:true});ST.update()}''',progress)
   page.wait_for_function('p=>{const s=document.querySelector("#casa").houseJourney.inspect();return Math.abs(s.target-p)<.0004&&Math.abs(s.progress-s.target)<.000001}',arg=progress)
   if progress in [.51,.6,.72]:page.screenshot(path=str(OUT/f'house-{w}-{progress}.png'))
  check(f'{w}: passagem e retorno da casa funcionam',True)
  page.evaluate("()=>__hipocampoLenis.scrollTo(document.querySelector('#sobre'),{immediate:true})");page.wait_for_timeout(200)
  check(f'{w}: seção seguinte acessível e branca',page.locator('#sobre').evaluate('e=>Math.abs(e.getBoundingClientRect().top)<5&&getComputedStyle(e).backgroundColor==="rgb(255, 255, 255)"'))
  check(f'{w}: sem overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  c.close()
 b.close()
check('sem erros JavaScript',not r['errors'],r['errors']);check('sem recursos locais faltando',not r['assets'],r['assets'])
(OUT/'results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
